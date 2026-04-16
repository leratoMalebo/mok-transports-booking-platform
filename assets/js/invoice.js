const invoiceLines = document.getElementById("invoiceLines");
const vatRate = 0.15;

// ADD LINE
function addLine() {
  const row = document.createElement("tr");

  row.innerHTML = `
    <td><input></td>
    <td><input></td>
    <td><input></td>
    <td><input type="number" value="1"></td>
    <td><input type="number" value="0"></td>
    <td><input type="number" value="0" oninput="calculateTotals()"></td>
  `;

  invoiceLines.appendChild(row);
}

// CALCULATE TOTALS
function calculateTotals() {
  let subtotal = 0;

  document.querySelectorAll("#invoiceLines tr").forEach(row => {
    const charge = row.children[5].querySelector("input").value || 0;
    subtotal += Number(charge);
  });

  const vat = subtotal * vatRate;
  const total = subtotal + vat;

  document.getElementById("subtotal").innerText = subtotal.toFixed(2);
  document.getElementById("vat").innerText = vat.toFixed(2);
  document.getElementById("total").innerText = total.toFixed(2);
}

// SEND INVOICE (PLACEHOLDER)
function sendInvoice() {
  alert("Invoice sent to customer (email integration pending)");
}

// PDF EXPORT
function downloadPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  doc.text("Mok Transports Tax Invoice", 20, 20);
  doc.text(`Invoice No: ${document.getElementById("invoiceNumber").value}`, 20, 30);
  doc.text(`Total: R ${document.getElementById("total").innerText}`, 20, 40);

  doc.save("Mok_Invoice.pdf");
}

window.addEventListener("DOMContentLoaded", () => {
  const data = localStorage.getItem("invoiceFromWaybill");
  if (!data) return;

  const inv = JSON.parse(data);

  document.getElementById("billTo").value = inv.shipTo;
  document.getElementById("invoiceDate").value = inv.date;

  addLine(inv.waybillNo, inv.pieces, inv.weight);

  localStorage.removeItem("invoiceFromWaybill");
});
