document.addEventListener("DOMContentLoaded", function () {

  M.FormSelect.init(document.querySelectorAll("select"));

  const shipmentRadios = document.querySelectorAll('input[name="shipmentType"]');
  const hsCodeInput = document.getElementById("hsCode");

  const docWrapper = document.getElementById("documentTypeWrapper");
  const pkgWrapper = document.getElementById("packageTypeWrapper");

  const length = document.getElementById("length");
  const width = document.getElementById("width");
  const height = document.getElementById("height");
  const actualWeight = document.getElementById("actualWeight");

  const volWeight = document.getElementById("volWeight");
  const chargeWeight = document.getElementById("chargeWeight");

  shipmentRadios.forEach(radio => {
    radio.addEventListener("change", function () {

      if (this.value === "Documents") {
        docWrapper.style.display = "block";
        pkgWrapper.style.display = "none";
        hsCodeInput.value = "";
        hsCodeInput.disabled = true;
      }

      if (this.value === "Packages") {
        pkgWrapper.style.display = "block";
        docWrapper.style.display = "none";
        hsCodeInput.disabled = false;
      }
    });
  });

  function calculateWeights() {
    const L = parseFloat(length.value) || 0;
    const W = parseFloat(width.value) || 0;
    const H = parseFloat(height.value) || 0;
    const actual = parseFloat(actualWeight.value) || 0;

    const volumetric = (L * W * H) / 5000;

    volWeight.textContent = volumetric.toFixed(2);
    chargeWeight.textContent = Math.max(volumetric, actual).toFixed(2);
  }

  [length, width, height, actualWeight].forEach(el => {
    el.addEventListener("input", calculateWeights);
  });

});

function saveClientBooking() {

  const shipmentType = document.querySelector(
    'input[name="shipmentType"]:checked'
  )?.value;

  if (!shipmentType) {
    M.toast({ html: "Please select shipment type" });
    return;
  }

  const booking = {
    bookingId: "BK-" + Date.now(),
    source: "CLIENT",
    shipmentScope: "LOCAL",
    shipmentType,
    shipmentSubType:
      shipmentType === "Documents"
        ? document.getElementById("documentType").value
        : document.getElementById("packageType").value,

    chargeableWeight: document.getElementById("chargeWeight").textContent,
    status: "Pending",
    createdAt: new Date().toLocaleString()
  };

  const bookings =
    JSON.parse(localStorage.getItem("mok_bookings")) || [];

  bookings.push(booking);
  localStorage.setItem("mok_bookings", JSON.stringify(bookings));

  M.toast({ html: "Booking submitted successfully" });

  // Optional redirect
  setTimeout(() => {
    window.location.href = "thankyou.html";
  }, 1200);
}
