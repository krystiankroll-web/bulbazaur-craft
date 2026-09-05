// Świat voxelowy: chunki 16x16xH, generowanie terenu, serializacja.
var BC = (typeof window !== "undefined") ? (window.BC = window.BC || {}) : (global.BC = global.BC || {});
if (typeof require !== 'undefined' && !BC.Blocks) { require('./blocks.js'); require('./noise.js'); }
(function (BC) {
  var B = BC.Blocks;
  var CS = 16; // chunk size XZ

  function World(opts) {
    opts = opts || {};
    this.seed = (opts.seed === undefined) ? 1337 : opts.seed;
    this.size = opts.size || 128;
    this.height = opts.height || 64;
    this.waterLevel = opts.waterLevel || 28;
    this.chunksPerSide = Math.ceil(this.size / CS);
    this.chunks = new Array(this.chunksPerSide * this.chunksPerSide);
    for (var i = 0; i < this.chunks.length; i++) this.chunks[i] = new Uint8Array(CS * CS * this.height);
    this.diffs = {}; // "x,y,z" -> id (zmiany względem generatora)
    this.noise = BC.Noise.create(this.seed);
  }
  World.CHUNK = CS;

  World.prototype.inBounds = function (x, y, z) {
    return x >= 0 && z >= 0 && y >= 0 && x < this.size && z < this.size && y < this.height;
  };
  World.prototype.chunkKey = function (cx, cz) { return cx + ',' + cz; };
  World.prototype._chunk = function (x, z) {
    return this.chunks[(z >> 4) * this.chunksPerSide + (x >> 4)];
  };
  World.prototype._idx = function (x, y, z) {
    return ((x & 15) * CS + (z & 15)) * this.height + y;
  };
  World.prototype.get = function (x, y, z) {
    if (!this.inBounds(x, y, z)) return B.AIR;
    return this._chunk(x, z)[this._idx(x, y, z)];
  };
  World.prototype._raw = function (x, y, z, id) {
    this._chunk(x, z)[this._idx(x, y, z)] = id;
  };
  // Ustawia blok i zwraca klucze chunków do przebudowy. Pusta lista = nic się nie zmieniło.
  World.prototype.set = function (x, y, z, id) {
    if (!this.inBounds(x, y, z) || y === 0) return [];
    if (this.get(x, y, z) === id) return [];
    this._raw(x, y, z, id);
    this.diffs[x + ',' + y + ',' + z] = id;
    var keys = [this.chunkKey(x >> 4, z >> 4)];
    var lx = x & 15, lz = z & 15;
    if (lx === 0 && x > 0) keys.push(this.chunkKey((x >> 4) - 1, z >> 4));
    if (lx === 15 && x < this.size - 1) keys.push(this.chunkKey((x >> 4) + 1, z >> 4));
    if (lz === 0 && z > 0) keys.push(this.chunkKey(x >> 4, (z >> 4) - 1));
    if (lz === 15 && z < this.size - 1) keys.push(this.chunkKey(x >> 4, (z >> 4) + 1));
    return keys;
  };
  World.prototype.forEachChunk = function (fn) {
    for (var cz = 0; cz < this.chunksPerSide; cz++)
      for (var cx = 0; cx < this.chunksPerSide; cx++)
        fn(cx, cz, this.chunks[cz * this.chunksPerSide + cx]);
  };

  World.prototype.terrainHeight = function (x, z) {
    var n = this.noise;
    var h = 30 + n.fbm(x / 40, z / 40, 4) * 12 + n.noise2(x / 9, z / 9) * 1.5;
    return Math.max(2, Math.min(this.height - 12, Math.round(h)));
  };
  World.prototype.surfaceY = function (x, z) {
    for (var y = this.height - 1; y >= 0; y--) if (this.get(x, y, z) !== B.AIR) return y;
    return 0;
  };

  World.prototype.generate = function () {
    var x, y, z, h;
    var wl = this.waterLevel;
    for (x = 0; x < this.size; x++) {
      for (z = 0; z < this.size; z++) {
        h = this.terrainHeight(x, z);
        this._raw(x, 0, z, B.BEDROCK);
        for (y = 1; y <= h; y++) {
          var id;
          if (y < h - 3) id = B.STONE;
          else if (y < h) id = (h <= wl + 1) ? B.SAND : B.DIRT;
          else id = (h <= wl + 1) ? B.SAND : B.GRASS;
          this._raw(x, y, z, id);
        }
        for (y = h + 1; y <= wl; y++) this._raw(x, y, z, B.WATER);
      }
    }
    // Drzewa i kwiaty
    for (x = 3; x < this.size - 3; x++) {
      for (z = 3; z < this.size - 3; z++) {
        h = this.terrainHeight(x, z);
        if (this.get(x, h, z) !== B.GRASS) continue;
        var r = this.noise.hash2(x, z);
        if (r < 0.008) this.growTree(x, h + 1, z, false);
        else if (r < 0.04 && this.get(x, h + 1, z) === B.AIR) this._raw(x, h + 1, z, B.FLOWER);
      }
    }
    this.diffs = {};
    return this;
  };

  // Rośnie drzewo z pniem zaczynającym się w (x,y,z). record=true zapisuje diffy (dla drzew gracza).
  World.prototype.growTree = function (x, y, z, record) {
    var put = record === false
      ? function (w, px, py, pz, id) { if (w.inBounds(px, py, pz) && py > 0) w._raw(px, py, pz, id); }
      : function (w, px, py, pz, id) { return w.set(px, py, pz, id); };
    var trunk = 4 + Math.floor(this.noise.hash2(x * 3 + 1, z * 5 + 2) * 3); // 4..6
    var keys = {};
    var i, dx, dz, dy;
    for (i = 0; i < trunk; i++) {
      var r = put(this, x, y + i, z, B.LOG);
      if (r) r.forEach(function (k) { keys[k] = 1; });
    }
    var top = y + trunk - 1;
    for (dy = -2; dy <= 1; dy++) {
      var rad = (dy === 1) ? 1 : 2;
      for (dx = -rad; dx <= rad; dx++) {
        for (dz = -rad; dz <= rad; dz++) {
          if (Math.abs(dx) === rad && Math.abs(dz) === rad && rad === 2) continue; // zaokrąglenie
          var px = x + dx, py = top + dy, pz = z + dz;
          if (this.get(px, py, pz) !== B.AIR) continue;
          var r2 = put(this, px, py, pz, B.LEAVES);
          if (r2) r2.forEach(function (k) { keys[k] = 1; });
        }
      }
    }
    if (this.get(x, top + 2, z) === B.AIR) {
      var r3 = put(this, x, top + 2, z, B.LEAVES);
      if (r3) r3.forEach(function (k) { keys[k] = 1; });
    }
    return Object.keys(keys);
  };

  World.prototype.serialize = function () {
    var parts = [];
    for (var k in this.diffs) parts.push(k + ':' + this.diffs[k]);
    return JSON.stringify({ v: 1, seed: this.seed, size: this.size, height: this.height, diffs: parts });
  };
  World.deserialize = function (str) {
    var data = JSON.parse(str);
    var w = new World({ seed: data.seed, size: data.size, height: data.height });
    w.generate();
    for (var i = 0; i < data.diffs.length; i++) {
      var kv = data.diffs[i].split(':');
      var xyz = kv[0].split(',').map(Number);
      w.set(xyz[0], xyz[1], xyz[2], Number(kv[1]));
    }
    return w;
  };

  BC.World = World;
})(BC);
if (typeof module !== 'undefined') module.exports = BC;
