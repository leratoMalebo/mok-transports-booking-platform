const API_BASE = "https://bookings.moktransports.com";

function getParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function savePDF() {
  const element = document.getElementById("waybillContent");
  html2pdf()
    .set({
      margin: [8, 8, 8, 8],
      filename: `Waybill_${document.getElementById("waybillNumber").innerText}.pdf`,
      html2canvas: { scale: 2, useCORS: true, scrollY: 0, scrollX: 0 },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      // 'avoid-all' treats every element as unsplittable, which is what
      // was causing the blank-page-then-everything-crammed output once
      // the waybill grew taller than one page. 'css' respects the
      // page-break-inside:avoid rules on .waybill-section/.detail-grid
      // instead, so the document paginates naturally and only avoids
      // breaking a section awkwardly in half.
      pagebreak: { mode: ["css"] }
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
    document.getElementById("waybillNumber").innerText = "WAYBILL NOT GENERATED";

    renderBarcode(document.getElementById("waybillNumber").innerText);
    return;
  }

  const data = JSON.parse(stored);

  // Use waybillNo from booking if present, else generate new
  const wb = data.waybillNo;

  if (!wb) {
    alert("No waybill number returned from server.");
    return;
  }

  document.getElementById("waybillNumber").innerText = wb;
  document.getElementById("shipFrom").innerHTML = data.shipFrom || "—";
  document.getElementById("shipTo").innerHTML = data.shipTo || "—";
  document.getElementById("pickupDate").innerText = data.pickupDate || "—";
  document.getElementById("deliveryType").innerText = data.deliveryType || "—";
  document.getElementById("pieces").innerText = data.pieces || "—";
  document.getElementById("weight").innerText = data.weight || "—";
  document.getElementById("volumetricWeight").innerText = data.volumetricWeight || "—";
  document.getElementById("description").innerText = data.description || "—";
  renderPackages(data.items);

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

function renderPackages(items) {
  const tbody = document.getElementById("packagesTableBody");
  if (!tbody) return;

  // items may arrive as a JSON string (from a raw DB column) or already
  // as a parsed array (from the localStorage handoff) — handle both.
  let list = items;
  if (typeof list === "string") {
    try { list = JSON.parse(list); } catch { list = []; }
  }

  if (!Array.isArray(list) || !list.length) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:#90a4ae">—</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(i => {
    const qty = i.qty || 1;
    const desc = i.desc || "—";
    const weight = i.weight || "0";
    const dims = (i.length && i.width && i.height)
      ? `${i.length} × ${i.width} × ${i.height}`
      : "—";
    return `<tr><td>${qty}</td><td>${desc}</td><td>${weight}</td><td>${dims}</td></tr>`;
  }).join("");
}

function renderBarcode(wb) {
  const svg = document.getElementById("waybillBarcode");
  if (!svg) return;
  JsBarcode(svg, wb, {
    format: "CODE128",
    width: 2,
    height: 48,
    displayValue: true,
    fontSize: 12,
    margin: 4,
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

// ── Helpers for rebuilding a saved waybill (database view / download) ──
const SERVICE_LABELS = {
  SAMEDAY: "SameDay Express Air",
  ONX: "Overnight Express (ONX)",
  NDD: "NextDay Express",
  ECO: "Economy Service (ECO)"
};

function esc(v) {
  return String(v ?? "").replace(/[&<>"']/g, ch => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]
  ));
}

function parseItems(items) {
  let list = items;
  if (typeof list === "string") {
    try { list = JSON.parse(list); } catch { list = []; }
  }
  return Array.isArray(list) ? list : [];
}

function formatKg(v) {
  if (v === null || v === undefined || v === "") return "—";
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(2) : "—";
}

// Mirrors buildAddr() in booking.js so a saved waybill reads exactly like
// the one produced at booking time. Blank lines are skipped, and a value
// is never printed twice (e.g. when the phone field fell back to the email).
function buildAddressBlock(company, street, street2, suburb, town, province,
                           postcode, email, contactName, contact) {
  const seen = new Set();
  const lines = [`<strong>${esc(company) || "—"}</strong>`];
  [street, street2, suburb, town, province, postcode, email, contactName, contact]
    .forEach(v => {
      const s = (v === null || v === undefined) ? "" : String(v).trim();
      if (!s || seen.has(s.toLowerCase())) return;
      seen.add(s.toLowerCase());
      lines.push(esc(s));
    });
  return lines.join("<br>");
}

async function loadWaybillFromDatabase(waybillNo) {
  try {
    const res = await fetch(`${API_BASE}/api/waybills/${waybillNo}`);
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Waybill not found");
    }

    document.getElementById("waybillNumber").innerText = data.waybill_no || "—";

    // Same layout as the PDF generated at booking time: company, street,
    // suburb, town, province, postcode, email, contact person, phone.
    document.getElementById("shipFrom").innerHTML = buildAddressBlock(
      data.consignor_name, data.consignor_address, data.consignor_address2,
      data.consignor_suburb, data.consignor_town, data.consignor_province,
      data.consignor_postcode, data.consignor_email,
      data.consignor_contact_name, data.consignor_contact
    );

    document.getElementById("shipTo").innerHTML = buildAddressBlock(
      data.consignee_name, data.consignee_address, data.consignee_address2,
      data.consignee_suburb, data.consignee_town, data.consignee_province,
      data.consignee_postcode, data.consignee_email,
      data.consignee_contact_name, data.consignee_contact
    );

    document.getElementById("pickupDate").innerText =
      data.booking_date ? data.booking_date.split("T")[0] : "—";

    document.getElementById("deliveryType").innerText =
      SERVICE_LABELS[data.service] || data.service || "—";

    // Pieces and description aren't stored as their own columns, but the
    // package rows are (waybills.items), so derive both from those.
    const itemList = parseItems(data.items);
    const totalPieces = itemList.reduce((s, i) => s + (Number(i.qty) || 0), 0);
    const itemDescs = [...new Set(
      itemList.map(i => String(i.desc || "").trim()).filter(Boolean)
    )].join(", ");

    document.getElementById("pieces").innerText = data.pieces || totalPieces || "1";
    document.getElementById("weight").innerText = formatKg(data.weight);
    document.getElementById("volumetricWeight").innerText = formatKg(data.volumetric_weight);
    document.getElementById("description").innerText = data.description || itemDescs || "—";
    renderPackages(data.items);

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





