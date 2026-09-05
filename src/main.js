// Pętla gry: scena Three.js, siatki chunków, spinanie modułów.
(function (BC) {
  var B = BC.Blocks;
  var Game = {};
  BC.Game = Game;

  Game.init = function (world) {
    Game.world = world;
    Game.atlas = BC.Textures.createAtlas();
    var tex = new THREE.CanvasTexture(Game.atlas.canvas);
    tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    Game.matOpaque = new THREE.MeshLambertMaterial({ map: tex, vertexColors: true });
    Game.matTransparent = new THREE.MeshLambertMaterial({ map: tex, vertexColors: true, transparent: true, alphaTest: 0.1, side: THREE.DoubleSide, depthWrite: true });

    Game.scene = new THREE.Scene();
    Game.scene.background = new THREE.Color(0x8fd3ff);
    Game.scene.fog = new THREE.Fog(0x8fd3ff, 40, 110);
    Game.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 300);
    Game.renderer = new THREE.WebGLRenderer({ antialias: false });
    Game.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    Game.renderer.setSize(window.innerWidth, window.innerHeight);
    document.getElementById('game').appendChild(Game.renderer.domElement);

    Game.scene.add(new THREE.AmbientLight(0xffffff, 0.75));
    var sun = new THREE.DirectionalLight(0xfff4d6, 1.4);
    sun.position.set(0.5, 1, 0.3);
    Game.scene.add(sun);

    Game.meshes = {};
    world.forEachChunk(function (cx, cz) { Game.rebuildChunk(world.chunkKey(cx, cz)); });

    window.addEventListener('resize', function () {
      Game.camera.aspect = window.innerWidth / window.innerHeight;
      Game.camera.updateProjectionMatrix();
      Game.renderer.setSize(window.innerWidth, window.innerHeight);
    });
    Game.lastTime = performance.now();
    Game.updaters = [];
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
    var parts = key.split(',').map(Number);
    var old = Game.meshes[key];
    if (old) { old.forEach(function (m) { Game.scene.remove(m); m.geometry.dispose(); }); }
    var built = BC.Mesher.buildChunk(Game.world, parts[0], parts[1], Game.atlas);
    var list = [];
    if (built.opaque.count) list.push(new THREE.Mesh(toGeometry(built.opaque), Game.matOpaque));
    if (built.transparent.count) list.push(new THREE.Mesh(toGeometry(built.transparent), Game.matTransparent));
    list.forEach(function (m) { Game.scene.add(m); });
    Game.meshes[key] = list;
  };
  Game.rebuildChunks = function (keys) { keys.forEach(Game.rebuildChunk); };

  Game.setBlock = function (x, y, z, id) { Game.rebuildChunks(Game.world.set(x, y, z, id)); };

  Game.loop = function (now) {
    var dt = Math.min(0.05, (now - Game.lastTime) / 1000);
    Game.lastTime = now;
    for (var i = 0; i < Game.updaters.length; i++) Game.updaters[i](dt, now / 1000);
    Game.renderer.render(Game.scene, Game.camera);
    requestAnimationFrame(Game.loop);
  };
})(window.BC);
