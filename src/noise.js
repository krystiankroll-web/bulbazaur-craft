// Deterministyczny szum 2D (value noise + fbm) na bazie mulberry32.
var BC = (typeof window !== 'undefined') ? (window.BC = window.BC || {}) : (typeof BC !== 'undefined' ? BC : {});
(function (BC) {
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function create(seed) {
    var rand = mulberry32(seed >>> 0);
    var SIZE = 256;
    var perm = new Uint8Array(SIZE * 2);
    var grads = new Float32Array(SIZE);
    var i;
    for (i = 0; i < SIZE; i++) { perm[i] = i; grads[i] = rand() * 2 - 1; }
    for (i = SIZE - 1; i > 0; i--) {
      var j = Math.floor(rand() * (i + 1));
      var tmp = perm[i]; perm[i] = perm[j]; perm[j] = tmp;
    }
    for (i = 0; i < SIZE; i++) perm[SIZE + i] = perm[i];

    function lattice(ix, iy) {
      return grads[perm[(perm[ix & 255] + iy) & 255]];
    }
    function smooth(t) { return t * t * (3 - 2 * t); }
    function noise2(x, y) {
      var x0 = Math.floor(x), y0 = Math.floor(y);
      var fx = x - x0, fy = y - y0;
      var sx = smooth(fx), sy = smooth(fy);
      var n00 = lattice(x0, y0), n10 = lattice(x0 + 1, y0);
      var n01 = lattice(x0, y0 + 1), n11 = lattice(x0 + 1, y0 + 1);
      var a = n00 + (n10 - n00) * sx;
      var b = n01 + (n11 - n01) * sx;
      return a + (b - a) * sy;
    }
    function fbm(x, y, octaves) {
      var sum = 0, amp = 1, freq = 1, norm = 0;
      for (var o = 0; o < (octaves || 4); o++) {
        sum += noise2(x * freq, y * freq) * amp;
        norm += amp; amp *= 0.5; freq *= 2;
      }
      return sum / norm;
    }
    // Hash 2D w [0,1) niezależny od pozycji szumu – do losowania drzew/kwiatów.
    function hash2(x, y) {
      var h = (perm[(perm[x & 255] + y) & 255] * 31 + perm[(x * 7 + y * 13) & 255]) & 255;
      var v = ((h * 2654435761) ^ (seed >>> 0)) >>> 0;
      return (v % 10007) / 10007;
    }
    return { noise2: noise2, fbm: fbm, hash2: hash2, rand: rand };
  }
  BC.Noise = { create: create, mulberry32: mulberry32 };
})(BC);
if (typeof module !== 'undefined') module.exports = BC;
