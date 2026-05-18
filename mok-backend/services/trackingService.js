// =========================================================
// services/trackingService.js
// JKJ Shipment Tracking Integration
// =========================================================

const axios = require("axios");
const pool = require("../db");

async function trackShipment(trackingNo) {

  try {

    // =====================================================
    // GET SHIPMENT FROM DATABASE
    // =====================================================

    const shipmentResult = await pool.query(`
      SELECT *
      FROM waybills
      WHERE waybill_no = $1
      OR jkj_reference = $1
      LIMIT 1
    `, [trackingNo]);

    if (shipmentResult.rows.length === 0) {

      return {
        success: false,
        message: "Shipment not found"
      };

    }

    const shipment = shipmentResult.rows[0];

    // =====================================================
    // CALL JKJ TRACKING API
    // =====================================================

    const jkjResponse = await axios.post(
      process.env.JKJ_TRACKING_URL,
      {
        username: process.env.JKJ_EMAIL,
        password: process.env.JKJ_PASSWORD,
        waybillno: shipment.jkj_reference
      }
    );

    const trackingData = jkjResponse.data;

    // =====================================================
    // SAMPLE EVENTS MAPPING
    // =====================================================

    let events = [];

    if (trackingData.results) {

      events = trackingData.results.map(item => ({

        status: item.status || "Updated",
        location: item.location || "Unknown",
        date: item.scan_date || new Date()

      }));

    }

    // =====================================================
    // UPDATE DATABASE STATUS
    // =====================================================

    const latestStatus =
      events.length > 0
      ? events[0].status
      : "Created";

    await pool.query(`
      UPDATE waybills
      SET current_status = $1,
          updated_at = NOW()
      WHERE id = $2
    `, [latestStatus, shipment.id]);

    // =====================================================
    // RETURN CLEAN RESPONSE
    // =====================================================

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

    console.error("TRACKING ERROR:", error.message);

    return {

      success: false,

      message: error.message

    };

  }

}

module.exports = {
  trackShipment
};


