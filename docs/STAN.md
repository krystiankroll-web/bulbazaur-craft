# Stan projektu — 22.10.2026

Wersja v4 jest na `main` i na żywo: https://krystiankroll-web.github.io/bulbazaur-craft/ (`CACHE = 'bc-v4c'` w `sw.js`).

## Co jest gotowe
- Latanie w obu trybach (w Przetrwaniu podwójny głód, auto-lądowanie przy pustym pasku), przycisk 🪽 na telefonie.
- Zwierzątka (krowa, owca, kurczak, świnka): głaskanie, chodzenie za graczem 20 s, mleko, wełna, jajka, jabłka.
- Potwory nocą w Przetrwaniu: Cieniak, Skoczek, Kolczak, Wybuchacz.
- Gra we dwoje: Menu → „👫 Graj z kimś” → kod 4 znaki (PeerJS 1.5.4 w `vendor/`).
- Spec: `docs/superpowers/specs/2026-10-22-bulbazaur-craft-v4-design.md`, plany: `docs/superpowers/plans/2026-10-22-v4-*`.

## Jak testować
- Logika: `node --test test/*.test.js` (68 testów).
- Gra w przeglądarce: `python3 -m http.server 8765`, potem `node tools/cdp-test.js` (opcja `--mobile`).
- Gra we dwoje: `node tools/net-e2e.js [URL]` — dwie osobne instancje headless Chrome (karta w tle nie rysuje klatek). Zrzuty i profile lądują w `tools/out/` (poza gitem).
- Po zmianie plików gry podbić `CACHE` w `sw.js`.

## Jeszcze niesprawdzone
- Gra we dwoje na prawdziwych telefonach (testowana tylko na dwóch przeglądarkach na Macu).

## Znane ograniczenia
- W sieci komórkowej połączenie może nie wyjść — najlepiej wspólne Wi‑Fi (brak serwera TURN).
- Gdy gospodarz wejdzie do menu albo schowa aplikację, świat u kolegi stoi.
- Gość po przeładowaniu strony musi stuknąć „Wchodzę!”.

## Pomysły na później
Rozmnażanie zwierzątek, jazda na zwierzętach, więcej niż 2 graczy, serwer TURN.
