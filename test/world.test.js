const test = require('node:test');
const assert = require('node:assert');
const BC = require('../src/world.js');
const B = BC.Blocks;

function empty() { return new BC.World({ seed: 5, terrain: false, height: 64 }); }
function gen(seed) { return new BC.World({ seed: seed || 5 }); }

test('get/set round-trip, AIR poza wysokością i w niewygenerowanym chunku', () => {
  const w = empty();
  assert.equal(w.get(5, 10, 5), B.AIR);
  w.set(5, 10, 5, B.STONE);
  assert.equal(w.get(5, 10, 5), B.STONE);
  assert.equal(w.get(5, 100, 5), B.AIR);
  assert.equal(w.get(5, -1, 5), B.AIR);
  assert.equal(w.get(500, 10, 5), B.AIR);
});

test('ujemne współrzędne działają', () => {
  const w = empty();
  w.set(-1, 10, -17, B.BRICK);
  assert.equal(w.get(-1, 10, -17), B.BRICK);
  assert.equal(w.get(-2, 10, -17), B.AIR);
  assert.ok(w.hasChunk(-1, -2));
});

test('set na y=0 i poza wysokością to no-op', () => {
  const w = empty();
  assert.deepEqual(w.set(5, 0, 5, B.STONE), []);
  assert.deepEqual(w.set(5, 64, 5, B.STONE), []);
  assert.equal(w.get(5, 0, 5), B.AIR);
});

test('set zwraca chunk + sąsiada na krawędzi', () => {
  const w = empty();
  assert.deepEqual(w.set(5, 5, 5, B.STONE), ['0,0']);
  assert.deepEqual(w.set(16, 5, 5, B.STONE).sort(), ['0,0', '1,0']);
  assert.deepEqual(w.set(5, 5, 15, B.STONE).sort(), ['0,0', '0,1']);
  assert.deepEqual(w.set(0, 5, 0, B.STONE).sort(), ['-1,0', '0,-1', '0,0']);
  assert.deepEqual(w.set(5, 5, 15, B.STONE), [], 'ten sam blok = brak zmian');
});

test('wygenerowany chunk: bedrock na dnie, sensowna powierzchnia, dekoracje w okolicy', () => {
  const w = gen(5);
  let water = 0, logs = 0, grass = 0, snow = 0, sand = 0;
  for (let cx = -2; cx <= 2; cx++) for (let cz = -2; cz <= 2; cz++) w.ensureChunk(cx, cz);
  for (let x = -32; x < 48; x++) for (let z = -32; z < 48; z++) {
    assert.equal(w.get(x, 0, z), B.BEDROCK);
    const y = w.surfaceY(x, z);
    const top = w.get(x, y, z);
    assert.ok([B.GRASS, B.SAND, B.WATER, B.LEAVES, B.LOG, B.FLOWER, B.TULIP, B.SNOW, B.STONE, B.CACTUS].includes(top), 'blok ' + top + ' na ' + x + ',' + z);
    for (let yy = 0; yy <= y; yy++) {
      const id = w.get(x, yy, z);
      if (id === B.WATER) water++; if (id === B.LOG) logs++; if (id === B.GRASS) grass++; if (id === B.SNOW) snow++; if (id === B.SAND) sand++;
    }
  }
  assert.ok(grass + snow + sand > 1000);
  assert.ok(logs > 0, 'brak drzew');
});

test('generowanie jest deterministyczne i niezależne od kolejności chunków', () => {
  const a = gen(9), b = gen(9);
  a.ensureChunk(0, 0); a.ensureChunk(1, 0); a.ensureChunk(0, 1);
  b.ensureChunk(0, 1); b.ensureChunk(1, 0); b.ensureChunk(0, 0);
  for (const key of ['0,0', '1,0', '0,1']) assert.deepEqual(a.chunks.get(key), b.chunks.get(key), key);
});

