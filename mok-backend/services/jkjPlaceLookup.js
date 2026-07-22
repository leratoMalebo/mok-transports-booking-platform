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
      .pipe(csv())
      .on("data", (row) => {

        if (!row.TOWN || !row.PCODE) return;

        places.push({
          town: String(row.TOWN).trim().toUpperCase(),
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

        const csvTown =
            String(p.place || "")
            .trim()
            .toUpperCase();

        const csvPostcode =
            String(p.pcode || "")
            .trim();

        return (
            csvPostcode === postcode &&
            csvTown === town
        );

    });

    return match || null;

}

module.exports = {
    loadPlaces,
    findPlace
};





