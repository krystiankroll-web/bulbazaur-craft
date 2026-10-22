# Bulbazaur Craft v4 — latanie wszędzie, zwierzątka i potwory, gra we dwoje

Data: 2026-10-22 · Stan wyjściowy: v3 (`main`, commit `bbc4aba`) · Hosting: GitHub Pages z `main`.

## Cel

Trzy prośby Krystiana: (1) latanie w aplikacji na telefonie, (2) zwierzątka i potwory jak w Minecrafcie, (3) gra dla dwóch osób — „prosto, bez kombinacji, żebym to ogarnął”.

Trzy etapy w tej kolejności. Każdy kończy się `git push` (strona na telefonie aktualizuje się sama), więc dzieci testują po każdym etapie.

## Etap 1 — latanie wszędzie

**Problem:** przycisk 🪽 jest widoczny tylko w trybie Kreatywnym (`src/touch.js` → `T.refresh`), a `Player.toggleFly` odmawia w Przetrwaniu. Dzieci grają w Przetrwaniu.

**Zmiana:**
- `toggleFly` działa w obu trybach; 🪽 zawsze widoczny; podwójna spacja na komputerze też w obu trybach.
- Przetrwanie: lot zużywa głód jak bieganie — `S.tickStats` dostaje `ctx.flying`, mnożnik głodu ×2 (tak jak `sprinting`).
- Przetrwanie, `food === 0`: lot wyłącza się sam, komunikat „Za głodny, żeby latać”. Włączenie lotu przy pustym głodzie też jest blokowane tym komunikatem.
- Zachowane: dotknięcie ziemi kończy lot; skok = w górę, ⬇ = w dół. Wyłączenie lotu w powietrzu → zwykły upadek z obrażeniami liczonymi od miejsca wyłączenia.

**Testy:** `survival.test.js` — lot podwaja głód; pomocnicza czysta funkcja `S.canFly(stats, mode)` (Kreatywny zawsze, Przetrwanie gdy `food > 0`).

## Etap 2 — zwierzątka i potwory

### Architektura
- **`src/creatures.js` (nowy, czysta logika, Node):** rejestr typów `C.TYPES` (statystyki: hp, prędkość, rozmiar AABB, zachowanie, `hostile`), `C.make(type, x, y, z)`, `C.step(c, world, ctx, dt)` → lista zdarzeń (`attack`, `shoot`, `explode`, `lay`, `split`…). `ctx = { players: [{x,y,z,holdingApple}], night, light }`. Losowość przez wstrzykiwaną funkcję `rand`, żeby testy były deterministyczne.
- **`src/creaturemodels.js` (nowy, Three.js):** modele i animacje każdego typu (`makeMesh(type)`, `animate(c, mesh, t)`), w stylu obecnego Cieniaka (pudełka).
- **`src/monsters.js` → menedżer stworzeń** (nazwa `BC.Monsters` zostaje, żeby nie ruszać wywołań w `player.js`): jedna lista, spawn dzienny (zwierzątka) i nocny (potwory), despawn, pociski, wybuchy, `aim`/`alongRay`/`inRadius` zwracają tylko wrogie stworzenia. Nowe `M.aimAny()` dla interakcji ze zwierzątkami.
- Logika obecnego Cieniaka (`S.makeMonster`, `S.monsterStep`) przenosi się do `creatures.js` jako typ `cieniak`; testy z `survival.test.js` dotyczące potwora przenoszą się do `creatures.test.js` i nadal przechodzą.

