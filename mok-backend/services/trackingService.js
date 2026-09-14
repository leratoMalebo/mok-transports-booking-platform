// =============================================================
// mok-backend/services/trackingService.js
// JKJ Shipment Tracking — PPerfect Tracking API
//
// ENV VARS (set in Vercel dashboard):
//   JKJ_TRACKING_URL   = https://tracking.parcelperfect.com/pptrackservice/v13/Json/
//   JKJ_TRACKING_TOKEN = 2022003f0d8c6737fafebef4fff6c34e9fe37e92
//   JKJ_ACCOUNT_NO     = MOK007
// =============================================================

const axios = require('axios');
const pool = require('../db');

const JKJ_TRACKING_URL = process.env.JKJ_TRACKING_URL || 'https://tracking.parcelperfect.com/pptrackservice/v13/Json/';
const JKJ_TRACKING_TOKEN = process.env.JKJ_TRACKING_TOKEN || '2022003f0d8c6737fafebef4fff6c34e9fe37e92';
const JKJ_ACCOUNT_NO = process.env.JKJ_ACCOUNT_NO || 'MOK007';

// ── CORE TRACKING CALL ────────────────────────────────────────
async function makeTrackingCall(className, method, params) {
    const queryParams = {
        params: JSON.stringify(params),
        method: method,
        class: className,
        token_id: JKJ_TRACKING_TOKEN
    };

    console.log(`[TRACKING] Calling ${className}.${method} for:`, params);

    const response = await axios.get(JKJ_TRACKING_URL, {
        params: queryParams,
        timeout: 20000,
        headers: { 'Content-Type': 'application/json' }
    });

    const data = response.data;

    if (typeof data === 'string' && data.trim().startsWith('<')) {
        throw new Error('Tracking API returned HTML — check JKJ_TRACKING_TOKEN and JKJ_TRACKING_URL.');
    }

    return data;
}

// ── TRACK SHIPMENT ────────────────────────────────────────────
// Maps the mapped event list to one of the exact status keys the
// frontend's badge understands: booked / sent_to_jkj / in_transit /
// delivered. Checked in priority order from most-advanced to
// least-advanced, so a shipment with a mix of events is classified by
// how far it's actually progressed.
function normalizeStatus(events) {
    if (!events.length) return 'booked';

    const text = events.map(e => (e.status || '').toLowerCase()).join(' | ');
    const types = events.map(e => (e.eventType || '').toUpperCase());

    if (types.includes('P') || types.includes('I') || text.includes('proof of delivery') || text.includes('delivered')) {
        return 'delivered';
    }
    if (text.includes('dispatch') || text.includes('arrived at destination') || text.includes('loaded for delivery') || text.includes('out for delivery')) {
        return 'in_transit';
    }
    if (text.includes('collected') || text.includes('checked in') || text.includes('manifest') || text.includes('ready for collection')) {
        return 'sent_to_jkj';
    }
    return 'booked';
}

