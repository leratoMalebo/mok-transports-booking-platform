document.addEventListener("DOMContentLoaded", function () {

  // Init Materialize components
  M.FormSelect.init(document.querySelectorAll("select"));

  const table = document.getElementById("bookingTable");
  const filter = document.getElementById("filterScope");

  /* ================================
     LOAD & NORMALIZE BOOKINGS
  ================================= */
  function getBookings() {
    let bookings = JSON.parse(localStorage.getItem("mok_bookings")) || [];

    // Backward compatibility:
    // pull single booking_* keys if they exist
    Object.keys(localStorage)
      .filter(k => k.startsWith("booking_"))
      .forEach(k => {
        const b = JSON.parse(localStorage.getItem(k));
        if (!bookings.find(x => x.bookingId === b.bookingId)) {
          bookings.push(b);
        }
      });

    localStorage.setItem("mok_bookings", JSON.stringify(bookings));
    return bookings;
  }

  /* ================================
     RENDER TABLE
  ================================= */
  function renderBookings() {
    table.innerHTML = "";

    const bookings = getBookings();
    const selected = filter.value;

    bookings
      .filter(b =>
        selected === "ALL" ? true : b.shipmentScope === selected
      )
      .forEach(b => {

        const scopeColor =
          b.shipmentScope === "LOCAL" ? "blue" : "green";

        const row = document.createElement("tr");
        row.style.cursor = "pointer";

        row.innerHTML = `
          <td>${b.bookingId}</td>

          <td>
            ${b.shipmentCategory || b.shipmentType || "Shipment"}
            <br>
            <small class="grey-text">
              ${b.shipmentReason || b.shipmentSubType || ""}
            </small>
          </td>

          <td>
            <span class="new badge ${scopeColor}" data-badge-caption="">
              ${b.shipmentScope}
            </span>
          </td>

          <td>
            ${Number(b.chargeableWeight || 0).toFixed(2)} kg
          </td>

          <td>
            R ${Number(b.price || b.totalCost || 0).toFixed(2)}
          </td>

          <td>
            <span class="status-pill status-new">
              ${b.status || "New"}
            </span>
          </td>
        `;

        // Future: click to view/edit booking
        row.addEventListener("click", () => {
          localStorage.setItem("active_booking", b.bookingId);
          window.location.href = "bookings.html";
        });

        table.appendChild(row);
      });
  }

  /* ================================
     EVENTS
  ================================= */
  filter.addEventListener("change", renderBookings);

  renderBookings();
});
