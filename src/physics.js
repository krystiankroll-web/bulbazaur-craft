// Ruch ciała AABB względem bloków świata.
var BC = (typeof window !== "undefined") ? (window.BC = window.BC || {}) : (global.BC = global.BC || {});
if (typeof require !== 'undefined' && !BC.World) { require('./world.js'); }
(function (BC) {
  var B = BC.Blocks, Info = BC.BlockInfo;
  var GRAVITY = -28, TERMINAL = -50, EPS = 1e-4;

  function solidAt(world, x, y, z) {
    if (y < 0) return true;
    var id = world.get(x, y, z);
    return Info[id].solid;
  }
  // Czy AABB (pos = środek stóp) koliduje z jakimś stałym blokiem
  function collides(world, pos, w, h) {
    var hw = w / 2;
    var x0 = Math.floor(pos.x - hw), x1 = Math.floor(pos.x + hw - EPS);
    var y0 = Math.floor(pos.y), y1 = Math.floor(pos.y + h - EPS);
    var z0 = Math.floor(pos.z - hw), z1 = Math.floor(pos.z + hw - EPS);
    for (var x = x0; x <= x1; x++) for (var y = y0; y <= y1; y++) for (var z = z0; z <= z1; z++)
      if (solidAt(world, x, y, z)) return true;
    return false;
  }
  function moveAxis(world, body, axis, delta) {
    if (delta === 0) return false;
    var pos = body.pos;
    var hw = body.w / 2;
    var steps = Math.max(1, Math.ceil(Math.abs(delta) / 0.25));
    var d = delta / steps;
    for (var s = 0; s < steps; s++) {
      pos[axis] += d;
      if (collides(world, pos, body.w, body.h)) {
        // cofnij do krawędzi bloku
        if (axis === 'y') {
          pos.y = d < 0 ? Math.floor(pos.y) + 1 : Math.floor(pos.y + body.h) - body.h - EPS;
        } else {
          pos[axis] = d < 0 ? Math.floor(pos[axis] - hw) + 1 + hw + EPS : Math.floor(pos[axis] + hw) - hw - EPS;
        }
        body.vel[axis] = 0;
        return true;
      }
    }
    return false;
  }
  function inWater(world, body) {
    var id = world.get(Math.floor(body.pos.x), Math.floor(body.pos.y + 0.4), Math.floor(body.pos.z));
    return id === B.WATER;
  }

  function step(world, body, dt) {
    body.inWater = inWater(world, body);
    if (!body.flying) {
      var g = body.inWater ? GRAVITY * 0.3 : GRAVITY;
      body.vel.y += g * dt;
      if (body.inWater) body.vel.y *= 0.9;
      if (body.vel.y < TERMINAL) body.vel.y = TERMINAL;
    }
    moveAxis(world, body, 'x', body.vel.x * dt);
    moveAxis(world, body, 'z', body.vel.z * dt);
    var hitY = moveAxis(world, body, 'y', body.vel.y * dt);
    body.onGround = hitY && body.vel.y === 0 && collides(world, { x: body.pos.x, y: body.pos.y - 0.05, z: body.pos.z }, body.w, body.h);
    if (!hitY) body.onGround = false;
    // ściany świata
    var lim = 0.3;
    if (body.pos.x < lim) body.pos.x = lim;
    if (body.pos.z < lim) body.pos.z = lim;
    if (body.pos.x > world.size - lim) body.pos.x = world.size - lim;
    if (body.pos.z > world.size - lim) body.pos.z = world.size - lim;
    if (body.pos.y > world.height + 10) body.pos.y = world.height + 10;
    return body;
  }
  function makeBody(x, y, z) {
    return { pos: { x: x, y: y, z: z }, vel: { x: 0, y: 0, z: 0 }, w: 0.6, h: 1.6, onGround: false, flying: false, inWater: false };
  }
  BC.Physics = { step: step, collides: collides, makeBody: makeBody, GRAVITY: GRAVITY };
})(BC);
if (typeof module !== 'undefined') module.exports = BC;
