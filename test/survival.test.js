const test = require('node:test');
const assert = require('node:assert');
const BC = require('../src/survival.js');
const S = BC.Survival, B = BC.Blocks;

test('głód spada o 1 co 40 s, szybciej przy biegu', () => {
  const st = S.makeStats();
  S.tickStats(st, 39, {});
  assert.equal(st.food, 20);
  S.tickStats(st, 1, {});
  assert.equal(st.food, 19);
  const st2 = S.makeStats();
  S.tickStats(st2, 20, { sprinting: true });
  assert.equal(st2.food, 19);
});

test('regeneracja tylko przy jedzeniu >= 14, głód nie zabija', () => {
  const st = S.makeStats();
  st.hp = 10; st.food = 14;
  const ev = S.tickStats(st, 4, {});
  assert.equal(st.hp, 11);
  assert.ok(ev.includes('regen'));
  st.food = 13; st.hp = 10;
  S.tickStats(st, 10, {});
  assert.equal(st.hp, 10);
  st.food = 0; st.hp = 4;
  for (let i = 0; i < 20; i++) S.tickStats(st, 6, {});
  assert.equal(st.hp, S.STARVE_MIN_HP);
});

test('tonięcie: 10 s powietrza, potem 2 hp/s; Squirtle nie tonie', () => {
  const st = S.makeStats();
  for (let i = 0; i < 20; i++) S.tickStats(st, 0.5, { underwater: true });
  assert.equal(st.air, 0);
  assert.equal(st.hp, 20);
  let ev = [];
  for (let i = 0; i < 2; i++) ev = ev.concat(S.tickStats(st, 0.5, { underwater: true }));
  assert.equal(st.hp, 18);
  assert.ok(ev.includes('drown'));
  S.tickStats(st, 5, { underwater: false });
  assert.equal(st.air, 10);
  const sq = S.makeStats();
  S.tickStats(sq, 30, { underwater: true, noDrown: true });
  assert.equal(sq.hp, 20);
});

test('obrażenia od upadku i śmierć', () => {
  assert.equal(S.fallDamage(3), 0);
  assert.equal(S.fallDamage(5.5), 0);
  assert.equal(S.fallDamage(6), 1);
  assert.equal(S.fallDamage(10), 5);
  const st = S.makeStats();
  assert.equal(S.damage(st, 19), false);
  assert.equal(S.damage(st, 5), true);
  assert.equal(st.hp, 0);
  S.respawn(st);
  assert.equal(st.hp, 20);
});

test('ekwipunek: dodawanie, zdejmowanie, jedzenie jabłek', () => {
  const inv = S.makeInv();
  assert.equal(S.invCount(inv, B.APPLE), 3);
  S.invAdd(inv, B.DIRT, 2);
  assert.equal(S.invTake(inv, B.DIRT, 3), false);
  assert.equal(S.invTake(inv, B.DIRT, 2), true);
  assert.equal(S.invCount(inv, B.DIRT), 0);
  const st = S.makeStats(); st.food = 10;
  assert.equal(S.eat(st, inv), true);
  assert.equal(st.food, 16);
  assert.equal(S.invCount(inv, B.APPLE), 2);
  st.food = 20;
  assert.equal(S.eat(st, inv), false);
});

test('dropy: trawa daje ziemię, kamień bruk, woda nic, liście czasem jabłko', () => {
  assert.equal(S.dropFor(B.GRASS, () => 0), B.DIRT);
  assert.equal(S.dropFor(B.STONE, () => 0), B.COBBLE);
  assert.equal(S.dropFor(B.WATER, () => 0), null);
  assert.equal(S.dropFor(B.PLANKS, () => 0), B.PLANKS);
  assert.equal(S.dropFor(B.LEAVES, () => 0.1), B.APPLE);
  assert.equal(S.dropFor(B.LEAVES, () => 0.3), B.SAPLING);
  assert.equal(S.dropFor(B.LEAVES, () => 0.9), null);
});

test('warsztat: pień -> 4 deski, brak surowca = false', () => {
  const inv = {};
  assert.equal(S.craft(inv, 0), false);
  S.invAdd(inv, B.LOG, 1);
  assert.equal(S.craft(inv, 0), true);
  assert.equal(S.invCount(inv, B.PLANKS), 4);
  assert.equal(S.invCount(inv, B.LOG), 0);
});

test('cykl dnia: południe jasno, północ ciemno, numer dnia', () => {
  const D = S.DAY_LENGTH;
  assert.ok(S.sunLight(D * 0.25) > 0.95);
  assert.equal(S.sunLight(D * 0.75), 0);
  assert.ok(!S.isNight(D * 0.25));
  assert.ok(S.isNight(D * 0.75));
  assert.equal(S.dayNumber(0), 1);
  assert.equal(S.dayNumber(D * 2.5), 3);
});

test('potwór idzie do gracza i skacze, gdy ściana go blokuje', () => {
  const w = new BC.World({ terrain: false, height: 16 });
  w.ensureChunk(0, 0); w.ensureChunk(-1, 0); w.ensureChunk(0, -1); w.ensureChunk(-1, -1);
  // podłoga z kamienia na y=1 (y=0 to skała, set jest tam ignorowany), ściana na x=3 o wysokości 1.
  for (let x = -2; x < 10; x++) for (let z = -2; z <= 2; z++) w.set(x, 1, z, B.STONE);
  for (let z = -2; z <= 2; z++) w.set(3, 2, z, B.STONE);
  const m = S.makeMonster(0.5, 2, 0.5);
  const target = { x: 6.5, y: 2, z: 0.5 };
  let jumped = false, start = m.body.pos.x;
  for (let i = 0; i < 240; i++) {
    S.monsterStep(m, w, target, 1 / 60);
    if (m.body.vel.y > 1) jumped = true;
  }
  assert.ok(m.body.pos.x > start + 1, 'potwór powinien się zbliżyć');
  assert.ok(jumped, 'potwór powinien skoczyć przy ścianie');
});

test('potwór atakuje z cooldownem 1 s i ginie po 6 hp', () => {
  const w = new BC.World({ terrain: false, height: 16 });
  w.ensureChunk(0, 0);
  const m = S.makeMonster(0.5, 0, 0.5);
  m.attackCd = 0;
  const t = { x: 1.2, y: 0, z: 0.5 };
  assert.equal(S.monsterStep(m, w, t, 1 / 60).attack, true);
  assert.equal(S.monsterStep(m, w, t, 1 / 60).attack, false);
  for (let i = 0; i < 58; i++) assert.equal(S.monsterStep(m, w, t, 1 / 60).attack, false);
  assert.equal(S.monsterStep(m, w, t, 1 / 60).attack, true);
  assert.equal(S.monsterHit(m, 4), false);
  assert.equal(S.monsterHit(m, 2), true);
});

test('promień trafia potwora', () => {
  const m = S.makeMonster(5, 0, 0);
  const d = S.rayHitsMonster(m, { x: 0, y: 1, z: 0 }, { x: 1, y: 0, z: 0 }, 10);
  assert.ok(d !== null && d > 4.6 && d < 4.8);
  assert.equal(S.rayHitsMonster(m, { x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 1 }, 10), null);
  assert.equal(S.rayHitsMonster(m, { x: 0, y: 1, z: 0 }, { x: 1, y: 0, z: 0 }, 3), null);
});
