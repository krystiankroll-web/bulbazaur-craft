# 🌱 Bulbazaur Craft

Gra w stylu Minecraft do przeglądarki. Bohaterem jest Bulbazaur. Tylko tryb kreatywny: bez życia, głodu i potworów.
Świat jest nieskończony i generuje się w miarę wędrówki: łąki, lasy, pustynie z kaktusami, ośnieżone góry, jeziora i chmury.
Spokojna muzyka i dźwięki są generowane na żywo (Web Audio), bez plików.

## Jak uruchomić
1. Otwórz plik `index.html` podwójnym kliknięciem (Chrome, Safari, Edge lub Firefox).
2. Potrzebny jest internet przy pierwszym uruchomieniu, bo silnik 3D (Three.js) ładuje się z sieci.
3. Kliknij **Graj**. Świat zapisuje się sam co 10 sekund w przeglądarce.

## Sterowanie
| Klawisz | Działanie |
|---|---|
| W A S D | chodzenie |
| Mysz | rozglądanie (kliknij w okno gry, żeby zablokować kursor) |
| Spacja | skok; 2× szybko = latanie (w locie Spacja w górę, Shift w dół) |
| Shift + Spacja | wysoki skok Bulbazaura |
| LPM / PPM | niszcz / stawiaj blok |
| 1–9, kółko myszy | wybór bloku; Tab przełącza 3 strony (natura, kolorowa wełna, śnieg/kaktus/cegła/bruk) |
| Q | pnącza: niszczy blok z odległości 8 kroków |
| E | nasionko: sadzi drzewo na trawie lub ziemi, wyrasta po 5 s |
| F5 | widok z boku, żeby zobaczyć Bulbazaura |
| W W (2× szybko) | bieg |
| H | wróć do domu (miejsce startu), gdy się zgubisz |
| M | muzyka włącz / wyłącz (dźwięki i muzyka także w menu) |
| Esc | menu |

Jeśli przeglądarka nie pozwoli zablokować kursora, rozglądaj się przeciągając myszą, a kliknięcie bez ruchu niszczy lub stawia blok.

## Dla programisty
- Brak builda i zależności poza Three.js z CDN. Kod w `src/`, klasyczne skrypty.
- Testy logiki (świat, szum, mesher, fizyka, promień): `node --test test/*.test.js`
- Projekt: `docs/superpowers/specs/2026-09-05-bulbazaur-craft-design.md`

## Uwaga
Bulbazaur jest znakiem towarowym Nintendo / Game Freak. Gra powstała do zabawy w domu i nie może być publikowana komercyjnie.
