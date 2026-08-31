// =========================================================
// routes/tracking.js
// =========================================================

const express = require("express");
const router = express.Router();

const trackingService =
  require("../services/trackingService");

router.get("/:trackingNo", async (req, res) => {

  try {

    const result =
      await trackingService.trackShipment(
        req.params.trackingNo
      );

    res.json(result);

  } catch (error) {

    console.error(error);

    res.status(500).json({
      success: false,
      message: "Tracking failed"
    });

  }

});

router.get("/:trackingNo/pod", async (req, res) => {

  try {

    const result =
      await trackingService.getProofOfDelivery(
        req.params.trackingNo
      );

    res.json(result);

  } catch (error) {

    console.error(error);

    res.status(500).json({
      success: false,
      message: "Failed to load proof of delivery"
    });

  }

});

module.exports = router;


