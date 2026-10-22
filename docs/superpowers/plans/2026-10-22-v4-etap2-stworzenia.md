# v4 Etap 2 — zwierzątka i potwory: plan wdrożenia

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 4 łagodne zwierzątka (krowa, owca, kurczak, świnka) w obu trybach i 3 nowe potwory nocne (Skoczek, Kolczak, Wybuchacz) obok Cieniaka.

**Architecture:** Cała logika stworzeń w nowym `src/creatures.js` (czysta, Node) — typy, AI, głaskanie, kolce, wybuch. `src/creaturemodels.js` rysuje modele Three.js. `src/monsters.js` zostaje menedżerem (`BC.Monsters`): spawn, lista, przedmioty na ziemi, kolce, wybuchy, serduszka. AI przyjmuje **listę graczy** (`ctx.players`), żeby etap 3 (gra we dwoje) nie wymagał przeróbek.

**Tech Stack:** vanilla JS (IIFE na `BC`), Three.js r160, `node --test`.

**Spec:** `docs/superpowers/specs/2026-10-22-bulbazaur-craft-v4-design.md` (sekcja „Etap 2”)

## Global Constraints
- Styl repo: `var`, IIFE, komentarze po polsku; moduły czyste mają nagłówek `var BC = (typeof window ...)` i `module.exports = BC`.
- Modele: przód stworzenia = **+z**, `mesh.rotation.y = c.yaw`, `c.yaw = Math.atan2(dirX, dirZ)`.
- Potwory tylko w Przetrwaniu nocą; zwierzątka w obu trybach, spawn w dzień.
- Limity: zwierzątka 10 (telefon 6), potwory 6 (telefon 4).
- Po zmianach plików gry podbić `CACHE` w `sw.js` i dopisać nowe pliki do `FILES`.
- `node --test test/*.test.js` zawsze zielone.

---

### Task 1: Mleko i jajko, jedzenie trzech rodzajów

**Files:** Modify `src/blocks.js`, `src/textures.js`, `src/survival.js`, `src/hud.js`, `src/player.js` (`Player.eat`); Test `test/survival.test.js`, `test/blocks.test.js`

**Produces:** `B.MILK = 29`, `B.EGG = 30`; `T.MILK = 32`, `T.EGG = 33`; `BC.Textures.COUNT = 34`; `S.FOODS = [[B.APPLE, 6], [B.MILK, 4], [B.EGG, 3]]`; `S.eat(st, inv) → id zjedzonego | false` (wybiera rodzaj, którego jest najwięcej; remis → kolejność z `S.FOODS`); `S.hasFood(inv) → bool`.

- [ ] **Step 1: test**

```js
test('jedzenie: jabłko 6, mleko 4, jajko 3; je to, czego najwięcej', () => {
  const inv = {}; S.invAdd(inv, B.EGG, 2); S.invAdd(inv, B.MILK, 1);
  const st = S.makeStats(); st.food = 5;
  assert.equal(S.eat(st, inv), B.EGG);
  assert.equal(st.food, 8);
  assert.equal(S.eat(st, inv), B.MILK);   // remis 1:1 → kolejność S.FOODS
  assert.equal(st.food, 12);
  assert.equal(S.hasFood(inv), true);
  assert.equal(S.eat(st, inv), B.EGG);
  assert.equal(S.hasFood(inv), false);
  assert.equal(S.eat(st, inv), false);
});
```
W istniejącym teście „ekwipunek…” zmienić `assert.equal(S.eat(st, inv), true)` na `assert.equal(S.eat(st, inv), B.APPLE)`. W `test/blocks.test.js` dodać: `MILK` i `EGG` mają `item: true`, `placeable: false`.

- [ ] **Step 2:** FAIL. **Step 3: implementacja**

