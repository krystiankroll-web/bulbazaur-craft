// Potwory nocy („Cieniaki”): spawn, modele, AI (logika w survival.js), obrażenia, płonięcie o świcie.
(function (BC) {
  var S = BC.Survival, B = BC.Blocks;
  var M = { list: [], max: 6, spawnTimer: 0, onAttack: null };
  var purple = 0x3a2650, dark = 0x1e1230, eye = 0xff3030;

  function makeMesh() {
    var g = new THREE.Group();
    var mat = new THREE.MeshLambertMaterial({ color: purple });
    var matD = new THREE.MeshLambertMaterial({ color: dark });
    function bx(w, h, d, m, x, y, z, parent) { var o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); (parent || g).add(o); return o; }
    bx(0.5, 0.7, 0.3, mat, 0, 0.95, 0);              // tułów
    var head = bx(0.5, 0.5, 0.5, mat, 0, 1.55, 0);  // głowa
    var e1 = bx(0.1, 0.12, 0.05, new THREE.MeshBasicMaterial({ color: eye }), -0.13, 0.05, -0.26, head);
    var e2 = bx(0.1, 0.12, 0.05, new THREE.MeshBasicMaterial({ color: eye }), 0.13, 0.05, -0.26, head);
    bx(0.5, 0.08, 0.5, matD, 0, 0.29, 0, head);
    var arms = [], legs = [];
    [[-0.35], [0.35]].forEach(function (a) {
      var p = new THREE.Group(); p.position.set(a[0], 1.25, 0); g.add(p);
      bx(0.2, 0.6, 0.2, matD, 0, -0.3, 0, p); arms.push(p);
    });
    [[-0.13], [0.13]].forEach(function (a) {
      var p = new THREE.Group(); p.position.set(a[0], 0.6, 0); g.add(p);
      bx(0.22, 0.6, 0.22, matD, 0, -0.3, 0, p); legs.push(p);
    });
    return { group: g, arms: arms, legs: legs, mats: [mat, matD], eyes: [e1, e2] };
  }

  M.init = function (game) {
    M.game = game; M.list = [];
    M.max = BC.isTouch ? 4 : 6;
  };
  M.clear = function () {
    M.list.forEach(function (m) { M.game.scene.remove(m.mesh.group); });
    M.list = [];
  };
  function surfaceSpawn(world, px, pz) {
    var ang = Math.random() * Math.PI * 2, r = 16 + Math.random() * 16;
    var x = Math.floor(px + Math.cos(ang) * r), z = Math.floor(pz + Math.sin(ang) * r);
    if (!world.hasChunk(x >> 4, z >> 4)) return null;
    var y = world.surfaceY(x, z);
    var top = world.get(x, y, z);
    if (top === B.WATER || top === B.AIR) return null;
    if (world.get(x, y + 1, z) !== B.AIR || world.get(x, y + 2, z) !== B.AIR) return null;
    // nie przy pochodni
    for (var dx = -4; dx <= 4; dx++) for (var dz = -4; dz <= 4; dz++) for (var dy = -1; dy <= 3; dy++)
      if (world.get(x + dx, y + dy, z + dz) === B.TORCH) return null;
    return { x: x + 0.5, y: y + 1.01, z: z + 0.5 };
  }
  M.spawnAt = function (p) {
    var m = S.makeMonster(p.x, p.y, p.z);
    m.mesh = makeMesh();
    M.game.scene.add(m.mesh.group);
    M.list.push(m);
    return m;
  };

  M.update = function (dt, t, player, light) {
    var world = M.game.world, pp = player.body.pos;
    var night = light < 0.2;
    M.spawnTimer -= dt;
    if (night && M.list.length < M.max && M.spawnTimer <= 0) {
      M.spawnTimer = 3;
      var p = surfaceSpawn(world, pp.x, pp.z);
      if (p) { M.spawnAt(p); if (M.list.length === 1) BC.HUD.message('Nadchodzą Cieniaki…', 1500); }
    }
    for (var i = M.list.length - 1; i >= 0; i--) {
      var m = M.list[i], b = m.body;
      var far = Math.hypot(b.pos.x - pp.x, b.pos.z - pp.z);
      if (far > 56 || b.pos.y < -5) { M.remove(i); continue; }
      if (!night && light > 0.45 && !m.burning) m.burning = 0.001;
      if (m.burning) {
        m.burning += dt;
        var s = Math.max(0.05, 1 - m.burning / 2.5);
        m.mesh.group.scale.set(s, s, s);
        m.mesh.mats[0].color.setHex(0x8a3a10); m.mesh.mats[1].color.setHex(0xff8020);
        if (m.burning > 2.5) { M.remove(i); continue; }
      }
      if (m.dead) {
        m.deadT = (m.deadT || 0) + dt;
        var sc = Math.max(0.01, 1 - m.deadT * 4);
        m.mesh.group.scale.set(sc * 1.4, sc, sc * 1.4);
        if (m.deadT > 0.25) { M.remove(i); continue; }
        continue;
      }
      if (!world.hasChunk(Math.floor(b.pos.x) >> 4, Math.floor(b.pos.z) >> 4)) continue;
      var res = S.monsterStep(m, world, { x: pp.x, y: pp.y, z: pp.z }, dt);
      if (res.attack && M.onAttack) M.onAttack(m);
      // model
      var g = m.mesh.group;
      g.position.set(b.pos.x, b.pos.y, b.pos.z);
      var dx = pp.x - b.pos.x, dz = pp.z - b.pos.z;
      g.rotation.y = Math.atan2(-dx, -dz) + Math.PI;
      var sp = Math.hypot(b.vel.x, b.vel.z);
      var amp = Math.min(0.7, sp * 0.2);
      m.mesh.legs[0].rotation.x = Math.sin(t * 8 + m.phase) * amp;
      m.mesh.legs[1].rotation.x = -Math.sin(t * 8 + m.phase) * amp;
      m.mesh.arms[0].rotation.x = -Math.PI / 2 + Math.sin(t * 3 + m.phase) * 0.15;
      m.mesh.arms[1].rotation.x = -Math.PI / 2 - Math.sin(t * 3 + m.phase) * 0.15;
      if (!m.burning) {
        var hurt = m.hurtT > 0;
        m.mesh.mats[0].color.setHex(hurt ? 0xff6060 : purple);
        m.mesh.mats[1].color.setHex(hurt ? 0xd04040 : dark);
      }
    }
  };
  M.remove = function (i) {
    var m = M.list[i];
    M.game.scene.remove(m.mesh.group);
    M.list.splice(i, 1);
  };
  // Najbliższy potwór na promieniu (do ataku stuknięciem / LPM).
  M.aim = function (origin, dir, maxDist) {
    var best = null, bd = Infinity;
    M.list.forEach(function (m) {
      if (m.dead) return;
      var d = S.rayHitsMonster(m, origin, dir, maxDist);
      if (d !== null && d < bd) { bd = d; best = m; }
    });
    return best ? { m: best, dist: bd } : null;
  };
  M.alongRay = function (origin, dir, maxDist, radius) {
    var out = [];
    M.list.forEach(function (m) {
      if (m.dead) return;
      var b = m.body, cx = b.pos.x - origin.x, cy = b.pos.y + b.h / 2 - origin.y, cz = b.pos.z - origin.z;
      var tt = cx * dir.x + cy * dir.y + cz * dir.z;
      if (tt < 0 || tt > maxDist) return;
      var px = origin.x + dir.x * tt - b.pos.x, py = origin.y + dir.y * tt - (b.pos.y + b.h / 2), pz = origin.z + dir.z * tt - b.pos.z;
      if (Math.hypot(px, py, pz) < radius + 0.5) out.push(m);
    });
    return out;
  };
  M.inRadius = function (p, r) {
    return M.list.filter(function (m) { return !m.dead && Math.hypot(m.body.pos.x - p.x, m.body.pos.y - p.y, m.body.pos.z - p.z) < r; });
  };
  // Zadaje obrażenia; zwraca true, gdy potwór pokonany (i wtedy losuje jabłko do plecaka).
  M.hit = function (m, dmg, from) {
    var knock = null;
    if (from) {
      var dx = m.body.pos.x - from.x, dz = m.body.pos.z - from.z, l = Math.hypot(dx, dz) || 1;
      knock = { x: dx / l * 6, z: dz / l * 6 };
    }
    var dead = S.monsterHit(m, dmg, knock);
    BC.Audio.sfx(dead ? 'mdie' : 'mhit');
    if (dead) { m.deadT = 0; }
    return dead;
  };
  BC.Monsters = M;
})(window.BC);
