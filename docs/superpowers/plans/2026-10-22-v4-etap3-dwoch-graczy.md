# v4 Etap 3 — gra we dwoje: plan wdrożenia

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dwa telefony grają w jednym świecie: gospodarz tworzy pokój z 4-znakowym kodem, gość wpisuje kod i dołącza.

**Architecture:** WebRTC przez PeerJS (wgrany do `vendor/`), publiczny broker PeerJS do zestawienia połączenia. Bloki symetrycznie (`World.onChange` → paczki `blocks`). Gospodarz symuluje stworzenia i czas, gość je tylko rysuje (`BC.Monsters.puppet`). Czysta część protokołu w `netproto.js` (Node).

**Tech Stack:** vanilla JS, Three.js r160, PeerJS 1.5.4 (`vendor/peerjs.min.js`, global `Peer`), `node --test`.

**Spec:** `docs/superpowers/specs/2026-10-22-bulbazaur-craft-v4-design.md` (sekcja „Etap 3”)

## Global Constraints
- Maks. 2 graczy; trzeci dostaje `full`.
- Kod pokoju: 4 znaki z `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`; id w brokerze `bulbazaurcraft-<kod małymi literami>`.
- Gość **nigdy** nie zapisuje świata ani pozycji do `localStorage`.
- Komunikaty po polsku, dla dziecka: „Czekam na kolegę… kod: KOT7”, „Kolega dołączył!”, „Kolega wyszedł”, „Nie ma pokoju o takim kodzie”, „Nie udało się połączyć — połączcie oba telefony z tym samym Wi‑Fi i spróbujcie jeszcze raz”.
- `sw.js`: `CACHE = 'bc-v4c'`, nowe pliki w `FILES`.

## Protokół (obiekty `{ t: typ, … }`)
| t | kierunek | pola |
|---|---|---|
| `hello` | gość → gosp. | `hero` |
| `welcome` | gosp. → gość | `world` (`World.serialize()`), `mode`, `time`, `spawn {x,y,z}` |
| `full` | gosp. → gość | — |
| `pos` | oba, 10/s | `x, y, z, yaw, hero, fly` |
| `blocks` | oba, co 100 ms gdy są | `list [[x,y,z,id]]` |
| `snap` | gosp. → gość, 10/s | `c` (`P.packCreatures`), `s` spikes `[[x,y,z,dx,dy,dz]]`, `d` drops `[[id,item,x,y,z]]` |
| `time` | gosp. → gość, co 2 s | `time` |
| `hit` | gość → gosp. | `id, dmg, from {x,z}` |
| `killed` | gosp. → gość | `type` |
| `pet` | gość → gosp. | `id` |
| `give` | gosp. → gość | `item, why ('pet'\|'pickup'), name` |
| `hurt` | gosp. → gość | `dmg, from {x,y,z}` |
| `fx` | gosp. → gość | `kind: 'boom', x, y, z, r` |

---

### Task 1: `netproto.js` + `World.onChange`

**Files:** Create `src/netproto.js`, `test/netproto.test.js`; Modify `src/world.js` (`set`), `test/world.test.js`

**Produces (`BC.NetProto`, dalej `P`):** `P.ALPHABET`, `P.makeCode(rand) → 'KOT7'`, `P.normCode(str) → kod | null`, `P.peerId(code)`, `P.TYPES` (kolejność `Object.keys(C.TYPES)`), `P.packCreatures(list) → [[id, typeIdx, x, y, z, yaw, flags, fuseT]]` (liczby zaokrąglone do 0,01; flags: 1 hurt, 2 burning, 4 shorn, 8 dead; fuseT −1 gdy brak), `P.unpackCreatures(arr) → [{id,type,x,y,z,yaw,hurt,burning,shorn,dead,fuseT}]`, `P.approach(cur, target, dt, rate)`, `P.approachAngle(cur, target, dt, rate)`; `World.prototype.onChange(x,y,z,id)` wołane w `set` po zapisaniu zmiany.

- [ ] **Step 1: testy**

```js
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
```
W `test/world.test.js`:
```js
test('onChange woła się przy set; świat gościa z serialize ma te same bloki', () => {
  const w = empty(); const seen = [];
  w.onChange = (x, y, z, id) => seen.push([x, y, z, id]);
  w.set(3, 10, 4, B.BRICK);
  w.set(3, 10, 4, B.BRICK);
  assert.deepEqual(seen, [[3, 10, 4, B.BRICK]]);
  const g = BC.World.deserialize(w.serialize());
  assert.equal(g.get(3, 10, 4), B.BRICK);
});
```
- [ ] **Step 2:** FAIL. **Step 3:** implementacja (moduł czysty, `require('./creatures.js')`); w `World.set` po `this.diffs[...] = id;`: `if (this.onChange) this.onChange(x, y, z, id);`.
- [ ] **Step 4:** PASS. **Step 5:** commit `feat: net protocol helpers and world change hook`.