### Zwierzątka (oba tryby, w dzień)
- Spawn: na trawie, w grupkach 2–4, 24–40 kratek od gracza. Limit: 10 (telefon 6). Despawn > 64 kratek. Nocą nie dochodzą nowe, istniejące zostają.
- Chodzą losowo, omijają wodę i krawędzie > 2 kratek. Są **nietykalne**: ataki i moce bohaterów ich nie ranią; potwory je ignorują.
- **Głaskanie:** stuknięcie / LPM na zwierzątku → serduszka (cząsteczki) + dźwięk. Stuknięcie ma pierwszeństwo przed kopaniem bloku za zwierzątkiem.
- **Po pogłaskaniu** zwierzątko idzie za tym graczem przez 20 s (jabłko nie jest na pasku bloków, więc „jabłko w ręce” odpada; ta reguła działa w obu trybach i we dwoje).
- 🐄 **Krowa** — głaskanie daje **Mleko** (co 60 s na krowę).
- 🐑 **Owca** — głaskanie daje **Wełnę białą** (`WOOL_WHITE`, istniejący blok); owca łysa przez 120 s (inny model), wtedy nic nie daje.
- 🐔 **Kurczak** — co 90–150 s sam znosi **Jajko** (przedmiot leży na ziemi i wpada do plecaka po podejściu ≤ 1,5 kratki; znika po 5 min).
- 🐷 **Świnka** — co 120–240 s wygrzebuje **jabłko** (jak jajko).
- W Kreatywnym produkty nie trafiają do plecaka (plecak jest tylko w Przetrwaniu) — zostaje głaskanie i serduszka.

### Nowe przedmioty
- `MILK` (29) „Mleko” i `EGG` (30) „Jajko” — `item: true`, nowe kafle w atlasie.
- Jedzenie: `S.eat` je po kolei to, co jest: jabłko (+6), jajko (+3), mleko (+4). Kolejność: najpierw to, czego jest najwięcej.

### Potwory (tylko Przetrwanie, w nocy)
Wspólne: spawn jak dziś (16–32 kratki, nie przy pochodni), płoną o świcie, ten sam limit co dziś (6, telefon 4), pokonany potwór → 50% na jabłko.

| Typ | HP | Zachowanie | Obrażenia |
|---|---|---|---|
| **Cieniak** (40%) | 6 | jak dziś: idzie do gracza, atak z bliska | 2 |
| **Skoczek** (25%) | 8 | zielony glut; skacze w stronę gracza co ~1 s; po pokonaniu rozpada się na 2 małe (HP 2, dmg 1, nie rozpadają się dalej) | 2 |
| **Kolczak** (20%) | 6 | trzyma dystans 8–14 kratek; co 2,5 s strzela kolcem (pocisk 14 kratek/s, zatrzymuje go blok stały, znika po 2 s) | 2 |
| **Wybuchacz** (15%) | 5 | idzie do gracza; w odległości ≤ 2 syczy 1,5 s i miga na biało; jeśli gracz odejdzie > 4 — przerywa. Wybuch: usuwa bloki w kuli r = 2,5 (oprócz skały macierzystej i wody), obrażenia `max(0, 7 − 2·dystans)`. Pokonany przed wybuchem nie wybucha | do 7 |

Wybuch zmienia świat przez `world.set` (zapisuje się w diffach jak kopanie gracza), bloki nie wpadają do plecaka.

### Testy
`creatures.test.js`: ruch i atak Cieniaka (przeniesione), skok Skoczka i podział, dystans i strzał Kolczaka, odliczanie i przerwanie Wybuchacza, lista bloków wybuchu (bez skały macierzystej), pogłaskane zwierzątko idzie za graczem, owca łysieje i odrasta, `S.eat` z trzema rodzajami jedzenia.

## Etap 3 — dwóch graczy

### Jak to wygląda dla dziecka
Menu → **„👫 Graj z kimś”** → dwa przyciski:
- **Stwórz pokój** — startuje obecny świat (lub nowy) i pokazuje duży kod z 4 znaków (np. `KOT7`; alfabet bez mylących znaków `0/O/1/I`).
- **Dołącz** — pole na kod + przycisk „Dołącz”. Po połączeniu gość wybiera bohatera (jak dziś) i ląduje obok gospodarza.

Komunikaty: „Czekam na kolegę… kod: KOT7”, „Kolega dołączył!”, „Kolega wyszedł”, „Nie udało się połączyć — połączcie oba telefony z tym samym Wi‑Fi i spróbujcie jeszcze raz”.

