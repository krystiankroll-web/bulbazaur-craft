const test = require('node:test');
const assert = require('node:assert');
const BC = require('../src/mesher.js');
const B = BC.Blocks;
const atlas = { uv: (i) => [i / 32, 0, (i + 1) / 32, 1] };
function empty() { return new BC.World({ seed: 1, terrain: false, height: 32 }); }

test('pojedynczy kamień = 6 ścian', () => {
  const w = empty(); w.set(5, 5, 5, B.STONE);
  const m = BC.Mesher.buildChunk(w, 0, 0, atlas);
  assert.equal(m.opaque.count, 24);
  assert.equal(m.opaque.indices.length, 36);
  assert.equal(m.opaque.positions.length, 72);
  assert.equal(m.opaque.normals.length, 72);
  assert.equal(m.opaque.uvs.length, 48);
  assert.equal(m.opaque.colors.length, 72);
  assert.equal(m.transparent.count, 0);
});

test('dwa sąsiednie kamienie = 10 ścian', () => {
  const w = empty(); w.set(5, 5, 5, B.STONE); w.set(6, 5, 5, B.STONE);
  const m = BC.Mesher.buildChunk(w, 0, 0, atlas);
  assert.equal(m.opaque.count, 40);
});

test('ściana na granicy chunku uwzględnia sąsiedni chunk', () => {
  const w = empty(); w.set(15, 5, 5, B.STONE); w.set(16, 5, 5, B.STONE);
  const m = BC.Mesher.buildChunk(w, 0, 0, atlas);
  assert.equal(m.opaque.count, 20, 'jedna ściana ukryta przez blok z chunku 1,0');
});

test('kwiat = 2 skrzyżowane quady w transparent', () => {
  const w = empty(); w.set(5, 5, 5, B.FLOWER);
  const m = BC.Mesher.buildChunk(w, 0, 0, atlas);
  assert.equal(m.opaque.count, 0);
  assert.equal(m.transparent.count, 8);
  assert.equal(m.transparent.indices.length, 12);
});

test('woda obok wody nie rysuje ściany między nimi, szkło obok wody tak', () => {
  const w = empty(); w.set(5, 5, 5, B.WATER); w.set(6, 5, 5, B.WATER);
  let m = BC.Mesher.buildChunk(w, 0, 0, atlas);
  assert.equal(m.transparent.count, 40);
  w.set(6, 5, 5, B.GLASS);
  m = BC.Mesher.buildChunk(w, 0, 0, atlas);
  assert.equal(m.transparent.count, 48);
});

test('kamień pod trawą: ściana górna kamienia ukryta, trawa ma inne UV na górze i boku', () => {
  const w = empty(); w.set(5, 5, 5, B.STONE); w.set(5, 6, 5, B.GRASS);
  const m = BC.Mesher.buildChunk(w, 0, 0, atlas);
  assert.equal(m.opaque.count, 40);
  const uvs = new Set();
  for (let i = 0; i < m.opaque.uvs.length; i += 2) uvs.add(m.opaque.uvs[i].toFixed(4));
  assert.ok(uvs.size >= 4, 'różne kafle użyte');
});

test('cieniowanie: góra 1.0, dół ciemniejszy', () => {
  const w = empty(); w.set(5, 5, 5, B.STONE);
  const m = BC.Mesher.buildChunk(w, 0, 0, atlas);
  const shades = new Set(m.opaque.colors.filter((_, i) => i % 3 === 0));
  assert.ok(shades.has(1) && shades.has(0.55));
});
