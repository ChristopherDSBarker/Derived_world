"use strict";

const { classifyTags } = require("./tagRules");

const DEFAULT_WORLD_SIZE = {
  width: 2400,
  height: 1400
};

const EMPTY_GAME_MAP = {
  roads: [],
  paths: [],
  buildings: [],
  parks: [],
  forests: [],
  water: [],
  landmarks: [],
  shops: [],
  amenities: []
};

function parseOverpassToGameMap(overpassJson, options = {}) {
  const elements = Array.isArray(overpassJson && overpassJson.elements)
    ? overpassJson.elements
    : [];

  const nodes = indexNodes(elements);
  const bounds = options.bounds || rawBounds(overpassJson) || inferBounds(elements);
  const worldSize = createWorldSize(bounds, options);
  const project = createProjector(bounds, worldSize);
  const gameMap = createEmptyGameMap(bounds, worldSize);

  for (const element of elements) {
    const tags = element.tags || {};
    const classification = classifyTags(tags);

    if (!classification) {
      continue;
    }

    const coordinates = getCoordinates(element, nodes, project);
    if (coordinates.length === 0) {
      continue;
    }

    const object = {
      id: `${element.type}-${element.id}`,
      name: tags.name || null,
      type: classification.type,
      layer: classification.layer,
      coordinates,
      tags,
      walkable: classification.walkable,
      blocked: classification.blocked,
      gameplayRole: classification.gameplayRole,
      bounds: boundsFromCoordinates(coordinates)
    };
    const aliases = featureAliases(tags.name);
    if (aliases.length > 0) {
      object.aliases = aliases;
    }

    gameMap[classification.layer].push(object);

    const landmark = supplementalLandmark(element, object);
    if (landmark) {
      gameMap.landmarks.push(landmark);
    }
  }

  gameMap.start = findStartPoint(gameMap, worldSize);
  return gameMap;
}

function createEmptyGameMap(bounds, worldSize) {
  return {
    meta: {
      source: "openstreetmap",
      generatedAt: new Date().toISOString(),
      bounds,
      worldSize
    },
    bounds: worldSize,
    start: {
      x: Math.round(worldSize.width / 2),
      y: Math.round(worldSize.height / 2)
    },
    ...cloneEmptyLayers()
  };
}

function cloneEmptyLayers() {
  return Object.fromEntries(
    Object.keys(EMPTY_GAME_MAP).map((layer) => [layer, []])
  );
}

function createWorldSize(bounds, options = {}) {
  if (options.width && options.height) {
    return {
      width: options.width,
      height: options.height
    };
  }

  const width = options.width || DEFAULT_WORLD_SIZE.width;
  const aspect = boundsAspect(bounds);
  const height = options.height || clamp(Math.round(width / aspect), 1200, 2200);

  return {
    width,
    height
  };
}

function boundsAspect(bounds) {
  const midLat = (bounds.south + bounds.north) / 2;
  const metersPerDegreeLat = 111320;
  const metersPerDegreeLon = Math.cos((midLat * Math.PI) / 180) * metersPerDegreeLat;
  const widthMeters = Math.max((bounds.east - bounds.west) * metersPerDegreeLon, 1);
  const heightMeters = Math.max((bounds.north - bounds.south) * metersPerDegreeLat, 1);
  return widthMeters / heightMeters;
}

function rawBounds(overpassJson) {
  const bounds = overpassJson && overpassJson.derivedWorld && overpassJson.derivedWorld.bounds;

  if (
    bounds &&
    typeof bounds.south === "number" &&
    typeof bounds.west === "number" &&
    typeof bounds.north === "number" &&
    typeof bounds.east === "number"
  ) {
    return bounds;
  }

  return null;
}

function indexNodes(elements) {
  const nodes = new Map();

  for (const element of elements) {
    if (element.type === "node" && hasLatLon(element)) {
      nodes.set(element.id, {
        lat: element.lat,
        lon: element.lon
      });
    }
  }

  return nodes;
}