test('drzewa przechodzą przez granicę chunków spójnie', () => {
  // Szukamy drzewa, którego liście wychodzą poza chunk: liście w chunku sąsiada muszą istnieć.
  const w = gen(21);
  let found = 0;
  for (let cx = -3; cx <= 3 && found < 3; cx++) for (let cz = -3; cz <= 3 && found < 3; cz++) {
    for (let x = cx * 16; x < cx * 16 + 16; x++) for (let z = cz * 16; z < cz * 16 + 16; z++) {
      const d = w.decorationAt(x, z);
      if (!d || (d.kind !== 'oak' && d.kind !== 'spruce')) continue;
      if ((x & 15) !== 15) continue; // drzewo tuż przy wschodniej krawędzi
      w.ensureChunk(cx, cz); w.ensureChunk(cx + 1, cz);
      const shape = w.treeShape(x, z, d.kind);
      for (const s of shape) if (s[3] === B.LEAVES && s[0] === 1) {
        w.ensureChunk((x + s[0]) >> 4, (z + s[2]) >> 4);
        const id = w.get(x + s[0], d.y + s[1], z + s[2]);
        assert.ok(id !== B.AIR, 'brak liścia w sąsiednim chunku przy ' + (x + s[0]) + ',' + (d.y + s[1]) + ',' + (z + s[2]) + ' = ' + id);
      }
      found++;
    }
  }
  assert.ok(found > 0, 'nie znaleziono drzewa przy krawędzi');
});

test('biomy: w dużym obszarze występuje więcej niż jeden biom', () => {
  const w = gen(5); const set = new Set();
  for (let x = -600; x <= 600; x += 40) for (let z = -600; z <= 600; z += 40) set.add(w.biomeAt(x, z));
  assert.ok(set.size >= 3, 'biomy: ' + [...set]);
});

test('serialize/deserialize zachowuje zmiany gracza, także w chunkach ładowanych później', () => {
  const w = gen(5);
  w.set(3, 40, 3, B.WOOL_PINK);
  w.set(-20, 41, 37, B.GLASS);
  const y = w.surfaceY(10, 10);
  w.set(10, y, 10, B.AIR);
  const w2 = BC.World.deserialize(w.serialize());
  assert.equal(w2.chunks.size, 0, 'chunki leniwe');
  assert.equal(w2.get(3, 40, 3), B.AIR, 'przed ensure chunk nie istnieje');
  w2.ensureChunk(0, 0);
  assert.equal(w2.get(3, 40, 3), B.WOOL_PINK);
  assert.equal(w2.get(10, y, 10), B.AIR);
  w2.ensureChunk(-2, 2);
  assert.equal(w2.get(-20, 41, 37), B.GLASS);
  assert.deepEqual(w2.chunks.get('0,0'), w.chunks.get('0,0'));
  assert.equal(w2.serialize(), w.serialize());
});

test('stary zapis v1 jest odrzucany', () => {
  assert.throws(() => BC.World.deserialize(JSON.stringify({ v: 1, seed: 1, size: 128, height: 64, diffs: [] })));
});

test('growTree stawia pień i liście i zwraca chunki', () => {
  const w = empty();
  const keys = w.growTree(8, 10, 8, 'oak');
  assert.ok(keys.includes('0,0'));
  assert.equal(w.get(8, 10, 8), B.LOG);
  assert.equal(w.get(8, 13, 8), B.LOG);
  let leaves = 0;
  for (let x = 4; x < 13; x++) for (let z = 4; z < 13; z++) for (let y = 10; y < 22; y++) if (w.get(x, y, z) === B.LEAVES) leaves++;
  assert.ok(leaves > 20, 'liście ' + leaves);
  const w2 = empty(); w2.growTree(0, 10, 0, 'spruce');
  assert.equal(w2.get(0, 10, 0), B.LOG);
  assert.equal(w2.get(0, 16, 0), B.LOG);
});

test('findSpawn zwraca miejsce nad wodą', () => {
  const w = gen(5); const s = w.findSpawn(0, 0);
  assert.ok(w.terrainHeight(Math.floor(s.x), Math.floor(s.z)) > w.waterLevel);
});

test('onChange woła się przy set; świat gościa z serialize ma te same bloki', () => {
  const w = empty(); const seen = [];
  w.onChange = (x, y, z, id) => seen.push([x, y, z, id]);
  w.set(3, 10, 4, B.BRICK);
  w.set(3, 10, 4, B.BRICK);
  assert.deepEqual(seen, [[3, 10, 4, B.BRICK]]);
  const g = BC.World.deserialize(w.serialize()); g.ensureChunk(0, 0);
  assert.equal(g.get(3, 10, 4), B.BRICK);
});
