function generateLocalWaybillNumber() {
  const current = parseInt(localStorage.getItem("mokWaybillCounter") || "0", 10);
  const next = current + 1;
  localStorage.setItem("mokWaybillCounter", String(next));
  return `MOK${String(next).padStart(6, "0")}`;
}

function savePDF() {
  const element = document.getElementById("waybillContent");
  html2pdf()
    .set({
      margin: [10, 10, 10, 10],
      filename: `Waybill_${document.getElementById("waybillNumber").innerText}.pdf`,
      html2canvas: { scale: 2, useCORS: true, scrollY: 0 },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" }
    })
    .from(element)
    .save();
}

window.addEventListener("DOMContentLoaded", () => {
  const stored = localStorage.getItem("localWaybill");
  if (!stored) {
    document.getElementById("waybillNumber").innerText = generateLocalWaybillNumber();
    renderBarcode(document.getElementById("waybillNumber").innerText);
    return;
  }

  const data = JSON.parse(stored);

  // Use waybillNo from booking if present, else generate new
  const wb = data.waybillNo || generateLocalWaybillNumber();

  document.getElementById("waybillNumber").innerText = wb;
  document.getElementById("shipFrom").innerHTML = data.shipFrom || "—";
  document.getElementById("shipTo").innerHTML = data.shipTo || "—";
  document.getElementById("pickupDate").innerText = data.pickupDate || "—";
  document.getElementById("deliveryType").innerText = data.deliveryType || "—";
  document.getElementById("pieces").innerText = data.pieces || "—";
  document.getElementById("weight").innerText = data.weight || "—";
  document.getElementById("volumetricWeight").innerText = data.volumetricWeight || "—";
  document.getElementById("description").innerText = data.description || "—";

  const priceEl = document.getElementById("waybillPrice");
  if (priceEl) priceEl.innerText = data.price ? `R ${data.price}` : "—";

  const zoneEl = document.getElementById("waybillZone");
  if (zoneEl) zoneEl.innerText = data.zoneLabel || "—";

  // Barcode
  renderBarcode(wb);

  // Tracking record
  localStorage.setItem("tracking_" + wb, JSON.stringify({
    waybillNo: wb,
    status: "Booked",
    location: "Local Depot",
    updated: new Date().toLocaleString(),

    shipFrom: data.shipFrom,
    shipTo: data.shipTo,
    service: data.deliveryType,
    weight: data.weight,
    volumetricWeight: data.volumetricWeight,
    price: data.price
  }));

  localStorage.removeItem("localWaybill");
});

function renderBarcode(wb) {
  const svg = document.getElementById("waybillBarcode");
  if (!svg) return;
  JsBarcode(svg, wb, {
    format: "CODE128",
    width: 2,
    height: 60,
    displayValue: true,
    fontSize: 13,
    margin: 6,
    background: "#ffffff",
    lineColor: "#000000"
  });
}

function generateInvoice() {
  const invoiceData = {
    waybillNo: document.getElementById("waybillNumber").innerText,

    // FULL structured data
    shipTo: document.getElementById("shipTo").innerText,
    service: document.getElementById("deliveryType").innerText,

    // Locations (important for invoice table)
    fromTown: document.getElementById("shipFrom").innerText,
    toTown: document.getElementById("shipTo").innerText,

    // Dates
    date: document.getElementById("pickupDate").innerText || new Date().toISOString().slice(0,10),

    // Pricing
    price: extractNumber(document.getElementById("waybillPrice").innerText),

    // Weights (🔥 THIS IS WHAT YOU WANTED)
    weight: document.getElementById("weight").innerText,
    volumetricWeight: document.getElementById("volumetricWeight").innerText,

    // Extra
    pieces: document.getElementById("pieces").innerText,
    description: document.getElementById("description").innerText
  };

  localStorage.setItem("invoiceFromWaybill", JSON.stringify(invoiceData));
  window.location.href = "invoice.html";
}

// helper
function extractNumber(text) {
  if (!text) return 0;
  return parseFloat(text.replace(/[^\d.]/g, "")) || 0;
}



