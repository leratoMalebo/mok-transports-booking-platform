// =============================================================
// mok-backend/services/jkjService.js
// JKJ Express — PPerfect API Integration
//
// ENV VARS (set in Vercel dashboard):
//   JKJ_SUBMIT_URL    = https://jkjweb45760.pperfect.com/ppintegrationservice/v28/Json/
//   JKJ_SUBMIT_TOKEN  = 000710815ba31c469a95714370df353b193c1470
//   JKJ_ACCOUNT_NO    = MOK007
//   JKJ_PPCUST_ID     = 2601.3364.2809
// =============================================================

const axios = require('axios');

const {
  loadPlaces,
  findPlace
} = require('./jkjPlaceLookup');

loadPlaces().catch(err => {

  console.error("Failed to load JKJ Places:", err);

});



// ── ENV ────────────────────────────────────────────────────────
const JKJ_SUBMIT_URL = process.env.JKJ_SUBMIT_URL || 'https://jkjweb45760.pperfect.com/ppintegrationservice/v28/Json/';
const JKJ_SUBMIT_TOKEN = process.env.JKJ_SUBMIT_TOKEN || '000710815ba31c469a95714370df353b193c1470';
const JKJ_ACCOUNT_NO = process.env.JKJ_ACCOUNT_NO || 'MOK007';
const JKJ_PPCUST_ID = process.env.JKJ_PPCUST_ID || '2601.3364.2809';

// ── SERVICE CODE MAP ──────────────────────────────────────────
function mapServiceToJKJ(service) {
  const s = String(service || '').toUpperCase().trim();
  const MAP = {
    'SAMEDAY': 'SDX',
    'SAME_DAY': 'SDX',
    'SAME DAY': 'SDX',
    'SAMEDAY EXPRESS AIR': 'SDX',
    'ONX': 'ONX',
    'OVERNIGHT EXPRESS': 'ONX',
    'OVERNIGHT EXPRESS (ONX)': 'ONX',
    'NDD': 'NDX',
    'NEXTDAY EXPRESS': 'NDX',
    'NEXTDAY': 'NDX',
    'ECO': 'ECO',
    'ECONOMY SERVICE (ECO)': 'ECO',
    'ECONOMY SERVICE': 'ECO',
    'ECONOMY': 'ECO',
  };
  return MAP[s] || 'ECO';
}

