// =============================================================
// mok-backend/services/dhlService.js
// MERGED — your latest + import/export account fix
//
// ENV VARS (set in Vercel dashboard):
//   DHL_USERNAME       = your DHL API username
//   DHL_PASSWORD       = your DHL API password
//   DHL_BASE_URL       = https://express.api.dhl.com/mydhlapi
//   DHL_EXPORT_ACCOUNT = 305809711
//   DHL_IMPORT_ACCOUNT = 305939063
// =============================================================

const axios = require("axios");

const DHL_API_URL        = process.env.DHL_BASE_URL       || "https://express.api.dhl.com/mydhlapi";
const DHL_USERNAME       = process.env.DHL_USERNAME;
const DHL_PASSWORD       = process.env.DHL_PASSWORD;
const DHL_EXPORT_ACCOUNT = process.env.DHL_EXPORT_ACCOUNT;
const DHL_IMPORT_ACCOUNT = process.env.DHL_IMPORT_ACCOUNT;

function getAuthHeader() {
  const credentials = Buffer.from(`${DHL_USERNAME}:${DHL_PASSWORD}`).toString("base64");
  return `Basic ${credentials}`;
}

// ── CORE API CALLS ────────────────────────────────────────────
async function dhlPost(endpoint, body) {
  const url = `${DHL_API_URL}${endpoint}`;
  console.log(`[DHL] POST ${endpoint}`);
  const response = await axios.post(url, body, {
    headers: {
      'Authorization':     getAuthHeader(),
      'Content-Type':      'application/json',
      'Accept':            'application/json',
      'Message-Reference': `MOK-${Date.now()}`,
      'Plugin-Name':       'MokTransports',
      'Plugin-Version':    '1.0'
    },
    timeout: 30000
  });
  return response.data;
}

async function dhlGet(endpoint) {
  const url = `${DHL_API_URL}${endpoint}`;
  console.log(`[DHL] GET ${endpoint}`);
  const response = await axios.get(url, {
    headers: { 'Authorization': getAuthHeader(), 'Accept': 'application/json' },
    timeout: 15000
  });
  return response.data;
}

// ── INJECT CORRECT ACCOUNT BASED ON DIRECTION ─────────────────
// Reads shipmentDirection from payload (set by frontend/controller)
// IMPORT → DHL_IMPORT_ACCOUNT, EXPORT → DHL_EXPORT_ACCOUNT
function injectAccount(payload, mode) {
  // Support both payload.shipmentDirection AND mode param
  const direction = (mode || payload.shipmentDirection || 'EXPORT').toUpperCase();
  const isImport  = direction === 'IMPORT';
  const account   = isImport ? DHL_IMPORT_ACCOUNT : DHL_EXPORT_ACCOUNT;

  console.log("================================");
  console.log("DHL Direction:", direction);
  console.log("DHL Import Account:", DHL_IMPORT_ACCOUNT);
  console.log("DHL Export Account:", DHL_EXPORT_ACCOUNT);
  console.log("DHL Selected Account:", account);
  console.log("================================");

  if (payload.accounts) {
    payload.accounts = payload.accounts.map(acc => ({
      ...acc,
      number: acc.number === "SEE_BACKEND" ? account : acc.number
    }));
  }

  // Clean up internal field before sending to DHL
  delete payload.shipmentDirection;
  return payload;
}

// ── CREATE SHIPMENT ───────────────────────────────────────────
exports.createShipment = async (payload, mode) => {
  try {
    const cleanPayload = injectAccount(payload, mode);
    console.log('[DHL] Creating shipment, product:', cleanPayload.productCode);
    const result = await dhlPost('/shipments', cleanPayload);
    console.log('✅ [DHL] Shipment created:', result.shipmentTrackingNumber);
    return result;
  } catch (err) {
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
exports.getRates = async (payload, mode) => {
  try {
    const ratePayload = { ...injectAccount(payload, mode), getRateEstimates: true };
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
      type:        'delivery',
      countryCode: address.countryCode,
      postalCode:  address.postalCode,
      cityName:    address.cityName
    });
    const result = await dhlGet(`/address-validate?${params.toString()}`);
    return result;
  } catch (err) {
    const detail = err.response?.data;
    throw new Error(detail?.detail || detail?.message || err.message);
  }
};



