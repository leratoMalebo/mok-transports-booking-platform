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
  console.log("SUBURB :", suburb);
  console.log("TOWN    :", town);

  const postcodeMatches = places.filter(p => p.postcode === postcode);

  console.log("Matches for postcode:", postcodeMatches.length);

  postcodeMatches.forEach(p => console.log("Candidate:", p.place));

  // **********************
  // THIS IS THE IMPORTANT PART
  // **********************
  if (postcodeMatches.length === 1) {

    console.log("✅ Unique postcode match:", postcodeMatches[0].place);

    return postcodeMatches[0].place;

  }

  let match = postcodeMatches.find(p =>
    p.place.includes(suburb) ||
    suburb.includes(p.place)
  );

  if (!match) {

    match = postcodeMatches.find(p =>
      p.place.includes(town) ||
      town.includes(p.place)
    );

  }

 if (match) {

    console.log("✅ Place matched:", match.place);

    // TEMPORARY TEST
    return match.postcode;

}

console.log("❌ No place match for", postcode);

return null;
}

module.exports = {
  loadPlaces,
  findPlace
};

















