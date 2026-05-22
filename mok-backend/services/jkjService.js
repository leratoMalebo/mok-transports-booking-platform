// =============================================================
// mok-backend/services/jkjService.js
// JKJ Express — PPerfect API Integration
//
// ENV VARS REQUIRED (set in Vercel dashboard):
//   JKJ_BASE_URL   = https://jkjweb45760.pperfect.com/ppwebservice/Json/
//   JKJ_EMAIL      = mks@integ
//   JKJ_PASSWORD   = R9vwnsC8nTAA4yEP
//   JKJ_ACCOUNT_NO = MOK007
//   JKJ_PPCUST_ID  = 2601.3364.2809
// =============================================================

const axios  = require('axios');
const crypto = require('crypto');

// ── ENV ────────────────────────────────────────────────────────
const JKJ_BASE_URL   = process.env.JKJ_BASE_URL   || 'https://jkjweb45760.pperfect.com/ppwebservice/Json/';
const JKJ_EMAIL      = process.env.JKJ_EMAIL       || 'mks@integ';
const JKJ_PASSWORD   = process.env.JKJ_PASSWORD    || 'R9vwnsC8nTAA4yEP';
const JKJ_ACCOUNT_NO = process.env.JKJ_ACCOUNT_NO  || 'MOK007';
const JKJ_PPCUST_ID  = process.env.JKJ_PPCUST_ID   || '2601.3364.2809';

// ── TOKEN CACHE — reuse token for up to 20 minutes ───────────
let _cachedToken     = null;
let _tokenExpiry     = 0;
const TOKEN_TTL_MS   = 20 * 60 * 1000; // 20 minutes

// ── SERVICE CODE MAP ──────────────────────────────────────────
function mapServiceToJKJ(service) {
  const s = String(service || '').toUpperCase().trim();
  const MAP = {
    'SAMEDAY':              'SDX',
    'SAME_DAY':             'SDX',
    'SAME DAY':             'SDX',
    'SAMEDAY EXPRESS AIR':  'SDX',
    'ONX':                  'ONX',
    'OVERNIGHT EXPRESS':    'ONX',
    'OVERNIGHT EXPRESS (ONX)': 'ONX',
    'NDD':                  'NDX',
    'NEXTDAY EXPRESS':      'NDX',
    'NEXTDAY':              'NDX',
    'ECO':                  'ECO',
    'ECONOMY SERVICE (ECO)':'ECO',
    'ECONOMY SERVICE':      'ECO',
    'ECONOMY':              'ECO',
  };
  return MAP[s] || 'ECO'; // default to ECO if unrecognised
}

