const test = require('node:test');
const assert = require('node:assert');
const BC = require('../src/noise.js');

test('ten sam seed daje te same wartości', () => {
  const a = BC.Noise.create(42), b = BC.Noise.create(42);
  for (let i = 0; i < 50; i++) {
    const x = i * 0.37, y = i * 1.13;
    assert.equal(a.noise2(x, y), b.noise2(x, y));
    assert.equal(a.fbm(x, y, 4), b.fbm(x, y, 4));
    assert.equal(a.hash2(i, i * 3), b.hash2(i, i * 3));
  }
});

test('różny seed daje inne wartości', () => {
  const a = BC.Noise.create(1), b = BC.Noise.create(2);
  let diff = 0;
  for (let i = 0; i < 50; i++) if (a.noise2(i * 0.5, i * 0.7) !== b.noise2(i * 0.5, i * 0.7)) diff++;
  assert.ok(diff > 40);
});

test('zakres noise2 i fbm w [-1,1], hash2 w [0,1)', () => {
  const n = BC.Noise.create(7);
  for (let i = 0; i < 2000; i++) {
    const x = (i % 97) * 0.31, y = (i % 89) * 0.53;
    const v = n.noise2(x, y), f = n.fbm(x, y, 5), h = n.hash2(i, i * 7);
    assert.ok(v >= -1 && v <= 1, 'noise2 ' + v);
    assert.ok(f >= -1 && f <= 1, 'fbm ' + f);
    assert.ok(h >= 0 && h < 1, 'hash2 ' + h);
  }
});

test('szum jest ciągły (sąsiednie punkty mają bliskie wartości)', () => {
  const n = BC.Noise.create(3);
  for (let i = 0; i < 200; i++) {
    const x = i * 0.1;
    assert.ok(Math.abs(n.noise2(x, 0.5) - n.noise2(x + 0.01, 0.5)) < 0.1);
  }
});

test('hash2 ma dużo różnych wartości (nie 256)', () => {
  const n = BC.Noise.create(5); const set = new Set();
  for (let x = 0; x < 100; x++) for (let z = 0; z < 100; z++) set.add(n.hash2(x, z));
  assert.ok(set.size > 9000, 'różnych: ' + set.size);
  let low = 0; for (let x = 0; x < 200; x++) for (let z = 0; z < 200; z++) if (n.hash2(x, z) < 0.006) low++;
  assert.ok(low > 100 && low < 400, 'rzadkie zdarzenia: ' + low);
});
