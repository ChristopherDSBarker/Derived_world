"use strict";

const fs = require("fs");
const path = require("path");

const OVERPASS_ENDPOINT = "https://overpass-api.de/api/interpreter";
const projectRoot = path.resolve(__dirname, "..");
const outputPath = path.join(projectRoot, "data", "raw", "sample-area.overpass.json");

const bounds = {
  south: 47.2180,
  west: -122.4750,
  north: 47.2240,
  east: -122.4650
};

async function main() {
  const query = buildQuery(bounds);
  const response = await fetch(OVERPASS_ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
      "user-agent": "Derived-World-Rainline-Prototype/1.0"
    },
    body: new URLSearchParams({ data: query })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Overpass request failed: HTTP ${response.status}\n${body.slice(0, 500)}`);
  }

  const osmJson = await response.json();
  osmJson.derivedWorld = {
    source: "overpass-api",
    endpoint: OVERPASS_ENDPOINT,
    fetchedAt: new Date().toISOString(),
    bounds
  };

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(osmJson, null, 2)}\n`, "utf8");

  printSummary(osmJson);
}

function buildQuery({ south, west, north, east }) {
  const bbox = `${south},${west},${north},${east}`;

  return `
[out:json][timeout:25];
(
  way["highway"](${bbox});
  way["highway"~"footway|path|pedestrian|cycleway"](${bbox});
  way["building"](${bbox});
  way["leisure"="park"](${bbox});
  way["landuse"~"grass|forest|recreation_ground|meadow"](${bbox});
  way["natural"~"wood|tree_row"](${bbox});
  way["natural"="water"](${bbox});
  way["waterway"](${bbox});
  node["shop"](${bbox});
  way["shop"](${bbox});
  node["amenity"](${bbox});
  way["amenity"](${bbox});
  node["tourism"](${bbox});
  way["tourism"](${bbox});
  node["historic"](${bbox});
  way["historic"](${bbox});
  node["highway"="bus_stop"](${bbox});
);
out body;
>;
out skel qt;
`.trim();
}

function printSummary(osmJson) {
  const elements = Array.isArray(osmJson.elements) ? osmJson.elements : [];
  const counts = elements.reduce((summary, element) => {
    summary[element.type] = (summary[element.type] || 0) + 1;
    return summary;
  }, {});

  console.log("Fetched real OpenStreetMap data from Overpass.");
  console.log("Area: Tacoma, Washington small test bbox");
  console.log(`Bounds: ${bounds.south},${bounds.west},${bounds.north},${bounds.east}`);
  console.log(`Output: ${path.relative(projectRoot, outputPath)}`);
  console.log(`Elements: ${elements.length}`);
  console.log(`- nodes: ${counts.node || 0}`);
  console.log(`- ways: ${counts.way || 0}`);
  console.log(`- relations: ${counts.relation || 0}`);
  console.log("");
  console.log("Next:");
  console.log("node tools/convertOsmToGameMap.js");
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = {
  buildQuery,
  bounds
};
