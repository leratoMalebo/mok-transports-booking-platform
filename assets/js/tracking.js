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
        updated,
        shipment.latest_scan_description
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
      timelineDiv.innerHTML = events.map((event, i) => {
        const isLast = i === events.length - 1;
        return `
        <div class="timeline-item">
          <div class="tl-dot ${isLast ? "active" : "done"}">${eventIcon(event.eventType, event.status)}</div>
          <div class="tl-body">
            <div class="tl-step">${event.status || "Shipment Updated"}</div>
            <div class="tl-desc">${event.location || "Mok Transports Hub"}</div>
            <div class="tl-time">${formatDate(event.date || event.created_at || event.updated_at)}</div>
          </div>
        </div>`;
      }).join("");
    }

    // Show the Proof of Delivery button once the shipment has actually
    // been delivered — hidden otherwise, since there's nothing to fetch.
    const statusLower = (shipment.current_status || "").toLowerCase();
    const hasDeliveryEvent = events.some(e => /proof of delivery|delivered/i.test(e.status || ""));
    if (typeof window.togglePODButton === "function") {
      window.togglePODButton(statusLower.includes("delivered") || hasDeliveryEvent, trackingNo);
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

// Maps a Parcel Perfect event type / scan description to a small
// timeline icon. Falls back to a generic dot if nothing matches.
function eventIcon(eventType, statusText) {
  const t = (eventType || "").trim().toUpperCase();
  const s = (statusText || "").toLowerCase();
  if (t === "R" || s.includes("ready for collection")) return "🕐";
  if (t === "O" || s.includes("collected")) return "📤";
  if (t === "D" || s.includes("checked in")) return "🏢";
  if (["1", "2", "3"].includes(t) || s.includes("manifest") || s.includes("loaded")) return "🚚";
  if (t === "C" || s.includes("dispatch")) return "🚛";
  if (t === "V" || s.includes("arrived")) return "📍";
  if (t === "P" || s.includes("proof of delivery details")) return "✍️";
  if (t === "I" || s.includes("proof of delivery image") || s.includes("image scanned")) return "📷";
  if (s.includes("delivered")) return "✅";
  if (t === "M" || s.includes("mis-routed")) return "⚠️";
  if (["A", "B", "E"].includes(t) || s.includes("held") || s.includes("failed") || s.includes("damaged")) return "⚠️";
  return "📦";
}

// ── PROOF OF DELIVERY ───────────────────────────────────────
async function loadPOD(trackingNo) {
  const podBody = document.getElementById("podBody");
  if (!podBody) return;

  podBody.innerHTML = `<div class="pod-loading">Loading proof of delivery…</div>`;

  try {
    const response = await fetch(
      `${API_BASE}/api/tracking/${encodeURIComponent(trackingNo)}/pod`
    );
    const data = await response.json();

    if (!data.success || !data.pod) {
      podBody.innerHTML = `<div class="pod-empty">${data.message || "Proof of delivery is not available for this shipment yet."}</div>`;
      return;
    }

    const pod = data.pod;
    const sigHtml = pod.signature_base64
      ? `<img class="pod-signature" src="data:image/png;base64,${pod.signature_base64}" alt="Delivery signature">`
      : `<div class="pod-empty">No signature image available.</div>`;

    podBody.innerHTML = `
      <div class="pod-grid">
        <div>
          <div class="pod-label">Recipient</div>
          <div class="pod-value">${pod.recipient_name || "—"}</div>
        </div>
        <div>
          <div class="pod-label">Delivered</div>
          <div class="pod-value">${formatDate(
            pod.delivered_date && pod.delivered_time
              ? `${pod.delivered_date}T${pod.delivered_time}`
              : pod.delivered_date
          )}</div>
        </div>
      </div>
      ${sigHtml}
    `;
  } catch (error) {
    console.error("POD error:", error);
    podBody.innerHTML = `<div class="pod-empty">Could not load proof of delivery. Please try again.</div>`;
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






