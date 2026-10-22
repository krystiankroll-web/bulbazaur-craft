// Menedżer stworzeń: zwierzątka (dzień, oba tryby) i potwory (noc, przetrwanie), modele, kolce, wybuchy,
// przedmioty na ziemi i serduszka. Logika stworzeń jest w creatures.js.
// We dwoje: gospodarz symuluje (gracz nr 1 = kolega, zdarzenia dla niego idą przez onRemote),
// u gościa M.puppet = true i stworzenia tylko podążają za stanem z sieci (applySnapshot).
(function (BC) {
  var C = BC.Creatures, B = BC.Blocks, Models = BC.CreatureModels, P = BC.NetProto;
  var M = { list: [], spikes: [], drops: [], fx: [], maxHostile: 6, maxAnimals: 10, spawnTimer: 0, animalTimer: 0,
    onAttack: null, onHurt: null, onPickup: null, onRemote: null, puppet: false, dropId: 1, snap: null };
  var VOICE = { krowa: 'moo', owca: 'baa', kurczak: 'cluck', swinka: 'oink' };
  var DROP_LIFE = 300;

  M.init = function (game) {
    M.game = game; M.list = []; M.spikes = []; M.drops = []; M.fx = [];
    M.maxHostile = BC.isTouch ? 4 : 6;
    M.maxAnimals = BC.isTouch ? 6 : 10;
  };
  // Usuwa potwory i kolce (po omdleniu). Zwierzątka zostają.
  M.clear = function () {
    for (var i = M.list.length - 1; i >= 0; i--) if (M.list[i].hostile) M.remove(i);
    M.spikes.forEach(function (s) { M.game.scene.remove(s.mesh); });
    M.spikes = [];
  };
  function count(hostile) { var n = 0; M.list.forEach(function (c) { if (c.hostile === hostile && !c.dead) n++; }); return n; }

  // ---------- spawn ----------
  function torchNear(world, x, y, z) {
    for (var dx = -4; dx <= 4; dx++) for (var dz = -4; dz <= 4; dz++) for (var dy = -1; dy <= 3; dy++)
      if (world.get(x + dx, y + dy, z + dz) === B.TORCH) return true;
    return false;
  }
  function freeAbove(world, x, y, z) {
    return !BC.BlockInfo[world.get(x, y + 1, z)].solid && !BC.BlockInfo[world.get(x, y + 2, z)].solid && world.get(x, y + 1, z) !== B.WATER;
  }
  function ringPoint(px, pz, r0, r1) {
    var ang = Math.random() * Math.PI * 2, r = r0 + Math.random() * (r1 - r0);
    return { x: Math.floor(px + Math.cos(ang) * r), z: Math.floor(pz + Math.sin(ang) * r) };
  }
  function hostileSpawn(world, px, pz) {
    var q = ringPoint(px, pz, 16, 32);
    if (!world.hasChunk(q.x >> 4, q.z >> 4)) return null;
    var y = world.surfaceY(q.x, q.z), top = world.get(q.x, y, q.z);
    if (top === B.WATER || top === B.AIR || !freeAbove(world, q.x, y, q.z) || torchNear(world, q.x, y, q.z)) return null;
    return { x: q.x + 0.5, y: y + 1.01, z: q.z + 0.5 };
  }
  function grassAt(world, x, z) {
    if (!world.hasChunk(x >> 4, z >> 4)) return null;
    var y = world.surfaceY(x, z);
    if (world.get(x, y, z) !== B.GRASS || !freeAbove(world, x, y, z)) return null;
    return { x: x + 0.5, y: y + 1.01, z: z + 0.5 };
  }
  function spawnHerd(world, px, pz) {
    var q = ringPoint(px, pz, 24, 40), first = grassAt(world, q.x, q.z);
    if (!first) return;
    var type = C.ANIMALS[Math.floor(Math.random() * C.ANIMALS.length)];
    var n = 2 + Math.floor(Math.random() * 3);
    for (var i = 0; i < n && count(false) < M.maxAnimals; i++) {
      var p = i === 0 ? first : grassAt(world, q.x + Math.floor(Math.random() * 5) - 2, q.z + Math.floor(Math.random() * 5) - 2);
      if (p) M.spawnAt(p, type);
    }
  }
  M.spawnAt = function (p, type) {
    var c = C.make(type || 'cieniak', p.x, p.y, p.z);
    return M.add(c);
  };
  M.add = function (c) {
    c.model = Models.make(c.type);
    c.voiceT = 5 + Math.random() * 15;
    M.game.scene.add(c.model.group);
    M.list.push(c);
    return c;
  };
  M.remove = function (i) {
    M.game.scene.remove(M.list[i].model.group);
    M.list.splice(i, 1);
  };

  // ---------- efekty ----------
  function fxMesh(geo, color, opacity) {
    var m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: opacity === undefined ? 1 : opacity }));
    M.game.scene.add(m);
    return m;
  }
  M.hearts = function (c) {
    var p = c.body.pos;
    for (var i = 0; i < 3; i++) {
      var m = fxMesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), 0xff3a5a);
      m.position.set(p.x + (i - 1) * 0.3, p.y + c.body.h + 0.2, p.z);
      M.fx.push({ kind: 'heart', mesh: m, t: -i * 0.12, life: 0.9 });
    }
  };
  function boom(x, y, z, r) {
    var m = fxMesh(new THREE.SphereGeometry(1, 12, 10), 0xffd080, 0.8);
    m.position.set(x, y, z);
    M.fx.push({ kind: 'boom', mesh: m, t: 0, life: 0.45, r: r });
  }
  function dropItem(item, x, y, z) {
    var atlas = M.game.atlas, tex = BC.BlockInfo[item].tex.side;
    var cv = document.createElement('canvas'); cv.width = cv.height = atlas.tile;
    cv.getContext('2d').drawImage(atlas.canvas, tex * atlas.tile, 0, atlas.tile, atlas.tile, 0, 0, atlas.tile, atlas.tile);
    var t = new THREE.CanvasTexture(cv); t.magFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace;
    var s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t }));
    s.scale.set(0.45, 0.45, 0.45);
    M.game.scene.add(s);
    var it = { id: M.dropId++, item: item, x: x, y: y, z: z, t: 0, mesh: s };
    M.drops.push(it);
    return it;
  }

  // ---------- pętla ----------
  // players: tablica obiektów z .body (pierwszy = gracz na tym urządzeniu).
  M.update = function (dt, t, players, light, mode) {
    if (M.puppet) { puppetUpdate(dt, t); updateFx(dt, t); return; }
    var game = M.game, world = game.world;
    var ps = players.map(function (p) { var b = p.body.pos; return { x: b.x, y: b.y, z: b.z }; });
    var around = ps[Math.floor(Math.random() * ps.length)], night = light < 0.2;   // spawn wokół losowego gracza

    if (mode === 'survival') {
      M.spawnTimer -= dt;
      if (night && count(true) < M.maxHostile && M.spawnTimer <= 0) {
        M.spawnTimer = 3;
        var hp = hostileSpawn(world, around.x, around.z);
        if (hp) { M.spawnAt(hp, C.pickHostile(Math.random)); if (count(true) === 1) BC.HUD.message('Nadchodzą potwory…', 1500); }
      }
    }
    M.animalTimer -= dt;
    if (light > 0.45 && count(false) < M.maxAnimals && M.animalTimer <= 0) { M.animalTimer = 4; spawnHerd(world, around.x, around.z); }

    for (var i = M.list.length - 1; i >= 0; i--) {
      var c = M.list[i], b = c.body;
      var far = Infinity;
      ps.forEach(function (p) { far = Math.min(far, Math.hypot(b.pos.x - p.x, b.pos.z - p.z)); });
      if (far > (c.hostile ? 56 : 64) || b.pos.y < -5) { M.remove(i); continue; }
      if (c.exploded) { M.remove(i); continue; }
      if (c.dead) {
        c.deadT = (c.deadT || 0) + dt;
        var sc = Math.max(0.01, 1 - c.deadT * 4) * c.model.scale;
        c.model.group.scale.set(sc * 1.4, sc, sc * 1.4);
        if (c.deadT > 0.25) { M.remove(i); C.children(c).forEach(M.add); }
        continue;
      }
      if (c.hostile && light > 0.45 && !c.burning) c.burning = 0.001;
      if (c.burning) {
        c.burning += dt;
        if (c.burning > 2.5) { M.remove(i); continue; }
      }
      if (!world.hasChunk(Math.floor(b.pos.x) >> 4, Math.floor(b.pos.z) >> 4)) continue;
      C.step(c, world, { players: ps }, dt).forEach(function (e) { handle(c, e, ps); });
      if (c.exploded) continue;
      Models.animate(c, c.model, t);
      if (c.burning) c.model.group.scale.setScalar(Math.max(0.05, 1 - c.burning / 2.5) * c.model.scale);
      if (!c.hostile) {
        c.voiceT -= dt;
        if (c.voiceT <= 0) { c.voiceT = 10 + Math.random() * 15; if (far < 12) BC.Audio.sfx(VOICE[c.type]); }
      }
    }

    // kolce
    for (var k = M.spikes.length - 1; k >= 0; k--) {
      var s = M.spikes[k], r = C.stepSpike(s, world, ps, dt);
      s.mesh.position.set(s.pos.x, s.pos.y, s.pos.z);
      if (r.done) {
        game.scene.remove(s.mesh); M.spikes.splice(k, 1);
        if (r.hit !== undefined) hurtPlayer(r.hit, C.TYPES.kolczak.dmg, { x: s.pos.x - s.dir.x, y: s.pos.y, z: s.pos.z - s.dir.z });
      }
    }
    // przedmioty na ziemi: zbiera ten, kto podejdzie
    for (var d = M.drops.length - 1; d >= 0; d--) {
      var it = M.drops[d], who = -1;
      it.t += dt;
      for (var pi = 0; pi < ps.length && who < 0; pi++) if (Math.hypot(it.x - ps[pi].x, it.y - ps[pi].y, it.z - ps[pi].z) < 1.5) who = pi;
      if (who >= 0 || it.t > DROP_LIFE) {
        game.scene.remove(it.mesh); M.drops.splice(d, 1);
        if (who === 0) { BC.Audio.sfx('pop'); if (M.onPickup) M.onPickup(it.item); }
        else if (who > 0) remote('give', { item: it.item, why: 'pickup', name: BC.BlockInfo[it.item].name });
      }
    }
    updateFx(dt, t);
  };

  function remote(kind, data) { if (M.onRemote) { data.t = kind; M.onRemote(data); } }
  function hurtPlayer(i, dmg, from) {
    if (i === 0) { if (M.onHurt) M.onHurt(dmg, from); }
    else remote('hurt', { dmg: dmg, from: { x: from.x, y: from.y, z: from.z } });
  }

  function updateFx(dt, t) {
    var game = M.game;
    for (var d = 0; d < M.drops.length; d++) {
      var it = M.drops[d];
      it.mesh.position.set(it.x, it.y + 0.25 + Math.sin(t * 3 + it.id) * 0.08, it.z);
    }
    for (var f = M.fx.length - 1; f >= 0; f--) {
      var fx = M.fx[f];
      fx.t += dt;
      if (fx.t < 0) continue;
      var u = fx.t / fx.life;
      if (fx.kind === 'heart') { fx.mesh.position.y += dt * 1.2; fx.mesh.material.opacity = 1 - u; }
      else if (fx.kind === 'boom') { fx.mesh.scale.setScalar(0.3 + fx.r * 1.3 * u); fx.mesh.material.opacity = 0.8 * (1 - u); }
      if (fx.t > fx.life) { game.scene.remove(fx.mesh); fx.mesh.geometry.dispose(); fx.mesh.material.dispose(); M.fx.splice(f, 1); }
    }
  }

  function handle(c, e, ps) {
    var game = M.game, near = Math.hypot(c.body.pos.x - ps[0].x, c.body.pos.z - ps[0].z) < 16;
    if (e.type === 'attack') { if (e.target === 0) { if (M.onAttack) M.onAttack(c, e.dmg); } else hurtPlayer(e.target, e.dmg, c.body.pos); }
    else if (e.type === 'shoot') {
      var s = C.makeSpike(e.from, e.dir);
      s.mesh = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.45), new THREE.MeshLambertMaterial({ color: 0xf0e090 }));
      s.mesh.position.set(s.pos.x, s.pos.y, s.pos.z);
      s.mesh.lookAt(s.pos.x + e.dir.x, s.pos.y + e.dir.y, s.pos.z + e.dir.z);
      game.scene.add(s.mesh); M.spikes.push(s);
      if (near) BC.Audio.sfx('shoot');
    } else if (e.type === 'explode') {
      var keys = {};
      C.blastBlocks(game.world, e.x, e.y, e.z, e.r).forEach(function (q) { game.world.set(q[0], q[1], q[2], B.AIR).forEach(function (key) { keys[key] = 1; }); });
      game.rebuildChunks(Object.keys(keys));
      boom(e.x, e.y, e.z, e.r);
      BC.Audio.sfx('boom'); game.flash = Math.max(game.flash, 0.5);
      remote('fx', { kind: 'boom', x: e.x, y: e.y, z: e.z, r: e.r });
      ps.forEach(function (p, i) {
        var dmg = C.blastDamage(Math.hypot(p.x - e.x, p.y + 0.9 - e.y, p.z - e.z));
        if (dmg > 0) hurtPlayer(i, dmg, { x: e.x, y: e.y, z: e.z });
      });
    } else if (e.type === 'lay') { dropItem(e.item, e.x, e.y, e.z); if (near) BC.Audio.sfx('pop'); }
    else if (e.type === 'hop') { if (near) BC.Audio.sfx('hop'); }
    else if (e.type === 'hiss') BC.Audio.sfx('hiss');
  }

  // ---------- celowanie i interakcje ----------
  function aimAt(origin, dir, maxDist, hostile) {
    var best = null, bd = Infinity;
    M.list.forEach(function (c) {
      if (c.dead || c.hostile !== hostile) return;
      var d = C.rayHit(c, origin, dir, maxDist);
      if (d !== null && d < bd) { bd = d; best = c; }
    });
    return best ? { c: best, dist: bd } : null;
  }
  // Najbliższy potwór na promieniu (do ataku stuknięciem / LPM).
  M.aim = function (origin, dir, maxDist) { var r = aimAt(origin, dir, maxDist, true); return r ? { m: r.c, dist: r.dist } : null; };
  M.aimAnimal = function (origin, dir, maxDist) { return aimAt(origin, dir, maxDist, false); };
  M.alongRay = function (origin, dir, maxDist, radius) {
    var out = [];
    M.list.forEach(function (m) {
      if (m.dead || !m.hostile) return;
      var b = m.body, cx = b.pos.x - origin.x, cy = b.pos.y + b.h / 2 - origin.y, cz = b.pos.z - origin.z;
      var tt = cx * dir.x + cy * dir.y + cz * dir.z;
      if (tt < 0 || tt > maxDist) return;
      var px = origin.x + dir.x * tt - b.pos.x, py = origin.y + dir.y * tt - (b.pos.y + b.h / 2), pz = origin.z + dir.z * tt - b.pos.z;
      if (Math.hypot(px, py, pz) < radius + 0.5) out.push(m);
    });
    return out;
  };
  M.inRadius = function (p, r) {
    return M.list.filter(function (m) { return !m.dead && m.hostile && Math.hypot(m.body.pos.x - p.x, m.body.pos.y - p.y, m.body.pos.z - p.z) < r; });
  };
  // Zadaje obrażenia potworowi; zwraca true, gdy pokonany.
  M.hit = function (m, dmg, from) {
    var knock = null;
    if (from) {
      var dx = m.body.pos.x - from.x, dz = m.body.pos.z - from.z, l = Math.hypot(dx, dz) || 1;
      knock = { x: dx / l * 6, z: dz / l * 6 };
    }
    if (M.puppet) {   // u gościa decyduje gospodarz
      m.hurtT = 0.3; BC.Audio.sfx('mhit');
      remote('hit', { id: m.id, dmg: dmg, from: from ? { x: from.x, z: from.z } : null });
      return false;
    }
    var dead = C.hit(m, dmg, knock);
    BC.Audio.sfx(dead ? 'mdie' : 'mhit');
    if (dead) m.deadT = 0;
    return dead;
  };
  // Głaskanie zwierzątka przez gracza na tym urządzeniu. Zwraca id przedmiotu albo null.
  M.pet = function (c) {
    M.hearts(c);
    BC.Audio.sfx('pet'); BC.Audio.sfx(VOICE[c.type]);
    if (M.puppet) { remote('pet', { id: c.id }); return null; }   // przedmiot przyjdzie w `give`
    return C.pet(c, 0);
  };

  // ---------- gra we dwoje ----------
  function byId(id) { for (var i = 0; i < M.list.length; i++) if (M.list[i].id === id) return M.list[i]; return null; }
  // Gospodarz: stan do wysłania koledze.
  M.snapshot = function () {
    return {
      t: 'snap',
      c: P.packCreatures(M.list.filter(function (c) { return !c.exploded; })),
      s: M.spikes.map(function (s) { return [s.pos.x, s.pos.y, s.pos.z, s.dir.x, s.dir.y, s.dir.z]; }),
      d: M.drops.map(function (it) { return [it.id, it.item, it.x, it.y, it.z]; })
    };
  };
  // Gospodarz: kolega uderzył / pogłaskał.
  M.remoteHit = function (m) {
    var c = byId(m.id);
    if (!c || !c.hostile || c.dead) return;
    if (M.hit(c, m.dmg, m.from)) remote('killed', { type: c.type });
  };
  M.remotePet = function (m) {
    var c = byId(m.id);
    if (!c || c.hostile) return;
    M.hearts(c);
    var item = C.pet(c, 1);
    if (item !== null) remote('give', { item: item, why: 'pet', name: C.TYPES[c.type].name });
  };
  // Gość: efekt wybuchu u gospodarza.
  M.remoteFx = function (m) {
    if (m.kind !== 'boom') return;
    boom(m.x, m.y, m.z, m.r);
    BC.Audio.sfx('boom'); M.game.flash = Math.max(M.game.flash, 0.5);
  };
  // Gość: nowy stan od gospodarza.
  M.applySnapshot = function (m) {
    var seen = {};
    P.unpackCreatures(m.c).forEach(function (u) {
      seen[u.id] = 1;
      var c = byId(u.id);
      if (!c) { c = C.make(u.type, u.x, u.y, u.z); c.id = u.id; c.yaw = u.yaw; M.add(c); }
      c.tgt = u;
      c.hurtT = u.hurt ? 0.3 : 0;
      c.burning = u.burning ? (c.burning || 0.001) : 0;
      c.shornT = u.shorn ? 1 : 0;
      if (c.fuseT !== undefined) c.fuseT = u.fuseT;
      if (u.dead && !c.dead) { c.dead = true; c.deadT = 0; }
    });
    for (var i = M.list.length - 1; i >= 0; i--) if (!seen[M.list[i].id] && !M.list[i].dead) M.remove(i);
    // przedmioty
    var have = {};
    for (var d = M.drops.length - 1; d >= 0; d--) {
      var keep = m.d.some(function (a) { return a[0] === M.drops[d].id; });
      if (keep) have[M.drops[d].id] = 1; else { M.game.scene.remove(M.drops[d].mesh); M.drops.splice(d, 1); }
    }
    m.d.forEach(function (a) { if (!have[a[0]]) { var it = dropItem(a[1], a[2], a[3], a[4]); it.id = a[0]; } });
    // kolce (rysujemy tyle, ile przyszło)
    while (M.spikes.length > m.s.length) M.game.scene.remove(M.spikes.pop().mesh);
    m.s.forEach(function (a, k) {
      var s = M.spikes[k];
      if (!s) { s = { mesh: new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.45), new THREE.MeshLambertMaterial({ color: 0xf0e090 })) }; M.game.scene.add(s.mesh); M.spikes.push(s); }
      s.pos = { x: a[0], y: a[1], z: a[2] }; s.dir = { x: a[3], y: a[4], z: a[5] };
      s.mesh.position.set(a[0], a[1], a[2]);
      s.mesh.lookAt(a[0] + a[3], a[1] + a[4], a[2] + a[5]);
    });
  };
  function puppetUpdate(dt, t) {
    for (var i = M.list.length - 1; i >= 0; i--) {
      var c = M.list[i], b = c.body, u = c.tgt;
      if (c.dead) {
        c.deadT = (c.deadT || 0) + dt;
        var sc = Math.max(0.01, 1 - c.deadT * 4) * c.model.scale;
        c.model.group.scale.set(sc * 1.4, sc, sc * 1.4);
        if (c.deadT > 0.25) M.remove(i);
        continue;
      }
      if (!u) continue;
      var ox = b.pos.x, oy = b.pos.y, oz = b.pos.z;
      b.pos.x = P.approach(b.pos.x, u.x, dt, 12); b.pos.y = P.approach(b.pos.y, u.y, dt, 12); b.pos.z = P.approach(b.pos.z, u.z, dt, 12);
      var inv = 1 / Math.max(dt, 0.001);
      b.vel.x = (b.pos.x - ox) * inv; b.vel.y = (b.pos.y - oy) * inv; b.vel.z = (b.pos.z - oz) * inv;
      b.onGround = Math.abs(b.vel.y) < 0.5;
      c.yaw = P.approachAngle(c.yaw, u.yaw, dt, 12);
      c.hurtT = Math.max(0, c.hurtT - dt);
      Models.animate(c, c.model, t);
      if (c.burning) { c.burning += dt; c.model.group.scale.setScalar(Math.max(0.05, 1 - c.burning / 2.5) * c.model.scale); }
    }
  }
  BC.Monsters = M;
})(window.BC);