function inferBounds(elements) {
  const points = [];

  for (const element of elements) {
    if (hasLatLon(element)) {
      points.push({
        lat: element.lat,
        lon: element.lon
      });
    }
  }

  if (points.length === 0) {
    return {
      south: 0,
      west: 0,
      north: 1,
      east: 1
    };
  }

  const lats = points.map((point) => point.lat);
  const lons = points.map((point) => point.lon);
  const padding = 0.0002;

  return {
    south: Math.min(...lats) - padding,
    west: Math.min(...lons) - padding,
    north: Math.max(...lats) + padding,
    east: Math.max(...lons) + padding
  };
}

function createProjector(bounds, worldSize = DEFAULT_WORLD_SIZE) {
  const lonRange = Math.max(bounds.east - bounds.west, Number.EPSILON);
  const latRange = Math.max(bounds.north - bounds.south, Number.EPSILON);

  return function project(point) {
    const x = ((point.lon - bounds.west) / lonRange) * worldSize.width;
    const y = ((bounds.north - point.lat) / latRange) * worldSize.height;

    return {
      x: round(clamp(x, 0, worldSize.width)),
      y: round(clamp(y, 0, worldSize.height))
    };
  };
}

function getCoordinates(element, nodes, project) {
  if (element.type === "node" && hasLatLon(element)) {
    return [project(element)];
  }

  if (element.type === "way" && Array.isArray(element.nodes)) {
    return element.nodes
      .map((nodeId) => nodes.get(nodeId))
      .filter(Boolean)
      .map(project);
  }

  return [];
}

function boundsFromCoordinates(coordinates) {
  const xs = coordinates.map((point) => point.x);
  const ys = coordinates.map((point) => point.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);

  return {
    x: round(minX),
    y: round(minY),
    w: round(maxX - minX),
    h: round(maxY - minY)
  };
}

function findStartPoint(gameMap, worldSize) {
  const margin = 80;
  const center = {
    x: worldSize.width / 2,
    y: worldSize.height / 2
  };
  const routePoints = [...gameMap.roads, ...gameMap.paths]
    .flatMap((route) => route.coordinates)
    .filter((point) => (
      point.x >= margin &&
      point.y >= margin &&
      point.x <= worldSize.width - margin &&
      point.y <= worldSize.height - margin
    ))
    .sort((a, b) => pointDistance(a, center) - pointDistance(b, center));

  const firstPoint = routePoints[0];

  if (firstPoint) {
    return {
      x: firstPoint.x,
      y: firstPoint.y
    };
  }

  return {
    x: Math.round(worldSize.width / 2),
    y: Math.round(worldSize.height / 2)
  };
}

function supplementalLandmark(element, object) {
  if (!object.name || object.layer === "landmarks" || !isLandmarkName(object.name, object.tags)) {
    return null;
  }

  const landmark = {
    id: `${element.type}-${element.id}-landmark`,
    name: object.name,
    type: "campus_landmark",
    layer: "landmarks",
    coordinates: object.coordinates,
    tags: object.tags,
    walkable: true,
    blocked: false,
    gameplayRole: "landmarkObjective",
    bounds: object.bounds
  };

  if (object.aliases) {
    landmark.aliases = object.aliases;
  }

  return landmark;
}

function isLandmarkName(name, tags) {
  const landmarkNames = [
    "observatory",
    "auditorium",
    "university center",
    "science center",
    "gym",
    "fitness",
    "stadium",
    "plaza",
    "field"
  ];

  return tags.man_made === "observatory" || landmarkNames.some((word) => name.toLowerCase().includes(word));
}

function featureAliases(name) {
  if (!name) {
    return [];
  }

  const aliases = new Set();
  const normalized = name.toLowerCase();

  if (normalized.includes("olson auditorium")) {
    aliases.add("Olsen Auditorium");
  }

  if (normalized.includes("memorial gymasium")) {
    aliases.add("Memorial Gymnasium");
  }

  if (normalized.includes("names fitness center")) {
    aliases.add("Names Fitness Center");
  }

  if (normalized.includes("tinglestad residence hall")) {
    aliases.add("Tingelstad Residence Hall");
  }

  return [...aliases];
}

function pointDistance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function hasLatLon(element) {
  return typeof element.lat === "number" && typeof element.lon === "number";
}

function round(value) {
  return Math.round(value * 100) / 100;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

module.exports = {
  parseOverpassToGameMap,
  createProjector,
  boundsFromCoordinates
};
