const test = require('node:test');
const assert = require('node:assert');
const BC = require('../src/netproto.js');
const P = BC.NetProto, C = BC.Creatures;

test('kod pokoju: 4 znaki z bezpiecznego alfabetu, normalizacja wpisu', () => {
  let i = 0; const seq = [0, 0.5, 0.99, 0.25];
  const code = P.makeCode(() => seq[i++]);
  assert.equal(code.length, 4);
  for (const ch of code) assert.ok(P.ALPHABET.includes(ch));
  assert.equal(P.normCode(' kot7 '), 'KOT7');
  assert.equal(P.normCode('KO0'), null);
  assert.equal(P.normCode('OKO1'), null);
  assert.equal(P.peerId('KOT7'), 'bulbazaurcraft-kot7');
});

test('stworzenia: pakowanie i rozpakowanie', () => {
  const k = C.make('krowa', 1.234, 20, -3.5); k.shornT = 0; k.hurtT = 0.2;
  const o = C.make('owca', 0, 20, 0); o.shornT = 50;
  const w = C.make('wybuchacz', 2, 20, 2); w.fuseT = 0.75; w.burning = 0.3;
  const out = P.unpackCreatures(P.packCreatures([k, o, w]));
  assert.deepEqual(out.map(c => c.type), ['krowa', 'owca', 'wybuchacz']);
  assert.equal(out[0].x, 1.23); assert.equal(out[0].hurt, true); assert.equal(out[0].shorn, false);
  assert.equal(out[1].shorn, true);
  assert.equal(out[2].fuseT, 0.75); assert.equal(out[2].burning, true);
  assert.equal(out[0].fuseT, null);
  assert.equal(out[0].id, k.id);
});

test('wygładzanie ruchu i kąta', () => {
  assert.equal(P.approach(0, 10, 1, 100), 10);
  assert.ok(Math.abs(P.approach(0, 10, 0.05, 10) - 5) < 1e-9);
  const a = P.approachAngle(3.0, -3.0, 1, 100);
  assert.ok(Math.abs(Math.abs(a) - 3.0) < 1e-9, 'idzie krótszą drogą przez ±π');
});
