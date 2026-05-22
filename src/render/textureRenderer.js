(() => {
  "use strict";

  function theme() {
    return window.MapTheme || {};
  }

  function preload() {
    // Procedural top-down renderer. No tile assets are required for base terrain.
  }

  function drawTexturedBuilding(ctx, object, helpers, options = {}) {
    if (window.BuildingRenderer) {
      window.BuildingRenderer.drawBuilding(ctx, object, helpers, options);
      return;
    }

    const t = theme();
    const palette = buildingPalette(object, t);
    const rect = helpers.rectFromFeature(object);

    helpers.drawPolygon(object.coordinates, palette.fill, palette.outline);
    helpers.drawPolygonInset(object.coordinates, palette.highlight, 0.7, 1.2);

    drawRoofNoise(ctx, object, rect, palette.noise);

    if (rect.w > 78 && rect.h > 52) {
      drawRoofDetails(ctx, object, rect, palette);
    }

    if (options.showCollision) {
      drawDebugRect(ctx, rect, t.collision || "rgba(255,88,88,0.55)");
    }
  }

  function drawTexturedGrass(ctx, object, helpers) {
    const t = theme();
    const rect = helpers.rectFromFeature(object);
    const isPitch = object.type === "field" || object.tags.leisure === "pitch";
    const isForest = object.layer === "forests";
    const fill = isPitch
      ? t.fieldBase || "#3f7441"
      : isForest
        ? t.forestBase || "#21432f"
        : t.parkBase || t.grassBase || "#2f5e3e";

    helpers.drawPolygon(object.coordinates, fill, "rgba(9,14,12,0.28)");
    drawSoftTerrainVariation(ctx, object, rect, isPitch);

    if (isPitch && rect.w > 58 && rect.h > 44) {
      drawFieldLines(ctx, rect);
    }
  }

  function drawTexturedWater(ctx, object, helpers, time = 0) {
    const t = theme();
    if (object.coordinates.length >= 3) {
      helpers.drawPolygon(object.coordinates, t.waterBase || "#365b6c", "rgba(198,223,228,0.18)");
    } else {
      helpers.drawPolyline(object.coordinates, 16, t.waterDeep || "#284552", false);
      helpers.drawPolyline(object.coordinates, 10, t.waterBase || "#365b6c", false);
    }

    const rect = helpers.rectFromFeature(object);
    ctx.save();
    ctx.strokeStyle = t.waterLine || "rgba(204,228,232,0.20)";
    ctx.lineWidth = 1.5;
    for (let y = rect.y + 24; y < rect.y + rect.h; y += 38) {
      ctx.beginPath();
      for (let x = rect.x + 14; x < rect.x + rect.w; x += 42) {
        const wave = Math.sin((x + time * 28) * 0.035) * 2.5;
        if (x === rect.x + 14) ctx.moveTo(x, y + wave);
        else ctx.lineTo(x, y + wave);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawTexturedRoad(ctx, object, helpers, width = 26) {
    const t = theme();
    helpers.drawPolyline(object.coordinates, width + 9, t.roadEdge || "#293439", false);
    helpers.drawPolyline(object.coordinates, width, t.roadAsphalt || "#3f494d", false);

    if (width >= 24 && object.tags.service !== "parking_aisle") {
      helpers.drawPolyline(object.coordinates, 1.5, t.roadMarking || "rgba(232,222,174,0.24)", true);
    }
  }

  function drawTexturedPath(ctx, object, helpers, width = 9) {
    const t = theme();
    const pathWidth = Math.max(width, object.tags.highway === "pedestrian" ? 28 : 20);
    const fill = object.tags.surface === "asphalt"
      ? t.pathConcreteAlt || "#969986"
      : t.pathConcrete || "#aaa894";

    helpers.drawPolyline(object.coordinates, pathWidth + 4, t.pathOutline || "#535d50", false);
    helpers.drawPolyline(object.coordinates, pathWidth, fill, false);

    if (pathWidth > 11) {
      helpers.drawPolyline(object.coordinates, 1, t.pathMarking || "rgba(255,255,255,0.18)", true);
    }
  }

  function drawParking(ctx, object, helpers) {
    const t = theme();
    const rect = helpers.rectFromFeature(object);
    if (object.coordinates.length >= 3) {
      helpers.drawPolygon(object.coordinates, t.parkingBase || "#464e4d", "rgba(220,225,220,0.14)");
    } else {
      ctx.fillStyle = t.parkingBase || "#464e4d";
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    }

    if (rect.w > 54 && rect.h > 38) {
      ctx.save();
      ctx.strokeStyle = t.parkingStripe || "rgba(236,239,222,0.20)";
      ctx.lineWidth = 1;
      for (let x = rect.x + 15; x < rect.x + rect.w - 8; x += 24) {
        ctx.beginPath();
        ctx.moveTo(x, rect.y + 8);
        ctx.lineTo(x + 7, rect.y + rect.h - 8);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  function drawTree(ctx, x, y, size = 10) {
    const t = theme();
    ctx.save();
    ctx.fillStyle = t.trunk || "#4a3525";
    ctx.fillRect(x - size * 0.1, y + size * 0.26, size * 0.2, size * 0.44);
    ctx.fillStyle = t.foliageDark || "#1f4d34";
    circle(ctx, x, y, size * 0.58);
    ctx.fillStyle = t.foliageMid || "#2d7044";
    circle(ctx, x - size * 0.25, y + size * 0.06, size * 0.38);
    ctx.fillStyle = t.foliageLight || "#4b8d55";
    circle(ctx, x + size * 0.26, y + size * 0.02, size * 0.34);
    ctx.restore();
  }

  function createDecorationPoints(map, helpers) {
    const blocked = map.buildings.map((feature) => helpers.rectFromFeature(feature, 12));
    const routes = [...map.roads, ...map.paths].map((feature) => helpers.rectFromFeature(feature, 18));
    const points = [];

    [...map.parks, ...map.forests].forEach((feature) => {
      const rect = helpers.rectFromFeature(feature, 8);
      const area = Math.max(1, rect.w * rect.h);
      const count = Math.min(9, Math.max(1, Math.floor(area / 52000)));
      const random = seededRandom(feature.id || feature.name || "green");

      for (let i = 0; i < count; i += 1) {
        const point = {
          x: rect.x + 16 + random() * Math.max(1, rect.w - 32),
          y: rect.y + 16 + random() * Math.max(1, rect.h - 32),
          size: 6 + random() * 5
        };

        if (!inAnyRect(point, blocked) && !inAnyRect(point, routes)) {
          points.push(point);
        }
      }
    });

    map.paths.forEach((path) => {
      const random = seededRandom(`${path.id}:path-edge`);
      for (let i = 1; i < path.coordinates.length; i += 1) {
        const a = path.coordinates[i - 1];
        const b = path.coordinates[i];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const length = Math.hypot(dx, dy);
        const samples = Math.min(2, Math.floor(length / 240));
        if (samples <= 0) continue;

        const nx = length > 0 ? -dy / length : 0;
        const ny = length > 0 ? dx / length : 0;

        for (let sample = 0; sample < samples; sample += 1) {
          if (random() < 0.72) continue;
          const side = random() < 0.5 ? -1 : 1;
          const t = (sample + 1) / (samples + 1);
          const offset = 24 + random() * 16;
          const point = {
            x: a.x + dx * t + nx * side * offset,
            y: a.y + dy * t + ny * side * offset,
            size: 5 + random() * 4
          };

          if (!inAnyRect(point, blocked) && !inAnyRect(point, routes)) {
            points.push(point);
          }
        }
      }
    });

    return points;
  }

  function drawIcon() {
    return false;
  }

  function seededRandom(seed) {
    let value = 2166136261;
    const text = String(seed);
    for (let i = 0; i < text.length; i += 1) {
      value ^= text.charCodeAt(i);
      value = Math.imul(value, 16777619);
    }

    return function next() {
      value += 0x6D2B79F5;
      let t = value;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function buildingPalette(object, t) {
    if (object.type === "residenceHall" || object.tags.building === "residential") {
      return {
        fill: t.buildingResidence || "#2d2825",
        outline: "rgba(234,190,135,0.26)",
        highlight: t.buildingHighlight || "rgba(255,255,230,0.11)",
        noise: t.buildingRoofNoise || "rgba(255,255,255,0.045)",
        window: t.buildingWindow || "rgba(240,184,109,0.76)"
      };
    }

    if (object.tags.leisure === "fitness_centre" || object.tags.leisure === "sports_hall") {
      return {
        fill: t.buildingSports || "#28302a",
        outline: "rgba(191,226,169,0.28)",
        highlight: t.buildingHighlight || "rgba(255,255,230,0.11)",
        noise: t.buildingRoofNoise || "rgba(255,255,255,0.045)",
        window: "#bfe2a9"
      };
    }

    if (object.type === "campusBuilding" || object.tags.building === "university") {
      return {
        fill: t.buildingCampus || "#232d2d",
        outline: t.buildingCampusOutline || "rgba(169,238,244,0.32)",
        highlight: t.buildingHighlight || "rgba(255,255,230,0.11)",
        noise: t.buildingRoofNoise || "rgba(255,255,255,0.045)",
        window: "#a9eef4"
      };
    }

    return {
      fill: t.buildingGeneric || t.buildingRoof || "#262624",
      outline: t.buildingOutline || "rgba(238,229,198,0.26)",
      highlight: t.buildingHighlight || "rgba(255,255,230,0.11)",
      noise: t.buildingRoofNoise || "rgba(255,255,255,0.045)",
      window: t.buildingWindow || "rgba(240,184,109,0.76)"
    };
  }

  function drawRoofNoise(ctx, object, rect, color) {
    const random = seededRandom(`${object.id}:roof`);
    const count = Math.min(18, Math.max(4, Math.floor((rect.w * rect.h) / 18000)));
    ctx.save();
    ctx.fillStyle = color;
    for (let i = 0; i < count; i += 1) {
      const w = 3 + random() * 10;
      const h = 1 + random() * 3;
      ctx.fillRect(rect.x + random() * rect.w, rect.y + random() * rect.h, w, h);
    }
    ctx.restore();
  }

  function drawRoofDetails(ctx, object, rect, palette) {
    const random = seededRandom(`${object.id}:roof-details`);
    const count = Math.min(5, Math.max(1, Math.floor((rect.w * rect.h) / 42000)));

    ctx.save();
    ctx.fillStyle = palette.noise;
    ctx.strokeStyle = palette.highlight;
    ctx.lineWidth = 1;
    for (let i = 0; i < count; i += 1) {
      const w = 10 + random() * 14;
      const h = 6 + random() * 10;
      const x = rect.x + 12 + random() * Math.max(1, rect.w - w - 24);
      const y = rect.y + 12 + random() * Math.max(1, rect.h - h - 28);
      ctx.fillRect(x, y, w, h);
      ctx.strokeRect(x, y, w, h);
    }

    if (rect.w > 88) {
      ctx.fillStyle = palette.window;
      const y = rect.y + rect.h - 17;
      for (let x = rect.x + 18; x < rect.x + rect.w - 14; x += 38) {
        ctx.fillRect(x, y, 7, 10);
      }
    }
    ctx.restore();
  }

  function drawSoftTerrainVariation(ctx, object, rect, isPitch) {
    const t = theme();
    const random = seededRandom(`${object.id}:terrain`);
    const strokes = Math.min(isPitch ? 24 : 32, Math.max(6, Math.floor((rect.w * rect.h) / 26000)));

    ctx.save();
    if (isPitch) {
      ctx.fillStyle = t.fieldStripe || "rgba(225,240,178,0.075)";
      for (let x = rect.x + 18; x < rect.x + rect.w; x += 42) {
        ctx.fillRect(x, rect.y + 8, 16, Math.max(0, rect.h - 16));
      }
    }

    ctx.strokeStyle = isPitch
      ? t.grassFleck || "rgba(225,239,190,0.10)"
      : t.grassNoise || "rgba(189,224,153,0.12)";
    ctx.lineWidth = 1;
    for (let i = 0; i < strokes; i += 1) {
      const x = rect.x + random() * rect.w;
      const y = rect.y + random() * rect.h;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 3 + random() * 6, y - 1 + random() * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawFieldLines(ctx, rect) {
    const t = theme();
    ctx.save();
    ctx.strokeStyle = t.fieldLine || "rgba(232,241,199,0.25)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(rect.x + 12, rect.y + 12, Math.max(0, rect.w - 24), Math.max(0, rect.h - 24));
    ctx.beginPath();
    ctx.moveTo(rect.x + rect.w / 2, rect.y + 12);
    ctx.lineTo(rect.x + rect.w / 2, rect.y + rect.h - 12);
    ctx.stroke();
    ctx.restore();
  }

  function drawDebugRect(ctx, rect, color) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    ctx.restore();
  }

  function circle(ctx, x, y, radius) {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  function inAnyRect(point, rects) {
    return rects.some((rect) => (
      point.x >= rect.x &&
      point.x <= rect.x + rect.w &&
      point.y >= rect.y &&
      point.y <= rect.y + rect.h
    ));
  }

  window.TextureRenderer = {
    preload,
    drawTexturedBuilding,
    drawTexturedGrass,
    drawTexturedWater,
    drawTexturedRoad,
    drawTexturedPath,
    drawParking,
    drawTree,
    drawIcon,
    createDecorationPoints,
    seededRandom
  };
})();
