// Pętla gry: scena Three.js, strumieniowanie chunków wokół gracza, chmury, cykl dnia, pochodnie, potwory.
(function (BC) {
  var B = BC.Blocks, S = BC.Survival;
  var Game = {};
  BC.Game = Game;
  var CS = 16;
  Game.RENDER = BC.isTouch ? 5 : 7;   // promień w chunkach
  Game.BUDGET_MS = BC.isTouch ? 5 : 7; // ile ms na klatkę na budowę chunków
  var MAX_TORCH_LIGHTS = BC.isTouch ? 5 : 8;

  var DAY_SKY = new THREE.Color(0x8fd3ff), DUSK_SKY = new THREE.Color(0xf0a060), NIGHT_SKY = new THREE.Color(0x0b1026);
  var tmpColor = new THREE.Color();

  Game.init = function (world, opts) {
    opts = opts || {};
    Game.world = world;
    Game.mode = opts.mode || 'creative';
    Game.time = (opts.time !== undefined) ? opts.time : S.START_TIME;
    Game.darkness = 0; Game.flash = 0;
    Game.atlas = BC.Textures.createAtlas();
    var tex = new THREE.CanvasTexture(Game.atlas.canvas);
    tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    Game.matOpaque = new THREE.MeshLambertMaterial({ map: tex, vertexColors: true });
    Game.matTransparent = new THREE.MeshLambertMaterial({ map: tex, vertexColors: true, transparent: true, alphaTest: 0.1, side: THREE.DoubleSide, depthWrite: true });

    Game.scene = new THREE.Scene();
    Game.skyColor = DAY_SKY.clone();
    Game.scene.background = Game.skyColor;
    var far = Game.RENDER * CS;
    Game.scene.fog = new THREE.Fog(Game.skyColor, far * 0.55, far * 0.95);
    Game.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, far + 120);
    Game.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    Game.renderer.setPixelRatio(BC.isTouch ? 1 : Math.min(window.devicePixelRatio, 1.5));
    Game.renderer.setSize(window.innerWidth, window.innerHeight);
    document.getElementById('game').appendChild(Game.renderer.domElement);

    Game.ambient = new THREE.AmbientLight(0xffffff, 0.8);
    Game.scene.add(Game.ambient);
    Game.sun = new THREE.DirectionalLight(0xfff4d6, 1.3);
    Game.sun.position.set(0.5, 1, 0.3);
    Game.scene.add(Game.sun);
    Game.moon = new THREE.DirectionalLight(0x8090ff, 0);
    Game.moon.position.set(-0.5, 1, -0.3);
    Game.scene.add(Game.moon);
    Game.torchLights = [];
    for (var i = 0; i < MAX_TORCH_LIGHTS; i++) { var pl = new THREE.PointLight(0xffb060, 0, 11, 2); Game.scene.add(pl); Game.torchLights.push(pl); }
    Game.torchTimer = 0;

    Game.meshes = {};
    Game.queue = [];
    Game.center = null;
    Game.initClouds();
    Game.initStars();
    BC.Monsters.init(Game);

    window.addEventListener('resize', function () {
      Game.camera.aspect = window.innerWidth / window.innerHeight;
      Game.camera.updateProjectionMatrix();
      Game.renderer.setSize(window.innerWidth, window.innerHeight);
    });
    Game.lastTime = performance.now();
    Game.updaters = [];
    Game.running = true;
    Game.wasNight = S.isNight(Game.time);
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
  Game.setBlock = function (x, y, z, id) { Game.rebuildChunks(Game.world.set(x, y, z, id)); Game.torchTimer = 0; };

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
  Game.preload = function (px, pz, radius) {
    var cx = Math.floor(px / CS), cz = Math.floor(pz / CS);
    for (var dx = -radius; dx <= radius; dx++) for (var dz = -radius; dz <= radius; dz++) {
      Game.world.ensureChunk(cx + dx, cz + dz);
      Game.rebuildChunk(Game.world.chunkKey(cx + dx, cz + dz));
    }
  };

  Game.initClouds = function () {
    var g = new THREE.Group();
    Game.cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, fog: true });
    var rnd = BC.Noise.mulberry32(77);
    Game.cloudArea = 360;
    for (var i = 0; i < 26; i++) {
      var w = 10 + rnd() * 18, d = 8 + rnd() * 14;
      var m = new THREE.Mesh(new THREE.BoxGeometry(w, 1.2, d), Game.cloudMat);
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
  Game.initStars = function () {
    var rnd = BC.Noise.mulberry32(99), pts = [];
    for (var i = 0; i < 300; i++) {
      var a = rnd() * Math.PI * 2, e = rnd() * Math.PI * 0.45 + 0.05, r = 90;
      pts.push(Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r);
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    Game.starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 1.2, transparent: true, opacity: 0, fog: false, sizeAttenuation: false });
    Game.stars = new THREE.Points(g, Game.starMat);
    Game.stars.frustumCulled = false;
    Game.scene.add(Game.stars);
  };

  // Cykl dnia: kolory nieba, światła, gwiazdy.
  Game.updateDay = function (dt, px, py, pz) {
    Game.time += dt;
    var light = S.sunLight(Game.time);
    var minLight = Game.mode === 'survival' ? 0.14 : 0.3;
    var L = minLight + light * (1 - minLight);
    Game.darkness = 1 - light;
    // niebo: dzień -> zmierzch -> noc
    if (light > 0.5) tmpColor.copy(DUSK_SKY).lerp(DAY_SKY, (light - 0.5) * 2);
    else tmpColor.copy(NIGHT_SKY).lerp(DUSK_SKY, light * 2);
    if (Game.mode !== 'survival') tmpColor.lerp(DAY_SKY, 0.25 * (1 - light));
    if (Game.flash > 0) { tmpColor.lerp(new THREE.Color(0xffffff), Game.flash * 0.8); Game.flash = Math.max(0, Game.flash - dt * 6); }
    Game.skyColor.copy(tmpColor);
    Game.scene.fog.color.copy(tmpColor);
    Game.ambient.intensity = 0.18 + 0.62 * L;
    Game.sun.intensity = 1.3 * light;
    Game.moon.intensity = 0.25 * (1 - light);
    var p = S.phase(Game.time), ang = p * Math.PI * 2;
    Game.sun.position.set(Math.cos(ang) * 0.6, Math.sin(ang), 0.3);
    Game.cloudMat.color.setScalar(0.35 + 0.65 * L);
    Game.starMat.opacity = Math.max(0, 1 - light * 2.5);
    Game.stars.position.set(px, py, pz);
    var night = S.isNight(Game.time);
    if (night !== Game.wasNight) {
      Game.wasNight = night;
      BC.Audio.sfx(night ? 'night' : 'morning');
      BC.HUD.message(night ? 'Zapada noc…' : 'Dzień ' + S.dayNumber(Game.time), 1800);
    }
    BC.HUD.setDay(S.dayNumber(Game.time), light);
    return light;
  };

  // Pochodnie: do MAX najbliższych świeci jako PointLight. Skanuje zmiany gracza (pochodnie są tylko z nich).
  Game.updateTorches = function (dt, px, py, pz) {
    Game.torchTimer -= dt;
    if (Game.torchTimer > 0) return;
    Game.torchTimer = 0.5;
    var diffs = Game.world.diffs, list = [];
    for (var k in diffs) {
      if (diffs[k] !== B.TORCH) continue;
      var c = k.split(',').map(Number);
      var d = (c[0] - px) * (c[0] - px) + (c[1] - py) * (c[1] - py) + (c[2] - pz) * (c[2] - pz);
      if (d < 40 * 40) list.push({ x: c[0], y: c[1], z: c[2], d: d });
    }
    list.sort(function (a, b) { return a.d - b.d; });
    for (var i = 0; i < Game.torchLights.length; i++) {
      var pl = Game.torchLights[i], t = list[i];
      if (t) { pl.position.set(t.x + 0.5, t.y + 0.7, t.z + 0.5); pl.intensity = 22; }
      else pl.intensity = 0;
    }
  };

  Game.loop = function (now) {
    if (!Game.running) return;
    var dt = Math.min(0.05, (now - Game.lastTime) / 1000);
    Game.lastTime = now;
    if (!BC.Player.paused) Game.tick(dt, now / 1000);
    else Game.renderer.render(Game.scene, Game.camera);
    requestAnimationFrame(Game.loop);
  };
  Game.tick = function (dt, t) {
    for (var i = 0; i < Game.updaters.length; i++) Game.updaters[i](dt, t);
    var p = BC.Player.body.pos;
    Game.updateCenter(p.x, p.z);
    Game.processQueue(Game.BUDGET_MS);
    Game.updateClouds(dt, p.x, p.z);
    var light = Game.updateDay(dt, p.x, p.y, p.z);
    Game.updateTorches(dt, p.x, p.y, p.z);
    BC.Monsters.update(dt, t, [BC.Player], light, Game.mode);
    Game.renderer.render(Game.scene, Game.camera);
  };
})(window.BC);
