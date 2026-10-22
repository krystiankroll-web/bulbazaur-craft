# v4 Etap 1 — latanie wszędzie: plan wdrożenia

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Latanie działa w obu trybach (także na telefonie); w Przetrwaniu kosztuje głód i wyłącza się przy pustym pasku.

**Architecture:** Czysta reguła `S.canFly` + mnożnik głodu `ctx.flying` w `survival.js` (testowalne w Node); `player.js` i `touch.js` tylko z nich korzystają.

**Tech Stack:** vanilla JS (IIFE na `window.BC`), Three.js r160, `node --test`.

**Spec:** `docs/superpowers/specs/2026-10-22-bulbazaur-craft-v4-design.md` (sekcja „Etap 1”)

## Global Constraints
- Kod w stylu repo: `var`, IIFE `(function (BC) {...})(BC)`, komentarze po polsku, bez bundlera.
- Testy: `node --test test/*.test.js` — wszystkie muszą przechodzić.
- Każda zmiana plików gry → podbić `CACHE` w `sw.js`, inaczej telefon pokaże starą wersję.

---

### Task 1: Reguła lotu i koszt głodu

**Files:**
- Modify: `src/survival.js` (`S.tickStats`, nowe `S.canFly`)
- Test: `test/survival.test.js`

**Interfaces:**
- Produces: `S.canFly(stats, mode) → boolean`; `S.tickStats(st, dt, { flying: true })` liczy głód ×2 (nie sumuje się z `sprinting`).

- [ ] **Step 1: Failing test** — dopisać do `test/survival.test.js`:

```js
test('lot: głód ×2, w przetrwaniu tylko przy jedzeniu > 0', () => {
  const st = S.makeStats();
  S.tickStats(st, 20, { flying: true });
  assert.equal(st.food, 19);
  const st2 = S.makeStats();
  S.tickStats(st2, 20, { flying: true, sprinting: true });
  assert.equal(st2.food, 19);
  assert.equal(S.canFly(st, 'creative'), true);
  assert.equal(S.canFly(st, 'survival'), true);
  st.food = 0;
  assert.equal(S.canFly(st, 'survival'), false);
  assert.equal(S.canFly(st, 'creative'), true);
});
```

- [ ] **Step 2:** `node --test test/survival.test.js` → FAIL (`S.canFly is not a function`).
- [ ] **Step 3: Implementacja** w `src/survival.js`:

```js
    st.hungerAcc += dt * ((ctx.sprinting || ctx.flying) ? 2 : 1);
```
(zamiast obecnej linii z `ctx.sprinting ? 2 : 1`) oraz po `S.jumpCost`:
```js
  S.canFly = function (st, mode) { return mode !== 'survival' || st.food > 0; };
```
- [ ] **Step 4:** `node --test test/*.test.js` → PASS.
- [ ] **Step 5:** commit `feat: flying rule and hunger cost`.

### Task 2: Lot w obu trybach (gracz + dotyk)

**Files:**
- Modify: `src/player.js` (`toggleFly`, obsługa spacji, `S.tickStats` w `update`)
- Modify: `src/touch.js` (`T.refresh`)
- Modify: `sw.js` (`CACHE = 'bc-v4a'`)

**Interfaces:**
- Consumes: `S.canFly`, `ctx.flying` z Task 1.

- [ ] **Step 1:** `Player.toggleFly`:

```js
  Player.toggleFly = function () {
    var body = Player.body;
    if (!body.flying && !S.canFly(Player.stats, Player.mode)) { BC.HUD.message('Za głodny, żeby latać', 1200); return; }
    body.flying = !body.flying;
    ...reszta bez zmian
```
- [ ] **Step 2:** spacja: usunąć `&& Player.mode === 'creative'` z warunku podwójnej spacji.
- [ ] **Step 3:** w `Player.update`, blok przetrwania: przekazać `flying: body.flying` do `S.tickStats`, a po nim:

```js
      if (body.flying && !S.canFly(Player.stats, Player.mode)) {
        body.flying = false; fallStart = body.pos.y;
        BC.HUD.message('Za głodny, żeby latać', 1500); BC.Audio.sfx('unfly');
        if (BC.Touch) BC.Touch.refresh();
      }
```
- [ ] **Step 4:** `src/touch.js` → `show('tbFly', true); show('tbDown', p.body.flying);`
- [ ] **Step 5:** `sw.js` → `CACHE = 'bc-v4a'`; README: wzmianka, że latanie działa też w Przetrwaniu i kosztuje głód.
- [ ] **Step 6:** testy Node + test dymny headless Chrome (emulacja dotyku, tryb Przetrwanie): przycisk `#tbFly` widoczny, kliknięcie → `BC.Player.body.flying === true`; `stats.food = 0` → po klatce `flying === false`; brak błędów w konsoli.
- [ ] **Step 7:** commit `feat: flying in survival and on mobile`, `git push`.
