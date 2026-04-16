function generateWaybillNumber() {
  const d = new Date();
  return `INT-${d.getFullYear()}${(d.getMonth()+1)
    .toString().padStart(2,'0')}${d.getDate()
    .toString().padStart(2,'0')}-${Math.floor(100000 + Math.random() * 900000)}`;
}

function savePDF() {
  const element = document.getElementById("waybillContent");
  html2pdf()
    .set({
      margin: 0.5,
      filename: "International_Waybill.pdf",
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: "in", format: "a4", orientation: "portrait" }
    })
    .from(element)
    .save();
}

window.addEventListener("DOMContentLoaded", () => {

  const data = localStorage.getItem("importWaybill");
  if (!data) return;

  const booking = JSON.parse(data);
  const waybillNo = generateWaybillNumber();

  document.getElementById("waybillNumber").innerText = waybillNo;
  document.getElementById("pickupDate").innerText = booking.pickupDate;
  document.getElementById("pickupTime").innerText = booking.pickupTime;
  document.getElementById("pickupLocation").innerText = booking.pickupLocation;

  document.getElementById("shipTo").innerHTML = booking.shipTo;
  document.getElementById("shipFrom").innerHTML = booking.shipFrom;

  document.getElementById("shipmentDate").innerText = booking.shipmentDate;
  document.getElementById("deliveryOption").innerText = booking.deliveryOption;
  document.getElementById("pieces").innerText = booking.pieces;
  document.getElementById("weight").innerText = booking.weight;
  document.getElementById("description").innerText = booking.description;

  new QRCode(document.getElementById("qrcode"), {
    text: waybillNo,
    width: 128,
    height: 128
  });

  // Tracking record
  localStorage.setItem("tracking_" + waybillNo, JSON.stringify({
    status: "International shipment booked",
    location: "Origin",
    updated: new Date().toLocaleString()
  }));

  localStorage.removeItem("importWaybill");
});

function generateInvoice() {
  const invoiceData = {
    waybillNo: document.getElementById("waybillNumber").innerText,
    shipTo: document.getElementById("shipTo").innerText,
    pieces: document.getElementById("pieces").innerText,
    weight: document.getElementById("weight").innerText,
    service: "LOCAL",
    date: new Date().toISOString().slice(0,10)
  };

  localStorage.setItem("invoiceFromWaybill", JSON.stringify(invoiceData));
  window.location.href = "invoice.html";
}

