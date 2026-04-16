function trackShipment() {
  const wb = document.getElementById("searchWB").value.trim();
  if (!wb) return;

  const tracking = JSON.parse(localStorage.getItem("tracking_" + wb));
  const proof = JSON.parse(localStorage.getItem("proof_" + wb));

  if (!tracking) {
    M.toast({ text: "Waybill not found" });
    return;
  }

  // Status info
  document.getElementById("wb").innerText = wb;
  document.getElementById("status").innerText = tracking.status;
  document.getElementById("updated").innerText = tracking.updated || "-";
  document.getElementById("location").innerText = tracking.location || "-";

  // Proof info
  if (proof) {
    document.getElementById("timestamp").innerText = proof.timestamp || "-";

    if (proof.signature) {
      document.getElementById("signature").src = proof.signature;
    }

    if (proof.photo) {
      document.getElementById("photo").src = proof.photo;
    }

    if (proof.map) {
      document.getElementById("map").src = proof.map;
    }
  }
}