// ── DATE HELPER ───────────────────────────────────────────────
function todayDDMMYYYY() {
  const d = new Date();
  const dd   = String(d.getDate()).padStart(2, '0');
  const mm   = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

// ── CORE API CALL ─────────────────────────────────────────────
// PPerfect JSON web service uses GET with query params:
//   ?params=<JSON>&method=<method>&class=<class>&token_id=<token>
async function makeCall(className, method, params, token = '') {
  const url = JKJ_BASE_URL;

  const queryParams = {
    params:   JSON.stringify(params),
    method:   method,
    class:    className,
    token_id: token
  };

  console.log(`[JKJ] Calling ${className}.${method}`);

  const response = await axios.get(url, {
    params:  queryParams,
    timeout: 30000, // 30s timeout
    headers: { 'Content-Type': 'application/json' }
  });

  const data = response.data;

  // PPerfect sometimes returns the login HTML page when token is invalid
  if (typeof data === 'string' && data.trim().startsWith('<')) {
    throw new Error(
      'JKJ returned HTML instead of JSON — token is invalid or expired. ' +
      'Re-authenticating on next request.'
    );
  }

  return data;
}

// ── AUTHENTICATION — getSalt → getSecureToken ─────────────────
async function getSecureToken() {
  // Return cached token if still valid
  if (_cachedToken && Date.now() < _tokenExpiry) {
    console.log('[JKJ] Using cached token');
    return _cachedToken;
  }

  console.log('[JKJ] Fetching new token...');

  // Step 1: Get salt
  const saltResponse = await makeCall('Auth', 'getSalt', { email: JKJ_EMAIL });
  console.log('[JKJ] Salt response:', JSON.stringify(saltResponse));

  if (Number(saltResponse.errorcode) !== 0) {
    throw new Error(
      `JKJ getSalt failed: ${saltResponse.errormessage || 'Unknown error'}`
    );
  }

  const salt = saltResponse.results[0].salt;

  // Step 2: Hash password correctly for PPerfect API
  // PPerfect standard: MD5( MD5(plaintext_password) + salt )
  // Step 2a — hash the plain password first
  const md5Password = crypto
    .createHash('md5')
    .update(JKJ_PASSWORD)
    .digest('hex');

  // Step 2b — hash that result concatenated with the salt
  const hashedPassword = crypto
    .createHash('md5')
    .update(md5Password + salt)
    .digest('hex');

  // Step 3: Get token
  const tokenResponse = await makeCall('Auth', 'getSecureToken', {
    email:    JKJ_EMAIL,
    password: hashedPassword
  });
  console.log('[JKJ] Token response:', JSON.stringify(tokenResponse));

  if (Number(tokenResponse.errorcode) !== 0) {
    throw new Error(
      `JKJ getSecureToken failed: ${tokenResponse.errormessage || 'Unknown error'}`
    );
  }

  const token = tokenResponse.results[0].token_id;

  // Cache the token
  _cachedToken  = token;
  _tokenExpiry  = Date.now() + TOKEN_TTL_MS;

  console.log('[JKJ] New token obtained and cached');
  return token;
}

// ── INVALIDATE CACHE (call when API returns HTML/token error) ──
function invalidateToken() {
  _cachedToken = null;
  _tokenExpiry = 0;
}

// ── SUBMIT WAYBILL ────────────────────────────────────────────
exports.submitWaybillToJKJ = async (waybill) => {
  let token;

  try {
    // ALWAYS get a fresh/cached token via the auth flow
    // Never rely on the static JKJ_AUTH_TOKEN env var — it expires
    token = await getSecureToken();
  } catch (authErr) {
    console.error('[JKJ] Auth failed:', authErr.message);
    throw new Error(`JKJ authentication failed: ${authErr.message}`);
  }

  const actualWeight = Math.max(Number(waybill.weight || 1), 0.5);
  const pieces       = Number(waybill.pieces || 1);

  const params = {
    details: {
      waybill:        waybill.waybill_no,
      accnum:         JKJ_ACCOUNT_NO,
      service:        mapServiceToJKJ(waybill.service),
      waydate:        todayDDMMYYYY(),

      // Consignor (sender)
      origpers:       (waybill.consignor_name    || 'Mok Transports').substring(0, 40),
      origperadd1:    (waybill.consignor_address || '12 Jupiter Road, Crown Mines').substring(0, 40),
      origtown:       (waybill.consignor_town    || 'Johannesburg').substring(0, 30),
      origpercontact: (waybill.consignor_contact || '0118396496').replace(/\D/g, '').substring(0, 15),

      // Consignee (receiver)
      destpers:       (waybill.consignee_name    || 'Receiver').substring(0, 40),
      destperadd1:    (waybill.consignee_address || 'Receiver Address').substring(0, 40),
      desttown:       (waybill.consignee_town    || waybill.consignee_address || 'Johannesburg').substring(0, 30),
      destpercontact: (waybill.consignee_contact || '0000000000').replace(/\D/g, '').substring(0, 15),

      reference:      waybill.waybill_no,

      // PPCUST ID — required for Mok Transports account
      ppcust:         JKJ_PPCUST_ID
    },

    contents: [
      {
        item:        1,
        pieces:      pieces,
        description: (waybill.description || 'General Cargo').substring(0, 40),
        dim1:        Number(waybill.length  || 1),
        dim2:        Number(waybill.width   || 1),
        dim3:        Number(waybill.height  || 1),
        actmass:     actualWeight
      }
    ],

    tracks: [
      {
        item:     1,
        parcelno: 1,
        trackno:  `${waybill.waybill_no}0001`
      }
    ]
  };

  try {
    console.log('[JKJ] Submitting waybill:', waybill.waybill_no);
    console.log('[JKJ] Params:', JSON.stringify(params, null, 2));

    const result = await makeCall('Waybill', 'submitWaybill', params, token);
    console.log('[JKJ] Submit result:', JSON.stringify(result, null, 2));

    // If we got HTML back — token expired mid-session, invalidate and throw
    if (typeof result === 'string' && result.trim().startsWith('<')) {
      invalidateToken();
      throw new Error('JKJ session expired during submission. Please try again.');
    }

    if (Number(result.errorcode) !== 0) {
      console.error('[JKJ] Submission rejected:', JSON.stringify(result, null, 2));
      throw new Error(result.errormessage || 'JKJ rejected the waybill');
    }

    console.log('✅ [JKJ] Waybill submitted successfully:', waybill.waybill_no);
    return result;

  } catch (err) {
    // If token-related error, clear the cache so next request re-authenticates
    if (err.message.includes('HTML') || err.message.includes('token') || err.message.includes('session')) {
      invalidateToken();
    }
    console.error('❌ [JKJ] Submit error:', err.message);
    throw err;
  }
};

// ── TRACK WAYBILL ─────────────────────────────────────────────
exports.trackWaybillFromJKJ = async (waybillNo) => {
  try {
    const token = await getSecureToken();

    const result = await makeCall('Waybill', 'getTracking', {
      waybill: waybillNo,
      accnum:  JKJ_ACCOUNT_NO
    }, token);

    console.log('[JKJ] Track result:', JSON.stringify(result));

    if (typeof result === 'string' && result.trim().startsWith('<')) {
      invalidateToken();
      throw new Error('JKJ session expired during tracking.');
    }

    if (Number(result.errorcode) !== 0) {
      throw new Error(result.errormessage || 'JKJ tracking failed');
    }

    return result;
  } catch (err) {
    if (err.message.includes('HTML') || err.message.includes('token')) invalidateToken();
    console.error('❌ [JKJ] Track error:', err.message);
    throw err;
  }
};


