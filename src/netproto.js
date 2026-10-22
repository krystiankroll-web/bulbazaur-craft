// Protokół gry we dwoje (czysty, testowalny w Node): kod pokoju, pakowanie stanu stworzeń, wygładzanie ruchu.
var BC = (typeof window !== "undefined") ? (window.BC = window.BC || {}) : (global.BC = global.BC || {});
if (typeof require !== 'undefined' && !BC.Creatures) { require('./creatures.js'); }
(function (BC) {
  var P = {};
  P.ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // bez mylących 0/O/1/I
  P.TYPES = Object.keys(BC.Creatures.TYPES);

  P.makeCode = function (rand) {
    var s = '';
    for (var i = 0; i < 4; i++) s += P.ALPHABET[Math.min(P.ALPHABET.length - 1, Math.floor(rand() * P.ALPHABET.length))];
    return s;
  };
  // Kod wpisany przez dziecko → poprawny kod albo null.
  P.normCode = function (str) {
    var s = String(str || '').toUpperCase().replace(/\s+/g, '');
    if (s.length !== 4) return null;
    for (var i = 0; i < 4; i++) if (P.ALPHABET.indexOf(s[i]) < 0) return null;
    return s;
  };
  P.peerId = function (code) { return 'bulbazaurcraft-' + code.toLowerCase(); };

  function r2(v) { return Math.round(v * 100) / 100; }
  // Stworzenia → [[id, typ, x, y, z, yaw, flagi, fuseT]]; flagi: 1 trafiony, 2 płonie, 4 łysa owca, 8 pokonany.
  P.packCreatures = function (list) {
    return list.map(function (c) {
      var b = c.body.pos;
      var flags = (c.hurtT > 0 ? 1 : 0) | (c.burning ? 2 : 0) | (c.shornT > 0 ? 4 : 0) | (c.dead ? 8 : 0);
      var fuse = (c.fuseT === undefined || c.fuseT === null) ? -1 : r2(c.fuseT);
      return [c.id, P.TYPES.indexOf(c.type), r2(b.x), r2(b.y), r2(b.z), r2(c.yaw), flags, fuse];
    });
  };
  P.unpackCreatures = function (arr) {
    return arr.map(function (a) {
      return { id: a[0], type: P.TYPES[a[1]], x: a[2], y: a[3], z: a[4], yaw: a[5],
        hurt: !!(a[6] & 1), burning: !!(a[6] & 2), shorn: !!(a[6] & 4), dead: !!(a[6] & 8), fuseT: a[7] < 0 ? null : a[7] };
    });
  };

  // Płynne dojście do celu (rate ≈ ile razy na sekundę).
  P.approach = function (cur, target, dt, rate) { return cur + (target - cur) * Math.min(1, dt * rate); };
  function wrap(a) { a = (a + Math.PI) % (Math.PI * 2); if (a < 0) a += Math.PI * 2; return a - Math.PI; }
  P.approachAngle = function (cur, target, dt, rate) { return wrap(cur + wrap(target - cur) * Math.min(1, dt * rate)); };

  BC.NetProto = P;
})(BC);
if (typeof module !== 'undefined') module.exports = BC;