`blocks.js`: `TORCH: 27, APPLE: 28, MILK: 29, EGG: 30`; `T`: `APPLE: 31, MILK: 32, EGG: 33`;
```js
  BlockInfo[Blocks.MILK] = def('Mleko', { solid: false, transparent: true, placeable: false, item: true, drop: null, tex: uni(T.MILK) });
  BlockInfo[Blocks.EGG] = def('Jajko', { solid: false, transparent: true, placeable: false, item: true, drop: null, tex: uni(T.EGG) });
```
`textures.js`: `COUNT = 34`, painters: mleko = biała butelka z niebieską etykietą, jajko = kremowy owal.
`survival.js`:
```js
  S.FOODS = [[B.APPLE, S.APPLE_FOOD], [B.MILK, 4], [B.EGG, 3]];
  S.hasFood = function (inv) { return S.FOODS.some(function (f) { return (inv[f[0]] || 0) > 0; }); };
  S.eat = function (st, inv) {
    if (st.food >= S.MAX_FOOD) return false;
    var best = null;
    S.FOODS.forEach(function (f) { var n = inv[f[0]] || 0; if (n > 0 && (!best || n > (inv[best[0]] || 0))) best = f; });
    if (!best) return false;
    S.invTake(inv, best[0], 1);
    st.food = Math.min(S.MAX_FOOD, st.food + best[1]);
    return best[0];
  };
```
`hud.js` → `#apples`: `'🍎 ' + a + (milk ? '  🥛 ' + milk : '') + (egg ? '  🥚 ' + egg : '')`.
`player.js` → `Player.eat`: komunikat braku „Nie masz jedzenia. Szukaj jabłek w liściach!”; po zjedzeniu „Mniam! (” + nazwa + „)”.

- [ ] **Step 4:** PASS. **Step 5:** commit `feat: milk and egg food items`.

### Task 2: `creatures.js` — rdzeń i przeniesiony Cieniak

**Files:** Create `src/creatures.js`, `test/creatures.test.js`; Modify `src/survival.js` (usunąć `MONSTER_*`, `makeMonster`, `monsterStep`, `monsterHit`, `rayHitsMonster`), `test/survival.test.js` (usunąć 3 testy potwora), `src/monsters.js`, `src/player.js`, `index.html` (`<script src="src/creatures.js">` po `survival.js`).

**Produces (`BC.Creatures`, dalej `C`):**
- `C.TYPES[type]` — `{ hostile, hp, w, h, speed, dmg, sight, reach, weight, name, … }`
- `C.make(type, x, y, z, rand?) → c` — `{ id, type, hostile, body, hp, dead, hurtT, attackCd, phase, yaw, burning }`
- `C.nearest(c, players) → { i, p, dist, dist3 } | null` (players: `[{x,y,z}]`, pozycja stóp)
- `C.step(c, world, ctx, dt) → [zdarzenia]`; `ctx = { players, rand? }`; zdarzenie ataku `{ type: 'attack', target: i, dmg }`
- `C.hit(c, dmg, knock?) → bool` (pokonany); zwierzątek nie rani (zwraca false, hp bez zmian)
- `C.rayHit(c, origin, dir, maxDist) → odległość | null`
- `C.pickHostile(rand) → type` wg wag 40/25/20/15

- [ ] **Step 1: test** `test/creatures.test.js` — przeniesione 3 testy potwora w nowym API:

```js
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
```

