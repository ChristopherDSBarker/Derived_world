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
  const USE_TEXTURE_PACK = false;
  const ENVIRONMENT_PACK_BASE = "texture_maps/plu_world/plu_osm_environment_rules_v3";
  const ENVIRONMENT_PACK_FILES = {
    rules: `${ENVIRONMENT_PACK_BASE}/osm_environment_rules.json`,
    districts: `${ENVIRONMENT_PACK_BASE}/district_style_rules.json`,
    terrain: `${ENVIRONMENT_PACK_BASE}/terrain_autotile_spec_47blob.json`,
    shadows: `${ENVIRONMENT_PACK_BASE}/shadow_depth_layering_rules.json`
  };
  const FANTASY_NAME_MAPPINGS = [
    { match: /\bols[eo]n auditorium\b/i, name: "Bardic Assembly Hall" },
    { match: /\bmorken center\b/i, name: "Artifice Lecture Hall" },
    { match: /\bmary baker russel+l? music center\b/i, name: "Bardic Conservatory" },
    { match: /\brieke science center\b/i, name: "Alchemy Science Hall" },
    { match: /\bswimming pool\b/i, name: "Moonwater Sanctuary" },
    { match: /\bmemorial gymn?asium\b|\bnames fitness\b/i, name: "Knight Training Hall" },
    { match: /\bcarol sheffels quigg greenhouse\b/i, name: "Alchemy Conservatory" },
    { match: /\bkreidler residence hall\b/i, name: "North Lantern Lodge" },
    { match: /\bhinderlie residence hall\b/i, name: "Hearthward Lodge" },
    { match: /\bpflueger residence hall\b/i, name: "Rainstone Lodge" },
    { match: /\btinglestad residence hall\b/i, name: "Highwatch Lodge" },
    { match: /\bharstad residence hall\b/i, name: "Old Oak Lodge" },
    { match: /\bhong residence hall\b/i, name: "Moon Gate Lodge" },
    { match: /\bstuen residence hall\b/i, name: "Scribehouse Lodge" },
    { match: /\bordal residence hall\b/i, name: "Westward Lodge" },
    { match: /\bsouth residence hall\b/i, name: "Southwatch Lodge" },
    { match: /\banderson university center\b/i, name: "Guild Commons" },
    { match: /\bramstad hall\b/i, name: "Ramstad Scholar Hall" },
    { match: /\bxavier hall\b/i, name: "Xavier Archive Hall" },
    { match: /\bkaren hille phillips center\b/i, name: "Grand Bardic Theatre" },
    { match: /\bingram hall\b/i, name: "Ingram Atelier" },
    { match: /\bmortvedt library\b/i, name: "Mortvedt Grand Archive" },
    { match: /\bhauge administration\b/i, name: "Hauge Council Hall" },
    { match: /\bwang center\b/i, name: "Wayfarer Hall" },
    { match: /\bcolumbia center\b/i, name: "Columbia Academy" },
    { match: /\bkeck observatory\b/i, name: "Keck Star Tower" },
    { match: /\bmail services\b|\bshipping and receiving\b/i, name: "Courier Exchange" }
  ];
  const FANTASY_BUILDING_LABELS = [
    "Scholar Hall",
    "Adventurer Lodge",
    "Archive Hall",
    "Guild Annex",
    "Old Study House"
  ];
  const DISTRICT_FALLBACK_LABELS = {
    adventurer: ["Adventurer Lodge", "Student Lodge", "Wayfarer Hall", "Hearth Commons"],
    academy: ["Scholar Hall", "Archive Hall", "Runestone Academy", "Old Study Hall"],
    training: ["Training Hall", "Martial Hall", "Sparring Hall", "Knight Yard"],
    alchemy: ["Alchemy Conservatory", "Alchemy Hall", "Glassroot Laboratory", "Verdant Atelier"],
    sanctuary: ["Moonwater Sanctuary", "Sanctuary Hall", "Quietwater Chapel", "Moonlit Shrine"],
    merchant: ["Caravan Yard", "Market Plaza", "Wagon Court", "Guild Cart Yard"]
  };
  const PLU_STORY_LANDMARKS = [
    {
      id: "crimson-commons",
      sourceName: "Red Square & Centennial Bell",
      anchor: /red square/i,
      displayLabel: "Crimson Commons",
      subtitle: "Social Plaza",
      districtId: "academy",
      districtLabel: "Academy District",
      kind: "rune_bell",
      size: 72,
      props: ["lantern_hub", "lantern_hub", "market_stall", "market_stall", "notice_board", "bench", "bench", "planter"]
    },
    {
      id: "watchtower-collegium",
      sourceName: "Anderson Clock Tower",
      anchor: /anderson university center/i,
      displayLabel: "Watchtower of the Collegium",
      subtitle: "Central Meeting Point",
      districtId: "academy",
      districtLabel: "Academy District",
      kind: "clocktower",
      size: 62,
      props: ["banner", "banner", "lantern_hub", "bench", "planter"]
    },
    {
      id: "harrowstead-hall",
      sourceName: "Harstad Hall",
      anchor: /harstad residence hall/i,
      displayLabel: "Harrowstead Hall",
      subtitle: "Old Adventurer Housing",
      districtId: "adventurer",
      districtLabel: "Adventurer Commons",
      kind: "historic_hall",
      size: 56,
      props: ["camp_lantern", "camp_lantern", "notice_board", "wagon", "ruin_fragment"]
    },
    {
      id: "rose-sigil-cathedral",
      sourceName: "Eastvold Chapel / Rose Window",
      anchor: /olson auditorium|karen hille phillips|theatre/i,
      displayLabel: "Cathedral of the Rose Sigil",
      subtitle: "Sanctuary District",
      districtId: "sanctuary",
      districtLabel: "Sanctuary District",
      kind: "rose_sigil",
      size: 68,
      props: ["shrine_basin", "stained_glass", "blue_lantern", "blue_lantern", "bench"]
    },
    {
      id: "resonant-hymns",
      sourceName: "Mary Baker Russell Music Center",
      anchor: /mary baker russel+l? music center/i,
      displayLabel: "Hall of Resonant Hymns",
      subtitle: "Bard Guild Gathering Place",
      districtId: "academy",
      districtLabel: "Academy District",
      kind: "organ_hall",
      size: 58,
      props: ["banner", "lantern_hub", "bench", "blue_lantern", "stained_glass"]
    },
    {
      id: "ironwind-prow",
      sourceName: "Viking Ship Prow",
      anchor: /red square|anderson university center/i,
      displayLabel: "Ironwind Prow",
      subtitle: "Rune-Metal Ship Relic",
      districtId: "academy",
      districtLabel: "Academy District",
      kind: "ship_prow",
      size: 52,
      offset: { x: -64, y: 38 },
      props: ["rune_marker", "banner", "banner", "lantern_hub"]
    },
    {
      id: "glass-roses",
      sourceName: "Dale Chihuly Glass Roses",
      anchor: /mary baker russel+l? music center/i,
      displayLabel: "The Glass Roses of Lumina",
      subtitle: "Luminous Glass Installation",
      districtId: "academy",
      districtLabel: "Academy District",
      kind: "glass_roses",
      size: 44,
      offset: { x: 40, y: -34 },
      props: ["blue_lantern", "bench"]
    },
    {
      id: "bronze-scholar",
      sourceName: "Martin Luther Bust",
      anchor: /mortvedt library|hauge administration|anderson university center/i,
      displayLabel: "The Bronze Scholar",
      subtitle: "Scholar Statue",
      districtId: "academy",
      districtLabel: "Academy District",
      kind: "bronze_scholar",
      size: 26,
      props: ["bench", "rune_marker"]
    },
    {
      id: "twin-wardens",
      sourceName: "The Sisters Sculpture",
      anchor: /red square|anderson university center/i,
      displayLabel: "The Twin Wardens",
      subtitle: "Memorial Landmark",
      districtId: "sanctuary",
      districtLabel: "Sanctuary District",
      kind: "twin_wardens",
      size: 30,
      offset: { x: 42, y: 28 },
      props: ["blue_lantern", "bench"]
    },
    {
      id: "whispering-runes",
      sourceName: "Rune Stones",
      anchor: /rieke science center|carol sheffels quigg greenhouse/i,
      displayLabel: "The Whispering Rune Stones",
      subtitle: "Hidden Lore Site",
      districtId: "alchemy",
      districtLabel: "Alchemy Ward",
      kind: "rune_stones",
      size: 56,
      props: ["green_rune", "green_rune", "botanical", "ruin_fragment", "bench"]
    }
  ];
  const keys = new Set();
  const routeRenderCache = new WeakMap();

  let map = null;
  let mapBounds = null;
  let collisionPolygons = [];
  let cameraClampLogged = false;
  let showMinimap = true;
  let environmentPack = createEnvironmentPackFallback();
  let renderErrorLogged = false;
  let renderedLabelRects = [];

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
  initialize().catch((error) => handleFatalInitError("unhandled initialize rejection", error));

  async function initialize() {
    try {
      console.info("[Init] start");
      console.info("Texture pack enabled", USE_TEXTURE_PACK);
      if (!USE_TEXTURE_PACK) {
        console.info("Fallback renderer active", {
          reason: "USE_TEXTURE_PACK is false",
          renderer: "procedural fantasy Canvas palette"
        });
      }

      console.info("[Init] loadActiveMap");
      map = await loadActiveMap();
      console.info("OSM loaded", {
        sourceFile: map.sourceFile,
        buildings: map.buildings.length,
        roads: map.roads.length,
        paths: map.paths.length
      });

      setText(ui.source, map.sourceFile || "map loaded");
      setText(ui.stats, `buildings ${map.stats.buildingCount} | named ${map.stats.namedBuildings} | unnamed ${map.stats.unnamedBuildings}`);

      try {
        console.info("[Init] applyEnvironmentRulesToMap");
        applyEnvironmentRulesToMap(map);
      } catch (environmentError) {
        console.error("[Init] applyEnvironmentRulesToMap failed; continuing with raw OSM map.", environmentError);
        console.info("Fallback renderer active", {
          reason: "environment rules failed",
          renderer: "raw OSM map with procedural fantasy palette"
        });
      }

      console.info("[Init] configure world/collision/camera");
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

      console.info("Renderer initialized", {
        mode: USE_TEXTURE_PACK ? "procedural fallback first, texture pack loading async" : "procedural fantasy fallback",
        texturePackLoaded: environmentPack.loaded
      });
      console.info("[Init] requestAnimationFrame(loop)");
      requestAnimationFrame(loop);

      if (USE_TEXTURE_PACK) {
        void hydrateEnvironmentPackAfterBoot();
      }
    } catch (error) {
      handleFatalInitError("initialize", error);
    }
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

  async function hydrateEnvironmentPackAfterBoot() {
    try {
      const loadedPack = await loadEnvironmentPack();
      if (!loadedPack.loaded) {
        console.info("Fallback renderer active", {
          reason: "texture pack did not fully load",
          renderer: "procedural fantasy Canvas palette"
        });
        return;
      }

      environmentPack = loadedPack;
      if (map) {
        applyEnvironmentRulesToMap(map);
      }
      console.info("Renderer initialized", {
        mode: "texture pack rules layered after boot",
        texturePackLoaded: true
      });
    } catch (error) {
      console.warn("[Environment Pack] Async texture hydration failed after map boot.", error);
      console.info("Fallback renderer active", {
        reason: "async texture pack hydration failed",
        renderer: "procedural fantasy Canvas palette"
      });
    }
  }

  async function loadEnvironmentPack() {
    const fallback = createEnvironmentPackFallback();

    try {
      const fileEntries = Object.entries(ENVIRONMENT_PACK_FILES);
      const results = await Promise.allSettled(
        fileEntries.map(async ([key, file]) => ({
          key,
          file,
          data: await fetchJson(file)
        }))
      );
      const loadedFiles = {};

      results.forEach((result, index) => {
        const [, file] = fileEntries[index];
        if (result.status === "fulfilled") {
          loadedFiles[result.value.key] = result.value.data;
          return;
        }

        console.warn(`Texture failed: ${file}`, result.reason);
      });

      if (!loadedFiles.rules) {
        console.warn("[Environment Pack] Required rule file missing. Keeping fallback renderer active.");
        return fallback;
      }

      const pack = {
        loaded: true,
        source: ENVIRONMENT_PACK_BASE,
        rules: [...(loadedFiles.rules.rules || [])].sort((a, b) => (b.priority || 0) - (a.priority || 0)),
        districts: loadedFiles.districts?.districts || {},
        terrainFamilies: loadedFiles.terrain?.terrain_families || {},
        shadows: loadedFiles.shadows || {},
        patterns: {}
      };
      try {
        pack.patterns = createEnvironmentTextures(pack);
      } catch (patternError) {
        console.warn("Texture failed: generated CanvasPattern environment textures", patternError);
        return fallback;
      }

      console.info("[Environment Pack] plu_osm_environment_rules_v3 loaded.", {
        source: pack.source,
        rules: pack.rules.length,
        districts: Object.keys(pack.districts).length,
        terrainFamilies: Object.keys(pack.terrainFamilies).length,
        proceduralPatternTextures: Object.keys(pack.patterns).length,
        note: "The pack supplies rule/spec files; no bitmap texture files were present, so CanvasPattern textures are generated from the pack tile families."
      });

      return pack;
    } catch (error) {
      console.warn("[Environment Pack] Could not load plu_osm_environment_rules_v3. Using built-in rule-compatible fallback textures.", error);
      return fallback;
    }
  }

  async function fetchJson(url) {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`${url} returned HTTP ${response.status}`);
    }
    return response.json();
  }

  function createEnvironmentPackFallback() {
    return {
      loaded: false,
      source: "built-in environment fallback",
      rules: [],
      districts: {},
      terrainFamilies: {},
      shadows: {},
      patterns: {}
    };
  }

  function applyEnvironmentRulesToMap(activeMap) {
    const roads = activeMap.roads || [];
    const paths = activeMap.paths || [];
    const parks = activeMap.parks || [];
    const plazas = activeMap.plazas || [];
    const water = activeMap.water || [];
    const buildings = activeMap.buildings || [];

    roads.forEach((road) => {
      road.environment = environmentForFeature(road, "road");
    });
    paths.forEach((path) => {
      path.environment = environmentForFeature(path, "path");
    });
    parks.forEach((park) => {
      park.environment = environmentForFeature(park, "terrain");
    });
    plazas.forEach((plaza) => {
      plaza.environment = environmentForFeature(plaza, "plaza");
    });
    water.forEach((waterFeature) => {
      waterFeature.environment = environmentForFeature(waterFeature, "water");
    });
    buildings.forEach((building) => {
      building.environment = environmentForFeature(building, "building");
    });
    applyDisplayMetadataToMap(activeMap);

    console.info("[Environment Pack] applied fantasy OSM replacements.", {
      source: environmentPack.source,
      loaded: environmentPack.loaded,
      roads: countEnvironment(roads),
      paths: countEnvironment(paths),
      plazas: countEnvironment(plazas),
      terrain: countEnvironment(parks),
      buildings: countEnvironment(buildings)
    });
  }

  function countEnvironment(features) {
    return features.reduce((counts, feature) => {
      const key = feature.environment?.replacement || "unmapped";
      counts[key] = (counts[key] || 0) + 1;
      return counts;
    }, {});
  }

  function environmentForFeature(feature, role) {
    const tags = feature.tags || {};
    const special = specialEnvironmentForFeature(feature, role);
    if (special) return special;

    const rule = matchingEnvironmentRule(tags);
    if (rule) {
      return environmentFromRule(rule, role);
    }

    return fallbackEnvironmentForRole(feature, role);
  }

  function specialEnvironmentForFeature(feature, role) {
    const tags = feature.tags || {};
    const text = `${feature.label || ""} ${feature.osmLabel || ""} ${feature.name || ""} ${feature.type || ""}`.toLowerCase();

    if (role === "building") {
      if (text.includes("moonwater") || text.includes("swimming pool")) {
        return customEnvironment("moonwater_sanctuary", "sacred", "library_wall_roof_set", "building");
      }
      if (text.includes("alchemy") || text.includes("greenhouse")) {
        return customEnvironment("alchemy_conservatory", "academy", "academy_wall_roof_set", "building");
      }
      if (text.includes("knight") || text.includes("gym") || text.includes("fitness")) {
        return customEnvironment("training_hall", "sacred", "academy_wall_roof_set", "building");
      }
      if (text.includes("bardic") || text.includes("auditorium")) {
        return customEnvironment("bardic_assembly_hall", "academy", "academy_wall_roof_set", "building");
      }
      if (text.includes("adventurer lodge")) {
        return customEnvironment("adventurer_lodge", "merchant", "lodge_wall_roof_set", "building");
      }
      if (text.includes("archive") || text.includes("scholar")) {
        return customEnvironment("academy_building", "academy", "academy_wall_roof_set", "building");
      }
    }

    if (role === "plaza" || tags.amenity === "parking" || feature.type === "parking") {
      return customEnvironment("caravan_plaza", "merchant", "plaza_stone_autotile", "ground");
    }

    if (role === "water") {
      return customEnvironment("moonwater", "sacred", "shoreline_autotile", "water");
    }

    return null;
  }

  function customEnvironment(replacement, district, tileFamily, elevation) {
    return {
      replacement,
      district,
      biome: "campus_core",
      elevation,
      tileFamily,
      connectsTo: [],
      fromRule: false
    };
  }

  function matchingEnvironmentRule(tags) {
    return (environmentPack.rules || []).find((rule) => ruleMatchesTags(rule.osm_match || {}, tags));
  }

  function ruleMatchesTags(osmMatch, tags) {
    return Object.entries(osmMatch).every(([key, values]) => {
      const actual = tags[key];
      if (actual === undefined || actual === null) return false;
      return values.some((value) => value === "*" || String(value) === String(actual));
    });
  }

  function environmentFromRule(rule, role) {
    return {
      replacement: rule.fantasy_replacement || role,
      district: rule.district || "academy",
      biome: rule.biome || "campus_core",
      elevation: rule.elevation || "ground",
      tileFamily: rule.tile_family || fallbackTileFamilyForRole(role),
      connectsTo: rule.connects_to || [],
      fromRule: true
    };
  }

  function fallbackEnvironmentForRole(feature, role) {
    const tags = feature.tags || {};
    if (role === "path") {
      return customEnvironment("narrow_stone_walkway", "academy", "stone_walkway_autotile", "ground");
    }
    if (role === "road") {
      return customEnvironment("main_dirt_road", "merchant", "road_dirt_autotile", "ground");
    }
    if (role === "plaza") {
      return customEnvironment("caravan_plaza", "merchant", "plaza_stone_autotile", "ground");
    }
    if (role === "building") {
      return customEnvironment("civilization_building_generic", "academy", "generic_academic_building_set", "building");
    }
    if (role === "water") {
      return customEnvironment("moonwater", "sacred", "shoreline_autotile", "water");
    }
    if (tags.landuse === "forest" || tags.natural === "wood" || tags.natural === "tree_row") {
      return customEnvironment("forest_floor", "forest", "forest_floor_autotile", "ground");
    }
    return customEnvironment("sacred_moss_grass", "forest", "grass_moss_autotile", "ground");
  }

  function fallbackTileFamilyForRole(role) {
    if (role === "road") return "road_dirt_autotile";
    if (role === "path") return "stone_walkway_autotile";
    if (role === "plaza") return "plaza_stone_autotile";
    if (role === "building") return "generic_academic_building_set";
    if (role === "water") return "shoreline_autotile";
    return "grass_moss_autotile";
  }

  function createEnvironmentTextures(pack) {
    const patterns = {};
    const terrainFamilies = Object.keys(pack.terrainFamilies || {});
    [
      ...terrainFamilies,
      "road_dirt_autotile",
      "stone_walkway_autotile",
      "plaza_stone_autotile",
      "grass_moss_autotile",
      "forest_floor_autotile",
      "shoreline_autotile",
      "grass_to_dirt",
      "dirt_to_stone",
      "moss_to_stone",
      "forest_border",
      "academy_foundation",
      "academy_roof",
      "old_shingle_roof",
      "training_roof",
      "sanctuary_roof",
      "alchemy_roof",
      "academy_wall",
      "timber_wall",
      "sanctuary_wall",
      "alchemy_wall"
    ].forEach((key) => {
      if (!patterns[key]) {
        patterns[key] = makeEnvironmentPattern(key);
      }
    });
    return patterns;
  }

  function makeEnvironmentPattern(key) {
    let tile;
    let tileCtx;

    try {
      tile = document.createElement("canvas");
      tile.width = 64;
      tile.height = 64;
      tileCtx = tile.getContext("2d");
    } catch (error) {
      console.warn(`Texture failed: ${key}`, error);
      return null;
    }

    if (!tileCtx) {
      console.warn(`Texture failed: ${key}`, new Error("Could not create CanvasRenderingContext2D"));
      return null;
    }

    try {
      drawPatternTile(tileCtx, key);
      return ctx.createPattern(tile, "repeat");
    } catch (error) {
      console.warn(`Texture failed: ${key}`, error);
      return null;
    }
  }

  function drawPatternTile(tileCtx, key) {
    const family = String(key || "");
    const palette = texturePaletteForKey(family);

    tileCtx.fillStyle = palette.base;
    tileCtx.fillRect(0, 0, 64, 64);

    if (family.includes("road_dirt") || family.includes("grass_to_dirt")) {
      drawDirtTexture(tileCtx, palette);
    } else if (family.includes("stone") || family.includes("plaza") || family.includes("foundation") || family.includes("dirt_to_stone") || family.includes("moss_to_stone")) {
      drawStoneTexture(tileCtx, palette, family.includes("plaza"));
    } else if (family.includes("forest")) {
      drawForestTexture(tileCtx, palette);
    } else if (family.includes("shoreline")) {
      drawWaterTexture(tileCtx, palette);
    } else if (family.includes("roof") || family.includes("shingle")) {
      drawRoofTexture(tileCtx, palette);
    } else if (family.includes("wall") || family.includes("building")) {
      drawWallTexture(tileCtx, palette);
    } else {
      drawGrassTexture(tileCtx, palette);
    }
  }

  function texturePaletteForKey(key) {
    if (key.includes("road_dirt") || key.includes("grass_to_dirt")) {
      return { base: "#7e5a34", dark: "#4d331f", light: "#a37a4a", moss: "#314528" };
    }
    if (key.includes("stone") || key.includes("plaza") || key.includes("foundation") || key.includes("dirt_to_stone") || key.includes("moss_to_stone")) {
      return { base: "#817963", dark: "#57533f", light: "#a89d78", moss: "#405536" };
    }
    if (key.includes("forest")) {
      return { base: "#1d3829", dark: "#12261d", light: "#3f6542", moss: "#4f7a46" };
    }
    if (key.includes("shoreline")) {
      return { base: "#2e5a65", dark: "#1d3944", light: "#5f8790", moss: "#5b5737" };
    }
    if (key.includes("sanctuary")) {
      return { base: "#31434a", dark: "#1d2b31", light: "#8cb6b5", moss: "#d4b66a" };
    }
    if (key.includes("alchemy")) {
      return { base: "#3b482f", dark: "#24311f", light: "#9aa96b", moss: "#c7a15e" };
    }
    if (key.includes("training")) {
      return { base: "#3e352b", dark: "#241d18", light: "#8b7658", moss: "#b18452" };
    }
    if (key.includes("roof") || key.includes("shingle")) {
      return { base: "#4a3026", dark: "#271813", light: "#8e5f3d", moss: "#5d6b3e" };
    }
    if (key.includes("wall") || key.includes("building")) {
      return { base: "#a77d55", dark: "#5e422d", light: "#c7a476", moss: "#55613c" };
    }
    return { base: "#203629", dark: "#16281e", light: "#3f6040", moss: "#5e7d49" };
  }

  function drawDirtTexture(tileCtx, palette) {
    tileCtx.fillStyle = palette.moss;
    tileCtx.globalAlpha = 0.18;
    tileCtx.fillRect(0, 0, 64, 7);
    tileCtx.fillRect(0, 57, 64, 7);
    tileCtx.globalAlpha = 1;
    textureFlecks(tileCtx, palette.dark, 48, 1.2, "dirt-a");
    textureFlecks(tileCtx, palette.light, 24, 0.9, "dirt-b");
    tileCtx.strokeStyle = "rgba(68,43,24,0.32)";
    tileCtx.lineWidth = 2;
    tileCtx.beginPath();
    tileCtx.moveTo(0, 22);
    tileCtx.bezierCurveTo(14, 20, 28, 26, 64, 23);
    tileCtx.moveTo(0, 42);
    tileCtx.bezierCurveTo(18, 44, 38, 38, 64, 41);
    tileCtx.stroke();
  }

  function drawStoneTexture(tileCtx, palette, largeStones) {
    const cellW = largeStones ? 24 : 16;
    const cellH = largeStones ? 18 : 14;
    tileCtx.strokeStyle = "rgba(45,41,31,0.28)";
    tileCtx.lineWidth = 1;
    for (let y = 0; y < 64; y += cellH) {
      for (let x = (y / cellH) % 2 ? -cellW / 2 : 0; x < 64; x += cellW) {
        tileCtx.strokeRect(x + 0.5, y + 0.5, cellW, cellH);
      }
    }
    textureFlecks(tileCtx, palette.light, 26, 0.8, "stone-a");
    textureFlecks(tileCtx, palette.moss, 18, 1.2, "stone-b");
  }

  function drawGrassTexture(tileCtx, palette) {
    textureFlecks(tileCtx, palette.light, 60, 0.9, "grass-a");
    textureFlecks(tileCtx, palette.moss, 38, 1.2, "grass-b");
    tileCtx.strokeStyle = "rgba(144,171,111,0.15)";
    tileCtx.lineWidth = 1;
    for (let i = 0; i < 18; i += 1) {
      const p = texturePoint(i, "grass-stroke");
      tileCtx.beginPath();
      tileCtx.moveTo(p.x, p.y);
      tileCtx.lineTo(p.x + 3, p.y - 5);
      tileCtx.stroke();
    }
  }

  function drawForestTexture(tileCtx, palette) {
    drawGrassTexture(tileCtx, palette);
    for (let i = 0; i < 22; i += 1) {
      const p = texturePoint(i, "forest");
      tileCtx.fillStyle = i % 2 ? "rgba(56,91,49,0.42)" : "rgba(27,55,35,0.5)";
      tileCtx.beginPath();
      tileCtx.arc(p.x, p.y, 2 + (i % 3), 0, Math.PI * 2);
      tileCtx.fill();
    }
  }

  function drawWaterTexture(tileCtx, palette) {
    textureFlecks(tileCtx, palette.light, 24, 0.8, "water-a");
    tileCtx.strokeStyle = "rgba(153,205,211,0.2)";
    tileCtx.lineWidth = 1.2;
    for (let y = 10; y < 64; y += 13) {
      tileCtx.beginPath();
      tileCtx.moveTo(3, y);
      tileCtx.bezierCurveTo(18, y - 4, 29, y + 4, 43, y);
      tileCtx.bezierCurveTo(50, y - 2, 57, y - 1, 63, y + 1);
      tileCtx.stroke();
    }
  }

  function drawRoofTexture(tileCtx, palette) {
    tileCtx.strokeStyle = "rgba(21,12,9,0.32)";
    tileCtx.lineWidth = 1;
    for (let y = 7; y < 64; y += 8) {
      tileCtx.beginPath();
      tileCtx.moveTo(0, y);
      tileCtx.lineTo(64, y + 3);
      tileCtx.stroke();
    }
    tileCtx.strokeStyle = "rgba(210,140,80,0.18)";
    for (let x = -24; x < 64; x += 16) {
      tileCtx.beginPath();
      tileCtx.moveTo(x, 64);
      tileCtx.lineTo(x + 34, 0);
      tileCtx.stroke();
    }
    textureFlecks(tileCtx, palette.light, 20, 0.7, "roof-a");
  }

  function drawWallTexture(tileCtx, palette) {
    tileCtx.strokeStyle = "rgba(73,48,31,0.32)";
    tileCtx.lineWidth = 1;
    for (let y = 10; y < 64; y += 13) {
      tileCtx.beginPath();
      tileCtx.moveTo(0, y);
      tileCtx.lineTo(64, y);
      tileCtx.stroke();
    }
    for (let x = 10; x < 64; x += 18) {
      tileCtx.beginPath();
      tileCtx.moveTo(x, 0);
      tileCtx.lineTo(x + 4, 64);
      tileCtx.stroke();
    }
    textureFlecks(tileCtx, palette.light, 18, 0.6, "wall-a");
  }

  function textureFlecks(tileCtx, color, count, size, seed) {
    tileCtx.fillStyle = color;
    tileCtx.globalAlpha = 0.22;
    for (let i = 0; i < count; i += 1) {
      const p = texturePoint(i, seed);
      tileCtx.fillRect(p.x, p.y, size + (i % 2), size);
    }
    tileCtx.globalAlpha = 1;
  }

  function texturePoint(index, seed) {
    const a = seededUnit(`${seed}-${index}-x`);
    const b = seededUnit(`${seed}-${index}-y`);
    return {
      x: Math.floor(a * 64),
      y: Math.floor(b * 64)
    };
  }

  function envPattern(key) {
    if (!USE_TEXTURE_PACK || !environmentPack.loaded) {
      return null;
    }
    return environmentPack.patterns?.[key] || null;
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
    const plazas = allAmenities
      .filter((feature) => isParkingFeature(feature))
      .map(featureFromGenerated)
      .filter(Boolean);
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
      plazas,
      water,
      realEntrances,
      landmarks: [...(gameMap.landmarks || []), ...(gameMap.amenities || [])]
        .map(pointFeatureFromGenerated)
        .filter(Boolean)
        .slice(0, 80),
      stats: {
        buildingCount: buildings.length,
        namedBuildings: buildings.filter((building) => building.osmLabel).length,
        unnamedBuildings: buildings.filter((building) => !building.osmLabel).length,
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

    const buildings = staticMap.buildings || [];
    prepareBuildingLabels(buildings);

    return {
      ...staticMap,
      buildings,
      plazas: staticMap.plazas || [],
      sourceFile: staticMap.sourceFile || "mapData.js fallback",
      realEntrances: [],
      stats: {
        buildingCount: buildings.length,
        namedBuildings: buildings.filter((building) => building.osmLabel).length,
        unnamedBuildings: buildings.filter((building) => !building.osmLabel).length,
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
    const osmLabel = sourceLabelForFeature(feature);
    return {
      id: feature.id,
      name: feature.name,
      osmLabel,
      label: "",
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

  function applyDisplayMetadataToMap(activeMap) {
    if (!activeMap) return;

    prepareBuildingLabels(activeMap.buildings || []);
    preparePlazaLabels(activeMap.plazas || []);
    prepareWaterLabels(activeMap.water || []);
    activeMap.storyLandmarks = createStoryLandmarks(activeMap);
    activeMap.storyProps = createStoryProps(activeMap, activeMap.storyLandmarks);
    activeMap.terrainHierarchy = createTerrainHierarchy(activeMap);

    if (activeMap.stats) {
      activeMap.stats.namedBuildingDetails = namedBuildingDetails(activeMap.buildings || []);
      activeMap.stats.storyLandmarks = activeMap.storyLandmarks.length;
      activeMap.stats.storyProps = activeMap.storyProps.length;
    }
  }

  function createTerrainHierarchy(activeMap) {
    const world = activeMap?.world || { width: 2400, height: 1800 };
    const faultRoads = (activeMap.roads || []).filter((road) => featureLabelMatches(road, /124th\s+street/i));
    const faultBounds = faultRoads.length
      ? combinedBounds(faultRoads.map((road) => boundsFromPoints(road.points)).filter(Boolean))
      : null;
    const faultY = faultBounds ? faultBounds.y + faultBounds.h * 0.52 : world.height * 0.61;
    const faultX0 = faultBounds ? Math.max(0, faultBounds.x - 80) : 0;
    const faultX1 = faultBounds ? Math.min(world.width, faultBounds.x + faultBounds.w + 80) : world.width;

    const terrainFeatures = [
      ...(activeMap.parks || []),
      ...(activeMap.plazas || []),
      ...(activeMap.buildings || [])
    ];

    return {
      faultY,
      faultX0,
      faultX1,
      athleticBasin: terrainFeatures.filter((feature) => featureLabelMatches(feature, /west field|east field|track|baseball/i)),
      fossField: terrainFeatures.find((feature) => featureLabelMatches(feature, /foss field/i)) || null,
      highGroundAnchors: terrainFeatures.filter((feature) => featureLabelMatches(feature, /red square|karen hille phillips|olson auditorium|harstad residence|foss residence|xavier|mortvedt|anderson university/i))
    };
  }

  function featureLabelMatches(feature, matcher) {
    const text = [
      feature?.name,
      feature?.osmLabel,
      feature?.displayLabel,
      feature?.label,
      feature?.sourceName,
      feature?.tags?.name
    ].filter(Boolean).join(" ");
    return matcher.test(text);
  }

  function combinedBounds(boundsList) {
    const valid = boundsList.filter(Boolean);
    if (!valid.length) return null;

    const minX = Math.min(...valid.map((bounds) => bounds.x));
    const minY = Math.min(...valid.map((bounds) => bounds.y));
    const maxX = Math.max(...valid.map((bounds) => bounds.x + bounds.w));
    const maxY = Math.max(...valid.map((bounds) => bounds.y + bounds.h));
    return {
      x: minX,
      y: minY,
      w: maxX - minX,
      h: maxY - minY
    };
  }

  function prepareBuildingLabels(buildings) {
    const usedLabels = new Set();
    const usedFallbackLabels = new Set();

    buildings.forEach((building) => {
      building.sourceName = sourceLabelForFeature(building);
      building.osmLabel = building.sourceName;
      const district = districtIdentityForFeature(building, "building");
      building.districtId = district.id;
      building.districtLabel = district.label;
      building.displayLabel = fantasyLabelForBuilding(building, district);
      building.label = building.displayLabel;

      if (!building.displayLabel) {
        building.showLabel = false;
        return;
      }

      const key = building.displayLabel.toLowerCase();
      const hasSourceName = Boolean(building.osmLabel);
      const shouldShowFallback = !hasSourceName && isFallbackLabelCandidate(building);

      building.showLabel = hasSourceName
        ? !usedLabels.has(key)
        : shouldShowFallback && !usedFallbackLabels.has(key);

      if (hasSourceName) {
        usedLabels.add(key);
      } else if (building.showLabel) {
        usedFallbackLabels.add(key);
      }
    });
  }

  function preparePlazaLabels(plazas) {
    const usedLabels = new Set();

    plazas.forEach((plaza) => {
      plaza.sourceName = sourceLabelForFeature(plaza);
      plaza.osmLabel = plaza.sourceName;
      const district = districtIdentityForFeature(plaza, "plaza");
      plaza.districtId = district.id;
      plaza.districtLabel = district.label;
      plaza.displayLabel = fantasyLabelForPlaza(plaza);
      plaza.label = plaza.displayLabel;

      const area = polygonArea(plaza.coordinates || rectPoints(plaza));
      const key = plaza.displayLabel.toLowerCase();
      plaza.showLabel = area >= 12000 && !usedLabels.has(key);
      if (plaza.showLabel) {
        usedLabels.add(key);
      }
    });
  }

  function prepareWaterLabels(waterFeatures) {
    waterFeatures.forEach((waterFeature) => {
      waterFeature.sourceName = sourceLabelForFeature(waterFeature);
      waterFeature.osmLabel = waterFeature.sourceName;
      const district = districtIdentityForFeature(waterFeature, "water");
      waterFeature.districtId = district.id;
      waterFeature.districtLabel = district.label;
      waterFeature.displayLabel = waterFeature.displayLabel || "Moonwater";
    });
  }

  function createStoryLandmarks(activeMap) {
    const candidates = [
      ...(activeMap.buildings || []),
      ...(activeMap.paths || []),
      ...(activeMap.plazas || []),
      ...(activeMap.water || []),
      ...(activeMap.landmarks || [])
    ];
    const landmarks = [];

    PLU_STORY_LANDMARKS.forEach((definition) => {
      const anchor = findLandmarkAnchor(candidates, definition.anchor);
      if (!anchor) return;

      const anchorPoint = centerForFeature(anchor.feature);
      if (!anchorPoint) return;

      const x = anchorPoint.x + (definition.offset?.x || 0);
      const y = anchorPoint.y + (definition.offset?.y || 0);
      landmarks.push({
        id: definition.id,
        sourceName: definition.sourceName,
        osmLabel: anchor.sourceName,
        anchorSourceName: anchor.sourceName,
        anchorFeatureId: anchor.feature.id || null,
        anchorFeatureType: anchor.feature.type || null,
        anchorIsBuilding: (activeMap.buildings || []).includes(anchor.feature),
        displayLabel: definition.displayLabel,
        label: definition.displayLabel,
        subtitle: definition.subtitle,
        districtId: definition.districtId,
        districtLabel: definition.districtLabel,
        kind: definition.kind,
        size: definition.size,
        propKinds: definition.props || [],
        x,
        y,
        bounds: {
          x: x - definition.size,
          y: y - definition.size,
          w: definition.size * 2,
          h: definition.size * 2
        },
        showLabel: true
      });
    });

    return landmarks;
  }

  function findLandmarkAnchor(features, matcher) {
    let best = null;

    features.forEach((feature) => {
      const sourceName = sourceLabelForFeature(feature) || feature.osmLabel || feature.displayLabel || feature.label || feature.name || "";
      const searchText = [
        sourceName,
        feature.displayLabel,
        feature.label,
        feature.type,
        feature.id,
        feature.tags?.amenity,
        feature.tags?.building,
        feature.tags?.leisure,
        feature.tags?.man_made
      ].join(" ");

      if (!matcher.test(searchText)) return;

      const score = sourceName ? 3 : 1;
      if (!best || score > best.score) {
        best = { feature, sourceName, score };
      }
    });

    return best;
  }

  function createStoryProps(activeMap, storyLandmarks) {
    const props = [];
    storyLandmarks.forEach((landmark) => {
      const hubPropCount = landmark.id === "crimson-commons" ? 6 : landmark.kind === "clocktower" || landmark.kind === "rose_sigil" ? 4 : 3;
      const hubRadius = landmark.size + (landmark.id === "crimson-commons" ? 54 : 34);
      addPropsAroundAnchor(props, landmark, landmark.propKinds || [], hubRadius, 0, hubPropCount);
    });

    (activeMap.plazas || []).forEach((plaza, index) => {
      if (props.length > 180) return;
      const center = centerForFeature(plaza);
      const area = polygonArea(plaza.coordinates || rectPoints(plaza));
      if (!center || area < 9000) return;

      addPropsAroundAnchor(
        props,
        {
          id: `plaza-${plaza.id || index}`,
          x: center.x,
          y: center.y,
          districtId: "merchant",
          districtLabel: "Market Commons"
        },
        ["market_stall", "camp_lantern", "notice_board", "bench"],
        Math.min(56, Math.max(28, Math.sqrt(area) * 0.18)),
        props.length
      );
    });

    (activeMap.buildings || []).forEach((building, index) => {
      if (props.length > 220 || !building.showLabel) return;

      const center = centerForFeature(building);
      if (!center) return;

      const districtId = building.districtId || districtIdentityForFeature(building, "building").id;
      const propKinds = propKindsForDistrict(districtId);
      if (!propKinds.length) return;
      const districtPropCount = districtId === "academy" ? 3 : 2;

      addPropsAroundAnchor(
        props,
        {
          id: `district-${building.id || index}`,
          x: center.x,
          y: center.y,
          districtId,
          districtLabel: building.districtLabel
        },
        propKinds,
        Math.min(44, Math.max(22, Math.sqrt(polygonArea(building.coordinates || rectPoints(building))) * 0.13)),
        props.length,
        districtPropCount
      );
    });

    return props.slice(0, 240);
  }

  function propKindsForDistrict(districtId) {
    if (districtId === "sanctuary") return ["blue_lantern", "shrine_basin", "stained_glass"];
    if (districtId === "alchemy") return ["green_rune", "botanical", "shrub"];
    if (districtId === "adventurer") return ["camp_lantern", "notice_board", "wagon"];
    if (districtId === "training") return ["weapon_rack", "training_post", "camp_lantern"];
    if (districtId === "merchant") return ["market_stall", "wagon", "notice_board"];
    return ["banner", "lantern_hub", "bench", "planter"];
  }

  function addPropsAroundAnchor(props, anchor, kinds, radius, offsetIndex, maxCount = 4) {
    const count = Math.min(maxCount, kinds.length);
    for (let i = 0; i < count; i += 1) {
      const kind = kinds[i % kinds.length];
      const seed = `${anchor.id}:${kind}:${i}:${offsetIndex}`;
      const angle = seededUnit(`${seed}:angle`) * Math.PI * 2;
      const distance = radius * (0.58 + seededUnit(`${seed}:distance`) * 0.62);
      props.push({
        id: `${seed}`,
        kind,
        x: anchor.x + Math.cos(angle) * distance,
        y: anchor.y + Math.sin(angle) * distance,
        districtId: anchor.districtId,
        districtLabel: anchor.districtLabel,
        size: 7 + seededUnit(`${seed}:size`) * 5,
        rotation: angle + (seededUnit(`${seed}:rotation`) - 0.5) * 0.8
      });
    }
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
      plazas: activeMap.plazas?.length || 0,
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
      .filter((building) => building.osmLabel)
      .map((building) => {
        const center = centerOfBounds(boundsForFeature(building));
        return {
          id: building.id,
          osmName: building.osmLabel,
          sourceName: building.sourceName,
          displayName: building.displayLabel || building.label,
          district: building.districtLabel,
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

  function isParkingFeature(feature) {
    const tags = feature.tags || {};
    const points = feature.coordinates || [];
    return points.length >= 3 && (feature.type === "parking" || tags.amenity === "parking" || tags.parking);
  }

  function sourceLabelForFeature(feature) {
    const tags = feature.tags || {};
    return feature.name || tags.name || tags.ref || tags["building:name"] || "";
  }

  function fantasyLabelForBuilding(building, district = districtIdentityForFeature(building, "building")) {
    const sourceLabel = building.osmLabel || sourceLabelForFeature(building);
    const mappedName = fantasyMappedName(sourceLabel);
    if (mappedName) {
      return sanitizeFantasyLabel(mappedName, building, district);
    }

    if (sourceLabel) {
      return sanitizeFantasyLabel(fantasyLabelFromSource(building, sourceLabel, district), building, district);
    }

    return sanitizeFantasyLabel(fantasyFallbackLabel(building, district), building, district);
  }

  function fantasyMappedName(sourceLabel) {
    if (!sourceLabel) return "";
    const mapping = FANTASY_NAME_MAPPINGS.find((entry) => entry.match.test(sourceLabel));
    return mapping ? mapping.name : "";
  }

  function fantasyLabelFromSource(building, sourceLabel, district) {
    const source = String(sourceLabel || "");
    const lower = source.toLowerCase();
    const stem = fantasyNameStem(source);

    if (/pool|swimming|moonwater/.test(lower) || district.id === "sanctuary") {
      return "Moonwater Sanctuary";
    }
    if (/greenhouse|conservatory/.test(lower)) {
      return "Alchemy Conservatory";
    }
    if (/science|laboratory|observatory/.test(lower) || district.id === "alchemy") {
      return `${stem || "Alchemy"} Hall`;
    }
    if (/gym|gymnasium|fitness|athletic|sports?/.test(lower) || district.id === "training") {
      return `${stem || "Martial"} Training Hall`;
    }
    if (/residence|residential|dorm|dormitory|apartments/.test(lower) || district.id === "adventurer") {
      return `${stem || deterministicFallbackName(building, "adventurer")} Lodge`;
    }
    if (/library|archive/.test(lower)) {
      return `${stem || "Grand"} Archive`;
    }
    if (/administration|admin|council/.test(lower)) {
      return `${stem || "Council"} Hall`;
    }
    if (/college|collegium/.test(lower)) {
      return `${stem || "Scholar"} Collegium`;
    }
    if (/center|commons/.test(lower)) {
      return `${stem || "Guild"} Commons`;
    }
    if (/hall/.test(lower)) {
      return `${stem || "Scholar"} Academy Hall`;
    }

    return `${stem || deterministicFallbackName(building, district.id)} Hall`;
  }

  function fantasyFallbackLabel(building, district = districtIdentityForFeature(building, "building")) {
    const tags = building.tags || {};
    const text = `${tags.building || ""} ${building.type || ""} ${building.gameplayRole || ""}`.toLowerCase();

    if (/residential|dorm|apartments|house|residence|hall/.test(text)) {
      return deterministicFallbackName(building, "adventurer");
    }
    if (/library|archive|civic|university|school|college|public/.test(text)) {
      return deterministicFallbackName(building, "academy");
    }
    if (/greenhouse|industrial|service|retail|commercial|yes/.test(text)) {
      return deterministicFallbackName(building, district.id);
    }

    const area = polygonArea(building.coordinates || rectPoints(building));
    if (area < 5200) {
      return "Old Study House";
    }

    return deterministicFallbackName(building, district.id);
  }

  function fantasyLabelForPlaza(plaza) {
    const sourceLabel = sourceLabelForFeature(plaza);
    const lower = `${sourceLabel} ${plaza.type || ""} ${plaza.tags?.amenity || ""} ${plaza.tags?.parking || ""}`.toLowerCase();
    if (/market/.test(lower)) return "Market Plaza";
    if (/parking|car|vehicle/.test(lower)) {
      return deterministicFallbackName(plaza, "merchant");
    }
    return "Market Plaza";
  }

  function deterministicFallbackName(feature, districtId) {
    const key = districtId && DISTRICT_FALLBACK_LABELS[districtId] ? districtId : "academy";
    const labels = DISTRICT_FALLBACK_LABELS[key] || FANTASY_BUILDING_LABELS;
    const index = Math.floor(seededUnit(`${feature.id || feature.name || feature.x || "feature"}:${key}`) * labels.length);
    return labels[Math.min(labels.length - 1, index)] || labels[0] || "Scholar Hall";
  }

  function fantasyNameStem(label) {
    return String(label || "")
      .replace(/\bPacific Lutheran University\b/gi, "")
      .replace(/\bfor (Learning and Technology|Global Education|the Performing Arts)\b/gi, "")
      .replace(/\bResidence Hall\b/gi, "")
      .replace(/\bDormitory\b/gi, "")
      .replace(/\bFitness Center\b/gi, "")
      .replace(/\bGymn?asium\b/gi, "")
      .replace(/\bSwimming Pool\b/gi, "")
      .replace(/\bGreenhouse\b/gi, "")
      .replace(/\bAdministration Building\b/gi, "")
      .replace(/\bUniversity Center\b/gi, "")
      .replace(/\bCenter\b/gi, "")
      .replace(/\bCollege\b/gi, "")
      .replace(/\bBuilding\b/gi, "")
      .replace(/\bHall\b/gi, "")
      .replace(/\s*\/\s*/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function sanitizeFantasyLabel(label, feature, district = districtIdentityForFeature(feature, "building")) {
    let result = String(label || "").trim();
    if (!result) {
      result = deterministicFallbackName(feature, district.id);
    }

    result = result
      .replace(/\bHighwatch Dormitory\b/g, "Highwatch Lodge")
      .replace(/\bDormitory\b/g, "Lodge")
      .replace(/\bDorm\b/g, "Lodge")
      .replace(/\bResidence Hall\b/g, "Lodge")
      .replace(/\bUniversity Center\b/g, "Guild Commons")
      .replace(/\bCollege\b/g, "Collegium")
      .replace(/\bGymn?asium\b/g, "Training Hall")
      .replace(/\bFitness Center\b/g, "Martial Hall")
      .replace(/\bSwimming Pool\b/g, "Moonwater Sanctuary")
      .replace(/\bGreenhouse\b/g, "Alchemy Conservatory")
      .replace(/\bParking\b/g, "Caravan Yard")
      .replace(/\s+/g, " ")
      .trim();

    if (/^(Hall|Center|Building|Annex)$/i.test(result)) {
      return deterministicFallbackName(feature, district.id);
    }

    return result;
  }

  function districtIdentityForFeature(feature, role = "building") {
    const tags = feature.tags || {};
    const environment = feature.environment || {};
    const text = [
      feature.displayLabel,
      feature.label,
      feature.osmLabel,
      feature.sourceName,
      sourceLabelForFeature(feature),
      feature.name,
      feature.type,
      feature.gameplayRole,
      environment.replacement,
      environment.district,
      environment.tileFamily,
      tags.amenity,
      tags.building,
      tags.leisure,
      tags.sport,
      tags.parking,
      tags.man_made
    ].join(" ").toLowerCase();

    if (role === "water" || /moonwater|sanctuary|sacred|swimming|pool|chapel|worship|water/.test(text)) {
      return { id: "sanctuary", label: "Sanctuary District" };
    }
    if (/greenhouse|alchemy|science|laboratory|observatory|conservatory/.test(text)) {
      return { id: "alchemy", label: "Alchemy Ward" };
    }
    if (/training|martial|knight|gym|fitness|athletic|sports?|pitch/.test(text)) {
      return { id: "training", label: "Training Grounds" };
    }
    if (/residential|residence|dorm|dormitory|apartments|lodge|adventurer|student/.test(text)) {
      return { id: "adventurer", label: "Adventurer Commons" };
    }
    if (role === "plaza" || /parking|caravan|market|plaza|yard/.test(text)) {
      return { id: "merchant", label: "Market Commons" };
    }
    if (/academy|academic|university|library|archive|college|collegium|scholar|school|hall|center|administration|public|education/.test(text)) {
      return { id: "academy", label: "Academy District" };
    }

    return { id: "academy", label: "Academy District" };
  }

  function isFallbackLabelCandidate(building) {
    const bounds = boundsForFeature(building);
    const area = polygonArea(building.coordinates || rectPoints(building));
    return area >= 9000 && bounds.w >= 54 && bounds.h >= 36;
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
    const isImportant = Boolean(building.osmLabel) ||
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

    try {
      update(dt);
      draw();
    } catch (error) {
      if (!renderErrorLogged) {
        console.error("[Render Loop] frame failed; drawing visible fallback frame and continuing.", error);
        renderErrorLogged = true;
      }
      drawRenderFallback(error);
    }

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

  function handleFatalInitError(stage, error) {
    console.error(`[Fatal Init] ${stage}`, error);
    setText(ui.source, "load failed");
    setText(ui.stats, `${stage}: ${error?.message || error}`);
    drawFatalOverlay(`Map failed during ${stage}`, error);
  }

  function drawFatalOverlay(title, error) {
    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#1b1512";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#f1d6a8";
    ctx.font = "700 22px Inter, ui-sans-serif, system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(title, 28, 28);
    ctx.font = "500 14px Inter, ui-sans-serif, system-ui, sans-serif";
    ctx.fillStyle = "#d8b982";
    ctx.fillText(String(error?.message || error || "Unknown runtime error"), 28, 66, canvas.width - 56);
    ctx.fillStyle = "#8a5f35";
    ctx.fillRect(28, 104, 180, 72);
    ctx.fillStyle = "#2e4c35";
    ctx.fillRect(48, 122, 140, 34);
    ctx.fillStyle = "#c99b58";
    ctx.fillRect(72, 134, 94, 11);
    ctx.restore();
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
    drawElevationUnderlay();
    drawPacificNorthwestTerrainUnderlay();
    drawLandmarkTerrainUnderlay();
    map.parks.forEach(drawPark);
    map.water.forEach(drawWater);
    (map.plazas || []).forEach(drawPlaza);
    map.roads.forEach(drawRoad);
    map.paths.forEach(drawPath);
    drawPacificNorthwestTerrainDetails();
    drawLandmarkTerrainDetails();
    (map.storyLandmarks || []).forEach(drawStoryLandmarkGround);
    map.buildings.forEach(drawBuilding);
    (map.storyProps || []).forEach(drawStoryProp);
    (map.storyLandmarks || []).forEach(drawStoryLandmark);
    drawSightlineControlMasks();
    drawAtmosphereOverlay();
    if (DEBUG_ENTRANCES) {
      map.realEntrances.forEach(drawEntranceDebug);
    }
    if (DEBUG_LABELS) {
      renderedLabelRects = [];
      (map.storyLandmarks || []).forEach(drawStoryLandmarkLabel);
      (map.plazas || []).forEach(drawFeatureLabel);
      map.buildings.forEach(drawBuildingLabel);
    }
    if (DEBUG_BUILDINGS) {
      map.landmarks.forEach(drawLandmark);
    }
    drawPlayer();
    drawMinimap();
  }

  function drawRenderFallback(error) {
    ctx.save();
    ctx.fillStyle = "#1f3027";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#8a673f";
    ctx.fillRect(80, canvas.height / 2 - 18, canvas.width - 160, 36);
    ctx.fillStyle = "#4b3327";
    ctx.fillRect(canvas.width / 2 - 44, canvas.height / 2 - 92, 88, 68);
    ctx.fillStyle = "#f4ead0";
    circle(canvas.width / 2, canvas.height / 2 + 30, 7);
    ctx.fillStyle = "rgba(241,214,168,0.92)";
    ctx.font = "700 14px Inter, ui-sans-serif, system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    ctx.fillText(`Render fallback active: ${error?.message || error}`, 16, canvas.height - 16, canvas.width - 32);
    ctx.restore();
  }

  function drawBackground() {
    ctx.fillStyle = envPattern("grass_moss_autotile") || "#1f3027";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = "rgba(185,216,174,0.018)";
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

  function drawElevationUnderlay() {
    if (!map) return;

    const view = {
      x: camera.x,
      y: camera.y,
      w: visibleWorldWidth(),
      h: visibleWorldHeight()
    };

    ctx.save();
    drawHillBand(view, 0.12, 0.28, "rgba(15,27,20,0.18)", "rgba(131,164,105,0.055)");
    drawHillBand(view, 0.54, 0.22, "rgba(12,22,18,0.12)", "rgba(168,149,101,0.045)");

    const contourSpacing = 260;
    const first = Math.floor((view.y - 220) / contourSpacing) * contourSpacing;
    for (let y = first; y < view.y + view.h + 300; y += contourSpacing) {
      const seed = Math.floor(y / contourSpacing);
      const offset = (seededUnit(`elevation:${seed}`) - 0.5) * 80;
      const start = worldToScreen(view.x - 80, y + offset);
      const end = worldToScreen(view.x + view.w + 80, y + offset + view.w * 0.08);
      ctx.strokeStyle = "rgba(198,185,135,0.035)";
      ctx.lineWidth = Math.max(1, worldSize(2));
      ctx.setLineDash([worldSize(32), worldSize(18)]);
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.quadraticCurveTo(
        (start.x + end.x) / 2,
        start.y + worldSize(32 + seededUnit(`elevation:${seed}:bend`) * 42),
        end.x,
        end.y
      );
      ctx.stroke();
    }
    ctx.setLineDash([]);

    (map.plazas || []).forEach((plaza) => drawRaisedGroundEdge(plaza, "plaza"));
    (map.buildings || []).forEach((building) => {
      if (!building.showLabel) return;
      drawRaisedGroundEdge(building, "building");
    });
    ctx.restore();
  }

  function drawHillBand(view, yFactor, heightFactor, shadowColor, lightColor) {
    const y = view.y + view.h * yFactor;
    const h = view.h * heightFactor;
    const leftTop = worldToScreen(view.x - view.w * 0.1, y);
    const rightTop = worldToScreen(view.x + view.w * 1.1, y + view.w * 0.06);
    const rightBottom = worldToScreen(view.x + view.w * 1.1, y + h + view.w * 0.04);
    const leftBottom = worldToScreen(view.x - view.w * 0.1, y + h);

    const gradient = ctx.createLinearGradient(leftTop.x, leftTop.y, leftBottom.x, leftBottom.y);
    gradient.addColorStop(0, lightColor);
    gradient.addColorStop(0.54, "rgba(0,0,0,0)");
    gradient.addColorStop(1, shadowColor);

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(leftTop.x, leftTop.y);
    ctx.quadraticCurveTo(
      (leftTop.x + rightTop.x) / 2,
      leftTop.y - worldSize(28),
      rightTop.x,
      rightTop.y
    );
    ctx.lineTo(rightBottom.x, rightBottom.y);
    ctx.quadraticCurveTo(
      (leftBottom.x + rightBottom.x) / 2,
      leftBottom.y + worldSize(24),
      leftBottom.x,
      leftBottom.y
    );
    ctx.closePath();
    ctx.fill();
  }

  function drawRaisedGroundEdge(feature, kind) {
    const points = feature.coordinates || rectPoints(feature);
    if (!points || points.length < 3) return;
    const bounds = boundsFromPoints(points);
    if (!rectInView(bounds, 80)) return;

    const area = polygonArea(points);
    if (kind === "building" && area < 8500) return;

    const depth = kind === "plaza" ? 4 : 5;
    const color = kind === "plaza" ? "rgba(83,62,40,0.22)" : "rgba(22,18,14,0.2)";
    drawPolygon(offsetPoints(points, depth, depth + 2), color);

    ctx.save();
    ctx.strokeStyle = kind === "plaza" ? "rgba(174,137,82,0.22)" : "rgba(71,57,42,0.24)";
    ctx.lineWidth = worldSize(kind === "plaza" ? 2 : 3);
    directionalEdges(points, "bottom").forEach((edge) => drawWorldSegment(edge.a, edge.b));
    ctx.restore();
  }

  function drawPacificNorthwestTerrainUnderlay() {
    const hierarchy = map?.terrainHierarchy;
    if (!map || !hierarchy) return;

    drawAcademicPlateauUnderlay(hierarchy);
    drawAthleticBasinUnderlay(hierarchy);
    drawFossFieldDepressionUnderlay(hierarchy);
    drawAthleticFieldBasinUnderlays(hierarchy);
  }

  function drawPacificNorthwestTerrainDetails() {
    const hierarchy = map?.terrainHierarchy;
    if (!map || !hierarchy) return;

    drawFaultLineRetainingWall(hierarchy);
    drawFossFieldDepressionDetails(hierarchy);
    drawAthleticBasinDetails(hierarchy);
    drawHighGroundMassingPressure(hierarchy);
  }

  function drawAcademicPlateauUnderlay(hierarchy) {
    const top = worldToScreen(0, 0).y;
    const fault = worldToScreen(0, hierarchy.faultY).y;
    if (fault < -80 || top > canvas.height + 80) return;

    ctx.save();
    const y = Math.max(-80, top);
    const h = Math.min(canvas.height + 160, fault - y + worldSize(34));
    const plateau = ctx.createLinearGradient(0, y, 0, y + h);
    plateau.addColorStop(0, "rgba(98,126,88,0.035)");
    plateau.addColorStop(0.58, "rgba(76,99,70,0.025)");
    plateau.addColorStop(0.86, "rgba(123,91,55,0.075)");
    plateau.addColorStop(1, "rgba(34,24,18,0.12)");
    ctx.fillStyle = plateau;
    ctx.fillRect(0, y, canvas.width, h);

    ctx.strokeStyle = "rgba(185,163,105,0.06)";
    ctx.lineWidth = Math.max(1, worldSize(1.2));
    for (let i = 0; i < 5; i += 1) {
      const yy = fault - worldSize(185 + i * 118);
      if (yy < -60 || yy > canvas.height + 60) continue;
      ctx.beginPath();
      ctx.moveTo(-40, yy);
      ctx.quadraticCurveTo(canvas.width * 0.5, yy - worldSize(18 + i * 2), canvas.width + 40, yy + worldSize(14));
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawAthleticBasinUnderlay(hierarchy) {
    const fault = worldToScreen(0, hierarchy.faultY).y;
    const bottom = worldToScreen(0, map.world.height).y;
    if (bottom < -80 || fault > canvas.height + 80) return;

    ctx.save();
    const y = Math.max(-80, fault - worldSize(8));
    const h = Math.min(canvas.height + 160, bottom - y + worldSize(120));
    const basin = ctx.createLinearGradient(0, y, 0, y + h);
    basin.addColorStop(0, "rgba(8,10,10,0.24)");
    basin.addColorStop(0.18, "rgba(49,43,31,0.14)");
    basin.addColorStop(0.55, "rgba(87,92,55,0.045)");
    basin.addColorStop(1, "rgba(21,30,25,0.1)");
    ctx.fillStyle = basin;
    ctx.fillRect(0, y, canvas.width, h);

    const exposure = ctx.createLinearGradient(0, y, canvas.width, y + h * 0.6);
    exposure.addColorStop(0, "rgba(175,154,96,0.035)");
    exposure.addColorStop(0.5, "rgba(188,174,122,0.02)");
    exposure.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = exposure;
    ctx.fillRect(0, y + worldSize(80), canvas.width, Math.max(0, h - worldSize(80)));
    ctx.restore();
  }

  function drawFossFieldDepressionUnderlay(hierarchy) {
    const field = hierarchy.fossField;
    if (!field) return;

    const bounds = boundsForFeature(field);
    if (!rectInView(bounds, 180)) return;
    const center = centerOfBounds(bounds);

    ctx.save();
    fillWorldEllipse(center, bounds.w * 0.72, bounds.h * 0.55, -0.03, "rgba(18,31,20,0.18)");
    fillWorldEllipse({ x: center.x, y: center.y + bounds.h * 0.04 }, bounds.w * 0.58, bounds.h * 0.42, 0, "rgba(52,91,52,0.12)");
    fillWorldEllipse({ x: center.x, y: center.y + bounds.h * 0.14 }, bounds.w * 0.46, bounds.h * 0.26, 0, "rgba(19,23,16,0.1)");
    ctx.restore();
  }

  function drawAthleticFieldBasinUnderlays(hierarchy) {
    (hierarchy.athleticBasin || []).forEach((feature) => {
      const bounds = boundsForFeature(feature);
      if (!rectInView(bounds, 160)) return;
      const center = centerOfBounds(bounds);
      const label = `${feature.name || ""} ${feature.osmLabel || ""}`.toLowerCase();
      const isBaseball = label.includes("baseball");

      fillWorldEllipse(
        { x: center.x, y: center.y + bounds.h * 0.06 },
        bounds.w * (isBaseball ? 0.7 : 0.58),
        bounds.h * (isBaseball ? 0.46 : 0.54),
        isBaseball ? -0.18 : 0,
        isBaseball ? "rgba(83,66,42,0.12)" : "rgba(19,32,21,0.11)"
      );
    });
  }

  function drawFaultLineRetainingWall(hierarchy) {
    const y = hierarchy.faultY;
    if (!rectInView({ x: 0, y: y - 90, w: map.world.width, h: 180 }, 80)) return;

    ctx.save();
    ctx.strokeStyle = "rgba(26,21,17,0.48)";
    ctx.lineWidth = worldSize(7);
    ctx.lineCap = "round";
    drawWorldSegment({ x: 0, y: y + 14 }, { x: map.world.width, y: y + 8 });

    ctx.strokeStyle = "rgba(127,103,72,0.38)";
    ctx.lineWidth = worldSize(3);
    drawWorldSegment({ x: hierarchy.faultX0, y: y - 2 }, { x: hierarchy.faultX1, y: y - 8 });

    ctx.strokeStyle = "rgba(218,185,118,0.13)";
    ctx.lineWidth = Math.max(1, worldSize(1.1));
    drawWorldSegment({ x: hierarchy.faultX0, y: y - 22 }, { x: hierarchy.faultX1, y: y - 28 });

    const wallLength = Math.max(1, hierarchy.faultX1 - hierarchy.faultX0);
    const blocks = Math.min(36, Math.max(12, Math.floor(wallLength / 62)));
    for (let i = 0; i <= blocks; i += 1) {
      const t = i / blocks;
      const x = hierarchy.faultX0 + wallLength * t;
      const drop = 16 + (i % 3) * 5;
      ctx.strokeStyle = i % 2 ? "rgba(71,58,43,0.42)" : "rgba(42,33,26,0.38)";
      ctx.lineWidth = Math.max(1, worldSize(1.3));
      drawWorldSegment({ x, y: y - 8 }, { x: x - 8, y: y + drop });
    }

    drawFaultLineStairCuts(hierarchy);
    drawFaultLineDrainageAndCracks(hierarchy);
    ctx.restore();
  }

  function drawFaultLineStairCuts(hierarchy) {
    const cuts = [0.18, 0.42, 0.66, 0.84];
    const width = hierarchy.faultX1 - hierarchy.faultX0;
    cuts.forEach((cut, index) => {
      const x = hierarchy.faultX0 + width * cut;
      const y = hierarchy.faultY + (index % 2 ? 4 : -2);
      const stairWidth = 34 + index * 3;
      ctx.fillStyle = "rgba(72,65,53,0.32)";
      for (let step = 0; step < 5; step += 1) {
        const p = worldToScreen(x - stairWidth * 0.5 + step * 3, y + step * 8);
        ctx.fillRect(p.x, p.y, worldSize(stairWidth - step * 6), Math.max(2, worldSize(3)));
      }
      ctx.strokeStyle = "rgba(202,180,126,0.18)";
      ctx.lineWidth = Math.max(1, worldSize(0.9));
      drawWorldSegment({ x: x - stairWidth * 0.55, y: y - 3 }, { x: x + stairWidth * 0.55, y: y - 6 });
    });
  }

  function drawFaultLineDrainageAndCracks(hierarchy) {
    const width = hierarchy.faultX1 - hierarchy.faultX0;
    for (let i = 0; i < 9; i += 1) {
      const seed = `fault-drain:${i}`;
      const x = hierarchy.faultX0 + width * (0.08 + seededUnit(`${seed}:x`) * 0.84);
      const y = hierarchy.faultY + 20 + seededUnit(`${seed}:y`) * 20;
      ctx.strokeStyle = i % 3 === 0 ? "rgba(36,60,55,0.22)" : "rgba(42,31,24,0.22)";
      ctx.lineWidth = Math.max(1, worldSize(i % 3 === 0 ? 2.2 : 1.1));
      ctx.beginPath();
      const a = worldToScreen(x - 16, y);
      const b = worldToScreen(x + 22, y + 5);
      ctx.moveTo(a.x, a.y);
      ctx.quadraticCurveTo((a.x + b.x) / 2, a.y + worldSize(7), b.x, b.y);
      ctx.stroke();
    }
  }

  function drawFossFieldDepressionDetails(hierarchy) {
    const field = hierarchy.fossField;
    if (!field) return;

    const bounds = boundsForFeature(field);
    if (!rectInView(bounds, 180)) return;
    const center = centerOfBounds(bounds);
    const p = worldToScreen(center.x, center.y);
    const rx = worldSize(bounds.w * 0.62);
    const ry = worldSize(bounds.h * 0.48);

    ctx.save();
    ctx.strokeStyle = "rgba(31,42,27,0.5)";
    ctx.lineWidth = Math.max(2, worldSize(4));
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + worldSize(bounds.h * 0.06), rx, ry, -0.02, Math.PI * 0.02, Math.PI * 1.94);
    ctx.stroke();

    ctx.strokeStyle = "rgba(148,136,93,0.27)";
    ctx.lineWidth = Math.max(1, worldSize(1.4));
    for (let i = 0; i < 4; i += 1) {
      ctx.beginPath();
      ctx.ellipse(
        p.x,
        p.y + worldSize(bounds.h * (0.06 + i * 0.025)),
        rx * (0.9 - i * 0.09),
        ry * (0.83 - i * 0.08),
        -0.02,
        Math.PI * 0.05,
        Math.PI * 1.88
      );
      ctx.stroke();
    }

    ctx.strokeStyle = "rgba(76,95,60,0.22)";
    ctx.lineWidth = Math.max(1, worldSize(1));
    for (let i = 0; i < 8; i += 1) {
      const yy = bounds.y + bounds.h * (0.18 + i * 0.085);
      drawWorldSegment({ x: bounds.x + bounds.w * 0.12, y: yy }, { x: bounds.x + bounds.w * 0.88, y: yy + (i % 2 ? 3 : -3) });
    }
    ctx.restore();
  }

  function drawAthleticBasinDetails(hierarchy) {
    (hierarchy.athleticBasin || []).forEach((feature) => {
      const bounds = boundsForFeature(feature);
      if (!rectInView(bounds, 150)) return;
      const center = centerOfBounds(bounds);
      const seedBase = `${featureSeed(feature, "athletic-basin")}:basin`;

      ctx.save();
      ctx.strokeStyle = "rgba(36,38,29,0.28)";
      ctx.lineWidth = Math.max(2, worldSize(3));
      const p = worldToScreen(center.x, center.y);
      ctx.beginPath();
      ctx.ellipse(p.x, p.y + worldSize(bounds.h * 0.05), worldSize(bounds.w * 0.54), worldSize(bounds.h * 0.5), 0, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = "rgba(175,152,91,0.12)";
      ctx.lineWidth = Math.max(1, worldSize(1));
      for (let i = 0; i < 5; i += 1) {
        const x = bounds.x + bounds.w * (0.12 + seededUnit(`${seedBase}:${i}:x`) * 0.76);
        const y = bounds.y + bounds.h * (0.16 + seededUnit(`${seedBase}:${i}:y`) * 0.68);
        drawWorldSegment({ x: x - 22, y }, { x: x + 32, y: y + (i % 2 ? 4 : -4) });
      }
      ctx.restore();
    });
  }

  function drawHighGroundMassingPressure(hierarchy) {
    (hierarchy.highGroundAnchors || []).forEach((feature) => {
      const label = `${feature.name || ""} ${feature.osmLabel || ""} ${feature.displayLabel || ""}`.toLowerCase();
      if (!/harstad|karen hille|olson|red square/.test(label)) return;

      const bounds = boundsForFeature(feature);
      if (!rectInView(bounds, 180)) return;
      const center = centerOfBounds(bounds);
      const pressure = label.includes("harstad")
        ? "rgba(20,13,11,0.14)"
        : label.includes("olson") || label.includes("karen")
          ? "rgba(9,18,20,0.12)"
          : "rgba(80,42,30,0.08)";
      fillWorldEllipse(
        { x: center.x, y: center.y + bounds.h * 0.42 },
        bounds.w * (label.includes("red square") ? 0.8 : 0.68),
        bounds.h * (label.includes("red square") ? 0.46 : 0.58),
        -0.04,
        pressure
      );
    });
  }

  function drawLandmarkTerrainUnderlay() {
    if (!map?.storyLandmarks) return;

    map.storyLandmarks.forEach((landmark) => {
      if (!pointInView(landmark, landmark.size + 260)) return;

      if (landmark.id === "crimson-commons") {
        drawCrimsonCommonsElevationUnderlay(landmark);
      } else if (landmark.kind === "rose_sigil") {
        drawCathedralElevationUnderlay(landmark);
      } else if (landmark.kind === "historic_hall") {
        drawHarrowsteadElevationUnderlay(landmark);
      } else if (landmark.kind === "ship_prow") {
        drawProwElevationUnderlay(landmark);
      } else if (landmark.kind === "rune_stones") {
        drawRuneGroveUnderlay(landmark);
      }
    });
  }

  function drawLandmarkTerrainDetails() {
    if (!map?.storyLandmarks) return;

    map.storyLandmarks.forEach((landmark) => {
      if (!pointInView(landmark, landmark.size + 220)) return;

      if (landmark.id === "crimson-commons") {
        drawCrimsonCommonsTerrainDetails(landmark);
      } else if (landmark.kind === "rose_sigil") {
        drawCathedralTerrainDetails(landmark);
      } else if (landmark.kind === "historic_hall") {
        drawHarrowsteadTerrainDetails(landmark);
      } else if (landmark.kind === "ship_prow") {
        drawProwTerrainDetails(landmark);
      } else if (landmark.kind === "rune_stones") {
        drawRuneGroveTerrainDetails(landmark);
      } else if (landmark.kind === "clocktower") {
        drawClocktowerApproachDetails(landmark);
      }
    });
  }

  function drawCrimsonCommonsElevationUnderlay(landmark) {
    const p = worldToScreen(landmark.x, landmark.y);
    const r = Math.max(18, worldSize(landmark.size));

    ctx.save();
    drawScreenEllipse(p.x + r * 0.12, p.y + r * 0.48, r * 2.42, r * 1.34, 0, "rgba(24,16,13,0.2)");
    drawScreenEllipse(p.x, p.y + r * 0.28, r * 2.24, r * 1.18, 0, "rgba(77,54,38,0.18)");
    drawScreenEllipse(p.x, p.y + r * 0.1, r * 1.9, r * 0.98, 0, "rgba(124,56,42,0.15)");
    drawScreenEllipse(p.x, p.y - r * 0.06, r * 0.9, r * 0.48, 0, "rgba(71,41,32,0.24)");

    const patches = [
      [-1.92, 0.14, 0.5, 0.16, -0.2],
      [1.74, 0.3, 0.42, 0.13, 0.12],
      [-0.72, 0.98, 0.58, 0.15, 0.04],
      [0.98, -0.62, 0.38, 0.1, -0.18]
    ];
    patches.forEach((patch, index) => {
      drawScreenEllipse(
        p.x + r * patch[0],
        p.y + r * patch[1],
        r * patch[2],
        r * patch[3],
        patch[4],
        index % 2 ? "rgba(68,83,45,0.16)" : "rgba(91,62,37,0.18)"
      );
    });
    ctx.restore();
  }

  function drawCathedralElevationUnderlay(landmark) {
    const p = worldToScreen(landmark.x, landmark.y);
    const r = Math.max(18, worldSize(landmark.size));

    ctx.save();
    drawScreenEllipse(p.x + r * 0.12, p.y + r * 0.62, r * 2.18, r * 1.04, 0, "rgba(10,18,19,0.22)");
    drawScreenEllipse(p.x, p.y + r * 0.34, r * 1.92, r * 0.84, 0, "rgba(65,78,73,0.2)");
    drawScreenEllipse(p.x, p.y + r * 0.1, r * 1.55, r * 0.62, 0, "rgba(102,119,108,0.16)");
    drawScreenEllipse(p.x, p.y - r * 0.06, r * 1.2, r * 0.48, 0, "rgba(110,164,168,0.08)");
    ctx.restore();
  }

  function drawHarrowsteadElevationUnderlay(landmark) {
    const p = worldToScreen(landmark.x, landmark.y);
    const r = Math.max(16, worldSize(landmark.size));

    ctx.save();
    const gradient = ctx.createRadialGradient(p.x, p.y + r * 0.2, r * 0.25, p.x, p.y + r * 0.44, r * 2.0);
    gradient.addColorStop(0, "rgba(35,24,19,0.22)");
    gradient.addColorStop(0.55, "rgba(20,17,16,0.28)");
    gradient.addColorStop(1, "rgba(5,8,9,0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(p.x + r * 0.16, p.y + r * 0.42, r * 2.06, r * 1.12, -0.08, 0, Math.PI * 2);
    ctx.fill();

    drawScreenEllipse(p.x - r * 0.04, p.y + r * 0.74, r * 1.34, r * 0.24, -0.04, "rgba(50,43,36,0.24)");
    ctx.restore();
  }

  function drawProwElevationUnderlay(landmark) {
    const p = worldToScreen(landmark.x, landmark.y);
    const r = Math.max(15, worldSize(landmark.size));

    ctx.save();
    drawScreenEllipse(p.x - r * 0.02, p.y + r * 0.38, r * 1.52, r * 0.62, -0.16, "rgba(15,20,21,0.2)");
    ctx.fillStyle = "rgba(42,47,44,0.22)";
    ctx.beginPath();
    ctx.moveTo(p.x - r * 1.36, p.y + r * 0.52);
    ctx.quadraticCurveTo(p.x - r * 0.3, p.y + r * 0.18, p.x + r * 1.22, p.y + r * 0.3);
    ctx.lineTo(p.x + r * 0.76, p.y + r * 0.82);
    ctx.quadraticCurveTo(p.x - r * 0.22, p.y + r * 0.96, p.x - r * 1.44, p.y + r * 0.74);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawRuneGroveUnderlay(landmark) {
    const p = worldToScreen(landmark.x, landmark.y);
    const r = Math.max(16, worldSize(landmark.size));

    ctx.save();
    drawScreenEllipse(p.x, p.y + r * 0.2, r * 1.9, r * 1.0, 0, "rgba(10,35,20,0.2)");
    drawScreenEllipse(p.x - r * 0.12, p.y + r * 0.12, r * 1.34, r * 0.72, -0.08, "rgba(33,70,38,0.18)");
    drawScreenEllipse(p.x + r * 0.16, p.y + r * 0.5, r * 1.15, r * 0.36, 0.04, "rgba(41,32,23,0.18)");
    ctx.restore();
  }

  function drawCrimsonCommonsTerrainDetails(landmark) {
    const p = worldToScreen(landmark.x, landmark.y);
    const r = Math.max(18, worldSize(landmark.size));

    ctx.save();
    ctx.strokeStyle = "rgba(39,24,20,0.34)";
    ctx.lineWidth = Math.max(2, worldSize(2.4));
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + r * 0.24, r * 2.06, r * 1.08, 0, Math.PI * 0.06, Math.PI * 0.94);
    ctx.stroke();
    ctx.strokeStyle = "rgba(195,114,75,0.28)";
    ctx.lineWidth = Math.max(1, worldSize(1.25));
    for (let ring = 0; ring < 3; ring += 1) {
      ctx.beginPath();
      ctx.ellipse(
        p.x,
        p.y + r * (0.2 - ring * 0.08),
        r * (1.78 - ring * 0.4),
        r * (0.9 - ring * 0.19),
        0,
        Math.PI * 0.03,
        Math.PI * 1.9
      );
      ctx.stroke();
    }

    ctx.strokeStyle = "rgba(42,28,22,0.32)";
    ctx.lineWidth = Math.max(1, worldSize(1.7));
    for (let i = -5; i <= 5; i += 1) {
      const x = p.x + i * r * 0.26;
      ctx.beginPath();
      ctx.moveTo(x - r * 0.08, p.y + r * 0.8);
      ctx.lineTo(x + r * 0.04, p.y + r * 1.08);
      ctx.stroke();
    }

    ctx.fillStyle = "rgba(57,72,40,0.28)";
    [
      [-1.48, -0.5, 0.44, 0.1, -0.18],
      [1.5, -0.42, 0.42, 0.1, 0.14],
      [-1.58, 0.58, 0.5, 0.1, 0.16],
      [1.42, 0.64, 0.48, 0.1, -0.12]
    ].forEach((wall) => {
      drawScreenEllipse(p.x + r * wall[0], p.y + r * wall[1], r * wall[2], r * wall[3], wall[4], "rgba(71,83,47,0.24)");
      drawScreenEllipse(p.x + r * wall[0], p.y + r * (wall[1] - 0.04), r * wall[2] * 0.85, r * wall[3] * 0.45, wall[4], "rgba(132,111,70,0.22)");
    });
    ctx.restore();
  }

  function drawCathedralTerrainDetails(landmark) {
    const p = worldToScreen(landmark.x, landmark.y);
    const r = Math.max(18, worldSize(landmark.size));

    ctx.save();
    ctx.strokeStyle = "rgba(33,47,48,0.44)";
    ctx.lineWidth = Math.max(2, worldSize(3));
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + r * 0.38, r * 1.74, r * 0.76, 0, Math.PI * 0.06, Math.PI * 0.95);
    ctx.stroke();

    for (let i = 0; i < 6; i += 1) {
      const y = p.y + r * (0.54 + i * 0.085);
      const w = r * (1.12 + i * 0.1);
      ctx.fillStyle = i % 2 ? "rgba(78,86,80,0.42)" : "rgba(95,105,97,0.34)";
      ctx.fillRect(p.x - w, y, w * 2, Math.max(2, worldSize(4.2)));
      ctx.strokeStyle = "rgba(177,203,190,0.16)";
      ctx.lineWidth = Math.max(1, worldSize(0.8));
      ctx.beginPath();
      ctx.moveTo(p.x - w, y);
      ctx.lineTo(p.x + w, y);
      ctx.stroke();
    }

    ctx.strokeStyle = "rgba(145,218,221,0.18)";
    ctx.lineWidth = Math.max(1, worldSize(1.4));
    ctx.beginPath();
    ctx.moveTo(p.x - r * 1.32, p.y + r * 0.26);
    ctx.quadraticCurveTo(p.x, p.y + r * 0.5, p.x + r * 1.32, p.y + r * 0.26);
    ctx.stroke();

    drawBuriedInfrastructureHint(p.x - r * 1.12, p.y + r * 0.62, r * 0.36, "sanctuary");
    ctx.restore();
  }

  function drawHarrowsteadTerrainDetails(landmark) {
    const p = worldToScreen(landmark.x, landmark.y);
    const r = Math.max(16, worldSize(landmark.size));

    ctx.save();
    ctx.strokeStyle = "rgba(22,17,14,0.42)";
    ctx.lineWidth = Math.max(2, worldSize(3.2));
    ctx.beginPath();
    ctx.moveTo(p.x - r * 1.48, p.y + r * 0.52);
    ctx.quadraticCurveTo(p.x - r * 0.2, p.y + r * 0.32, p.x + r * 1.48, p.y + r * 0.56);
    ctx.stroke();

    ctx.strokeStyle = "rgba(104,88,70,0.34)";
    ctx.lineWidth = Math.max(1, worldSize(1.2));
    for (let i = -6; i <= 6; i += 1) {
      const x = p.x + i * r * 0.22;
      ctx.beginPath();
      ctx.moveTo(x, p.y + r * 0.42);
      ctx.lineTo(x - r * 0.18, p.y + r * 0.9);
      ctx.stroke();
    }

    ctx.fillStyle = "rgba(20,15,13,0.48)";
    ctx.fillRect(p.x - r * 0.34, p.y + r * 0.42, r * 0.68, Math.max(2, r * 0.08));
    ctx.strokeStyle = "rgba(91,80,66,0.5)";
    ctx.lineWidth = Math.max(1, worldSize(1.1));
    for (let i = -2; i <= 2; i += 1) {
      ctx.beginPath();
      ctx.moveTo(p.x + i * r * 0.13, p.y + r * 0.42);
      ctx.lineTo(p.x + i * r * 0.13, p.y + r * 0.5);
      ctx.stroke();
    }

    ctx.strokeStyle = "rgba(47,89,44,0.34)";
    ctx.lineWidth = Math.max(1, worldSize(1.4));
    for (let i = -3; i <= 3; i += 1) {
      const x = p.x + i * r * 0.34;
      ctx.beginPath();
      ctx.moveTo(x, p.y - r * 0.28);
      ctx.quadraticCurveTo(x + r * 0.08, p.y + r * 0.02, x - r * 0.02, p.y + r * 0.34);
      ctx.stroke();
    }

    drawBuriedInfrastructureHint(p.x + r * 1.04, p.y + r * 0.72, r * 0.28, "harrowstead");
    ctx.restore();
  }

  function drawProwTerrainDetails(landmark) {
    const p = worldToScreen(landmark.x, landmark.y);
    const r = Math.max(15, worldSize(landmark.size));

    ctx.save();
    ctx.strokeStyle = "rgba(27,31,31,0.56)";
    ctx.lineWidth = Math.max(2, worldSize(3));
    ctx.beginPath();
    ctx.moveTo(p.x - r * 1.38, p.y + r * 0.38);
    ctx.quadraticCurveTo(p.x - r * 0.2, p.y + r * 0.18, p.x + r * 1.28, p.y + r * 0.3);
    ctx.stroke();

    ctx.strokeStyle = "rgba(121,83,54,0.34)";
    ctx.lineWidth = Math.max(1, worldSize(1.2));
    for (let i = 0; i < 8; i += 1) {
      const t = i / 7;
      const x = p.x - r * 1.16 + t * r * 2.0;
      const y = p.y + r * (0.43 + Math.sin(t * Math.PI) * 0.07);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - r * 0.12, y + r * 0.28);
      ctx.stroke();
    }

    ctx.strokeStyle = "rgba(135,174,164,0.18)";
    ctx.lineWidth = Math.max(1, worldSize(1.5));
    ctx.beginPath();
    ctx.moveTo(p.x - r * 0.92, p.y + r * 0.2);
    ctx.quadraticCurveTo(p.x + r * 0.25, p.y - r * 0.28, p.x + r * 1.12, p.y - r * 0.54);
    ctx.stroke();
    ctx.restore();
  }

  function drawRuneGroveTerrainDetails(landmark) {
    const p = worldToScreen(landmark.x, landmark.y);
    const r = Math.max(16, worldSize(landmark.size));

    ctx.save();
    ctx.strokeStyle = "rgba(84,56,31,0.5)";
    ctx.lineWidth = Math.max(2, worldSize(2.4));
    for (let i = 0; i < 9; i += 1) {
      const angle = (Math.PI * 2 * i) / 9 + 0.16;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - r * 0.12);
      ctx.quadraticCurveTo(
        p.x + Math.cos(angle) * r * 0.52,
        p.y + Math.sin(angle) * r * 0.28,
        p.x + Math.cos(angle) * r * 1.26,
        p.y + Math.sin(angle) * r * 0.66
      );
      ctx.stroke();
    }

    const fernColors = ["rgba(47,99,50,0.5)", "rgba(70,119,61,0.44)", "rgba(91,112,58,0.38)"];
    for (let i = 0; i < 16; i += 1) {
      const seed = seededUnit(`${landmark.id}:fern:${i}`);
      const angle = Math.PI * 2 * seed;
      const dist = r * (0.62 + seededUnit(`${landmark.id}:fern-dist:${i}`) * 0.84);
      const x = p.x + Math.cos(angle) * dist;
      const y = p.y + Math.sin(angle) * dist * 0.54 + r * 0.16;
      ctx.fillStyle = fernColors[i % fernColors.length];
      ctx.beginPath();
      ctx.ellipse(x, y, Math.max(2, r * 0.055), Math.max(3, r * 0.12), angle, 0, Math.PI * 2);
      ctx.fill();
    }

    for (let i = 0; i < 7; i += 1) {
      const x = p.x + r * (-1 + i * 0.32);
      const y = p.y + r * (0.62 + (i % 2) * 0.08);
      ctx.fillStyle = "rgba(183,164,112,0.42)";
      ctx.beginPath();
      ctx.arc(x, y, Math.max(2, r * 0.035), Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = "rgba(70,48,32,0.36)";
      ctx.fillRect(x - r * 0.012, y, r * 0.024, r * 0.07);
    }
    ctx.restore();
  }

  function drawClocktowerApproachDetails(landmark) {
    const p = worldToScreen(landmark.x, landmark.y);
    const r = Math.max(16, worldSize(landmark.size));

    ctx.save();
    ctx.fillStyle = "rgba(78,62,36,0.18)";
    for (let i = 0; i < 10; i += 1) {
      const side = i % 2 ? 1 : -1;
      const x = p.x + side * r * (0.92 + (i % 3) * 0.16);
      const y = p.y + r * (-0.42 + i * 0.12);
      drawScreenEllipse(x, y, r * 0.18, r * 0.038, 0.25 * side, "rgba(98,79,45,0.18)");
    }

    ctx.strokeStyle = "rgba(57,88,51,0.24)";
    ctx.lineWidth = Math.max(1, worldSize(1.2));
    for (let i = -3; i <= 3; i += 1) {
      ctx.beginPath();
      ctx.moveTo(p.x + i * r * 0.28, p.y + r * 0.56);
      ctx.quadraticCurveTo(p.x + i * r * 0.18, p.y + r * 0.08, p.x + i * r * 0.34, p.y - r * 0.42);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawBuriedInfrastructureHint(x, y, size, tone) {
    ctx.save();
    ctx.strokeStyle = tone === "sanctuary" ? "rgba(130,172,169,0.22)" : "rgba(112,91,68,0.24)";
    ctx.lineWidth = Math.max(1, worldSize(1.2));
    ctx.beginPath();
    ctx.arc(x, y, size, Math.PI, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = tone === "sanctuary" ? "rgba(23,42,45,0.18)" : "rgba(23,18,15,0.22)";
    ctx.fillRect(x - size * 0.82, y, size * 1.64, Math.max(2, size * 0.16));

    ctx.strokeStyle = tone === "sanctuary" ? "rgba(197,225,214,0.14)" : "rgba(177,147,94,0.14)";
    ctx.beginPath();
    ctx.moveTo(x - size * 0.64, y + size * 0.24);
    ctx.lineTo(x + size * 0.62, y + size * 0.44);
    ctx.moveTo(x - size * 0.2, y + size * 0.02);
    ctx.lineTo(x - size * 0.36, y + size * 0.38);
    ctx.stroke();
    ctx.restore();
  }

  function drawScreenEllipse(x, y, radiusX, radiusY, rotation, fillStyle, strokeStyle, lineWidth = 1) {
    ctx.save();
    ctx.fillStyle = fillStyle;
    ctx.strokeStyle = strokeStyle || "transparent";
    ctx.lineWidth = Math.max(1, lineWidth);
    ctx.beginPath();
    ctx.ellipse(x, y, radiusX, radiusY, rotation, 0, Math.PI * 2);
    ctx.fill();
    if (strokeStyle) ctx.stroke();
    ctx.restore();
  }

  function drawRoad(road) {
    if (!routeInView(road.points, road.width + 90)) return;

    const style = routeStyleForRoad(road);
    const points = visualRoutePoints(road, "road-center", style.wobble, 54);
    const visualWidth = Math.max(14, road.width * style.widthScale);

    drawPolyline(points, visualWidth + style.grassWidth, style.grassEdge);
    if (style.glow) {
      drawPolyline(points, visualWidth + style.grassWidth + 5, style.glow);
    }
    drawPolyline(points, visualWidth + style.edgeWidth, style.edge);
    drawBrokenRouteEdges(road, points, visualWidth / 2 + style.edgeWidth * 0.42, style.mud, "road-mud", 0.72, 2.6);
    drawPolyline(points, visualWidth, style.base);
    drawPolyline(points, Math.max(3, visualWidth * 0.32), style.centerWear, false);
    drawWagonTracks(road, points, visualWidth, style);
    drawRouteWearPatches(road, points, visualWidth, style, "road-wear", style.wearRate ?? 0.5, "road");
    drawBrokenRouteEdges(road, points, visualWidth / 2 - 1, style.brokenEdge, "road-edge", style.edgeBreakRate ?? 0.58, 1.35);
    drawRouteEdgeGrowth(road, points, visualWidth, style, "road-growth", style.growthRate ?? 0.35);
  }

  function drawPath(path) {
    if (!routeInView(path.points, path.width + 70)) return;

    const style = routeStyleForPath(path);
    const points = visualRoutePoints(path, "path-center", style.wobble, 28);
    const visualWidth = Math.max(8, path.width * style.widthScale);

    drawPolyline(points, visualWidth + style.grassWidth, style.grassEdge);
    if (style.glow) {
      drawPolyline(points, visualWidth + style.grassWidth + 4, style.glow);
    }
    drawPolyline(points, visualWidth + style.edgeWidth, style.edge);
    drawBrokenRouteEdges(path, points, visualWidth / 2 + style.edgeWidth * 0.65, style.wetEdge, "path-wet-edge", 0.82, 1.7);
    drawBrokenRouteEdges(path, points, visualWidth / 2 + style.edgeWidth * 0.35, style.mossEdge, "path-moss-edge", 0.78, 1.15);
    drawPolyline(points, visualWidth * 0.82, style.underlay);
    drawIrregularStoneWalkwaySegments(path, points, visualWidth, style);
    drawMossBetweenWalkwayStones(path, points, visualWidth, style);
    drawRouteWearPatches(path, points, visualWidth, style, "path-erosion", style.erosionRate, "path");
    drawBrokenRouteEdges(path, points, visualWidth / 2 - 0.5, style.brokenEdge, "path-broken-edge", 0.5, 1);
    drawRouteEdgeGrowth(path, points, visualWidth, style, "path-growth", style.growthRate);
  }

  function routeStyleForRoad(road) {
    const environment = road.environment || fallbackEnvironmentForRole(road, "road");
    const highway = road.tags?.highway || "";
    const district = visualDistrictForFeature(road);
    const palette = routePaletteForDistrict(district, "road");
    const base = envPattern(environment.tileFamily || "road_dirt_autotile") || palette.base;
    const edge = envPattern("grass_to_dirt") || palette.edge;
    if (highway === "service") {
      return roadStyleWithHierarchy({
        district,
        widthScale: 1.04,
        wobble: 2.1,
        grassWidth: 12,
        edgeWidth: 8,
        edge,
        base,
        grassEdge: palette.grassEdge,
        mud: palette.mud,
        centerWear: palette.centerWear,
        rut: palette.rut,
        brokenEdge: palette.brokenEdge,
        growth: palette.growth,
        growthBlade: palette.growthBlade,
        wear: palette.wear,
        glow: palette.glow
      }, road);
    }

    if (highway === "tertiary" || highway === "residential") {
      return roadStyleWithHierarchy({
        district,
        widthScale: 1.08,
        wobble: 2.6,
        grassWidth: 13,
        edgeWidth: 9,
        edge,
        base,
        grassEdge: palette.grassEdge,
        mud: palette.mud,
        centerWear: palette.centerWear,
        rut: palette.rut,
        brokenEdge: palette.brokenEdge,
        growth: palette.growth,
        growthBlade: palette.growthBlade,
        wear: palette.wear,
        glow: palette.glow
      }, road);
    }

    return roadStyleWithHierarchy({
      district,
      widthScale: 1.04,
      wobble: 2.4,
      grassWidth: 12,
      edgeWidth: 8,
      edge,
      base,
      grassEdge: palette.grassEdge,
      mud: palette.mud,
      centerWear: palette.centerWear,
      rut: palette.rut,
      brokenEdge: palette.brokenEdge,
      growth: palette.growth,
      growthBlade: palette.growthBlade,
      wear: palette.wear,
      glow: palette.glow
    }, road);
  }

  function roadStyleWithHierarchy(style, road) {
    const highway = road.tags?.highway || "";
    const width = road.width || 0;
    const isMain = highway === "tertiary" || highway === "residential" || width >= 18;
    const isSide = !isMain && (highway === "service" || width <= 12);

    if (isMain) {
      return {
        ...style,
        hierarchy: "main",
        widthScale: style.widthScale * 1.12,
        wobble: style.wobble + 0.35,
        grassWidth: style.grassWidth + 3,
        edgeWidth: style.edgeWidth + 1,
        mud: "rgba(42,27,19,0.7)",
        centerWear: "rgba(30,20,15,0.36)",
        wearRate: 0.66,
        edgeBreakRate: 0.72,
        growthRate: 0.3
      };
    }

    if (isSide) {
      return {
        ...style,
        hierarchy: "side",
        widthScale: style.widthScale * 0.92,
        wobble: style.wobble + 0.15,
        grassWidth: Math.max(9, style.grassWidth - 1),
        edgeWidth: Math.max(6, style.edgeWidth - 1),
        centerWear: "rgba(42,29,21,0.18)",
        wearRate: 0.42,
        edgeBreakRate: 0.48,
        growthRate: 0.46
      };
    }

    return {
      ...style,
      hierarchy: "secondary",
      wearRate: 0.52,
      edgeBreakRate: 0.58,
      growthRate: 0.36
    };
  }

  function routeStyleForPath(path) {
    const environment = path.environment || fallbackEnvironmentForRole(path, "path");
    const district = visualDistrictForFeature(path);
    const palette = routePaletteForDistrict(district, "path");
    const base = envPattern(environment.tileFamily || "stone_walkway_autotile") || palette.base;
    const edge = envPattern("moss_to_stone") || palette.edge;
    const grassEdge = envPattern("forest_border") || palette.grassEdge;
    const highway = path.tags?.highway || "";
    if (highway === "footway" || highway === "path") {
      return pathStyleWithHierarchy({
        district,
        widthScale: district === "academy" || district === "sanctuary" ? 0.58 : 0.54,
        wobble: district === "academy" ? 2.15 : 2.45,
        grassWidth: district === "academy" ? 10 : 12,
        edgeWidth: district === "academy" ? 5 : 6,
        grassEdge,
        edge,
        base,
        underlay: palette.underlay,
        stoneColors: palette.stoneColors,
        stoneStroke: palette.stoneStroke,
        stoneLine: palette.stoneLine,
        mossCrack: palette.mossCrack,
        mossEdge: palette.mossEdge,
        wetEdge: palette.wetEdge,
        brokenEdge: palette.brokenEdge,
        growth: palette.growth,
        growthBlade: palette.growthBlade,
        wear: palette.wear,
        glow: palette.glow,
        erosionRate: district === "academy" ? 0.46 : 0.58,
        growthRate: district === "academy" ? 0.58 : 0.72
      }, path);
    }

    return pathStyleWithHierarchy({
      district,
      widthScale: 0.56,
      wobble: 2.2,
      grassWidth: 10,
      edgeWidth: 5,
      grassEdge,
      edge,
      base,
      underlay: palette.underlay,
      stoneColors: palette.stoneColors,
      stoneStroke: palette.stoneStroke,
      stoneLine: palette.stoneLine,
      mossCrack: palette.mossCrack,
      mossEdge: palette.mossEdge,
      wetEdge: palette.wetEdge,
      brokenEdge: palette.brokenEdge,
      growth: palette.growth,
      growthBlade: palette.growthBlade,
      wear: palette.wear,
      glow: palette.glow,
      erosionRate: 0.42,
      growthRate: 0.52
    }, path);
  }

  function pathStyleWithHierarchy(style, path) {
    const highway = path.tags?.highway || "";
    const width = path.width || 10;
    const isMain = width >= 14 || path.tags?.footway === "crossing";
    const isSide = !isMain && (width <= 8 || highway === "path");

    if (isMain) {
      return {
        ...style,
        hierarchy: "main",
        widthScale: style.widthScale * 1.12,
        wobble: style.wobble + 0.2,
        grassWidth: style.grassWidth + 1,
        edgeWidth: style.edgeWidth + 0.5,
        wetEdge: "rgba(21,28,24,0.54)",
        wear: "rgba(42,36,28,0.32)",
        erosionRate: Math.max(style.erosionRate, 0.58),
        growthRate: Math.max(0.48, style.growthRate - 0.12)
      };
    }

    if (isSide) {
      return {
        ...style,
        hierarchy: "side",
        widthScale: style.widthScale * 0.82,
        wobble: style.wobble + 0.35,
        grassWidth: style.grassWidth + 3,
        edgeWidth: Math.max(3.5, style.edgeWidth - 1.2),
        underlay: "rgba(58,76,55,0.24)",
        edge: "rgba(45,68,43,0.34)",
        wetEdge: "rgba(22,36,28,0.32)",
        mossEdge: "rgba(61,105,54,0.68)",
        brokenEdge: "rgba(123,142,103,0.18)",
        erosionRate: Math.min(style.erosionRate, 0.34),
        growthRate: Math.max(style.growthRate, 0.78)
      };
    }

    return {
      ...style,
      hierarchy: "secondary",
      widthScale: style.widthScale * 0.94,
      grassWidth: style.grassWidth + 1,
      underlay: "rgba(67,84,61,0.3)",
      edge: "rgba(43,62,41,0.42)",
      erosionRate: Math.min(style.erosionRate, 0.44),
      growthRate: Math.max(style.growthRate, 0.64)
    };
  }

  function visualDistrictForFeature(feature) {
    if (feature.districtId) return feature.districtId;

    const environment = feature.environment || {};
    const tags = feature.tags || {};
    const text = [
      feature.displayLabel,
      feature.districtLabel,
      environment.replacement,
      environment.district,
      environment.tileFamily,
      feature.label,
      feature.osmLabel,
      feature.name,
      feature.id,
      feature.type,
      tags.amenity,
      tags.building,
      tags.highway,
      tags.leisure,
      tags.sport
    ].join(" ").toLowerCase();

    if (/moonwater|sanctuary|sacred|chapel|worship/.test(text)) return "sanctuary";
    if (/alchemy|greenhouse|conservatory/.test(text)) return "alchemy";
    if (/training|knight|gym|fitness|sport|pitch|athletic/.test(text)) return "training";
    if (/academy|university|library|archive|scholar|stone_walkway|footway/.test(text)) return "academy";
    if (/forest|wood|park/.test(text)) return "forest";
    return environment.district || "merchant";
  }

  function routePaletteForDistrict(district, role) {
    const key = district === "sacred" ? "sanctuary" : district;
    const road = {
      base: "#7b5632",
      edge: "#493321",
      grassEdge: "rgba(41,82,46,0.46)",
      mud: "rgba(49,32,22,0.58)",
      centerWear: "rgba(39,25,17,0.24)",
      rut: "rgba(35,23,16,0.52)",
      brokenEdge: "rgba(111,86,55,0.56)",
      growth: "rgba(39,86,45,0.32)",
      growthBlade: "rgba(95,128,65,0.64)",
      wear: "rgba(56,35,21,0.28)",
      glow: null
    };

    const path = {
      base: "#66705b",
      edge: "rgba(39,53,38,0.52)",
      underlay: "rgba(74,83,63,0.38)",
      grassEdge: "rgba(27,68,38,0.56)",
      mossEdge: "rgba(49,83,43,0.62)",
      wetEdge: "rgba(21,33,28,0.46)",
      brokenEdge: "rgba(145,154,120,0.26)",
      stoneLine: "rgba(44,63,43,0.24)",
      mossCrack: "rgba(59,100,48,0.48)",
      stoneStroke: "rgba(26,38,31,0.24)",
      stoneColors: [
        "rgba(107,118,94,0.62)",
        "rgba(89,105,82,0.58)",
        "rgba(126,129,105,0.52)",
        "rgba(72,91,72,0.50)"
      ],
      growth: "rgba(43,96,52,0.40)",
      growthBlade: "rgba(97,139,74,0.72)",
      wear: "rgba(35,48,36,0.24)",
      glow: null
    };

    if (role === "road") {
      if (key === "training") {
        return {
          ...road,
          base: "#6c4c2f",
          edge: "#3d2a1d",
          mud: "rgba(41,27,20,0.68)",
          centerWear: "rgba(33,22,17,0.32)",
          brokenEdge: "rgba(93,68,45,0.62)",
          wear: "rgba(40,25,17,0.34)"
        };
      }
      if (key === "alchemy") {
        return {
          ...road,
          grassEdge: "rgba(42,95,49,0.56)",
          mud: "rgba(43,40,24,0.56)",
          brokenEdge: "rgba(79,103,49,0.48)",
          growth: "rgba(55,119,58,0.38)",
          growthBlade: "rgba(117,158,78,0.74)"
        };
      }
      if (key === "sanctuary") {
        return {
          ...road,
          base: "#85643d",
          edge: "#5f4b35",
          grassEdge: "rgba(71,101,70,0.45)",
          brokenEdge: "rgba(177,160,104,0.42)",
          growth: "rgba(96,128,91,0.28)",
          glow: "rgba(142,220,206,0.08)"
        };
      }
      return road;
    }

    if (key === "training") {
      return {
        ...path,
        base: "#5e604d",
        underlay: "rgba(68,63,47,0.42)",
        edge: "rgba(48,42,31,0.56)",
        grassEdge: "rgba(34,67,36,0.62)",
        mossEdge: "rgba(65,79,42,0.52)",
        wetEdge: "rgba(32,25,20,0.50)",
        stoneLine: "rgba(47,39,29,0.28)",
        mossCrack: "rgba(70,84,43,0.42)",
        stoneColors: [
          "rgba(98,91,69,0.58)",
          "rgba(79,78,62,0.56)",
          "rgba(111,100,75,0.48)"
        ],
        wear: "rgba(42,30,22,0.34)",
        brokenEdge: "rgba(90,71,48,0.42)"
      };
    }
    if (key === "alchemy") {
      return {
        ...path,
        base: "#647055",
        underlay: "rgba(56,82,48,0.44)",
        edge: "rgba(47,82,45,0.58)",
        grassEdge: "rgba(34,92,45,0.68)",
        mossEdge: "rgba(70,126,58,0.68)",
        wetEdge: "rgba(23,45,31,0.52)",
        stoneLine: "rgba(112,144,83,0.26)",
        mossCrack: "rgba(73,135,61,0.54)",
        stoneColors: [
          "rgba(93,113,81,0.60)",
          "rgba(79,103,72,0.56)",
          "rgba(113,121,83,0.50)"
        ],
        growth: "rgba(57,125,62,0.50)",
        growthBlade: "rgba(117,163,81,0.78)",
        wear: "rgba(42,66,35,0.24)"
      };
    }
    if (key === "sanctuary") {
      return {
        ...path,
        base: "#858d74",
        underlay: "rgba(87,97,78,0.36)",
        edge: "rgba(77,91,75,0.48)",
        grassEdge: "rgba(75,105,78,0.46)",
        mossEdge: "rgba(98,132,88,0.48)",
        wetEdge: "rgba(38,58,54,0.36)",
        stoneLine: "rgba(185,201,164,0.22)",
        mossCrack: "rgba(103,135,93,0.42)",
        stoneStroke: "rgba(45,65,59,0.20)",
        stoneColors: [
          "rgba(146,153,126,0.54)",
          "rgba(122,139,114,0.50)",
          "rgba(166,163,130,0.44)"
        ],
        growth: "rgba(93,129,91,0.28)",
        growthBlade: "rgba(157,181,123,0.62)",
        wear: "rgba(73,69,51,0.16)",
        glow: "rgba(142,220,206,0.13)"
      };
    }
    return path;
  }

  function visualRoutePoints(route, key, wobble, spacing) {
    const source = route.points || [];
    if (source.length < 2) return source;

    const first = source[0];
    const last = source[source.length - 1];
    const cacheKey = [
      key,
      source.length,
      Math.round(wobble * 100),
      spacing,
      Math.round(first.x),
      Math.round(first.y),
      Math.round(last.x),
      Math.round(last.y)
    ].join(":");
    let cache = routeRenderCache.get(route);
    if (!cache) {
      cache = {};
      routeRenderCache.set(route, cache);
    }
    if (!cache[cacheKey]) {
      cache[cacheKey] = buildVisualRoutePoints(source, `${featureSeed(route, key)}:${key}`, wobble, spacing);
    }
    return cache[cacheKey];
  }

  function buildVisualRoutePoints(points, seed, wobble, spacing) {
    const result = [];
    points.forEach((point, index) => {
      if (index === 0) {
        result.push({ x: point.x, y: point.y });
        return;
      }

      const a = points[index - 1];
      const b = point;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const length = Math.hypot(dx, dy);
      const samples = Math.max(1, Math.ceil(length / spacing));
      const nx = length > 0 ? -dy / length : 0;
      const ny = length > 0 ? dx / length : 0;
      const tx = length > 0 ? dx / length : 0;
      const ty = length > 0 ? dy / length : 0;

      for (let sample = 1; sample <= samples; sample += 1) {
        const t = sample / samples;
        const fade = Math.sin(Math.PI * t);
        const sideNoise = (seededUnit(`${seed}:normal:${index}:${sample}`) - 0.5) * 2 * wobble * fade;
        const forwardNoise = (seededUnit(`${seed}:tangent:${index}:${sample}`) - 0.5) * wobble * 0.4 * fade;
        result.push({
          x: a.x + dx * t + nx * sideNoise + tx * forwardNoise,
          y: a.y + dy * t + ny * sideNoise + ty * forwardNoise
        });
      }
    });
    return result;
  }

  function drawWagonTracks(route, points, width, style) {
    const offset = Math.max(4, width * 0.23);
    [-1, 1].forEach((side) => {
      const track = offsetRoutePoints(points, side * offset, `${featureSeed(route, "road")}:rut:${side}`, 1.4);
      drawPolyline(track, Math.max(1.3, width * 0.048), style.rut, true, [18, 13]);
    });
  }

  function drawStoneWalkwaySeams(route, points, width, style) {
    if (!style.stoneLine) return;

    ctx.save();
    ctx.strokeStyle = style.stoneLine;
    ctx.lineWidth = worldSize(1);
    ctx.lineCap = "round";

    for (let i = 1; i < points.length; i += 1) {
      const a = points[i - 1];
      const b = points[i];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const length = Math.hypot(dx, dy);
      if (length < 8) continue;

      const nx = -dy / length;
      const ny = dx / length;
      const samples = Math.min(8, Math.max(1, Math.floor(length / 27)));
      for (let sample = 1; sample <= samples; sample += 1) {
        const seed = `${featureSeed(route, "path")}:stone:${i}:${sample}`;
        if (seededUnit(`${seed}:skip`) < 0.18) continue;

        const t = (sample - 0.28 + seededUnit(`${seed}:t`) * 0.56) / (samples + 0.6);
        const center = {
          x: a.x + dx * t,
          y: a.y + dy * t
        };
        const half = width * (0.30 + seededUnit(`${seed}:w`) * 0.18);
        drawWorldSegment(
          { x: center.x - nx * half, y: center.y - ny * half },
          { x: center.x + nx * half, y: center.y + ny * half }
        );
      }
    }

    ctx.restore();
  }

  function drawIrregularStoneWalkwaySegments(route, points, width, style) {
    const colors = style.stoneColors || [style.base];
    const routeSeed = `${featureSeed(route, "path")}:academy-stones`;

    for (let i = 1; i < points.length; i += 1) {
      const a = points[i - 1];
      const b = points[i];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const length = Math.hypot(dx, dy);
      if (length < 8) continue;

      const tx = dx / length;
      const ty = dy / length;
      const nx = -dy / length;
      const ny = dx / length;
      const samples = Math.min(10, Math.max(1, Math.floor(length / 22)));

      for (let sample = 1; sample <= samples; sample += 1) {
        const seed = `${routeSeed}:${i}:${sample}`;
        if (seededUnit(`${seed}:gap`) < 0.08) continue;

        const t = clamp((sample - 0.28 + seededUnit(`${seed}:t`) * 0.56) / (samples + 0.45), 0.04, 0.96);
        const centerOffset = (seededUnit(`${seed}:side`) - 0.5) * width * 0.24;
        const center = {
          x: a.x + dx * t + nx * centerOffset,
          y: a.y + dy * t + ny * centerOffset
        };
        const halfLength = 4.5 + seededUnit(`${seed}:len`) * 7.5;
        const halfWidth = width * (0.21 + seededUnit(`${seed}:width`) * 0.18);
        const color = colors[Math.floor(seededUnit(`${seed}:color`) * colors.length)] || style.base;
        const slab = stoneSlabPolygon(center, tx, ty, nx, ny, halfLength, halfWidth, seed);

        drawWorldPolygon(slab, color, style.stoneStroke, 0.65 + seededUnit(`${seed}:stroke`) * 0.45);

        if (style.mossCrack && seededUnit(`${seed}:moss`) > 0.38) {
          fillWorldEllipse(
            {
              x: center.x + nx * (seededUnit(`${seed}:mx`) - 0.5) * width * 0.65,
              y: center.y + ny * (seededUnit(`${seed}:my`) - 0.5) * width * 0.65
            },
            0.8 + seededUnit(`${seed}:mrx`) * 2.2,
            0.45 + seededUnit(`${seed}:mry`) * 1.3,
            Math.atan2(dy, dx),
            style.mossCrack
          );
        }
      }
    }
  }

  function drawMossBetweenWalkwayStones(route, points, width, style) {
    if (!style.mossCrack && !style.stoneLine) return;

    const routeSeed = `${featureSeed(route, "path")}:stone-moss`;
    ctx.save();
    ctx.strokeStyle = style.mossCrack || style.stoneLine;
    ctx.lineWidth = worldSize(0.85);
    ctx.lineCap = "round";

    for (let i = 1; i < points.length; i += 1) {
      const a = points[i - 1];
      const b = points[i];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const length = Math.hypot(dx, dy);
      if (length < 10) continue;

      const tx = dx / length;
      const ty = dy / length;
      const nx = -dy / length;
      const ny = dx / length;
      const samples = Math.min(10, Math.max(1, Math.floor(length / 24)));

      for (let sample = 1; sample <= samples; sample += 1) {
        const seed = `${routeSeed}:${i}:${sample}`;
        if (seededUnit(`${seed}:chance`) < 0.24) continue;

        const t = clamp((sample - 0.18 + seededUnit(`${seed}:t`) * 0.36) / (samples + 0.2), 0.04, 0.96);
        const center = {
          x: a.x + dx * t + nx * (seededUnit(`${seed}:side`) - 0.5) * width * 0.45,
          y: a.y + dy * t + ny * (seededUnit(`${seed}:side-y`) - 0.5) * width * 0.45
        };
        const half = width * (0.12 + seededUnit(`${seed}:half`) * 0.2);
        drawWorldSegment(
          {
            x: center.x - nx * half + tx * (seededUnit(`${seed}:a`) - 0.5) * 2,
            y: center.y - ny * half + ty * (seededUnit(`${seed}:b`) - 0.5) * 2
          },
          {
            x: center.x + nx * half + tx * (seededUnit(`${seed}:c`) - 0.5) * 2,
            y: center.y + ny * half + ty * (seededUnit(`${seed}:d`) - 0.5) * 2
          }
        );
      }
    }

    ctx.restore();
  }

  function stoneSlabPolygon(center, tx, ty, nx, ny, halfLength, halfWidth, seed) {
    const corners = [
      [-halfLength, -halfWidth],
      [halfLength, -halfWidth],
      [halfLength, halfWidth],
      [-halfLength, halfWidth]
    ];

    return corners.map(([along, side], index) => {
      const alongJitter = (seededUnit(`${seed}:aj:${index}`) - 0.5) * 3.2;
      const sideJitter = (seededUnit(`${seed}:sj:${index}`) - 0.5) * 2.6;
      return {
        x: center.x + tx * (along + alongJitter) + nx * (side + sideJitter),
        y: center.y + ty * (along + alongJitter) + ny * (side + sideJitter)
      };
    });
  }

  function drawRouteWearPatches(route, points, width, style, key, rate, material) {
    if (!style.wear) return;

    const routeSeed = `${featureSeed(route, key)}:${key}`;
    const spacing = material === "road" ? 72 : 46;
    ctx.save();
    ctx.fillStyle = style.wear;

    for (let i = 1; i < points.length; i += 1) {
      const a = points[i - 1];
      const b = points[i];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const length = Math.hypot(dx, dy);
      if (length < 10) continue;

      const nx = -dy / length;
      const ny = dx / length;
      const angle = Math.atan2(dy, dx);
      const samples = Math.min(material === "road" ? 5 : 6, Math.max(1, Math.floor(length / spacing)));

      for (let sample = 1; sample <= samples; sample += 1) {
        const seed = `${routeSeed}:${i}:${sample}`;
        if (seededUnit(`${seed}:chance`) > rate) continue;

        const t = (sample - 0.2 + seededUnit(`${seed}:t`) * 0.4) / (samples + 0.4);
        const sideOffset = (seededUnit(`${seed}:side`) - 0.5) * width * (material === "road" ? 0.32 : 0.68);
        const center = {
          x: a.x + dx * t + nx * sideOffset,
          y: a.y + dy * t + ny * sideOffset
        };
        const rx = material === "road"
          ? 5 + seededUnit(`${seed}:rx`) * 12
          : 2.5 + seededUnit(`${seed}:rx`) * 7;
        const ry = material === "road"
          ? 1.5 + seededUnit(`${seed}:ry`) * 3
          : 1 + seededUnit(`${seed}:ry`) * 2.8;
        fillWorldEllipse(center, rx, ry, angle, style.wear);
      }
    }

    ctx.restore();
  }

  function drawBrokenRouteEdges(route, points, halfWidth, color, key, chance, lineWidth) {
    if (!color) return;

    const routeSeed = `${featureSeed(route, key)}:${key}`;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = worldSize(lineWidth);
    ctx.lineCap = "round";

    for (let i = 1; i < points.length; i += 1) {
      const a = points[i - 1];
      const b = points[i];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const length = Math.hypot(dx, dy);
      if (length < 12) continue;

      const nx = -dy / length;
      const ny = dx / length;
      const tx = dx / length;
      const ty = dy / length;
      const samples = Math.min(6, Math.max(1, Math.floor(length / 42)));

      [-1, 1].forEach((side) => {
        for (let sample = 1; sample <= samples; sample += 1) {
          const seed = `${routeSeed}:${i}:${sample}:${side}`;
          if (seededUnit(`${seed}:chance`) > chance) continue;

          const t = clamp((sample - 0.35 + seededUnit(`${seed}:t`) * 0.7) / (samples + 0.2), 0.05, 0.95);
          const segmentLength = 7 + seededUnit(`${seed}:len`) * 19;
          const offset = side * (halfWidth + (seededUnit(`${seed}:offset`) - 0.5) * 6);
          const center = {
            x: a.x + dx * t + nx * offset,
            y: a.y + dy * t + ny * offset
          };
          drawWorldSegment(
            { x: center.x - tx * segmentLength * 0.5, y: center.y - ty * segmentLength * 0.5 },
            { x: center.x + tx * segmentLength * 0.5, y: center.y + ty * segmentLength * 0.5 }
          );
        }
      });
    }

    ctx.restore();
  }

  function drawRouteEdgeGrowth(route, points, width, style, key, chance) {
    if (!style.growth && !style.growthBlade) return;

    const routeSeed = `${featureSeed(route, key)}:${key}`;
    ctx.save();
    ctx.strokeStyle = style.growthBlade || style.growth;
    ctx.fillStyle = style.growth || style.growthBlade;
    ctx.lineWidth = worldSize(1);
    ctx.lineCap = "round";

    for (let i = 1; i < points.length; i += 1) {
      const a = points[i - 1];
      const b = points[i];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const length = Math.hypot(dx, dy);
      if (length < 16) continue;

      const nx = -dy / length;
      const ny = dx / length;
      const tx = dx / length;
      const ty = dy / length;
      const samples = Math.min(5, Math.max(1, Math.floor(length / 56)));

      [-1, 1].forEach((side) => {
        for (let sample = 1; sample <= samples; sample += 1) {
          const seed = `${routeSeed}:${i}:${sample}:${side}`;
          if (seededUnit(`${seed}:chance`) > chance) continue;

          const t = (sample - 0.25 + seededUnit(`${seed}:t`) * 0.5) / (samples + 0.3);
          const inward = seededUnit(`${seed}:inward`) * 5;
          const offset = side * (width / 2 - inward);
          const base = {
            x: a.x + dx * t + nx * offset,
            y: a.y + dy * t + ny * offset
          };

          if (style.growth && seededUnit(`${seed}:patch`) > 0.42) {
            fillWorldEllipse(
              {
                x: base.x + tx * (seededUnit(`${seed}:px`) - 0.5) * 6,
                y: base.y + ty * (seededUnit(`${seed}:py`) - 0.5) * 6
              },
              1.4 + seededUnit(`${seed}:rx`) * 4,
              0.8 + seededUnit(`${seed}:ry`) * 2.4,
              Math.atan2(dy, dx),
              style.growth
            );
          }

          if (style.growthBlade) {
            const bladeLength = 3 + seededUnit(`${seed}:blade`) * 7;
            drawWorldSegment(base, {
              x: base.x + nx * side * bladeLength * 0.7 + tx * (seededUnit(`${seed}:lean`) - 0.5) * 3,
              y: base.y + ny * side * bladeLength * 0.7 + ty * (seededUnit(`${seed}:lean-y`) - 0.5) * 3
            });
          }
        }
      });
    }

    ctx.restore();
  }

  function offsetRoutePoints(points, offset, seed, jitter = 0) {
    return points.map((point, index) => {
      const normal = normalAtRoutePoint(points, index);
      const localOffset = offset + (seededUnit(`${seed}:${index}:offset`) - 0.5) * jitter;
      return {
        x: point.x + normal.x * localOffset,
        y: point.y + normal.y * localOffset
      };
    });
  }

  function normalAtRoutePoint(points, index) {
    const prev = points[Math.max(0, index - 1)];
    const next = points[Math.min(points.length - 1, index + 1)];
    const dx = next.x - prev.x;
    const dy = next.y - prev.y;
    const length = Math.hypot(dx, dy) || 1;
    return {
      x: -dy / length,
      y: dx / length
    };
  }

  function fillWorldEllipse(center, radiusX, radiusY, angle, fillStyle) {
    const p = worldToScreen(center.x, center.y);
    ctx.fillStyle = fillStyle;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, worldSize(radiusX), worldSize(radiusY), angle, 0, Math.PI * 2);
    ctx.fill();
  }

  function featureSeed(feature, fallback) {
    return feature.id || feature.name || feature.osmLabel || feature.label || fallback;
  }

  function routeInView(points, padding) {
    if (!points || points.length < 2) return false;

    const bounds = boundsFromPoints(points);
    return bounds.x + bounds.w >= camera.x - padding &&
      bounds.x <= camera.x + visibleWorldWidth() + padding &&
      bounds.y + bounds.h >= camera.y - padding &&
      bounds.y <= camera.y + visibleWorldHeight() + padding;
  }

  function pointInView(point, padding = 80) {
    if (!point) return false;

    return point.x >= camera.x - padding &&
      point.x <= camera.x + visibleWorldWidth() + padding &&
      point.y >= camera.y - padding &&
      point.y <= camera.y + visibleWorldHeight() + padding;
  }

  function rectInView(bounds, padding = 80) {
    if (!bounds) return false;

    return bounds.x + bounds.w >= camera.x - padding &&
      bounds.x <= camera.x + visibleWorldWidth() + padding &&
      bounds.y + bounds.h >= camera.y - padding &&
      bounds.y <= camera.y + visibleWorldHeight() + padding;
  }

  function drawBuilding(building) {
    const points = building.coordinates || rectPoints(building);
    const style = buildingStyle(building);
    const facade = facadeForBuilding(points);
    const isProfiledBuilding = style.featureType !== "generic";
    building.__drawnProfiled = isProfiledBuilding;

    drawBuildingGrounding(building, points, facade, style);
    if (!isProfiledBuilding) {
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
      drawArchitecturalAccents(building, points, facade, style);
    } else {
      drawProfiledBuildingBase(building, points, facade, style);
      drawBuildingDoor(building, facade);
      drawFacadeWindows(building, facade, style);
      drawArchitecturalAccents(building, points, facade, style);
    }

    if (DEBUG_BUILDINGS && facade) {
      drawDebugFacade(facade);
    }
  }

  function drawPark(park) {
    const environment = park.environment || fallbackEnvironmentForRole(park, "terrain");
    const points = park.coordinates || rectPoints(park);
    const fill = envPattern(environment.tileFamily) || "#254f35";
    const edge = environment.replacement === "forest_floor"
      ? envPattern("forest_border") || "rgba(82,120,67,0.34)"
      : envPattern("grass_to_dirt") || "rgba(155,206,137,0.14)";
    drawPolygon(points, fill, "rgba(155,206,137,0.14)");
    strokePolygon(points, edge, environment.replacement === "forest_floor" ? 5 : 3);
    drawVegetationClusters(park, points, environment);
  }

  function drawWater(water) {
    const points = water.coordinates || rectPoints(water);
    drawPolygon(points, envPattern("shoreline_autotile") || "#2b5260", "rgba(159,215,222,0.2)");
    drawWaterSurfaceDetail(water, points);
    strokePolygon(points, "rgba(21,35,35,0.34)", 9);
    strokePolygon(points, envPattern("shoreline_autotile") || "rgba(159,215,222,0.28)", 5);
    drawShorelineBlend(water, points);
  }

  function drawVegetationClusters(feature, points, environment) {
    const bounds = boundsFromPoints(points);
    if (!rectInView(bounds, 90)) return;

    const district = visualDistrictForFeature(feature);
    const area = polygonArea(points);
    const count = Math.min(
      district === "sanctuary" ? 18 : 14,
      Math.max(4, Math.floor(Math.sqrt(Math.max(1, area)) / 28))
    );
    const seedBase = `${featureSeed(feature, "park")}:vegetation:${environment.replacement || "terrain"}`;

    ctx.save();
    for (let i = 0; i < count; i += 1) {
      const seed = `${seedBase}:${i}`;
      const x = bounds.x + bounds.w * (0.12 + seededUnit(`${seed}:x`) * 0.76);
      const y = bounds.y + bounds.h * (0.12 + seededUnit(`${seed}:y`) * 0.76);
      if (!pointInPolygon({ x, y }, points) || !pointInView({ x, y }, 80)) continue;

      const size = 7 + seededUnit(`${seed}:size`) * (district === "sanctuary" ? 14 : 11);
      const canopy = district === "sanctuary"
        ? "rgba(86,132,91,0.42)"
        : district === "alchemy"
          ? "rgba(68,132,66,0.46)"
          : "rgba(51,100,57,0.38)";
      const trunk = district === "sanctuary" ? "rgba(80,62,42,0.38)" : "rgba(56,45,31,0.34)";
      const p = worldToScreen(x, y);

      ctx.fillStyle = "rgba(9,18,12,0.18)";
      ctx.beginPath();
      ctx.ellipse(p.x + worldSize(2), p.y + worldSize(size * 0.42), worldSize(size * 0.75), worldSize(size * 0.25), 0, 0, Math.PI * 2);
      ctx.fill();

      if (seededUnit(`${seed}:tree`) > 0.36) {
        ctx.fillStyle = trunk;
        ctx.fillRect(p.x - worldSize(1.2), p.y + worldSize(size * 0.1), worldSize(2.4), worldSize(size * 0.55));
        ctx.fillStyle = canopy;
        ctx.beginPath();
        ctx.arc(p.x, p.y, worldSize(size * 0.62), 0, Math.PI * 2);
        ctx.arc(p.x - worldSize(size * 0.34), p.y + worldSize(size * 0.16), worldSize(size * 0.42), 0, Math.PI * 2);
        ctx.arc(p.x + worldSize(size * 0.34), p.y + worldSize(size * 0.12), worldSize(size * 0.42), 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = district === "alchemy" ? "rgba(89,151,75,0.5)" : "rgba(74,121,66,0.42)";
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, worldSize(size * 0.58), worldSize(size * 0.34), seededUnit(`${seed}:rot`) * Math.PI, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawWaterSurfaceDetail(water, points) {
    const bounds = boundsFromPoints(points);
    if (!rectInView(bounds, 90)) return;
    const seedBase = `${featureSeed(water, "water")}:surface`;
    const count = Math.min(8, Math.max(3, Math.floor(Math.sqrt(polygonArea(points)) / 38)));

    ctx.save();
    ctx.strokeStyle = "rgba(177,222,220,0.16)";
    ctx.lineWidth = Math.max(1, worldSize(1.2));
    for (let i = 0; i < count; i += 1) {
      const seed = `${seedBase}:${i}`;
      const x = bounds.x + bounds.w * (0.16 + seededUnit(`${seed}:x`) * 0.68);
      const y = bounds.y + bounds.h * (0.18 + seededUnit(`${seed}:y`) * 0.64);
      if (!pointInPolygon({ x, y }, points)) continue;

      const p = worldToScreen(x, y);
      const len = worldSize(12 + seededUnit(`${seed}:len`) * 30);
      ctx.beginPath();
      ctx.moveTo(p.x - len * 0.5, p.y);
      ctx.quadraticCurveTo(p.x, p.y - worldSize(3), p.x + len * 0.5, p.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawShorelineBlend(water, points) {
    const bounds = boundsFromPoints(points);
    if (!rectInView(bounds, 90)) return;

    ctx.save();
    ctx.strokeStyle = "rgba(35,71,61,0.34)";
    ctx.lineWidth = worldSize(4);
    directionalEdges(points, "bottom").forEach((edge) => drawWorldSegment(edge.a, edge.b));

    const seedBase = `${featureSeed(water, "water")}:shore`;
    const count = Math.min(12, Math.max(4, Math.floor(Math.sqrt(polygonArea(points)) / 34)));
    for (let i = 0; i < count; i += 1) {
      const seed = `${seedBase}:${i}`;
      const x = bounds.x + bounds.w * seededUnit(`${seed}:x`);
      const y = bounds.y + bounds.h * seededUnit(`${seed}:y`);
      if (!pointInPolygon({ x, y }, points) || !pointInView({ x, y }, 80)) continue;
      fillWorldEllipse(
        { x, y },
        3 + seededUnit(`${seed}:rx`) * 10,
        1.4 + seededUnit(`${seed}:ry`) * 4,
        seededUnit(`${seed}:rot`) * Math.PI,
        seededUnit(`${seed}:type`) > 0.5 ? "rgba(83,116,72,0.18)" : "rgba(36,59,54,0.22)"
      );
    }
    ctx.restore();
  }

  function drawPlaza(plaza) {
    const points = plaza.coordinates || rectPoints(plaza);
    drawPolygon(points, envPattern("plaza_stone_autotile") || "#71684f", "rgba(201,171,108,0.2)");
    strokePolygon(points, envPattern("dirt_to_stone") || "rgba(94,75,48,0.5)", 4);
  }

  function profiledBuildingForLandmark(landmark, profiles = []) {
    if (!landmark?.anchorIsBuilding || !map?.buildings?.length) return null;

    const anchorLabel = (landmark.anchorSourceName || landmark.osmLabel || "").trim().toLowerCase();
    const building = (map.buildings || []).find((candidate) => {
      if (landmark.anchorFeatureId && candidate.id === landmark.anchorFeatureId) return true;
      if (!anchorLabel) return false;
      const candidateLabel = (sourceLabelForFeature(candidate) || candidate.osmLabel || candidate.displayLabel || "").trim().toLowerCase();
      return candidateLabel === anchorLabel;
    });
    if (!building) return null;

    const style = buildingStyle(building);
    if (style.featureType === "generic") return null;
    if (profiles.length && !profiles.includes(style.featureType)) return null;
    return { building, style };
  }

  function landmarkAnchorsProfiledBuilding(landmark, profiles = []) {
    return Boolean(profiledBuildingForLandmark(landmark, profiles));
  }

  function drawStoryLandmarkGround(landmark) {
    if (!pointInView(landmark, landmark.size + 80)) return;

    const p = worldToScreen(landmark.x, landmark.y);
    const radius = Math.max(16, worldSize(landmark.size));

    ctx.save();
    if (landmark.id === "crimson-commons") {
      drawCrimsonCommonsGround(p, radius);
    } else if (landmark.kind === "clocktower") {
      drawTowerGround(landmark, p, radius);
    } else if (landmark.kind === "rose_sigil") {
      drawSanctuaryGround(p, radius);
    } else if (landmark.kind === "organ_hall") {
      drawResonantHallGround(p, radius);
    } else if (landmark.kind === "historic_hall") {
      if (landmarkAnchorsProfiledBuilding(landmark, ["harrowstead"])) {
        drawHarrowsteadGroundAccent(p, radius);
      } else {
        drawHarrowsteadGround(p, radius);
      }
    } else if (landmark.kind === "rune_stones") {
      drawRuneStoneGround(p, radius);
    } else {
      drawGenericLandmarkGround(landmark, p, radius);
    }
    ctx.restore();
  }

  function drawCrimsonCommonsGround(p, radius) {
    ctx.fillStyle = "rgba(31,17,13,0.22)";
    ctx.beginPath();
    ctx.ellipse(p.x + radius * 0.08, p.y + radius * 0.28, radius * 2.08, radius * 1.18, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(83,39,31,0.6)";
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + radius * 0.12, radius * 1.92, radius * 1.04, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(151,66,50,0.7)";
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + radius * 0.04, radius * 1.72, radius * 0.92, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(73,35,28,0.36)";
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + radius * 0.08, radius * 0.84, radius * 0.46, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(58,29,23,0.7)";
    ctx.lineWidth = Math.max(2, worldSize(2));
    for (let ring = 1.72; ring >= 0.72; ring -= 0.32) {
      ctx.beginPath();
      ctx.ellipse(p.x, p.y + radius * 0.05 + (1.72 - ring) * radius * 0.025, radius * ring, radius * ring * 0.54, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.strokeStyle = "rgba(217,130,88,0.45)";
    ctx.lineWidth = Math.max(1, worldSize(1.05));
    for (let ring = 0.46; ring <= 1.58; ring += 0.22) {
      ctx.beginPath();
      ctx.ellipse(p.x, p.y + radius * 0.04, radius * ring, radius * ring * 0.54, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.strokeStyle = "rgba(74,35,27,0.26)";
    ctx.lineWidth = Math.max(1, worldSize(0.9));
    for (let i = 0; i < 14; i += 1) {
      const a = (Math.PI * 2 * i) / 14;
      ctx.beginPath();
      ctx.moveTo(
        p.x + Math.cos(a) * radius * 0.76,
        p.y + radius * 0.04 + Math.sin(a) * radius * 0.4
      );
      ctx.lineTo(
        p.x + Math.cos(a) * radius * 1.62,
        p.y + radius * 0.04 + Math.sin(a) * radius * 0.86
      );
      ctx.stroke();
    }

    drawCrimsonTrafficWear(p, radius);
    drawBrokenPlazaBrickVariation(p, radius);
    drawPlazaEdgeBlend(p, radius);
    drawPlazaPlanters(p, radius);
    drawLanternRing(p, radius * 1.42, radius * 0.78, 12, "rgba(239,176,82,0.82)");

    drawCrimsonStepSegments(p, radius);
  }

  function drawCrimsonTrafficWear(p, radius) {
    ctx.save();
    ctx.strokeStyle = "rgba(51,29,23,0.34)";
    ctx.lineWidth = Math.max(1, worldSize(2.2));
    ctx.lineCap = "round";
    for (let i = 0; i < 9; i += 1) {
      const y = p.y + radius * (-0.42 + i * 0.11);
      const width = radius * (0.74 + (i % 3) * 0.22);
      ctx.beginPath();
      ctx.moveTo(p.x - width, y);
      ctx.quadraticCurveTo(p.x - radius * 0.16, y + radius * 0.12, p.x + width, y + radius * 0.02);
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(255,197,124,0.16)";
    ctx.lineWidth = Math.max(1, worldSize(1.2));
    for (let i = 0; i < 12; i += 1) {
      const x = p.x + radius * (-1.3 + i * 0.23);
      ctx.beginPath();
      ctx.moveTo(x, p.y - radius * 0.76);
      ctx.lineTo(x + radius * 0.08, p.y + radius * 0.76);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawPlazaPlanters(p, radius) {
    const planters = [
      { x: -1.02, y: -0.48, rotation: -0.24 },
      { x: 1.08, y: -0.42, rotation: 0.22 },
      { x: -1.12, y: 0.44, rotation: 0.2 },
      { x: 1.04, y: 0.5, rotation: -0.18 }
    ];

    planters.forEach((planter) => {
      ctx.save();
      ctx.translate(p.x + radius * planter.x, p.y + radius * planter.y);
      ctx.rotate(planter.rotation);
      ctx.fillStyle = "rgba(46,39,32,0.72)";
      ctx.fillRect(-radius * 0.28, -radius * 0.075, radius * 0.56, radius * 0.15);
      ctx.strokeStyle = "rgba(155,137,98,0.5)";
      ctx.lineWidth = Math.max(1, worldSize(1.2));
      ctx.strokeRect(-radius * 0.28, -radius * 0.075, radius * 0.56, radius * 0.15);
      ctx.fillStyle = "rgba(54,104,58,0.6)";
      ctx.fillRect(-radius * 0.22, -radius * 0.052, radius * 0.44, radius * 0.1);
      ctx.restore();
    });
  }

  function drawPlazaEdgeBlend(p, radius) {
    ctx.save();
    const patches = [
      { a: 0.04, rx: 1.62, ry: 0.9, w: 0.28 },
      { a: 0.42, rx: 1.54, ry: 0.86, w: 0.2 },
      { a: 1.02, rx: 1.5, ry: 0.82, w: 0.24 },
      { a: 2.22, rx: 1.58, ry: 0.88, w: 0.22 },
      { a: 3.48, rx: 1.66, ry: 0.92, w: 0.3 },
      { a: 5.14, rx: 1.5, ry: 0.84, w: 0.22 }
    ];

    patches.forEach((patch, index) => {
      const x = p.x + Math.cos(patch.a) * radius * patch.rx;
      const y = p.y + radius * 0.04 + Math.sin(patch.a) * radius * patch.ry;
      ctx.fillStyle = index % 2 ? "rgba(79,54,34,0.3)" : "rgba(46,74,39,0.24)";
      ctx.beginPath();
      ctx.ellipse(
        x,
        y,
        radius * patch.w,
        radius * (patch.w * 0.34),
        patch.a,
        0,
        Math.PI * 2
      );
      ctx.fill();
    });

    ctx.strokeStyle = "rgba(75,46,31,0.28)";
    ctx.lineWidth = Math.max(1, worldSize(2.2));
    ctx.setLineDash([worldSize(8), worldSize(7)]);
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + radius * 0.05, radius * 1.7, radius * 0.92, 0, Math.PI * 0.08, Math.PI * 1.88);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  function drawBrokenPlazaBrickVariation(p, radius) {
    ctx.save();
    const chips = [
      { x: -1.36, y: -0.18, w: 0.22, h: 0.045, a: -0.18 },
      { x: -0.86, y: 0.38, w: 0.18, h: 0.04, a: 0.12 },
      { x: -0.38, y: -0.54, w: 0.16, h: 0.035, a: 0.3 },
      { x: 0.42, y: 0.34, w: 0.2, h: 0.04, a: -0.24 },
      { x: 0.92, y: -0.28, w: 0.18, h: 0.035, a: 0.16 },
      { x: 1.32, y: 0.2, w: 0.2, h: 0.045, a: -0.12 }
    ];

    chips.forEach((chip, index) => {
      ctx.save();
      ctx.translate(p.x + radius * chip.x, p.y + radius * chip.y);
      ctx.rotate(chip.a);
      ctx.fillStyle = index % 2 ? "rgba(187,85,58,0.34)" : "rgba(75,36,29,0.3)";
      ctx.fillRect(-radius * chip.w * 0.5, -radius * chip.h * 0.5, radius * chip.w, Math.max(1, radius * chip.h));
      ctx.restore();
    });
    ctx.restore();
  }

  function drawCrimsonStepSegments(p, radius) {
    ctx.save();
    ctx.strokeStyle = "rgba(229,137,91,0.34)";
    ctx.lineWidth = Math.max(1, worldSize(1.25));
    for (let i = 0; i < 18; i += 1) {
      const a0 = (Math.PI * 2 * i) / 18 + 0.03;
      const a1 = a0 + Math.PI * 0.055;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y + radius * 0.05, radius * 1.24, radius * 0.67, 0, a0, a1);
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(46,26,21,0.26)";
    ctx.lineWidth = Math.max(1, worldSize(2.4));
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + radius * 0.18, radius * 1.66, radius * 0.9, 0, Math.PI * 0.08, Math.PI * 0.92);
    ctx.stroke();
    ctx.restore();
  }

  function drawTowerGround(landmark, p, radius) {
    drawGenericLandmarkGround(landmark, p, radius);
    ctx.fillStyle = "rgba(53,36,24,0.38)";
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + radius * 0.18, radius * 0.9, radius * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(157,103,59,0.72)";
    ctx.lineWidth = Math.max(2, worldSize(2.2));
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + radius * 0.18, radius * 0.78, radius * 0.34, 0, Math.PI * 0.05, Math.PI * 1.95);
    ctx.stroke();

    ctx.strokeStyle = "rgba(210,168,91,0.46)";
    ctx.lineWidth = Math.max(1, worldSize(1.2));
    for (let i = -2; i <= 2; i += 1) {
      ctx.beginPath();
      ctx.moveTo(p.x + i * radius * 0.24, p.y - radius * 0.44);
      ctx.lineTo(p.x + i * radius * 0.38, p.y + radius * 0.58);
      ctx.stroke();
    }
  }

  function drawSanctuaryGround(p, radius) {
    ctx.fillStyle = "rgba(73,123,131,0.18)";
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + radius * 0.16, radius * 1.72, radius * 0.96, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(184,91,139,0.12)";
    ctx.beginPath();
    ctx.arc(p.x, p.y - radius * 0.16, radius * 1.02, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(142,230,232,0.5)";
    ctx.lineWidth = Math.max(1, worldSize(1.3));
    for (let i = 0; i < 8; i += 1) {
      const a = (Math.PI * 2 * i) / 8;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y + radius * 0.08);
      ctx.lineTo(p.x + Math.cos(a) * radius * 1.22, p.y + radius * 0.08 + Math.sin(a) * radius * 0.66);
      ctx.stroke();
    }

    ctx.fillStyle = "rgba(61,68,61,0.54)";
    for (let i = 0; i < 4; i += 1) {
      ctx.fillRect(p.x - radius * (0.62 + i * 0.1), p.y + radius * (0.48 + i * 0.08), radius * (1.24 + i * 0.2), Math.max(2, worldSize(4)));
    }

    ctx.strokeStyle = "rgba(221,244,236,0.34)";
    ctx.lineWidth = Math.max(1, worldSize(1.4));
    ctx.beginPath();
    ctx.moveTo(p.x - radius * 1.26, p.y + radius * 0.44);
    ctx.quadraticCurveTo(p.x, p.y + radius * 0.7, p.x + radius * 1.26, p.y + radius * 0.44);
    ctx.stroke();
    drawLanternRing(p, radius * 1.28, radius * 0.7, 10, "rgba(134,219,231,0.78)");
  }

  function drawResonantHallGround(p, radius) {
    ctx.fillStyle = "rgba(93,65,45,0.22)";
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + radius * 0.16, radius * 1.62, radius * 0.84, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(138,100,63,0.26)";
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + radius * 0.18, radius * 1.2, radius * 0.56, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(228,189,115,0.42)";
    ctx.lineWidth = Math.max(1, worldSize(1.2));
    for (let i = 0; i < 4; i += 1) {
      ctx.beginPath();
      ctx.arc(p.x, p.y - radius * 0.16, radius * (0.46 + i * 0.18), Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
    }

    ctx.strokeStyle = "rgba(255,219,140,0.32)";
    ctx.lineWidth = Math.max(1, worldSize(1.3));
    for (let i = -2; i <= 2; i += 1) {
      ctx.beginPath();
      ctx.moveTo(p.x + i * radius * 0.28, p.y + radius * 0.52);
      ctx.quadraticCurveTo(p.x + i * radius * 0.18, p.y + radius * 0.16, p.x, p.y - radius * 0.1);
      ctx.stroke();
    }
  }

  function drawHarrowsteadGround(p, radius) {
    ctx.fillStyle = "rgba(36,22,17,0.38)";
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + radius * 0.24, radius * 1.68, radius * 0.82, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(76,55,43,0.5)";
    ctx.fillRect(p.x - radius * 1.18, p.y + radius * 0.34, radius * 2.36, radius * 0.22);

    ctx.strokeStyle = "rgba(112,85,60,0.62)";
    ctx.lineWidth = Math.max(1, worldSize(1.8));
    for (let i = -5; i <= 5; i += 1) {
      ctx.beginPath();
      ctx.moveTo(p.x + i * radius * 0.22, p.y + radius * 0.58);
      ctx.lineTo(p.x + i * radius * 0.16, p.y - radius * 0.44);
      ctx.stroke();
    }

    ctx.strokeStyle = "rgba(34,24,19,0.42)";
    ctx.lineWidth = Math.max(2, worldSize(3));
    ctx.beginPath();
    ctx.moveTo(p.x - radius * 0.72, p.y + radius * 0.58);
    ctx.quadraticCurveTo(p.x, p.y + radius * 0.34, p.x + radius * 0.72, p.y + radius * 0.58);
    ctx.stroke();
  }

  function drawHarrowsteadGroundAccent(p, radius) {
    ctx.fillStyle = "rgba(25,17,14,0.2)";
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + radius * 0.28, radius * 1.38, radius * 0.58, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(101,78,57,0.38)";
    ctx.lineWidth = Math.max(1, worldSize(2));
    ctx.beginPath();
    ctx.moveTo(p.x - radius * 0.86, p.y + radius * 0.48);
    ctx.quadraticCurveTo(p.x, p.y + radius * 0.28, p.x + radius * 0.86, p.y + radius * 0.48);
    ctx.stroke();

    ctx.strokeStyle = "rgba(34,24,19,0.28)";
    ctx.lineWidth = Math.max(1, worldSize(1.2));
    for (let i = -3; i <= 3; i += 1) {
      ctx.beginPath();
      ctx.moveTo(p.x + i * radius * 0.2, p.y + radius * 0.54);
      ctx.lineTo(p.x + i * radius * 0.16, p.y + radius * 0.28);
      ctx.stroke();
    }
  }

  function drawRuneStoneGround(p, radius) {
    ctx.fillStyle = "rgba(34,69,42,0.2)";
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + radius * 0.1, radius * 1.42, radius * 0.88, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(65,45,29,0.42)";
    ctx.beginPath();
    ctx.arc(p.x, p.y - radius * 0.12, radius * 0.16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(43,91,49,0.58)";
    ctx.beginPath();
    ctx.arc(p.x, p.y - radius * 0.28, radius * 0.34, 0, Math.PI * 2);
    ctx.fill();

    ctx.setLineDash([worldSize(6), worldSize(4)]);
    ctx.strokeStyle = "rgba(116,234,126,0.42)";
    ctx.lineWidth = Math.max(1, worldSize(1.4));
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + radius * 0.06, radius * 0.98, radius * 0.58, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.strokeStyle = "rgba(119,84,45,0.42)";
    ctx.lineWidth = Math.max(1, worldSize(1.2));
    for (let i = 0; i < 6; i += 1) {
      const a = -Math.PI / 2 + (Math.PI * 2 * i) / 6;
      const x = p.x + Math.cos(a) * radius * 0.78;
      const y = p.y + Math.sin(a) * radius * 0.46;
      ctx.beginPath();
      ctx.arc(x, y, radius * 0.12, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawGenericLandmarkGround(landmark, p, radius) {
    const color = districtAccentColor(landmark.districtId, 0.34);

    ctx.fillStyle = districtAccentColor(landmark.districtId, 0.1);
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + radius * 0.18, radius * 1.35, radius * 0.68, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1, worldSize(1.2));
    ctx.setLineDash([worldSize(7), worldSize(5)]);
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + radius * 0.2, radius * 1.12, radius * 0.54, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.strokeStyle = districtAccentColor(landmark.districtId, 0.22);
    ctx.lineWidth = Math.max(1, worldSize(2));
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius * 0.58, 0, Math.PI * 2);
    ctx.stroke();
  }

  function drawLanternRing(p, radiusX, radiusY, count, color) {
    for (let i = 0; i < count; i += 1) {
      const a = (Math.PI * 2 * i) / count;
      const x = p.x + Math.cos(a) * radiusX;
      const y = p.y + Math.sin(a) * radiusY;
      ctx.fillStyle = "rgba(255,214,129,0.12)";
      ctx.beginPath();
      ctx.arc(x, y, Math.max(5, worldSize(7)), 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, Math.max(2, worldSize(2.4)), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawStoryLandmark(landmark) {
    if (!pointInView(landmark, landmark.size + 80)) return;

    switch (landmark.kind) {
      case "rune_bell":
        drawRuneBellLandmark(landmark);
        break;
      case "clocktower":
        drawClocktowerLandmark(landmark);
        break;
      case "historic_hall":
        if (landmarkAnchorsProfiledBuilding(landmark, ["harrowstead"])) {
          drawHistoricHallLandmarkAccent(landmark);
        } else {
          drawHistoricHallLandmark(landmark);
        }
        break;
      case "rose_sigil":
        if (landmarkAnchorsProfiledBuilding(landmark, ["cathedral", "bardic_theatre"])) {
          drawRoseSigilLandmarkAccent(landmark);
        } else {
          drawRoseSigilLandmark(landmark);
        }
        break;
      case "organ_hall":
        if (landmarkAnchorsProfiledBuilding(landmark, ["resonant_hall"])) {
          drawOrganHallLandmarkAccent(landmark);
        } else {
          drawOrganHallLandmark(landmark);
        }
        break;
      case "ship_prow":
        drawShipProwLandmark(landmark);
        break;
      case "glass_roses":
        drawGlassRosesLandmark(landmark);
        break;
      case "bronze_scholar":
        drawBronzeScholarLandmark(landmark);
        break;
      case "twin_wardens":
        drawTwinWardensLandmark(landmark);
        break;
      case "rune_stones":
        drawRuneStonesLandmark(landmark);
        break;
      default:
        drawRuneStonesLandmark(landmark);
        break;
    }
  }

  function drawRuneBellLandmark(landmark) {
    const p = worldToScreen(landmark.x, landmark.y);
    const s = landmarkSize(landmark, 42) * 0.74;
    ctx.save();
    drawLandmarkGlow(p.x, p.y - s * 0.88, s * 1.08, "rgba(238,166,72,0.12)");
    drawDirectionalLandmarkShadow(p, s, -0.32, 0.16, "rgba(20,11,8,0.28)");
    drawLandmarkShadow(p, s * 1.04);

    ctx.fillStyle = "rgba(22,12,10,0.94)";
    ctx.fillRect(p.x - s * 0.52, p.y - s * 0.5, s * 1.04, s * 0.58);
    ctx.fillStyle = "#4b231f";
    ctx.fillRect(p.x - s * 0.44, p.y - s * 0.62, s * 0.88, s * 0.66);
    ctx.fillStyle = "rgba(114,48,39,0.8)";
    for (let i = -2; i <= 2; i += 1) {
      ctx.fillRect(p.x + i * s * 0.18 - s * 0.05, p.y - s * 0.52, s * 0.1, s * 0.08);
      ctx.fillRect(p.x + i * s * 0.18 - s * 0.02, p.y - s * 0.28, s * 0.1, s * 0.08);
    }

    ctx.strokeStyle = "#1d2020";
    ctx.lineWidth = Math.max(2, s * 0.052);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(p.x - s * 0.36, p.y - s * 0.58);
    ctx.lineTo(p.x - s * 0.46, p.y - s * 1.88);
    ctx.moveTo(p.x + s * 0.36, p.y - s * 0.58);
    ctx.lineTo(p.x + s * 0.46, p.y - s * 1.88);
    ctx.moveTo(p.x - s * 0.46, p.y - s * 1.88);
    ctx.lineTo(p.x + s * 0.46, p.y - s * 1.88);
    ctx.moveTo(p.x - s * 0.42, p.y - s * 1.42);
    ctx.lineTo(p.x + s * 0.42, p.y - s * 1.14);
    ctx.moveTo(p.x + s * 0.42, p.y - s * 1.42);
    ctx.lineTo(p.x - s * 0.42, p.y - s * 1.14);
    ctx.stroke();

    ctx.strokeStyle = "rgba(104,36,32,0.9)";
    ctx.lineWidth = Math.max(1, s * 0.034);
    ctx.beginPath();
    ctx.moveTo(p.x - s * 0.46, p.y - s * 1.78);
    ctx.lineTo(p.x + s * 0.46, p.y - s * 1.52);
    ctx.moveTo(p.x + s * 0.46, p.y - s * 1.78);
    ctx.lineTo(p.x - s * 0.46, p.y - s * 1.52);
    ctx.stroke();

    ctx.fillStyle = "#252b2a";
    ctx.fillRect(p.x - s * 0.58, p.y - s * 1.98, s * 1.16, s * 0.16);
    ctx.fillStyle = "rgba(170,82,49,0.92)";
    ctx.fillRect(p.x - s * 0.62, p.y - s * 1.82, s * 1.24, s * 0.14);

    ctx.fillStyle = "#d8a74f";
    ctx.beginPath();
    ctx.arc(p.x, p.y - s * 1.1, s * 0.34, Math.PI, 0);
    ctx.lineTo(p.x + s * 0.28, p.y - s * 0.76);
    ctx.lineTo(p.x - s * 0.28, p.y - s * 0.76);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "rgba(255,226,149,0.78)";
    ctx.lineWidth = Math.max(1.5, s * 0.046);
    ctx.stroke();

    ctx.strokeStyle = "rgba(255,207,107,0.62)";
    ctx.lineWidth = Math.max(1, s * 0.035);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - s * 1.88);
    ctx.lineTo(p.x, p.y - s * 0.66);
    ctx.stroke();
    drawSmallRunes(p.x, p.y + s * 0.08, s * 1.05, "#f0bc60");
    ctx.restore();
  }

  function drawClocktowerLandmark(landmark) {
    const p = worldToScreen(landmark.x, landmark.y);
    const s = landmarkSize(landmark, 40);
    ctx.save();
    drawLandmarkGlow(p.x, p.y - s * 1.0, s * 1.06, "rgba(219,174,86,0.16)");
    drawDirectionalLandmarkShadow(p, s, -0.34, 0.18, "rgba(22,15,10,0.44)");
    drawLandmarkShadow(p, s * 1.18);

    ctx.fillStyle = "rgba(18,13,9,0.9)";
    ctx.fillRect(p.x - s * 0.5, p.y - s * 2.02, s * 1.0, s * 2.16);

    ctx.fillStyle = "#6a4229";
    ctx.fillRect(p.x - s * 0.38, p.y - s * 1.92, s * 0.76, s * 2.02);
    ctx.fillStyle = "#9a6541";
    ctx.fillRect(p.x - s * 0.3, p.y - s * 1.76, s * 0.6, s * 1.74);

    ctx.strokeStyle = "#2b2119";
    ctx.lineWidth = Math.max(3, s * 0.08);
    ctx.beginPath();
    ctx.moveTo(p.x - s * 0.42, p.y - s * 1.94);
    ctx.lineTo(p.x - s * 0.42, p.y + s * 0.12);
    ctx.moveTo(p.x + s * 0.42, p.y - s * 1.94);
    ctx.lineTo(p.x + s * 0.42, p.y + s * 0.12);
    ctx.moveTo(p.x - s * 0.46, p.y - s * 1.28);
    ctx.lineTo(p.x + s * 0.46, p.y - s * 0.78);
    ctx.moveTo(p.x + s * 0.46, p.y - s * 1.28);
    ctx.lineTo(p.x - s * 0.46, p.y - s * 0.78);
    ctx.stroke();

    ctx.fillStyle = "#203a35";
    ctx.beginPath();
    ctx.moveTo(p.x - s * 0.58, p.y - s * 1.96);
    ctx.lineTo(p.x, p.y - s * 2.48);
    ctx.lineTo(p.x + s * 0.58, p.y - s * 1.96);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "rgba(242,210,118,0.3)";
    ctx.beginPath();
    ctx.arc(p.x, p.y - s * 1.2, s * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#e2d3a5";
    ctx.beginPath();
    ctx.arc(p.x, p.y - s * 1.2, s * 0.28, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#24342f";
    ctx.lineWidth = Math.max(2, s * 0.045);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(p.x, p.y - s * 1.2);
    ctx.lineTo(p.x + s * 0.15, p.y - s * 1.32);
    ctx.moveTo(p.x, p.y - s * 1.2);
    ctx.lineTo(p.x, p.y - s * 1.0);
    ctx.stroke();

    ctx.strokeStyle = "rgba(246,207,119,0.56)";
    ctx.lineWidth = Math.max(1, s * 0.035);
    ctx.beginPath();
    ctx.arc(p.x, p.y - s * 1.2, s * 0.36, 0, Math.PI * 2);
    ctx.stroke();
    drawSmallRunes(p.x, p.y - s * 0.32, s * 0.96, "#d8b469");
    ctx.restore();
  }

  function drawHistoricHallLandmarkAccent(landmark) {
    const p = worldToScreen(landmark.x, landmark.y);
    const s = landmarkSize(landmark, 32);
    ctx.save();
    drawLandmarkGlow(p.x, p.y - s * 0.36, s * 0.72, "rgba(177,82,51,0.1)");

    ctx.strokeStyle = "rgba(42,25,20,0.5)";
    ctx.lineWidth = Math.max(2, s * 0.05);
    ctx.beginPath();
    ctx.moveTo(p.x - s * 0.58, p.y - s * 0.12);
    ctx.quadraticCurveTo(p.x, p.y - s * 0.32, p.x + s * 0.58, p.y - s * 0.12);
    ctx.stroke();

    for (let i = -1; i <= 1; i += 2) {
      ctx.fillStyle = "rgba(242,174,86,0.66)";
      ctx.beginPath();
      ctx.arc(p.x + i * s * 0.82, p.y - s * 0.22, s * 0.07, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(242,174,86,0.13)";
      ctx.beginPath();
      ctx.arc(p.x + i * s * 0.82, p.y - s * 0.22, s * 0.22, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawHistoricHallLandmark(landmark) {
    const p = worldToScreen(landmark.x, landmark.y);
    const s = landmarkSize(landmark, 36);
    ctx.save();
    drawLandmarkGlow(p.x, p.y - s * 0.48, s * 0.96, "rgba(177,82,51,0.13)");
    drawDirectionalLandmarkShadow(p, s, -0.28, 0.18, "rgba(24,14,10,0.48)");
    drawLandmarkShadow(p, s * 1.2);

    ctx.fillStyle = "rgba(24,15,12,0.9)";
    ctx.fillRect(p.x - s * 1.04, p.y - s * 1.06, s * 2.08, s * 1.16);
    ctx.fillStyle = "#552a24";
    ctx.fillRect(p.x - s * 0.94, p.y - s * 1.02, s * 1.88, s * 1.06);

    ctx.fillStyle = "#4a2420";
    ctx.fillRect(p.x - s * 1.06, p.y - s * 1.2, s * 0.34, s * 1.26);
    ctx.fillRect(p.x + s * 0.72, p.y - s * 1.2, s * 0.34, s * 1.26);
    ctx.fillStyle = "#302823";
    ctx.fillRect(p.x - s * 1.1, p.y - s * 1.28, s * 0.42, s * 0.14);
    ctx.fillRect(p.x + s * 0.68, p.y - s * 1.28, s * 0.42, s * 0.14);

    ctx.fillStyle = "rgba(99,50,36,0.9)";
    for (let row = 0; row < 5; row += 1) {
      for (let col = -4; col <= 4; col += 1) {
        const offset = row % 2 ? s * 0.09 : 0;
        ctx.fillRect(p.x + col * s * 0.2 + offset - s * 0.06, p.y - s * 0.88 + row * s * 0.18, s * 0.12, s * 0.04);
      }
    }

    ctx.fillStyle = "#2c3831";
    ctx.beginPath();
    ctx.moveTo(p.x - s * 0.98, p.y - s * 1.02);
    ctx.lineTo(p.x, p.y - s * 1.42);
    ctx.lineTo(p.x + s * 0.98, p.y - s * 1.02);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "rgba(229,183,116,0.58)";
    ctx.lineWidth = Math.max(1, s * 0.046);
    for (let row = 0; row < 3; row += 1) {
      for (let x = -0.58; x <= 0.58; x += 0.29) {
        ctx.strokeRect(p.x + s * x - s * 0.055, p.y - s * (0.76 - row * 0.22), s * 0.11, s * 0.14);
      }
    }

    ctx.fillStyle = "rgba(39,31,27,0.92)";
    ctx.beginPath();
    ctx.moveTo(p.x - s * 0.22, p.y + s * 0.02);
    ctx.lineTo(p.x - s * 0.22, p.y - s * 0.32);
    ctx.quadraticCurveTo(p.x, p.y - s * 0.58, p.x + s * 0.22, p.y - s * 0.32);
    ctx.lineTo(p.x + s * 0.22, p.y + s * 0.02);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(220,169,96,0.52)";
    ctx.lineWidth = Math.max(2, s * 0.04);
    ctx.stroke();

    ctx.fillStyle = "#706052";
    ctx.fillRect(p.x - s * 1.02, p.y - s * 0.08, s * 2.04, s * 0.2);

    ctx.strokeStyle = "rgba(58,32,26,0.72)";
    ctx.lineWidth = Math.max(1, s * 0.07);
    ctx.beginPath();
    ctx.moveTo(p.x - s * 0.72, p.y - s * 1.02);
    ctx.lineTo(p.x - s * 0.72, p.y - s * 0.06);
    ctx.moveTo(p.x + s * 0.72, p.y - s * 1.02);
    ctx.lineTo(p.x + s * 0.72, p.y - s * 0.06);
    ctx.moveTo(p.x - s * 0.92, p.y - s * 0.18);
    ctx.lineTo(p.x + s * 0.92, p.y - s * 0.18);
    ctx.stroke();

    for (let i = -1; i <= 1; i += 2) {
      ctx.fillStyle = "rgba(242,174,86,0.74)";
      ctx.beginPath();
      ctx.arc(p.x + i * s * 1.12, p.y - s * 0.28, s * 0.08, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawRoseSigilLandmarkAccent(landmark) {
    const p = worldToScreen(landmark.x, landmark.y);
    const s = landmarkSize(landmark, 38);
    ctx.save();
    drawLandmarkGlow(p.x, p.y - s * 0.86, s * 1.16, "rgba(123,220,225,0.18)");
    drawLandmarkGlow(p.x, p.y - s * 0.9, s * 0.72, "rgba(213,95,149,0.16)");

    ctx.fillStyle = "rgba(96,188,202,0.22)";
    ctx.beginPath();
    ctx.arc(p.x, p.y - s * 0.92, s * 0.5, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 12; i += 1) {
      const angle = (Math.PI * 2 * i) / 12;
      ctx.fillStyle = i % 3 === 0 ? "rgba(224,95,147,0.62)" : i % 3 === 1 ? "rgba(115,205,212,0.58)" : "rgba(244,211,120,0.54)";
      ctx.beginPath();
      ctx.ellipse(
        p.x + Math.cos(angle) * s * 0.22,
        p.y - s * 0.92 + Math.sin(angle) * s * 0.22,
        s * 0.07,
        s * 0.24,
        angle,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }
    ctx.strokeStyle = "rgba(229,241,214,0.62)";
    ctx.lineWidth = Math.max(1, s * 0.04);
    ctx.beginPath();
    ctx.arc(p.x, p.y - s * 0.92, s * 0.52, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = "rgba(60,69,63,0.48)";
    ctx.lineWidth = Math.max(1, s * 0.04);
    for (let i = 0; i < 3; i += 1) {
      ctx.beginPath();
      ctx.moveTo(p.x - s * (0.48 + i * 0.08), p.y + s * (0.06 + i * 0.08));
      ctx.lineTo(p.x + s * (0.48 + i * 0.08), p.y + s * (0.06 + i * 0.08));
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawRoseSigilLandmark(landmark) {
    const p = worldToScreen(landmark.x, landmark.y);
    const s = landmarkSize(landmark, 42);
    ctx.save();
    drawLandmarkGlow(p.x, p.y - s * 0.84, s * 1.38, "rgba(123,220,225,0.22)");
    drawLandmarkGlow(p.x, p.y - s * 0.9, s * 0.92, "rgba(213,95,149,0.2)");
    drawDirectionalLandmarkShadow(p, s, -0.3, 0.18, "rgba(12,18,20,0.44)");
    drawLandmarkShadow(p, s * 1.2);

    ctx.fillStyle = "rgba(17,22,24,0.9)";
    ctx.fillRect(p.x - s * 0.86, p.y - s * 1.28, s * 1.72, s * 1.34);
    ctx.fillStyle = "#45524a";
    ctx.fillRect(p.x - s * 0.76, p.y - s * 1.2, s * 1.52, s * 1.2);

    ctx.fillStyle = "#263a38";
    ctx.beginPath();
    ctx.moveTo(p.x - s * 0.94, p.y - s * 1.2);
    ctx.lineTo(p.x, p.y - s * 1.68);
    ctx.lineTo(p.x + s * 0.94, p.y - s * 1.2);
    ctx.closePath();
    ctx.fill();

    for (let i = -1; i <= 1; i += 2) {
      ctx.fillStyle = "rgba(22,29,31,0.9)";
      ctx.fillRect(p.x + i * s * 0.78 - s * 0.11, p.y - s * 1.54, s * 0.22, s * 1.46);
      ctx.fillStyle = "#2d4844";
      ctx.beginPath();
      ctx.moveTo(p.x + i * s * 0.78 - s * 0.2, p.y - s * 1.54);
      ctx.lineTo(p.x + i * s * 0.78, p.y - s * 1.88);
      ctx.lineTo(p.x + i * s * 0.78 + s * 0.2, p.y - s * 1.54);
      ctx.closePath();
      ctx.fill();
    }

    ctx.fillStyle = "rgba(39,35,34,0.9)";
    ctx.beginPath();
    ctx.moveTo(p.x - s * 0.24, p.y + s * 0.02);
    ctx.lineTo(p.x - s * 0.24, p.y - s * 0.36);
    ctx.quadraticCurveTo(p.x, p.y - s * 0.62, p.x + s * 0.24, p.y - s * 0.36);
    ctx.lineTo(p.x + s * 0.24, p.y + s * 0.02);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "rgba(96,188,202,0.3)";
    ctx.beginPath();
    ctx.arc(p.x, p.y - s * 0.92, s * 0.58, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 12; i += 1) {
      const angle = (Math.PI * 2 * i) / 12;
      ctx.fillStyle = i % 3 === 0 ? "rgba(224,95,147,0.7)" : i % 3 === 1 ? "rgba(115,205,212,0.66)" : "rgba(244,211,120,0.62)";
      ctx.beginPath();
      ctx.ellipse(
        p.x + Math.cos(angle) * s * 0.26,
        p.y - s * 0.92 + Math.sin(angle) * s * 0.26,
        s * 0.1,
        s * 0.32,
        angle,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }

    ctx.fillStyle = "rgba(245,236,184,0.75)";
    ctx.beginPath();
    ctx.arc(p.x, p.y - s * 0.92, s * 0.12, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(229,241,214,0.68)";
    ctx.lineWidth = Math.max(2, s * 0.05);
    ctx.beginPath();
    ctx.arc(p.x, p.y - s * 0.92, s * 0.62, 0, Math.PI * 2);
    for (let i = 0; i < 6; i += 1) {
      const angle = (Math.PI * i) / 6;
      ctx.moveTo(p.x, p.y - s * 0.92);
      ctx.lineTo(p.x + Math.cos(angle) * s * 0.62, p.y - s * 0.92 + Math.sin(angle) * s * 0.62);
      ctx.moveTo(p.x, p.y - s * 0.92);
      ctx.lineTo(p.x - Math.cos(angle) * s * 0.62, p.y - s * 0.92 - Math.sin(angle) * s * 0.62);
    }
    ctx.stroke();

    ctx.fillStyle = "rgba(60,69,63,0.78)";
    for (let i = 0; i < 3; i += 1) {
      ctx.fillRect(p.x - s * (0.58 + i * 0.1), p.y + s * (0.06 + i * 0.09), s * (1.16 + i * 0.2), Math.max(2, s * 0.045));
    }
    ctx.restore();
  }

  function drawOrganHallLandmarkAccent(landmark) {
    const p = worldToScreen(landmark.x, landmark.y);
    const s = landmarkSize(landmark, 32);
    ctx.save();
    drawLandmarkGlow(p.x, p.y - s * 0.5, s * 0.9, "rgba(232,179,89,0.13)");

    ctx.fillStyle = "rgba(50,32,23,0.72)";
    ctx.strokeStyle = "rgba(238,194,118,0.38)";
    ctx.lineWidth = Math.max(1, s * 0.025);
    for (let i = -3; i <= 3; i += 1) {
      const h = s * (0.52 + (3 - Math.abs(i)) * 0.12);
      const x = p.x + i * s * 0.12;
      ctx.fillRect(x - s * 0.032, p.y - h, s * 0.064, h);
      ctx.strokeRect(x - s * 0.032, p.y - h, s * 0.064, h);
    }

    ctx.strokeStyle = "rgba(238,194,118,0.42)";
    ctx.lineWidth = Math.max(1, s * 0.04);
    ctx.beginPath();
    ctx.moveTo(p.x - s * 0.66, p.y - s * 0.18);
    ctx.quadraticCurveTo(p.x, p.y - s * 0.5, p.x + s * 0.66, p.y - s * 0.18);
    ctx.stroke();
    ctx.restore();
  }

  function drawOrganHallLandmark(landmark) {
    const p = worldToScreen(landmark.x, landmark.y);
    const s = landmarkSize(landmark, 36);
    ctx.save();
    drawLandmarkGlow(p.x, p.y - s * 0.58, s * 1.08, "rgba(232,179,89,0.16)");
    drawLandmarkShadow(p, s * 1.14);

    ctx.fillStyle = "rgba(24,18,14,0.86)";
    ctx.fillRect(p.x - s * 1.08, p.y - s * 0.86, s * 2.16, s * 0.9);
    ctx.fillStyle = "#60412d";
    ctx.fillRect(p.x - s * 0.96, p.y - s * 0.78, s * 1.92, s * 0.76);

    ctx.fillStyle = "#765238";
    ctx.beginPath();
    ctx.moveTo(p.x - s * 0.94, p.y - s * 0.24);
    ctx.quadraticCurveTo(p.x, p.y - s * 0.82, p.x + s * 0.94, p.y - s * 0.24);
    ctx.lineTo(p.x + s * 0.94, p.y + s * 0.02);
    ctx.lineTo(p.x - s * 0.94, p.y + s * 0.02);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#2c3f37";
    ctx.beginPath();
    ctx.moveTo(p.x - s * 1.06, p.y - s * 0.78);
    ctx.lineTo(p.x, p.y - s * 1.16);
    ctx.lineTo(p.x + s * 1.06, p.y - s * 0.78);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#483321";
    for (let i = -3; i <= 3; i += 1) {
      const h = s * (0.72 + (3 - Math.abs(i)) * 0.14);
      ctx.fillRect(p.x + i * s * 0.13 - s * 0.044, p.y - h, s * 0.088, h);
      ctx.fillStyle = "rgba(210,171,95,0.7)";
      ctx.fillRect(p.x + i * s * 0.13 - s * 0.024, p.y - h + s * 0.08, s * 0.048, h - s * 0.12);
      ctx.fillStyle = "#483321";
    }

    ctx.fillStyle = "#c29150";
    ctx.fillRect(p.x - s * 0.78, p.y - s * 0.42, s * 1.56, s * 0.24);
    ctx.strokeStyle = "rgba(255,223,151,0.52)";
    ctx.lineWidth = Math.max(1, s * 0.045);
    ctx.beginPath();
    ctx.arc(p.x, p.y - s * 0.52, s * 0.88, Math.PI * 0.13, Math.PI * 0.87);
    ctx.moveTo(p.x - s * 0.62, p.y - s * 0.18);
    ctx.quadraticCurveTo(p.x, p.y - s * 0.58, p.x + s * 0.62, p.y - s * 0.18);
    ctx.stroke();
    drawSmallRunes(p.x, p.y - s * 0.12, s * 0.82, "#e0b46f");
    drawGlassRoseCluster(p.x + s * 0.66, p.y - s * 0.46, s * 0.34);
    ctx.restore();
  }

  function drawShipProwLandmark(landmark) {
    const p = worldToScreen(landmark.x, landmark.y);
    const s = landmarkSize(landmark, 34);
    ctx.save();
    drawLandmarkGlow(p.x, p.y - s * 0.46, s * 0.96, "rgba(132,198,204,0.14)");
    drawDirectionalLandmarkShadow(p, s, -0.22, 0.14, "rgba(11,14,16,0.48)");
    drawLandmarkShadow(p, s * 1.16);

    ctx.fillStyle = "rgba(12,14,16,0.9)";
    ctx.beginPath();
    ctx.moveTo(p.x - s * 0.92, p.y + s * 0.16);
    ctx.quadraticCurveTo(p.x - s * 0.12, p.y - s * 0.76, p.x + s * 0.5, p.y - s * 1.18);
    ctx.quadraticCurveTo(p.x + s * 0.86, p.y - s * 1.34, p.x + s * 0.62, p.y - s * 0.82);
    ctx.quadraticCurveTo(p.x + s * 0.44, p.y - s * 0.38, p.x + s * 0.88, p.y - s * 0.06);
    ctx.lineTo(p.x + s * 0.08, p.y + s * 0.34);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#3d4446";
    ctx.beginPath();
    ctx.moveTo(p.x - s * 0.82, p.y + s * 0.04);
    ctx.quadraticCurveTo(p.x - s * 0.08, p.y - s * 0.62, p.x + s * 0.44, p.y - s * 0.98);
    ctx.quadraticCurveTo(p.x + s * 0.72, p.y - s * 1.1, p.x + s * 0.54, p.y - s * 0.74);
    ctx.quadraticCurveTo(p.x + s * 0.38, p.y - s * 0.32, p.x + s * 0.72, p.y - s * 0.06);
    ctx.lineTo(p.x + s * 0.04, p.y + s * 0.2);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "rgba(122,73,48,0.72)";
    ctx.lineWidth = Math.max(2, s * 0.055);
    ctx.stroke();

    ctx.strokeStyle = "rgba(196,132,78,0.72)";
    ctx.lineWidth = Math.max(1, s * 0.04);
    ctx.beginPath();
    ctx.moveTo(p.x - s * 0.54, p.y - s * 0.02);
    ctx.lineTo(p.x + s * 0.2, p.y - s * 0.52);
    ctx.moveTo(p.x - s * 0.24, p.y - s * 0.06);
    ctx.lineTo(p.x + s * 0.42, p.y - s * 0.42);
    ctx.stroke();

    ctx.strokeStyle = "#29211d";
    ctx.lineWidth = Math.max(2, s * 0.07);
    ctx.beginPath();
    ctx.moveTo(p.x - s * 0.82, p.y + s * 0.2);
    ctx.lineTo(p.x - s * 0.82, p.y - s * 0.88);
    ctx.stroke();
    ctx.fillStyle = "rgba(178,94,54,0.82)";
    ctx.beginPath();
    ctx.moveTo(p.x - s * 0.78, p.y - s * 0.82);
    ctx.lineTo(p.x - s * 0.28, p.y - s * 0.64);
    ctx.lineTo(p.x - s * 0.78, p.y - s * 0.42);
    ctx.closePath();
    ctx.fill();
    drawSmallRunes(p.x - s * 0.02, p.y - s * 0.1, s * 0.82, "#9ad4ce");
    ctx.restore();
  }

  function drawGlassRosesLandmark(landmark) {
    const p = worldToScreen(landmark.x, landmark.y);
    const s = landmarkSize(landmark, 26);
    ctx.save();
    drawLandmarkGlow(p.x, p.y - s * 0.42, s * 0.82, "rgba(246,194,80,0.18)");
    drawLandmarkGlow(p.x, p.y - s * 0.42, s * 0.7, "rgba(222,72,113,0.18)");
    drawLandmarkShadow(p, s * 0.95);
    ctx.fillStyle = "rgba(25,20,18,0.72)";
    ctx.fillRect(p.x - s * 0.86, p.y - s * 0.82, s * 1.72, s * 0.7);
    ctx.strokeStyle = "rgba(210,174,118,0.5)";
    ctx.lineWidth = Math.max(1, s * 0.045);
    ctx.strokeRect(p.x - s * 0.86, p.y - s * 0.82, s * 1.72, s * 0.7);
    drawGlassRoseCluster(p.x, p.y - s * 0.44, s * 0.82);
    ctx.restore();
  }

  function drawGlassRoseCluster(x, y, size) {
    const colors = [
      "rgba(226,60,91,0.82)",
      "rgba(246,235,196,0.78)",
      "rgba(244,192,68,0.8)",
      "rgba(236,104,133,0.78)",
      "rgba(255,224,117,0.76)"
    ];

    ctx.save();
    ctx.strokeStyle = "rgba(255,242,197,0.38)";
    ctx.lineWidth = Math.max(1, size * 0.035);
    ctx.beginPath();
    ctx.arc(x, y, size * 0.64, Math.PI * 0.08, Math.PI * 1.92);
    ctx.stroke();

    for (let i = 0; i < 9; i += 1) {
      const angle = (Math.PI * 2 * i) / 9;
      const radius = size * (0.2 + (i % 3) * 0.14);
      const cx = x + Math.cos(angle) * radius;
      const cy = y + Math.sin(angle) * radius * 0.68;
      ctx.fillStyle = colors[i % colors.length];
      ctx.beginPath();
      ctx.ellipse(cx, cy, size * 0.11, size * 0.18, angle, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,226,0.58)";
      ctx.beginPath();
      ctx.arc(cx - size * 0.025, cy - size * 0.04, size * 0.028, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawBronzeScholarLandmark(landmark) {
    const p = worldToScreen(landmark.x, landmark.y);
    const s = landmarkSize(landmark, 12);
    ctx.save();
    drawLandmarkShadow(p, s);
    ctx.fillStyle = "#6f4d2d";
    ctx.fillRect(p.x - s * 0.26, p.y - s * 0.35, s * 0.52, s * 0.32);
    ctx.fillStyle = "#9b7040";
    ctx.beginPath();
    ctx.arc(p.x, p.y - s * 0.58, s * 0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(p.x - s * 0.18, p.y - s * 0.45, s * 0.36, s * 0.28);
    ctx.strokeStyle = "rgba(229,182,102,0.44)";
    ctx.lineWidth = Math.max(1, s * 0.05);
    ctx.strokeRect(p.x - s * 0.31, p.y - s * 0.35, s * 0.62, s * 0.34);
    ctx.restore();
  }

  function drawTwinWardensLandmark(landmark) {
    const p = worldToScreen(landmark.x, landmark.y);
    const s = landmarkSize(landmark, 13);
    ctx.save();
    drawLandmarkShadow(p, s);
    ctx.strokeStyle = "#7b7d78";
    ctx.lineWidth = Math.max(2, s * 0.12);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(p.x - s * 0.28, p.y + s * 0.04);
    ctx.quadraticCurveTo(p.x - s * 0.5, p.y - s * 0.62, p.x - s * 0.08, p.y - s * 0.78);
    ctx.moveTo(p.x + s * 0.28, p.y + s * 0.04);
    ctx.quadraticCurveTo(p.x + s * 0.5, p.y - s * 0.62, p.x + s * 0.08, p.y - s * 0.78);
    ctx.stroke();
    ctx.strokeStyle = "rgba(142,220,206,0.38)";
    ctx.lineWidth = Math.max(1, s * 0.04);
    ctx.beginPath();
    ctx.arc(p.x, p.y - s * 0.37, s * 0.5, Math.PI * 0.08, Math.PI * 0.92);
    ctx.stroke();
    ctx.restore();
  }

  function drawRuneStonesLandmark(landmark) {
    const p = worldToScreen(landmark.x, landmark.y);
    const s = landmarkSize(landmark, 34);
    ctx.save();
    drawLandmarkGlow(p.x, p.y - s * 0.36, s * 1.12, "rgba(105,232,119,0.16)");
    drawLandmarkShadow(p, s * 1.12);

    ctx.fillStyle = "#3d2b1f";
    ctx.fillRect(p.x - s * 0.05, p.y - s * 0.48, s * 0.1, s * 0.48);
    ctx.fillStyle = "rgba(45,96,49,0.76)";
    ctx.beginPath();
    ctx.arc(p.x, p.y - s * 0.62, s * 0.26, 0, Math.PI * 2);
    ctx.fill();

    for (let i = 0; i < 6; i += 1) {
      const angle = -Math.PI / 2 + (Math.PI * 2 * i) / 6;
      const x = p.x + Math.cos(angle) * s * 0.72;
      const y = p.y + Math.sin(angle) * s * 0.42;
      const h = s * (0.98 + (i % 3) * 0.16);
      const w = s * (0.2 + (i % 2) * 0.05);

      ctx.fillStyle = "rgba(22,17,14,0.84)";
      ctx.beginPath();
      ctx.moveTo(x - w * 0.7, y);
      ctx.lineTo(x - w * 0.52, y - h * 0.82);
      ctx.lineTo(x, y - h);
      ctx.lineTo(x + w * 0.62, y - h * 0.78);
      ctx.lineTo(x + w * 0.72, y);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = i === 0 ? "#8c5630" : i % 2 ? "#704326" : "#5f3924";
      ctx.beginPath();
      ctx.moveTo(x - w * 0.52, y - s * 0.02);
      ctx.lineTo(x - w * 0.36, y - h * 0.76);
      ctx.lineTo(x, y - h * 0.92);
      ctx.lineTo(x + w * 0.46, y - h * 0.72);
      ctx.lineTo(x + w * 0.54, y - s * 0.02);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = "rgba(128,231,145,0.68)";
      ctx.lineWidth = Math.max(1, s * 0.04);
      ctx.beginPath();
      ctx.moveTo(x - w * 0.18, y - h * 0.72);
      ctx.lineTo(x + w * 0.18, y - h * 0.56);
      ctx.lineTo(x - w * 0.02, y - h * 0.38);
      ctx.moveTo(x - w * 0.1, y - h * 0.24);
      ctx.lineTo(x + w * 0.16, y - h * 0.16);
      ctx.stroke();
    }

    ctx.strokeStyle = "rgba(126,234,136,0.48)";
    ctx.lineWidth = Math.max(1, s * 0.045);
    ctx.beginPath();
    ctx.ellipse(p.x, p.y - s * 0.02, s * 0.92, s * 0.5, 0, 0, Math.PI * 2);
    ctx.moveTo(p.x - s * 0.18, p.y - s * 0.02);
    ctx.lineTo(p.x + s * 0.18, p.y - s * 0.02);
    ctx.moveTo(p.x, p.y - s * 0.16);
    ctx.lineTo(p.x, p.y + s * 0.12);
    ctx.stroke();
    ctx.restore();
  }

  function drawStoryProp(prop) {
    if (!pointInView(prop, 80)) return;

    switch (prop.kind) {
      case "lantern_hub":
      case "camp_lantern":
      case "blue_lantern":
        drawPropLantern(prop);
        break;
      case "bench":
        drawPropBench(prop);
        break;
      case "banner":
        drawPropBanner(prop);
        break;
      case "rune_marker":
      case "green_rune":
        drawPropRune(prop);
        break;
      case "ruin_fragment":
        drawPropRuinFragment(prop);
        break;
      case "market_stall":
        drawPropMarketStall(prop);
        break;
      case "notice_board":
        drawPropNoticeBoard(prop);
        break;
      case "wagon":
        drawPropWagon(prop);
        break;
      case "shrine_basin":
        drawPropShrineBasin(prop);
        break;
      case "stained_glass":
        drawPropStainedGlass(prop);
        break;
      case "botanical":
        drawPropBotanical(prop);
        break;
      case "planter":
        drawPropPlanter(prop);
        break;
      case "shrub":
        drawPropShrub(prop);
        break;
      case "weapon_rack":
        drawPropWeaponRack(prop);
        break;
      case "training_post":
        drawPropTrainingPost(prop);
        break;
      default:
        drawPropRune(prop);
        break;
    }
  }

  function drawPropLantern(prop) {
    const p = worldToScreen(prop.x, prop.y);
    const s = propSize(prop, 5);
    const glow = prop.kind === "blue_lantern" ? "rgba(103,206,226,0.28)" : "rgba(238,177,78,0.24)";
    const flame = prop.kind === "blue_lantern" ? "#8fe0e5" : "#edb45f";
    ctx.save();
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(p.x, p.y - s * 0.7, s * 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#3b3025";
    ctx.lineWidth = Math.max(1, s * 0.18);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x, p.y - s * 1.35);
    ctx.stroke();
    ctx.fillStyle = flame;
    ctx.fillRect(p.x - s * 0.26, p.y - s * 1.25, s * 0.52, s * 0.48);
    ctx.restore();
  }

  function drawPropBench(prop) {
    const p = worldToScreen(prop.x, prop.y);
    const s = propSize(prop, 5);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(prop.rotation || 0);
    ctx.fillStyle = "#5e3d29";
    ctx.fillRect(-s * 0.95, -s * 0.25, s * 1.9, s * 0.28);
    ctx.fillStyle = "#2f241c";
    ctx.fillRect(-s * 0.75, s * 0.1, s * 0.18, s * 0.45);
    ctx.fillRect(s * 0.55, s * 0.1, s * 0.18, s * 0.45);
    ctx.restore();
  }

  function drawPropBanner(prop) {
    const p = worldToScreen(prop.x, prop.y);
    const s = propSize(prop, 6);
    ctx.save();
    ctx.strokeStyle = "#2d241d";
    ctx.lineWidth = Math.max(1, s * 0.22);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y + s * 0.42);
    ctx.lineTo(p.x, p.y - s * 1.34);
    ctx.stroke();
    ctx.fillStyle = "rgba(17,15,13,0.72)";
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - s * 1.18);
    ctx.lineTo(p.x + s * 0.96, p.y - s * 0.9);
    ctx.lineTo(p.x + s * 0.14, p.y - s * 0.5);
    ctx.lineTo(p.x, p.y - s * 0.64);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = districtAccentColor(prop.districtId, 0.76);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - s * 1.12);
    ctx.lineTo(p.x + s * 0.82, p.y - s * 0.9);
    ctx.lineTo(p.x + s * 0.1, p.y - s * 0.62);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(232,214,151,0.36)";
    ctx.lineWidth = Math.max(1, s * 0.07);
    ctx.beginPath();
    ctx.moveTo(p.x + s * 0.16, p.y - s * 0.98);
    ctx.lineTo(p.x + s * 0.52, p.y - s * 0.88);
    ctx.stroke();
    ctx.restore();
  }

  function drawPropRune(prop) {
    const p = worldToScreen(prop.x, prop.y);
    const s = propSize(prop, 5);
    const color = prop.kind === "green_rune" ? "rgba(102,228,114,0.58)" : districtAccentColor(prop.districtId, 0.54);
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1, s * 0.12);
    ctx.beginPath();
    ctx.arc(p.x, p.y, s * 0.78, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(p.x - s * 0.36, p.y);
    ctx.lineTo(p.x + s * 0.36, p.y);
    ctx.moveTo(p.x, p.y - s * 0.36);
    ctx.lineTo(p.x, p.y + s * 0.36);
    ctx.stroke();
    ctx.restore();
  }

  function drawPropRuinFragment(prop) {
    const p = worldToScreen(prop.x, prop.y);
    const s = propSize(prop, 5);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(prop.rotation || 0);
    ctx.fillStyle = "rgba(78,86,68,0.72)";
    ctx.beginPath();
    ctx.moveTo(-s * 0.72, s * 0.25);
    ctx.lineTo(-s * 0.35, -s * 0.52);
    ctx.lineTo(s * 0.22, -s * 0.44);
    ctx.lineTo(s * 0.68, s * 0.08);
    ctx.lineTo(s * 0.18, s * 0.42);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(124,150,101,0.44)";
    ctx.lineWidth = Math.max(1, s * 0.08);
    ctx.beginPath();
    ctx.moveTo(-s * 0.24, -s * 0.3);
    ctx.lineTo(s * 0.12, s * 0.18);
    ctx.stroke();
    ctx.restore();
  }

  function drawPropMarketStall(prop) {
    const p = worldToScreen(prop.x, prop.y);
    const s = propSize(prop, 7);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(prop.rotation || 0);
    ctx.fillStyle = "#65422d";
    ctx.fillRect(-s, -s * 0.35, s * 2, s * 0.65);
    ctx.fillStyle = "#aa6a45";
    ctx.fillRect(-s * 1.08, -s * 0.82, s * 2.16, s * 0.34);
    ctx.fillStyle = "#d1a15a";
    ctx.fillRect(-s * 0.88, -s * 0.82, s * 0.36, s * 0.34);
    ctx.fillRect(-s * 0.16, -s * 0.82, s * 0.36, s * 0.34);
    ctx.fillRect(s * 0.56, -s * 0.82, s * 0.36, s * 0.34);
    ctx.restore();
  }

  function drawPropNoticeBoard(prop) {
    const p = worldToScreen(prop.x, prop.y);
    const s = propSize(prop, 6);
    ctx.save();
    ctx.fillStyle = "#3c2a21";
    ctx.fillRect(p.x - s * 0.72, p.y - s * 0.86, s * 1.44, s * 0.9);
    ctx.fillStyle = "#c19b62";
    ctx.fillRect(p.x - s * 0.5, p.y - s * 0.68, s * 0.36, s * 0.24);
    ctx.fillRect(p.x + s * 0.08, p.y - s * 0.58, s * 0.34, s * 0.2);
    ctx.strokeStyle = "#2a1f19";
    ctx.lineWidth = Math.max(1, s * 0.08);
    ctx.strokeRect(p.x - s * 0.72, p.y - s * 0.86, s * 1.44, s * 0.9);
    ctx.restore();
  }

  function drawPropWagon(prop) {
    const p = worldToScreen(prop.x, prop.y);
    const s = propSize(prop, 7);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(prop.rotation || 0);
    ctx.fillStyle = "#5a3927";
    ctx.fillRect(-s * 0.85, -s * 0.34, s * 1.7, s * 0.62);
    ctx.fillStyle = "#211713";
    ctx.beginPath();
    ctx.arc(-s * 0.55, s * 0.35, s * 0.23, 0, Math.PI * 2);
    ctx.arc(s * 0.55, s * 0.35, s * 0.23, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawPropShrineBasin(prop) {
    const p = worldToScreen(prop.x, prop.y);
    const s = propSize(prop, 6);
    ctx.save();
    ctx.fillStyle = "rgba(74,112,110,0.44)";
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, s * 0.92, s * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(156,222,222,0.62)";
    ctx.lineWidth = Math.max(1, s * 0.09);
    ctx.stroke();
    ctx.restore();
  }

  function drawPropStainedGlass(prop) {
    const p = worldToScreen(prop.x, prop.y);
    const s = propSize(prop, 6);
    ctx.save();
    ctx.fillStyle = "rgba(96,188,202,0.32)";
    ctx.beginPath();
    ctx.arc(p.x, p.y, s * 0.72, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(198,86,139,0.42)";
    ctx.beginPath();
    ctx.arc(p.x - s * 0.16, p.y - s * 0.08, s * 0.28, 0, Math.PI * 2);
    ctx.arc(p.x + s * 0.18, p.y + s * 0.1, s * 0.24, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawPropBotanical(prop) {
    const p = worldToScreen(prop.x, prop.y);
    const s = propSize(prop, 6);
    ctx.save();
    ctx.strokeStyle = "#315c37";
    ctx.lineWidth = Math.max(1, s * 0.1);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y + s * 0.45);
    ctx.lineTo(p.x, p.y - s * 0.45);
    ctx.stroke();
    ctx.fillStyle = "rgba(91,159,80,0.72)";
    for (let i = 0; i < 3; i += 1) {
      ctx.beginPath();
      ctx.ellipse(p.x + (i - 1) * s * 0.24, p.y - i * s * 0.22, s * 0.22, s * 0.1, i - 1, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawPropPlanter(prop) {
    const p = worldToScreen(prop.x, prop.y);
    const s = propSize(prop, 6);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(prop.rotation || 0);
    ctx.fillStyle = "rgba(37,30,24,0.76)";
    ctx.fillRect(-s * 0.9, -s * 0.22, s * 1.8, s * 0.44);
    ctx.strokeStyle = "rgba(167,139,93,0.48)";
    ctx.lineWidth = Math.max(1, s * 0.08);
    ctx.strokeRect(-s * 0.9, -s * 0.22, s * 1.8, s * 0.44);
    ctx.fillStyle = "rgba(55,109,59,0.72)";
    for (let i = -2; i <= 2; i += 1) {
      ctx.beginPath();
      ctx.ellipse(i * s * 0.28, -s * 0.24, s * 0.18, s * 0.28, i * 0.35, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawPropShrub(prop) {
    const p = worldToScreen(prop.x, prop.y);
    const s = propSize(prop, 5);
    ctx.save();
    ctx.fillStyle = "rgba(25,45,29,0.48)";
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + s * 0.16, s * 0.95, s * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(67,124,65,0.72)";
    for (let i = -1; i <= 1; i += 1) {
      ctx.beginPath();
      ctx.arc(p.x + i * s * 0.32, p.y - Math.abs(i) * s * 0.12, s * 0.34, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawPropWeaponRack(prop) {
    const p = worldToScreen(prop.x, prop.y);
    const s = propSize(prop, 6);
    ctx.save();
    ctx.strokeStyle = "#3a2b21";
    ctx.lineWidth = Math.max(1, s * 0.16);
    ctx.beginPath();
    ctx.moveTo(p.x - s * 0.7, p.y);
    ctx.lineTo(p.x + s * 0.7, p.y);
    ctx.moveTo(p.x - s * 0.48, p.y - s * 0.55);
    ctx.lineTo(p.x - s * 0.18, p.y + s * 0.5);
    ctx.moveTo(p.x + s * 0.18, p.y - s * 0.55);
    ctx.lineTo(p.x + s * 0.48, p.y + s * 0.5);
    ctx.stroke();
    ctx.restore();
  }

  function drawPropTrainingPost(prop) {
    const p = worldToScreen(prop.x, prop.y);
    const s = propSize(prop, 6);
    ctx.save();
    ctx.fillStyle = "#5a3b28";
    ctx.fillRect(p.x - s * 0.2, p.y - s * 0.9, s * 0.4, s * 1.15);
    ctx.strokeStyle = "rgba(218,159,90,0.34)";
    ctx.lineWidth = Math.max(1, s * 0.08);
    ctx.beginPath();
    ctx.moveTo(p.x - s * 0.42, p.y - s * 0.48);
    ctx.lineTo(p.x + s * 0.42, p.y - s * 0.36);
    ctx.stroke();
    ctx.restore();
  }

  function drawSmallRunes(x, y, size, color) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1, size * 0.035);
    for (let i = -1; i <= 1; i += 1) {
      const cx = x + i * size * 0.22;
      ctx.beginPath();
      ctx.moveTo(cx - size * 0.05, y - size * 0.08);
      ctx.lineTo(cx + size * 0.04, y);
      ctx.lineTo(cx - size * 0.02, y + size * 0.08);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawLandmarkGlow(x, y, size, color) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawDirectionalLandmarkShadow(point, size, skewX, skewY, color) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(
      point.x + size * skewX,
      point.y + size * (0.18 + skewY),
      size * 0.92,
      size * 0.24,
      -0.24,
      0,
      Math.PI * 2
    );
    ctx.fill();
    ctx.restore();
  }

  function drawLandmarkShadow(point, size) {
    ctx.fillStyle = "rgba(0,0,0,0.42)";
    ctx.beginPath();
    ctx.ellipse(point.x, point.y + size * 0.1, size * 0.82, size * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function landmarkSize(landmark, minimum) {
    return Math.max(minimum, worldSize(landmark.size));
  }

  function propSize(prop, minimum) {
    return Math.max(minimum, worldSize(prop.size || 8));
  }

  function districtAccentColor(districtId, alpha = 1) {
    if (districtId === "sanctuary") return `rgba(122,215,221,${alpha})`;
    if (districtId === "alchemy") return `rgba(104,218,112,${alpha})`;
    if (districtId === "adventurer") return `rgba(224,159,82,${alpha})`;
    if (districtId === "training") return `rgba(197,119,70,${alpha})`;
    if (districtId === "merchant") return `rgba(225,174,91,${alpha})`;
    return `rgba(178,218,187,${alpha})`;
  }

  function drawLandmark(landmark) {
    const point = worldToScreen(landmark.x, landmark.y);
    ctx.fillStyle = "#10150f";
    circle(point.x, point.y, worldSize(14));
    ctx.strokeStyle = "#d6a756";
    ctx.lineWidth = worldSize(3);
    ctx.stroke();
    ctx.fillStyle = "#d6a756";
    circle(point.x, point.y, worldSize(5));
  }

  function drawAtmosphereOverlay() {
    drawPacificNorthwestAtmosphericDepth();
    drawLandmarkMoodLighting();
    drawDistrictLightPools();
    drawLanternLightPools();
    drawRainDarkenedVignette();
  }

  function drawSightlineControlMasks() {
    if (!map?.storyLandmarks) return;

    drawPacificNorthwestCanopyPerimeter();
    drawFaultLineAtmosphericMask();
    drawForestEdgeDepth();
    map.storyLandmarks.forEach((landmark) => {
      if (!pointInView(landmark, landmark.size + 260)) return;

      if (landmark.kind === "rune_stones") {
        drawRuneGroveSightlineMask(landmark);
      } else if (landmark.kind === "clocktower") {
        drawClocktowerRevealMask(landmark);
      } else if (landmark.kind === "historic_hall") {
        drawHarrowsteadMoodMask(landmark);
      }
    });
  }

  function drawLandmarkMoodLighting() {
    if (!map?.storyLandmarks) return;

    ctx.save();
    map.storyLandmarks.forEach((landmark) => {
      if (!pointInView(landmark, landmark.size + 220)) return;

      if (landmark.id === "crimson-commons") {
        drawCrimsonBeaconLight(landmark);
      } else if (landmark.kind === "glass_roses") {
        drawGlassRosesRefraction(landmark);
      } else if (landmark.kind === "organ_hall") {
        drawResonantHallLight(landmark);
      } else if (landmark.kind === "rose_sigil") {
        drawCathedralSacredLight(landmark);
      } else if (landmark.kind === "historic_hall") {
        drawHarrowsteadColdLight(landmark);
      }
    });
    ctx.restore();
  }

  function drawPacificNorthwestAtmosphericDepth() {
    const hierarchy = map?.terrainHierarchy;
    if (!map || !hierarchy) return;

    const fault = worldToScreen(0, hierarchy.faultY).y;
    ctx.save();
    if (fault < canvas.height + 90) {
      const basinFog = ctx.createLinearGradient(0, Math.max(-80, fault), 0, canvas.height);
      basinFog.addColorStop(0, "rgba(10,13,14,0.04)");
      basinFog.addColorStop(0.38, "rgba(116,139,132,0.035)");
      basinFog.addColorStop(0.78, "rgba(61,83,80,0.07)");
      basinFog.addColorStop(1, "rgba(13,22,24,0.12)");
      ctx.fillStyle = basinFog;
      ctx.fillRect(0, Math.max(-80, fault), canvas.width, canvas.height - Math.max(-80, fault));
    }

    const distance = ctx.createLinearGradient(0, 0, 0, canvas.height);
    distance.addColorStop(0, "rgba(139,166,154,0.045)");
    distance.addColorStop(0.42, "rgba(0,0,0,0)");
    distance.addColorStop(1, "rgba(47,70,72,0.04)");
    ctx.fillStyle = distance;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
  }

  function drawPacificNorthwestCanopyPerimeter() {
    if (!map?.world) return;

    ctx.save();
    drawCanopyWall("west", worldToScreen(0, 0).x, "pnw-west");
    drawCanopyWall("east", worldToScreen(map.world.width, 0).x, "pnw-east");
    drawHorizontalCanopyWall("north", worldToScreen(0, 0).y, "pnw-north");
    drawHorizontalCanopyWall("south", worldToScreen(0, map.world.height).y, "pnw-south");
    ctx.restore();
  }

  function drawCanopyWall(side, edgeX, seedBase) {
    if (edgeX < -160 || edgeX > canvas.width + 160) return;

    const inward = side === "west" ? 1 : -1;
    const count = Math.ceil(canvas.height / Math.max(42, worldSize(64))) + 4;
    for (let i = -2; i < count; i += 1) {
      const seed = `${seedBase}:${i}:${Math.round(camera.y / 180)}`;
      const y = i * worldSize(64) - (camera.y * camera.zoom % worldSize(64)) + seededUnit(`${seed}:y`) * worldSize(28);
      const x = edgeX + inward * worldSize(18 + seededUnit(`${seed}:x`) * 54);
      const size = worldSize(34 + seededUnit(`${seed}:size`) * 34);
      drawDouglasFirSilhouette(x, y, size, inward, seededUnit(`${seed}:tone`));
    }
  }

  function drawHorizontalCanopyWall(side, edgeY, seedBase) {
    if (edgeY < -150 || edgeY > canvas.height + 150) return;

    const inward = side === "north" ? 1 : -1;
    const count = Math.ceil(canvas.width / Math.max(42, worldSize(70))) + 4;
    for (let i = -2; i < count; i += 1) {
      const seed = `${seedBase}:${i}:${Math.round(camera.x / 180)}`;
      const x = i * worldSize(70) - (camera.x * camera.zoom % worldSize(70)) + seededUnit(`${seed}:x`) * worldSize(32);
      const y = edgeY + inward * worldSize(18 + seededUnit(`${seed}:y`) * 42);
      const size = worldSize(30 + seededUnit(`${seed}:size`) * 30);
      drawDouglasFirSilhouette(x, y, size, inward, seededUnit(`${seed}:tone`), true);
    }
  }

  function drawDouglasFirSilhouette(x, y, size, direction, tone, horizontal = false) {
    const alpha = 0.18 + tone * 0.1;
    const trunkColor = `rgba(35,29,21,${alpha + 0.05})`;
    const canopyColor = tone > 0.55 ? `rgba(14,45,31,${alpha})` : `rgba(9,34,27,${alpha})`;

    ctx.save();
    ctx.fillStyle = trunkColor;
    ctx.fillRect(x - size * 0.035, y + size * 0.1, size * 0.07, size * 0.62);
    ctx.fillStyle = canopyColor;
    for (let layer = 0; layer < 4; layer += 1) {
      const w = size * (0.62 - layer * 0.09);
      const h = size * (0.36 - layer * 0.04);
      const cy = y - size * 0.36 + layer * size * 0.25;
      ctx.beginPath();
      ctx.moveTo(x, cy - h * 0.68);
      ctx.lineTo(x + w * (horizontal ? 0.82 : direction), cy + h * 0.5);
      ctx.lineTo(x - w * (horizontal ? 0.82 : direction), cy + h * 0.5);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function drawFaultLineAtmosphericMask() {
    const hierarchy = map?.terrainHierarchy;
    if (!map || !hierarchy) return;
    if (!rectInView({ x: 0, y: hierarchy.faultY - 120, w: map.world.width, h: 260 }, 100)) return;

    const y = worldToScreen(0, hierarchy.faultY).y;
    ctx.save();
    const shadow = ctx.createLinearGradient(0, y - worldSize(70), 0, y + worldSize(110));
    shadow.addColorStop(0, "rgba(0,0,0,0)");
    shadow.addColorStop(0.5, "rgba(8,10,10,0.12)");
    shadow.addColorStop(0.72, "rgba(52,63,58,0.06)");
    shadow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = shadow;
    ctx.fillRect(0, y - worldSize(70), canvas.width, worldSize(180));

    ctx.strokeStyle = "rgba(187,170,121,0.055)";
    ctx.lineWidth = Math.max(1, worldSize(1.2));
    ctx.beginPath();
    ctx.moveTo(0, y - worldSize(42));
    ctx.quadraticCurveTo(canvas.width * 0.5, y - worldSize(62), canvas.width, y - worldSize(36));
    ctx.stroke();
    ctx.restore();
  }

  function drawForestEdgeDepth() {
    ctx.save();
    const leftFog = ctx.createLinearGradient(0, 0, canvas.width * 0.18, 0);
    leftFog.addColorStop(0, "rgba(8,23,16,0.13)");
    leftFog.addColorStop(0.58, "rgba(24,54,36,0.05)");
    leftFog.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = leftFog;
    ctx.fillRect(0, 0, canvas.width * 0.22, canvas.height);

    const rightFog = ctx.createLinearGradient(canvas.width, 0, canvas.width * 0.78, 0);
    rightFog.addColorStop(0, "rgba(8,22,18,0.11)");
    rightFog.addColorStop(0.62, "rgba(22,46,36,0.045)");
    rightFog.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = rightFog;
    ctx.fillRect(canvas.width * 0.78, 0, canvas.width * 0.22, canvas.height);

    const topMist = ctx.createLinearGradient(0, 0, 0, canvas.height * 0.25);
    topMist.addColorStop(0, "rgba(143,168,151,0.08)");
    topMist.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = topMist;
    ctx.fillRect(0, 0, canvas.width, canvas.height * 0.25);
    ctx.restore();
  }

  function drawRuneGroveSightlineMask(landmark) {
    const p = worldToScreen(landmark.x, landmark.y);
    const r = Math.max(16, worldSize(landmark.size));

    ctx.save();
    const canopy = [
      [-0.94, -0.62, 0.62, 0.36],
      [-0.24, -0.82, 0.72, 0.42],
      [0.62, -0.58, 0.64, 0.38],
      [-1.12, 0.12, 0.46, 0.3],
      [1.08, 0.04, 0.5, 0.3]
    ];
    canopy.forEach((leaf, index) => {
      const color = index % 2 ? "rgba(11,44,26,0.24)" : "rgba(20,58,32,0.22)";
      drawScreenEllipse(p.x + r * leaf[0], p.y + r * leaf[1], r * leaf[2], r * leaf[3], 0.08 * index, color);
    });

    const shadow = ctx.createRadialGradient(p.x, p.y - r * 0.1, r * 0.2, p.x, p.y, r * 1.45);
    shadow.addColorStop(0, "rgba(7,18,12,0.05)");
    shadow.addColorStop(0.58, "rgba(4,12,8,0.14)");
    shadow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = shadow;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + r * 0.08, r * 1.48, r * 0.84, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(94,143,82,0.15)";
    ctx.lineWidth = Math.max(1, worldSize(1.1));
    for (let i = 0; i < 5; i += 1) {
      const y = p.y + r * (-0.52 + i * 0.23);
      ctx.beginPath();
      ctx.moveTo(p.x - r * 1.34, y);
      ctx.quadraticCurveTo(p.x - r * 0.24, y + r * 0.12, p.x + r * 1.22, y + r * 0.02);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawClocktowerRevealMask(landmark) {
    const p = worldToScreen(landmark.x, landmark.y);
    const r = Math.max(16, worldSize(landmark.size));

    ctx.save();
    drawScreenEllipse(p.x - r * 1.05, p.y - r * 0.38, r * 0.74, r * 0.46, -0.14, "rgba(13,45,29,0.2)");
    drawScreenEllipse(p.x + r * 1.02, p.y - r * 0.24, r * 0.72, r * 0.44, 0.16, "rgba(12,42,31,0.18)");
    drawScreenEllipse(p.x - r * 0.42, p.y + r * 0.34, r * 0.42, r * 0.22, 0.08, "rgba(42,67,38,0.12)");
    drawScreenEllipse(p.x + r * 0.58, p.y + r * 0.42, r * 0.44, r * 0.22, -0.08, "rgba(42,65,38,0.11)");

    ctx.strokeStyle = "rgba(86,71,42,0.18)";
    ctx.lineWidth = Math.max(1, worldSize(1.1));
    for (let i = -3; i <= 3; i += 1) {
      ctx.beginPath();
      ctx.moveTo(p.x + i * r * 0.26, p.y + r * 0.72);
      ctx.quadraticCurveTo(p.x + i * r * 0.16, p.y + r * 0.25, p.x + i * r * 0.42, p.y - r * 0.28);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawHarrowsteadMoodMask(landmark) {
    const p = worldToScreen(landmark.x, landmark.y);
    const r = Math.max(16, worldSize(landmark.size));

    ctx.save();
    const cold = ctx.createRadialGradient(p.x, p.y - r * 0.08, r * 0.16, p.x, p.y + r * 0.08, r * 1.65);
    cold.addColorStop(0, "rgba(31,41,48,0.03)");
    cold.addColorStop(0.55, "rgba(17,25,31,0.1)");
    cold.addColorStop(1, "rgba(5,7,10,0)");
    ctx.fillStyle = cold;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + r * 0.14, r * 1.74, r * 1.02, 0, 0, Math.PI * 2);
    ctx.fill();

    drawScreenEllipse(p.x - r * 1.2, p.y + r * 0.34, r * 0.42, r * 0.22, -0.12, "rgba(16,48,28,0.2)");
    drawScreenEllipse(p.x + r * 1.14, p.y + r * 0.38, r * 0.48, r * 0.24, 0.14, "rgba(14,42,27,0.18)");
    drawScreenEllipse(p.x + r * 0.12, p.y + r * 0.66, r * 0.7, r * 0.2, 0, "rgba(4,7,9,0.16)");
    ctx.restore();
  }

  function drawCrimsonBeaconLight(landmark) {
    const p = worldToScreen(landmark.x, landmark.y);
    const r = Math.max(18, worldSize(landmark.size));

    const safeZone = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 2.25);
    safeZone.addColorStop(0, "rgba(236,167,77,0.14)");
    safeZone.addColorStop(0.5, "rgba(173,89,50,0.07)");
    safeZone.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = safeZone;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r * 2.25, 0, Math.PI * 2);
    ctx.fill();

    const beacon = ctx.createLinearGradient(p.x, p.y - r * 2.1, p.x, p.y + r * 0.8);
    beacon.addColorStop(0, "rgba(248,190,92,0)");
    beacon.addColorStop(0.42, "rgba(248,190,92,0.08)");
    beacon.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = beacon;
    ctx.beginPath();
    ctx.moveTo(p.x - r * 0.28, p.y - r * 2.0);
    ctx.lineTo(p.x + r * 0.28, p.y - r * 2.0);
    ctx.lineTo(p.x + r * 0.64, p.y + r * 0.78);
    ctx.lineTo(p.x - r * 0.64, p.y + r * 0.78);
    ctx.closePath();
    ctx.fill();
  }

  function drawGlassRosesRefraction(landmark) {
    const p = worldToScreen(landmark.x, landmark.y);
    const r = Math.max(14, worldSize(landmark.size));

    [
      ["rgba(229,63,92,0.14)", -0.38, 0.18, 0.78, 0.24, -0.12],
      ["rgba(248,220,105,0.13)", 0.28, 0.32, 0.86, 0.22, 0.16],
      ["rgba(246,244,206,0.1)", 0.06, 0.02, 0.64, 0.18, 0.02]
    ].forEach((glow) => {
      drawScreenEllipse(p.x + r * glow[1], p.y + r * glow[2], r * glow[3], r * glow[4], glow[5], glow[0]);
    });
  }

  function drawResonantHallLight(landmark) {
    const p = worldToScreen(landmark.x, landmark.y);
    const r = Math.max(16, worldSize(landmark.size));

    ctx.strokeStyle = "rgba(238,190,97,0.12)";
    ctx.lineWidth = Math.max(1, worldSize(1.4));
    for (let i = 0; i < 4; i += 1) {
      ctx.beginPath();
      ctx.arc(p.x, p.y - r * 0.2, r * (0.68 + i * 0.22), Math.PI * 0.16, Math.PI * 0.86);
      ctx.stroke();
    }
  }

  function drawCathedralSacredLight(landmark) {
    const p = worldToScreen(landmark.x, landmark.y);
    const r = Math.max(18, worldSize(landmark.size));

    const glow = ctx.createRadialGradient(p.x, p.y - r * 0.36, 0, p.x, p.y - r * 0.1, r * 1.8);
    glow.addColorStop(0, "rgba(126,218,226,0.11)");
    glow.addColorStop(0.45, "rgba(205,91,148,0.07)");
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(p.x, p.y - r * 0.1, r * 1.8, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawHarrowsteadColdLight(landmark) {
    const p = worldToScreen(landmark.x, landmark.y);
    const r = Math.max(16, worldSize(landmark.size));

    const shadow = ctx.createRadialGradient(p.x, p.y + r * 0.18, r * 0.2, p.x, p.y + r * 0.2, r * 1.55);
    shadow.addColorStop(0, "rgba(24,19,16,0.08)");
    shadow.addColorStop(0.5, "rgba(8,11,15,0.1)");
    shadow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = shadow;
    ctx.beginPath();
    ctx.arc(p.x, p.y + r * 0.2, r * 1.55, 0, Math.PI * 2);
    ctx.fill();

    for (let i = -1; i <= 1; i += 2) {
      drawScreenEllipse(p.x + i * r * 1.08, p.y - r * 0.2, r * 0.18, r * 0.1, 0, "rgba(222,157,74,0.08)");
    }
  }

  function drawDistrictLightPools() {
    if (!map?.storyLandmarks) return;

    ctx.save();
    map.storyLandmarks.forEach((landmark) => {
      if (!pointInView(landmark, landmark.size + 180)) return;
      const p = worldToScreen(landmark.x, landmark.y);
      const radius = worldSize(Math.max(60, landmark.size * 1.7));
      const color = landmark.districtId === "sanctuary"
        ? "rgba(106,208,219,0.16)"
        : landmark.districtId === "alchemy"
          ? "rgba(91,184,91,0.1)"
          : landmark.id === "crimson-commons"
            ? "rgba(223,145,71,0.12)"
            : "rgba(207,168,93,0.08)";
      const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius);
      gradient.addColorStop(0, color);
      gradient.addColorStop(0.7, "rgba(0,0,0,0)");
      gradient.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }

  function drawLanternLightPools() {
    if (!map?.storyProps) return;

    ctx.save();
    (map.storyProps || []).forEach((prop) => {
      if (!/lantern|camp_lantern|blue_lantern/.test(prop.kind || "")) return;
      if (!pointInView(prop, 90)) return;
      const p = worldToScreen(prop.x, prop.y);
      const radius = worldSize(prop.kind === "blue_lantern" ? 32 : 28);
      const color = prop.kind === "blue_lantern" ? "rgba(107,205,222,0.14)" : "rgba(236,166,72,0.13)";
      const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius);
      gradient.addColorStop(0, color);
      gradient.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }

  function drawRainDarkenedVignette() {
    ctx.save();
    const gradient = ctx.createRadialGradient(
      canvas.width * 0.5,
      canvas.height * 0.45,
      Math.min(canvas.width, canvas.height) * 0.25,
      canvas.width * 0.5,
      canvas.height * 0.5,
      Math.max(canvas.width, canvas.height) * 0.72
    );
    gradient.addColorStop(0, "rgba(0,0,0,0)");
    gradient.addColorStop(0.72, "rgba(11,20,18,0.06)");
    gradient.addColorStop(1, "rgba(5,10,12,0.18)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const fog = ctx.createLinearGradient(0, 0, 0, canvas.height);
    fog.addColorStop(0, "rgba(163,190,181,0.055)");
    fog.addColorStop(0.45, "rgba(0,0,0,0)");
    fog.addColorStop(1, "rgba(12,21,18,0.08)");
    ctx.fillStyle = fog;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
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
    ctx.fillStyle = "rgba(9,14,11,0.78)";
    ctx.fillRect(panelX, panelY, MINIMAP_WIDTH, MINIMAP_HEIGHT);
    ctx.strokeStyle = "rgba(213,168,91,0.34)";
    ctx.lineWidth = 1;
    ctx.strokeRect(panelX + 0.5, panelY + 0.5, MINIMAP_WIDTH - 1, MINIMAP_HEIGHT - 1);

    ctx.save();
    ctx.beginPath();
    ctx.rect(panelX + 1, panelY + 1, MINIMAP_WIDTH - 2, MINIMAP_HEIGHT - 2);
    ctx.clip();

    map.roads.forEach((road) => drawMiniRoute(road, miniState, "rgba(132,96,58,0.62)", 0.75));
    map.paths.forEach((path) => drawMiniRoute(path, miniState, "rgba(159,154,116,0.46)", 0.5));
    map.parks.forEach((park) => drawMiniPolygon(park.coordinates || rectPoints(park), miniState, miniDistrictColor(visualDistrictForFeature(park), "park")));
    (map.plazas || []).forEach((plaza) => drawMiniPolygon(plaza.coordinates || rectPoints(plaza), miniDistrictColor(visualDistrictForFeature(plaza), "plaza")));
    map.water.forEach((water) => drawMiniPolygon(water.coordinates || rectPoints(water), miniDistrictColor("sanctuary", "water")));
    map.buildings.forEach((building) => drawMiniPolygon(building.coordinates || rectPoints(building), miniDistrictColor(visualDistrictForFeature(building), "building")));
    (map.storyLandmarks || []).forEach((landmark) => drawMiniLandmark(landmark, miniState));

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

  function drawMiniLandmark(landmark, miniState) {
    const point = miniPoint(landmark.x, landmark.y, miniState);
    const radius = landmark.id === "crimson-commons" ? 3.8 : 2.8;
    ctx.save();
    ctx.fillStyle = "rgba(11,15,13,0.86)";
    ctx.beginPath();
    ctx.arc(point.x, point.y, radius + 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = landmark.districtId === "sanctuary"
      ? "rgba(131,221,224,0.92)"
      : landmark.districtId === "alchemy"
        ? "rgba(121,220,119,0.9)"
        : landmark.id === "crimson-commons"
          ? "rgba(231,145,83,0.94)"
          : "rgba(232,190,108,0.92)";
    ctx.beginPath();
    ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function miniDistrictColor(districtId, role) {
    if (role === "water") return "rgba(58,111,125,0.68)";
    if (role === "plaza") return districtId === "merchant" ? "rgba(141,112,70,0.5)" : "rgba(128,103,75,0.46)";
    if (role === "park") {
      if (districtId === "sanctuary") return "rgba(74,126,94,0.54)";
      if (districtId === "alchemy") return "rgba(70,133,66,0.56)";
      return "rgba(61,108,61,0.5)";
    }
    if (districtId === "sanctuary") return "rgba(91,130,127,0.68)";
    if (districtId === "alchemy") return "rgba(87,126,75,0.66)";
    if (districtId === "training") return "rgba(130,84,55,0.68)";
    if (districtId === "adventurer") return "rgba(139,87,56,0.68)";
    return "rgba(128,101,70,0.68)";
  }

  function miniPoint(x, y, miniState) {
    return {
      x: miniState.mapX + x * miniState.scale,
      y: miniState.mapY + y * miniState.scale
    };
  }

  function roofColorForBuilding(building) {
    const text = `${building.displayLabel || ""} ${building.label || ""} ${building.osmLabel || ""} ${building.districtLabel || ""} ${building.name || ""} ${building.id || ""}`.toLowerCase();
    if (text.includes("moonwater")) return "#314043";
    if (text.includes("alchemy")) return "#394329";
    if (text.includes("knight") || text.includes("gym") || text.includes("sport")) return "#3b342c";
    if (text.includes("adventurer") || text.includes("residence") || text.includes("hall")) return "#473026";
    if (text.includes("archive") || text.includes("scholar") || text.includes("bardic") || text.includes("library") || text.includes("center") || text.includes("science")) return "#3a3028";
    return "#4b3327";
  }

  function buildingProfileForBuilding(building, text) {
    const area = polygonArea(building.coordinates || rectPoints(building));
    const district = building.districtId || "";
    if (/harrowstead|harstad|old oak/.test(text)) return "harrowstead";
    if (/rose sigil|cathedral|eastvold/.test(text)) return "cathedral";
    if (/grand bardic theatre|bardic assembly|olson|karen hille phillips|theatre/.test(text)) return "bardic_theatre";
    if (/resonant hymns|mary baker russel+l?|music center|bardic conservatory/.test(text)) return "resonant_hall";
    if (/xavier archive|xavier/.test(text)) return "xavier_archive";
    if (/alchemy|greenhouse|conservatory|glassroot|verdant/.test(text) || district === "alchemy") return "alchemy";
    if (/training|martial|knight|gym|fitness|athletic/.test(text) || district === "training") return "training";
    if (/adventurer|student lodge|lodge|residence|dormitory|commons|hearth/.test(text) || district === "adventurer") return "lodge";
    if (/archive|library|scholar|academy|collegium|college|ramstad|hauge/.test(text)) return "academy";
    if (area >= 22000 && district === "academy") return "academy";
    return "standard";
  }

  function buildingProfilePalette(profile, seed) {
    const palettes = {
      harrowstead: {
        foundationColor: "#433833",
        wallColor: "#5b2d28",
        wallLineColor: "rgba(39,22,19,0.5)",
        roofColor: "#2f2824",
        roofLineColor: "rgba(82,50,40,0.62)",
        roofStripe: "rgba(55,34,29,0.58)",
        roofStripeAlt: "rgba(124,77,56,0.16)",
        trimColor: "rgba(178,128,82,0.62)",
        bottomTrim: "rgba(30,19,16,0.86)",
        outline: "rgba(39,23,18,0.86)",
        windowColor: "#17110f",
        windowTrim: "rgba(210,151,91,0.52)",
        shadowStrength: "rgba(0,0,0,0.34)",
        materialPattern: "brick"
      },
      cathedral: {
        foundationColor: "#4d5149",
        wallColor: "#6f5945",
        wallLineColor: "rgba(44,50,47,0.5)",
        roofColor: "#2d413e",
        roofLineColor: "rgba(139,222,219,0.34)",
        roofStripe: "rgba(43,72,70,0.58)",
        roofStripeAlt: "rgba(221,116,154,0.18)",
        trimColor: "rgba(171,226,219,0.68)",
        bottomTrim: "rgba(38,45,42,0.8)",
        outline: "rgba(164,222,219,0.55)",
        windowColor: "#142222",
        windowTrim: "rgba(158,230,229,0.48)",
        shadowStrength: "rgba(0,0,0,0.34)",
        materialPattern: "cathedral"
      },
      resonant_hall: {
        foundationColor: "#5c5144",
        wallColor: "#8b6a4b",
        wallLineColor: "rgba(68,45,31,0.42)",
        roofColor: "#4e3128",
        roofLineColor: "rgba(236,187,104,0.4)",
        roofStripe: "rgba(111,66,42,0.58)",
        roofStripeAlt: "rgba(240,205,127,0.2)",
        trimColor: "rgba(235,190,109,0.62)",
        bottomTrim: "rgba(59,37,25,0.78)",
        outline: "rgba(183,129,72,0.58)",
        windowColor: "#201713",
        windowTrim: "rgba(239,197,125,0.46)",
        shadowStrength: "rgba(0,0,0,0.31)",
        materialPattern: "concert"
      },
      bardic_theatre: {
        foundationColor: "#5e4a39",
        wallColor: "#9b704c",
        wallLineColor: "rgba(78,47,32,0.38)",
        roofColor: "#58332a",
        roofLineColor: "rgba(239,181,98,0.42)",
        roofStripe: "rgba(126,70,42,0.56)",
        roofStripeAlt: "rgba(244,202,120,0.22)",
        trimColor: "rgba(239,190,111,0.62)",
        bottomTrim: "rgba(66,40,27,0.76)",
        outline: "rgba(178,112,65,0.58)",
        windowColor: "#211410",
        windowTrim: "rgba(244,196,121,0.5)",
        shadowStrength: "rgba(0,0,0,0.3)",
        materialPattern: "concert"
      },
      academy: {
        foundationColor: "#4f5548",
        wallColor: "#8c7d5f",
        wallLineColor: "rgba(54,64,48,0.36)",
        roofColor: "#3b382f",
        roofLineColor: "rgba(170,190,139,0.34)",
        roofStripe: "rgba(70,67,51,0.52)",
        roofStripeAlt: "rgba(185,206,157,0.14)",
        trimColor: "rgba(194,211,157,0.5)",
        bottomTrim: "rgba(46,50,38,0.72)",
        outline: "rgba(95,112,78,0.62)",
        windowColor: "#171c18",
        windowTrim: "rgba(210,219,173,0.34)",
        shadowStrength: "rgba(0,0,0,0.28)",
        materialPattern: "stone_timber"
      },
      xavier_archive: {
        foundationColor: "#5a5242",
        wallColor: "#93815f",
        wallLineColor: "rgba(69,58,41,0.34)",
        roofColor: "#454134",
        roofLineColor: "rgba(196,177,123,0.3)",
        roofStripe: "rgba(73,66,48,0.48)",
        roofStripeAlt: "rgba(210,187,126,0.16)",
        trimColor: "rgba(218,193,132,0.48)",
        bottomTrim: "rgba(54,48,37,0.78)",
        outline: "rgba(124,106,75,0.58)",
        windowColor: "#181812",
        windowTrim: "rgba(231,218,164,0.34)",
        shadowStrength: "rgba(0,0,0,0.27)",
        materialPattern: "archive"
      },
      lodge: {
        foundationColor: "#4c3b31",
        wallColor: "#8d6847",
        wallLineColor: "rgba(54,35,24,0.38)",
        roofColor: "#4d3024",
        roofLineColor: "rgba(210,142,82,0.34)",
        roofStripe: "rgba(92,52,36,0.56)",
        roofStripeAlt: "rgba(220,156,86,0.15)",
        trimColor: "rgba(222,158,89,0.48)",
        bottomTrim: "rgba(50,32,23,0.74)",
        outline: "rgba(99,61,38,0.7)",
        windowColor: "#1d1511",
        windowTrim: "rgba(232,166,91,0.34)",
        shadowStrength: "rgba(0,0,0,0.29)",
        materialPattern: "timber"
      },
      training: {
        foundationColor: "#46382e",
        wallColor: "#76533a",
        wallLineColor: "rgba(56,35,25,0.48)",
        roofColor: "#3b3028",
        roofLineColor: "rgba(185,116,72,0.36)",
        roofStripe: "rgba(70,45,32,0.62)",
        roofStripeAlt: "rgba(152,82,51,0.18)",
        trimColor: "rgba(187,122,76,0.5)",
        bottomTrim: "rgba(45,30,23,0.78)",
        outline: "rgba(88,55,36,0.74)",
        windowColor: "#1a1411",
        windowTrim: "rgba(196,136,82,0.3)",
        shadowStrength: "rgba(0,0,0,0.34)",
        materialPattern: "reinforced"
      },
      alchemy: {
        foundationColor: "#3e5140",
        wallColor: "#71876b",
        wallLineColor: "rgba(43,79,49,0.42)",
        roofColor: "#334b39",
        roofLineColor: "rgba(133,218,130,0.38)",
        roofStripe: "rgba(44,84,53,0.48)",
        roofStripeAlt: "rgba(154,224,134,0.2)",
        trimColor: "rgba(142,218,132,0.55)",
        bottomTrim: "rgba(31,53,34,0.78)",
        outline: "rgba(74,125,69,0.68)",
        windowColor: "rgba(96,170,126,0.58)",
        windowTrim: "rgba(187,240,176,0.44)",
        shadowStrength: "rgba(0,0,0,0.27)",
        materialPattern: "greenhouse"
      }
    };
    const palette = palettes[profile] || null;
    if (!palette) return null;

    return {
      ...palette,
      foundationColor: adjustHexColor(palette.foundationColor, Math.round(seed * 8 - 4)),
      wallColor: adjustHexColor(palette.wallColor, Math.round(seed * 8 - 4)),
      roofColor: adjustHexColor(palette.roofColor, Math.round(seed * 8 - 4))
    };
  }

  function buildingStyle(building) {
    const seed = seededUnit(building.id || building.name || "building");
    const text = `${building.displayLabel || ""} ${building.label || ""} ${building.osmLabel || ""} ${building.districtLabel || ""} ${building.name || ""} ${building.tags?.building || ""}`.toLowerCase();
    const profile = buildingProfileForBuilding(building, text);
    const profilePalette = buildingProfilePalette(profile, seed);
    const roofBaseColor = profilePalette?.roofColor || roofColorForBuilding(building);
    const roofBase = adjustHexColor(roofBaseColor, Math.round(seed * 18 - 8));
    const isLandmark = Boolean(building.osmLabel) || /bardic|moonwater|knight|alchemy|archive|center|science|auditorium|gym|fitness|library|university/.test(text);
    const facadeBase = profilePalette?.wallColor || (text.includes("adventurer") || text.includes("residence") || text.includes("hall") ? "#9d7654" : "#ad835a");
    const roofPatternKey = roofPatternKeyForBuilding(building);
    const wallPatternKey = wallPatternKeyForBuilding(building);
    const district = visualDistrictForFeature(building);
    const grounding = buildingGroundingPalette(district);
    const profiled = Boolean(profilePalette);

    return {
      profile,
      featureType: profiled ? profile : "generic",
      foundationColor: profilePalette?.foundationColor || grounding.baseEdge,
      wallColor: profilePalette?.wallColor || (envPattern(wallPatternKey) || adjustHexColor(facadeBase, Math.round(seed * 18 - 9))),
      wallLineColor: profilePalette?.wallLineColor || "rgba(255,237,190,0.18)",
      roofColor: profilePalette?.roofColor || (envPattern(roofPatternKey) || roofBase),
      roofLineColor: profilePalette?.roofLineColor || (isLandmark ? "rgba(222,177,107,0.62)" : "rgba(78,44,29,0.72)"),
      trimColor: profilePalette?.trimColor || (isLandmark ? "rgba(231,178,91,0.66)" : "rgba(190,132,71,0.5)"),
      windowColor: profilePalette?.windowColor || (seed > 0.45 ? "#1c1513" : "#242016"),
      shadowStrength: profilePalette?.shadowStrength || (seed > 0.6 ? "rgba(0,0,0,0.3)" : "rgba(0,0,0,0.23)"),
      materialPattern: profilePalette?.materialPattern || "generic",
      district,
      roof: profilePalette?.roofColor || (profiled ? roofBase : envPattern(roofPatternKey) || roofBase),
      roofBase,
      roofPatternKey,
      wallPatternKey,
      roofStripe: profilePalette?.roofStripe || (seed > 0.5 ? "rgba(121,69,43,0.6)" : "rgba(92,52,36,0.52)"),
      roofStripeAlt: profilePalette?.roofStripeAlt || "rgba(222,159,93,0.18)",
      roofShade: profile === "harrowstead" ? "rgba(14,9,8,0.32)" : seed > 0.5 ? "rgba(21,13,10,0.2)" : "rgba(196,136,82,0.08)",
      facade: profilePalette?.wallColor || (profiled ? adjustHexColor(facadeBase, Math.round(seed * 12 - 6)) : envPattern(wallPatternKey) || adjustHexColor(facadeBase, Math.round(seed * 18 - 9))),
      facadeLine: profilePalette?.wallLineColor || "rgba(255,237,190,0.18)",
      trim: profilePalette?.trimColor || (isLandmark ? "rgba(231,178,91,0.66)" : "rgba(190,132,71,0.5)"),
      bottomTrim: profilePalette?.bottomTrim || "rgba(42,26,19,0.72)",
      outline: profilePalette?.outline || (isLandmark ? "rgba(222,177,107,0.62)" : "rgba(78,44,29,0.72)"),
      shadow: profilePalette?.shadowStrength || (seed > 0.6 ? "rgba(0,0,0,0.3)" : "rgba(0,0,0,0.23)"),
      window: profilePalette?.windowColor || (seed > 0.45 ? "#1c1513" : "#242016"),
      windowTrim: profilePalette?.windowTrim || "rgba(255,226,160,0.38)",
      windowSpacing: profile === "harrowstead" ? 21 : profile === "xavier_archive" ? 24 : isLandmark ? 27 : seed > 0.5 ? 35 : 42,
      columnEvery: profile === "harrowstead" ? 4 : isLandmark ? 3 : 0,
      groundShadow: grounding.shadow,
      groundGlow: grounding.glow,
      baseEdge: grounding.baseEdge,
      groundMoss: grounding.moss,
      entranceGround: grounding.entrance,
      mossDensity: grounding.mossDensity
    };
  }

  function buildingGroundingPalette(district) {
    if (district === "sanctuary") {
      return {
        shadow: "rgba(0,0,0,0.24)",
        glow: "rgba(142,220,206,0.10)",
        baseEdge: "rgba(55,61,50,0.48)",
        moss: "rgba(113,135,91,0.36)",
        entrance: "rgba(198,188,139,0.22)",
        mossDensity: 0.42
      };
    }
    if (district === "alchemy") {
      return {
        shadow: "rgba(0,0,0,0.28)",
        glow: null,
        baseEdge: "rgba(31,50,29,0.58)",
        moss: "rgba(64,125,58,0.44)",
        entrance: "rgba(55,83,42,0.28)",
        mossDensity: 0.62
      };
    }
    if (district === "training") {
      return {
        shadow: "rgba(0,0,0,0.32)",
        glow: null,
        baseEdge: "rgba(50,33,24,0.62)",
        moss: "rgba(85,80,48,0.30)",
        entrance: "rgba(58,39,26,0.30)",
        mossDensity: 0.36
      };
    }
    return {
      shadow: "rgba(0,0,0,0.28)",
      glow: null,
      baseEdge: "rgba(37,42,32,0.52)",
      moss: "rgba(70,102,54,0.34)",
      entrance: "rgba(77,65,43,0.24)",
      mossDensity: 0.48
    };
  }

  function roofPatternKeyForBuilding(building) {
    const replacement = building.environment?.replacement || "";
    if (/moonwater|sanctuary/.test(replacement)) return "sanctuary_roof";
    if (/alchemy/.test(replacement)) return "alchemy_roof";
    if (/training|knight/.test(replacement)) return "training_roof";
    if (/lodge|adventurer/.test(replacement)) return "old_shingle_roof";
    return "academy_roof";
  }

  function wallPatternKeyForBuilding(building) {
    const replacement = building.environment?.replacement || "";
    if (/moonwater|sanctuary/.test(replacement)) return "sanctuary_wall";
    if (/alchemy/.test(replacement)) return "alchemy_wall";
    if (/lodge|adventurer/.test(replacement)) return "timber_wall";
    return "academy_wall";
  }

  function drawProfiledBuildingBase(building, points, facade, style) {
    drawProfiledFootprintShadow(points, style);
    drawProfiledFoundation(points, facade, style);
    drawProfiledWallMaterial(facade, style);
    drawProfiledRoofMaterial(points, style);
    drawTopHighlight(points, style);
    drawProfiledFoundationTrim(points, facade, style);
    drawSubtleFoundationHistory(points, facade, style);
  }

  function drawProfiledFootprintShadow(points, style) {
    const offsetX = style.featureType === "harrowstead" ? 3.5 : 5;
    const offsetY = style.featureType === "harrowstead" ? 5.5 : 8;
    drawPolygon(offsetPoints(points, offsetX, offsetY), style.shadowStrength);
    if (style.featureType === "cathedral") {
      drawPolygon(offsetPoints(points, 2, 4), "rgba(117,213,215,0.08)");
    } else if (style.featureType === "alchemy") {
      drawPolygon(offsetPoints(points, 2, 4), "rgba(91,183,91,0.08)");
    }
  }

  function drawProfiledFoundation(points, facade, style) {
    drawPolygon(offsetPoints(points, 1.5, 4), style.foundationColor);

    ctx.save();
    ctx.strokeStyle = style.foundationColor;
    ctx.lineWidth = worldSize(style.featureType === "harrowstead" ? 7 : 5);
    ctx.lineCap = "round";
    if (facade) {
      drawWorldSegment(facade.edge.a, facade.edge.b);
    } else {
      directionalEdges(points, "bottom").forEach((edge) => drawWorldSegment(edge.a, edge.b));
    }
    ctx.restore();
  }

  function drawProfiledWallMaterial(facade, style) {
    if (!facade) return;

    drawPolygon(facade.polygon, style.wallColor, style.wallLineColor);

    ctx.save();
    clipToPolygon(facade.polygon);
    ctx.strokeStyle = style.wallLineColor;
    ctx.lineWidth = worldSize(1);

    if (style.materialPattern === "brick") {
      for (let i = 1; i <= 6; i += 1) {
        const t = i / 7;
        drawWorldSegment(lerpPoint(facade.topA, facade.bottomA, t), lerpPoint(facade.topB, facade.bottomB, t));
      }
      for (let i = 1; i <= Math.min(12, Math.floor(facade.length / 18)); i += 1) {
        const t = i / (Math.min(12, Math.floor(facade.length / 18)) + 1);
        drawWorldSegment(facadePoint(facade, t, 0.12), facadePoint(facade, t + 0.015, 0.92));
      }
    } else if (style.materialPattern === "greenhouse") {
      ctx.strokeStyle = "rgba(188,242,182,0.3)";
      for (let i = 1; i <= 5; i += 1) {
        const t = i / 6;
        drawWorldSegment(facadePoint(facade, t, 0.08), facadePoint(facade, t, 0.92));
      }
      ctx.fillStyle = "rgba(153,232,178,0.12)";
      const mid = worldToScreen(facadePoint(facade, 0.5, 0.5));
      ctx.fillRect(mid.x - worldSize(facade.length * 0.36), mid.y - worldSize(10), worldSize(facade.length * 0.72), worldSize(20));
    } else if (style.materialPattern === "timber" || style.materialPattern === "stone_timber") {
      ctx.strokeStyle = style.materialPattern === "timber" ? "rgba(61,37,25,0.52)" : "rgba(56,74,53,0.42)";
      for (let i = 1; i <= 3; i += 1) {
        const t = i / 4;
        drawWorldSegment(lerpPoint(facade.topA, facade.bottomA, t), lerpPoint(facade.topB, facade.bottomB, t));
      }
      [0.18, 0.5, 0.82].forEach((t) => {
        drawWorldSegment(facadePoint(facade, t - 0.1, 0.12), facadePoint(facade, t + 0.1, 0.9));
        drawWorldSegment(facadePoint(facade, t + 0.1, 0.12), facadePoint(facade, t - 0.1, 0.9));
      });
    } else if (style.materialPattern === "cathedral") {
      ctx.strokeStyle = "rgba(164,224,221,0.28)";
      [0.18, 0.34, 0.66, 0.82].forEach((t) => {
        drawWorldSegment(facadePoint(facade, t, 0.08), facadePoint(facade, t, 0.92));
      });
      ctx.strokeStyle = "rgba(225,113,153,0.22)";
      drawWorldSegment(facadePoint(facade, 0.08, 0.78), facadePoint(facade, 0.92, 0.28));
    } else if (style.materialPattern === "concert") {
      ctx.strokeStyle = "rgba(238,194,118,0.28)";
      for (let i = 0; i < 4; i += 1) {
        const top = worldToScreen(facadePoint(facade, 0.18 + i * 0.2, 0.28));
        const end = worldToScreen(facadePoint(facade, 0.28 + i * 0.16, 0.86));
        ctx.beginPath();
        ctx.moveTo(top.x, top.y);
        ctx.quadraticCurveTo((top.x + end.x) / 2, top.y - worldSize(10), end.x, end.y);
        ctx.stroke();
      }
    } else if (style.materialPattern === "reinforced") {
      ctx.strokeStyle = "rgba(49,31,23,0.58)";
      [0.12, 0.88].forEach((t) => {
        drawWorldSegment(facadePoint(facade, t, 0.06), facadePoint(facade, t, 0.95));
      });
      drawWorldSegment(facadePoint(facade, 0.05, 0.78), facadePoint(facade, 0.95, 0.78));
    } else {
      for (let i = 1; i <= 3; i += 1) {
        const t = i / 4;
        drawWorldSegment(lerpPoint(facade.topA, facade.bottomA, t), lerpPoint(facade.topB, facade.bottomB, t));
      }
    }
    ctx.restore();
  }

  function drawProfiledRoofMaterial(points, style) {
    drawPolygon(points, style.roofColor, style.roofLineColor);
    drawProfiledRoofPattern(points, style);
    drawRoofShading(points, style);
  }

  function drawProfiledRoofPattern(points, style) {
    const bounds = boundsFromPoints(points);
    ctx.save();
    clipToPolygon(points);
    ctx.strokeStyle = style.roofStripe;
    ctx.lineWidth = worldSize(style.featureType === "harrowstead" ? 1.6 : 1.1);

    if (style.materialPattern === "greenhouse") {
      ctx.fillStyle = "rgba(130,224,154,0.12)";
      const origin = worldToScreen(bounds.x, bounds.y);
      ctx.fillRect(origin.x, origin.y, worldSize(bounds.w), worldSize(bounds.h));
      ctx.strokeStyle = "rgba(191,244,184,0.34)";
      for (let i = 1; i <= 5; i += 1) {
        const x = bounds.x + (bounds.w * i) / 6;
        drawWorldSegment({ x, y: bounds.y + bounds.h * 0.08 }, { x: x + bounds.h * 0.16, y: bounds.y + bounds.h * 0.92 });
      }
    } else if (style.materialPattern === "concert") {
      for (let i = 0; i < 5; i += 1) {
        const y = bounds.y + bounds.h * (0.28 + i * 0.12);
        drawWorldSegment({ x: bounds.x + bounds.w * 0.12, y }, { x: bounds.x + bounds.w * 0.88, y: y - bounds.h * 0.08 });
      }
    } else {
      const spacing = style.materialPattern === "brick" ? 14 : BUILDING_ROOF_STRIPE_SPACING;
      for (let y = bounds.y - bounds.h; y <= bounds.y + bounds.h * 1.6; y += spacing) {
        drawWorldSegment(
          { x: bounds.x - bounds.h * 0.4, y },
          { x: bounds.x + bounds.w + bounds.h * 0.3, y: y + bounds.w * 0.08 }
        );
      }
    }

    ctx.strokeStyle = style.roofStripeAlt;
    ctx.lineWidth = worldSize(1);
    if (style.materialPattern === "stone_timber" || style.materialPattern === "archive") {
      for (let i = 1; i <= 4; i += 1) {
        const x = bounds.x + (bounds.w * i) / 5;
        drawWorldSegment({ x, y: bounds.y + bounds.h * 0.12 }, { x: x + bounds.h * 0.08, y: bounds.y + bounds.h * 0.86 });
      }
    }
    ctx.restore();
  }

  function drawProfiledFoundationTrim(points, facade, style) {
    ctx.save();
    ctx.strokeStyle = style.bottomTrim;
    ctx.lineWidth = worldSize(style.featureType === "harrowstead" ? 4 : 3);
    ctx.lineCap = "round";
    if (facade) {
      drawWorldSegment(facade.edge.a, facade.edge.b);
    } else {
      directionalEdges(points, "bottom").forEach((edge) => drawWorldSegment(edge.a, edge.b));
    }
    ctx.strokeStyle = style.trimColor;
    ctx.lineWidth = worldSize(1.5);
    directionalEdges(points, "top").forEach((edge) => drawWorldSegment(edge.a, edge.b));
    ctx.restore();
  }

  function drawSubtleFoundationHistory(points, facade, style) {
    if (!facade || !/harrowstead|cathedral|academy|xavier_archive/.test(style.featureType)) return;

    ctx.save();
    ctx.strokeStyle = style.featureType === "cathedral" ? "rgba(141,213,211,0.22)" : "rgba(45,35,27,0.28)";
    ctx.lineWidth = Math.max(1, worldSize(1.1));
    const crackCenter = facadePoint(facade, 0.22, 0.86);
    drawWorldSegment(
      { x: crackCenter.x - 5, y: crackCenter.y - 4 },
      { x: crackCenter.x + 2, y: crackCenter.y + 2 }
    );
    drawWorldSegment(
      { x: crackCenter.x + 2, y: crackCenter.y + 2 },
      { x: crackCenter.x - 1, y: crackCenter.y + 8 }
    );

    if (style.featureType === "harrowstead" || style.featureType === "cathedral") {
      const arch = worldToScreen(facadePoint(facade, 0.78, 0.84));
      ctx.strokeStyle = "rgba(33,26,22,0.34)";
      ctx.lineWidth = Math.max(1, worldSize(1.5));
      ctx.beginPath();
      ctx.arc(arch.x, arch.y, Math.max(4, worldSize(7)), Math.PI, 0);
      ctx.stroke();
      ctx.fillStyle = "rgba(22,18,16,0.18)";
      ctx.fillRect(arch.x - worldSize(6), arch.y, worldSize(12), worldSize(5));
    }
    ctx.restore();
  }

  function drawBuildingGrounding(building, points, facade, style) {
    drawPolygon(offsetPoints(points, 4, 7), style.groundShadow);
    if (style.groundGlow) {
      drawPolygon(offsetPoints(points, 1, 4), style.groundGlow);
    }

    ctx.save();
    ctx.strokeStyle = style.baseEdge;
    ctx.lineWidth = worldSize(4);
    ctx.lineCap = "round";
    directionalEdges(points, "bottom").forEach((edge) => drawWorldSegment(edge.a, edge.b));
    ctx.restore();

    drawBuildingMossSkirt(building, points, style);
    drawEntranceGrounding(building, facade, style);
  }

  function drawBuildingMossSkirt(building, points, style) {
    if (!style.groundMoss) return;

    const seedBase = `${featureSeed(building, "building")}:moss-skirt`;
    ctx.save();
    ctx.strokeStyle = style.groundMoss;
    ctx.lineWidth = worldSize(1.5);
    ctx.lineCap = "round";

    directionalEdges(points, "bottom").forEach((edge, edgeIndex) => {
      const dx = edge.b.x - edge.a.x;
      const dy = edge.b.y - edge.a.y;
      const length = Math.hypot(dx, dy);
      if (length < 12) return;

      const tx = dx / length;
      const ty = dy / length;
      const samples = Math.min(7, Math.max(1, Math.floor(length / 26)));
      for (let sample = 1; sample <= samples; sample += 1) {
        const seed = `${seedBase}:${edgeIndex}:${sample}`;
        if (seededUnit(`${seed}:chance`) > style.mossDensity) continue;

        const t = (sample - 0.25 + seededUnit(`${seed}:t`) * 0.5) / (samples + 0.2);
        const base = {
          x: edge.a.x + dx * t,
          y: edge.a.y + dy * t + 2 + seededUnit(`${seed}:down`) * 4
        };
        const len = 5 + seededUnit(`${seed}:len`) * 12;
        drawWorldSegment(
          { x: base.x - tx * len * 0.45, y: base.y - ty * len * 0.45 },
          { x: base.x + tx * len * 0.45, y: base.y + ty * len * 0.45 }
        );
      }
    });

    ctx.restore();
  }

  function drawEntranceGrounding(building, facade, style) {
    const center = buildingDoorPoint(building, facade);
    if (!center || !style.entranceGround) return;

    const isRealEntrance = building.realEntrances && building.realEntrances.length > 0;
    const radiusX = isRealEntrance ? 15 : 11;
    const radiusY = isRealEntrance ? 6 : 4.5;
    fillWorldEllipse(
      { x: center.x, y: center.y + (isRealEntrance ? 11 : 8) },
      radiusX,
      radiusY,
      0,
      style.entranceGround
    );
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

  function drawArchitecturalAccents(building, points, facade, style) {
    const area = polygonArea(points);
    if (style.profile === "standard" && area < 9000) return;

    drawLargeRoofSegmentation(points, style);
    if (facade) {
      drawFacadeVerticalAccents(facade, style, style.profile === "standard" ? 3 : 5);
    }

    if (style.featureType === "harrowstead") {
      drawHarrowsteadBuildingAccents(facade, style);
    } else if (style.featureType === "cathedral") {
      drawCathedralBuildingAccents(facade, style);
    } else if (style.featureType === "resonant_hall") {
      drawResonantHallBuildingAccents(facade, style);
    } else if (style.featureType === "bardic_theatre") {
      drawBardicTheatreAccents(facade, style);
    } else if (style.featureType === "xavier_archive" || style.featureType === "academy") {
      drawArchiveBuildingAccents(facade, style);
    } else if (style.featureType === "training") {
      drawTrainingBuildingAccents(facade, style);
    } else if (style.featureType === "alchemy") {
      drawAlchemyBuildingAccents(facade, style);
    }
  }

  function drawLargeRoofSegmentation(points, style) {
    const bounds = boundsFromPoints(points);
    if (bounds.w < 46 || bounds.h < 34) return;

    const count = Math.min(6, Math.max(2, Math.floor(bounds.w / 62)));
    ctx.save();
    clipToPolygon(points);
    ctx.strokeStyle = style.profile === "harrowstead" ? "rgba(31,20,17,0.46)" : "rgba(255,225,161,0.16)";
    ctx.lineWidth = worldSize(style.profile === "harrowstead" ? 2 : 1.2);
    for (let i = 1; i <= count; i += 1) {
      const x = bounds.x + (bounds.w * i) / (count + 1);
      drawWorldSegment({ x, y: bounds.y + bounds.h * 0.08 }, { x: x + bounds.h * 0.08, y: bounds.y + bounds.h * 0.92 });
    }
    if (style.featureType === "resonant_hall" || style.featureType === "cathedral" || style.featureType === "bardic_theatre") {
      ctx.strokeStyle = "rgba(235,189,105,0.25)";
      for (let i = 0; i < 3; i += 1) {
        const y = bounds.y + bounds.h * (0.32 + i * 0.16);
        drawWorldSegment({ x: bounds.x + bounds.w * 0.14, y }, { x: bounds.x + bounds.w * 0.86, y: y - bounds.h * 0.05 });
      }
    }
    ctx.restore();
  }

  function drawFacadeVerticalAccents(facade, style, desiredCount) {
    if (!facade || facade.length < 58) return;

    const columns = Math.min(8, Math.max(2, Math.floor(facade.length / 48), desiredCount));
    ctx.save();
    ctx.strokeStyle = style.profile === "harrowstead" ? "rgba(43,24,20,0.64)" : "rgba(255,235,186,0.26)";
    ctx.lineWidth = worldSize(style.profile === "harrowstead" ? 2.4 : 1.5);
    ctx.lineCap = "round";
    for (let i = 1; i <= columns; i += 1) {
      const t = i / (columns + 1);
      drawWorldSegment(facadePoint(facade, t, 0.1), facadePoint(facade, t, 0.95));
    }
    ctx.restore();
  }

  function drawHarrowsteadBuildingAccents(facade, style) {
    if (!facade) return;

    ctx.save();
    ctx.strokeStyle = "rgba(21,14,12,0.84)";
    ctx.lineWidth = worldSize(5);
    ctx.lineCap = "round";
    drawWorldSegment(facadePoint(facade, 0.02, 0.92), facadePoint(facade, 0.98, 0.92));

    const count = Math.min(10, Math.max(4, Math.floor(facade.length / 26)));
    for (let i = 1; i <= count; i += 1) {
      const t = i / (count + 1);
      const center = worldToScreen(facadePoint(facade, t, 0.45));
      const w = Math.max(3, worldSize(5));
      const h = Math.max(8, worldSize(14));
      ctx.fillStyle = "rgba(24,18,16,0.86)";
      ctx.fillRect(center.x - w / 2, center.y - h / 2, w, h);
      ctx.strokeStyle = "rgba(208,151,91,0.48)";
      ctx.lineWidth = Math.max(1, worldSize(0.8));
      ctx.strokeRect(center.x - w / 2, center.y - h / 2, w, h);
    }

    const door = worldToScreen(facadePoint(facade, 0.5, 0.76));
    ctx.fillStyle = "rgba(25,18,16,0.9)";
    ctx.beginPath();
    ctx.moveTo(door.x - worldSize(10), door.y + worldSize(10));
    ctx.lineTo(door.x - worldSize(10), door.y - worldSize(4));
    ctx.quadraticCurveTo(door.x, door.y - worldSize(18), door.x + worldSize(10), door.y - worldSize(4));
    ctx.lineTo(door.x + worldSize(10), door.y + worldSize(10));
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawBardicTheatreAccents(facade, style) {
    if (!facade) return;

    const center = worldToScreen(facadePoint(facade, 0.5, 0.46));
    const left = worldToScreen(facadePoint(facade, 0.15, 0.62));
    const right = worldToScreen(facadePoint(facade, 0.85, 0.62));
    ctx.save();
    ctx.strokeStyle = "rgba(235,190,109,0.38)";
    ctx.lineWidth = Math.max(1, worldSize(2));
    ctx.beginPath();
    ctx.moveTo(left.x, left.y);
    ctx.quadraticCurveTo(center.x, center.y - worldSize(18), right.x, right.y);
    ctx.stroke();

    ctx.fillStyle = "rgba(86,45,38,0.62)";
    [0.28, 0.72].forEach((t) => {
      const p = worldToScreen(facadePoint(facade, t, 0.48));
      ctx.fillRect(p.x - worldSize(3), p.y - worldSize(13), worldSize(6), worldSize(26));
    });
    ctx.restore();
  }

  function drawCathedralBuildingAccents(facade, style) {
    if (!facade) return;

    const rose = worldToScreen(facadePoint(facade, 0.5, 0.38));
    const radius = Math.max(7, worldSize(11));
    ctx.save();
    ctx.fillStyle = "rgba(115,205,212,0.28)";
    ctx.beginPath();
    ctx.arc(rose.x, rose.y, radius * 1.15, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 10; i += 1) {
      const angle = (Math.PI * 2 * i) / 10;
      ctx.fillStyle = i % 2 ? "rgba(220,92,145,0.58)" : "rgba(231,212,111,0.5)";
      ctx.beginPath();
      ctx.ellipse(
        rose.x + Math.cos(angle) * radius * 0.38,
        rose.y + Math.sin(angle) * radius * 0.38,
        radius * 0.18,
        radius * 0.52,
        angle,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }
    ctx.strokeStyle = "rgba(231,245,222,0.68)";
    ctx.lineWidth = Math.max(1, worldSize(1.2));
    ctx.beginPath();
    ctx.arc(rose.x, rose.y, radius * 1.22, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = "rgba(64,69,61,0.72)";
    ctx.lineWidth = Math.max(2, worldSize(2));
    [0.7, 0.82, 0.94].forEach((down, index) => {
      drawWorldSegment(facadePoint(facade, 0.28 - index * 0.04, down), facadePoint(facade, 0.72 + index * 0.04, down));
    });
    ctx.restore();
  }

  function drawResonantHallBuildingAccents(facade, style) {
    if (!facade) return;

    drawBardicTheatreAccents(facade, style);
    ctx.save();
    ctx.fillStyle = "rgba(50,32,23,0.88)";
    ctx.strokeStyle = "rgba(238,194,118,0.44)";
    ctx.lineWidth = Math.max(1, worldSize(0.8));
    for (let i = -3; i <= 3; i += 1) {
      const t = 0.5 + i * 0.045;
      const base = worldToScreen(facadePoint(facade, t, 0.82));
      const top = worldToScreen(facadePoint(facade, t, 0.22 + Math.abs(i) * 0.04));
      const w = Math.max(2, worldSize(3));
      ctx.fillRect(top.x - w / 2, top.y, w, base.y - top.y);
      ctx.strokeRect(top.x - w / 2, top.y, w, base.y - top.y);
    }
    ctx.restore();
  }

  function drawTrainingBuildingAccents(facade, style) {
    if (!facade) return;

    ctx.save();
    ctx.strokeStyle = "rgba(44,29,22,0.7)";
    ctx.lineWidth = worldSize(3);
    drawWorldSegment(facadePoint(facade, 0.06, 0.18), facadePoint(facade, 0.94, 0.18));
    drawWorldSegment(facadePoint(facade, 0.06, 0.82), facadePoint(facade, 0.94, 0.82));
    [0.18, 0.82].forEach((t) => drawWorldSegment(facadePoint(facade, t, 0.08), facadePoint(facade, t, 0.92)));
    ctx.restore();
  }

  function drawAlchemyBuildingAccents(facade, style) {
    if (!facade) return;

    ctx.save();
    ctx.fillStyle = "rgba(122,220,130,0.12)";
    const center = worldToScreen(facadePoint(facade, 0.5, 0.5));
    ctx.beginPath();
    ctx.arc(center.x, center.y, Math.max(8, worldSize(12)), 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(181,241,164,0.46)";
    ctx.lineWidth = Math.max(1, worldSize(1.1));
    ctx.beginPath();
    ctx.arc(center.x, center.y, Math.max(6, worldSize(9)), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawArchiveBuildingAccents(facade, style) {
    if (!facade) return;

    ctx.save();
    ctx.strokeStyle = "rgba(72,55,38,0.54)";
    ctx.lineWidth = worldSize(3);
    [0.18, 0.34, 0.66, 0.82].forEach((t) => {
      drawWorldSegment(facadePoint(facade, t, 0.08), facadePoint(facade, t, 0.95));
    });

    ctx.strokeStyle = "rgba(231,218,164,0.34)";
    ctx.lineWidth = worldSize(1.4);
    [0.28, 0.5, 0.72].forEach((t) => {
      const top = worldToScreen(facadePoint(facade, t, 0.24));
      ctx.beginPath();
      ctx.arc(top.x, top.y, Math.max(3, worldSize(5)), Math.PI, 0);
      ctx.stroke();
    });
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
    if (!building.showLabel || !(building.displayLabel || building.label)) return;
    if (camera.zoom < 1.12 && !isPriorityLabelText(building.displayLabel || building.label)) return;

    const bounds = boundsForFeature(building);
    const labelX = bounds.x + bounds.w / 2;
    const labelY = bounds.h >= 42 ? bounds.y + Math.min(24, bounds.h * 0.35) : bounds.y - 10;
    drawMapLabel(
      labelX,
      labelY,
      building.displayLabel || building.label,
      labelSubtitle(building.districtLabel),
      188
    );
  }

  function drawFeatureLabel(feature) {
    if (!feature.showLabel || !(feature.displayLabel || feature.label)) return;
    if (camera.zoom < 1.18) return;

    const bounds = boundsForFeature(feature);
    drawMapLabel(
      bounds.x + bounds.w / 2,
      bounds.y + bounds.h / 2,
      feature.displayLabel || feature.label,
      labelSubtitle(feature.districtLabel),
      170
    );
  }

  function drawStoryLandmarkLabel(landmark) {
    if (!landmark.showLabel || !landmark.displayLabel) return;
    if (!pointInView(landmark, landmark.size + 120)) return;

    const isPrimaryHub = /crimson-commons|harrowstead-hall|rose-sigil-cathedral|resonant-hymns|watchtower-collegium/.test(landmark.id || "");
    if (camera.zoom < 1.08 && !isPrimaryHub) return;

    drawMapLabel(
      landmark.x,
      landmark.y - landmark.size - 18,
      landmark.displayLabel,
      labelSubtitle(landmark.subtitle || landmark.districtLabel, isPrimaryHub ? 1.58 : 1.68),
      210
    );
  }

  function labelSubtitle(text, zoomThreshold = 1.52) {
    return camera.zoom >= zoomThreshold ? text : "";
  }

  function isPriorityLabelText(text) {
    return /crimson|harrowstead|cathedral|resonant|watchtower|xavier|bardic|highwatch/i.test(String(text || ""));
  }

  function drawMapLabel(x, y, primaryText, secondaryText = "", maxWidth = 188) {
    const p = worldToScreen(x, y);
    const playerScreen = worldToScreen(player.visualX, player.visualY);
    const priorityLabel = isPriorityLabelText(primaryText);

    ctx.save();
    ctx.font = "700 10px Inter, ui-sans-serif, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const primary = ellipsizeText(primaryText, maxWidth);
    const primaryWidth = ctx.measureText(primary).width;
    const secondary = secondaryText ? ellipsizeText(secondaryText, Math.max(120, maxWidth - 24)) : "";
    let secondaryWidth = 0;
    if (secondary) {
      ctx.font = "600 8px Inter, ui-sans-serif, system-ui, sans-serif";
      secondaryWidth = ctx.measureText(secondary).width;
      ctx.font = "700 10px Inter, ui-sans-serif, system-ui, sans-serif";
    }
    const width = Math.min(maxWidth + 10, Math.max(primaryWidth, secondaryWidth) + 12);
    const height = secondary ? 25 : 15;
    let labelX = p.x;
    const labelY = p.y;
    const labelRect = {
      x: labelX - width / 2,
      y: labelY - height / 2,
      w: width,
      h: height
    };

    const minimapRect = minimapLabelAvoidRect();
    if (minimapRect && rectsOverlap(labelRect, minimapRect)) {
      if (!priorityLabel) {
        ctx.restore();
        return;
      }

      labelX = Math.max(width / 2 + 8, minimapRect.x - width / 2 - 8);
      labelRect.x = labelX - width / 2;
      if (rectsOverlap(labelRect, minimapRect)) {
        ctx.restore();
        return;
      }
    }

    if (!priorityLabel && labelNearScreenEdge(labelRect, 10)) {
      ctx.restore();
      return;
    }

    if (pointInScreenRect(playerScreen, labelRect, worldSize(10))) {
      ctx.restore();
      return;
    }
    if (labelRectOverlapsExisting(labelRect, 4)) {
      ctx.restore();
      return;
    }
    renderedLabelRects.push(labelRect);

    ctx.shadowColor = "rgba(0,0,0,0.46)";
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 1;
    ctx.fillStyle = "rgba(13,18,16,0.45)";
    ctx.fillRect(labelRect.x, labelRect.y, labelRect.w, labelRect.h);
    ctx.shadowColor = "transparent";
    ctx.strokeStyle = "rgba(244,216,160,0.13)";
    ctx.lineWidth = 1;
    ctx.strokeRect(labelRect.x, labelRect.y, labelRect.w, labelRect.h);
    ctx.fillStyle = "rgba(247,235,205,0.9)";
    ctx.fillText(primary, labelX, labelY + (secondary ? -4 : 0.5), width - 8);
    if (secondary) {
      ctx.font = "600 8px Inter, ui-sans-serif, system-ui, sans-serif";
      ctx.fillStyle = "rgba(173,205,151,0.82)";
      ctx.fillText(secondary, labelX, labelY + 7.5, width - 8);
    }
    ctx.restore();
  }

  function minimapLabelAvoidRect() {
    if (!showMinimap) return null;
    return {
      x: canvas.width - MINIMAP_WIDTH - 18,
      y: 14,
      w: MINIMAP_WIDTH + 2,
      h: MINIMAP_HEIGHT + 4
    };
  }

  function labelNearScreenEdge(rect, margin) {
    return rect.x < margin ||
      rect.y < margin ||
      rect.x + rect.w > canvas.width - margin ||
      rect.y + rect.h > canvas.height - margin;
  }

  function rectsOverlap(a, b, padding = 0) {
    return a.x < b.x + b.w + padding &&
      a.x + a.w + padding > b.x &&
      a.y < b.y + b.h + padding &&
      a.y + a.h + padding > b.y;
  }

  function labelRectOverlapsExisting(rect, padding = 0) {
    return renderedLabelRects.some((existing) => rectsOverlap(rect, existing, padding));
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

  function drawPolyline(points, width, color, dashed = false, dash = [18, 14]) {
    if (!points || points.length < 2) return;
    if (!color) return;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = width * camera.zoom;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.setLineDash(dashed ? dash.map((value) => worldSize(value)) : []);
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

  function drawWorldPolygon(points, fillStyle, strokeStyle, lineWidth = 1) {
    if (!points || points.length < 3) return;

    const first = worldToScreen(points[0].x, points[0].y);
    ctx.save();
    ctx.fillStyle = fillStyle;
    ctx.strokeStyle = strokeStyle || "transparent";
    ctx.lineWidth = worldSize(lineWidth);
    ctx.lineJoin = "round";
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

  function strokePolygon(points, strokeStyle, width) {
    if (!points || points.length < 3 || !strokeStyle) return;

    const first = worldToScreen(points[0].x, points[0].y);
    ctx.save();
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = worldSize(width);
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(first.x, first.y);
    for (let i = 1; i < points.length; i += 1) {
      const p = worldToScreen(points[i].x, points[i].y);
      ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
    ctx.stroke();
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

    if (feature.points && feature.points.length) {
      return boundsFromPoints(feature.points);
    }

    return {
      x: feature.x,
      y: feature.y,
      w: feature.w,
      h: feature.h
    };
  }

  function centerForFeature(feature) {
    if (!feature) return null;
    if (Number.isFinite(feature.x) && Number.isFinite(feature.y) && !Number.isFinite(feature.w)) {
      return { x: feature.x, y: feature.y };
    }

    const bounds = boundsForFeature(feature);
    if (!bounds || !Number.isFinite(bounds.x) || !Number.isFinite(bounds.y)) return null;
    return centerOfBounds(bounds);
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
