const test = require('node:test');
const assert = require('node:assert');
const BC = require('../src/raycast.js');
const B = BC.Blocks;
function empty() { return new BC.World({ seed: 1, size: 32, height: 32 }); }

test('promień w dół trafia blok pod nogami, normalna do góry', () => {
  const w = empty(); w.set(10, 5, 10, B.STONE);
  const r = BC.Raycast.cast(w, { x: 10.5, y: 8, z: 10.5 }, { x: 0, y: -1, z: 0 }, 10);
  assert.equal(r.hit, true);
  assert.deepEqual([r.x, r.y, r.z], [10, 5, 10]);
  assert.deepEqual([r.nx, r.ny, r.nz], [0, 1, 0]);
  assert.ok(Math.abs(r.dist - 2) < 1e-9);
});

test('promień w pustkę nie trafia', () => {
  const w = empty();
  const r = BC.Raycast.cast(w, { x: 10.5, y: 8, z: 10.5 }, { x: 1, y: 0, z: 0 }, 6);
  assert.equal(r.hit, false);
});

test('promień w bok trafia najbliższy blok z poprawną normalną', () => {
  const w = empty(); w.set(14, 8, 10, B.STONE); w.set(12, 8, 10, B.STONE);
  const r = BC.Raycast.cast(w, { x: 10.5, y: 8.5, z: 10.5 }, { x: 1, y: 0, z: 0 }, 6);
  assert.deepEqual([r.x, r.y, r.z], [12, 8, 10]);
  assert.deepEqual([r.nx, r.ny, r.nz], [-1, 0, 0]);
});

test('promień skośny omija wodę i trafia ziemię', () => {
  const w = empty();
  for (let x = 0; x < 32; x++) for (let z = 0; z < 32; z++) { w.set(x, 4, z, B.DIRT); w.set(x, 5, z, B.WATER); }
  const r = BC.Raycast.cast(w, { x: 10.5, y: 9, z: 10.5 }, { x: 0.5, y: -1, z: 0.3 }, 12);
  assert.equal(r.hit, true);
  assert.equal(r.id, B.DIRT);
  assert.equal(r.y, 4);
});

test('zasięg ogranicza trafienie', () => {
  const w = empty(); w.set(20, 8, 10, B.STONE);
  const r = BC.Raycast.cast(w, { x: 10.5, y: 8.5, z: 10.5 }, { x: 1, y: 0, z: 0 }, 5);
  assert.equal(r.hit, false);
});