- [ ] **Step 2:** FAIL. **Step 3:** `src/creatures.js` — nagłówek modułu czystego, `require('./physics.js')`, `C.TYPES` z wartościami ze spec (Cieniak 6/3.2/2/24/1.6, Skoczek 8 hp, Mały Skoczek 2 hp/1 dmg, Kolczak 6 hp, keep 8–14, co 2,5 s, Wybuchacz 5 hp, fuse 1,5 s, start ≤ 2, przerwanie > 4, r 2,5; zwierzątka hp 4–10, prędkość 1,3–1,5), `C.make`, `C.nearest`, `walk()` (ruch + skok przy blokadzie, logika 1:1 z dawnego `S.monsterStep`), `C.step` → `hostileStep` dla `cieniak` (pozostałe typy w Task 3/4), `C.hit`, `C.rayHit` (slab, 1:1 z `S.rayHitsMonster`), `C.pickHostile`.
- [ ] **Step 4:** `monsters.js` i `player.js` na nowe API bez zmiany zachowania: `S.makeMonster` → `C.make('cieniak', …)`, `S.monsterStep(m, world, target, dt)` → `C.step(m, world, { players: [target] }, dt)` i obsługa zdarzeń `attack`, `S.monsterHit` → `C.hit`, `S.rayHitsMonster` → `C.rayHit`, `M.onAttack(m, dmg)`; `player.js`: `Player.hurt(dmg, m.body.pos)`.
- [ ] **Step 5:** PASS (wszystkie testy), test dymny: nocą w Przetrwaniu `BC.Monsters.spawnAt(...)` tworzy Cieniaka, brak wyjątków. Commit `refactor: creatures module, Cieniak migrated`.

### Task 3: Nowe potwory — Skoczek, Kolczak, Wybuchacz, kolce, wybuch

**Files:** Modify `src/creatures.js`; Test `test/creatures.test.js`

**Produces:** zdarzenia `{type:'hop'}`, `{type:'shoot', from:{x,y,z}, dir:{x,y,z}}`, `{type:'hiss'}`, `{type:'explode', x, y, z, r}`; `C.children(c) → [c]` (Skoczek → 2 × `skoczek_maly`, nie po wybuchu); `C.makeSpike(from, dir) → s`; `C.stepSpike(s, world, players, dt) → { done, hit? }`; `C.blastBlocks(world, x, y, z, r) → [[x,y,z]]`; `C.blastDamage(dist) → int` = `max(0, round(7 − 2·dist))`.

- [ ] **Step 1: testy**

```js
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
```
- [ ] **Step 2:** FAIL. **Step 3:** w `hostileStep` gałęzie: `skoczek*` (ruch tylko skokami: na ziemi `vel.x = vel.z = 0`; gdy `hopCd ≤ 0` i gracz w zasięgu wzroku: `vel.y = 8`, poziomo `speed·1.4` w stronę gracza, zdarzenie `hop`), `kolczak` (`dist < keepMin` → odchodzi, `> keepMax` → podchodzi, w środku stoi; `shootCd` → `shoot` z wysokości `0.7·h` w punkt `gracz.y + 1`), `wybuchacz` (`fuseT`: start przy `dist3 ≤ 2` → `hiss`; `dist3 > 4` → `null`; w trakcie stoi; `fuseT ≥ 1.5` → `dead`, `exploded`, `explode` z `y + 0.8`). Atak wręcz tylko gdy `T.reach > 0`. `C.hit` przy śmierci zeruje `fuseT`. Kolce: krok co ≤ 0,25 kratki, blok stały → `done`, gracz (środek `y + 0.9`, promień 0,6) → `done, hit: i`, wiek > 2 s → `done`. `C.blastBlocks`: kula, pomija `AIR`, `WATER`, nie-`breakable`.
- [ ] **Step 4:** PASS. **Step 5:** commit `feat: Skoczek, Kolczak, Wybuchacz logic`.

### Task 4: Zwierzątka — wędrówka, głaskanie, produkty, podążanie

**Files:** Modify `src/creatures.js`; Test `test/creatures.test.js`

**Produces:** `C.ANIMALS = ['krowa','owca','kurczak','swinka']`; `C.FOLLOW_SECONDS = 20`; `C.pet(c, who) → id przedmiotu | null`; zdarzenie `{ type: 'lay', item, x, y, z }`; `C.safeAhead(world, x, y, z) → bool`; pola `c.followT`, `c.follow`, `c.shornT`, `c.productCd`, `c.layT`.

- [ ] **Step 1: testy**

