// =========================================================
// tracking.js
// Frontend Shipment Tracking Logic
// =========================================================

async function trackShipment() {

  const trackingNo = document.getElementById("trackingInput").value;

  if (!trackingNo) {
    alert("Please enter tracking number");
    return;
  }

  try {

    const response = await fetch(
      `/api/tracking/${trackingNo}`
    );

    const data = await response.json();

    if (!data.success) {
      alert(data.message);
      return;
    }

    const shipment = data.shipment;

    document.getElementById("trackingResult").style.display = "block";

    document.getElementById("waybillNo").innerText =
      shipment.waybill_no;

    document.getElementById("jkjRef").innerText =
      shipment.jkj_reference || "N/A";

    document.getElementById("statusBox").innerText =
      shipment.current_status;

    const timelineDiv = document.getElementById("timeline");

    timelineDiv.innerHTML = "";

    shipment.events.forEach(event => {

      timelineDiv.innerHTML += `
        <div class="timeline-item">
          <h6>${event.status}</h6>
          <p>${event.location}</p>
          <small>${event.date}</small>
        </div>
      `;

    });

  } catch (error) {

    console.error(error);

    alert("Tracking failed");

  }

}


