(() => {
  "use strict";

  const canvas = document.getElementById("game");
  const ctx = canvas ? canvas.getContext("2d") : null;

  if (!canvas || !ctx) {
    console.error("Canvas #game could not be initialized.");
    return;
  }

  const ui = {
    position: document.getElementById("position"),
    camera: document.getElementById("camera"),
    source: document.getElementById("map-source"),
    stats: document.getElementById("map-stats")
  };

  const DEBUG_BUILDINGS = false;
  const DEBUG_OSM = true;
  const DEBUG_LABELS = true;
  const DEBUG_DOORS = false;
  const DEBUG_ENTRANCES = false;
  const PLAYER_COLLISION_RADIUS = 8;
  const BUILDING_WALL_DEPTH = 16;
  const BUILDING_SHADOW_DEPTH = 5;
  const BUILDING_ROOF_STRIPE_SPACING = 8;
  const DOOR_WIDTH = 11;
  const DOOR_HEIGHT = 22;
  const WINDOW_WIDTH = 6;
  const WINDOW_HEIGHT = 5;
  const CAMERA_ZOOM = 1.32;
  const MIN_CAMERA_ZOOM = 0.95;
  const MAX_CAMERA_ZOOM = 2.1;
  const CAMERA_ZOOM_STEP = 0.1;
  const CAMERA_LERP = 0.12;
  const ROAD_VISUAL_SCALE = 0.82;
  const PATH_VISUAL_SCALE = 0.88;
  const PLAYER_RENDER_LERP = 0.22;
  const MINIMAP_WIDTH = 180;
  const MINIMAP_HEIGHT = 130;
  const MINIMAP_PADDING = 10;
  const EXPECTED_SOURCE = "map_data/plu_map-true.osm";
  const keys = new Set();

  let map = null;
  let mapBounds = null;
  let collisionPolygons = [];
  let cameraClampLogged = false;
  let showMinimap = true;

  const player = {
    x: 0,
    y: 0,
    visualX: 0,
    visualY: 0,
    w: 13,
    h: 17,
    speed: 180,
    color: "#f4ead0",
    isMoving: false
  };

  const camera = {
    x: 0,
    y: 0,
    zoom: CAMERA_ZOOM
  };

  let elapsedTime = 0;
  setupInput();
  initialize();

  async function initialize() {
    map = await loadActiveMap();
    mapBounds = {
      minX: 0,
      minY: 0,
      maxX: map.world.width,
      maxY: map.world.height
    };

    player.x = map.playerSpawn.x;
    player.y = map.playerSpawn.y;
    collisionPolygons = [
      ...map.buildings.map(collisionPolygonForFeature),
      ...map.water.map(collisionPolygonForFeature)
    ];

    player.visualX = player.x;
    player.visualY = player.y;
    updateCamera(true);

    logOsmQaReport(map);
    if (map.stats.realEntranceNodes === 0) {
      console.info("[OSM Walking QA] No real OSM entrance nodes found; doors are generated fallback.");
    }

    setText(ui.source, map.sourceFile);
    setText(ui.stats, `buildings ${map.stats.buildingCount} | named ${map.stats.namedBuildings} | unnamed ${map.stats.unnamedBuildings}`);
    requestAnimationFrame(loop);
  }

  async function loadActiveMap() {
    try {
      const response = await fetch("data/generated/gameMap.json", { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const generatedMap = await response.json();
      const sourceFile = generatedMap.meta && generatedMap.meta.sourceFile;
      if (sourceFile !== EXPECTED_SOURCE) {
        console.warn("[OSM Walking QA] generated map source is not the expected PLU export.", {
          expected: EXPECTED_SOURCE,
          actual: sourceFile
        });
      }

      return walkingMapFromGenerated(generatedMap);
    } catch (error) {
      console.warn("[OSM Walking QA] Falling back to mapData.js. The active map is not PLU-derived.", error);
      return walkingMapFromStatic(window.mapData);
    }
  }

  function walkingMapFromGenerated(gameMap) {
    const world = {
      width: Number(gameMap.bounds?.width) || 960,
      height: Number(gameMap.bounds?.height) || 640
    };
    const sourceFile = gameMap.meta?.sourceFile || "data/generated/gameMap.json";

    const roads = (gameMap.roads || []).map((feature) => routeFromGenerated(feature, 34 * ROAD_VISUAL_SCALE, ROAD_VISUAL_SCALE)).filter(Boolean);
    const paths = (gameMap.paths || []).map((feature) => routeFromGenerated(feature, 18 * PATH_VISUAL_SCALE, PATH_VISUAL_SCALE)).filter(Boolean);
    const buildings = (gameMap.buildings || []).map(featureFromGenerated).filter(Boolean);
    const parks = [...(gameMap.parks || []), ...(gameMap.forests || [])].map(featureFromGenerated).filter(Boolean);
    const water = (gameMap.water || []).map(featureFromGenerated).filter(Boolean);
    const allAmenities = gameMap.amenities || [];
    const realEntrances = allAmenities
      .map(pointFeatureFromGenerated)
      .filter((feature) => feature && isEntranceFeature(feature));

    prepareBuildingLabels(buildings);
    const doorStats = prepareBuildingDoors(buildings, realEntrances, [...paths, ...roads]);

    return {
      name: "PLU OSM Walking Prototype",
      sourceFile,
      world,
      playerSpawn: safeSpawnFromGenerated(gameMap, world),
      roads,
      paths,
      buildings,
      parks,
      water,
      realEntrances,
      landmarks: [...(gameMap.landmarks || []), ...(gameMap.amenities || [])]
        .map(pointFeatureFromGenerated)
        .filter(Boolean)
        .slice(0, 80),
      stats: {
        buildingCount: buildings.length,
        namedBuildings: buildings.filter((building) => building.label).length,
        unnamedBuildings: buildings.filter((building) => !building.label).length,
        realEntranceNodes: realEntrances.length,
        attachedEntranceNodes: doorStats.attachedEntranceNodes,
        generatedFallbackDoors: doorStats.generatedFallbackDoors,
        namedBuildingDetails: namedBuildingDetails(buildings)
      }
    };
  }

  function walkingMapFromStatic(staticMap) {
    if (!staticMap) {
      throw new Error("mapData.js is missing and generated map could not be loaded.");
    }

    return {
      ...staticMap,
      sourceFile: staticMap.sourceFile || "mapData.js fallback",
      realEntrances: [],
      stats: {
        buildingCount: staticMap.buildings?.length || 0,
        namedBuildings: (staticMap.buildings || []).filter((building) => labelForFeature(building)).length,
        unnamedBuildings: (staticMap.buildings || []).filter((building) => !labelForFeature(building)).length,
        realEntranceNodes: 0,
        attachedEntranceNodes: 0,
        generatedFallbackDoors: 0,
        namedBuildingDetails: []
      }
    };
  }

  function safeSpawnFromGenerated(gameMap, world) {
    const start = gameMap.start || { x: world.width / 2, y: world.height / 2 };
    const candidate = {
      x: Number(start.x) || world.width / 2,
      y: Number(start.y) || world.height / 2
    };
    const solids = [...(gameMap.buildings || []), ...(gameMap.water || [])]
      .map((feature) => feature.bounds)
      .filter(Boolean);

    if (!rectHitsAny(playerRectAt(candidate.x, candidate.y), solids)) {
      return candidate;
    }

    const routePoints = [...(gameMap.paths || []), ...(gameMap.roads || [])]
      .flatMap((feature) => feature.coordinates || [])
      .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
    const safe = routePoints.find((point) => !rectHitsAny(playerRectAt(point.x, point.y), solids));

    if (safe) {
      console.warn("[OSM Walking QA] PLU start point was blocked. Using nearest route point for spawn.", {
        requested: candidate,
        spawn: safe
      });
      return { x: safe.x, y: safe.y };
    }

    return candidate;
  }

  function routeFromGenerated(feature, fallbackWidth, visualScale = 1) {
    const points = (feature.coordinates || [])
      .map((point) => ({ x: Number(point.x), y: Number(point.y) }))
      .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));

    if (points.length < 2) return null;

    return {
      id: feature.id,
      name: feature.name,
      type: feature.type,
      tags: feature.tags || {},
      width: feature.tags?.highway === "pedestrian" ? Math.max(fallbackWidth, 26 * visualScale) : fallbackWidth,
      points
    };
  }

  function featureFromGenerated(feature) {
    const coordinates = (feature.coordinates || [])
      .map((point) => ({ x: Number(point.x), y: Number(point.y) }))
      .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));

    if (!coordinates.length) return null;

    const bounds = feature.bounds || boundsFromPoints(coordinates);
    return {
      id: feature.id,
      name: feature.name,
      label: labelForFeature(feature),
      type: feature.type,
      tags: feature.tags || {},
      gameplayRole: feature.gameplayRole,
      coordinates,
      x: bounds.x,
      y: bounds.y,
      w: Math.max(1, bounds.w),
      h: Math.max(1, bounds.h)
    };
  }

  function pointFeatureFromGenerated(feature) {
    const coordinates = feature.coordinates || [];
    const point = coordinates[0] || centerOfBounds(feature.bounds);
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;

    return {
      id: feature.id,
      name: feature.name,
      type: feature.type,
      tags: feature.tags || {},
      gameplayRole: feature.gameplayRole,
      x: point.x,
      y: point.y
    };
  }

  function prepareBuildingLabels(buildings) {
    const usedLabels = new Set();

    buildings.forEach((building) => {
      building.label = labelForFeature(building);
      if (!building.label) {
        building.showLabel = false;
        return;
      }

      const key = building.label.toLowerCase();
      building.showLabel = !usedLabels.has(key);
      usedLabels.add(key);
    });
  }

  function prepareBuildingDoors(buildings, entrances, routes) {
    let attachedEntranceNodes = 0;
    let generatedFallbackDoors = 0;

    buildings.forEach((building) => {
      building.realEntrances = [];
      building.useFallbackDoor = false;
      building.fallbackDoorT = 0.5;
    });

    entrances.forEach((entrance) => {
      const building = nearestBuildingForEntrance(entrance, buildings);
      if (building) {
        building.realEntrances.push(entrance);
        attachedEntranceNodes += 1;
      }
    });

    buildings.forEach((building) => {
      if (building.realEntrances.length > 0 || !shouldDrawFallbackDoor(building)) {
        return;
      }

      const facade = facadeForBuilding(building.coordinates || rectPoints(building));
      if (!facade) {
        return;
      }

      building.useFallbackDoor = true;
      building.fallbackDoorT = fallbackDoorTForFacade(facade, routes);
      generatedFallbackDoors += 1;
    });

    return {
      attachedEntranceNodes,
      generatedFallbackDoors
    };
  }

  function logOsmQaReport(activeMap) {
    if (!DEBUG_OSM) return;

    const sourceMatchesExpected = activeMap.sourceFile === EXPECTED_SOURCE;
    console.log("[OSM QA] active OSM source:", {
      sourceFile: activeMap.sourceFile,
      expectedSource: EXPECTED_SOURCE,
      sourceMatchesExpected
    });
    console.log("[OSM QA] map layer counts:", {
      buildings: activeMap.stats.buildingCount,
      namedBuildings: activeMap.stats.namedBuildings,
      unnamedBuildings: activeMap.stats.unnamedBuildings,
      roads: activeMap.roads.length,
      paths: activeMap.paths.length,
      parks: activeMap.parks.length,
      water: activeMap.water.length,
      landmarks: activeMap.landmarks.length,
      realEntranceNodes: activeMap.stats.realEntranceNodes,
      attachedEntranceNodes: activeMap.stats.attachedEntranceNodes,
      generatedFallbackDoors: activeMap.stats.generatedFallbackDoors
    });
    console.table(activeMap.stats.namedBuildingDetails);
  }

  function namedBuildingDetails(buildings) {
    return buildings
      .filter((building) => building.label)
      .map((building) => {
        const center = centerOfBounds(boundsForFeature(building));
        return {
          id: building.id,
          name: building.label,
          centerX: Math.round(center.x),
          centerY: Math.round(center.y),
          realEntrancesAttached: building.realEntrances.length,
          fallbackDoorUsed: building.useFallbackDoor ? "yes" : "no"
        };
      });
  }

  function isEntranceFeature(feature) {
    const tags = feature.tags || {};
    return feature.type === "entrance" || Boolean(tags.entrance || tags.door || tags.building === "entrance");
  }

  function labelForFeature(feature) {
    const tags = feature.tags || {};
    return feature.name || tags.name || tags.ref || tags["building:name"] || "";
  }

  function nearestBuildingForEntrance(entrance, buildings) {
    let best = null;
    const point = { x: entrance.x, y: entrance.y };

    buildings.forEach((building) => {
      const polygon = building.coordinates || rectPoints(building);
      const distanceToBuilding = distanceToPolygon(point, polygon);
      if (!best || distanceToBuilding < best.distance) {
        best = {
          building,
          distance: distanceToBuilding
        };
      }
    });

    return best && best.distance <= 42 ? best.building : null;
  }

  function shouldDrawFallbackDoor(building) {
    const bounds = boundsForFeature(building);
    const area = polygonArea(building.coordinates || rectPoints(building));
    const tags = building.tags || {};
    const buildingTag = String(tags.building || "");
    const isImportant = Boolean(building.label) ||
      /university|school|college|public|commercial|retail|civic|residential|dormitory|apartments/i.test(buildingTag);
    const isLargeEnoughToMatter = area >= 12000 && bounds.w >= 70 && bounds.h >= 45;

    return isImportant || isLargeEnoughToMatter;
  }

  function fallbackDoorTForFacade(facade, routes) {
    const candidates = [0.18, 0.32, 0.5, 0.68, 0.82];
    let bestT = 0.5;
    let bestDistance = Infinity;

    candidates.forEach((t) => {
      const point = facadePoint(facade, t, 0.88);
      const routeDistance = distanceToRoutes(point, routes);
      if (routeDistance < bestDistance) {
        bestDistance = routeDistance;
        bestT = t;
      }
    });

    return bestT;
  }

  function setupInput() {
    canvas.tabIndex = 0;
    canvas.focus({ preventScroll: true });
    canvas.addEventListener("pointerdown", () => canvas.focus({ preventScroll: true }));

    window.addEventListener("keydown", (event) => {
      const key = event.key.toLowerCase();
      if (["w", "a", "s", "d"].includes(key)) {
        keys.add(key);
        event.preventDefault();
        return;
      }

      if (key === "m" && !event.repeat) {
        showMinimap = !showMinimap;
        event.preventDefault();
        return;
      }

      if ((event.key === "-" || event.key === "_") && !event.repeat) {
        setCameraZoom(camera.zoom - CAMERA_ZOOM_STEP);
        event.preventDefault();
        return;
      }

      if ((event.key === "=" || event.key === "+") && !event.repeat) {
        setCameraZoom(camera.zoom + CAMERA_ZOOM_STEP);
        event.preventDefault();
      }
    });

    window.addEventListener("keyup", (event) => {
      const key = event.key.toLowerCase();
      if (["w", "a", "s", "d"].includes(key)) {
        keys.delete(key);
        event.preventDefault();
      }
    });
  }

  let lastFrame = 0;

  function loop(timestamp) {
    const dt = Math.min((timestamp - lastFrame) / 1000 || 0, 0.033);
    lastFrame = timestamp;
    elapsedTime += dt;

    update(dt);
    draw();

    requestAnimationFrame(loop);
  }

  function update(dt) {
    let dx = 0;
    let dy = 0;

    if (keys.has("a")) dx -= 1;
    if (keys.has("d")) dx += 1;
    if (keys.has("w")) dy -= 1;
    if (keys.has("s")) dy += 1;

    player.isMoving = dx !== 0 || dy !== 0;

    if (dx !== 0 || dy !== 0) {
      const length = Math.hypot(dx, dy);
      dx /= length;
      dy /= length;

      const step = player.speed * dt;
      movePlayer(dx * step, 0);
      movePlayer(0, dy * step);
    }

    updatePlayerVisual();
    updateCamera();
    updateHud();
  }

  function updatePlayerVisual() {
    player.visualX += (player.x - player.visualX) * PLAYER_RENDER_LERP;
    player.visualY += (player.y - player.visualY) * PLAYER_RENDER_LERP;
  }

  function updateCamera(snap = false) {
    const target = clampedCameraTarget(
      player.x - visibleWorldWidth() / 2,
      player.y - visibleWorldHeight() / 2
    );

    if (snap) {
      camera.x = target.x;
      camera.y = target.y;
    } else {
      camera.x += (target.x - camera.x) * CAMERA_LERP;
      camera.y += (target.y - camera.y) * CAMERA_LERP;
      const clamped = clampedCameraTarget(camera.x, camera.y);
      camera.x = clamped.x;
      camera.y = clamped.y;
    }

    if (!cameraClampLogged && camera.y === 0 && player.y < visibleWorldHeight() / 2) {
      console.log("[OSM Walking QA] camera y is clamped to 0 because the player is near the northern map edge.", {
        playerY: Math.round(player.y),
        cameraY: Math.round(camera.y),
        visibleHalfHeight: Math.round(visibleWorldHeight() / 2),
        zoom: camera.zoom.toFixed(2)
      });
      cameraClampLogged = true;
    }
  }

  function clampedCameraTarget(targetX, targetY) {
    let x = targetX;
    let y = targetY;

    if (mapBounds) {
      const maxCameraX = Math.max(mapBounds.minX, mapBounds.maxX - visibleWorldWidth());
      const maxCameraY = Math.max(mapBounds.minY, mapBounds.maxY - visibleWorldHeight());
      x = clamp(x, mapBounds.minX, maxCameraX);
      y = clamp(y, mapBounds.minY, maxCameraY);
    }

    return {
      x: Math.max(0, x),
      y: Math.max(0, y)
    };
  }

  function worldToScreen(x, y) {
    return {
      x: (x - camera.x) * camera.zoom,
      y: (y - camera.y) * camera.zoom
    };
  }

  function visibleWorldWidth() {
    return canvas.width / camera.zoom;
  }

  function visibleWorldHeight() {
    return canvas.height / camera.zoom;
  }

  function worldSize(value) {
    return value * camera.zoom;
  }

  function updateHud() {
    setText(ui.position, `player ${Math.round(player.x)}, ${Math.round(player.y)}`);
    setText(
      ui.camera,
      `camera ${Math.round(camera.x)}, ${Math.round(camera.y)} | zoom ${camera.zoom.toFixed(2)} | buildings ${map.stats.buildingCount} | entrances ${map.stats.realEntranceNodes} | fallback ${map.stats.generatedFallbackDoors}`
    );
  }

  function setCameraZoom(nextZoom) {
    camera.zoom = clamp(Number(nextZoom) || CAMERA_ZOOM, MIN_CAMERA_ZOOM, MAX_CAMERA_ZOOM);
    cameraClampLogged = false;
    updateCamera(true);
    updateHud();
  }

  function movePlayer(dx, dy) {
    const nextFeet = playerFeetAt(player.x + dx, player.y + dy);
    if (canFeetOccupy(nextFeet)) {
      player.x += dx;
      player.y += dy;
    }
  }

  function canFeetOccupy(feet) {
    if (
      feet.x - PLAYER_COLLISION_RADIUS < 0 ||
      feet.y - PLAYER_COLLISION_RADIUS < 0 ||
      feet.x + PLAYER_COLLISION_RADIUS > map.world.width ||
      feet.y + PLAYER_COLLISION_RADIUS > map.world.height
    ) {
      return false;
    }

    return !collisionPolygons.some((polygon) => circleIntersectsPolygon(feet, PLAYER_COLLISION_RADIUS, polygon));
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    drawBackground();
    map.parks.forEach(drawPark);
    map.water.forEach(drawWater);
    map.roads.forEach(drawRoad);
    map.paths.forEach(drawPath);
    map.buildings.forEach(drawBuilding);
    if (DEBUG_ENTRANCES) {
      map.realEntrances.forEach(drawEntranceDebug);
    }
    if (DEBUG_LABELS) {
      map.buildings.forEach(drawBuildingLabel);
    }
    if (DEBUG_BUILDINGS) {
      map.landmarks.forEach(drawLandmark);
    }
    drawPlayer();
    drawMinimap();
  }

  function drawBackground() {
    ctx.fillStyle = "#24332d";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = "rgba(238,247,235,0.035)";
    ctx.lineWidth = 1;
    const startX = Math.floor(camera.x / 96) * 96;
    const endX = camera.x + canvas.width / camera.zoom;
    const startY = Math.floor(camera.y / 96) * 96;
    const endY = camera.y + canvas.height / camera.zoom;

    for (let x = startX; x <= endX; x += 96) {
      const a = worldToScreen(x, camera.y);
      line(a.x, 0, a.x, canvas.height);
    }
    for (let y = startY; y <= endY; y += 96) {
      const a = worldToScreen(camera.x, y);
      line(0, a.y, canvas.width, a.y);
    }
  }

  function drawRoad(road) {
    const style = routeStyleForRoad(road);
    drawPolyline(road.points, road.width + style.edgeWidth, style.edge);
    drawPolyline(road.points, road.width, style.base);
    drawPolyline(road.points, Math.max(1, road.width * 0.08), style.texture, true, style.textureDash);
    if (style.center) {
      drawPolyline(road.points, Math.max(1, road.width * 0.055), style.center, true, [24, 22]);
    }
  }

  function drawPath(path) {
    const style = routeStyleForPath(path);
    drawPolyline(path.points, path.width + style.grassWidth, style.grassEdge);
    drawPolyline(path.points, path.width + style.edgeWidth, style.edge);
    drawPolyline(path.points, path.width, style.base);
    drawPolyline(path.points, Math.max(1, path.width * 0.08), style.texture, true, [10, 16]);
  }

  function routeStyleForRoad(road) {
    const highway = road.tags?.highway || "";
    if (highway === "service") {
      return {
        edgeWidth: 3,
        edge: "#222b2b",
        base: "#3e4646",
        texture: "rgba(232,222,190,0.11)",
        textureDash: [8, 18],
        center: null
      };
    }

    if (highway === "tertiary" || highway === "residential") {
      return {
        edgeWidth: 4,
        edge: "#20292b",
        base: "#434c4d",
        texture: "rgba(235,225,184,0.13)",
        textureDash: [12, 20],
        center: "rgba(238,226,180,0.18)"
      };
    }

    return {
      edgeWidth: 4,
      edge: "#1f282a",
      base: "#485052",
      texture: "rgba(235,225,184,0.15)",
      textureDash: [14, 20],
      center: "rgba(238,226,180,0.2)"
    };
  }

  function routeStyleForPath(path) {
    const highway = path.tags?.highway || "";
    if (highway === "footway" || highway === "path") {
      return {
        grassWidth: 6,
        edgeWidth: 2,
        grassEdge: "rgba(45,78,47,0.42)",
        edge: "#716f5f",
        base: "#afa78a",
        texture: "rgba(255,244,205,0.12)"
      };
    }

    return {
      grassWidth: 5,
      edgeWidth: 2,
      grassEdge: "rgba(45,78,47,0.34)",
      edge: "#6d715f",
      base: "#b9b096",
      texture: "rgba(255,244,205,0.1)"
    };
  }

  function drawBuilding(building) {
    const points = building.coordinates || rectPoints(building);
    const style = buildingStyle(building);
    const facade = facadeForBuilding(points);

    drawRoofShadow(points, style);
    drawFacadeShadow(facade, style);
    drawFacadeWall(facade, style);
    drawPolygon(points, style.roof, style.outline);
    drawRoofShading(points, style);
    drawRoofStripes(points, style);
    drawTopHighlight(points, style);
    drawBuildingDoor(building, facade);
    drawFacadeWindows(building, facade, style);
    drawRoofTrim(points, facade, style);

    if (DEBUG_BUILDINGS && facade) {
      drawDebugFacade(facade);
    }
  }

  function drawPark(park) {
    drawPolygon(park.coordinates || rectPoints(park), "#326b43", "rgba(211,237,177,0.16)");
  }

  function drawWater(water) {
    drawPolygon(water.coordinates || rectPoints(water), "#375f70", "rgba(209,233,236,0.22)");
  }

  function drawLandmark(landmark) {
    const point = worldToScreen(landmark.x, landmark.y);
    ctx.fillStyle = "#111817";
    circle(point.x, point.y, worldSize(14));
    ctx.strokeStyle = "#f0b86d";
    ctx.lineWidth = worldSize(3);
    ctx.stroke();
    ctx.fillStyle = "#f0b86d";
    circle(point.x, point.y, worldSize(5));
  }

  function drawPlayer() {
    const screenPlayer = worldToScreen(player.visualX, player.visualY);
    const playerW = worldSize(player.w);
    const playerH = worldSize(player.h);
    const bob = player.isMoving ? Math.sin(elapsedTime * 15) * worldSize(0.6) : Math.sin(elapsedTime * 4) * worldSize(0.35);
    const x = screenPlayer.x;
    const y = screenPlayer.y + bob;

    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.46)";
    ctx.beginPath();
    ctx.ellipse(x + worldSize(2), y + playerH * 0.48, playerW * 0.55, worldSize(4.5), 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#111817";
    ctx.fillRect(x - playerW / 2 - worldSize(1.5), y - playerH / 2 - worldSize(1.5), playerW + worldSize(3), playerH + worldSize(3));
    ctx.fillStyle = "#fff0cf";
    ctx.fillRect(x - playerW / 2, y - playerH / 2, playerW, playerH);
    ctx.fillStyle = "#263b45";
    ctx.fillRect(x - playerW / 2 + worldSize(2), y - playerH / 2 + worldSize(4), playerW - worldSize(4), worldSize(6));
    ctx.fillStyle = "#161f22";
    ctx.fillRect(x - playerW / 2 + worldSize(3), y - playerH / 2 + worldSize(2), playerW - worldSize(6), worldSize(2));
    ctx.fillStyle = "#f0b86d";
    ctx.fillRect(x - worldSize(2), y - playerH / 2 + worldSize(11), worldSize(4), worldSize(3));
    ctx.restore();

    if (DEBUG_BUILDINGS) {
      const feet = worldToScreen(playerFeet().x, playerFeet().y);
      ctx.strokeStyle = "rgba(255,210,70,0.8)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(feet.x, feet.y, worldSize(PLAYER_COLLISION_RADIUS), 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawMinimap() {
    if (!showMinimap || !map) return;

    const panelX = canvas.width - MINIMAP_WIDTH - 16;
    const panelY = 16;
    const scale = Math.min(
      (MINIMAP_WIDTH - MINIMAP_PADDING * 2) / map.world.width,
      (MINIMAP_HEIGHT - MINIMAP_PADDING * 2) / map.world.height
    );
    const mapW = map.world.width * scale;
    const mapH = map.world.height * scale;
    const mapX = panelX + (MINIMAP_WIDTH - mapW) / 2;
    const mapY = panelY + (MINIMAP_HEIGHT - mapH) / 2;
    const miniState = { mapX, mapY, scale };

    ctx.save();
    ctx.fillStyle = "rgba(10,15,13,0.76)";
    ctx.fillRect(panelX, panelY, MINIMAP_WIDTH, MINIMAP_HEIGHT);
    ctx.strokeStyle = "rgba(239,202,132,0.34)";
    ctx.lineWidth = 1;
    ctx.strokeRect(panelX + 0.5, panelY + 0.5, MINIMAP_WIDTH - 1, MINIMAP_HEIGHT - 1);

    ctx.save();
    ctx.beginPath();
    ctx.rect(panelX + 1, panelY + 1, MINIMAP_WIDTH - 2, MINIMAP_HEIGHT - 2);
    ctx.clip();

    map.roads.forEach((road) => drawMiniRoute(road, miniState, "rgba(106,118,116,0.58)", 0.8));
    map.paths.forEach((path) => drawMiniRoute(path, miniState, "rgba(211,200,166,0.48)", 0.55));
    map.parks.forEach((park) => drawMiniPolygon(park.coordinates || rectPoints(park), miniState, "rgba(80,131,76,0.5)"));
    map.water.forEach((water) => drawMiniPolygon(water.coordinates || rectPoints(water), miniState, "rgba(70,118,138,0.66)"));
    map.buildings.forEach((building) => drawMiniPolygon(building.coordinates || rectPoints(building), miniState, "rgba(193,104,57,0.64)"));

    const viewport = {
      x: mapX + camera.x * scale,
      y: mapY + camera.y * scale,
      w: visibleWorldWidth() * scale,
      h: visibleWorldHeight() * scale
    };
    ctx.strokeStyle = "rgba(255,238,184,0.95)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(viewport.x, viewport.y, viewport.w, viewport.h);

    const playerMini = miniPoint(player.x, player.y, miniState);
    ctx.strokeStyle = "#111817";
    ctx.lineWidth = 2;
    ctx.fillStyle = "#f7ead2";
    circle(playerMini.x, playerMini.y, 4.5);
    ctx.stroke();
    ctx.fillStyle = "#f0b86d";
    circle(playerMini.x, playerMini.y, 2);
    ctx.restore();

    ctx.fillStyle = "rgba(245,234,210,0.9)";
    ctx.font = "700 10px Inter, ui-sans-serif, system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("M", panelX + 7, panelY + 6);
    ctx.restore();
  }

  function drawMiniRoute(route, miniState, color, width) {
    const points = route.points || [];
    if (points.length < 2) return;

    const first = miniPoint(points[0].x, points[0].y, miniState);
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(first.x, first.y);
    for (let i = 1; i < points.length; i += 1) {
      const p = miniPoint(points[i].x, points[i].y, miniState);
      ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawMiniPolygon(points, miniState, fillStyle) {
    if (!points || points.length < 3) return;

    const first = miniPoint(points[0].x, points[0].y, miniState);
    ctx.save();
    ctx.fillStyle = fillStyle;
    ctx.beginPath();
    ctx.moveTo(first.x, first.y);
    for (let i = 1; i < points.length; i += 1) {
      const p = miniPoint(points[i].x, points[i].y, miniState);
      ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function miniPoint(x, y, miniState) {
    return {
      x: miniState.mapX + x * miniState.scale,
      y: miniState.mapY + y * miniState.scale
    };
  }

  function roofColorForBuilding(building) {
    const text = `${building.name || ""} ${building.id || ""}`.toLowerCase();
    if (text.includes("residence") || text.includes("hall")) return "#3b2b24";
    if (text.includes("gym") || text.includes("field") || text.includes("sport")) return "#33383a";
    if (text.includes("library") || text.includes("center") || text.includes("science")) return "#2f3535";
    return "#3a2c25";
  }

  function buildingStyle(building) {
    const seed = seededUnit(building.id || building.name || "building");
    const roof = adjustHexColor(roofColorForBuilding(building), Math.round(seed * 18 - 8));
    const text = `${building.name || ""} ${building.tags?.building || ""}`.toLowerCase();
    const isLandmark = Boolean(building.label) || /center|science|auditorium|gym|fitness|library|university/.test(text);
    const facadeBase = text.includes("residence") || text.includes("hall") ? "#b9875f" : "#c39a66";

    return {
      roof,
      roofStripe: seed > 0.5 ? "rgba(229,117,62,0.58)" : "rgba(196,89,51,0.5)",
      roofStripeAlt: "rgba(255,199,124,0.2)",
      roofShade: seed > 0.5 ? "rgba(33,19,14,0.18)" : "rgba(255,210,142,0.08)",
      facade: adjustHexColor(facadeBase, Math.round(seed * 18 - 9)),
      facadeLine: "rgba(255,237,190,0.18)",
      trim: isLandmark ? "rgba(255,219,139,0.62)" : "rgba(245,197,121,0.44)",
      bottomTrim: "rgba(55,31,22,0.68)",
      outline: isLandmark ? "rgba(255,232,176,0.58)" : "rgba(91,45,28,0.68)",
      shadow: seed > 0.6 ? "rgba(0,0,0,0.26)" : "rgba(0,0,0,0.2)",
      window: seed > 0.45 ? "#1c1513" : "#242016",
      windowTrim: "rgba(255,226,160,0.38)",
      windowSpacing: isLandmark ? 27 : seed > 0.5 ? 35 : 42,
      columnEvery: isLandmark ? 3 : 0
    };
  }

  function drawRoofShadow(points, style) {
    drawPolygon(offsetPoints(points, 3, 4), style.shadow);
  }

  function drawRoofShading(points, style) {
    const bounds = boundsFromPoints(points);
    ctx.save();
    clipToPolygon(points);
    ctx.fillStyle = style.roofShade;
    const first = worldToScreen(bounds.x, bounds.y + bounds.h * 0.58);
    ctx.fillRect(first.x, first.y, worldSize(bounds.w), worldSize(bounds.h * 0.42));
    ctx.restore();
  }

  function drawRoofStripes(points, style) {
    const bounds = boundsFromPoints(points);
    const screenStart = worldToScreen(bounds.x - bounds.h, bounds.y);
    const screenEnd = worldToScreen(bounds.x + bounds.w + bounds.h, bounds.y + bounds.h);

    ctx.save();
    clipToPolygon(points);
    ctx.strokeStyle = style.roofStripe;
    ctx.lineWidth = worldSize(1);

    for (let y = screenStart.y - worldSize(bounds.w); y < screenEnd.y + worldSize(bounds.w); y += worldSize(BUILDING_ROOF_STRIPE_SPACING)) {
      ctx.beginPath();
      ctx.moveTo(screenStart.x - worldSize(40), y);
      ctx.lineTo(screenEnd.x + worldSize(40), y + worldSize(bounds.w * 0.12));
      ctx.stroke();
    }

    ctx.strokeStyle = style.roofStripeAlt;
    for (let y = screenStart.y - worldSize(bounds.w) + worldSize(BUILDING_ROOF_STRIPE_SPACING / 2); y < screenEnd.y + worldSize(bounds.w); y += worldSize(BUILDING_ROOF_STRIPE_SPACING * 2)) {
      ctx.beginPath();
      ctx.moveTo(screenStart.x - worldSize(40), y);
      ctx.lineTo(screenEnd.x + worldSize(40), y + worldSize(bounds.w * 0.12));
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawTopHighlight(points, style) {
    const edges = directionalEdges(points, "top");
    ctx.save();
    ctx.strokeStyle = style.trim;
    ctx.lineWidth = worldSize(2);
    ctx.lineCap = "round";
    edges.forEach((edge) => drawWorldSegment(edge.a, edge.b));
    ctx.restore();
  }

  function drawRoofTrim(points, facade, style) {
    ctx.save();
    ctx.strokeStyle = style.bottomTrim;
    ctx.lineWidth = worldSize(3);
    ctx.lineCap = "round";
    if (facade) {
      drawWorldSegment(facade.edge.a, facade.edge.b);
    } else {
      directionalEdges(points, "bottom").forEach((edge) => drawWorldSegment(edge.a, edge.b));
    }
    ctx.restore();
  }

  function drawFacadeShadow(facade, style) {
    if (!facade) return;

    drawPolygon(
      offsetPoints(facade.polygon, 3, BUILDING_SHADOW_DEPTH),
      style.shadow
    );
  }

  function drawFacadeWall(facade, style) {
    if (!facade) return;

    drawPolygon(facade.polygon, style.facade, "rgba(65,39,25,0.58)");

    ctx.save();
    ctx.strokeStyle = style.facadeLine;
    ctx.lineWidth = worldSize(1);
    for (let i = 1; i <= 3; i += 1) {
      const t = i / 4;
      drawWorldSegment(
        lerpPoint(facade.topA, facade.bottomA, t),
        lerpPoint(facade.topB, facade.bottomB, t)
      );
    }
    if (style.columnEvery && facade.length > 82) {
      ctx.strokeStyle = "rgba(255,234,185,0.24)";
      ctx.lineWidth = worldSize(1.5);
      const columns = Math.min(6, Math.floor(facade.length / 52));
      for (let i = 1; i <= columns; i += 1) {
        const t = i / (columns + 1);
        drawWorldSegment(facadePoint(facade, t, 0.16), facadePoint(facade, t, 0.92));
      }
    }

    ctx.strokeStyle = style.trim;
    ctx.lineWidth = worldSize(1.5);
    drawWorldSegment(facade.topA, facade.topB);
    ctx.strokeStyle = style.bottomTrim;
    ctx.lineWidth = worldSize(2);
    drawWorldSegment(facade.bottomA, facade.bottomB);
    ctx.restore();
  }

  function drawFacadeWindows(building, facade, style) {
    if (!facade || facade.length < 44) return;

    const count = Math.min(18, Math.max(1, Math.floor(facade.length / style.windowSpacing)));
    const fallbackDoorT = building.useFallbackDoor ? building.fallbackDoorT : null;

    ctx.save();
    ctx.fillStyle = style.window;
    ctx.strokeStyle = style.windowTrim;
    ctx.lineWidth = worldSize(1);
    const windowW = worldSize(WINDOW_WIDTH);
    const windowH = worldSize(WINDOW_HEIGHT);

    for (let i = 1; i <= count; i += 1) {
      const t = i / (count + 1);
      if (fallbackDoorT !== null && Math.abs(t - fallbackDoorT) < 0.11) continue;

      const center = facadePoint(facade, t, facade.depth > 15 ? 0.48 : 0.54);
      const p = worldToScreen(center.x, center.y);
      ctx.fillRect(p.x - windowW / 2, p.y - windowH / 2, windowW, windowH);
      ctx.strokeRect(p.x - windowW / 2, p.y - windowH / 2, windowW, windowH);
    }

    ctx.restore();
  }

  function drawBuildingDoor(building, facade) {
    const center = buildingDoorPoint(building, facade);
    if (!center) return;

    const p = worldToScreen(center.x, center.y);
    const isRealEntrance = building.realEntrances && building.realEntrances.length > 0;
    const doorW = worldSize(isRealEntrance ? DOOR_WIDTH : DOOR_WIDTH * 0.86);
    const doorH = worldSize(isRealEntrance ? DOOR_HEIGHT : DOOR_HEIGHT * 0.9);

    ctx.save();
    ctx.fillStyle = isRealEntrance ? "#0b0706" : "#18100e";
    ctx.fillRect(p.x - doorW / 2, p.y - doorH / 2, doorW, doorH);
    ctx.strokeStyle = isRealEntrance ? "rgba(255,214,152,0.5)" : "rgba(255,205,138,0.32)";
    ctx.lineWidth = worldSize(1);
    ctx.strokeRect(p.x - doorW / 2, p.y - doorH / 2, doorW, doorH);

    if (DEBUG_DOORS) {
      ctx.strokeStyle = building.realEntrances?.length ? "rgba(116,220,255,0.9)" : "rgba(255,210,80,0.9)";
      ctx.lineWidth = worldSize(2);
      ctx.strokeRect(p.x - doorW / 2 - worldSize(3), p.y - doorH / 2 - worldSize(3), doorW + worldSize(6), doorH + worldSize(6));
    }

    ctx.restore();
  }

  function buildingDoorPoint(building, facade) {
    if (building.realEntrances && building.realEntrances.length > 0) {
      return {
        x: building.realEntrances[0].x,
        y: building.realEntrances[0].y
      };
    }

    if (!building.useFallbackDoor || !facade) {
      return null;
    }

    return facadePoint(facade, building.fallbackDoorT || 0.5, 0.72);
  }

  function drawBuildingLabel(building) {
    if (!building.showLabel || !building.label) return;

    const bounds = boundsForFeature(building);
    const labelX = bounds.x + bounds.w / 2;
    const labelY = bounds.h >= 42 ? bounds.y + Math.min(24, bounds.h * 0.35) : bounds.y - 10;
    const p = worldToScreen(labelX, labelY);
    const playerScreen = worldToScreen(player.visualX, player.visualY);

    ctx.save();
    ctx.font = "700 10px Inter, ui-sans-serif, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const text = ellipsizeText(building.label, 188);
    const width = Math.min(198, ctx.measureText(text).width + 10);
    const height = 15;
    const labelRect = {
      x: p.x - width / 2,
      y: p.y - height / 2,
      w: width,
      h: height
    };

    if (pointInScreenRect(playerScreen, labelRect, worldSize(10))) {
      ctx.restore();
      return;
    }

    ctx.shadowColor = "rgba(0,0,0,0.55)";
    ctx.shadowBlur = 5;
    ctx.shadowOffsetY = 1;
    ctx.fillStyle = "rgba(13,18,16,0.54)";
    ctx.fillRect(labelRect.x, labelRect.y, labelRect.w, labelRect.h);
    ctx.shadowColor = "transparent";
    ctx.strokeStyle = "rgba(244,216,160,0.16)";
    ctx.lineWidth = 1;
    ctx.strokeRect(labelRect.x, labelRect.y, labelRect.w, labelRect.h);
    ctx.fillStyle = "rgba(247,235,205,0.9)";
    ctx.fillText(text, p.x, p.y + 0.5, width - 8);
    ctx.restore();
  }

  function ellipsizeText(text, maxWidth) {
    if (ctx.measureText(text).width <= maxWidth) {
      return text;
    }

    let result = text;
    while (result.length > 4 && ctx.measureText(`${result}...`).width > maxWidth) {
      result = result.slice(0, -1);
    }
    return `${result.trimEnd()}...`;
  }

  function pointInScreenRect(point, rect, padding = 0) {
    return point.x >= rect.x - padding &&
      point.x <= rect.x + rect.w + padding &&
      point.y >= rect.y - padding &&
      point.y <= rect.y + rect.h + padding;
  }

  function drawEntranceDebug(entrance) {
    const p = worldToScreen(entrance.x, entrance.y);

    ctx.save();
    ctx.fillStyle = "rgba(116,220,255,0.78)";
    circle(p.x, p.y, worldSize(4));
    ctx.strokeStyle = "rgba(7,20,28,0.8)";
    ctx.lineWidth = worldSize(1);
    ctx.stroke();
    ctx.restore();
  }

  function drawDebugFacade(facade) {
    const door = facadePoint(facade, 0.5, 0.72);
    const p = worldToScreen(door.x, door.y);
    ctx.save();
    ctx.strokeStyle = "rgba(255,230,80,0.9)";
    ctx.lineWidth = worldSize(2);
    drawPolygon(facade.polygon, "rgba(255,230,80,0.10)", "rgba(255,230,80,0.8)");
    ctx.fillStyle = "rgba(255,230,80,0.9)";
    circle(p.x, p.y, worldSize(3));
    ctx.restore();
  }

  function facadeForBuilding(points) {
    const edge = southFacadeEdgeForBuilding(points);
    if (!edge) return null;

    const wallDepth = wallDepthForBuilding(points);
    const bounds = boundsFromPoints(points);
    let left = Math.min(edge.a.x, edge.b.x);
    let right = Math.max(edge.a.x, edge.b.x);
    const minFacadeWidth = Math.min(bounds.w, 36);

    if (right - left < minFacadeWidth) {
      const centerX = (left + right) / 2;
      left = Math.max(bounds.x, centerX - minFacadeWidth / 2);
      right = Math.min(bounds.x + bounds.w, centerX + minFacadeWidth / 2);
    }

    const topY = Math.max(
      edge.a.y,
      edge.b.y,
      bounds.y + bounds.h * 0.72
    );

    const polygon = [
      { x: left, y: topY },
      { x: right, y: topY },
      { x: right, y: topY + wallDepth },
      { x: left, y: topY + wallDepth }
    ];

    return {
      edge,
      polygon,
      topA: polygon[0],
      topB: polygon[1],
      bottomB: polygon[2],
      bottomA: polygon[3],
      length: right - left,
      depth: wallDepth
    };
  }

  function wallDepthForBuilding(points) {
    const bounds = boundsFromPoints(points);
    return Math.max(10, Math.min(20, Math.round(Math.min(bounds.w, bounds.h) * 0.13) || BUILDING_WALL_DEPTH));
  }

  function southFacadeEdgeForBuilding(points) {
    let best = null;
    const bounds = boundsFromPoints(points);

    for (let i = 0; i < points.length; i += 1) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      const length = distance(a, b);
      if (length < 24) continue;

      const mid = midpoint(a, b);
      const dx = Math.abs(b.x - a.x);
      const dy = Math.abs(b.y - a.y);
      const horizontalness = dx / Math.max(1, length);
      const bottomness = mid.y - bounds.y;
      const score = bottomness + horizontalness * 160 + Math.min(length, 180) * 0.08 - dy * 0.35;
      if (!best || score > best.score) {
        best = {
          a,
          b,
          mid,
          length,
          score
        };
      }
    }

    if (!best) {
      return {
        a: { x: bounds.x, y: bounds.y + bounds.h },
        b: { x: bounds.x + bounds.w, y: bounds.y + bounds.h },
        mid: { x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h },
        length: bounds.w,
        score: 0
      };
    }

    return best;
  }

  function facadePoint(facade, along, down) {
    const top = lerpPoint(facade.topA, facade.topB, along);
    const bottom = lerpPoint(facade.bottomA, facade.bottomB, along);
    return lerpPoint(top, bottom, down);
  }

  function lerpPoint(a, b, t) {
    return {
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t
    };
  }

  function pointToSegmentDistance(point, a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lengthSq = dx * dx + dy * dy;
    if (lengthSq === 0) return distance(point, a);

    const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSq));
    return distance(point, {
      x: a.x + dx * t,
      y: a.y + dy * t
    });
  }

  function distanceToPolygon(point, polygon) {
    if (!polygon || polygon.length < 3) return Infinity;
    if (pointInPolygon(point, polygon)) return 0;

    let best = Infinity;
    for (let i = 0; i < polygon.length; i += 1) {
      best = Math.min(best, pointToSegmentDistance(point, polygon[i], polygon[(i + 1) % polygon.length]));
    }
    return best;
  }

  function distanceToRoutes(point, routes) {
    let best = Infinity;

    routes.forEach((route) => {
      const points = route.points || [];
      for (let i = 1; i < points.length; i += 1) {
        best = Math.min(best, pointToSegmentDistance(point, points[i - 1], points[i]));
      }
    });

    return best;
  }

  function directionalEdges(points, side) {
    const bounds = boundsFromPoints(points);
    const threshold = side === "top"
      ? bounds.y + bounds.h * 0.45
      : bounds.y + bounds.h * 0.55;

    const edges = [];
    for (let i = 0; i < points.length; i += 1) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      const midY = (a.y + b.y) / 2;
      if ((side === "top" && midY <= threshold) || (side === "bottom" && midY >= threshold)) {
        edges.push({ a, b });
      }
    }
    return edges;
  }

  function drawPolyline(points, width, color, dashed = false) {
    if (!points || points.length < 2) return;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = width * camera.zoom;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.setLineDash(dashed ? [18, 14] : []);
    const first = worldToScreen(points[0].x, points[0].y);
    ctx.beginPath();
    ctx.moveTo(first.x, first.y);
    for (let i = 1; i < points.length; i += 1) {
      const p = worldToScreen(points[i].x, points[i].y);
      ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawPolygon(points, fillStyle, strokeStyle) {
    if (!points || points.length < 3) return;

    const first = worldToScreen(points[0].x, points[0].y);
    ctx.save();
    ctx.fillStyle = fillStyle;
    ctx.strokeStyle = strokeStyle || "transparent";
    ctx.lineWidth = worldSize(2);
    ctx.beginPath();
    ctx.moveTo(first.x, first.y);
    for (let i = 1; i < points.length; i += 1) {
      const p = worldToScreen(points[i].x, points[i].y);
      ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
    ctx.fill();
    if (strokeStyle) ctx.stroke();
    ctx.restore();
  }

  function clipToPolygon(points) {
    if (!points || points.length < 3) return;

    const first = worldToScreen(points[0].x, points[0].y);
    ctx.beginPath();
    ctx.moveTo(first.x, first.y);
    for (let i = 1; i < points.length; i += 1) {
      const p = worldToScreen(points[i].x, points[i].y);
      ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
    ctx.clip();
  }

  function drawWorldSegment(a, b) {
    const start = worldToScreen(a.x, a.y);
    const end = worldToScreen(b.x, b.y);
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
  }

  function drawScreenRect(x, y, w, h, color) {
    const p = worldToScreen(x, y);
    ctx.fillStyle = color;
    ctx.fillRect(p.x, p.y, w * camera.zoom, h * camera.zoom);
  }

  function boundsForFeature(feature) {
    if (feature.bounds) {
      return feature.bounds;
    }

    if (feature.coordinates && feature.coordinates.length) {
      return boundsFromPoints(feature.coordinates);
    }

    return {
      x: feature.x,
      y: feature.y,
      w: feature.w,
      h: feature.h
    };
  }

  function collisionPolygonForFeature(feature) {
    if (feature.coordinates && feature.coordinates.length >= 3) {
      return feature.coordinates;
    }

    return rectPoints(feature);
  }

  function rectPoints(rect) {
    return [
      { x: rect.x, y: rect.y },
      { x: rect.x + rect.w, y: rect.y },
      { x: rect.x + rect.w, y: rect.y + rect.h },
      { x: rect.x, y: rect.y + rect.h }
    ];
  }

  function offsetPoints(points, dx, dy) {
    return points.map((point) => ({ x: point.x + dx, y: point.y + dy }));
  }

  function boundsFromPoints(points) {
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    return {
      x: minX,
      y: minY,
      w: Math.max(1, maxX - minX),
      h: Math.max(1, maxY - minY)
    };
  }

  function polygonArea(points) {
    if (!points || points.length < 3) return 0;

    let area = 0;
    for (let i = 0; i < points.length; i += 1) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      area += a.x * b.y - b.x * a.y;
    }
    return Math.abs(area) / 2;
  }

  function centerOfBounds(bounds) {
    if (!bounds) return null;
    return {
      x: bounds.x + bounds.w / 2,
      y: bounds.y + bounds.h / 2
    };
  }

  function playerFeet() {
    return playerFeetAt(player.x, player.y);
  }

  function playerFeetAt(x, y) {
    return {
      x,
      y: y + player.h * 0.35
    };
  }

  function playerRectAt(x, y) {
    const feet = playerFeetAt(x, y);
    return {
      x: feet.x - PLAYER_COLLISION_RADIUS,
      y: feet.y - PLAYER_COLLISION_RADIUS,
      w: PLAYER_COLLISION_RADIUS * 2,
      h: PLAYER_COLLISION_RADIUS * 2
    };
  }

  function rectHitsAny(rect, rects) {
    return rects.some((solid) => rectsIntersect(rect, solid));
  }

  function circleIntersectsPolygon(center, radius, polygon) {
    if (!polygon || polygon.length < 3) return false;
    if (pointInPolygon(center, polygon)) return true;

    for (let i = 0; i < polygon.length; i += 1) {
      const a = polygon[i];
      const b = polygon[(i + 1) % polygon.length];
      if (pointToSegmentDistance(center, a, b) <= radius) {
        return true;
      }
    }

    return false;
  }

  function pointInPolygon(point, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
      const a = polygon[i];
      const b = polygon[j];
      const crosses = (a.y > point.y) !== (b.y > point.y) &&
        point.x < ((b.x - a.x) * (point.y - a.y)) / ((b.y - a.y) || 1) + a.x;
      if (crosses) inside = !inside;
    }
    return inside;
  }

  function rectsIntersect(a, b) {
    return a.x < b.x + b.w &&
      a.x + a.w > b.x &&
      a.y < b.y + b.h &&
      a.y + a.h > b.y;
  }

  function line(x1, y1, x2, y2) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  function circle(x, y, radius) {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  function midpoint(a, b) {
    return {
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2
    };
  }

  function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function seededUnit(seed) {
    const text = String(seed);
    let hash = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return ((hash >>> 0) % 10000) / 10000;
  }

  function adjustHexColor(hex, amount) {
    const normalized = hex.replace("#", "");
    const number = Number.parseInt(normalized, 16);
    const r = clamp(((number >> 16) & 255) + amount, 0, 255);
    const g = clamp(((number >> 8) & 255) + amount, 0, 255);
    const b = clamp((number & 255) + amount, 0, 255);
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  function toHex(value) {
    return Math.round(value).toString(16).padStart(2, "0");
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(value, max));
  }

  function setText(element, text) {
    if (element) {
      element.textContent = text;
    }
  }
})();
