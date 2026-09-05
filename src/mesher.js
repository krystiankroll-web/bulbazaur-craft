// Budowa geometrii chunku: tylko widoczne ściany, UV z atlasu, cieniowanie per ściana.
var BC = (typeof window !== "undefined") ? (window.BC = window.BC || {}) : (global.BC = global.BC || {});
if (typeof require !== 'undefined' && !BC.World) { require('./world.js'); }
(function (BC) {
  var B = BC.Blocks, Info = BC.BlockInfo;
  var CS = 16;

  // Sześć ścian: normalna, 4 narożniki (kolejność CCW patrząc od zewnątrz), cień, który kafel (top/side/bottom)
  var FACES = [
    { n: [1, 0, 0], v: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]], shade: 0.78, tex: 'side' },
    { n: [-1, 0, 0], v: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]], shade: 0.78, tex: 'side' },
    { n: [0, 1, 0], v: [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]], shade: 1.0, tex: 'top' },
    { n: [0, -1, 0], v: [[0, 0, 1], [0, 0, 0], [1, 0, 0], [1, 0, 1]], shade: 0.55, tex: 'bottom' },
    { n: [0, 0, 1], v: [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]], shade: 0.86, tex: 'side' },
    { n: [0, 0, -1], v: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]], shade: 0.86, tex: 'side' }
  ];
  // UV narożników: (0,0),(0,1),(1,1),(1,0) -> dla ścian bocznych: dolny-lewy, górny-lewy, górny-prawy, dolny-prawy
  var UVC = [[0, 0], [0, 1], [1, 1], [1, 0]];

  function Buf() { this.positions = []; this.normals = []; this.uvs = []; this.colors = []; this.indices = []; this.count = 0; }
  Buf.prototype.quad = function (pts, n, uv, shade) {
    var base = this.count;
    for (var i = 0; i < 4; i++) {
      this.positions.push(pts[i][0], pts[i][1], pts[i][2]);
      this.normals.push(n[0], n[1], n[2]);
      var c = UVC[i];
      this.uvs.push(c[0] ? uv[2] : uv[0], c[1] ? uv[3] : uv[1]);
      this.colors.push(shade, shade, shade);
    }
    this.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    this.count += 4;
  };

  function shouldDraw(id, nb) {
    if (nb === B.AIR) return true;
    var ni = Info[nb];
    if (!ni.transparent) return false;
    return nb !== id; // dwa takie same przezroczyste bloki nie rysują ściany między sobą
  }

  function buildChunk(world, cx, cz, atlas) {
    var opaque = new Buf(), transparent = new Buf();
    var x0 = cx * CS, z0 = cz * CS;
    for (var lx = 0; lx < CS; lx++) {
      for (var lz = 0; lz < CS; lz++) {
        for (var y = 0; y < world.height; y++) {
          var x = x0 + lx, z = z0 + lz;
          var id = world.get(x, y, z);
          if (id === B.AIR) continue;
          var info = Info[id];
          if (info.cross) {
            var uv = atlas.uv(info.tex.side);
            var a = 0.15, b = 0.85;
            transparent.quad([[x + a, y, z + a], [x + a, y + 1, z + a], [x + b, y + 1, z + b], [x + b, y, z + b]], [0.7, 0, -0.7], uv, 1.0);
            transparent.quad([[x + a, y, z + b], [x + a, y + 1, z + b], [x + b, y + 1, z + a], [x + b, y, z + a]], [0.7, 0, 0.7], uv, 1.0);
            continue;
          }
          var buf = info.transparent ? transparent : opaque;
          var top = (id === B.WATER && world.get(x, y + 1, z) !== B.WATER) ? 0.85 : 1;
          for (var f = 0; f < 6; f++) {
            var face = FACES[f];
            var nb = world.get(x + face.n[0], y + face.n[1], z + face.n[2]);
            if (!shouldDraw(id, nb)) continue;
            var pts = [];
            for (var i = 0; i < 4; i++) {
              var v = face.v[i];
              pts.push([x + v[0], y + v[1] * top, z + v[2]]);
            }
            buf.quad(pts, face.n, atlas.uv(info.tex[face.tex]), face.shade);
          }
        }
      }
    }
    return { opaque: opaque, transparent: transparent };
  }

  BC.Mesher = { buildChunk: buildChunk, FACES: FACES };
})(BC);
if (typeof module !== 'undefined') module.exports = BC;
