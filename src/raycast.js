// Promień celowania (DDA) po siatce bloków.
var BC = (typeof window !== "undefined") ? (window.BC = window.BC || {}) : (global.BC = global.BC || {});
if (typeof require !== 'undefined' && !BC.World) { require('./world.js'); }
(function (BC) {
  var B = BC.Blocks;
  function cast(world, origin, dir, maxDist) {
    var len = Math.hypot(dir.x, dir.y, dir.z) || 1;
    var dx = dir.x / len, dy = dir.y / len, dz = dir.z / len;
    var x = Math.floor(origin.x), y = Math.floor(origin.y), z = Math.floor(origin.z);
    var stepX = dx > 0 ? 1 : -1, stepY = dy > 0 ? 1 : -1, stepZ = dz > 0 ? 1 : -1;
    var tDX = dx !== 0 ? Math.abs(1 / dx) : Infinity;
    var tDY = dy !== 0 ? Math.abs(1 / dy) : Infinity;
    var tDZ = dz !== 0 ? Math.abs(1 / dz) : Infinity;
    var tMX = dx !== 0 ? ((dx > 0 ? x + 1 - origin.x : origin.x - x) * tDX) : Infinity;
    var tMY = dy !== 0 ? ((dy > 0 ? y + 1 - origin.y : origin.y - y) * tDY) : Infinity;
    var tMZ = dz !== 0 ? ((dz > 0 ? z + 1 - origin.z : origin.z - z) * tDZ) : Infinity;
    var nx = 0, ny = 0, nz = 0, t = 0;
    for (var i = 0; i < 512; i++) {
      var id = world.get(x, y, z);
      if (id !== B.AIR && id !== B.WATER && i > 0) {
        return { hit: true, x: x, y: y, z: z, nx: nx, ny: ny, nz: nz, dist: t, id: id };
      }
      if (tMX < tMY && tMX < tMZ) { t = tMX; x += stepX; tMX += tDX; nx = -stepX; ny = 0; nz = 0; }
      else if (tMY < tMZ) { t = tMY; y += stepY; tMY += tDY; nx = 0; ny = -stepY; nz = 0; }
      else { t = tMZ; z += stepZ; tMZ += tDZ; nx = 0; ny = 0; nz = -stepZ; }
      if (t > maxDist) break;
    }
    return { hit: false, dist: maxDist };
  }
  BC.Raycast = { cast: cast };
})(BC);
if (typeof module !== 'undefined') module.exports = BC;
