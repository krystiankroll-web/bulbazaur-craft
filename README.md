# 🌱 Bulbazaur Craft

Gra w stylu Minecraft do przeglądarki z Pokémonami: Bulbazaur, Charmander, Squirtle lub Pikachu, każdy z innymi mocami.
Dwa tryby: **Kreatywny** (nieskończone bloki, latanie, zero potworów) i **Przetrwanie** (serca, głód, zbieranie bloków, noc z Cieniakami).
Świat jest nieskończony i generuje się w miarę wędrówki: łąki, lasy, pustynie z kaktusami, ośnieżone góry, jeziora, chmury, dzień i noc z gwiazdami.
Spokojna muzyka i dźwięki są generowane na żywo (Web Audio), bez plików. Działa na komputerze i na telefonie (sterowanie dotykowe).

## Jak uruchomić na komputerze
1. Otwórz plik `index.html` podwójnym kliknięciem (Chrome, Safari, Edge lub Firefox).
2. Potrzebny jest internet przy pierwszym uruchomieniu, bo silnik 3D (Three.js) ładuje się z sieci.
3. Kliknij **Graj**, wybierz tryb i Pokémona. Świat zapisuje się sam co 10 sekund w przeglądarce.

## Jak uruchomić na telefonie
Telefon musi dostać grę przez adres `http://…` (nie z pliku). Dwie drogi:

**A. Z Maca w tej samej sieci Wi‑Fi** (gra działa, dopóki Mac jest włączony):
```sh
cd ~/bulbazaur-craft && python3 -m http.server 8000
```
Na telefonie wpisz w przeglądarce `http://<adres-Maca>:8000` (adres podaje `ipconfig getifaddr en0`, np. `http://192.168.100.58:8000`).

**B. Z internetu (GitHub Pages)**: wrzuć folder do repozytorium na GitHubie i włącz Pages. Wtedy link działa wszędzie, a gra ma własną ikonę:
w Safari / Chrome wybierz „Dodaj do ekranu początkowego”. Po pierwszym wejściu działa też offline.

Na telefonie graj poziomo. Lewy krążek to chodzenie (pełny wychył = bieg), przeciąganie palcem po ekranie to rozglądanie,
przyciski po prawej to skok, niszcz, stawiaj i moce. Stuknięcie w Cieniaka to atak.

## Sterowanie na komputerze
| Klawisz | Działanie |
|---|---|
| W A S D | chodzenie |
| Mysz | rozglądanie (kliknij w okno gry, żeby zablokować kursor) |
| Spacja | skok; 2× szybko = latanie (w locie Spacja w górę, Shift w dół). W przetrwaniu lot zjada głód 2× szybciej, przy pustym pasku głodu nie da się latać |
| Shift + Spacja | super skok Bulbazaura |
| LPM / PPM | niszcz blok lub atakuj Cieniaka / stawiaj blok |
| 1–9, kółko myszy | wybór bloku; Tab przełącza 3 strony (natura, kolorowa wełna, śnieg/kaktus/cegła/bruk/pochodnia) |
| Q / E | moce Pokémona (zależą od bohatera, patrz niżej) |
| R | zjedz jabłko (przetrwanie) |
| F5 | widok z boku, żeby zobaczyć Pokémona |
| W W (2× szybko) | bieg |
| H | wróć do domu (miejsce startu), gdy się zgubisz |
| M | muzyka włącz / wyłącz |
| Esc | menu (zmiana Pokémona, warsztat) |

## Pokémony
| Bohater | Q | E | Pasywnie |
|---|---|---|---|
| 🌱 Bulbazaur | Pnącza: niszczy blok z 8 bloków | Nasionko: sadzi drzewo, wyrasta po 5 s | Shift+Spacja: wysoki skok |
| 🔥 Charmander | Płomień: spala drewno, liście, wełnę, sadzonki | Ognisko: stawia pochodnię | Ogon świeci w nocy |
| 💧 Squirtle | Strumień: stawia wodę | Bańka: zasysa wodę | Pływa szybko, nie tonie |
| ⚡ Pikachu | Piorun: trafia blok z 12 bloków | Szybki atak: zryw do przodu | Najszybszy, podwójny skok |