async function trackShipment(trackingNo) {
    try {

        // 1. Look up waybill in our DB first — joined to bookings so we
        // can surface the service type, which tracking.js expects but
        // isn't a column on waybills itself.
        const shipmentResult = await pool.query(`
      SELECT w.*, b.service
      FROM waybills w
      LEFT JOIN bookings b ON b.id = w.booking_id
      WHERE w.waybill_no = $1 OR w.jkj_reference = $1
      LIMIT 1
    `, [trackingNo]);

        if (!shipmentResult.rows.length) {
            return { success: false, message: 'Shipment not found in our system.' };
        }

        const shipment = shipmentResult.rows[0];
        const waybillRef = shipment.jkj_reference || shipment.waybill_no;

        console.log("====================================");
        console.log("[TRACKING] Mok Waybill:", shipment.waybill_no);
        console.log("[TRACKING] JKJ Reference:", shipment.jkj_reference);
        console.log("[TRACKING] Resolving tracking number(s) for waybill:", waybillRef);
        console.log("====================================");

        // Step 1: a waybill number is NOT the same thing as a tracking
        // number in Parcel Perfect's system — confirmed live ("Invalid
        // trackno" when a plain waybill number was submitted directly to
        // getEvents). getTracks resolves the real tracking number(s)
        // associated with this waybill first.
        const tracksData = await makeTrackingCall(
            'Waybill',
            'getTracks',
            { waybillno: waybillRef }
        );

        console.log('[TRACKING] getTracks response:', JSON.stringify(tracksData, null, 2));

        if (Number(tracksData.errorcode) !== 0) {
            throw new Error(tracksData.errormessage || 'Could not resolve a tracking number for this waybill.');
        }

        // Field name for the tracking number isn't confirmed from the
        // docs alone (no sample response provided) — check the plausible
        // variants defensively rather than guess a single one.
        const trackNumbers = (tracksData.results || [])
            .map(r => r.trackno || r.trackingno || r.tracking_no || r.waybillno)
            .filter(Boolean);

        if (!trackNumbers.length) {
            return {
                success: false,
                message: 'No tracking number has been generated for this waybill yet. Please check back shortly.'
            };
        }

        const primaryTrackNo = trackNumbers[0];
        console.log('[TRACKING] Resolved tracking number:', primaryTrackNo, '(of', trackNumbers.length, 'found)');

        // Step 2: fetch events against the tracking number. Confirmed
        // with Parcel Perfect support (Warwick Parris) — the parameter
        // MUST be named "trackno" (not "waybillno"). Either a waybill
        // number or a tracking number can be submitted under this same
        // key; a waybill number returns header-level events, a tracking
        // number returns events for that specific piece.
        const trackingData = await makeTrackingCall(
            'Waybill',
            'getEvents',
            { trackno: primaryTrackNo }
        );

        console.log('[TRACKING] getEvents response:', JSON.stringify(trackingData, null, 2));

        if (Number(trackingData.errorcode) !== 0) {
            throw new Error(trackingData.errormessage || 'Tracking lookup failed');
        }

        // 3. Map events to clean format. Real field names confirmed by
        // Parcel Perfect support: eventdate, eventtime, eventtype,
        // scanrule (human-readable description), hub (location code).
        const events = (trackingData.results || []).map(item => {
            const date = item.eventdate && item.eventtime
                ? `${item.eventdate}T${item.eventtime}`
                : (item.eventdate || new Date().toISOString());
            return {
                status: (item.scanrule || 'Updated').trim(),
                location: (item.hub || 'Unknown').trim(),
                description: (item.scanrule || '').trim(),
                eventType: (item.eventtype || '').trim(),
                date,
                time: item.eventtime || ''
            };
        });

        // JKJ returns events in chronological order (oldest first) — the
        // LAST item is the most recent scan, not the first. Reading
        // events[0] here was the bug causing status/location/updated to
        // always show the very first "Ready for Collection" scan.
        const latest = events.length > 0 ? events[events.length - 1] : null;
        const latestRawStatus = latest ? latest.status : 'Booked';
        const latestLocation = latest ? latest.location : null;
        const latestEventDate = latest ? latest.date : null;

        // Normalize into the exact status keys the frontend badge expects
        // (booked / sent_to_jkj / in_transit / delivered) — the raw scan
        // text ("Proof of delivery image scanned") never matched any of
        // those keys, which is why the badge fell back to "In Progress"
        // even after delivery.
        const latestStatus = normalizeStatus(events);

        // 4. Best-effort: sync the status back onto our own waybills row
        // for other views (e.g. the Waybills list) to reflect. This is
        // a nice-to-have side effect, not part of what the customer
        // actually needs — so a failure here (e.g. a column that
        // doesn't exist, a permissions issue, anything) must never be
        // allowed to wipe out the tracking data we already successfully
        // fetched from Parcel Perfect.
        try {
            await pool.query(`
        UPDATE waybills
        SET status = $1
        WHERE id = $2
      `, [latestStatus, shipment.id]);
        } catch (updateErr) {
            console.error('[TRACKING] Non-fatal: failed to sync status to DB:', updateErr.message);
        }

        return {
            success: true,
            shipment: {
                waybill_no: shipment.waybill_no,
                jkj_reference: shipment.jkj_reference,
                current_status: latestStatus,
                latest_scan_description: latestRawStatus,
                service: shipment.service,
                tracking_location: latestLocation,
                tracking_updated_at: latestEventDate,
                created_at: shipment.created_at,
                updated_at: shipment.updated_at,
                events
            }
        };

    } catch (error) {
        console.error('[TRACKING] Error:', error.message);
        return { success: false, message: error.message };
    }
}

