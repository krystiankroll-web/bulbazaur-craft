// Nieskończony świat voxelowy: chunki 16x16xH generowane na żądanie, biomy, drzewa, serializacja zmian.
var BC = (typeof window !== "undefined") ? (window.BC = window.BC || {}) : (global.BC = global.BC || {});
if (typeof require !== 'undefined' && !BC.Blocks) { require('./blocks.js'); require('./noise.js'); }
(function (BC) {
  var B = BC.Blocks;
  var CS = 16;

  function World(opts) {
    opts = opts || {};
    this.seed = (opts.seed === undefined) ? 1337 : opts.seed;
    this.height = opts.height || 80;
    this.waterLevel = opts.waterLevel || 30;
    this.terrain = opts.terrain !== false;      // false = pusty świat (testy)
    this.chunks = new Map();                    // key -> Uint8Array
    this.diffs = {};                            // "x,y,z" -> id (wszystkie zmiany gracza)
    this.pending = {};                          // chunkKey -> [[x,y,z,id]] zmiany do nałożenia po wygenerowaniu
    this.noise = BC.Noise.create(this.seed);
  }
  World.CHUNK = CS;

  World.prototype.chunkKey = function (cx, cz) { return cx + ',' + cz; };
  World.prototype.hasChunk = function (cx, cz) { return this.chunks.has(this.chunkKey(cx, cz)); };
  World.prototype._idx = function (x, y, z) { return ((x & 15) * CS + (z & 15)) * this.height + y; };

  World.prototype.get = function (x, y, z) {
    if (y < 0 || y >= this.height) return B.AIR;
    var c = this.chunks.get(this.chunkKey(x >> 4, z >> 4));
    if (!c) return B.AIR;
    return c[this._idx(x, y, z)];
  };
  World.prototype._raw = function (x, y, z, id) {
    var c = this.chunks.get(this.chunkKey(x >> 4, z >> 4));
    if (c && y >= 0 && y < this.height) c[this._idx(x, y, z)] = id;
  };

  // Tworzy (i generuje) chunk, jeśli go nie ma. Zwraca dane.
  World.prototype.ensureChunk = function (cx, cz) {
    var key = this.chunkKey(cx, cz);
    var c = this.chunks.get(key);
    if (c) return c;
    c = new Uint8Array(CS * CS * this.height);
    this.chunks.set(key, c);
    if (this.terrain) this.generateChunk(cx, cz);
    var p = this.pending[key];
    if (p) { for (var i = 0; i < p.length; i++) this._raw(p[i][0], p[i][1], p[i][2], p[i][3]); delete this.pending[key]; }
    return c;
  };

  // Ustawia blok (tworząc chunk w razie potrzeby). Zwraca klucze chunków do przebudowy.
  World.prototype.set = function (x, y, z, id) {
    if (y <= 0 || y >= this.height) return [];
    var cx = x >> 4, cz = z >> 4;
    this.ensureChunk(cx, cz);
    if (this.get(x, y, z) === id) return [];
    this._raw(x, y, z, id);
    this.diffs[x + ',' + y + ',' + z] = id;
    if (this.onChange) this.onChange(x, y, z, id);   // np. gra we dwoje wysyła zmianę koledze
    var keys = [this.chunkKey(cx, cz)];
    var lx = x & 15, lz = z & 15;
    if (lx === 0) keys.push(this.chunkKey(cx - 1, cz));
    if (lx === 15) keys.push(this.chunkKey(cx + 1, cz));
    if (lz === 0) keys.push(this.chunkKey(cx, cz - 1));
    if (lz === 15) keys.push(this.chunkKey(cx, cz + 1));
    return keys;
  };
  World.prototype.forEachChunk = function (fn) {
    this.chunks.forEach(function (data, key) { var p = key.split(',').map(Number); fn(p[0], p[1], data); });
  };

  // ---------- Teren i biomy ----------
  // biome: 0 łąka, 1 las, 2 pustynia, 3 śnieg
  World.prototype.biomeAt = function (x, z) {
    var n = this.noise;
    var temp = n.fbm(x / 260 + 300, z / 260 + 300, 2);
    var forest = n.noise2(x / 90 + 700, z / 90 + 700);
    if (temp < -0.28) return 3;
    if (temp > 0.34) return 2;
    return forest > 0.08 ? 1 : 0;
  };
  World.prototype.terrainHeight = function (x, z) {
    var n = this.noise;
    var h = 32 + n.fbm(x / 70, z / 70, 4) * 11 + n.noise2(x / 9, z / 9) * 1.2;
    var m = n.fbm(x / 170 + 1000, z / 170 + 1000, 3);
    if (m > 0.12) h += (m - 0.12) * 110;        // góry
    var v = n.noise2(x / 45 + 2000, z / 45 + 2000);
    if (v < -0.45) h -= (-0.45 - v) * 30;       // doliny i jeziora
    return Math.max(3, Math.min(this.height - 8, Math.round(h)));
  };
  World.prototype.surfaceY = function (x, z) {
    this.ensureChunk(x >> 4, z >> 4);
    for (var y = this.height - 1; y >= 0; y--) if (this.get(x, y, z) !== B.AIR) return y;
    return 0;
  };
  // Najbliższe miejsce na trawie/śniegu nad wodą wokół (x,z) – do spawnu.
  World.prototype.findSpawn = function (x, z) {
    for (var r = 0; r < 64; r += 4) {
      for (var dx = -r; dx <= r; dx += 4) for (var dz = -r; dz <= r; dz += 4) {
        var px = x + dx, pz = z + dz, h = this.terrainHeight(px, pz);
        if (h > this.waterLevel + 1 && this.biomeAt(px, pz) !== 2 && this.noise.hash2(px, pz) > 0.06) return { x: px + 0.5, z: pz + 0.5 };
      }
    }
    return { x: x + 0.5, z: z + 0.5 };
  };

  // Kształt drzewa: lista [dx, dy, dz, id] względem podstawy pnia.
  World.prototype.treeShape = function (x, z, kind) {
    var out = [];
    var trunk = 4 + Math.floor(this.noise.hash2(x * 3 + 1, z * 5 + 2) * 3); // 4..6
    var i, dx, dz, dy;
    if (kind === 'spruce') {
      trunk += 2;
      for (i = 0; i < trunk; i++) out.push([0, i, 0, B.LOG]);
      for (dy = 2; dy <= trunk; dy++) {
        var rad = (dy % 2 === 0) ? 2 : 1;
        if (dy >= trunk - 1) rad = 1;
        if (dy === trunk) rad = 0;
        for (dx = -rad; dx <= rad; dx++) for (dz = -rad; dz <= rad; dz++) {
          if (dx === 0 && dz === 0 && dy < trunk) continue;
          if (rad === 2 && Math.abs(dx) === 2 && Math.abs(dz) === 2) continue;
          out.push([dx, dy, dz, B.LEAVES]);
        }
      }
      out.push([0, trunk, 0, B.LEAVES]); out.push([0, trunk + 1, 0, B.LEAVES]);
      return out;
    }
    for (i = 0; i < trunk; i++) out.push([0, i, 0, B.LOG]);
    var top = trunk - 1;
    for (dy = -2; dy <= 1; dy++) {
      var r2 = (dy === 1) ? 1 : 2;
      for (dx = -r2; dx <= r2; dx++) for (dz = -r2; dz <= r2; dz++) {
        if (dx === 0 && dz === 0 && dy <= 0) continue;
        if (r2 === 2 && Math.abs(dx) === 2 && Math.abs(dz) === 2) continue;
        out.push([dx, top + dy, dz, B.LEAVES]);
      }
    }
    out.push([0, top + 2, 0, B.LEAVES]);
    return out;
  };

  // Co stoi na kolumnie (x,z)? null albo {kind, y}
  World.prototype.decorationAt = function (x, z) {
    var h = this.terrainHeight(x, z);
    if (h <= this.waterLevel + 1) return null;
    var biome = this.biomeAt(x, z);
    var r = this.noise.hash2(x, z);
    if (biome === 2) {
      if (r < 0.006) return { kind: 'cactus', y: h + 1, n: 2 + Math.floor(this.noise.hash2(x + 9, z + 9) * 2) };
      return null;
    }
    var treeP = biome === 1 ? 0.035 : (biome === 3 ? 0.012 : 0.004);
    if (h >= this.height - 12) treeP *= 0.2;
    if (r < treeP) return { kind: biome === 3 ? 'spruce' : 'oak', y: h + 1 };
    if (biome !== 3 && r < treeP + 0.03) return { kind: r < treeP + 0.02 ? 'flower' : 'tulip', y: h + 1 };
    return null;
  };

  World.prototype.generateChunk = function (cx, cz) {
    var key = this.chunkKey(cx, cz), data = this.chunks.get(key);
    var x0 = cx * CS, z0 = cz * CS, wl = this.waterLevel, H = this.height;
    var x, z, y, lx, lz;
    for (lx = 0; lx < CS; lx++) {
      for (lz = 0; lz < CS; lz++) {
        x = x0 + lx; z = z0 + lz;
        var h = this.terrainHeight(x, z), biome = this.biomeAt(x, z);
        var base = (lx * CS + lz) * H;
        data[base] = B.BEDROCK;
        var top, under;
        if (biome === 2) { top = B.SAND; under = B.SAND; }
        else if (h <= wl + 1) { top = B.SAND; under = B.SAND; }
        else if (biome === 3 || h >= H - 14) { top = B.SNOW; under = B.DIRT; }
        else { top = B.GRASS; under = B.DIRT; }
        if (h >= H - 20 && biome !== 2 && h > wl + 1 && this.noise.hash2(x + 5, z + 7) < 0.5 && top !== B.SNOW) { top = B.STONE; under = B.STONE; }
        for (y = 1; y <= h; y++) data[base + y] = (y < h - 3) ? B.STONE : (y < h ? under : top);
        if (h > 6 && this.noise.hash2(x + 3, z + 11) < 0.02) data[base + h - 1] = B.GRAVEL;
        for (y = h + 1; y <= wl; y++) data[base + y] = B.WATER;
      }
    }
    // Dekoracje z marginesem, żeby drzewa z sąsiednich kolumn wchodziły do tego chunku.
    var M = 3;
    for (x = x0 - M; x < x0 + CS + M; x++) {
      for (z = z0 - M; z < z0 + CS + M; z++) {
        var d = this.decorationAt(x, z);
        if (!d) continue;
        if (d.kind === 'flower' || d.kind === 'tulip') { this._putIn(data, x0, z0, x, d.y, z, d.kind === 'flower' ? B.FLOWER : B.TULIP, true); continue; }
        if (d.kind === 'cactus') { for (var k = 0; k < d.n; k++) this._putIn(data, x0, z0, x, d.y + k, z, B.CACTUS, true); continue; }
        var shape = this.treeShape(x, z, d.kind);
        for (var i = 0; i < shape.length; i++) {
          var s = shape[i];
          this._putIn(data, x0, z0, x + s[0], d.y + s[1], z + s[2], s[3], s[3] === B.LEAVES);
        }
      }
    }
  };
  World.prototype._putIn = function (data, x0, z0, x, y, z, id, onlyAir) {
    var lx = x - x0, lz = z - z0;
    if (lx < 0 || lz < 0 || lx >= CS || lz >= CS || y <= 0 || y >= this.height) return;
    var i = (lx * CS + lz) * this.height + y;
    if (onlyAir && data[i] !== B.AIR) return;
    data[i] = id;
  };

  // Drzewo sadzone przez gracza (zapisuje diffy). Zwraca klucze chunków do przebudowy.
  World.prototype.growTree = function (x, y, z, kind) {
    var shape = this.treeShape(x, z, kind || (this.biomeAt(x, z) === 3 ? 'spruce' : 'oak'));
    var keys = {};
    for (var i = 0; i < shape.length; i++) {
      var s = shape[i], px = x + s[0], py = y + s[1], pz = z + s[2];
      var cur = this.get(px, py, pz);
      if (s[3] === B.LEAVES && cur !== B.AIR) continue;
      if (s[3] === B.LOG && cur !== B.AIR && cur !== B.SAPLING && cur !== B.LEAVES) continue;
      this.set(px, py, pz, s[3]).forEach(function (k) { keys[k] = 1; });
    }
    return Object.keys(keys);
  };

  World.prototype.serialize = function () {
    var parts = [];
    for (var k in this.diffs) parts.push(k + ':' + this.diffs[k]);
    return JSON.stringify({ v: 2, seed: this.seed, height: this.height, diffs: parts });
  };
  World.deserialize = function (str) {
    var data = JSON.parse(str);
    if (data.v !== 2) throw new Error('Nieobsługiwana wersja zapisu');
    var w = new World({ seed: data.seed, height: data.height });
    for (var i = 0; i < data.diffs.length; i++) {
      var kv = data.diffs[i].split(':');
      var xyz = kv[0].split(',').map(Number), id = Number(kv[1]);
      w.diffs[kv[0]] = id;
      var key = w.chunkKey(xyz[0] >> 4, xyz[2] >> 4);
      (w.pending[key] = w.pending[key] || []).push([xyz[0], xyz[1], xyz[2], id]);
    }
    return w;
  };

  BC.World = World;
})(BC);
if (typeof module !== 'undefined') module.exports = BC;
