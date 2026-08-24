// =========================================================
// tracking.js
// Mok Transports Shipment Tracking
// =========================================================

const API_BASE = window.location.origin;

async function trackShipment() {
  const input = document.getElementById("trackingInput");
  const trackingNo = input.value.trim();

  if (!trackingNo) {
    alert("Please enter a waybill number or JKJ reference.");
    return;
  }

  // Use track.html's own loader/error UI helpers when available, so the
  // spinner and styled "not found" card actually activate — falls back
  // gracefully to the older direct-DOM approach if they're ever missing.
  if (typeof window.showLoader === "function") {
    window.showLoader();
  } else {
    const resultBox = document.getElementById("trackingResult");
    if (resultBox) resultBox.style.display = "none";
  }

  const timelineDiv = document.getElementById("timeline");
  if (timelineDiv) timelineDiv.innerHTML = "";

  try {
    const response = await fetch(
      `${API_BASE}/api/tracking/${encodeURIComponent(trackingNo)}`
    );

    const data = await response.json();

    if (!data.success) {
      if (typeof window.showTrackingError === "function") {
        window.showTrackingError(data.message);
      } else {
        alert(data.message || "Shipment not found.");
      }
      return;
    }

    const shipment = data.shipment || {};
    const location = shipment.tracking_location || "Mok Transports Hub";
    const updated = formatDate(
      shipment.tracking_updated_at || shipment.updated_at || shipment.created_at
    );

    if (typeof window.renderStatus === "function") {
      window.renderStatus(
        shipment.current_status,
        shipment.waybill_no,
        shipment.jkj_reference,
        shipment.service,
        location,
        updated
      );
    } else {
      // Fallback: original direct-DOM rendering, kept for safety if
      // track.html's helpers are ever unavailable.
      const resultBox = document.getElementById("trackingResult");
      if (resultBox) resultBox.style.display = "block";
      document.getElementById("waybillNo").innerText = shipment.waybill_no || "—";
      document.getElementById("jkjRef").innerText = shipment.jkj_reference || "Awaiting JKJ Reference";
      document.getElementById("statusBox").innerText = shipment.current_status || "Shipment Created";
      const currentLocation = document.getElementById("currentLocation");
      if (currentLocation) currentLocation.innerText = location;
      const lastUpdated = document.getElementById("lastUpdated");
      if (lastUpdated) lastUpdated.innerText = updated;
      const serviceType = document.getElementById("serviceType");
      if (serviceType) serviceType.innerText = shipment.service || "Express";
    }

    const events = Array.isArray(shipment.events) && shipment.events.length
      ? shipment.events
      : buildFallbackEvents(shipment);

    if (timelineDiv) {
      timelineDiv.innerHTML = events.map(event => `
        <div class="timeline-item">
          <h6>${event.status || "Shipment Updated"}</h6>
          <p>${event.location || "Mok Transports Hub"}</p>
          <small>${formatDate(event.date || event.created_at || event.updated_at)}</small>
        </div>
      `).join("");
    }

  } catch (error) {
    console.error("Tracking error:", error);
    if (typeof window.showTrackingError === "function") {
      window.showTrackingError("Tracking failed. Please try again.");
    } else {
      alert("Tracking failed. Please try again.");
    }
  }
}

function buildFallbackEvents(shipment) {
  const status = shipment.current_status || shipment.status || "Shipment Created";
  const location = shipment.tracking_location || "Mok Transports Hub";
  const date = shipment.tracking_updated_at || shipment.updated_at || shipment.created_at || new Date();

  const events = [
    {
      status: "Shipment Created",
      location: "Mok Transports Booking System",
      date: shipment.created_at || date
    }
  ];

  if (shipment.jkj_reference) {
    events.push({
      status: "Waybill Sent to JKJ",
      location: "Mok Transports Operations",
      date
    });
  }

  if (status && status !== "Shipment Created" && status !== "created") {
    events.push({
      status,
      location,
      date
    });
  }

  return events;
}

function formatDate(value) {
  if (!value) return "Recently";

  const date = new Date(value);

  if (isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("en-ZA", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("trackingInput");

  if (input) {
    input.addEventListener("keydown", function (event) {
      if (event.key === "Enter") {
        trackShipment();
      }
    });
  }
});



