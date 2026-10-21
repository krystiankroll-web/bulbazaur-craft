# Bulbazaur Craft – wersja 3: telefon, tryb przetrwania, wybór Pokémona

Data: 2026-10-21. Zakres zatwierdzony przez właściciela (3 funkcje). Decyzje warsztatowe podjęte samodzielnie.

## 1. Wersja na telefon
- Wykrywanie dotyku (`maxTouchPoints`) włącza tryb dotykowy: brak Pointer Lock, osobna nakładka sterowania.
- Lewa dolna ćwiartka: wirtualny joystick (chodzenie, pełny wychył = bieg).
- Przeciąganie palcem poza joystickiem i przyciskami: rozglądanie. Krótkie stuknięcie w celowanego potwora = atak.
- Przyciski: Skok, Niszcz, Stawiaj, moc Q, moc E, Super (moc pasywna bohatera, np. wysoki skok), Lataj (tylko kreatywny), Jedz (tylko przetrwanie), Widok, Menu. Pasek bloków reaguje na stuknięcie, strzałka zmienia stronę.
- Wydajność: na dotyku promień renderu 5 chunków, pixel ratio 1, budżet 5 ms na klatkę.
- `viewport-fit=cover`, blokada zoomu i gestów, manifest PWA + ikony (dodaj do ekranu głównego).
- Hosting: do ustalenia z właścicielem (GitHub Pages = repo publiczne). Lokalnie: `python3 -m http.server` i adres Maca w Wi‑Fi.

## 2. Tryb przetrwania (wybierany przy nowym świecie, zapisany w `bc.game`)
- Cykl dnia 8 min (dzień 0.0–0.5, noc 0.5–1.0). Niebo, mgła, światło otoczenia i słońce interpolowane. Licznik „Dzień N” w HUD. Cykl działa też w kreatywnym (jaśniejsza noc, bez potworów).
- Statystyki: serca 20 hp, jedzenie 20, powietrze 10 s. Głód spada 1/40 s (+ koszt skoku i biegu). Jedzenie ≥ 14 → regeneracja 1 hp / 4 s. Jedzenie 0 → −1 hp / 6 s, ale nie poniżej 2 hp (dziecko nie umiera z głodu).
- Obrażenia: potwory (2 hp, co 1 s przy kontakcie), upadek > 5,5 bloku (1 hp za każdy blok powyżej), tonięcie (2 hp / s po wyczerpaniu powietrza).
- Śmierć: ekran „Zemdlałeś”, powrót do domu, serca pełne, jedzenie 14, ekwipunek zostaje.
- Ekwipunek liczony: zniszczony blok trafia do plecaka (trawa → ziemia, kamień → bruk, liście → 25 % jabłko, 15 % sadzonka, woda/skała → nic). Stawiać można tylko to, co się ma. Start: 3 jabłka.
- Jedzenie: jabłko +6. Klawisz R / przycisk Jedz.
- Warsztat w menu pauzy: 1 pień → 4 deski, 1 piasek → 1 szkło, 1 pień → 4 pochodnie.
- Pochodnia: blok krzyżowy, do 8 najbliższych świeci jako PointLight.
- Latanie wyłączone w przetrwaniu.
- Potwory „Cieniaki”: pojawiają się w nocy 16–32 bloki od gracza na powierzchni (max 6, na dotyku 4), idą do gracza, skaczą gdy blokowane, 6 hp, 50 % jabłko po pokonaniu. O świcie płoną i znikają. Atak gracza: stuknięcie/LPM w potwora (2 hp, zasięg 4), moce Q (3–4 hp).

## 3. Wybór Pokémona (przy nowym świecie i w menu pauzy, w każdej chwili)
| Bohater | Q | E | Pasywnie |
|---|---|---|---|
| Bulbazaur | Pnącza: niszczy blok z 8 bloków, 3 hp | Nasionko: sadzi drzewo | Super: wysoki skok |
| Charmander | Płomień: spala drewno/liście/wełnę/sadzonki z 8 bloków, 4 hp potworom | Ognisko: stawia pochodnię na celowanym bloku | Świeci w nocy (ogon) |
| Squirtle | Strumień: stawia wodę obok celowanego bloku (8 bloków), odpycha potwory 2 hp | Bańka: zasysa celowaną wodę | Pływa szybko, nie tonie |
| Pikachu | Piorun: trafia blok z 12 bloków, 4 hp potworom w promieniu 2 | Szybki atak: zryw do przodu | Najszybszy, podwójny skok |

Modele z klocków, portret 16×16 i kolory per bohater (`src/heroes.js` zastępuje `bulbasaur.js`).

## Zapis
- `bc.world2` bez zmian (format v2). Nowy klucz `bc.game`: `{mode, hero, hp, food, inv, time, day}`. Brak klucza = kreatywny + Bulbazaur (stare zapisy działają).

## Testy (Node)
`survival.js`: głód/regeneracja/tonięcie/upadek, ekwipunek (dodaj/zdejmij/warsztat), dropy, cykl dnia (fazy, światło), AI potwora (idzie do gracza, skacze gdy blokowany, obrażenia z cooldownem).
