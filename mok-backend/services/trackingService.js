// =========================================================
// services/trackingService.js
// JKJ Shipment Tracking Integration
// =========================================================

const axios = require("axios");
const crypto = require("crypto");
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
        // GET SALT
        // =====================================================

        const crypto = require("crypto");

        const saltResponse = await axios.post(
            "http://tracking.pperfect.com/pptrackservice/v10/Json/Auth/getSalt",
            {
                username: process.env.JKJ_EMAIL,
                PPcust: process.env.JKJ_ACCOUNT_NO
            }
        );

        console.log("TRACKING SALT RESPONSE:", saltResponse.data);

        const salt =
            saltResponse.data.results[0].salt;

        // =====================================================
        // ENCRYPT PASSWORD
        // =====================================================

        const encryptedPassword =
            crypto
                .createHash("md5")
                .update(process.env.JKJ_PASSWORD + salt)
                .digest("hex");

        // =====================================================
        // GET TOKEN
        // =====================================================

        const tokenResponse = await axios.post(
            "http://tracking.pperfect.com/pptrackservice/v10/Json/Auth/getToken",
            {
                username: process.env.JKJ_EMAIL,
                password: encryptedPassword,
                PPcust: process.env.JKJ_ACCOUNT_NO
            }
        );

        console.log("TRACKING TOKEN RESPONSE:", tokenResponse.data);

        const token =
            tokenResponse.data.results[0].token_id;

        // =====================================================
        // GET TRACKING EVENTS
        // =====================================================

        const trackingResponse = await axios.post(
            process.env.JKJ_TRACKING_URL,
            {
                token,
                waybillno: shipment.jkj_reference
            }
        );

        console.log("TRACKING EVENTS RESPONSE:", trackingResponse.data);

        const trackingData = trackingResponse.data;

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