### Task 2: Połączenie, drugi gracz, menu — gra

**Files:** Create `src/net.js`, `src/remote.js`; Modify `src/monsters.js` (tryb lalek, snapshot, gracz nr 1), `src/player.js` (gość: atak/głaskanie przez sieć, `give`, `hurt`), `src/boot.js` (panel „Graj z kimś”, start gościa, brak zapisu), `src/main.js` (`World.onChange` → `Net`), `index.html` (panel, odznaka pokoju, skrypty `vendor/peerjs.min.js`, `netproto.js`, `remote.js`, `net.js`), `sw.js`, `README.md`

**Consumes:** `P.*`, `World.onChange`, `BC.Monsters`, `BC.Heroes.get(id).model()`.
**Produces:** `BC.Net = { role: null|'host'|'guest', code, active(), host(cb), join(code, hero, cb), send(msg), remoteBody(), update(dt) }`; `BC.Remote = { create(heroId), setTarget(msg), update(dt, t), remove() }`; `BC.Monsters.puppet` (bool), `M.snapshot()`, `M.applySnapshot(msg)`, `M.onRemote(kind, data)`.

- [ ] **Step 1: `remote.js`** — model bohatera kolegi + podpis (sprite z canvasu: emoji + nazwa Pokémona), wygładzanie `P.approach` (rate 12), `setWalk` wg prędkości.
- [ ] **Step 2: `monsters.js`** — `M.update(dt, t, players, light, mode)`:
  - `M.puppet === true` (gość): bez spawnu i AI; lalki z `applySnapshot` wygładzane do celu, `vel` z różnicy pozycji, `Models.animate`; kolce i przedmioty rysowane z ostatniego `snap`;
  - gospodarz: spawn wokół losowego gracza z listy; `attack`/kolec/wybuch na graczu nr 1 → `M.onRemote('hurt', { dmg, from })`; podniesienie przedmiotu przez gracza nr 1 → `M.onRemote('give', { item, why: 'pickup' })`; wybuch → `M.onRemote('fx', {...})`; przedmioty mają `id`.
- [ ] **Step 3: `net.js`** — `host()`: `new Peer(P.peerId(kod))`, przy `unavailable-id` nowy kod; `connection` → gdy już jest gość: `full` i zamknij; `hello` → `welcome` + `Remote.create`. `join()`: `new Peer()` → `connect(P.peerId(kod), { reliable: true })`, 15 s limitu, błędy `peer-unavailable` / sieciowe → komunikaty z Global Constraints. `update(dt)`: `pos` 10/s, paczka `blocks` co 100 ms, gospodarz: `snap` 10/s, `time` co 2 s. Odbiór `blocks`: flaga `applying` (żeby `onChange` nie odbijał), `world.set` + `Game.rebuildChunks`. Gość po zerwaniu: komunikat i po 2,5 s `location.reload()`; gospodarz: „Kolega wyszedł”, `Remote.remove()`.
- [ ] **Step 4: `player.js`** — gość: `Player.attack` → `Net.send({t:'hit'})` + dźwięk; `Player.pet` → serduszka lokalnie + `Net.send({t:'pet'})`; `BC.Net.onGive(item, why, name)` → do plecaka (Przetrwanie) + komunikat; `hurt` → `Player.hurt`; `killed` → `onMonsterKilled`.
- [ ] **Step 5: `boot.js` + `index.html`** — przycisk „👫 Graj z kimś” w menu → panel: „Stwórz pokój” (pokazuje kod dużymi literami, start/wznowienie gry), pole kodu + „Dołącz” + karty bohaterów; `sessionStorage['bc.join']` + `location.reload()`; przy starcie strony z `bc.join` → „Łączę z pokojem…” → `welcome` → `start(World.deserialize(world), { mode, time, hero, spawn, guest: true })`; `save()` nic nie robi u gościa; odznaka `#netBadge` u góry: „👫 KOT7 · czekam” / „👫 KOT7 · 2 graczy”. Menu: „2× szybko = latanie” bez „(kreatywny)”, opis Przetrwania „W nocy przychodzą potwory”.
- [ ] **Step 6:** testy Node + **e2e** w headless Chrome: dwie karty tej samej przeglądarki; karta A „Stwórz pokój” → kod; karta B dołącza; sprawdzenia: B ma ten sam `seed`, A widzi model kolegi, blok postawiony w B pojawia się w A i odwrotnie, krowa od gospodarza widoczna u gościa, głaskanie u gościa daje mleko, zamknięcie B → A „Kolega wyszedł”. Commit `feat: two-player mode with room code`, `git push`.
