"use strict";

const ROAD_HIGHWAYS = new Set([
  "motorway",
  "trunk",
  "primary",
  "secondary",
  "tertiary",
  "unclassified",
  "residential",
  "service",
  "living_street",
  "road"
]);

const PATH_HIGHWAYS = new Set([
  "footway",
  "path",
  "pedestrian",
  "steps",
  "cycleway",
  "bridleway",
  "track"
]);

function classifyTags(tags = {}) {
  if (tags.entrance || tags.door || tags.building === "entrance") {
    return marker("amenities", "entrance", "entranceMarker");
  }

  if (tags.barrier) {
    return marker("amenities", "barrier", "barrierMarker");
  }

  if (tags.highway === "bus_stop") {
    return marker("landmarks", "bus_stop", "travelMarker");
  }

  if (tags.building) {
    const type = buildingType(tags);
    return {
      layer: "buildings",
      type,
      walkable: false,
      blocked: true,
      gameplayRole: type === "residenceHall" ? "residenceHall" : "campusBuilding"
    };
  }

  if (
    tags.leisure === "park" ||
    tags.leisure === "pitch" ||
    tags.landuse === "grass" ||
    tags.landuse === "recreation_ground" ||
    tags.landuse === "meadow"
  ) {
    return {
      layer: "parks",
      type: tags.leisure === "pitch" ? "field" : tags.leisure === "park" ? "park" : "green_area",
      walkable: true,
      blocked: false,
      gameplayRole: "resourceZone"
    };
  }

  if (tags.leisure === "fitness_centre" || tags.leisure === "sports_hall") {
    return marker("amenities", tags.leisure, tags.leisure === "fitness_centre" ? "fitnessHub" : "sportsHub");
  }

  if (tags.landuse === "forest" || tags.natural === "wood" || tags.natural === "tree_row") {
    return {
      layer: "forests",
      type: tags.natural === "tree_row" ? "tree_row" : "forest",
      walkable: true,
      blocked: false,
      gameplayRole: "resourceZone"
    };
  }

  if (tags.natural === "water" || tags.waterway) {
    return {
      layer: "water",
      type: tags.waterway ? "waterway" : "water",
      walkable: false,
      blocked: true,
      gameplayRole: "blockedWater"
    };
  }

  if (tags.shop) {
    return marker("shops", "shop", "shopMarker");
  }

  if (tags.amenity) {
    return classifyAmenity(tags.amenity);
  }

  if (tags.tourism || tags.historic || tags.man_made === "observatory") {
    return marker("landmarks", tags.man_made === "observatory" ? "observatory" : "landmark", "landmarkObjective");
  }

  if (tags.highway) {
    if (PATH_HIGHWAYS.has(tags.highway)) {
      return {
        layer: "paths",
        type: "path",
        walkable: true,
        blocked: false,
        gameplayRole: "walkRoute"
      };
    }

    if (ROAD_HIGHWAYS.has(tags.highway) || tags.highway) {
      return {
        layer: "roads",
        type: "road",
        walkable: true,
        blocked: false,
        gameplayRole: "walkRoute"
      };
    }
  }

  return null;
}

function classifyAmenity(amenity) {
  const roles = {
    university: ["university", "campusZone"],
    parking: ["parking", "parkingZone"],
    cafe: ["cafe", "restPoint"],
    library: ["library", "loreHub"],
    school: ["school", "civicHub"],
    hospital: ["hospital", "healingHub"],
    place_of_worship: ["place_of_worship", "sanctuary"]
  };

  const [type, gameplayRole] = roles[amenity] || [amenity, "amenityMarker"];
  return marker("amenities", type, gameplayRole);
}

function marker(layer, type, gameplayRole) {
  return {
    layer,
    type,
    walkable: true,
    blocked: false,
    gameplayRole
  };
}

function buildingType(tags) {
  if (tags.building === "residential" || /residence hall/i.test(tags.name || "")) {
    return "residenceHall";
  }

  if (tags.building === "university") {
    return "campusBuilding";
  }

  return "building";
}

module.exports = {
  classifyTags
};
