const { jsPDF } = window.jspdf;
const bookingsData = JSON.parse(localStorage.getItem("bookings")) || [];

// ================== EXPORT PDF ==================
function exportPDF() {
  const doc = new jsPDF();

  doc.setFontSize(16);
  doc.text("Mok Transports - Business Report", 20, 20);

  doc.setFontSize(10);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 20, 30);

  let y = 45;

  const totalBookings = bookingsData.length;
  const totalRevenue = bookingsData.reduce(
    (sum, b) => sum + Number(b.price), 0
  );

  doc.text(`Total Bookings: ${totalBookings}`, 20, y);
  y += 8;
  doc.text(`Total Revenue: R ${totalRevenue.toFixed(2)}`, 20, y);
  y += 15;

  doc.text("Bookings Summary:", 20, y);
  y += 8;

  bookingsData.forEach(b => {
    doc.text(
      `${b.id} | ${b.fromCompany} → ${b.toCompany} | R ${b.price}`,
      20,
      y
    );
    y += 6;

    if (y > 270) {
      doc.addPage();
      y = 20;
    }
  });

  doc.save("Mok_Transports_Report.pdf");
}

// ================== EXPORT EXCEL ==================
function exportExcel() {
  const worksheet = XLSX.utils.json_to_sheet(bookingsData);
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(workbook, worksheet, "Bookings");

  XLSX.writeFile(workbook, "Mok_Transports_Report.xlsx");
}
