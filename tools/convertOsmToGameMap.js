"use strict";

const fs = require("fs");
const path = require("path");
const { parseOverpassToGameMap } = require("../src/osm/osmParser");

const projectRoot = path.resolve(__dirname, "..");
const inputPath = path.join(projectRoot, "data", "raw", "sample-area.overpass.json");
const outputPath = path.join(projectRoot, "data", "generated", "gameMap.json");

function main() {
  ensureInputExists();

  const raw = fs.readFileSync(inputPath, "utf8");
  const overpassJson = JSON.parse(raw);
  const gameMap = parseOverpassToGameMap(overpassJson);

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(gameMap, null, 2)}\n`, "utf8");

  printSummary(gameMap);
}

function ensureInputExists() {
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Missing input file: ${relative(inputPath)}`);
  }
}

function printSummary(gameMap) {
  const counts = {
    roads: gameMap.roads.length,
    paths: gameMap.paths.length,
    buildings: gameMap.buildings.length,
    parks: gameMap.parks.length,
    forests: gameMap.forests.length,
    water: gameMap.water.length,
    landmarks: gameMap.landmarks.length,
    shops: gameMap.shops.length,
    amenities: gameMap.amenities.length
  };

  console.log("Converted OpenStreetMap data into game map.");
  console.log(`Input: ${relative(inputPath)}`);
  console.log(`Output: ${relative(outputPath)}`);
  console.log("");
  console.log("Summary:");

  for (const [layer, count] of Object.entries(counts)) {
    console.log(`- ${layer}: ${count}`);
  }
}

function relative(filePath) {
  return path.relative(projectRoot, filePath);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
