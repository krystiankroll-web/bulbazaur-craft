# Bulbazaur Craft Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gra voxelowa w przeglądarce (tryb kreatywny) z Bulbazaurem jako bohaterem, uruchamiana z `file://`.

**Architecture:** Klasyczne skrypty JS (globalne obiekty + `module.exports` gdy w Node), Three.js z CDN. Świat = tablica chunków `Uint8Array`, jedna siatka Three.js na chunk, przebudowywana po zmianie. Logika czysta (noise, world, mesher, physics, raycast) testowana w Node; render/sterowanie/HUD tylko w przeglądarce.

**Tech Stack:** Three.js 0.160.0 (`https://cdnjs.cloudflare.com/ajax/libs/three.js/0.160.0/three.min.js`), Node 18+ `node --test`, brak bundlera.

**Spec:** `docs/superpowers/specs/2026-09-05-bulbazaur-craft-design.md`

## Global Constraints
- Zero builda: `index.html` otwierany podwójnym kliknięciem.
- Każdy plik `src/*.js` definiuje globalny obiekt (np. `window.BC.World`) oraz `if (typeof module !== 'undefined') module.exports = ...`.
- Wspólna przestrzeń nazw: `BC` (`var BC = (typeof window !== 'undefined' ? (window.BC = window.BC || {}) : {})`).
- W Node moduły importują się przez `require('../src/x.js')`.
- Świat 128x128x64, chunk 16x16x64, poziom wody 28.
- Teksty w UI po polsku.

---

### Task 1: Rejestr bloków + szum
**Files:** Create `src/blocks.js`, `src/noise.js`, `test/noise.test.js`, `test/blocks.test.js`
**Produces:** `BC.Blocks` = `{ AIR:0, GRASS:1, DIRT:2, STONE:3, SAND:4, WATER:5, LOG:6, LEAVES:7, PLANKS:8, GLASS:9, FLOWER:10, SAPLING:11, BEDROCK:12, WOOL_RED:13 … WOOL_WHITE:20 }`, `BC.BlockInfo[id] = { name, solid, transparent, cross, placeable, tex:{top,side,bottom} }`, `BC.Hotbar = [[...9 id],[...9 id]]`.
`BC.Noise.create(seed)` -> `{ noise2(x,y) in [-1,1], fbm(x,y,octaves) }` deterministyczny (mulberry32 + value noise z interpolacją smoothstep).
- [ ] Test: ten sam seed daje te same wartości; różny seed inne; zakres [-1,1]; BlockInfo ma wpis dla każdego id; WATER i FLOWER nie są solid.
- [ ] Implementacja, testy zielone, commit.

### Task 2: World
**Files:** Create `src/world.js`, `test/world.test.js`
**Consumes:** `BC.Blocks`, `BC.Noise`.
**Produces:** `new BC.World({seed, size:128, height:64})` z metodami: `get(x,y,z)` (poza granicami -> AIR, y<0 -> BEDROCK-like AIR), `set(x,y,z,id)` (zwraca listę kluczy chunków do przebudowy, ignoruje poza granicami i y=0), `generate()`, `chunkKey(cx,cz)`, `forEachChunk(fn(cx,cz,data))`, `serialize()` -> string (seed + lista diffów RLE), `World.deserialize(str)`, `growTree(x,y,z)`, `inBounds`.
Teren: `h = 30 + fbm(x/40, z/40, 4)*12`; y<h-4 STONE, <h DIRT, ==h GRASS (SAND jeśli h<=29), powyżej do 28 WATER; y=0 BEDROCK. Drzewa: hash(x,z) < 0.008 na trawie powyżej wody; kwiaty hash < 0.03.
- [ ] Testy: get/set round-trip; set poza granicami no-op; set na y=0 no-op; po generate na każdej kolumnie najwyższy niepowietrzny blok to GRASS/SAND/WATER; istnieje choć jeden WATER i jeden LOG; serialize/deserialize zachowuje modyfikacje; set zwraca sąsiedni chunk przy x%16==0.
- [ ] Implementacja, testy zielone, commit.

### Task 3: Mesher
**Files:** Create `src/mesher.js`, `test/mesher.test.js`
**Consumes:** `BC.World.get`, `BC.BlockInfo`.
**Produces:** `BC.Mesher.buildChunk(world, cx, cz, atlas)` -> `{ opaque:{positions,normals,uvs,indices}, transparent:{...} }` (płaskie tablice liczb). `atlas.uv(texIndex)` -> `[u0,v0,u1,v1]`. Ściana emitowana gdy sąsiad jest AIR lub transparent (i różny od bieżącego dla wody/liści/szkła). Kwiaty/sadzonki: 2 skrzyżowane quady w `transparent`. Cieniowanie: `colors` per ściana (top 1.0, boki 0.8, dół 0.6).
- [ ] Testy: pojedynczy STONE w pustym świecie -> 6 ścian = 24 wierzchołków, 36 indeksów; dwa sąsiednie STONE -> 10 ścian; FLOWER -> 8 wierzchołków w transparent, 0 w opaque; WATER obok WATER nie emituje ściany między nimi.
- [ ] Implementacja, testy zielone, commit.

