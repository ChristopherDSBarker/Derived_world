/*
  Static OSM-like walking map.

  Real OpenStreetMap or Overpass data can plug in later by converting roads,
  paths, buildings, parks, water, and landmarks into this same local shape.
  The game should load local data only; do not fetch live APIs in the loop.
*/

const mapData = {
  name: "Derived World OSM Walking Prototype",
  sourceFile: "mapData.js fallback",
  world: {
    width: 1800,
    height: 1200
  },
  playerSpawn: {
    x: 240,
    y: 280
  },
  roads: [
    {
      id: "main-street",
      name: "Main Street",
      width: 44,
      points: [
        { x: 80, y: 300 },
        { x: 520, y: 300 },
        { x: 900, y: 330 },
        { x: 1360, y: 300 },
        { x: 1720, y: 300 }
      ]
    },
    {
      id: "campus-avenue",
      name: "Campus Avenue",
      width: 38,
      points: [
        { x: 720, y: 80 },
        { x: 710, y: 360 },
        { x: 720, y: 680 },
        { x: 700, y: 1120 }
      ]
    },
    {
      id: "south-loop-road",
      name: "South Loop Road",
      width: 36,
      points: [
        { x: 140, y: 780 },
        { x: 460, y: 760 },
        { x: 820, y: 820 },
        { x: 1260, y: 790 },
        { x: 1660, y: 850 }
      ]
    }
  ],
  paths: [
    {
      id: "quad-path",
      name: "Quad Walk",
      width: 20,
      points: [
        { x: 300, y: 500 },
        { x: 520, y: 430 },
        { x: 720, y: 500 },
        { x: 980, y: 470 },
        { x: 1180, y: 560 }
      ]
    },
    {
      id: "park-path",
      name: "Park Path",
      width: 18,
      points: [
        { x: 260, y: 850 },
        { x: 420, y: 960 },
        { x: 620, y: 930 },
        { x: 780, y: 1030 }
      ]
    },
    {
      id: "waterfront-path",
      name: "Waterfront Path",
      width: 18,
      points: [
        { x: 1210, y: 650 },
        { x: 1390, y: 680 },
        { x: 1600, y: 640 }
      ]
    }
  ],
  buildings: [
    { id: "library", name: "Library", x: 380, y: 180, w: 160, h: 92, roof: "#283030" },
    { id: "science-hall", name: "Science Hall", x: 780, y: 170, w: 210, h: 120, roof: "#242d31" },
    { id: "residence-west", name: "West Residence", x: 170, y: 410, w: 140, h: 140, roof: "#332d28" },
    { id: "student-center", name: "Student Center", x: 590, y: 420, w: 190, h: 135, roof: "#2b302b" },
    { id: "gym", name: "Gymnasium", x: 1020, y: 190, w: 230, h: 150, roof: "#293033" },
    { id: "chapel", name: "Chapel", x: 1320, y: 390, w: 135, h: 150, roof: "#302a2b" },
    { id: "residence-east", name: "East Residence", x: 930, y: 600, w: 170, h: 130, roof: "#352e29" },
    { id: "admin", name: "Administration", x: 420, y: 640, w: 185, h: 110, roof: "#272f2e" },
    { id: "shops", name: "Campus Shops", x: 1330, y: 760, w: 190, h: 105, roof: "#2f2d28" }
  ],
  parks: [
    { id: "central-quad", name: "Central Quad", x: 330, y: 420, w: 220, h: 170 },
    { id: "south-field", name: "South Field", x: 180, y: 850, w: 360, h: 230 },
    { id: "east-green", name: "East Green", x: 1180, y: 460, w: 280, h: 180 }
  ],
  water: [
    { id: "pond", name: "Campus Pond", x: 1240, y: 600, w: 360, h: 150 }
  ],
  landmarks: [
    { id: "bell-tower", name: "Bell Tower", x: 700, y: 375 },
    { id: "statue", name: "Founders Statue", x: 1040, y: 500 },
    { id: "observatory", name: "Small Observatory", x: 1560, y: 235 }
  ]
};

window.mapData = mapData;
