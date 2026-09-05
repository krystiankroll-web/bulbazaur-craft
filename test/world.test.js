const test = require('node:test');
const assert = require('node:assert');
const BC = require('../src/world.js');
const B = BC.Blocks;

function small() { return new BC.World({ seed: 5, size: 32, height: 64 }); }

test('get/set round-trip i AIR poza granicami', () => {
  const w = small();
  assert.equal(w.get(5, 10, 5), B.AIR);
  w.set(5, 10, 5, B.STONE);
  assert.equal(w.get(5, 10, 5), B.STONE);
  assert.equal(w.get(-1, 10, 5), B.AIR);
  assert.equal(w.get(5, 100, 5), B.AIR);
  assert.equal(w.get(32, 10, 5), B.AIR);
});

test('set poza granicami i na y=0 to no-op', () => {
  const w = small();
  assert.deepEqual(w.set(40, 5, 5, B.STONE), []);
  assert.deepEqual(w.set(5, 0, 5, B.STONE), []);
  assert.equal(w.get(5, 0, 5), B.AIR);
});

test('set zwraca chunk + sąsiada na krawędzi', () => {
  const w = small();
  assert.deepEqual(w.set(5, 5, 5, B.STONE), ['0,0']);
  assert.deepEqual(w.set(16, 5, 5, B.STONE).sort(), ['0,0', '1,0']);
  assert.deepEqual(w.set(5, 5, 15, B.STONE).sort(), ['0,0', '0,1']);
  assert.deepEqual(w.set(5, 5, 15, B.STONE), [], 'ten sam blok = brak zmian');
});

test('po generate powierzchnia to trawa/piasek/woda, bedrock na dnie', () => {
  const w = small().generate();
  let water = 0, logs = 0, grass = 0;
  for (let x = 0; x < 32; x++) for (let z = 0; z < 32; z++) {
    assert.equal(w.get(x, 0, z), B.BEDROCK);
    let y = 63; while (y > 0 && w.get(x, y, z) === B.AIR) y--;
    const top = w.get(x, y, z);
    assert.ok([B.GRASS, B.SAND, B.WATER, B.LEAVES, B.LOG, B.FLOWER].includes(top), 'blok ' + top + ' na ' + x + ',' + z);
    for (let yy = 0; yy <= y; yy++) {
      const id = w.get(x, yy, z);
      if (id === B.WATER) water++; if (id === B.LOG) logs++; if (id === B.GRASS) grass++;
    }
  }
  assert.ok(grass > 100, 'trawa ' + grass);
  assert.ok(water > 0, 'brak wody');
  assert.ok(logs > 0, 'brak drzew');
});

test('generate jest deterministyczne', () => {
  const a = small().generate(), b = small().generate();
  for (let i = 0; i < a.chunks.length; i++) assert.deepEqual(a.chunks[i], b.chunks[i]);
});

test('serialize/deserialize zachowuje zmiany gracza', () => {
  const w = small().generate();
  w.set(3, 40, 3, B.WOOL_PINK);
  w.set(4, 41, 3, B.GLASS);
  const y = w.surfaceY(10, 10);
  w.set(10, y, 10, B.AIR);
  const w2 = BC.World.deserialize(w.serialize());
  assert.equal(w2.get(3, 40, 3), B.WOOL_PINK);
  assert.equal(w2.get(4, 41, 3), B.GLASS);
  assert.equal(w2.get(10, y, 10), B.AIR);
  for (let i = 0; i < w.chunks.length; i++) assert.deepEqual(w2.chunks[i], w.chunks[i]);
});

test('growTree stawia pień i liście i zwraca chunki', () => {
  const w = small();
  const keys = w.growTree(8, 10, 8);
  assert.ok(keys.includes('0,0'));
  assert.equal(w.get(8, 10, 8), B.LOG);
  assert.equal(w.get(8, 13, 8), B.LOG);
  let leaves = 0;
  for (let x = 4; x < 13; x++) for (let z = 4; z < 13; z++) for (let y = 10; y < 20; y++) if (w.get(x, y, z) === B.LEAVES) leaves++;
  assert.ok(leaves > 20, 'liście ' + leaves);
});