### Task 4: Physics + Raycast
**Files:** Create `src/physics.js`, `src/raycast.js`, `test/physics.test.js`, `test/raycast.test.js`
**Produces:** `BC.Physics.step(world, body, dt)` gdzie `body = {pos:{x,y,z}, vel:{x,y,z}, w:0.6, h:1.6, onGround:bool, flying:bool, inWater:bool}`; ruch osiami osobno z rozwiązaniem kolizji AABB przeciw blokom `solid`; grawitacja -28, terminal -50, w wodzie tłumienie ×0.5; flying = brak grawitacji. Ściany świata: clamp pos do [0.3, size-0.3].
`BC.Raycast.cast(world, origin, dir, maxDist)` -> `{hit:bool, x,y,z, nx,ny,nz, dist}` algorytm DDA, pomija AIR i WATER.
- [ ] Testy: ciało nad podłogą spada i zatrzymuje się na y=górna ściana bloku, onGround true; ciało w locie nie spada; ruch w bok w ścianę zatrzymuje na krawędzi; raycast w dół trafia blok i zwraca ny=1; raycast w pustkę hit=false; raycast na bok trafia bliższy blok z poprawną normalną.
- [ ] Implementacja, testy zielone, commit.

### Task 5: Tekstury + index.html + render świata
**Files:** Create `src/textures.js`, `src/main.js`, `index.html`
**Produces:** `BC.Textures.createAtlas()` -> `{ canvas, uv(i), count }` z 16 kaflami 16px w rzędzie (trawa top/side, ziemia, kamień, piasek, woda, pień top/side, liście, deski, szkło, kwiat, sadzonka, bedrock, wełna biała – wełna kolorowa przez `color` na materiale? NIE: prościej 8 osobnych kafli). Materiały: `MeshLambertMaterial` z `vertexColors`, `NearestFilter`. `main.js`: scena, kamera, światło, mgła, niebo, budowa siatek wszystkich chunków, `rebuildChunk(key)`, pętla `requestAnimationFrame`.
- [ ] Ręczna weryfikacja w przeglądarce: teren widoczny, drzewa, woda.
- [ ] Commit.

### Task 6: Gracz, sterowanie, edycja bloków, HUD
**Files:** Create `src/player.js`, `src/hud.js`; modify `src/main.js`, `index.html`
**Produces:** `BC.Player` z `update(dt, input)`, Pointer Lock, WASD, skok, podwójna spacja = latanie, LPM/PPM edycja z użyciem `BC.Raycast` (zasięg 6), zaznaczenie trafionego bloku (wireframe box), hotbar 1–9 + kółko + Tab. `BC.HUD.init/setSlot/setPage/message(text)`. Ekran startowy z przyciskami „Graj” / „Nowy świat” + instrukcja. Autozapis do `localStorage['bc.world']` co 10 s i na `beforeunload`.
- [ ] Ręczna weryfikacja: chodzenie, stawianie/niszczenie, zapis po odświeżeniu.
- [ ] Commit.

### Task 7: Bulbazaur – model, TPP, moce
**Files:** Create `src/bulbasaur.js`; modify `src/player.js`, `src/main.js`, `src/hud.js`
**Produces:** `BC.Bulbasaur.create()` -> `{ group, legs[], setWalk(t,speed) }` z `BoxGeometry` (ciało, głowa, 4 łapy, cebulka, plamki, oczy). F5 przełącza FPP/TPP (kamera 4 m za graczem, patrzy na niego; model widoczny tylko w TPP). Q: pnącza – raycast 8, niszczy blok, linia `THREE.Line` zielona rosnąca 0,25 s od dołu ekranu. E: sadzonka na trawie/ziemi przed graczem, po 5 s `world.growTree`. Shift+spacja na ziemi: vel.y = 16. Portret Bulbazaura w HUD (rysowany na canvasie 64px pikselowo).
- [ ] Ręczna weryfikacja: F5 pokazuje model i animację łap, Q niszczy z daleka, E sadzi i rośnie drzewo.
- [ ] Commit.

### Task 8: Wykończenie
- [ ] README.md (jak uruchomić, sterowanie), sprawdzenie FPS, mgła, komunikat gdy brak internetu (Three.js nie załadował się).
- [ ] Commit.
