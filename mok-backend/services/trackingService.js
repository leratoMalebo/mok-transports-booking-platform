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

        // 1. Look up waybill in our DB first
        const shipmentResult = await pool.query(`
      SELECT * FROM waybills
      WHERE waybill_no = $1 OR jkj_reference = $1
      LIMIT 1
    `, [trackingNo]);

        if (!shipmentResult.rows.length) {
            return { success: false, message: 'Shipment not found in our system.' };
        }

        const shipment = shipmentResult.rows[0];

        const actualTrackNo =
            `${shipment.waybill_no}0001`;

        const trackingData =
            await makeTrackingCall(
                'Waybill',
                'getEvents',
                {
                    waybillno: shipment.jkj_reference || shipment.waybill_no
                }
            );

        console.log('[TRACKING] Response:', JSON.stringify(trackingData, null, 2));

        if (Number(trackingData.errorcode) !== 0) {
            throw new Error(trackingData.errormessage || 'Tracking lookup failed');
        }

        // 3. Map events to clean format
        const events = (trackingData.results || []).map(item => ({
            status: item.status || item.description || 'Updated',
            location: item.location || item.depot || 'Unknown',
            description: item.description || item.status || '',
            date: item.scan_date || item.date || new Date().toISOString(),
            time: item.scan_time || ''
        }));

        const latestStatus = events.length > 0 ? events[0].status : 'Booked';

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
                events
            }
        };

    } catch (error) {
        console.error('[TRACKING] Error:', error.message);
        return { success: false, message: error.message };
    }
}

module.exports = { trackShipment };