### Technika
- **PeerJS** (WebRTC, kanał danych) wgrany do repo jako `vendor/peerjs.min.js` (przypięta wersja), dodany do cache service workera. Sygnalizacja przez darmowy publiczny broker PeerJS — bez serwera, bez kont.
- Identyfikator gospodarza: `bulbazaurcraft-<KOD>`. Maksymalnie 2 graczy (gospodarz odrzuca trzeciego komunikatem „Pokój pełny”).
- **`src/netproto.js` (nowy, czysty, Node):** generator kodu, id pokoju, pakowanie/rozpakowanie stanu stworzeń, wygładzanie ruchu.
- **`src/net.js` (nowy):** połączenie PeerJS (`host()`, `join(code)`, `send(msg)`) i obsługa wiadomości w grze.
- **Bloki są symetryczne:** każdy gracz zmienia blok u siebie od razu i wysyła zmianę drugiemu (`World.onChange` łapie każdą zmianę — kopanie, stawianie, moce, drzewa, wybuchy). Przy 2 graczach konflikty są pomijalne, a gość nie ma opóźnienia.
- **Dołączanie przez przeładowanie:** „Dołącz” zapisuje kod w `sessionStorage` i przeładowuje stronę; gość nie zapisuje świata, więc jego własny zapis zostaje nietknięty.
- **`src/remote.js` (nowy):** model drugiego gracza (model bohatera z `heroes.js` + podpis z nazwą Pokémona nad głową), interpolacja pozycji.

### Kto o czym decyduje (gospodarz rządzi)
| Wiadomość | Kierunek | Częstość |
|---|---|---|
| `hello {hero}` / `welcome {seed, height, diffs, time, mode, spawn}` | gość → gospodarz → gość | raz |
| `pos {x,y,z,yaw,pitch,hero,anim}` | oba kierunki | 10×/s |
| `blocks [[x,y,z,id],…]` | oba kierunki | paczka co 100 ms, gdy są zmiany |
| `creatures [{id,type,x,y,z,yaw,state}]` | gospodarz → gość | 10×/s |
| `hit {creatureId, dmg}` / `pet {creatureId}` | gość → gospodarz | przy akcji |
| `hurt {dmg, from}` / `give {itemId, n}` | gospodarz → gość | przy zdarzeniu |
| `time {t}` | gospodarz → gość | co 5 s |

- Gospodarz symuluje **wszystkie** stworzenia; spawn i AI biorą pod uwagę obu graczy (potwór goni najbliższego). Gość tylko rysuje stworzenia z interpolacją.
- Każdy ma własne serca, głód i plecak (u siebie). Gość nie zapisuje świata; gospodarz zapisuje jak dziś.
- Moce bohaterów zmieniające świat (płomień, woda, pnącza) idą tą samą ścieżką `blocks`.
- Gość dociąga chunki sam z ziarna + diffów — przesyłane są tylko zmiany, nie mapa.
- Zerwanie połączenia: gość → komunikat i powrót do menu; gospodarz → „Kolega wyszedł”, gra dalej sam, pokój nadal czeka na ponowne dołączenie z tym samym kodem.

### Ryzyka
- Sieć komórkowa (symetryczny NAT) może nie zestawić połączenia bez serwera TURN — świadomie bez TURN (zero konfiguracji); komunikat podpowiada wspólne Wi‑Fi.
- Publiczny broker PeerJS może być chwilowo niedostępny — komunikat „spróbuj za chwilę”.

### Testy
`netproto.test.js`: generator kodu (4 znaki z bezpiecznego alfabetu), pakowanie i rozpakowanie stworzeń, wygładzanie; `world.test.js`: `onChange` woła się przy `set`, świat gościa z `serialize()` gospodarza ma te same bloki. Test end‑to‑end: dwie karty headless Chrome na Macu łączą się przez broker, gość stawia blok → gospodarz go widzi.

## Poza zakresem
Rozmnażanie zwierząt, jazda na zwierzętach, oswajanie, więcej niż 2 graczy, własny serwer/TURN, czat tekstowy, zapis świata u gościa.
