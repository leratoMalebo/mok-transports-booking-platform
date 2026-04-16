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
  const chargeable = Number(chargeWeight.innerText || 0);
  const rate = Number(rate.value || 0);
  const fuel = Number(fuel.value || 0);

  const total = (chargeable * rate) + fuel;
  totalCost.innerText = total.toFixed(2);
}

/* ================= SAVE ================= */
function saveInternationalShipment() {
  const id = "INT-" + Date.now();

  const data = {
    id,
    shipmentCategory: "International",
    shipmentType: document.querySelector('input[name="shipmentType"]:checked')?.value,
    contentType: document.querySelector('input[name="contentType"]:checked')?.value,
    documentType: document.getElementById("documentType")?.value || null,
    packageType: document.getElementById("packageType")?.value || null,
    transportMode: transportMode.value,

    pieces: pieces.value,
    actualWeight: actualWeight.value,
    volumetricWeight: volWeight.innerText,
    chargeableWeight: chargeWeight.innerText,
    totalCost: totalCost.innerText,

    createdAt: new Date().toLocaleString()
  };

  localStorage.setItem("shipment_" + id, JSON.stringify(data));
  M.toast({ html: "International shipment saved" });
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
