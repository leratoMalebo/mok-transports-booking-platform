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

function findPlace(postcode, suburb, town) {

    postcode = String(postcode || "").trim();

    suburb = String(suburb || "")
        .trim()
        .toUpperCase();

    town = String(town || "")
        .trim()
        .toUpperCase();

    // First try postcode + suburb
    let match = places.find(p =>

        p.postcode === postcode &&
        (
            p.place.includes(suburb) ||
            suburb.includes(p.place)
        )

    );

    // If not found, try postcode + town
    if (!match) {

        match = places.find(p =>

            p.postcode === postcode &&
            (
                p.place.includes(town) ||
                town.includes(p.place)
            )

        );

    }

    if (match) {

        console.log(`✅ Place matched: ${postcode} -> ${match.place}`);

        return match.place;

    }

    console.log(`❌ No place match for ${postcode}`);

    return null;

}

module.exports = {
  loadPlaces,
  findPlace
};










