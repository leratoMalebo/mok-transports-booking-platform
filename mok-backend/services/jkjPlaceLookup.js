const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");

let places = [];

async function loadPlaces() {
  return new Promise((resolve, reject) => {
    places = [];

    fs.createReadStream(
      path.join(__dirname, "../data/jkj_places.csv")
    )
      // Remove custom headers so csv-parser uses the exact column names from line 1 ("PLACE ID", "TOWN", "PCODE")
      .pipe(csv())
      .on("data", (row) => {
        const placeId = row["PLACE ID"] ? String(row["PLACE ID"]).trim() : "";
        const town = row["TOWN"] ? String(row["TOWN"]).toUpperCase().trim() : "";
        const pcode = row["PCODE"] ? String(row["PCODE"]).trim() : "";

        if (!town || !pcode) return;

        places.push({
          placeId: placeId,
          place: town,
          postcode: pcode
        });
      })
      .on("end", () => {
        console.log(`✅ Loaded ${places.length} JKJ Places`);
        console.log("First five records:");
        console.log(places.slice(0, 5));
        resolve();
      })
      .on("error", reject);
  });
}

function findPlace(postcode, suburb, town) {
  postcode = String(postcode || "").trim();
  suburb = String(suburb || "").trim().toUpperCase();
  town = String(town || "").trim().toUpperCase();

  console.log("==================================");
  console.log("findPlace() called");
  console.log("POSTCODE:", postcode);
  console.log("SUBURB  :", suburb);
  console.log("TOWN    :", town);

  const postcodeMatches = places.filter(p => p.postcode === postcode);

  console.log("Matches for postcode:", postcodeMatches.length);
  postcodeMatches.forEach(p => console.log("Candidate:", p.place, "| ID:", p.placeId));

  // 1. Single match by postcode
  if (postcodeMatches.length === 1) {
    console.log("✅ Unique postcode match:", postcodeMatches[0].place, "-> ID:", postcodeMatches[0].placeId);
    return postcodeMatches[0].placeId; // Ensure placeId is returned
  }

  // 2. Suburb match within postcode candidates
  let match = postcodeMatches.find(p =>
    suburb && (p.place.includes(suburb) || suburb.includes(p.place))
  );

  // 3. Town match within postcode candidates
  if (!match) {
    match = postcodeMatches.find(p =>
      town && (p.place.includes(town) || town.includes(p.place))
    );
  }

  // 4. Fallback: match suburb or town globally across all places if postcode didn't match
  if (!match) {
    match = places.find(p =>
      (suburb && (p.place.includes(suburb) || suburb.includes(p.place))) ||
      (town && (p.place.includes(town) || town.includes(p.place)))
    );
  }

  if (match) {
    console.log("✅ Place matched:", match.place, "-> ID:", match.placeId);
    return match.placeId;
  }

  console.log("❌ No place match for", postcode, town);
  return null;
}

module.exports = {
  loadPlaces,
  findPlace
};



