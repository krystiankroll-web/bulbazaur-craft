// Atlas tekstur rysowany na canvasie: 16x16 px na kafel, wszystkie kafle w jednym rzędzie.
var BC = (typeof window !== "undefined") ? (window.BC = window.BC || {}) : (global.BC = global.BC || {});
(function (BC) {
  var T = BC.Tex;
  var TILE = 16, COUNT = 32;

  function rng(seed) { return BC.Noise.mulberry32(seed); }
  function px(ctx, x, y, c) { ctx.fillStyle = c; ctx.fillRect(x, y, 1, 1); }
  function noisy(ctx, ox, base, vary, seed) {
    var r = rng(seed);
    for (var y = 0; y < TILE; y++) for (var x = 0; x < TILE; x++) {
      var k = 1 + (r() - 0.5) * vary;
      px(ctx, ox + x, y, 'rgb(' + Math.round(base[0] * k) + ',' + Math.round(base[1] * k) + ',' + Math.round(base[2] * k) + ')');
    }
  }
  function fill(ctx, ox, c) { ctx.fillStyle = c; ctx.fillRect(ox, 0, TILE, TILE); }

  var painters = {};
  painters[T.GRASS_TOP] = function (ctx, ox) { noisy(ctx, ox, [95, 170, 60], 0.25, 1); };
  painters[T.GRASS_SIDE] = function (ctx, ox) {
    noisy(ctx, ox, [134, 96, 67], 0.25, 2);
    var r = rng(3);
    for (var x = 0; x < TILE; x++) { var d = 3 + Math.floor(r() * 3); for (var y = 0; y < d; y++) px(ctx, ox + x, y, y < 2 ? '#5fae3c' : '#4f9433'); }
  };
  painters[T.DIRT] = function (ctx, ox) { noisy(ctx, ox, [134, 96, 67], 0.3, 4); };
  painters[T.STONE] = function (ctx, ox) { noisy(ctx, ox, [128, 128, 128], 0.22, 5); };
  painters[T.SAND] = function (ctx, ox) { noisy(ctx, ox, [222, 208, 150], 0.12, 6); };
  painters[T.WATER] = function (ctx, ox) { noisy(ctx, ox, [55, 110, 220], 0.15, 7); };
  painters[T.LOG_SIDE] = function (ctx, ox) {
    noisy(ctx, ox, [104, 78, 46], 0.2, 8);
    for (var x = 0; x < TILE; x += 4) for (var y = 0; y < TILE; y++) px(ctx, ox + x, y, '#4a3520');
  };
  painters[T.LOG_TOP] = function (ctx, ox) {
    fill(ctx, ox, '#6a5030');
    ctx.strokeStyle = '#c8a570';
    for (var r = 2; r < 8; r += 2) { ctx.beginPath(); ctx.arc(ox + 8, 8, r, 0, Math.PI * 2); ctx.stroke(); }
  };
  painters[T.LEAVES] = function (ctx, ox) {
    var r = rng(9);
    for (var y = 0; y < TILE; y++) for (var x = 0; x < TILE; x++) {
      if (r() < 0.12) continue; // dziurki
      var k = 0.8 + r() * 0.4;
      px(ctx, ox + x, y, 'rgb(' + Math.round(40 * k) + ',' + Math.round(130 * k) + ',' + Math.round(40 * k) + ')');
    }
  };
  painters[T.PLANKS] = function (ctx, ox) {
    noisy(ctx, ox, [190, 150, 90], 0.12, 10);
    for (var y = 0; y < TILE; y += 4) for (var x = 0; x < TILE; x++) px(ctx, ox + x, y, '#8a6a3a');
    for (var yy = 0; yy < TILE; yy++) px(ctx, ox + ((Math.floor(yy / 4) % 2) ? 12 : 4), yy, '#8a6a3a');
  };
  painters[T.GLASS] = function (ctx, ox) {
    ctx.fillStyle = 'rgba(200,235,255,0.22)'; ctx.fillRect(ox, 0, TILE, TILE);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillRect(ox, 0, TILE, 1); ctx.fillRect(ox, TILE - 1, TILE, 1); ctx.fillRect(ox, 0, 1, TILE); ctx.fillRect(ox + TILE - 1, 0, 1, TILE);
    for (var i = 2; i < 7; i++) px(ctx, ox + i, 8 - i, 'rgba(255,255,255,0.8)');
  };
  painters[T.FLOWER] = function (ctx, ox) {
    for (var y = 6; y < TILE; y++) px(ctx, ox + 8, y, '#3c8a2c');
    px(ctx, ox + 7, 11, '#3c8a2c'); px(ctx, ox + 9, 12, '#3c8a2c');
    var pet = '#ff6b8a', c = '#ffd34a';
    [[8, 3], [6, 5], [10, 5], [8, 7], [7, 4], [9, 4], [7, 6], [9, 6]].forEach(function (p) { px(ctx, ox + p[0], p[1], pet); });
    px(ctx, ox + 8, 5, c);
  };
  painters[T.SAPLING] = function (ctx, ox) {
    for (var y = 7; y < TILE; y++) px(ctx, ox + 8, y, '#6a4a2a');
    [[8, 4], [7, 5], [9, 5], [6, 6], [10, 6], [7, 7], [9, 7], [8, 6], [8, 5]].forEach(function (p) { px(ctx, ox + p[0], p[1], '#4fae3c'); });
  };
  painters[T.BEDROCK] = function (ctx, ox) { noisy(ctx, ox, [70, 70, 75], 0.5, 11); };
  var wool = [[T.WOOL_RED, [210, 50, 50]], [T.WOOL_ORANGE, [235, 130, 40]], [T.WOOL_YELLOW, [240, 215, 60]], [T.WOOL_GREEN, [70, 180, 80]],
    [T.WOOL_BLUE, [60, 110, 220]], [T.WOOL_PURPLE, [150, 80, 200]], [T.WOOL_PINK, [240, 130, 190]], [T.WOOL_WHITE, [235, 235, 235]]];
  wool.forEach(function (w, i) { painters[w[0]] = function (ctx, ox) { noisy(ctx, ox, w[1], 0.08, 20 + i); }; });
  painters[T.SNOW_TOP] = function (ctx, ox) { noisy(ctx, ox, [240, 245, 250], 0.06, 30); };
  painters[T.SNOW_SIDE] = function (ctx, ox) {
    noisy(ctx, ox, [134, 96, 67], 0.25, 31);
    var r = rng(32);
    for (var x = 0; x < TILE; x++) { var d = 4 + Math.floor(r() * 3); for (var y = 0; y < d; y++) px(ctx, ox + x, y, y < 3 ? '#f2f6fa' : '#dfe6ee'); }
  };
  painters[T.CACTUS_SIDE] = function (ctx, ox) {
    noisy(ctx, ox, [60, 140, 60], 0.15, 33);
    for (var y = 0; y < TILE; y++) { px(ctx, ox + 3, y, '#2f7a2f'); px(ctx, ox + 8, y, '#2f7a2f'); px(ctx, ox + 13, y, '#2f7a2f'); }
    for (var yy = 1; yy < TILE; yy += 4) { px(ctx, ox + 1, yy, '#e8f0c0'); px(ctx, ox + 6, yy + 2, '#e8f0c0'); px(ctx, ox + 11, yy, '#e8f0c0'); px(ctx, ox + 15, yy + 2, '#e8f0c0'); }
  };
  painters[T.CACTUS_TOP] = function (ctx, ox) { noisy(ctx, ox, [80, 160, 80], 0.1, 34); ctx.fillStyle = '#2f7a2f'; ctx.fillRect(ox + 4, 4, 8, 8); };
  painters[T.BRICK] = function (ctx, ox) {
    fill(ctx, ox, '#c9c2b8');
    var r = rng(35);
    for (var y = 0; y < TILE; y += 4) {
      var off = (y / 4) % 2 ? 4 : 0;
      for (var x = -4; x < TILE; x += 8) {
        var k = 0.9 + r() * 0.2;
        ctx.fillStyle = 'rgb(' + Math.round(170 * k) + ',' + Math.round(70 * k) + ',' + Math.round(55 * k) + ')';
        ctx.fillRect(ox + Math.max(0, x + off), y, Math.min(7, x + off + 7) - Math.max(0, x + off), 3);
      }
    }
  };
  painters[T.COBBLE] = function (ctx, ox) {
    noisy(ctx, ox, [110, 110, 110], 0.35, 36);
    var r = rng(37);
    for (var i = 0; i < 7; i++) { var x = Math.floor(r() * 13), y = Math.floor(r() * 13), w = 2 + Math.floor(r() * 3);
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(ox + x, y, w + 1, 1); ctx.fillRect(ox + x, y, 1, w + 1); }
  };
  painters[T.GRAVEL] = function (ctx, ox) { noisy(ctx, ox, [140, 130, 120], 0.45, 38); };
  painters[T.TULIP] = function (ctx, ox) {
    for (var y = 6; y < TILE; y++) px(ctx, ox + 8, y, '#3c8a2c');
    px(ctx, ox + 6, 12, '#3c8a2c'); px(ctx, ox + 7, 11, '#3c8a2c'); px(ctx, ox + 10, 13, '#3c8a2c');
    [[7, 2], [8, 2], [9, 2], [6, 3], [7, 3], [8, 3], [9, 3], [10, 3], [6, 4], [7, 4], [8, 4], [9, 4], [10, 4], [7, 5], [8, 5], [9, 5]].forEach(function (p) { px(ctx, ox + p[0], p[1], '#e8452c'); });
    px(ctx, ox + 7, 3, '#ff8a6a'); px(ctx, ox + 8, 2, '#ff8a6a');
  };

  painters[T.TORCH] = function (ctx, ox) {
    for (var y = 6; y < TILE; y++) { px(ctx, ox + 7, y, '#6a4a2a'); px(ctx, ox + 8, y, '#8a6a3a'); }
    [[7, 2], [8, 2], [6, 3], [7, 3], [8, 3], [9, 3], [6, 4], [7, 4], [8, 4], [9, 4], [7, 5], [8, 5]].forEach(function (p) { px(ctx, ox + p[0], p[1], '#ffb020'); });
    px(ctx, ox + 7, 1, '#ffe080'); px(ctx, ox + 8, 3, '#fff0a0'); px(ctx, ox + 7, 4, '#ff6a10');
  };
  painters[T.APPLE] = function (ctx, ox) {
    var red = '#d8302c', dark = '#a81e1e', hi = '#ff7a6a';
    for (var y = 5; y < 14; y++) for (var x = 4; x < 12; x++) {
      var corner = (y === 5 || y === 13) && (x === 4 || x === 11);
      if (corner) continue;
      px(ctx, ox + x, y, (x === 11 || y === 13) ? dark : red);
    }
    px(ctx, ox + 5, 6, hi); px(ctx, ox + 6, 6, hi); px(ctx, ox + 5, 7, hi);
    px(ctx, ox + 8, 4, '#5a3a1a'); px(ctx, ox + 8, 3, '#5a3a1a');
    px(ctx, ox + 9, 3, '#4fae3c'); px(ctx, ox + 10, 3, '#4fae3c'); px(ctx, ox + 10, 2, '#4fae3c');
  };

  function createAtlas() {
    var canvas = document.createElement('canvas');
    canvas.width = TILE * COUNT; canvas.height = TILE;
    var ctx = canvas.getContext('2d');
    for (var i = 0; i < COUNT; i++) painters[i](ctx, i * TILE);
    var inset = 0.5 / (TILE * COUNT);
    return {
      canvas: canvas, count: COUNT, tile: TILE,
      uv: function (i) { return [i / COUNT + inset, 0, (i + 1) / COUNT - inset, 1]; },
      // Miniatura kafla jako data URL (do HUD)
      icon: function (i) {
        var c = document.createElement('canvas'); c.width = TILE; c.height = TILE;
        c.getContext('2d').drawImage(canvas, i * TILE, 0, TILE, TILE, 0, 0, TILE, TILE);
        return c.toDataURL();
      }
    };
  }
  BC.Textures = { createAtlas: createAtlas, TILE: TILE, COUNT: COUNT };
})(BC);
if (typeof module !== 'undefined') module.exports = BC;