// ── DATE HELPER ───────────────────────────────────────────────
function todayDDMMYYYY() {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

// ── CORE API CALL ─────────────────────────────────────────────
async function makeCall(className, method, params) {
  const queryParams = {
    params: JSON.stringify(params),
    method: method,
    class: className,
    token_id: JKJ_SUBMIT_TOKEN
  };

  console.log(`[JKJ] Calling ${className}.${method}`);

  const response = await axios.get(JKJ_SUBMIT_URL, {
    params: queryParams,
    timeout: 30000,
    headers: { 'Content-Type': 'application/json' }
  });

  const data = response.data;

  // Guard: if HTML comes back the token is wrong
  if (typeof data === 'string' && data.trim().startsWith('<')) {
    throw new Error('JKJ returned HTML — check JKJ_SUBMIT_TOKEN and JKJ_SUBMIT_URL env vars.');
  }

  return data;

}

function sanitizeJKJ(value, maxLength = 60) {
  return String(value || "")
    .replace(/'/g, "")
    .replace(/"/g, "")
    .replace(/,/g, " ")
    .replace(/\./g, " ")
    .replace(/\n/g, " ")
    .replace(/\r/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .substring(0, maxLength);
}

function sanitizeJKJPlace(value, maxLength = 30) {
  return String(value || "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .trim()
    .substring(0, maxLength);
}

// ── SUBMIT WAYBILL ────────────────────────────────────────────
exports.submitWaybillToJKJ = async (waybill) => {
  const actualWeight = Math.max(Number(waybill.weight || 1), 0.5);
  const pieces = Number(waybill.pieces || 1);

  // ----------------------------------------------------
  // Find Parcel Perfect Origin & Destination Places
  // ----------------------------------------------------
  console.log("POSTCODE:", waybill.consignor_postcode);
  console.log("TOWN:", waybill.consignor_town);

  console.log("DEST POSTCODE:", waybill.consignee_postcode);
  console.log("DEST TOWN:", waybill.consignee_town);
  const originPlace = findPlace(
    waybill.consignor_postcode,
    waybill.consignor_suburb,
    waybill.consignor_town
  );

  const destinationPlace = findPlace(
    waybill.consignee_postcode,
    waybill.consignee_suburb,
    waybill.consignee_town
  );

  console.log("Origin Place:", originPlace);
  console.log("Destination Place:", destinationPlace);

  const params = {
    details: {
      waybill: waybill.waybill_no,
      accnum: JKJ_ACCOUNT_NO,
      service: mapServiceToJKJ(waybill.service),
      waydate: todayDDMMYYYY(),

      // Consignor (sender)
      // Consignor (sender)
      origpers: sanitizeJKJ(
        waybill.consignor_contact_name || waybill.consignor_name || "Mok Transports",
        40
      ),

      origperadd1: sanitizeJKJ(waybill.consignor_address, 30),
      origperadd2: sanitizeJKJ(waybill.consignor_address2, 30),
      origperadd3: sanitizeJKJ(waybill.consignor_suburb, 30),
      origperadd4: sanitizeJKJ(waybill.consignor_province, 30),

      origperpcode: sanitizeJKJ(waybill.consignor_postcode, 10),

      origtown: sanitizeJKJ(waybill.consignor_town, 30),
      origplace: originPlace || "",

      origpercontact: (waybill.consignor_contact || "")
        .replace(/\D/g, "")
        .substring(0, 15),

      // Consignee (receiver)
      // Consignee (receiver)
      destpers: sanitizeJKJ(
        waybill.consignee_contact_name || waybill.consignee_name || "Receiver",
        40
      ),

      destperadd1: sanitizeJKJ(waybill.consignee_address, 30),
      destperadd2: sanitizeJKJ(waybill.consignee_address2, 30),
      destperadd3: sanitizeJKJ(waybill.consignee_suburb, 30),
      destperadd4: sanitizeJKJ(waybill.consignee_province, 30),

      destperpcode: sanitizeJKJ(waybill.consignee_postcode, 10),

      desttown: sanitizeJKJ(waybill.consignee_town, 30),
      destplace: destinationPlace || "",

      destpercontact: (waybill.consignee_contact || "")
        .replace(/\D/g, "")
        .substring(0, 15),

      reference: sanitizeJKJ(waybill.waybill_no, 30),
      ppcust: JKJ_PPCUST_ID
    },

    contents: [{
      item: 1,
      pieces: pieces,
      description: sanitizeJKJ(waybill.description || "General Cargo", 40),
      dim1: Number(waybill.length || 1),
      dim2: Number(waybill.width || 1),
      dim3: Number(waybill.height || 1),
      actmass: actualWeight
    }],

    tracks: [{
      item: 1,
      parcelno: 1,
      trackno: `${waybill.waybill_no}0001`
    }]
  };

  console.log('[JKJ] Submitting waybill:', waybill.waybill_no);

  console.log("Matched Origin Place:", originPlace);
  console.log("Matched Destination Place:", destinationPlace);
  console.log('[JKJ] Params:', JSON.stringify(params, null, 2));

  const result = await makeCall('Waybill', 'submitWaybill', params);
  console.log('[JKJ] Submit result:', JSON.stringify(result, null, 2));

  if (Number(result.errorcode) !== 0) {
    console.error('[JKJ] Submission rejected:', JSON.stringify(result, null, 2));
    throw new Error(result.errormessage || 'JKJ rejected the waybill');
  }

  console.log('✅ [JKJ] Waybill submitted successfully:', waybill.waybill_no);
  return result;
};












