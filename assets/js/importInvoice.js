let lines = [];

function addLine() {
  const tbody = document.getElementById("invoiceLines");

  const row = document.createElement("tr");

  row.innerHTML = `
    <td><input></td>
    <td><input></td>
    <td><input></td>
    <td><input type="number" value="1"></td>
    <td><input type="number" value="0"></td>
    <td>
      <input type="number" value="0" onchange="calculateTotals()">
    </td>
  `;

  tbody.appendChild(row);
}

function calculateTotals() {
  let subtotal = 0;

  document.querySelectorAll("#invoiceLines tr").forEach(row => {
    const charge = row.querySelector("td:last-child input").value;
    subtotal += parseFloat(charge || 0);
  });

  document.getElementById("subtotal").innerText = subtotal.toFixed(2);
  document.getElementById("total").innerText = subtotal.toFixed(2);
}

function sendInvoice() {
  M.toast({ html: "Invoice sent to customer (demo)" });
}

function downloadPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  doc.text("Mok Transports - International Invoice", 10, 10);
  doc.text(`Invoice No: ${document.getElementById("invoiceNumber").value}`, 10, 20);
  doc.text(`Total: R ${document.getElementById("total").innerText}`, 10, 30);

  doc.save("International_Invoice.pdf");
}

document.addEventListener('DOMContentLoaded', function () {
  M.FormSelect.init(document.querySelectorAll('select'));
});

let currencySymbols = {
  ZAR: "R",
  USD: "$",
  EUR: "€",
  BWP: "P"
};

function updateCurrency() {
  const currency = document.getElementById("currency").value;
  const symbol = currencySymbols[currency];

  document.getElementById("currencySymbol").innerText = symbol;
  document.getElementById("currencySymbolTotal").innerText = symbol;
}

