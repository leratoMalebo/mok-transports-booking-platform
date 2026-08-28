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

        const latestStatus = events.length > 0 ? events[0].status : 'Booked';
        const latestLocation = events.length > 0 ? events[0].location : null;
        const latestEventDate = events.length > 0 ? events[0].date : null;

        // 4. Update status in our DB
        await pool.query(`
      UPDATE waybills
      SET status     = $1,
          updated_at = NOW()
      WHERE id = $2
    `, [latestStatus, shipment.id]);

        return {
            success: true,
            shipment: {
                waybill_no: shipment.waybill_no,
                jkj_reference: shipment.jkj_reference,
                current_status: latestStatus,
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

module.exports = { trackShipment };



