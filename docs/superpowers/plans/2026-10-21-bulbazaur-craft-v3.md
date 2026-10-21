# Plan wdrożenia v3 (telefon, przetrwanie, Pokémony) — stan 2026-10-21

Spec: `../specs/2026-10-21-bulbazaur-craft-v3.md`.

- [x] blocks/textures: pochodnia, jabłko (przedmiot), dropy, palność, promień z opcją zatrzymania na wodzie
- [x] `survival.js` + testy: statystyki, ekwipunek, dropy, warsztat, cykl dnia, AI potwora, promień vs potwór (11 testów)
- [x] `heroes.js`: 4 bohaterów (definicje mocy, modele, portrety); zastępuje `bulbasaur.js`
- [x] `monsters.js`: spawn w nocy, model, płonięcie o świcie, trafienia
- [x] `touch.js`: joystick, rozglądanie, przyciski; `index.html`: nakładka dotykowa, CSS, PWA
- [x] `player.js`: wejście z klawiatury i dotyku, moce Q/E/Super per bohater, przetrwanie (obrażenia, upadek, tonięcie, jedzenie, plecak, omdlenie)
- [x] `main.js`: cykl dnia (niebo, mgła, światła, gwiazdy), pochodnie jako PointLight, potwory, ustawienia mobilne
- [x] `hud.js`, `boot.js`: serca/jedzenie/powietrze/dzień, liczniki w pasku, menu nowego świata, wybór bohatera, warsztat, ekran omdlenia, zapis `bc.game`
- [x] `manifest.json`, `sw.js`, ikony PNG, README
- [x] test dymny w headless Chrome (CDP): start, moce, potwory, warsztat, zapis — bez wyjątków
- [ ] hosting na telefon: decyzja właściciela (GitHub Pages = repo publiczne) — alternatywa: serwer lokalny w Wi‑Fi