## Przetrwanie
- 10 serc, 10 udek jedzenia, powietrze pod wodą. Jedzenie spada powoli; najedzony leczysz się sam. Z głodu nie da się zemdleć (spada do 1 serca).
- Zniszczony blok trafia do plecaka (trawa daje ziemię, kamień bruk). Stawiasz tylko to, co masz. Liczniki są na pasku bloków.
- Jedzenie: jabłka (z liści, od świnki, z pokonanych potworów), mleko od krowy, jajka od kurczaka. Start: 3 jabłka. Jedzenie: R (zjada to, czego masz najwięcej).
- Warsztat (menu): 1 pień → 4 deski, 1 piasek → 1 szkło, 1 pień → 4 pochodnie. Pochodnie świecą i odstraszają spawn Cieniaków.
- Noc trwa około 3,5 min. Wychodzą potwory, o świcie płoną. Zbuduj dom i rozpal pochodnie.
- Omdlenie = powrót do domu z pełnymi sercami, plecak zostaje.

## Zwierzątka i potwory
- W dzień na trawie pasą się 🐄 krowy, 🐑 owce, 🐔 kurczaki i 🐷 świnki (w obu trybach). Nie da się ich skrzywdzić.
- Kliknij / stuknij zwierzątko, żeby je pogłaskać: serduszka, a potem idzie za tobą przez 20 s.
- Krowa daje mleko (raz na minutę), owca białą wełnę (potem jest łysa przez 2 min), kurczak sam znosi jajka, świnka wygrzebuje jabłka. Przedmioty z ziemi zbierasz, podchodząc.
- Potwory (tylko Przetrwanie, w nocy): **Cieniak** idzie i bije; **Skoczek** skacze i po pokonaniu dzieli się na dwa małe; **Kolczak** trzyma dystans i strzela kolcami (schowaj się za blokiem); **Wybuchacz** podchodzi, syczy i miga — uciekaj dalej niż 4 kratki, bo wybuchnie i zrobi dziurę.

## Gra we dwoje (dwa telefony)
1. Na pierwszym telefonie: Menu → **👫 Graj z kimś** → **Stwórz pokój**. Pojawi się kod z 4 znaków (np. `KAT7`). Stuknij **Wchodzę!** i graj.
2. Na drugim telefonie: Menu → **👫 Graj z kimś** → wpisz kod, wybierz Pokémona → **Dołącz** → **Wchodzę!**
- Gracie w świecie pierwszego telefonu, w jego trybie (Kreatywny albo Przetrwanie). Każdy ma swoje serca, głód i plecak.
- Świat zapisuje się tylko u gospodarza. Gość po wyjściu wraca do swojego świata, nic mu nie znika.
- Najpewniej działa, gdy oba telefony są w tym samym Wi‑Fi. Połączenie idzie bezpośrednio między telefonami (WebRTC); do zestawienia używa darmowego pośrednika PeerJS, więc potrzebny jest internet.
- Gdy gospodarz wyjdzie do menu albo schowa aplikację, świat u kolegi na chwilę się zatrzymuje.

## Dla programisty
- Brak builda. Zależności: Three.js z CDN i PeerJS 1.5.4 wgrany do `vendor/` (gra we dwoje). Kod w `src/`, klasyczne skrypty.
- Testy logiki (świat, szum, mesher, fizyka, promień, przetrwanie, stworzenia, protokół sieci): `node --test test/*.test.js`
- `manifest.json`, `sw.js`, `icon-*.png` robią z gry aplikację PWA (ikona na ekranie telefonu, cache offline). Działają tylko przez `http(s)://`.
- Projekt: `docs/superpowers/specs/2026-09-05-bulbazaur-craft-design.md`, wersja 3: `docs/superpowers/specs/2026-10-21-bulbazaur-craft-v3.md`, wersja 4: `docs/superpowers/specs/2026-10-22-bulbazaur-craft-v4-design.md`

## Uwaga
Bulbazaur, Charmander, Squirtle i Pikachu są znakami towarowymi Nintendo / Game Freak. Gra powstała do zabawy w domu i nie może być publikowana komercyjnie.
