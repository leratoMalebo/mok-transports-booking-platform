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

// ── WAYBILL REFERENCE RESOLUTION ──────────────────────────────
// Since the JKJ account started applying its own "MOK" prefix, a waybill
// we submit as MOK000405 is stored at JKJ as MOKMOK000405, while the scans
// (collection, depot, delivery, POD) are captured against MOK000405 — the
// number printed on the waybill. Confirmed by Parcel Perfect support.
// So the events can live under EITHER number. We try every plausible
// reference and merge what comes back, instead of trusting only the
// jkj_reference saved at submission.
function candidateWaybillRefs(shipment) {
    const refs = [];
    const add = v => {
        const t = String(v || '').trim();
        if (t && !refs.includes(t)) refs.push(t);
    };
    add(shipment.waybill_no);        // e.g. MOK000405 — number the scans use
    add(shipment.jkj_reference);     // e.g. MOKMOK000405 — as returned on submit
    const doubled = String(shipment.jkj_reference || '').match(/^(MOK)MOK(.+)$/i);
    if (doubled) add(doubled[1] + doubled[2]);   // de-duplicated form
    return refs;
}

// Resolves one waybill reference to its tracking number(s) and fetches the
// events for each. Never throws — failures are returned so one bad
// reference cannot hide good data from another.
async function eventsForRef(ref) {
    const events = [];
    const errors = [];
    let trackNos = [];

    try {
        const tracksData = await makeTrackingCall('Waybill', 'getTracks', { waybillno: ref });
        console.log(`[TRACKING] getTracks(${ref}) response:`, JSON.stringify(tracksData));
        if (Number(tracksData.errorcode) === 0) {
            trackNos = (tracksData.results || [])
                .map(r => r.trackno || r.trackingno || r.tracking_no || r.waybillno)
                .filter(Boolean);
        } else {
            errors.push(`${ref}: ${tracksData.errormessage || 'getTracks failed'}`);
        }
    } catch (err) {
        errors.push(`${ref}: ${err.message}`);
    }

    // Fallback: per Parcel Perfect, a waybill number sent as "trackno"
    // returns header-level events.
    const lookups = trackNos.length ? trackNos : [ref];

    await Promise.all(lookups.map(async trackno => {
        try {
            const data = await makeTrackingCall('Waybill', 'getEvents', { trackno });
            console.log(`[TRACKING] getEvents(${trackno}) returned`, (data.results || []).length, 'event(s), errorcode', data.errorcode);
            if (Number(data.errorcode) === 0) {
                events.push(...(data.results || []));
            } else {
                errors.push(`${trackno}: ${data.errormessage || 'getEvents failed'}`);
            }
        } catch (err) {
            errors.push(`${trackno}: ${err.message}`);
        }
    }));

    return { events, errors };
}

// Tries all candidate references in parallel, de-duplicates identical
// scans and returns them oldest-first.
async function collectEvents(refs) {
    const results = await Promise.all(refs.map(eventsForRef));
    const seen = new Set();
    const events = [];
    const errors = [];

    results.forEach(r => {
        errors.push(...r.errors);
        r.events.forEach(ev => {
            const key = [ev.eventdate, ev.eventtime, (ev.eventtype || '').trim(), (ev.scanrule || '').trim(), (ev.hub || '').trim()].join('|');
            if (!seen.has(key)) {
                seen.add(key);
                events.push(ev);
            }
        });
    });

    events.sort((a, b) =>
        `${a.eventdate || ''} ${a.eventtime || '00:00:00'}`.localeCompare(`${b.eventdate || ''} ${b.eventtime || '00:00:00'}`)
    );

    return { rawEvents: events, errors };
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
        const refs = candidateWaybillRefs(shipment);

        console.log("====================================");
        console.log("[TRACKING] Mok Waybill:", shipment.waybill_no);
        console.log("[TRACKING] JKJ Reference:", shipment.jkj_reference);
        console.log("[TRACKING] Trying waybill references:", refs.join(', '));
        console.log("====================================");

        const { rawEvents, errors } = await collectEvents(refs);

        if (!rawEvents.length) {
            console.error('[TRACKING] No events found for any reference. Details:', errors);
            return {
                success: false,
                message: 'Tracking details are not available for this waybill yet. Please check back shortly or contact Mok Transports.'
            };
        }

        const trackingData = { results: rawEvents };

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
        // Same reference problem as tracking: the POD is captured against the
        // number printed on the waybill (MOK000405), not necessarily the
        // JKJ reference saved at submission (MOKMOK000405) — try them all.
        //
        // Confirmed by Parcel Perfect support (Nicole Chivero) with a
        // real worked example: getPOD and getPODSignature take the
        // waybill number directly under the key "waybillno" — NOT
        // "trackno" (that convention only applies to getEvents/getTracks),
        // and no accnum is needed.
        let podData = null;
        let firstOk = null;
        let waybillRef = null;
        let lastMessage = null;

        for (const ref of candidateWaybillRefs(shipment)) {
            try {
                const d = await makeTrackingCall('Waybill', 'getPOD', { waybillno: ref });
                console.log(`[TRACKING] getPOD(${ref}) response:`, JSON.stringify(d, null, 2));
                if (Number(d.errorcode) === 0) {
                    if ((d.results || []).length) { podData = d; waybillRef = ref; break; }
                    if (!firstOk) firstOk = { data: d, ref };
                } else {
                    lastMessage = d.errormessage || lastMessage;
                }
            } catch (e) {
                lastMessage = e.message;
            }
        }

        if (!podData && firstOk) { podData = firstOk.data; waybillRef = firstOk.ref; }

        if (!podData) {
            return {
                success: false,
                message: lastMessage || 'Proof of delivery is not available for this shipment yet.'
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





