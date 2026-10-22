// Rejestr bloków. Działa w przeglądarce (global BC) i w Node (module.exports).
var BC = (typeof window !== "undefined") ? (window.BC = window.BC || {}) : (global.BC = global.BC || {});
(function (BC) {
  var Blocks = {
    AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, SAND: 4, WATER: 5, LOG: 6, LEAVES: 7,
    PLANKS: 8, GLASS: 9, FLOWER: 10, SAPLING: 11, BEDROCK: 12,
    WOOL_RED: 13, WOOL_ORANGE: 14, WOOL_YELLOW: 15, WOOL_GREEN: 16,
    WOOL_BLUE: 17, WOOL_PURPLE: 18, WOOL_PINK: 19, WOOL_WHITE: 20,
    SNOW: 21, CACTUS: 22, BRICK: 23, COBBLE: 24, GRAVEL: 25, TULIP: 26,
    TORCH: 27, APPLE: 28, MILK: 29, EGG: 30
  };

  // Indeksy kafli w atlasie (zob. textures.js)
  var T = {
    GRASS_TOP: 0, GRASS_SIDE: 1, DIRT: 2, STONE: 3, SAND: 4, WATER: 5, LOG_SIDE: 6, LOG_TOP: 7,
    LEAVES: 8, PLANKS: 9, GLASS: 10, FLOWER: 11, SAPLING: 12, BEDROCK: 13,
    WOOL_RED: 14, WOOL_ORANGE: 15, WOOL_YELLOW: 16, WOOL_GREEN: 17,
    WOOL_BLUE: 18, WOOL_PURPLE: 19, WOOL_PINK: 20, WOOL_WHITE: 21,
    SNOW_TOP: 22, SNOW_SIDE: 23, CACTUS_SIDE: 24, CACTUS_TOP: 25, BRICK: 26, COBBLE: 27, GRAVEL: 28, TULIP: 29,
    TORCH: 30, APPLE: 31, MILK: 32, EGG: 33
  };

  function def(name, opts) {
    return {
      name: name,
      solid: opts.solid !== false,
      transparent: !!opts.transparent,
      cross: !!opts.cross,
      placeable: opts.placeable !== false,
      breakable: opts.breakable !== false,
      item: !!opts.item,          // przedmiot do plecaka, nie blok w świecie
      light: !!opts.light,        // świeci (pochodnia)
      burnable: !!opts.burnable,  // spala go płomień Charmandera
      drop: opts.drop,            // co wpada do plecaka po zniszczeniu (undefined = ten sam blok, null = nic)
      tex: opts.tex
    };
  }
  function uni(t) { return { top: t, side: t, bottom: t }; }

  var BlockInfo = [];
  BlockInfo[Blocks.AIR] = def('Powietrze', { solid: false, transparent: true, placeable: false, tex: uni(0) });
  BlockInfo[Blocks.GRASS] = def('Trawa', { drop: Blocks.DIRT, tex: { top: T.GRASS_TOP, side: T.GRASS_SIDE, bottom: T.DIRT } });
  BlockInfo[Blocks.DIRT] = def('Ziemia', { tex: uni(T.DIRT) });
  BlockInfo[Blocks.STONE] = def('Kamień', { drop: Blocks.COBBLE, tex: uni(T.STONE) });
  BlockInfo[Blocks.SAND] = def('Piasek', { tex: uni(T.SAND) });
  BlockInfo[Blocks.WATER] = def('Woda', { solid: false, transparent: true, placeable: false, drop: null, tex: uni(T.WATER) });
  BlockInfo[Blocks.LOG] = def('Pień', { burnable: true, tex: { top: T.LOG_TOP, side: T.LOG_SIDE, bottom: T.LOG_TOP } });
  BlockInfo[Blocks.LEAVES] = def('Liście', { transparent: true, burnable: true, drop: null, tex: uni(T.LEAVES) });
  BlockInfo[Blocks.PLANKS] = def('Deski', { burnable: true, tex: uni(T.PLANKS) });
  BlockInfo[Blocks.GLASS] = def('Szkło', { transparent: true, tex: uni(T.GLASS) });
  BlockInfo[Blocks.FLOWER] = def('Kwiatek', { solid: false, transparent: true, cross: true, burnable: true, tex: uni(T.FLOWER) });
  BlockInfo[Blocks.SAPLING] = def('Sadzonka', { solid: false, transparent: true, cross: true, burnable: true, tex: uni(T.SAPLING) });
  BlockInfo[Blocks.BEDROCK] = def('Skała macierzysta', { placeable: false, breakable: false, drop: null, tex: uni(T.BEDROCK) });
  BlockInfo[Blocks.WOOL_RED] = def('Wełna czerwona', { tex: uni(T.WOOL_RED) });
  BlockInfo[Blocks.WOOL_ORANGE] = def('Wełna pomarańczowa', { tex: uni(T.WOOL_ORANGE) });
  BlockInfo[Blocks.WOOL_YELLOW] = def('Wełna żółta', { tex: uni(T.WOOL_YELLOW) });
  BlockInfo[Blocks.WOOL_GREEN] = def('Wełna zielona', { tex: uni(T.WOOL_GREEN) });
  BlockInfo[Blocks.WOOL_BLUE] = def('Wełna niebieska', { tex: uni(T.WOOL_BLUE) });
  BlockInfo[Blocks.WOOL_PURPLE] = def('Wełna fioletowa', { tex: uni(T.WOOL_PURPLE) });
  BlockInfo[Blocks.WOOL_PINK] = def('Wełna różowa', { tex: uni(T.WOOL_PINK) });
  BlockInfo[Blocks.WOOL_WHITE] = def('Wełna biała', { tex: uni(T.WOOL_WHITE) });
  BlockInfo[Blocks.SNOW] = def('Śnieg', { tex: { top: T.SNOW_TOP, side: T.SNOW_SIDE, bottom: T.DIRT } });
  BlockInfo[Blocks.CACTUS] = def('Kaktus', { tex: { top: T.CACTUS_TOP, side: T.CACTUS_SIDE, bottom: T.CACTUS_TOP } });
  BlockInfo[Blocks.BRICK] = def('Cegła', { tex: uni(T.BRICK) });
  BlockInfo[Blocks.COBBLE] = def('Bruk', { tex: uni(T.COBBLE) });
  BlockInfo[Blocks.GRAVEL] = def('Żwir', { tex: uni(T.GRAVEL) });
  BlockInfo[Blocks.TULIP] = def('Tulipan', { solid: false, transparent: true, cross: true, burnable: true, tex: uni(T.TULIP) });
  BlockInfo[Blocks.TORCH] = def('Pochodnia', { solid: false, transparent: true, cross: true, light: true, tex: uni(T.TORCH) });
  BlockInfo[Blocks.APPLE] = def('Jabłko', { solid: false, transparent: true, placeable: false, item: true, drop: null, tex: uni(T.APPLE) });
  BlockInfo[Blocks.MILK] = def('Mleko', { solid: false, transparent: true, placeable: false, item: true, drop: null, tex: uni(T.MILK) });
  BlockInfo[Blocks.EGG] = def('Jajko', { solid: false, transparent: true, placeable: false, item: true, drop: null, tex: uni(T.EGG) });
  [Blocks.WOOL_RED, Blocks.WOOL_ORANGE, Blocks.WOOL_YELLOW, Blocks.WOOL_GREEN, Blocks.WOOL_BLUE, Blocks.WOOL_PURPLE, Blocks.WOOL_PINK, Blocks.WOOL_WHITE]
    .forEach(function (id) { BlockInfo[id].burnable = true; });

  var Hotbar = [
    [Blocks.GRASS, Blocks.DIRT, Blocks.STONE, Blocks.SAND, Blocks.LOG, Blocks.LEAVES, Blocks.PLANKS, Blocks.GLASS, Blocks.FLOWER],
    [Blocks.WOOL_RED, Blocks.WOOL_ORANGE, Blocks.WOOL_YELLOW, Blocks.WOOL_GREEN, Blocks.WOOL_BLUE, Blocks.WOOL_PURPLE, Blocks.WOOL_PINK, Blocks.WOOL_WHITE, Blocks.SAPLING],
    [Blocks.SNOW, Blocks.CACTUS, Blocks.BRICK, Blocks.COBBLE, Blocks.GRAVEL, Blocks.TULIP, Blocks.TORCH, Blocks.GLASS, Blocks.PLANKS]
  ];

  BC.Blocks = Blocks;
  BC.Tex = T;
  BC.BlockInfo = BlockInfo;
  BC.Hotbar = Hotbar;
})(BC);
if (typeof module !== 'undefined') module.exports = BC;
