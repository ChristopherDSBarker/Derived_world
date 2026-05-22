"use strict";

const fs = require("fs");
const path = require("path");
const { parseOverpassToGameMap } = require("../src/osm/osmParser");

const projectRoot = path.resolve(__dirname, "..");
const inputCandidates = [
  path.join(projectRoot, "data", "raw", "map.osm"),
  path.join(projectRoot, "map_data", "plu_map-true.osm")
];
const outputPath = path.join(projectRoot, "data", "generated", "gameMap.json");

function main() {
  const inputPath = resolveInputPath();

  const xml = fs.readFileSync(inputPath, "utf8");
  const osmJson = parseOsmXml(xml, relative(inputPath));
  const gameMap = parseOverpassToGameMap(osmJson);

  gameMap.meta.source = "openstreetmap";
  gameMap.meta.sourceFormat = "osm-xml";
  gameMap.meta.sourceFile = relative(inputPath);

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(gameMap, null, 2)}\n`, "utf8");

  printSummary(osmJson, gameMap, inputPath);
}

function parseOsmXml(xml, sourceFile = "data/raw/map.osm") {
  const bounds = parseBounds(xml);
  const elements = [];

  for (const match of xml.matchAll(/<node\b([^>]*)\/>|<node\b([^>]*)>([\s\S]*?)<\/node>/g)) {
    const attrs = parseAttributes(match[1] || match[2]);
    const tags = match[3] ? parseTags(match[3]) : {};
    elements.push(nodeElement(attrs, tags));
  }

  for (const match of xml.matchAll(/<way\b([^>]*)>([\s\S]*?)<\/way>/g)) {
    const attrs = parseAttributes(match[1]);
    const body = match[2];
    const nodeRefs = [...body.matchAll(/<nd\b([^>]*)\/>/g)]
      .map((ndMatch) => parseAttributes(ndMatch[1]).ref)
      .filter(Boolean)
      .map((ref) => Number(ref));
    const tags = parseTags(body);

    elements.push({
      type: "way",
      id: Number(attrs.id),
      nodes: nodeRefs,
      tags
    });
  }

  return {
    version: 0.6,
    generator: "Derived World OSM XML converter",
    derivedWorld: {
      source: "osm-xml-export",
      sourceFile,
      convertedAt: new Date().toISOString(),
      bounds
    },
    elements
  };
}

function parseBounds(xml) {
  const match = xml.match(/<bounds\b([^>]*)\/>/);
  if (!match) {
    return null;
  }

  const attrs = parseAttributes(match[1]);
  return {
    south: Number(attrs.minlat),
    west: Number(attrs.minlon),
    north: Number(attrs.maxlat),
    east: Number(attrs.maxlon)
  };
}

function nodeElement(attrs, tags) {
  const node = {
    type: "node",
    id: Number(attrs.id),
    lat: Number(attrs.lat),
    lon: Number(attrs.lon)
  };

  if (Object.keys(tags).length > 0) {
    node.tags = tags;
  }

  return node;
}

function parseTags(body) {
  const tags = {};

  for (const match of body.matchAll(/<tag\b([^>]*)\/>/g)) {
    const attrs = parseAttributes(match[1]);
    if (attrs.k) {
      tags[attrs.k] = attrs.v || "";
    }
  }

  return tags;
}

function parseAttributes(source) {
  const attrs = {};

  for (const match of source.matchAll(/([:\w-]+)="([^"]*)"/g)) {
    attrs[match[1]] = decodeXml(match[2]);
  }

  return attrs;
}

function decodeXml(value) {
  return String(value)
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function resolveInputPath() {
  const inputPath = inputCandidates.find((candidate) => fs.existsSync(candidate));
  if (!inputPath) {
    throw new Error(`Missing input file. Checked: ${inputCandidates.map(relative).join(", ")}`);
  }
  return inputPath;
}

function printSummary(osmJson, gameMap, inputPath) {
  const rawCounts = osmJson.elements.reduce((summary, element) => {
    summary[element.type] = (summary[element.type] || 0) + 1;
    return summary;
  }, {});
  const gameCounts = {
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

  console.log("Converted OSM XML export into game map.");
  console.log(`Input: ${relative(inputPath)}`);
  console.log(`Output: ${relative(outputPath)}`);
  console.log("");
  console.log("Parsed OSM XML:");
  console.log(`- nodes: ${rawCounts.node || 0}`);
  console.log(`- ways: ${rawCounts.way || 0}`);
  console.log("");
  console.log("Generated game layers:");

  for (const [layer, count] of Object.entries(gameCounts)) {
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

module.exports = {
  parseOsmXml
};
