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

test('skoczek skacze do gracza i dzieli się na dwa małe', () => {
  const w = flat();
  const s = C.make('skoczek', 0.5, 2, 0.5); s.hopCd = 0;
  let hops = 0;
  for (let i = 0; i < 180; i++) hops += C.step(s, w, one({ x: 8.5, y: 2, z: 0.5 }), 1 / 60).filter(e => e.type === 'hop').length;
  assert.ok(hops >= 2); assert.ok(s.body.pos.x > 2);
  C.hit(s, 8);
  const kids = C.children(s);
  assert.equal(kids.length, 2); assert.equal(kids[0].type, 'skoczek_maly');
  C.hit(kids[0], 2); assert.deepEqual(C.children(kids[0]), []);
});

test('kolczak trzyma dystans i strzela co 2,5 s', () => {
  const w = flat();
  const k = C.make('kolczak', 2.5, 2, 0.5); k.shootCd = 0;
  const p = { x: 0.5, y: 2, z: 0.5 };
  const ev = C.step(k, w, one(p), 1 / 60);
  const sh = ev.find(e => e.type === 'shoot');
  assert.ok(sh && sh.dir.x < 0);
  for (let i = 0; i < 120; i++) assert.ok(!C.step(k, w, one(p), 1 / 60).some(e => e.type === 'shoot'));
  for (let i = 0; i < 240; i++) C.step(k, w, one(p), 1 / 60);
  assert.ok(k.body.pos.x > 5, 'odsuwa się od gracza');
});

test('kolec trafia gracza, a blok go zatrzymuje', () => {
  const w = flat();
  const s = C.makeSpike({ x: 0.5, y: 3, z: 0.5 }, { x: 1, y: 0, z: 0 });
  let r; for (let i = 0; i < 60 && !(r && r.done); i++) r = C.stepSpike(s, w, [{ x: 5.5, y: 2, z: 0.5 }], 1 / 60);
  assert.equal(r.hit, 0);
  w.set(3, 3, 0, B.STONE);
  const s2 = C.makeSpike({ x: 0.5, y: 3, z: 0.5 }, { x: 1, y: 0, z: 0 });
  for (let i = 0; i < 60 && !(r = C.stepSpike(s2, w, [{ x: 5.5, y: 2, z: 0.5 }], 1 / 60)).done; i++);
  assert.equal(r.done, true);
  assert.equal(r.hit, undefined);
});

test('wybuchacz: syczy przy graczu, przerywa gdy gracz ucieknie, wybucha po 1,5 s', () => {
  const w = flat();
  const x = C.make('wybuchacz', 0.5, 2, 0.5);
  const near = one({ x: 2, y: 2, z: 0.5 }), far = one({ x: 6, y: 2, z: 0.5 });
  assert.ok(C.step(x, w, near, 1 / 60).some(e => e.type === 'hiss'));
  C.step(x, w, far, 1 / 60); assert.equal(x.fuseT, null);
  C.step(x, w, near, 1 / 60);
  let boom = null;
  for (let i = 0; i < 100 && !boom; i++) boom = C.step(x, w, near, 1 / 60).find(e => e.type === 'explode');
  assert.ok(boom); assert.equal(x.dead, true); assert.equal(boom.r, 2.5);
  assert.deepEqual(C.children(x), []);
});

test('wybuch: bloki w kuli bez skały macierzystej i wody; obrażenia maleją z odległością', () => {
  const w = flat();
  w.set(0, 3, 0, B.WATER);
  const list = C.blastBlocks(w, 0.5, 2.5, 0.5, 2.5);
  assert.ok(list.some(([x, y, z]) => y === 1));
  assert.ok(!list.some(([x, y, z]) => y === 0));
  assert.ok(!list.some(([x, y, z]) => x === 0 && y === 3 && z === 0));
  assert.equal(C.blastDamage(0), 7); assert.equal(C.blastDamage(2), 3); assert.equal(C.blastDamage(4), 0);
});
