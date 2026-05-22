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
  const DEBUG_LABELS = true;
  const DEBUG_DOORS = false;
  const DEBUG_ENTRANCES = false;
  const PLAYER_COLLISION_RADIUS = 8;
  const BUILDING_WALL_DEPTH = 18;
  const BUILDING_SHADOW_DEPTH = 6;
  const BUILDING_ROOF_STRIPE_SPACING = 8;
  const DOOR_WIDTH = 10;
  const DOOR_HEIGHT = 14;
  const WINDOW_WIDTH = 6;
  const WINDOW_HEIGHT = 5;
  const EXPECTED_SOURCE = "map_data/plu_map-true.osm";
  const keys = new Set();

  let map = null;
  let mapBounds = null;
  let collisionPolygons = [];
  let cameraClampLogged = false;

  const player = {
    x: 0,
    y: 0,
    w: 16,
    h: 20,
    speed: 180,
    color: "#f4ead0"
  };

  const camera = {
    x: 0,
    y: 0,
    zoom: 1
  };

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

    console.log("[OSM Walking QA] active map source filename:", map.sourceFile);
    console.log("[OSM Walking QA] active map summary:", {
      world: map.world,
      roads: map.roads.length,
      paths: map.paths.length,
      buildings: map.buildings.length,
      parks: map.parks.length,
      water: map.water.length,
      landmarks: map.landmarks.length,
      namedBuildings: map.stats.namedBuildings,
      realEntranceNodes: map.stats.realEntranceNodes,
      attachedEntranceNodes: map.stats.attachedEntranceNodes,
      generatedFallbackDoors: map.stats.generatedFallbackDoors
    });
    console.log("[OSM Walking QA] building/door QA:", map.stats);
    if (map.stats.realEntranceNodes === 0) {
      console.info("[OSM Walking QA] No real OSM entrance nodes found; doors are generated fallback.");
    }

    setText(ui.source, map.sourceFile);
    setText(ui.stats, `named ${map.stats.namedBuildings} | entrances ${map.stats.realEntranceNodes} | fallback doors ${map.stats.generatedFallbackDoors}`);
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

    const roads = (gameMap.roads || []).map((feature) => routeFromGenerated(feature, 34)).filter(Boolean);
    const paths = (gameMap.paths || []).map((feature) => routeFromGenerated(feature, 18)).filter(Boolean);
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
        realEntranceNodes: realEntrances.length,
        attachedEntranceNodes: doorStats.attachedEntranceNodes,
        generatedFallbackDoors: doorStats.generatedFallbackDoors
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
        realEntranceNodes: 0,
        attachedEntranceNodes: 0,
        generatedFallbackDoors: 0
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

  function routeFromGenerated(feature, fallbackWidth) {
    const points = (feature.coordinates || [])
      .map((point) => ({ x: Number(point.x), y: Number(point.y) }))
      .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));

    if (points.length < 2) return null;

    return {
      id: feature.id,
      name: feature.name,
      type: feature.type,
      tags: feature.tags || {},
      width: feature.tags?.highway === "pedestrian" ? Math.max(fallbackWidth, 26) : fallbackWidth,
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

    return isImportant || area >= 9000 || (bounds.w >= 72 && bounds.h >= 48);
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

    if (dx !== 0 || dy !== 0) {
      const length = Math.hypot(dx, dy);
      dx /= length;
      dy /= length;

      const step = player.speed * dt;
      movePlayer(dx * step, 0);
      movePlayer(0, dy * step);
    }

    updateCamera();
    updateHud();
  }

  function updateCamera() {
    camera.x = player.x - canvas.width / 2;
    camera.y = player.y - canvas.height / 2;

    if (mapBounds) {
      camera.x = Math.max(mapBounds.minX, Math.min(camera.x, mapBounds.maxX - canvas.width));
      camera.y = Math.max(mapBounds.minY, Math.min(camera.y, mapBounds.maxY - canvas.height));
    }

    camera.x = Math.max(0, camera.x);
    camera.y = Math.max(0, camera.y);

    if (!cameraClampLogged && camera.y === 0 && player.y < canvas.height / 2) {
      console.log("[OSM Walking QA] camera y is clamped to 0 because the player is near the northern map edge.", {
        playerY: Math.round(player.y),
        cameraY: Math.round(camera.y),
        canvasHalfHeight: Math.round(canvas.height / 2)
      });
      cameraClampLogged = true;
    }
  }

  function worldToScreen(x, y) {
    return {
      x: (x - camera.x) * camera.zoom,
      y: (y - camera.y) * camera.zoom
    };
  }

  function updateHud() {
    setText(ui.position, `player ${Math.round(player.x)}, ${Math.round(player.y)}`);
    setText(ui.camera, `camera ${Math.round(camera.x)}, ${Math.round(camera.y)}`);
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
    drawPolyline(road.points, road.width + 8, "#2b3335");
    drawPolyline(road.points, road.width, "#4a5355");
    drawPolyline(road.points, 2, "rgba(235,225,184,0.35)", true);
  }

  function drawPath(path) {
    drawPolyline(path.points, path.width + 4, "#5f6659");
    drawPolyline(path.points, path.width, "#b7ad91");
  }

  function drawBuilding(building) {
    const points = building.coordinates || rectPoints(building);
    const roofColor = roofColorForBuilding(building);
    const facade = facadeForBuilding(points);

    drawFacadeShadow(facade);
    drawFacadeWall(facade);
    drawPolygon(points, roofColor, "rgba(246,234,196,0.48)");
    drawRoofStripes(points);
    drawTopHighlight(points);
    drawBuildingDoor(building, facade);
    drawFacadeWindows(building, facade);
    drawRoofTrim(points, facade);

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
    circle(point.x, point.y, 14);
    ctx.strokeStyle = "#f0b86d";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = "#f0b86d";
    circle(point.x, point.y, 5);
  }

  function drawPlayer() {
    const screenPlayer = worldToScreen(player.x, player.y);
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.fillRect(screenPlayer.x - player.w / 2 + 3, screenPlayer.y - player.h / 2 + 4, player.w, player.h);

    ctx.fillStyle = player.color;
    ctx.fillRect(screenPlayer.x - player.w / 2, screenPlayer.y - player.h / 2, player.w, player.h);
    ctx.fillStyle = "#394340";
    ctx.fillRect(screenPlayer.x - player.w / 2 + 3, screenPlayer.y - player.h / 2 + 5, player.w - 6, 5);

    if (DEBUG_BUILDINGS) {
      const feet = worldToScreen(playerFeet().x, playerFeet().y);
      ctx.strokeStyle = "rgba(255,210,70,0.8)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(feet.x, feet.y, PLAYER_COLLISION_RADIUS, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function roofColorForBuilding(building) {
    const text = `${building.name || ""} ${building.id || ""}`.toLowerCase();
    if (text.includes("residence") || text.includes("hall")) return "#3b2b24";
    if (text.includes("gym") || text.includes("field") || text.includes("sport")) return "#33383a";
    if (text.includes("library") || text.includes("center") || text.includes("science")) return "#2f3535";
    return "#3a2c25";
  }

  function drawRoofStripes(points) {
    const bounds = boundsFromPoints(points);
    const screenStart = worldToScreen(bounds.x - bounds.h, bounds.y);
    const screenEnd = worldToScreen(bounds.x + bounds.w + bounds.h, bounds.y + bounds.h);

    ctx.save();
    clipToPolygon(points);
    ctx.strokeStyle = "rgba(224,102,55,0.42)";
    ctx.lineWidth = 1;

    for (let y = screenStart.y - bounds.w; y < screenEnd.y + bounds.w; y += BUILDING_ROOF_STRIPE_SPACING) {
      ctx.beginPath();
      ctx.moveTo(screenStart.x - 40, y);
      ctx.lineTo(screenEnd.x + 40, y + bounds.w * 0.12);
      ctx.stroke();
    }

    ctx.strokeStyle = "rgba(255,196,123,0.16)";
    for (let y = screenStart.y - bounds.w + BUILDING_ROOF_STRIPE_SPACING / 2; y < screenEnd.y + bounds.w; y += BUILDING_ROOF_STRIPE_SPACING * 2) {
      ctx.beginPath();
      ctx.moveTo(screenStart.x - 40, y);
      ctx.lineTo(screenEnd.x + 40, y + bounds.w * 0.12);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawTopHighlight(points) {
    const edges = directionalEdges(points, "top");
    ctx.save();
    ctx.strokeStyle = "rgba(255,229,174,0.36)";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    edges.forEach((edge) => drawWorldSegment(edge.a, edge.b));
    ctx.restore();
  }

  function drawRoofTrim(points, facade) {
    ctx.save();
    ctx.strokeStyle = "rgba(106,49,28,0.78)";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    if (facade) {
      drawWorldSegment(facade.edge.a, facade.edge.b);
    } else {
      directionalEdges(points, "bottom").forEach((edge) => drawWorldSegment(edge.a, edge.b));
    }
    ctx.restore();
  }

  function drawFacadeShadow(facade) {
    if (!facade) return;

    drawPolygon(
      offsetPoints(facade.polygon, 4, BUILDING_SHADOW_DEPTH),
      "rgba(0,0,0,0.30)"
    );
  }

  function drawFacadeWall(facade) {
    if (!facade) return;

    drawPolygon(facade.polygon, "#d1aa70", "rgba(80,44,27,0.45)");

    ctx.save();
    ctx.strokeStyle = "rgba(255,238,184,0.26)";
    ctx.lineWidth = 1;
    for (let i = 1; i <= 3; i += 1) {
      const t = i / 4;
      drawWorldSegment(
        lerpPoint(facade.topA, facade.bottomA, t),
        lerpPoint(facade.topB, facade.bottomB, t)
      );
    }
    ctx.restore();
  }

  function drawFacadeWindows(building, facade) {
    if (!facade || facade.length < 36) return;

    const count = Math.min(10, Math.max(1, Math.floor(facade.length / 38)));
    const fallbackDoorT = building.useFallbackDoor ? building.fallbackDoorT : null;

    ctx.save();
    ctx.fillStyle = "#231515";
    ctx.strokeStyle = "rgba(255,226,160,0.44)";
    ctx.lineWidth = 1;

    for (let i = 1; i <= count; i += 1) {
      const t = i / (count + 1);
      if (fallbackDoorT !== null && Math.abs(t - fallbackDoorT) < 0.13) continue;

      const center = facadePoint(facade, t, 0.5);
      const p = worldToScreen(center.x, center.y);
      ctx.fillRect(p.x - WINDOW_WIDTH / 2, p.y - WINDOW_HEIGHT / 2, WINDOW_WIDTH, WINDOW_HEIGHT);
      ctx.strokeRect(p.x - WINDOW_WIDTH / 2, p.y - WINDOW_HEIGHT / 2, WINDOW_WIDTH, WINDOW_HEIGHT);
    }

    ctx.restore();
  }

  function drawBuildingDoor(building, facade) {
    const center = buildingDoorPoint(building, facade);
    if (!center) return;

    const p = worldToScreen(center.x, center.y);

    ctx.save();
    ctx.fillStyle = "#0b0706";
    ctx.fillRect(p.x - DOOR_WIDTH / 2, p.y - DOOR_HEIGHT / 2, DOOR_WIDTH, DOOR_HEIGHT);
    ctx.strokeStyle = "rgba(255,205,138,0.44)";
    ctx.lineWidth = 1;
    ctx.strokeRect(p.x - DOOR_WIDTH / 2, p.y - DOOR_HEIGHT / 2, DOOR_WIDTH, DOOR_HEIGHT);

    if (DEBUG_DOORS) {
      ctx.strokeStyle = building.realEntrances?.length ? "rgba(116,220,255,0.9)" : "rgba(255,210,80,0.9)";
      ctx.lineWidth = 2;
      ctx.strokeRect(p.x - DOOR_WIDTH / 2 - 3, p.y - DOOR_HEIGHT / 2 - 3, DOOR_WIDTH + 6, DOOR_HEIGHT + 6);
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
    const text = building.label;

    ctx.save();
    ctx.font = "700 11px Inter, ui-sans-serif, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const width = Math.min(220, ctx.measureText(text).width + 14);
    const height = 18;
    ctx.fillStyle = "rgba(12,16,15,0.82)";
    ctx.fillRect(p.x - width / 2, p.y - height / 2, width, height);
    ctx.strokeStyle = "rgba(240,184,109,0.34)";
    ctx.lineWidth = 1;
    ctx.strokeRect(p.x - width / 2, p.y - height / 2, width, height);
    ctx.fillStyle = "#f5ead2";
    ctx.fillText(text.length > 34 ? `${text.slice(0, 31)}...` : text, p.x, p.y + 0.5, width - 8);
    ctx.restore();
  }

  function drawEntranceDebug(entrance) {
    const p = worldToScreen(entrance.x, entrance.y);

    ctx.save();
    ctx.fillStyle = "rgba(116,220,255,0.78)";
    circle(p.x, p.y, 4);
    ctx.strokeStyle = "rgba(7,20,28,0.8)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  function drawDebugFacade(facade) {
    const door = facadePoint(facade, 0.5, 0.72);
    const p = worldToScreen(door.x, door.y);
    ctx.save();
    ctx.strokeStyle = "rgba(255,230,80,0.9)";
    ctx.lineWidth = 2;
    drawPolygon(facade.polygon, "rgba(255,230,80,0.10)", "rgba(255,230,80,0.8)");
    ctx.fillStyle = "rgba(255,230,80,0.9)";
    circle(p.x, p.y, 3);
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
    return Math.max(12, Math.min(24, Math.round(Math.min(bounds.w, bounds.h) * 0.16) || BUILDING_WALL_DEPTH));
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
    ctx.lineWidth = 2;
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

  function setText(element, text) {
    if (element) {
      element.textContent = text;
    }
  }
})();