// ── GET PROOF OF DELIVERY ──────────────────────────────────────
// Fetches the POD signature (base64 image) and delivery details for a
// shipment. Only meaningful once a shipment has actually been
// delivered — Parcel Perfect will return an error/empty result
// otherwise, which we surface as a clean "not available yet" message
// rather than a hard failure.
async function getProofOfDelivery(trackingNo) {
    try {
        const shipmentResult = await pool.query(`
      SELECT * FROM waybills
      WHERE waybill_no = $1 OR jkj_reference = $1
      LIMIT 1
    `, [trackingNo]);

        if (!shipmentResult.rows.length) {
            return { success: false, message: 'Shipment not found in our system.' };
        }

        const shipment = shipmentResult.rows[0];
        const waybillRef = shipment.jkj_reference || shipment.waybill_no;

        // Confirmed by Parcel Perfect support (Nicole Chivero) with a
        // real worked example: getPOD and getPODSignature take the
        // waybill number directly under the key "waybillno" — NOT
        // "trackno" (that convention only applies to getEvents/getTracks),
        // and no accnum is needed. No resolution step required either.
        const podData = await makeTrackingCall('Waybill', 'getPOD', { waybillno: waybillRef });
        console.log('[TRACKING] getPOD response:', JSON.stringify(podData, null, 2));

        if (Number(podData.errorcode) !== 0) {
            return {
                success: false,
                message: podData.errormessage || 'Proof of delivery is not available for this shipment yet.'
            };
        }

        const podResult = (podData.results || [])[0] || {};
        const recipientName = podResult.recipient || null;
        const podDate = podResult.poddate || null;
        const podTime = podResult.podtime || null;
        const podImageAvailable = Number(podResult.podImgAvail) === 1;

        // Signature is optional — many deliveries (e.g. left at
        // reception, business deliveries) never capture an electronic
        // signature at all. Parcel Perfect confirmed "POD signature not
        // found" in that case is normal, not an error — treat it as
        // "no signature", not a failure.
        let signatureBase64 = null;
        try {
            const sigData = await makeTrackingCall('Waybill', 'getPODSignature', { waybillno: waybillRef });
            console.log('[TRACKING] getPODSignature response:', JSON.stringify(sigData, null, 2));
            if (Number(sigData.errorcode) === 0) {
                const sigResult = (sigData.results || [])[0] || {};
                signatureBase64 = sigResult.signature || sigResult.image || sigResult.base64 || null;
            }
        } catch (sigErr) {
            console.log('[TRACKING] getPODSignature failed (non-fatal):', sigErr.message);
        }

        // POD image (an actual delivery photo, not a signature) — only
        // fetch it if getPOD's own podImgAvail flag says one exists,
        // per Parcel Perfect's example (params key is "waybill" here,
        // a third naming variant confirmed in their reply — not a typo).
        let podImageUrl = null;
        if (podImageAvailable) {
            try {
                const imgData = await makeTrackingCall('Waybill', 'getPODImage', { waybill: waybillRef, type: '1' });
                console.log('[TRACKING] getPODImage response:', JSON.stringify(imgData, null, 2));
                if (Number(imgData.errorcode) === 0) {
                    podImageUrl = (imgData.results || [])[0]?.message || null;
                }
            } catch (imgErr) {
                console.log('[TRACKING] getPODImage failed (non-fatal):', imgErr.message);
            }
        }

        return {
            success: true,
            pod: {
                waybill_no: shipment.waybill_no,
                recipient_name: recipientName,
                delivered_date: podDate,
                delivered_time: podTime,
                signature_base64: signatureBase64,
                pod_image_url: podImageUrl
            }
        };

    } catch (error) {
        console.error('[TRACKING] POD Error:', error.message);
        return { success: false, message: error.message };
    }
}

module.exports = { trackShipment, getProofOfDelivery };



