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
      .pipe(csv({
        headers: ["PLACE", "PCODE"],
        skipLines: 1
      }))
      .on("data", (row) => {

        if (!row.PLACE || !row.PCODE) return;

        places.push({
          place: String(row.PLACE).trim().toUpperCase(),
          postcode: String(row.PCODE).trim()
        });

      })
      .on("end", () => {

        console.log(`✅ Loaded ${places.length} JKJ Places`);

        resolve();

      })
      .on("error", reject);

  });
}

function findPlace(postcode, town) {

  postcode = String(postcode || "").trim();
  town = String(town || "").trim().toUpperCase();

  const match = places.find(p => {

    if (p.postcode !== postcode) return false;

    return (
      p.place.includes(town) ||
      town.includes(p.place)
    );

  });

  if (match) {
    console.log(`✅ Place matched: ${postcode} -> ${match.place}`);
  } else {
    console.log(`❌ No place match for ${postcode} / ${town}`);
  }

  return match ? match.place : null;
}

module.exports = {
  loadPlaces,
  findPlace
};








