const axios = require("axios");
const crypto = require("crypto");

const JKJ_BASE_URL = process.env.JKJ_BASE_URL;
const JKJ_EMAIL = process.env.JKJ_EMAIL;
const JKJ_PASSWORD = process.env.JKJ_PASSWORD;
const JKJ_ACCOUNT_NO = process.env.JKJ_ACCOUNT_NO || "MOK007";
const JKJ_PPCUST_ID = process.env.JKJ_PPCUST_ID;

function mapServiceToJKJ(service) {
  const s = String(service || "").toUpperCase();

  const map = {
    SAMEDAY: "SDX",
    SAME_DAY: "SDX",
    "SAME DAY": "SDX",
    ONX: "ONX",
    "NextDay Express": "NDX",
    ECO: "ECO"
  };

  return map[s] || "ECO";
}

function makeUrl(className, method, params, token = "") {
  return (
    `${JKJ_BASE_URL}` +
    `?params=${encodeURIComponent(JSON.stringify(params))}` +
    `&method=${encodeURIComponent(method)}` +
    `&class=${encodeURIComponent(className)}` +
    `&token_id=${encodeURIComponent(token)}`
  );
}

async function makeCall(className, method, params, token = "") {
  const url = makeUrl(className, method, params, token);

  const headers = {
    "Content-Type": "application/json"
  };

  if (process.env.JKJ_AUTH_TOKEN) {
    headers.Authorization = `Bearer ${process.env.JKJ_AUTH_TOKEN}`;
  }

  const response = await axios.get(url, { headers });
  return response.data;
}

async function getSecureToken() {
  const saltResponse = await makeCall("Auth", "getSalt", {
    email: JKJ_EMAIL
  });

  console.log("JKJ SALT RESPONSE:", saltResponse);

  if (Number(saltResponse.errorcode) !== 0) {
    throw new Error(saltResponse.errormessage || "Failed to get JKJ salt");
  }

  const salt = saltResponse.results[0].salt;

  const encryptedPassword = crypto
    .createHash("md5")
    .update(JKJ_PASSWORD + salt)
    .digest("hex");

  const tokenResponse = await makeCall("Auth", "getSecureToken", {
    email: JKJ_EMAIL,
    password: encryptedPassword
  });

  console.log("JKJ TOKEN RESPONSE:", tokenResponse);

  if (Number(tokenResponse.errorcode) !== 0) {
    throw new Error(tokenResponse.errormessage || "Failed to get JKJ token");
  }

  return tokenResponse.results[0].token_id;
}

function todayDDMMYYYY() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}

exports.submitWaybillToJKJ = async (waybill) => {
  try {
    //const token = await getSecureToken();
    const token = process.env.JKJ_AUTH_TOKEN;

    const actualWeight = Number(waybill.weight || 1);

    const params = {
      details: {
        waybill: waybill.waybill_no,
        accnum: JKJ_ACCOUNT_NO,
        service: mapServiceToJKJ(waybill.service),
        waydate: todayDDMMYYYY(),

        origpers: waybill.consignor_name || "Mok Transports",
        origperadd1: waybill.consignor_address || "12 Jupiter Road",
        origtown: "Johannesburg",
        origpercontact: waybill.consignor_contact || "0118396496",

        destpers: waybill.consignee_name || "Receiver",
        destperadd1: waybill.consignee_address || "Receiver Address",
        desttown: "Johannesburg",
        destpercontact: waybill.consignee_contact || "0000000000",

        reference: waybill.waybill_no
      },

      contents: [
        {
          item: 1,
          pieces: 1,
          description: "General Cargo",
          dim1: 1,
          dim2: 1,
          dim3: 1,
          actmass: actualWeight
        }
      ],

      tracks: [
        {
          item: 1,
          parcelno: 1,
          trackno: `${waybill.waybill_no}0001`
        }
      ]
    };

    const result = await makeCall("Waybill", "submitWaybill", params, token);

    console.log("✅ JKJ SUBMIT WAYBILL RESPONSE:", result);

    if (Number(result.errorcode) !== 0) {
      throw new Error(result.errormessage || "JKJ rejected the waybill");
    }

    return result;

  } catch (err) {
    console.error("❌ JKJ API ERROR:", err.message);
    throw err;
  }
};







