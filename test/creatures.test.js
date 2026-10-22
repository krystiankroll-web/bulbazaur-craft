const test = require('node:test');
const assert = require('node:assert');
const BC = require('../src/creatures.js');
const C = BC.Creatures, B = BC.Blocks;

function flat(w0) {
  const w = w0 || new BC.World({ terrain: false, height: 16 });
  for (const [cx, cz] of [[0, 0], [-1, 0], [0, -1], [-1, -1]]) w.ensureChunk(cx, cz);
  for (let x = -12; x < 14; x++) for (let z = -12; z < 14; z++) w.set(x, 1, z, B.STONE);
  return w;
}
const one = (p) => ({ players: [p], rand: () => 0.5 });

test('cieniak idzie do gracza i skacze, gdy ściana go blokuje', () => {
  const w = flat();
  for (let z = -2; z <= 2; z++) w.set(3, 2, z, B.STONE);
  const m = C.make('cieniak', 0.5, 2, 0.5);
  let jumped = false; const start = m.body.pos.x;
  for (let i = 0; i < 240; i++) { C.step(m, w, one({ x: 6.5, y: 2, z: 0.5 }), 1 / 60); if (m.body.vel.y > 1) jumped = true; }
  assert.ok(m.body.pos.x > start + 1);
  assert.ok(jumped);
});

test('cieniak atakuje co 1 s i ginie po 6 hp', () => {
  const w = new BC.World({ terrain: false, height: 16 }); w.ensureChunk(0, 0);
  const m = C.make('cieniak', 0.5, 0, 0.5); m.attackCd = 0;
  const ctx = one({ x: 1.2, y: 0, z: 0.5 });
  const atk = () => C.step(m, w, ctx, 1 / 60).some(e => e.type === 'attack');
  assert.equal(atk(), true);
  for (let i = 0; i < 59; i++) assert.equal(atk(), false);
  assert.equal(atk(), true);
  assert.equal(C.hit(m, 4), false);
  assert.equal(C.hit(m, 2), true);
});

test('promień trafia stworzenie', () => {
  const m = C.make('cieniak', 5, 0, 0);
  const d = C.rayHit(m, { x: 0, y: 1, z: 0 }, { x: 1, y: 0, z: 0 }, 10);
  assert.ok(d !== null && d > 4.6 && d < 4.8);
  assert.equal(C.rayHit(m, { x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 1 }, 10), null);
  assert.equal(C.rayHit(m, { x: 0, y: 1, z: 0 }, { x: 1, y: 0, z: 0 }, 3), null);
});

test('atak trafia najbliższego z dwóch graczy', () => {
  const w = new BC.World({ terrain: false, height: 16 }); w.ensureChunk(0, 0);
  const m = C.make('cieniak', 4.5, 0, 0.5); m.attackCd = 0;
  const ev = C.step(m, w, { players: [{ x: 12, y: 0, z: 0.5 }, { x: 5.4, y: 0, z: 0.5 }] }, 1 / 60);
  assert.deepEqual(ev.find(e => e.type === 'attack'), { type: 'attack', target: 1, dmg: 2 });
});

test('losowanie potworów wg wag 40/25/20/15', () => {
  assert.equal(C.pickHostile(() => 0.0), 'cieniak');
  assert.equal(C.pickHostile(() => 0.41), 'skoczek');
  assert.equal(C.pickHostile(() => 0.66), 'kolczak');
  assert.equal(C.pickHostile(() => 0.9), 'wybuchacz');
});
