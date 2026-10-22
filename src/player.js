// Gracz: sterowanie (klawiatura + dotyk), kamera FPP/TPP, edycja bloków, moce bohaterów, przetrwanie.
(function (BC) {
  var B = BC.Blocks, Info = BC.BlockInfo, S = BC.Survival;
  var Player = {};
  var keys = {}, yaw = 0, pitch = 0, tpp = false, lastSpace = 0, spaceHeld = false, lastW = 0, sprint = false;
  var REACH = 6, VINE_REACH = 8, FLAME_REACH = 8, WATER_REACH = 8, BOLT_REACH = 12, HIT_REACH = 4;
  var saplings = [];
  var effects = [];
  var wasOnGround = true, wasInWater = false, fallStart = null, jumpsLeft = 0, cooldown = {};
  var hurtEl;

  Player.virtual = { mx: 0, mz: 0, jump: false, down: false, sprint: false };

  Player.init = function (game, spawn, opts) {
    opts = opts || {};
    var world = game.world;
    Player.game = game;
    Player.spawn = spawn;
    Player.mode = opts.mode || 'creative';
    Player.stats = opts.stats || S.makeStats();
    Player.inv = opts.inv || S.makeInv();
    Player.body = BC.Physics.makeBody(spawn.x, spawn.y, spawn.z);
    var saved = Player.loadPos();
    if (saved && saved.seed === world.seed) { Player.body.pos = saved.pos; yaw = saved.yaw; pitch = saved.pitch; }
    Player.body.flying = false;
    hurtEl = document.getElementById('hurt');

    Player.selBox = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1.002, 1.002, 1.002)),
      new THREE.LineBasicMaterial({ color: 0x111111 }));
    Player.selBox.visible = false;
    game.scene.add(Player.selBox);

    Player.light = new THREE.PointLight(0xffb060, 0, 10, 2);
    game.scene.add(Player.light);

    Player.setHero(opts.hero || 'bulbasaur');

    var canvas = game.renderer.domElement;
    Player.canvas = canvas;
    var dragging = false, dragMoved = 0;
    canvas.addEventListener('click', function () { if (!Player.paused && !BC.isTouch) Player.lockPointer(); });
    document.addEventListener('mousemove', function (e) {
      if (!Player.active() || BC.isTouch) return;
      if (Player.fallback && !dragging) return;
      Player.addLook(-e.movementX * 0.0025, -e.movementY * 0.0025);
      dragMoved += Math.abs(e.movementX) + Math.abs(e.movementY);
    });
    canvas.addEventListener('mousedown', function (e) {
      if (!Player.active() || BC.isTouch) return;
      if (Player.fallback) { dragging = true; dragMoved = 0; return; }
      if (e.button === 0) Player.primaryAction();
      if (e.button === 2) Player.placeBlock();
    });
    canvas.addEventListener('mouseup', function (e) {
      if (!Player.fallback || !Player.active() || BC.isTouch) return;
      dragging = false;
      if (dragMoved < 6) { if (e.button === 0) Player.primaryAction(); if (e.button === 2) Player.placeBlock(); }
    });
    document.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    document.addEventListener('wheel', function (e) {
      if (!Player.active()) return;
      BC.HUD.setSlot((BC.HUD.slot + (e.deltaY > 0 ? 1 : 8)) % 9);
    });
    document.addEventListener('keydown', function (e) {
      if (e.code === 'Escape' && (Player.fallback || BC.isTouch) && Player.active()) { Player.openMenu(); return; }
      if (!Player.active()) return;
      if (e.repeat) { keys[e.code] = true; return; }
      keys[e.code] = true;
      var now = performance.now();
      if (e.code >= 'Digit1' && e.code <= 'Digit9') BC.HUD.setSlot(Number(e.code[5]) - 1);
      if (e.code === 'Tab') { e.preventDefault(); BC.HUD.setPage(BC.HUD.page + 1); }
      if (e.code === 'F5') { e.preventDefault(); Player.toggleView(); }
      if (e.code === 'KeyQ') Player.useQ();
      if (e.code === 'KeyE') Player.useE();
      if (e.code === 'KeyR') Player.eat();
      if (e.code === 'KeyH') Player.goHome();
      if (e.code === 'KeyM') { BC.Audio.setMusic(!BC.Audio.musicOn); BC.Boot.syncAudioUi(); BC.HUD.message(BC.Audio.musicOn ? 'Muzyka włączona' : 'Muzyka wyłączona', 1000); }
      if (e.code === 'KeyW') { if (now - lastW < 280) sprint = true; lastW = now; }
      if (e.code === 'Space' && !spaceHeld) {
        spaceHeld = true;
        if (now - lastSpace < 300) { Player.toggleFly(); lastSpace = 0; }
        else { lastSpace = now; if (keys.ShiftLeft || keys.ShiftRight) { if (!Player.useSuper()) Player.pressJump(); } else Player.pressJump(); }
      }
    });
    document.addEventListener('keyup', function (e) {
      keys[e.code] = false;
      if (e.code === 'Space') spaceHeld = false;
      if (e.code === 'KeyW') sprint = false;
    });
    document.addEventListener('pointerlockchange', function () {
      if (document.pointerLockElement !== canvas && !Player.fallback && !BC.isTouch) { keys = {}; if (BC.Boot) BC.Boot.showMenu(); }
    });
    window.addEventListener('blur', function () { keys = {}; sprint = false; });
    if (BC.isTouch) { Player.fallback = true; BC.Touch.init(Player); }
    BC.Monsters.onAttack = function (m, dmg) { Player.hurt(dmg, m.body.pos); };
    BC.Monsters.onHurt = function (dmg, from) { Player.hurt(dmg, from); };
    BC.Monsters.onPickup = function (item) {
      var name = Info[item].name;
      if (Player.mode !== 'survival') { BC.HUD.message(name + '!', 800); return; }
      S.invAdd(Player.inv, item, 1); BC.HUD.setInv(Player.inv, Player.mode);
      BC.HUD.message('+1 ' + name, 900);
    };
    game.updaters.push(Player.update);
    BC.HUD.setInv(Player.inv, Player.mode);
  };

  // ---------- bohater ----------
  Player.setHero = function (id) {
    var h = BC.Heroes.get(id);
    Player.hero = h;
    if (Player.model) Player.game.scene.remove(Player.model.group);
    Player.model = h.model();
    Player.model.group.visible = tpp;
    Player.game.scene.add(Player.model.group);
    Player.light.color.setHex(h.id === 'charmander' ? 0xffa040 : 0xffffff);
    jumpsLeft = 0;
    BC.HUD.setHero(h);
    if (BC.Touch) BC.Touch.refresh();
  };

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
  Player.toggleView = function () {
    tpp = !tpp; Player.model.group.visible = tpp;
    BC.HUD.message(tpp ? 'Widok z boku' : 'Widok z oczu', 1000);
  };
  Player.toggleFly = function () {
    if (!Player.body.flying && !S.canFly(Player.stats, Player.mode)) { BC.HUD.message('Za głodny, żeby latać', 1200); return; }
    Player.body.flying = !Player.body.flying;
    Player.body.vel.y = 0;
    BC.Audio.sfx(Player.body.flying ? 'fly' : 'unfly');
    BC.HUD.message(Player.body.flying ? 'Latanie włączone' : 'Latanie wyłączone', 1000);
    if (BC.Touch) BC.Touch.refresh();
  };
  Player.openMenu = function () { Player.paused = true; keys = {}; BC.Boot.showMenu(); };
  Player.addLook = function (dy, dp) { yaw += dy; pitch = Math.max(-1.5, Math.min(1.5, pitch + dp)); };

  function forward() { return { x: -Math.sin(yaw), z: -Math.cos(yaw) }; }
  function eye() { var p = Player.body.pos; return { x: p.x, y: p.y + 1.5, z: p.z }; }
  function lookDir() {
    var cp = Math.cos(pitch);
    return { x: -Math.sin(yaw) * cp, y: Math.sin(pitch), z: -Math.cos(yaw) * cp };
  }
  Player.aim = function (dist, stopAtWater) { return BC.Raycast.cast(Player.game.world, eye(), lookDir(), dist, stopAtWater); };
  Player.eye = eye; Player.lookDir = lookDir;

  // ---------- skoki ----------
  Player.pressJump = function () {
    var body = Player.body;
    if (body.flying) return;
    if (body.onGround) { body.vel.y = 9; jumpsLeft = Player.hero.doubleJump ? 1 : 0; BC.Audio.sfx('jump'); if (Player.mode === 'survival') S.jumpCost(Player.stats); }
    else if (body.inWater) body.vel.y = 4;
    else if (jumpsLeft > 0) { jumpsLeft--; body.vel.y = 9.5; BC.Audio.sfx('highjump'); spawnPuff(body.pos); }
  };
  Player.useSuper = function () {
    if (Player.hero.id !== 'bulbasaur') return false;
    var body = Player.body;
    if (!body.onGround || body.flying) return false;
    body.vel.y = 16; BC.Audio.sfx('highjump');
    if (Player.mode === 'survival') S.jumpCost(Player.stats);
    return true;
  };

  // ---------- pętla ----------
  Player.update = function (dt, t) {
    var body = Player.body, game = Player.game, world = game.world, h = Player.hero;
    if (BC.Touch) BC.Touch.update();
    var v = Player.virtual;
    var f = forward(), r = { x: -f.z, z: f.x };
    var mx = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0) + v.mx;
    var mz = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0) + v.mz;
    if (!keys.KeyW) sprint = false;
    var len = Math.max(1, Math.hypot(mx, mz));
    var running = sprint || v.sprint;
    var speed = body.flying ? 12 : (body.inWater ? h.waterSpeed : h.speed);
    if (running && !body.flying) speed *= 1.6;
    var vx = (f.x * mz + r.x * mx) / len * speed, vz = (f.z * mz + r.z * mx) / len * speed;
    var k = body.flying ? 0.15 : 0.35;
    body.vel.x += (vx - body.vel.x) * k;
    body.vel.z += (vz - body.vel.z) * k;
    var shift = keys.ShiftLeft || keys.ShiftRight || v.down;
    var jumpHeld = keys.Space || v.jump;
    if (body.flying) {
      var vy = (jumpHeld ? 1 : 0) - (shift ? 1 : 0);
      body.vel.y += (vy * 9 - body.vel.y) * 0.2;
    } else if (jumpHeld && body.inWater) body.vel.y = Math.max(body.vel.y, 4);
    else if (jumpHeld && body.onGround && !spaceHeld) { body.vel.y = 9; BC.Audio.sfx('jump'); }
    if (!world.hasChunk(Math.floor(body.pos.x) >> 4, Math.floor(body.pos.z) >> 4)) { world.ensureChunk(Math.floor(body.pos.x) >> 4, Math.floor(body.pos.z) >> 4); }
    BC.Physics.step(world, body, dt);
    if (body.flying && body.onGround) { body.flying = false; if (BC.Touch) BC.Touch.refresh(); }
    if (body.onGround && !wasOnGround && body.vel.y === 0) BC.Audio.sfx('land');
    if (body.inWater && !wasInWater) BC.Audio.sfx('splash');

    // upadek
    if (!body.onGround && !body.flying && !body.inWater) { if (fallStart === null || body.pos.y > fallStart) fallStart = body.pos.y; }
    if (body.onGround && fallStart !== null) {
      var dmg = S.fallDamage(fallStart - body.pos.y);
      fallStart = null;
      if (dmg > 0 && Player.mode === 'survival') Player.hurt(dmg);
    }
    if (body.inWater || body.flying) fallStart = null;
    if (body.onGround) jumpsLeft = h.doubleJump ? 1 : 0;
    wasOnGround = body.onGround; wasInWater = body.inWater;

    // kamera
    var cam = game.camera;
    cam.rotation.order = 'YXZ';
    cam.rotation.set(pitch, yaw, 0);
    var e = eye();
    var g = Player.model.group;
    g.position.set(body.pos.x, body.pos.y, body.pos.z);
    g.rotation.y = yaw;
    if (tpp) {
      var d = lookDir();
      cam.position.set(e.x - d.x * 4.5, e.y - d.y * 4.5 + 0.8, e.z - d.z * 4.5);
      cam.lookAt(e.x, e.y + 0.3, e.z);
      Player.model.setWalk(t, Math.hypot(body.vel.x, body.vel.z));
    } else {
      cam.position.set(e.x, e.y, e.z);
    }
    var underwater = world.get(Math.floor(e.x), Math.floor(e.y), Math.floor(e.z)) === B.WATER;
    BC.HUD.setWater(underwater);

    // światło bohatera (Charmander) w nocy
    Player.light.position.set(body.pos.x, body.pos.y + 1.2, body.pos.z);
    Player.light.intensity = h.nightLight ? 30 * game.darkness : 0;

    // przetrwanie
    if (Player.mode === 'survival') {
      var ev = S.tickStats(Player.stats, dt, { underwater: underwater, sprinting: running && Math.hypot(body.vel.x, body.vel.z) > 1, flying: body.flying, noDrown: h.noDrown });
      if (body.flying && !S.canFly(Player.stats, Player.mode)) {
        body.flying = false; fallStart = body.pos.y;
        BC.HUD.message('Za głodny, żeby latać', 1500); BC.Audio.sfx('unfly');
        if (BC.Touch) BC.Touch.refresh();
      }
      if (ev.indexOf('drown') >= 0 || ev.indexOf('starve') >= 0) { flash(); BC.Audio.sfx('hurt'); if (Player.stats.hp <= 0) Player.die(); }
      if (ev.indexOf('starve') >= 0) BC.HUD.message('Jesteś głodny! Zjedz jabłko (R)', 1500);
    }
    if ((Player.hudTimer = (Player.hudTimer || 0) + dt) > 0.25) {
      Player.hudTimer = 0;
      BC.HUD.setCoords(body.pos.x, body.pos.y, body.pos.z, world.biomeAt(Math.floor(body.pos.x), Math.floor(body.pos.z)));
      if (Player.mode === 'survival') BC.HUD.setStats(Player.stats, underwater && !h.noDrown);
    }
    if (hurtEl) hurtEl.style.opacity = Player.stats.hurtT > 0 ? Math.min(0.6, Player.stats.hurtT * 1.2) : 0;

    // zaznaczenie bloku
    var hit = Player.aim(REACH);
    Player.selBox.visible = hit.hit;
    if (hit.hit) Player.selBox.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);

    // efekty (pnącze, płomień, strumień, piorun)
    for (var i = effects.length - 1; i >= 0; i--) {
      var fx = effects[i];
      fx.t += dt;
      var p = Math.min(1, fx.t / fx.grow);
      var fade = fx.t > fx.hold;
      var ease = fade ? Math.max(0, 1 - (fx.t - fx.hold) / fx.fadeDur) : p;
      if (fx.kind === 'beam') {
        fx.mesh.scale.y = Math.max(0.001, fx.len * ease);
        fx.mesh.position.set(fx.from.x + (fx.to.x - fx.from.x) * ease * 0.5, fx.from.y + (fx.to.y - fx.from.y) * ease * 0.5, fx.from.z + (fx.to.z - fx.from.z) * ease * 0.5);
        if (fx.flicker) { var s = 1 + Math.sin(t * 40) * 0.3; fx.mesh.scale.x = s; fx.mesh.scale.z = s; }
      } else if (fx.kind === 'bolt') {
        fx.mesh.material.opacity = ease;
        fx.mesh.scale.x = fx.mesh.scale.z = 0.6 + Math.random() * 0.6;
      } else if (fx.kind === 'puff') {
        fx.mesh.scale.setScalar(0.3 + fx.t * 3);
        fx.mesh.material.opacity = Math.max(0, 0.6 - fx.t * 1.5);
      }
      if (fx.t > fx.hold + fx.fadeDur) { game.scene.remove(fx.mesh); fx.mesh.geometry.dispose(); fx.mesh.material.dispose(); effects.splice(i, 1); }
    }
    for (var c in cooldown) cooldown[c] = Math.max(0, cooldown[c] - dt);

    // sadzonki
    for (var si = saplings.length - 1; si >= 0; si--) {
      var sp = saplings[si];
      if (t - sp.t < 5) continue;
      saplings.splice(si, 1);
      if (world.get(sp.x, sp.y, sp.z) !== B.SAPLING) continue;
      game.rebuildChunks(world.growTree(sp.x, sp.y, sp.z));
      BC.Audio.sfx('grow');
      BC.HUD.message('Wyrosło drzewo!', 1200);
    }
  };

  // ---------- efekty ----------
  function beam(from, to, color, opts) {
    opts = opts || {};
    var dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z, len = Math.hypot(dx, dy, dz) || 0.01;
    var mesh = new THREE.Mesh(new THREE.CylinderGeometry(opts.r || 0.06, opts.r || 0.06, 1, 6), new THREE.MeshLambertMaterial({ color: color, emissive: opts.emissive || 0x000000, transparent: !!opts.alpha, opacity: opts.alpha || 1 }));
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx / len, dy / len, dz / len));
    mesh.position.set(from.x, from.y, from.z); mesh.scale.y = 0.001;
    Player.game.scene.add(mesh);
    effects.push({ kind: 'beam', mesh: mesh, t: 0, len: len, from: from, to: to, grow: opts.grow || 0.25, hold: opts.hold || 0.4, fadeDur: 0.15, flicker: !!opts.flicker });
  }
  function handPos() {
    var e = eye(), d = lookDir();
    return { x: e.x + d.x * 0.3 - Math.cos(yaw) * 0.35, y: e.y - 0.5, z: e.z + d.z * 0.3 + Math.sin(yaw) * 0.35 };
  }
  function bolt(p) {
    var mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.25, 40, 5), new THREE.MeshBasicMaterial({ color: 0xffffa0, transparent: true, opacity: 1 }));
    mesh.position.set(p.x, p.y + 20, p.z);
    Player.game.scene.add(mesh);
    effects.push({ kind: 'bolt', mesh: mesh, t: 0, grow: 0.05, hold: 0.2, fadeDur: 0.2 });
    Player.game.flash = 1;
  }
  function spawnPuff(p) {
    var mesh = new THREE.Mesh(new THREE.SphereGeometry(0.3, 6, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 }));
    mesh.position.set(p.x, p.y + 0.2, p.z);
    Player.game.scene.add(mesh);
    effects.push({ kind: 'puff', mesh: mesh, t: 0, grow: 0.1, hold: 0.3, fadeDur: 0.1 });
  }
  function flash() { if (Player.stats) Player.stats.hurtT = Math.max(Player.stats.hurtT, 0.5); }

  // ---------- akcje na blokach ----------
  Player.primaryAction = function () {
    var ah = BC.Monsters.aimAnimal(eye(), lookDir(), HIT_REACH), bh0 = Player.aim(REACH);
    if (ah && (!bh0.hit || ah.dist < bh0.dist)) { Player.pet(ah.c); return; }
    if (Player.mode === 'survival') {
      var mh = BC.Monsters.aim(eye(), lookDir(), HIT_REACH);
      var bh = Player.aim(REACH);
      if (mh && (!bh.hit || mh.dist < bh.dist)) { Player.attack(mh.m, 2); return; }
    }
    Player.breakBlock(REACH);
  };
  Player.tapAction = function () {
    var ah = BC.Monsters.aimAnimal(eye(), lookDir(), HIT_REACH);
    if (ah) { Player.pet(ah.c); return; }
    if (Player.mode !== 'survival') return;
    var mh = BC.Monsters.aim(eye(), lookDir(), HIT_REACH);
    if (mh) Player.attack(mh.m, 2);
  };
  Player.attack = function (m, dmg) {
    if (BC.Monsters.hit(m, dmg, Player.body.pos)) Player.onMonsterKilled(m);
  };
  Player.onMonsterKilled = function (m) {
    var name = BC.Creatures.TYPES[m.type].name;
    if (Player.mode === 'survival' && Math.random() < 0.5) { S.invAdd(Player.inv, B.APPLE, 1); BC.HUD.setInv(Player.inv, Player.mode); BC.HUD.message(name + ' pokonany! +1 jabłko', 1200); }
    else BC.HUD.message(name + ' pokonany!', 1000);
  };
  // Głaskanie zwierzątka: serduszka, idzie za graczem, czasem coś daje.
  Player.pet = function (c) {
    var item = BC.Monsters.pet(c), name = BC.Creatures.TYPES[c.type].name;
    if (item !== null && Player.mode === 'survival') {
      S.invAdd(Player.inv, item, 1); BC.HUD.setInv(Player.inv, Player.mode);
      BC.HUD.message(name + ' ❤ +1 ' + Info[item].name, 1300);
    } else BC.HUD.message(name + ' ❤', 900);
  };
  Player.breakBlock = function (reach, noDrop) {
    var hit = Player.aim(reach);
    if (!hit.hit) return false;
    if (!Info[hit.id].breakable) { BC.HUD.message('Tego nie da się zniszczyć', 1000); BC.Audio.sfx('nope'); return false; }
    Player.game.setBlock(hit.x, hit.y, hit.z, B.AIR);
    var above = Player.game.world.get(hit.x, hit.y + 1, hit.z);
    if (Info[above].cross) Player.game.setBlock(hit.x, hit.y + 1, hit.z, B.AIR);
    if (Player.mode === 'survival' && !noDrop) {
      var drop = S.dropFor(hit.id, Math.random);
      if (drop !== null) { S.invAdd(Player.inv, drop, 1); BC.HUD.setInv(Player.inv, Player.mode); if (drop === B.APPLE) BC.HUD.message('Jabłko!', 800); }
    }
    BC.Audio.sfx('break');
    return true;
  };
  Player.placeBlock = function () {
    var hit = Player.aim(REACH);
    if (!hit.hit) return;
    var id = BC.HUD.selected();
    if (!Info[id].placeable) return;
    var x = hit.x + hit.nx, y = hit.y + hit.ny, z = hit.z + hit.nz;
    var world = Player.game.world;
    if (Info[hit.id].cross) { x = hit.x; y = hit.y; z = hit.z; }
    var target = world.get(x, y, z);
    if (target !== B.AIR && target !== B.WATER && !Info[target].cross) return;
    if (Info[id].cross && id !== B.TORCH) {
      var below = world.get(x, y - 1, z);
      if (below !== B.GRASS && below !== B.DIRT && below !== B.SNOW) { BC.HUD.message('To rośnie tylko na trawie lub ziemi', 1000); BC.Audio.sfx('nope'); return; }
    }
    if (Info[id].solid) {
      var b = Player.body, hw = b.w / 2;
      if (x + 1 > b.pos.x - hw && x < b.pos.x + hw && y + 1 > b.pos.y && y < b.pos.y + b.h && z + 1 > b.pos.z - hw && z < b.pos.z + hw) return;
    }
    if (Player.mode === 'survival') {
      if (!S.invTake(Player.inv, id, 1)) { BC.HUD.message('Nie masz: ' + Info[id].name, 1000); BC.Audio.sfx('nope'); return; }
      BC.HUD.setInv(Player.inv, Player.mode);
    }
    Player.game.setBlock(x, y, z, id);
    BC.Audio.sfx(id === B.SAPLING ? 'plant' : 'place');
    if (id === B.SAPLING) saplings.push({ x: x, y: y, z: z, t: performance.now() / 1000 });
  };

  // ---------- moce ----------
  Player.useQ = function () {
    var id = Player.hero.id;
    if (id === 'bulbasaur') return Player.vineWhip();
    if (id === 'charmander') return Player.flame();
    if (id === 'squirtle') return Player.waterJet();
    if (id === 'pikachu') return Player.thunder();
  };
  Player.useE = function () {
    var id = Player.hero.id;
    if (id === 'bulbasaur') return Player.plantSeed();
    if (id === 'charmander') return Player.campfire();
    if (id === 'squirtle') return Player.bubble();
    if (id === 'pikachu') return Player.dash();
  };

  Player.vineWhip = function () {
    var hit = Player.aim(VINE_REACH);
    var e = eye(), d = lookDir();
    var to = hit.hit ? { x: hit.x + 0.5, y: hit.y + 0.5, z: hit.z + 0.5 } : { x: e.x + d.x * VINE_REACH, y: e.y + d.y * VINE_REACH, z: e.z + d.z * VINE_REACH };
    beam(handPos(), to, 0x3fae3c);
    BC.Audio.sfx('vine');
    BC.Monsters.alongRay(e, d, VINE_REACH, 0.8).forEach(function (m) { Player.attack(m, 3); });
    if (hit.hit) setTimeout(function () { Player.breakBlock(VINE_REACH); }, 200);
  };
  Player.plantSeed = function () {
    var hit = Player.aim(REACH);
    var world = Player.game.world;
    if (!hit.hit || hit.ny !== 1) { BC.HUD.message('Celuj w trawę lub ziemię', 1000); BC.Audio.sfx('nope'); return; }
    if (hit.id !== B.GRASS && hit.id !== B.DIRT && hit.id !== B.SNOW) { BC.HUD.message('Nasionko rośnie tylko na trawie, ziemi lub śniegu', 1200); BC.Audio.sfx('nope'); return; }
    var x = hit.x, y = hit.y + 1, z = hit.z;
    if (world.get(x, y, z) !== B.AIR) return;
    Player.game.setBlock(x, y, z, B.SAPLING);
    saplings.push({ x: x, y: y, z: z, t: performance.now() / 1000 });
    BC.Audio.sfx('plant');
    BC.HUD.message('Posadzone! Zaraz wyrośnie…', 1200);
  };

  Player.flame = function () {
    if (cooldown.flame > 0) return; cooldown.flame = 0.35;
    var hit = Player.aim(FLAME_REACH);
    var e = eye(), d = lookDir();
    var to = hit.hit ? { x: hit.x + 0.5, y: hit.y + 0.5, z: hit.z + 0.5 } : { x: e.x + d.x * FLAME_REACH, y: e.y + d.y * FLAME_REACH, z: e.z + d.z * FLAME_REACH };
    beam(handPos(), to, 0xff8a20, { r: 0.18, emissive: 0xff4000, flicker: true, grow: 0.12, hold: 0.35 });
    BC.Audio.sfx('flame');
    BC.Monsters.alongRay(e, d, FLAME_REACH, 1.0).forEach(function (m) { Player.attack(m, 4); });
    if (hit.hit && Info[hit.id].burnable) {
      setTimeout(function () {
        var h2 = Player.aim(FLAME_REACH);
        if (h2.hit && Info[h2.id].burnable) { Player.game.setBlock(h2.x, h2.y, h2.z, B.AIR); BC.Audio.sfx('break'); BC.HUD.message('Spalone!', 700); }
      }, 150);
    } else if (hit.hit) BC.HUD.message('Płomień pali tylko drewno, liście i wełnę', 1000);
  };
  Player.campfire = function () {
    var hit = Player.aim(REACH);
    var world = Player.game.world;
    if (!hit.hit) { BC.HUD.message('Celuj w blok', 800); return; }
    var x = hit.x + hit.nx, y = hit.y + hit.ny, z = hit.z + hit.nz;
    if (Info[hit.id].cross) { x = hit.x; y = hit.y; z = hit.z; }
    if (world.get(x, y, z) !== B.AIR && !Info[world.get(x, y, z)].cross) return;
    Player.game.setBlock(x, y, z, B.TORCH);
    BC.Audio.sfx('place');
    BC.HUD.message('Ognisko rozpalone', 900);
  };

  Player.waterJet = function () {
    if (cooldown.water > 0) return; cooldown.water = 0.3;
    var hit = Player.aim(WATER_REACH);
    var e = eye(), d = lookDir();
    var to = hit.hit ? { x: hit.x + 0.5 + hit.nx * 0.5, y: hit.y + 0.5 + hit.ny * 0.5, z: hit.z + 0.5 + hit.nz * 0.5 } : { x: e.x + d.x * WATER_REACH, y: e.y + d.y * WATER_REACH, z: e.z + d.z * WATER_REACH };
    beam(handPos(), to, 0x4fa0ff, { r: 0.12, emissive: 0x1040a0, grow: 0.12, hold: 0.3 });
    BC.Audio.sfx('water');
    BC.Monsters.alongRay(e, d, WATER_REACH, 1.0).forEach(function (m) { Player.attack(m, 2); });
    if (hit.hit) {
      var x = hit.x + hit.nx, y = hit.y + hit.ny, z = hit.z + hit.nz;
      var world = Player.game.world;
      var cur = world.get(x, y, z);
      if (cur === B.AIR || Info[cur].cross) Player.game.setBlock(x, y, z, B.WATER);
    }
  };
  Player.bubble = function () {
    var hit = Player.aim(WATER_REACH, true);
    if (!hit.hit || hit.id !== B.WATER) { BC.HUD.message('Celuj w wodę', 800); BC.Audio.sfx('nope'); return; }
    var world = Player.game.world;
    // zasysa trafioną wodę i sąsiednie bloki wody (3x3x1)
    for (var dx = -1; dx <= 1; dx++) for (var dz = -1; dz <= 1; dz++)
      if (world.get(hit.x + dx, hit.y, hit.z + dz) === B.WATER) Player.game.setBlock(hit.x + dx, hit.y, hit.z + dz, B.AIR);
    BC.Audio.sfx('bubble');
    BC.HUD.message('Bańka zassała wodę', 800);
  };

  Player.thunder = function () {
    if (cooldown.bolt > 0) { BC.HUD.message('Piorun się ładuje…', 600); return; } cooldown.bolt = 1.2;
    var hit = Player.aim(BOLT_REACH);
    var e = eye(), d = lookDir();
    var p = hit.hit ? { x: hit.x + 0.5, y: hit.y + 0.5, z: hit.z + 0.5 } : { x: e.x + d.x * BOLT_REACH, y: e.y + d.y * BOLT_REACH, z: e.z + d.z * BOLT_REACH };
    bolt(p);
    BC.Audio.sfx('thunder');
    BC.Monsters.inRadius(p, 2.5).forEach(function (m) { Player.attack(m, 4); });
    if (hit.hit) setTimeout(function () { Player.breakBlock(BOLT_REACH); }, 120);
  };
  Player.dash = function () {
    if (cooldown.dash > 0) return; cooldown.dash = 1.2;
    var f = forward(), b = Player.body;
    b.vel.x += f.x * 16; b.vel.z += f.z * 16; b.vel.y = Math.max(b.vel.y, 2.5);
    spawnPuff(b.pos);
    BC.Audio.sfx('dash');
  };

  // ---------- przetrwanie ----------
  Player.eat = function () {
    if (Player.mode !== 'survival') { BC.HUD.message('Jedzenie jest tylko w przetrwaniu', 900); return; }
    if (Player.stats.food >= S.MAX_FOOD) { BC.HUD.message('Nie jesteś głodny', 800); return; }
    var ate = S.eat(Player.stats, Player.inv);
    if (!ate) { BC.HUD.message('Nie masz jedzenia. Szukaj jabłek w liściach!', 1200); BC.Audio.sfx('nope'); return; }
    BC.Audio.sfx('eat');
    BC.HUD.setInv(Player.inv, Player.mode);
    BC.HUD.setStats(Player.stats, false);
    BC.HUD.message('Mniam! (' + Info[ate].name + ')', 900);
  };
  Player.hurt = function (n, from) {
    if (Player.mode !== 'survival' || Player.paused) return;
    var dead = S.damage(Player.stats, n);
    BC.Audio.sfx('hurt');
    if (from) {
      var b = Player.body, dx = b.pos.x - from.x, dz = b.pos.z - from.z, l = Math.hypot(dx, dz) || 1;
      b.vel.x += dx / l * 7; b.vel.z += dz / l * 7; b.vel.y = Math.max(b.vel.y, 4);
    }
    BC.HUD.setStats(Player.stats, false);
    if (dead) Player.die();
  };
  Player.die = function () {
    Player.paused = true; keys = {};
    BC.Audio.sfx('faint');
    BC.Boot.showDeath();
  };
  Player.respawn = function () {
    S.respawn(Player.stats);
    BC.Monsters.clear();
    Player.goHome();
    Player.paused = false;
    BC.HUD.setStats(Player.stats, false);
  };
  Player.craft = function (idx) {
    if (!S.craft(Player.inv, idx)) { BC.Audio.sfx('nope'); return false; }
    BC.Audio.sfx('craft');
    BC.HUD.setInv(Player.inv, Player.mode);
    return true;
  };

  Player.goHome = function () {
    var s = Player.spawn, world = Player.game.world;
    Player.game.preload(s.x, s.z, 1);
    var y = world.surfaceY(Math.floor(s.x), Math.floor(s.z)) + 1.01;
    Player.body.pos = { x: s.x, y: y, z: s.z };
    Player.body.vel = { x: 0, y: 0, z: 0 };
    fallStart = null;
    BC.Audio.sfx('home');
    BC.HUD.message('Jesteś w domu', 1200);
  };

  Player.savePos = function () {
    try { localStorage.setItem('bc.player', JSON.stringify({ seed: Player.game.world.seed, pos: Player.body.pos, yaw: yaw, pitch: pitch })); } catch (e) {}
  };
  Player.loadPos = function () {
    try { var s = localStorage.getItem('bc.player'); return s ? JSON.parse(s) : null; } catch (e) { return null; }
  };
  Player.getState = function () {
    return { mode: Player.mode, hero: Player.hero.id, hp: Player.stats.hp, food: Player.stats.food, inv: Player.inv };
  };
  Player.setPaused = function (p) { Player.paused = p; if (p) keys = {}; };
  Player.setLook = function (y, p) { yaw = y; pitch = Math.max(-1.5, Math.min(1.5, p)); };
  Player.getLook = function () { return { yaw: yaw, pitch: pitch }; };
  BC.Player = Player;
})(window.BC);
