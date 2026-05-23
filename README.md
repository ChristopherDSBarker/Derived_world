# Derived World OSM Walking Prototype

A minimal browser prototype for a 2D top-down walking map inspired by OpenStreetMap.

## Files

- `index.php` loads the page.
- `style.css` styles the page and canvas.
- `mapData.js` contains local static OSM-like map data.
- `game.js` handles Canvas rendering, WASD input, camera follow, player movement, and collision.
- `README.md` explains the prototype.

## Run Locally

```bash
php -S localhost:8000
```

Open:

```text
http://localhost:8000
```

## Controls

- `W` move up
- `A` move left
- `S` move down
- `D` move right
- `-` zoom camera out
- `=` / `+` zoom camera in
- `M` show or hide the minimap

Arrow keys do nothing.

## Current Features

- Static local map data from `mapData.js`
- Canvas-rendered roads, paths, buildings, parks, water, and landmarks
- WASD-only player movement
- Camera follows the player with an RPG-style zoom
- Fixed top-right minimap with player and viewport
- Buildings block movement
- Water blocks movement

## Map Data Shape

`mapData.js` contains:

- `roads`
- `paths`
- `buildings`
- `parks`
- `water`
- `landmarks`
- `playerSpawn`

Real OpenStreetMap or Overpass data can plug in later by converting external OSM geometry into this same local data shape. Do not fetch live APIs from the game loop.
