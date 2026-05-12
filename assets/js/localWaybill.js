const API_BASE = "https://bookings.moktransports.com";

function getParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

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
  const waybillParam = getParam("waybill");

  if (waybillParam) {
    loadWaybillFromDatabase(waybillParam);
    return;
  }

  const stored = localStorage.getItem("localWaybill");

  if (!stored || stored === "null") {
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
  if (zoneEl) {
    zoneEl.innerText = data.zone_label || data.zoneLabel || "—";
  }
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
  localStorage.setItem("lastWaybillData", JSON.stringify(data));
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

  const stored = JSON.parse(localStorage.getItem("lastWaybillData") || "{}");

  const invoiceData = {
    waybillNo: document.getElementById("waybillNumber").innerText,

    shipTo: document.getElementById("shipTo").innerText,
    service: document.getElementById("deliveryType").innerText,

    fromTown: document.getElementById("shipFrom").innerText,
    toTown: document.getElementById("shipTo").innerText,

    date: document.getElementById("pickupDate").innerText || new Date().toISOString().slice(0, 10),

    // ✅ Price now comes from stored data (not UI)
    price: parseFloat(stored.price || 0),

    weight: document.getElementById("weight").innerText,
    volumetricWeight: document.getElementById("volumetricWeight").innerText,

    pieces: document.getElementById("pieces").innerText,
    description: document.getElementById("description").innerText
  };

  localStorage.setItem("invoiceFromWaybill", JSON.stringify(invoiceData));
  window.location.href = "invoice.html";
}

// Navigate back to the correct dashboard based on session role
function goToDashboard() {
  const session = JSON.parse(localStorage.getItem('mokSession') || 'null');
  if (session && (session.role === 'staff' || session.role === 'admin' || session.role === 'office')) {
    window.location.href = 'dashboard.html';
  } else {
    window.location.href = 'clientDashboard.html';
  }
}

// Email the waybill — opens default mail client
function emailWaybill() {
  const wb = document.getElementById('waybillNumber').innerText || 'Waybill';
  const to = document.getElementById('shipTo').innerText || '';
  // Try to extract email from shipTo block
  const match = to.match(/[\w.-]+@[\w.-]+\.\w+/);
  const email = match ? match[0] : '';
  const sub = encodeURIComponent(`Waybill ${wb} – Mok Transports Services (Pty) Ltd`);
  const body = encodeURIComponent(
    `Dear Client,\n\nPlease find your waybill ${wb} attached.\n\nFor queries please contact us:\nTel: 011 839 8496\nEmail: info@moktransports.com\n\nThank you for using Mok Transports Services.`
  );
  window.location.href = `mailto:${email}?subject=${sub}&body=${body}`;
}

// helper
function extractNumber(text) {
  if (!text) return 0;
  return parseFloat(text.replace(/[^\d.]/g, "")) || 0;
}

async function loadWaybillFromDatabase(waybillNo) {
  try {
    const res = await fetch(`${API_BASE}/api/waybills/${waybillNo}`);
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Waybill not found");
    }

    document.getElementById("waybillNumber").innerText = data.waybill_no || "—";

    document.getElementById("shipFrom").innerHTML = `
      <strong>${data.consignor_name || "—"}</strong><br>
      ${data.consignor_address || "—"}<br>
      ${data.consignor_contact || ""}
    `;

    document.getElementById("shipTo").innerHTML = `
      <strong>${data.consignee_name || "—"}</strong><br>
      ${data.consignee_address || "—"}<br>
      ${data.consignee_contact || ""}
    `;

    document.getElementById("pickupDate").innerText =
      data.booking_date ? data.booking_date.split("T")[0] : "—";

    document.getElementById("deliveryType").innerText = data.service || "—";
    document.getElementById("pieces").innerText = data.pieces || "1";
    document.getElementById("weight").innerText = data.weight || "—";
    document.getElementById("volumetricWeight").innerText = data.volumetric_weight || "—";
    document.getElementById("description").innerText = data.description || "General Cargo";

    const zoneEl = document.getElementById("waybillZone");
    if (zoneEl) {
      zoneEl.innerText = data.zone_label || data.zoneLabel || "—";
    }

    renderBarcode(data.waybill_no);

    if (getParam("download") === "true") {
      setTimeout(() => savePDF(), 800);
    }

  } catch (err) {
    console.error("Load saved waybill error:", err);
    alert("Could not load saved waybill from database.");
  }
}





