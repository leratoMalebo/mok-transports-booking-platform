let canvas = document.getElementById("signaturePad");
let ctx = canvas.getContext("2d");
let drawing = false;

// Resize canvas for mobile
canvas.width = canvas.offsetWidth;
canvas.height = canvas.offsetHeight;

canvas.addEventListener("mousedown", startDraw);
canvas.addEventListener("mouseup", endDraw);
canvas.addEventListener("mousemove", draw);

canvas.addEventListener("touchstart", startDraw);
canvas.addEventListener("touchend", endDraw);
canvas.addEventListener("touchmove", drawTouch);

function startDraw(e) {
  drawing = true;
  ctx.beginPath();
}

function endDraw() {
  drawing = false;
}

function draw(e) {
  if (!drawing) return;
  ctx.lineWidth = 2;
  ctx.lineTo(e.offsetX, e.offsetY);
  ctx.stroke();
}

function drawTouch(e) {
  e.preventDefault();
  if (!drawing) return;
  const rect = canvas.getBoundingClientRect();
  const touch = e.touches[0];
  ctx.lineTo(touch.clientX - rect.left, touch.clientY - rect.top);
  ctx.stroke();
}

function clearSignature() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

// Load Waybill
function loadWaybill() {
  const wb = document.getElementById("waybillInput").value;
  const record = JSON.parse(localStorage.getItem("tracking_" + wb));

  if (!record) {
    M.toast({ text: "Waybill not found" });
    return;
  }

  document.getElementById("wb").innerText = wb;
  document.getElementById("status").innerText = record.status;
  document.getElementById("updated").innerText = record.updated || "-";
  document.getElementById("location").innerText = record.location || "-";
}

// Update Status
function setStatus(newStatus) {
  const wb = document.getElementById("wb").innerText;
  if (!wb || wb === "-") return;

  const record = JSON.parse(localStorage.getItem("tracking_" + wb));
  record.status = newStatus;
  record.updated = new Date().toLocaleString();
  record.location = "Driver Mobile";

  localStorage.setItem("tracking_" + wb, JSON.stringify(record));
  loadWaybill();
  M.toast({ text: "Status updated to " + newStatus });
}

// GPS
function getLocation() {
  if (!navigator.geolocation) {
    alert("GPS not supported on this device");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    pos => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;

      const coordsText = lat.toFixed(6) + ", " + lng.toFixed(6);
      document.getElementById("gps").innerText = coordsText;

      // Update Google Map iframe
      const mapURL =
        "https://www.google.com/maps?q=" +
        lat + "," + lng +
        "&z=16&output=embed";

      document.getElementById("map").src = mapURL;
    },
    err => {
      alert("Unable to retrieve GPS location");
    },
    {
      enableHighAccuracy: true,
      timeout: 10000
    }
  );
}


// Save Proof
function saveProof() {
  const wb = document.getElementById("wb").innerText;
  if (!wb || wb === "-") return;

  const proof = {
    signature: canvas.toDataURL(),
    gps: document.getElementById("gps").innerText,
    map: document.getElementById("map").src,
    timestamp: new Date().toLocaleString()
  };

  localStorage.setItem("proof_" + wb, JSON.stringify(proof));
  M.toast({ text: "Delivery proof saved" });
}

