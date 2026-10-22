// Stworzenia (czysta logika, testowalna w Node): typy, ruch, AI potworów i zwierzątek.
// AI dostaje listę graczy (ctx.players = [{x,y,z}], pozycja stóp), żeby działało też we dwoje.
var BC = (typeof window !== "undefined") ? (window.BC = window.BC || {}) : (global.BC = global.BC || {});
if (typeof require !== 'undefined' && !BC.Physics) { require('./physics.js'); }
(function (BC) {
  var B = BC.Blocks, P = BC.Physics;
  var C = { nextId: 1 };

  C.TYPES = {
    cieniak: { hostile: true, name: 'Cieniak', hp: 6, w: 0.6, h: 1.7, speed: 3.2, dmg: 2, sight: 24, reach: 1.6, weight: 40 },
    skoczek: { hostile: true, name: 'Skoczek', hp: 8, w: 0.9, h: 0.9, speed: 4.5, dmg: 2, sight: 20, reach: 1.4, weight: 25, hop: 1.0, split: 'skoczek_maly' },
    skoczek_maly: { hostile: true, name: 'Mały Skoczek', hp: 2, w: 0.5, h: 0.5, speed: 5, dmg: 1, sight: 20, reach: 1.1, weight: 0, hop: 0.7 },
    kolczak: { hostile: true, name: 'Kolczak', hp: 6, w: 0.7, h: 1.2, speed: 2.6, dmg: 2, sight: 24, reach: 0, weight: 20, shootEvery: 2.5, keepMin: 8, keepMax: 14 },
    wybuchacz: { hostile: true, name: 'Wybuchacz', hp: 5, w: 0.6, h: 1.5, speed: 3.0, dmg: 7, sight: 24, reach: 0, weight: 15, fuse: 1.5, fuseStart: 2, fuseCancel: 4, blast: 2.5 }
  };

  C.make = function (type, x, y, z, rand) {
    rand = rand || Math.random;
    var T = C.TYPES[type];
    var c = { id: C.nextId++, type: type, hostile: T.hostile, body: P.makeBody(x, y, z), hp: T.hp, dead: false, hurtT: 0,
      attackCd: 1.2, phase: rand() * 6.28, yaw: rand() * 6.28, burning: 0 };
    c.body.w = T.w; c.body.h = T.h;
    if (T.hop) c.hopCd = T.hop;
    if (T.shootEvery) c.shootCd = T.shootEvery;
    if (T.fuse) c.fuseT = null;
    return c;
  };

  // Najbliższy gracz (w poziomie). Zwraca { i, p, dist, dist3 } albo null.
  C.nearest = function (c, players) {
    var b = c.body, best = -1, bd = Infinity;
    for (var i = 0; i < players.length; i++) {
      var d = Math.hypot(players[i].x - b.pos.x, players[i].z - b.pos.z);
      if (d < bd) { bd = d; best = i; }
    }
    if (best < 0) return null;
    var p = players[best];
    return { i: best, p: p, dist: bd, dist3: Math.hypot(p.x - b.pos.x, p.y - b.pos.y, p.z - b.pos.z) };
  };

  // Ruch po ziemi w stronę (wx, wz); skok, gdy coś blokuje.
  function walk(c, world, wx, wz, dt) {
    var b = c.body, k = b.inWater ? 0.1 : 0.25;
    b.vel.x += (wx - b.vel.x) * k;
    b.vel.z += (wz - b.vel.z) * k;
    if (b.inWater && b.vel.y < 2) b.vel.y = 3;
    P.step(world, b, dt);
    var blocked = (wx !== 0 && b.vel.x === 0) || (wz !== 0 && b.vel.z === 0);
    if (blocked && b.onGround) b.vel.y = 9;
  }

  function hostileStep(c, T, world, ctx, dt, ev) {
    var b = c.body, n = C.nearest(c, ctx.players);
    var seen = !!n && n.dist < T.sight && !c.burning;
    var dx = 0, dz = 0;
    if (seen && n.dist > 0) { dx = (n.p.x - b.pos.x) / n.dist; dz = (n.p.z - b.pos.z) / n.dist; c.yaw = Math.atan2(dx, dz); }
    c.attackCd -= dt;
    if (T.hop) {
      // Skoczek porusza się tylko skokami
      c.hopCd -= dt;
      if (b.onGround) { b.vel.x = 0; b.vel.z = 0; }
      if (seen && b.onGround && c.hopCd <= 0 && n.dist > 0.6) {
        c.hopCd = T.hop;
        b.vel.y = 8; b.vel.x = dx * T.speed * 1.4; b.vel.z = dz * T.speed * 1.4;
        ev.push({ type: 'hop' });
      }
      if (b.inWater && b.vel.y < 2) b.vel.y = 3;
      P.step(world, b, dt);
    } else if (T.shootEvery) {
      // Kolczak trzyma dystans i strzela
      var dir = !seen ? 0 : (n.dist < T.keepMin ? -1 : (n.dist > T.keepMax ? 1 : 0));
      walk(c, world, dx * T.speed * dir, dz * T.speed * dir, dt);
      c.shootCd -= dt;
      if (seen && c.shootCd <= 0) {
        c.shootCd = T.shootEvery;
        var from = { x: b.pos.x, y: b.pos.y + T.h * 0.7, z: b.pos.z };
        var tx = n.p.x - from.x, ty = n.p.y + 1 - from.y, tz = n.p.z - from.z, l = Math.hypot(tx, ty, tz) || 1;
        ev.push({ type: 'shoot', from: from, dir: { x: tx / l, y: ty / l, z: tz / l } });
      }
    } else if (T.fuse) {
      // Wybuchacz: syczy przy graczu, wybucha po T.fuse s, przerywa gdy gracz ucieknie
      if (c.fuseT === null && seen && n.dist3 <= T.fuseStart) { c.fuseT = 0; ev.push({ type: 'hiss' }); }
      if (c.fuseT !== null && (!n || n.dist3 > T.fuseCancel)) c.fuseT = null;
      if (c.fuseT !== null) {
        c.fuseT += dt;
        walk(c, world, 0, 0, dt);
        if (c.fuseT >= T.fuse) {
          c.dead = true; c.exploded = true;
          ev.push({ type: 'explode', x: b.pos.x, y: b.pos.y + 0.8, z: b.pos.z, r: T.blast });
        }
        return;
      }
      var go2 = seen && n.dist > 0.9;
      walk(c, world, go2 ? dx * T.speed : 0, go2 ? dz * T.speed : 0, dt);
    } else {
      var go = seen && n.dist > 0.9;
      walk(c, world, go ? dx * T.speed : 0, go ? dz * T.speed : 0, dt);
    }
    if (T.reach > 0 && n && n.dist3 < T.reach && c.attackCd <= 0 && !c.burning) {
      c.attackCd = 1.0;
      ev.push({ type: 'attack', target: n.i, dmg: T.dmg });
    }
  }

  // Krok AI i fizyki. Zwraca listę zdarzeń.
  C.step = function (c, world, ctx, dt) {
    var T = C.TYPES[c.type], ev = [];
    c.hurtT = Math.max(0, c.hurtT - dt);
    if (c.dead) return ev;
    hostileStep(c, T, world, ctx, dt, ev);
    return ev;
  };

  // Zadaje obrażenia. Zwraca true, gdy stworzenie pokonane.
  C.hit = function (c, dmg, knock) {
    if (!c.hostile || c.dead) return false;
    c.hp -= dmg; c.hurtT = 0.3;
    if (knock) { c.body.vel.x += knock.x; c.body.vel.z += knock.z; c.body.vel.y = Math.max(c.body.vel.y, 5); }
    if (c.hp <= 0) { c.dead = true; if (c.fuseT !== undefined) c.fuseT = null; }
    return c.dead;
  };

  // Co powstaje po pokonaniu (Skoczek rozpada się na dwa małe).
  C.children = function (c) {
    var T = C.TYPES[c.type];
    if (!T.split || c.exploded) return [];
    var p = c.body.pos;
    return [C.make(T.split, p.x - 0.3, p.y + 0.1, p.z), C.make(T.split, p.x + 0.3, p.y + 0.1, p.z)];
  };

  // ---------- kolce Kolczaka ----------
  C.SPIKE_SPEED = 14; C.SPIKE_LIFE = 2;
  C.makeSpike = function (from, dir) { return { pos: { x: from.x, y: from.y, z: from.z }, dir: dir, t: 0 }; };
  // Przesuwa kolec. Zwraca { done } albo { done: true, hit: nr gracza }.
  C.stepSpike = function (s, world, players, dt) {
    s.t += dt;
    if (s.t > C.SPIKE_LIFE) return { done: true };
    var dist = C.SPIKE_SPEED * dt, n = Math.max(1, Math.ceil(dist / 0.25)), d = dist / n;
    for (var k = 0; k < n; k++) {
      s.pos.x += s.dir.x * d; s.pos.y += s.dir.y * d; s.pos.z += s.dir.z * d;
      if (BC.BlockInfo[world.get(Math.floor(s.pos.x), Math.floor(s.pos.y), Math.floor(s.pos.z))].solid) return { done: true };
      for (var i = 0; i < players.length; i++) {
        var p = players[i];
        if (Math.hypot(s.pos.x - p.x, s.pos.y - (p.y + 0.9), s.pos.z - p.z) < 0.6) return { done: true, hit: i };
      }
    }
    return { done: false };
  };

  // ---------- wybuch ----------
  // Bloki do usunięcia w kuli o promieniu r (bez powietrza, wody i bloków niezniszczalnych).
  C.blastBlocks = function (world, x, y, z, r) {
    var out = [], R = Math.ceil(r);
    for (var bx = Math.floor(x) - R; bx <= Math.floor(x) + R; bx++)
      for (var by = Math.floor(y) - R; by <= Math.floor(y) + R; by++)
        for (var bz = Math.floor(z) - R; bz <= Math.floor(z) + R; bz++) {
          if (Math.hypot(bx + 0.5 - x, by + 0.5 - y, bz + 0.5 - z) > r) continue;
          var id = world.get(bx, by, bz);
          if (id === B.AIR || id === B.WATER || !BC.BlockInfo[id].breakable) continue;
          out.push([bx, by, bz]);
        }
    return out;
  };
  C.blastDamage = function (dist) { return Math.max(0, Math.round(7 - 2 * dist)); };

  // Przecięcie promienia z AABB stworzenia (slab). Zwraca odległość lub null.
  C.rayHit = function (c, origin, dir, maxDist) {
    var b = c.body, hw = b.w / 2;
    var min = [b.pos.x - hw, b.pos.y, b.pos.z - hw], max = [b.pos.x + hw, b.pos.y + b.h, b.pos.z + hw];
    var o = [origin.x, origin.y, origin.z], d = [dir.x, dir.y, dir.z];
    var tmin = 0, tmax = maxDist;
    for (var i = 0; i < 3; i++) {
      if (Math.abs(d[i]) < 1e-9) { if (o[i] < min[i] || o[i] > max[i]) return null; continue; }
      var t1 = (min[i] - o[i]) / d[i], t2 = (max[i] - o[i]) / d[i];
      if (t1 > t2) { var tmp = t1; t1 = t2; t2 = tmp; }
      tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
      if (tmin > tmax) return null;
    }
    return tmin;
  };

  // Losuje rodzaj nocnego potwora wg wag.
  C.pickHostile = function (rand) {
    var total = 0, k;
    for (k in C.TYPES) if (C.TYPES[k].hostile) total += C.TYPES[k].weight;
    var r = rand() * total;
    for (k in C.TYPES) {
      if (!C.TYPES[k].hostile || !C.TYPES[k].weight) continue;
      r -= C.TYPES[k].weight;
      if (r < 0) return k;
    }
    return 'cieniak';
  };

  BC.Creatures = C;
})(BC);
if (typeof module !== 'undefined') module.exports = BC;
