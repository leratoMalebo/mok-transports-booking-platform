document.addEventListener("DOMContentLoaded", function () {
  M.FormSelect.init(document.querySelectorAll("select"));
});

/* ================= CONTENT TYPE ================= */
function updateContentType() {
  const type = document.querySelector('input[name="contentType"]:checked')?.value;

  document.getElementById("documentTypeWrapper").style.display =
    type === "Documents" ? "block" : "none";

  document.getElementById("packageTypeWrapper").style.display =
    type === "Package" ? "block" : "none";

  M.FormSelect.init(document.querySelectorAll("select"));
}

/* ================= WEIGHT CALCULATION ================= */
function calculateWeights() {
  const l = Number(length.value || 0);
  const w = Number(width.value || 0);
  const h = Number(height.value || 0);
  const actual = Number(actualWeight.value || 0);

  const volumetric = (l * w * h) / 5000;
  const chargeable = Math.max(actual, volumetric);

  volWeight.innerText = volumetric.toFixed(2);
  chargeWeight.innerText = chargeable.toFixed(2);

  calculateCost();
}

/* ================= COST ================= */
function calculateCost() {

  const chargeable =
    Number(document.getElementById("chargeWeight")?.innerText || 0);

  const rate =
    Number(document.getElementById("rate")?.value || 0);

  const fuel =
    Number(document.getElementById("fuel")?.value || 0);

  const total = (chargeable * rate) + fuel;

  document.getElementById("totalCost").innerText =
    total.toFixed(2);

}


function collectBookingData() {

  return {

    shipmentDirection:
      document.getElementById("shipmentDirection")?.value || "EXPORT",

    fromCountry:
      document.getElementById("fromCountry")?.value || "ZA",

    toCountry:
      document.getElementById("toCountry")?.value || "ZA",

    declaredValue:
      document.getElementById("declaredValue")?.value || 0,

    currency:
      document.getElementById("currency")?.value || "ZAR",

    incoterm:
      document.getElementById("incoterm")?.value || "DAP",

    contentsType:
      document.getElementById("contentsType")?.value || "",

    shipmentDescription:
      document.getElementById("shipmentDescription")?.value || "",

    consignorCompany:
      document.getElementById("consignorCompany")?.value || "",

    consignorContactName:
      document.getElementById("consignorContactName")?.value || "",

    consigneeCompany:
      document.getElementById("consigneeCompany")?.value || "",

    consigneeContactName:
      document.getElementById("consigneeContactName")?.value || "",

    consignorPhone:
      document.getElementById("consignorPhone")?.value || "",

    consigneePhone:
      document.getElementById("consigneePhone")?.value || "",

    consignorEmail:
      document.getElementById("consignorEmail")?.value || "",

    consigneeEmail:
      document.getElementById("consigneeEmail")?.value || "",

    pieces:
      document.getElementById("pieces")?.value || 1,

    actualWeight:
      document.getElementById("actualWeight")?.value || 0,

    volumetricWeight:
      document.getElementById("volWeight")?.innerText || 0,

    chargeableWeight:
      document.getElementById("chargeWeight")?.innerText || 0,

    totalCost:
      document.getElementById("totalCost")?.innerText || 0

  };

}

/* ================= SAVE ================= */
function saveInternationalShipment() {

  const id = "INT-" + Date.now();

  const data = collectBookingData();

  data.id = id;
  data.shipmentCategory = "International";
  data.createdAt = new Date().toLocaleString();

  localStorage.setItem(
    "shipment_" + id,
    JSON.stringify(data)
  );

  console.log("DHL SHIPMENT:", data);

  M.toast({
    html: "International shipment saved"
  });

  return data;

}



/* ================= WAYBILL ================= */
function generateWaybill() {
  saveInternationalShipment();
  window.location.href = "waybill.html";
}

document.addEventListener("DOMContentLoaded", function () {
  const shipmentTypeRadios = document.querySelectorAll('input[name="shipmentType"]');
  const hsCodeInput = document.getElementById("hsCode");

  shipmentTypeRadios.forEach(radio => {
    radio.addEventListener("change", function () {
      if (this.value === "Documents") {
        hsCodeInput.value = "";
        hsCodeInput.disabled = true;
      } else {
        hsCodeInput.disabled = false;
      }
    });
  });
});

scope: "INTERNATIONAL"
shipmentScope: "INTERNATIONAL"






