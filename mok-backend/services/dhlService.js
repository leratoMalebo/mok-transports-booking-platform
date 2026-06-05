// =============================================================
// mok-backend/services/dhlService.js
// DHL Express API Integration
//
// ENV VARS (set in Vercel dashboard):
//  DHL_USERNAME
//  DHL_PASSWORD
//  DHL_EXPORT_ACCOUNT
//  DHL_IMPORT_ACCOUNT
//  DHL_BASE_URL
// =============================================================

const axios = require("axios");

const DHL_API_URL =
    process.env.DHL_BASE_URL || "https://express.api.dhl.com/mydhlapi/test";

const DHL_USERNAME = process.env.DHL_USERNAME;
const DHL_PASSWORD = process.env.DHL_PASSWORD;

const DHL_EXPORT_ACCOUNT = process.env.DHL_EXPORT_ACCOUNT;
const DHL_IMPORT_ACCOUNT = process.env.DHL_IMPORT_ACCOUNT;

function getAuthHeader() {
    const credentials = Buffer.from(
        `${DHL_USERNAME}:${DHL_PASSWORD}`
    ).toString("base64");

    return `Basic ${credentials}`;
}

// ── CORE API CALL ─────────────────────────────────────────────
async function dhlPost(endpoint, body) {
    const url = `${DHL_API_URL}${endpoint}`;
    console.log(`[DHL] POST ${endpoint}`);

    const response = await axios.post(url, body, {
        headers: {
            'Authorization': getAuthHeader(),
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Message-Reference': `MOK-${Date.now()}`,
            'Plugin-Name': 'MokTransports',
            'Plugin-Version': '1.0'
        },
        timeout: 30000
    });

    return response.data;
}

async function dhlGet(endpoint) {
    const url = `${DHL_API_URL}${endpoint}`;
    console.log(`[DHL] GET ${endpoint}`);

    const response = await axios.get(url, {
        headers: {
            'Authorization': getAuthHeader(),
            'Accept': 'application/json'
        },
        timeout: 15000
    });

    return response.data;
}

// ── INJECT ACCOUNT NUMBER INTO PAYLOAD ───────────────────────
// Frontend sends 'SEE_BACKEND' as placeholder — we replace here
function injectAccount(payload) {
    const direction = payload.shipmentDirection || "EXPORT";

    const selectedAccount =
        direction === "IMPORT"
            ? DHL_IMPORT_ACCOUNT
            : DHL_EXPORT_ACCOUNT;


    console.log("[DHL DIRECTION]", payload.shipmentDirection);
    console.log("[DHL ACCOUNT]", selectedAccount);

    if (payload.accounts) {
        payload.accounts = payload.accounts.map(acc => ({
            ...acc,
            number: acc.number === "SEE_BACKEND" ? selectedAccount : acc.number
        }));
    }

    delete payload.shipmentDirection;
    return payload;
}

// ── CREATE SHIPMENT ───────────────────────────────────────────
// Works for both domestic (productCode: N) and international (productCode: P/D)
exports.createShipment = async (payload) => {
    try {
        const cleanPayload = injectAccount(payload);
        console.log('[DHL] Creating shipment, product:', cleanPayload.productCode);

        const result = await dhlPost('/shipments', cleanPayload);
        console.log('✅ [DHL] Shipment created:', result.shipmentTrackingNumber);
        return result;

    } catch (err) {
        // DHL returns structured error details
        const detail = err.response?.data;
        console.error('[DHL] Create shipment error:', JSON.stringify(detail || err.message));
        throw new Error(
            detail?.detail ||
            detail?.message ||
            (Array.isArray(detail) ? detail.map(e => e.message).join(', ') : null) ||
            err.message ||
            'DHL shipment creation failed'
        );
    }
};

// ── TRACK SHIPMENT ────────────────────────────────────────────
exports.trackShipment = async (trackingNumber) => {
    try {
        const result = await dhlGet(`/tracking?shipmentTrackingNumber=${trackingNumber}`);
        console.log('[DHL] Tracking result for:', trackingNumber);
        return result;
    } catch (err) {
        const detail = err.response?.data;
        console.error('[DHL] Track error:', detail || err.message);
        throw new Error(detail?.detail || detail?.message || err.message);
    }
};

// ── GET RATE QUOTE ────────────────────────────────────────────
exports.getRates = async (payload) => {
    try {
        const ratePayload = { ...injectAccount(payload), getRateEstimates: true };
        const result = await dhlPost('/rates', ratePayload);
        return result;
    } catch (err) {
        const detail = err.response?.data;
        console.error('[DHL] Rates error:', detail || err.message);
        throw new Error(detail?.detail || detail?.message || err.message);
    }
};

// ── VALIDATE ADDRESS ──────────────────────────────────────────
exports.validateAddress = async (address) => {
    try {
        const params = new URLSearchParams({
            type: 'delivery',
            countryCode: address.countryCode,
            postalCode: address.postalCode,
            cityName: address.cityName
        });
        const result = await dhlGet(`/address-validate?${params.toString()}`);
        return result;
    } catch (err) {
        const detail = err.response?.data;
        throw new Error(detail?.detail || detail?.message || err.message);
    }
};