```js
test('krowa daje mleko co 60 s, owca wełnę i łysieje na 120 s', () => {
  const w = flat();
  const k = C.make('krowa', 0.5, 2, 0.5);
  assert.equal(C.pet(k, 0), B.MILK);
  assert.equal(C.pet(k, 0), null);
  for (let i = 0; i < 61; i++) C.step(k, w, one({ x: 0.5, y: 2, z: 0.5 }), 1);
  assert.equal(C.pet(k, 0), B.MILK);
  const o = C.make('owca', 0.5, 2, 0.5);
  assert.equal(C.pet(o, 0), B.WOOL_WHITE);
  assert.ok(o.shornT > 0);
  assert.equal(C.pet(o, 0), null);
  for (let i = 0; i < 121; i++) C.step(o, w, one({ x: 0.5, y: 2, z: 0.5 }), 1);
  assert.equal(o.shornT, 0);
  assert.equal(C.pet(C.make('swinka', 0, 2, 0), 0), null);
});

test('pogłaskane zwierzątko idzie za graczem 20 s, potem przestaje', () => {
  const w = flat();
  const s = C.make('swinka', 0.5, 2, 0.5);
  C.pet(s, 1);
  const ctx = { players: [{ x: -9, y: 2, z: 0.5 }, { x: 9.5, y: 2, z: 0.5 }], rand: () => 0.5 };
  for (let i = 0; i < 300; i++) C.step(s, w, ctx, 1 / 60);
  assert.ok(s.body.pos.x > 3, 'idzie do gracza nr 1');
  for (let i = 0; i < 20 * 60; i++) C.step(s, w, ctx, 1 / 60);
  assert.equal(s.followT, 0);
});

test('kurczak znosi jajko, zwierzątka nie da się zranić', () => {
  const w = flat();
  const k = C.make('kurczak', 0.5, 2, 0.5); k.layT = 0.01;
  const ev = C.step(k, w, one({ x: 9, y: 2, z: 9 }), 1 / 60);
  assert.equal(ev.find(e => e.type === 'lay').item, B.EGG);
  assert.ok(k.layT >= 90 && k.layT <= 150);
  assert.equal(C.hit(k, 99), false); assert.equal(k.dead, false);
});

test('zwierzątko nie wchodzi do wody ani nad przepaść', () => {
  const w = flat();
  w.set(4, 1, 0, B.WATER);
  w.set(5, 1, 0, B.AIR);
  assert.equal(C.safeAhead(w, 2.5, 2, 0.5), true);
  assert.equal(C.safeAhead(w, 4.5, 2, 0.5), false);
  assert.equal(C.safeAhead(w, 5.5, 2, 0.5), true);   // dziura 1 kratka: y=0 skała → spadek 1
  assert.equal(C.safeAhead(w, 5.5, 6, 0.5), false);  // 4+ w dół → za głęboko
});
```
- [ ] **Step 2:** FAIL. **Step 3:** `animalStep`: liczniki (`productCd`, `shornT`, `followT`), podążanie (`followT > 0` → do gracza `c.follow`, gdy `2 < dist < 24`, prędkość ×1,6), inaczej wędrówka (`wanderT` 2–5 s, 60% idzie w losowym kierunku, `safeAhead` 0,9 kratki przed → stop i nowe losowanie), `walk()`, znoszenie (`layT` → `lay`, nowy czas `layMin + rand·(layMax − layMin)`). `C.pet` wg spec. `C.TYPES`: krowa `product: B.MILK, productCd: 60`; owca `product: B.WOOL_WHITE, shear: 120`; kurczak `lay: B.EGG, 90–150`; świnka `lay: B.APPLE, 120–240`.
- [ ] **Step 4:** PASS. **Step 5:** commit `feat: animals logic`.

### Task 5: Modele, menedżer, interakcje gracza, dźwięki — gra

**Files:** Create `src/creaturemodels.js`; Modify `src/monsters.js`, `src/player.js`, `src/main.js`, `src/audio.js`, `index.html`, `sw.js`, `README.md`

