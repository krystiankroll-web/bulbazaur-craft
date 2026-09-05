// Gracz: sterowanie, kamera FPP/TPP, edycja bloków, moce Bulbazaura.
(function (BC) {
  var B = BC.Blocks, Info = BC.BlockInfo;
  var Player = {};
  var keys = {}, yaw = 0, pitch = 0, tpp = false, lastSpace = 0, spaceHeld = false;
  var REACH = 6, VINE_REACH = 8;
  var saplings = [];
  var vine = null;

  Player.init = function (game) {
    var world = game.world;
    Player.game = game;
    var sx = Math.floor(world.size / 2) + 0.5, sz = Math.floor(world.size / 2) + 0.5;
    Player.body = BC.Physics.makeBody(sx, world.surfaceY(Math.floor(sx), Math.floor(sz)) + 1.01, sz);
    var saved = Player.loadPos();
    if (saved) { Player.body.pos = saved.pos; yaw = saved.yaw; pitch = saved.pitch; }
    Player.body.flying = false;

    Player.model = BC.Bulbasaur.create();
    Player.model.group.visible = false;
    game.scene.add(Player.model.group);

    Player.selBox = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1.002, 1.002, 1.002)),
      new THREE.LineBasicMaterial({ color: 0x111111 }));
    Player.selBox.visible = false;
    game.scene.add(Player.selBox);

    vine = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1, 6), new THREE.MeshLambertMaterial({ color: 0x3fae3c }));
    vine.visible = false; vine.userData = { t: 0 };
    game.scene.add(vine);

    var canvas = game.renderer.domElement;
    Player.canvas = canvas;
    var dragging = false, dragMoved = 0;
    canvas.addEventListener('click', function () { if (!Player.paused) Player.lockPointer(); });
    document.addEventListener('mousemove', function (e) {
      if (!Player.active()) return;
      if (Player.fallback && !dragging) return;
      yaw -= e.movementX * 0.0025;
      pitch -= e.movementY * 0.0025;
      pitch = Math.max(-1.5, Math.min(1.5, pitch));
      dragMoved += Math.abs(e.movementX) + Math.abs(e.movementY);
    });
    canvas.addEventListener('mousedown', function (e) {
      if (!Player.active()) return;
      if (Player.fallback) { dragging = true; dragMoved = 0; return; }
      if (e.button === 0) Player.breakBlock(REACH);
      if (e.button === 2) Player.placeBlock();
    });
    canvas.addEventListener('mouseup', function (e) {
      if (!Player.fallback || !Player.active()) return;
      dragging = false;
      if (dragMoved < 6) { if (e.button === 0) Player.breakBlock(REACH); if (e.button === 2) Player.placeBlock(); }
    });
    document.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    document.addEventListener('wheel', function (e) {
      if (!Player.active()) return;
      BC.HUD.setSlot((BC.HUD.slot + (e.deltaY > 0 ? 1 : 8)) % 9);
    });
    document.addEventListener('keydown', function (e) {
      if (e.code === 'Escape' && Player.fallback && Player.active()) { Player.paused = true; BC.Boot.showMenu(); return; }
      if (!Player.active()) return;
      keys[e.code] = true;
      if (e.code >= 'Digit1' && e.code <= 'Digit9') BC.HUD.setSlot(Number(e.code[5]) - 1);
      if (e.code === 'Tab') { e.preventDefault(); BC.HUD.setPage(1 - BC.HUD.page); }
      if (e.code === 'F5') { e.preventDefault(); tpp = !tpp; Player.model.group.visible = tpp; BC.HUD.message(tpp ? 'Widok z boku' : 'Widok z oczu Bulbazaura', 1000); }
      if (e.code === 'KeyQ') Player.vineWhip();
      if (e.code === 'KeyE') Player.plantSeed();
      if (e.code === 'Space' && !spaceHeld) {
        spaceHeld = true;
        var now = performance.now();
        if (now - lastSpace < 300) {
          Player.body.flying = !Player.body.flying;
          Player.body.vel.y = 0;
          BC.HUD.message(Player.body.flying ? 'Latanie włączone' : 'Latanie wyłączone', 1000);
        }
        lastSpace = now;
      }
    });
    document.addEventListener('keyup', function (e) { keys[e.code] = false; if (e.code === 'Space') spaceHeld = false; });
    document.addEventListener('pointerlockchange', function () {
      if (document.pointerLockElement !== canvas && !Player.fallback) { keys = {}; if (BC.Boot) BC.Boot.showMenu(); }
    });
    game.updaters.push(Player.update);
  };

  // Gra jest aktywna, gdy kursor jest zablokowany albo działa tryb awaryjny bez blokady.
  Player.active = function () {
    return !Player.paused && (Player.fallback || document.pointerLockElement === Player.canvas);
  };
  Player.lockPointer = function () {
    if (Player.fallback) return;
    var p;
    try { p = Player.canvas.requestPointerLock(); } catch (e) { Player.enableFallback(); return; }
    if (p && p.catch) p.catch(function () { Player.enableFallback(); });
  };
  Player.enableFallback = function () {
    if (Player.fallback) return;
    Player.fallback = true;
    BC.HUD.message('Rozglądaj się przeciągając myszą', 2500);
  };
  function forward() { return { x: -Math.sin(yaw), z: -Math.cos(yaw) }; }
  function eye() { var p = Player.body.pos; return { x: p.x, y: p.y + 1.5, z: p.z }; }
  function lookDir() {
    var cp = Math.cos(pitch);
    return { x: -Math.sin(yaw) * cp, y: Math.sin(pitch), z: -Math.cos(yaw) * cp };
  }
  Player.aim = function (dist) { return BC.Raycast.cast(Player.game.world, eye(), lookDir(), dist); };

  Player.update = function (dt, t) {
    var body = Player.body, game = Player.game;
    var f = forward(), r = { x: -f.z, z: f.x };
    var mx = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
    var mz = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0);
    var len = Math.hypot(mx, mz) || 1;
    var speed = body.flying ? 11 : (body.inWater ? 3 : 5.5);
    var vx = (f.x * mz + r.x * mx) / len * speed, vz = (f.z * mz + r.z * mx) / len * speed;
    // płynne przyspieszanie
    var k = body.flying ? 0.15 : 0.35;
    body.vel.x += (vx - body.vel.x) * k;
    body.vel.z += (vz - body.vel.z) * k;
    if (body.flying) {
      var vy = (keys.Space ? 1 : 0) - (keys.ShiftLeft || keys.ShiftRight ? 1 : 0);
      body.vel.y += (vy * 9 - body.vel.y) * 0.2;
    } else if (keys.Space) {
      if (body.onGround) body.vel.y = (keys.ShiftLeft || keys.ShiftRight) ? 16 : 9;
      else if (body.inWater) body.vel.y = 4;
    }
    BC.Physics.step(game.world, body, dt);
    if (body.flying && body.onGround) body.flying = false;

    // kamera
    var cam = game.camera;
    cam.rotation.order = 'YXZ';
    cam.rotation.set(pitch, yaw, 0);
    var e = eye();
    if (tpp) {
      var d = lookDir();
      cam.position.set(e.x - d.x * 4.5, e.y - d.y * 4.5 + 0.8, e.z - d.z * 4.5);
      cam.lookAt(e.x, e.y + 0.3, e.z);
      var g = Player.model.group;
      g.position.set(body.pos.x, body.pos.y, body.pos.z);
      g.rotation.y = yaw;
      Player.model.setWalk(t, Math.hypot(body.vel.x, body.vel.z));
    } else {
      cam.position.set(e.x, e.y, e.z);
    }

    // zaznaczenie bloku
    var hit = Player.aim(REACH);
    Player.selBox.visible = hit.hit;
    if (hit.hit) Player.selBox.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);

    // pnącze
    if (vine.visible) {
      vine.userData.t += dt;
      var p = Math.min(1, vine.userData.t / 0.25);
      var fade = vine.userData.t > 0.4;
      var ease = fade ? Math.max(0, 1 - (vine.userData.t - 0.4) / 0.15) : p;
      vine.scale.y = Math.max(0.001, vine.userData.len * ease);
      var a = vine.userData.from, bb = vine.userData.to;
      var mid = { x: a.x + (bb.x - a.x) * ease * 0.5, y: a.y + (bb.y - a.y) * ease * 0.5, z: a.z + (bb.z - a.z) * ease * 0.5 };
      vine.position.set(mid.x, mid.y, mid.z);
      if (vine.userData.t > 0.55) vine.visible = false;
    }

    // sadzonki
    for (var i = saplings.length - 1; i >= 0; i--) {
      var s = saplings[i];
      if (t - s.t < 5) continue;
      saplings.splice(i, 1);
      if (game.world.get(s.x, s.y, s.z) !== B.SAPLING) continue;
      game.world.set(s.x, s.y, s.z, B.AIR);
      game.rebuildChunks(game.world.growTree(s.x, s.y, s.z, true).concat([game.world.chunkKey(s.x >> 4, s.z >> 4)]));
      BC.HUD.message('Wyrosło drzewo!', 1200);
    }
  };

  Player.breakBlock = function (reach) {
    var hit = Player.aim(reach);
    if (!hit.hit) return false;
    if (!Info[hit.id].breakable) { BC.HUD.message('Tego nie da się zniszczyć', 1000); return false; }
    Player.game.setBlock(hit.x, hit.y, hit.z, B.AIR);
    // kwiatek/sadzonka nad zniszczonym blokiem spada
    var above = Player.game.world.get(hit.x, hit.y + 1, hit.z);
    if (Info[above].cross) Player.game.setBlock(hit.x, hit.y + 1, hit.z, B.AIR);
    return true;
  };
  Player.placeBlock = function () {
    var hit = Player.aim(REACH);
    if (!hit.hit) return;
    var id = BC.HUD.selected();
    var x = hit.x + hit.nx, y = hit.y + hit.ny, z = hit.z + hit.nz;
    var world = Player.game.world;
    if (Info[hit.id].cross) { x = hit.x; y = hit.y; z = hit.z; }
    var target = world.get(x, y, z);
    if (target !== B.AIR && target !== B.WATER && !Info[target].cross) return;
    if (Info[id].cross) {
      var below = world.get(x, y - 1, z);
      if (below !== B.GRASS && below !== B.DIRT) { BC.HUD.message('To rośnie tylko na trawie lub ziemi', 1000); return; }
    }
    if (Info[id].solid && BC.Physics.collides(world, Player.body.pos, Player.body.w, Player.body.h + 0) === false) {
      // nie stawiaj bloku w sobie
      var b = Player.body, hw = b.w / 2;
      if (x + 1 > b.pos.x - hw && x < b.pos.x + hw && y + 1 > b.pos.y && y < b.pos.y + b.h && z + 1 > b.pos.z - hw && z < b.pos.z + hw) return;
    }
    Player.game.setBlock(x, y, z, id);
    if (id === B.SAPLING) saplings.push({ x: x, y: y, z: z, t: performance.now() / 1000 });
  };

  Player.vineWhip = function () {
    var hit = Player.aim(VINE_REACH);
    var e = eye(), d = lookDir();
    var from = { x: e.x + d.x * 0.3 - Math.cos(yaw) * 0.35, y: e.y - 0.5, z: e.z + d.z * 0.3 + Math.sin(yaw) * 0.35 };
    var to = hit.hit ? { x: hit.x + 0.5, y: hit.y + 0.5, z: hit.z + 0.5 } : { x: e.x + d.x * VINE_REACH, y: e.y + d.y * VINE_REACH, z: e.z + d.z * VINE_REACH };
    var dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z;
    var len = Math.hypot(dx, dy, dz);
    vine.visible = true; vine.userData = { t: 0, len: len, from: from, to: to };
    vine.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx / len, dy / len, dz / len));
    vine.position.set(from.x, from.y, from.z); vine.scale.y = 0.001;
    if (hit.hit) setTimeout(function () { Player.breakBlock(VINE_REACH); }, 200);
  };

  Player.plantSeed = function () {
    var hit = Player.aim(REACH);
    var world = Player.game.world;
    if (!hit.hit || hit.ny !== 1) { BC.HUD.message('Celuj w trawę lub ziemię', 1000); return; }
    if (hit.id !== B.GRASS && hit.id !== B.DIRT) { BC.HUD.message('Nasionko rośnie tylko na trawie lub ziemi', 1000); return; }
    var x = hit.x, y = hit.y + 1, z = hit.z;
    if (world.get(x, y, z) !== B.AIR) return;
    Player.game.setBlock(x, y, z, B.SAPLING);
    saplings.push({ x: x, y: y, z: z, t: performance.now() / 1000 });
    BC.HUD.message('Posadzone! Zaraz wyrośnie…', 1200);
  };

  Player.savePos = function () {
    try { localStorage.setItem('bc.player', JSON.stringify({ pos: Player.body.pos, yaw: yaw, pitch: pitch })); } catch (e) {}
  };
  Player.loadPos = function () {
    try { var s = localStorage.getItem('bc.player'); return s ? JSON.parse(s) : null; } catch (e) { return null; }
  };
  Player.setPaused = function (p) { Player.paused = p; };
  Player.setLook = function (y, p) { yaw = y; pitch = Math.max(-1.5, Math.min(1.5, p)); };
  Player.getLook = function () { return { yaw: yaw, pitch: pitch }; };
  BC.Player = Player;
})(window.BC);
