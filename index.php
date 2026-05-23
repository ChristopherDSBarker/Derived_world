<?php
declare(strict_types=1);
?>
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Derived World OSM Walking Prototype</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <main class="app-shell">
    <header class="topbar">
      <div>
        <p class="eyebrow">Derived World</p>
        <h1>OSM Walking Prototype</h1>
      </div>
      <div class="status-strip" aria-live="polite">
        <div>
          <span>Position</span>
          <strong id="position">x 0, y 0</strong>
        </div>
        <div>
          <span>Camera</span>
          <strong id="camera">camera 0, 0</strong>
        </div>
        <div>
          <span>Map</span>
          <strong id="map-source">loading</strong>
        </div>
        <div>
          <span>Map Stats</span>
          <strong id="map-stats">loading</strong>
        </div>
        <div>
          <span>Move</span>
          <strong>WASD | +/- zoom | M map</strong>
        </div>
      </div>
    </header>

    <section class="game-layout" aria-label="OpenStreetMap-style walking prototype">
      <canvas id="game" width="960" height="640" tabindex="0" aria-label="Top-down walking map"></canvas>
    </section>
  </main>

  <noscript>This prototype needs JavaScript enabled.</noscript>
  <script src="mapData.js"></script>
  <script src="game.js"></script>
</body>
</html>