**Consumes:** całe API `C` z Task 2–4.
**Produces:** `BC.CreatureModels.make(type) → { group, parts, mats }`, `BC.CreatureModels.animate(c, model, t, extra)`; `BC.Monsters.update(dt, t, players, light, mode)` (players: tablica obiektów z `body`, pierwszy = lokalny gracz); `M.aim(...)` tylko wrogie; `M.aimAnimal(origin, dir, maxDist) → { c, dist } | null`; `M.pet(c)`; callbacki `M.onAttack(c, dmg)`, `M.onHurt(dmg, from)`, `M.onPickup(item)`.

- [ ] **Step 1:** `creaturemodels.js` — modele z pudełek (przód +z): Cieniak (jak dziś, oczy na +z), Skoczek (zielona półprzezroczysta kostka z oczami, mały = skala 0,55), Kolczak (zielony kaktusowy tułów z kolcami), Wybuchacz (pomarańczowo-czarny, miga na biało przy `fuseT`), Krowa (biało-czarna, różowy pysk), Owca (biała wełna, łysa = mniejszy różowy tułów), Kurczak (biały, czerwony grzebień, żółty dziób), Świnka (różowa). Animacja: nogi wg prędkości, skoczek „spłaszcza się” przy lądowaniu, płonięcie/trafienie jak dziś.
- [ ] **Step 2:** `monsters.js` — menedżer:
  - zwierzątka: dzień (`light > 0.45`), co 4 s próba spawnu grupki 2–4 jednego gatunku na trawie 24–40 kratek od gracza, limit 10/6, despawn > 64;
  - potwory: tylko `mode === 'survival'` i noc, `C.pickHostile`, reszta jak dziś (pochodnie, 16–32 kratki, limit, płonięcie o świcie — nie dotyczy zwierzątek);
  - zdarzenia `C.step`: `attack` → `M.onAttack`; `shoot` → kolec (`C.makeSpike` + mała zielona szpilka); `explode` → `C.blastBlocks` → `game.world.set` dla każdego + jedno `game.rebuildChunks`, obrażenia `C.blastDamage(odległość do gracza)` → `M.onHurt`, efekt kuli + dźwięk; `lay` → przedmiot na ziemi (mały obracający się sześcian z ikoną), zbierany ≤ 1,5 kratki → `M.onPickup`, znika po 300 s; `hop`/`hiss` → dźwięk;
  - śmierć: `C.children` dokładane do listy;
  - serduszka: 3 czerwone kosteczki unoszące się 0,8 s nad zwierzątkiem.
- [ ] **Step 3:** `player.js`:
  - `tapAction` i `primaryAction`: najpierw `M.aimAnimal(eye, lookDir, HIT_REACH)` (bliżej niż blok) → `Player.pet(c)`; potem jak dziś;
  - `Player.pet(c)`: `item = M.pet(c)`; w Przetrwaniu `S.invAdd` + komunikat „+1 Mleko” / „+1 Wełna biała”; w Kreatywnym komunikat imienia „Krowa ❤”;
  - `M.onPickup(item)`: Przetrwanie → do plecaka + komunikat; Kreatywny → tylko komunikat;
  - `M.onHurt` → `Player.hurt`; `onMonsterKilled` z nazwą typu („Skoczek pokonany!”).
- [ ] **Step 4:** `main.js`: `BC.Monsters.update(dt, t, [BC.Player], light, Game.mode)` w każdym trybie. `audio.js`: `pet`, `pop`, `hop`, `hiss`, `boom`, `shoot`, `moo`/`baa`/`cluck`/`oink` (krótkie syntezy jak istniejące). `index.html`: skrypty `creatures.js`, `creaturemodels.js`. `sw.js`: `CACHE = 'bc-v4b'` + nowe pliki. README: sekcja „Zwierzątka i potwory”.
- [ ] **Step 5:** testy Node + dymny headless Chrome (telefon): Kreatywny w dzień → po ~10 s są zwierzątka; `M.spawnAt` każdego typu i zrzut ekranu z modelami; głaskanie krowy w Przetrwaniu dodaje mleko; noc → każdy potwór działa 10 s bez wyjątków; wybuch robi dziurę. Commit `feat: animals and new monsters in game`, `git push`.
