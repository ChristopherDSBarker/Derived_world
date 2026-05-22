(() => {
  "use strict";

  const IMPORTANT_NAMES = [
    "olson auditorium",
    "olsen auditorium",
    "rieke science center",
    "memorial gymnasium",
    "memorial gymasium",
    "names fitness center",
    "swimming pool",
    "pflueger residence hall",
    "tingelstad residence hall",
    "tinglestad residence hall",
    "anderson university center",
    "columbia center",
    "keck observatory"
  ];

  function drawBuilding(ctx, building, helpers, options = {}) {
    if (!building || !Array.isArray(building.coordinates) || building.coordinates.length < 3) {
      return;
    }

    const theme = window.MapTheme || {};
    const rect = helpers.rectFromFeature(building);
    const style = getBuildingStyle(building, theme, rect);
    const points = building.coordinates;

    drawBuildingShadow(ctx, points, style);
    drawBuildingDepth(ctx, points, style);
    drawRoofSurface(ctx, points, style);
    drawRoofHighlight(ctx, points, rect, style);

    if (rect.w * rect.h > 2400) {
      drawRoofDetails(ctx, building, rect, style);
    }

    drawBuildingEntrances(ctx, building, rect, style, options.routes || []);
    drawFacadeWindows(ctx, points, rect, style);
    drawBuildingOutline(ctx, points, style);

    if (options.showCollision) {
      ctx.save();
      ctx.strokeStyle = theme.collision || "rgba(255,88,88,0.55)";
      ctx.lineWidth = 2;
      ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
      ctx.restore();
    }
  }

  function getBuildingStyle(building, theme, rect = { w: 0, h: 0 }) {
    const name = normalize(building.name || building.tags?.name || "");
    const tags = building.tags || {};
    const type = building.type || "";
    const large = rect.w * rect.h > 26000;
    const important = IMPORTANT_NAMES.some((part) => name.includes(part)) || tags.tourism || tags.historic;
    const athletic = type === "sportsBuilding" ||
      tags.leisure === "fitness_centre" ||
      tags.leisure === "sports_hall" ||
      /gym|fitness|pool|stadium|fieldhouse|athletic|sports/.test(name);
    const residence = type === "residenceHall" ||
      tags.building === "residential" ||
      /residence|hall|dorm|tingelstad|tinglestad|pflueger|south hall/.test(name);
    const campus = type === "campusBuilding" ||
      tags.building === "university" ||
      tags.amenity === "university" ||
      /university|center|auditorium|science|observatory|library|columbia/.test(name);

    let roof = theme.buildingGeneric || theme.buildingRoof || "#262624";
    let wall = theme.buildingWall || "#171a19";
    let outline = theme.buildingOutline || "rgba(246,234,196,0.46)";
    let detail = theme.buildingVent || "rgba(205,213,205,0.46)";
    let accent = theme.buildingWindow || "rgba(240,184,109,0.76)";
    let panelAlpha = 0.12;

    if (campus) {
      roof = theme.buildingCampus || "#232d2d";
      wall = "#151c1d";
      outline = theme.buildingCampusOutline || "rgba(169,238,244,0.52)";
      detail = theme.buildingSkylight || "rgba(169,238,244,0.30)";
      accent = "#a9eef4";
    }

    if (residence) {
      roof = theme.buildingResidence || "#2d2825";
      wall = "#1c1714";
      outline = "rgba(234,190,135,0.48)";
      detail = theme.buildingVent || "rgba(205,213,205,0.42)";
      accent = theme.buildingWindow || "rgba(240,184,109,0.76)";
    }

    if (athletic) {
      roof = theme.buildingSports || "#28302a";
      wall = "#181d1a";
      outline = "rgba(191,226,169,0.48)";
      detail = theme.buildingSkylight || "rgba(169,238,244,0.30)";
      accent = "#bfe2a9";
      panelAlpha = 0.16;
    }

    if (important) {
      outline = theme.buildingMajorOutline || outline;
    }

    return {
      roof,
      wall,
      outline,
      detail,
      accent,
      shadow: theme.buildingShadow || "rgba(0,0,0,0.34)",
      highlight: theme.buildingHighlight || "rgba(255,255,226,0.22)",
      noise: theme.buildingRoofNoise || "rgba(255,255,255,0.065)",
      panel: theme.buildingPanelLine || `rgba(255,255,255,${panelAlpha})`,
      roofStripe: theme.buildingRoofStripe || "rgba(255,255,255,0.055)",
      door: theme.buildingDoor || "#d8b17a",
      doorDark: theme.buildingDoorDark || "#080909",
      important,
      residence,
      athletic,
      campus,
      large,
      depth: clamp(Math.round(Math.min(rect.w, rect.h) / 12), 3, 8),
      shadowOffset: important ? 6 : 4,
      lineWidth: important ? 2.4 : 1.6
    };
  }

  function drawBuildingShadow(ctx, points, style) {
    ctx.save();
    ctx.fillStyle = style.shadow;
    pathPolygon(ctx, offsetPoints(points, style.shadowOffset, style.shadowOffset + 1));
    ctx.fill();
    ctx.restore();
  }

  function drawBuildingDepth(ctx, points, style) {
    ctx.save();
    ctx.fillStyle = style.wall;
    pathPolygon(ctx, offsetPoints(points, 0, style.depth));
    ctx.fill();

    ctx.strokeStyle = style.wall;
    ctx.lineWidth = style.depth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    strokeDirectionalEdges(ctx, points, "south");
    ctx.restore();
  }

  function drawRoofSurface(ctx, points, style) {
    ctx.save();
    ctx.fillStyle = style.roof;
    pathPolygon(ctx, points);
    ctx.fill();
    ctx.clip();
    drawRoofTexture(ctx, points, style);
    ctx.restore();
  }

  function drawRoofTexture(ctx, points, style) {
    const bounds = boundsFromPoints(points);
    const spacing = style.athletic ? 18 : style.residence ? 14 : 16;

    ctx.save();
    ctx.strokeStyle = style.roofStripe;
    ctx.lineWidth = 1;
    for (let y = bounds.y - bounds.w; y < bounds.y + bounds.h + bounds.w; y += spacing) {
      ctx.beginPath();
      ctx.moveTo(bounds.x - 18, y);
      ctx.lineTo(bounds.x + bounds.w + 18, y + bounds.w * 0.16);
      ctx.stroke();
    }

    ctx.strokeStyle = "rgba(0,0,0,0.055)";
    for (let y = bounds.y + spacing / 2; y < bounds.y + bounds.h; y += spacing) {
      ctx.beginPath();
      ctx.moveTo(bounds.x + 4, y);
      ctx.lineTo(bounds.x + bounds.w - 4, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawRoofHighlight(ctx, points, rect, style) {
    ctx.save();
    ctx.strokeStyle = style.highlight;
    ctx.lineWidth = style.important ? 2.2 : 1.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    strokeDirectionalEdges(ctx, points, "north");

    const gradient = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + Math.max(1, rect.h));
    gradient.addColorStop(0, style.highlight);
    gradient.addColorStop(0.42, "rgba(255,255,255,0)");
    gradient.addColorStop(1, "rgba(0,0,0,0.06)");
    ctx.fillStyle = gradient;
    pathPolygon(ctx, points);
    ctx.fill();
    ctx.restore();
  }

  function drawBuildingOutline(ctx, points, style) {
    ctx.save();
    ctx.strokeStyle = style.outline;
    ctx.lineWidth = style.lineWidth;
    ctx.lineJoin = "round";
    pathPolygon(ctx, points);
    ctx.stroke();
    ctx.restore();
  }

  function drawRoofDetails(ctx, building, rect, style) {
    const random = seededRandom(`${building.id}:${building.name || ""}:roof-details`);
    const area = Math.max(1, rect.w * rect.h);
    const ventCount = Math.min(style.large ? 8 : 4, Math.max(1, Math.floor(area / 22000)));

    ctxSaveClipped(ctx, building.coordinates, () => {
      drawRoofNoise(ctx, rect, random, style);
      if (rect.w > 88 || rect.h > 88) {
        drawRoofPanels(ctx, rect, style);
      }
      drawRoofVents(ctx, rect, random, style, ventCount);
      if (style.residence && rect.w > 68) {
        drawRepeatedWindows(ctx, rect, style);
      }
    });
  }

  function drawRoofNoise(ctx, rect, random, style) {
    const count = Math.min(24, Math.max(6, Math.floor((rect.w * rect.h) / 14500)));
    ctx.fillStyle = style.noise;
    for (let i = 0; i < count; i += 1) {
      const w = 4 + random() * 13;
      const h = 1 + random() * 3;
      ctx.fillRect(rect.x + random() * rect.w, rect.y + random() * rect.h, w, h);
    }
  }

  function drawRoofPanels(ctx, rect, style) {
    const spacing = Math.max(28, Math.min(54, Math.min(rect.w, rect.h) / 2));
    ctx.save();
    ctx.strokeStyle = style.panel;
    ctx.lineWidth = 1;
    if (rect.w >= rect.h) {
      for (let x = rect.x + spacing; x < rect.x + rect.w - 12; x += spacing) {
        ctx.beginPath();
        ctx.moveTo(x, rect.y + 10);
        ctx.lineTo(x, rect.y + rect.h - 12);
        ctx.stroke();
      }
    } else {
      for (let y = rect.y + spacing; y < rect.y + rect.h - 12; y += spacing) {
        ctx.beginPath();
        ctx.moveTo(rect.x + 10, y);
        ctx.lineTo(rect.x + rect.w - 12, y);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawRoofVents(ctx, rect, random, style, count) {
    ctx.save();
    ctx.fillStyle = style.detail;
    ctx.strokeStyle = "rgba(0,0,0,0.22)";
    ctx.lineWidth = 1;
    for (let i = 0; i < count; i += 1) {
      const w = style.athletic ? 20 + random() * 18 : 9 + random() * 13;
      const h = style.athletic ? 7 + random() * 7 : 5 + random() * 9;
      const x = rect.x + 12 + random() * Math.max(1, rect.w - w - 24);
      const y = rect.y + 12 + random() * Math.max(1, rect.h - h - 26);
      ctx.fillRect(x, y, w, h);
      ctx.strokeRect(x, y, w, h);
    }
    ctx.restore();
  }

  function drawRepeatedWindows(ctx, rect, style) {
    ctx.save();
    ctx.fillStyle = style.accent;
    const y = rect.y + rect.h - 18;
    for (let x = rect.x + 18; x < rect.x + rect.w - 16; x += 34) {
      ctx.fillRect(x, y, 6, 9);
    }
    ctx.restore();
  }

  function drawFacadeWindows(ctx, points, rect, style) {
    if (rect.w < 44 || rect.h < 34) {
      return;
    }

    const ys = points.map((point) => point.y);
    const southThreshold = Math.min(...ys) + (Math.max(...ys) - Math.min(...ys)) * 0.48;

    ctx.save();
    ctx.fillStyle = style.accent;
    points.forEach((a, index) => {
      const b = points[(index + 1) % points.length];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const length = Math.hypot(dx, dy);
      const midY = (a.y + b.y) / 2;
      if (length < 36 || midY < southThreshold) {
        return;
      }

      const horizontal = Math.abs(dx) >= Math.abs(dy);
      const count = Math.min(8, Math.max(1, Math.floor(length / 32)));
      for (let i = 1; i <= count; i += 1) {
        const t = i / (count + 1);
        const x = a.x + dx * t;
        const y = a.y + dy * t;
        if (horizontal) {
          ctx.fillRect(x - 3, y - 3, 6, 5);
        } else {
          ctx.fillRect(x - 2, y - 4, 5, 8);
        }
      }
    });
    ctx.restore();
  }

  function drawBuildingEntrances(ctx, building, rect, style, routes = []) {
    if (rect.w < 34 || rect.h < 28) {
      return;
    }

    const edge = chooseEntranceEdge(building.coordinates, routes);
    const point = edge ? midpoint(edge.a, edge.b) : { x: rect.x + rect.w / 2, y: rect.y + rect.h };
    const horizontal = edge ? Math.abs(edge.b.x - edge.a.x) >= Math.abs(edge.b.y - edge.a.y) : true;
    const doorLong = clamp(Math.round(Math.min(rect.w, rect.h) * 0.28), 12, 18);
    const doorShort = 5;
    const doorW = horizontal ? doorLong : doorShort;
    const doorH = horizontal ? doorShort : doorLong;

    ctx.save();
    ctx.fillStyle = style.doorDark;
    ctx.fillRect(point.x - doorW / 2 - 1, point.y - doorH / 2 - 1, doorW + 2, doorH + 2);
    ctx.fillStyle = style.door;
    ctx.strokeStyle = "rgba(10,12,12,0.42)";
    ctx.lineWidth = 1;
    ctx.fillRect(point.x - doorW / 2, point.y - doorH / 2, doorW, doorH);
    ctx.strokeRect(point.x - doorW / 2, point.y - doorH / 2, doorW, doorH);
    ctx.restore();
  }

  function chooseEntranceEdge(points, routes = []) {
    let best = null;
    for (let i = 0; i < points.length; i += 1) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      const length = Math.hypot(b.x - a.x, b.y - a.y);
      if (length < 14) continue;
      const mid = midpoint(a, b);
      const routeDistance = nearestRouteDistance(mid, routes);
      const routeScore = Number.isFinite(routeDistance) ? -routeDistance * 3.4 : 0;
      const southBias = mid.y * 0.08;
      const lengthBias = Math.min(length, 110) * 0.22;
      const score = routeScore + southBias + lengthBias;
      if (!best || score > best.score) {
        best = { a, b, score, routeDistance };
      }
    }
    return best;
  }

  function nearestRouteDistance(point, routes) {
    if (!routes || !routes.length) {
      return Infinity;
    }

    let best = Infinity;
    routes.forEach((route) => {
      const points = route.coordinates || route.points || [];
      for (let i = 1; i < points.length; i += 1) {
        best = Math.min(best, pointToSegmentDistance(point, points[i - 1], points[i]));
      }
    });
    return best;
  }

  function pointToSegmentDistance(point, a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lengthSq = dx * dx + dy * dy;
    if (lengthSq === 0) {
      return Math.hypot(point.x - a.x, point.y - a.y);
    }

    const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSq));
    const x = a.x + dx * t;
    const y = a.y + dy * t;
    return Math.hypot(point.x - x, point.y - y);
  }

  function strokeDirectionalEdges(ctx, points, direction) {
    const ys = points.map((point) => point.y);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const threshold = minY + (maxY - minY) * (direction === "north" ? 0.42 : 0.56);

    for (let i = 0; i < points.length; i += 1) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      const midY = (a.y + b.y) / 2;
      if ((direction === "north" && midY <= threshold) || (direction === "south" && midY >= threshold)) {
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }
  }

  function pathPolygon(ctx, points) {
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i += 1) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.closePath();
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

  function midpoint(a, b) {
    return {
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2
    };
  }

  function ctxSaveClipped(ctx, points, draw) {
    ctx.save();
    pathPolygon(ctx, points);
    ctx.clip();
    draw();
    ctx.restore();
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

  function normalize(text) {
    return String(text || "").toLowerCase();
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  window.BuildingRenderer = {
    drawBuilding,
    getBuildingStyle,
    drawBuildingShadow,
    drawRoofDetails,
    drawBuildingEntrances
  };
})();
