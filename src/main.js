// Pętla gry: scena Three.js, strumieniowanie chunków wokół gracza, chmury.
(function (BC) {
  var B = BC.Blocks;
  var Game = {};
  BC.Game = Game;
  var CS = 16;
  Game.RENDER = 7;        // promień w chunkach
  Game.BUDGET_MS = 7;     // ile ms na klatkę na budowę chunków

  Game.init = function (world) {
    Game.world = world;
    Game.atlas = BC.Textures.createAtlas();
    var tex = new THREE.CanvasTexture(Game.atlas.canvas);
    tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    Game.matOpaque = new THREE.MeshLambertMaterial({ map: tex, vertexColors: true });
    Game.matTransparent = new THREE.MeshLambertMaterial({ map: tex, vertexColors: true, transparent: true, alphaTest: 0.1, side: THREE.DoubleSide, depthWrite: true });

    Game.scene = new THREE.Scene();
    Game.skyColor = new THREE.Color(0x8fd3ff);
    Game.scene.background = Game.skyColor;
    var far = Game.RENDER * CS;
    Game.scene.fog = new THREE.Fog(Game.skyColor, far * 0.55, far * 0.95);
    Game.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, far + 120);
    Game.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    Game.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    Game.renderer.setSize(window.innerWidth, window.innerHeight);
    document.getElementById('game').appendChild(Game.renderer.domElement);

    Game.scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    var sun = new THREE.DirectionalLight(0xfff4d6, 1.3);
    sun.position.set(0.5, 1, 0.3);
    Game.scene.add(sun);

    Game.meshes = {};
    Game.queue = [];
    Game.center = null;
    Game.initClouds();

    window.addEventListener('resize', function () {
      Game.camera.aspect = window.innerWidth / window.innerHeight;
      Game.camera.updateProjectionMatrix();
      Game.renderer.setSize(window.innerWidth, window.innerHeight);
    });
    Game.lastTime = performance.now();
    Game.updaters = [];
    Game.running = true;
    requestAnimationFrame(Game.loop);
  };

  function toGeometry(buf) {
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(buf.positions, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(buf.normals, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(buf.uvs, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(buf.colors, 3));
    g.setIndex(buf.indices);
    return g;
  }

  Game.rebuildChunk = function (key) {
    var parts = key.split(',').map(Number), cx = parts[0], cz = parts[1];
    var w = Game.world;
    if (!w.hasChunk(cx, cz)) return;
    // sąsiedzi muszą istnieć, żeby ściany na granicy były poprawne
    w.ensureChunk(cx - 1, cz); w.ensureChunk(cx + 1, cz); w.ensureChunk(cx, cz - 1); w.ensureChunk(cx, cz + 1);
    Game.disposeChunk(key);
    var built = BC.Mesher.buildChunk(w, cx, cz, Game.atlas);
    var list = [];
    if (built.opaque.count) list.push(new THREE.Mesh(toGeometry(built.opaque), Game.matOpaque));
    if (built.transparent.count) list.push(new THREE.Mesh(toGeometry(built.transparent), Game.matTransparent));
    list.forEach(function (m) { m.frustumCulled = true; Game.scene.add(m); });
    Game.meshes[key] = list;
  };
  Game.disposeChunk = function (key) {
    var old = Game.meshes[key];
    if (old) { old.forEach(function (m) { Game.scene.remove(m); m.geometry.dispose(); }); delete Game.meshes[key]; }
  };
  Game.rebuildChunks = function (keys) { keys.forEach(function (k) { if (Game.meshes[k]) Game.rebuildChunk(k); }); };
  Game.setBlock = function (x, y, z, id) { Game.rebuildChunks(Game.world.set(x, y, z, id)); };

  // Kolejka chunków do zbudowania wokół pozycji gracza.
  Game.updateCenter = function (px, pz) {
    var cx = Math.floor(px / CS), cz = Math.floor(pz / CS);
    if (Game.center && Game.center.cx === cx && Game.center.cz === cz) return;
    Game.center = { cx: cx, cz: cz };
    var R = Game.RENDER, list = [];
    for (var dx = -R; dx <= R; dx++) for (var dz = -R; dz <= R; dz++) {
      if (dx * dx + dz * dz > R * R + 2) continue;
      var key = Game.world.chunkKey(cx + dx, cz + dz);
      if (!Game.meshes[key]) list.push({ key: key, d: dx * dx + dz * dz });
    }
    list.sort(function (a, b) { return a.d - b.d; });
    Game.queue = list.map(function (e) { return e.key; });
    // zwolnij dalekie
    for (var k in Game.meshes) {
      var p = k.split(',').map(Number);
      var ddx = p[0] - cx, ddz = p[1] - cz;
      if (ddx * ddx + ddz * ddz > (R + 2) * (R + 2)) Game.disposeChunk(k);
    }
  };
  Game.processQueue = function (budgetMs) {
    var t0 = performance.now();
    while (Game.queue.length && performance.now() - t0 < budgetMs) {
      var key = Game.queue.shift();
      if (Game.meshes[key]) continue;
      var p = key.split(',').map(Number);
      Game.world.ensureChunk(p[0], p[1]);
      Game.rebuildChunk(key);
    }
  };
  // Synchroniczne załadowanie najbliższych chunków (start gry).
  Game.preload = function (px, pz, radius) {
    var cx = Math.floor(px / CS), cz = Math.floor(pz / CS);
    for (var dx = -radius; dx <= radius; dx++) for (var dz = -radius; dz <= radius; dz++) {
      Game.world.ensureChunk(cx + dx, cz + dz);
      Game.rebuildChunk(Game.world.chunkKey(cx + dx, cz + dz));
    }
  };

  Game.initClouds = function () {
    var g = new THREE.Group();
    var mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, fog: true });
    var rnd = BC.Noise.mulberry32(77);
    Game.cloudArea = 360;
    for (var i = 0; i < 26; i++) {
      var w = 10 + rnd() * 18, d = 8 + rnd() * 14;
      var m = new THREE.Mesh(new THREE.BoxGeometry(w, 1.2, d), mat);
      m.position.set(rnd() * Game.cloudArea, Game.world.height - 2 + rnd() * 4, rnd() * Game.cloudArea);
      g.add(m);
    }
    Game.clouds = g;
    Game.scene.add(g);
  };
  Game.updateClouds = function (dt, px, pz) {
    var A = Game.cloudArea, half = A / 2;
    Game.clouds.children.forEach(function (m) {
      m.position.x += dt * 0.9;
      var rx = ((m.position.x - px + half) % A + A) % A - half;
      var rz = ((m.position.z - pz + half) % A + A) % A - half;
      m.position.x = px + rx; m.position.z = pz + rz;
    });
  };

  Game.loop = function (now) {
    if (!Game.running) return;
    var dt = Math.min(0.05, (now - Game.lastTime) / 1000);
    Game.lastTime = now;
    Game.tick(dt, now / 1000);
    requestAnimationFrame(Game.loop);
  };
  Game.tick = function (dt, t) {
    for (var i = 0; i < Game.updaters.length; i++) Game.updaters[i](dt, t);
    var p = BC.Player.body.pos;
    Game.updateCenter(p.x, p.z);
    Game.processQueue(Game.BUDGET_MS);
    Game.updateClouds(dt, p.x, p.z);
    Game.renderer.render(Game.scene, Game.camera);
  };
})(window.BC);
