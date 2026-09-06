# Bulbazaur Craft – projekt gry

Data: 2026-09-05. Status: zatwierdzony przez właściciela.

## Cel
Gra przeglądarkowa w stylu Minecraft dla dziecka i rodzica. Bohaterem jest Bulbazaur.
Priorytety: prostota, kolory, radość z budowania, zero frustracji. Tylko tryb kreatywny.
Gra ma uruchamiać się podwójnym kliknięciem w `index.html` (bez builda, bez serwera).

Uwaga prawna: Bulbazaur jest znakiem towarowym Nintendo / Game Freak. Gra służy wyłącznie
do użytku domowego, nie może być publikowana komercyjnie.

## Stos
- Three.js z CDN (jedyna zależność zewnętrzna, ładowana jako klasyczny skrypt).
- Własne pliki JS jako klasyczne skrypty (nie ES modules), aby działały z `file://`.
  Każdy plik logiki eksportuje przez `if (typeof module !== 'undefined') module.exports = ...`,
  aby dało się go testować w Node (`node --test`).
- Tekstury generowane programowo na canvasie (atlas). Brak plików graficznych.
- Zapis świata w `localStorage` (autozapis co 10 s i przy zamknięciu).

## Struktura plików
```
bulbazaur-craft/
  index.html            # ekran startowy, HUD, ładowanie skryptów
  src/blocks.js         # rejestr bloków: id, nazwa, kolory/tekstury, przezroczystość, stałość
  src/noise.js          # szum 2D (value/simplex) deterministyczny z seeda
  src/world.js          # World: chunki 16x16x64, get/set bloku, generowanie terenu, drzewa, serializacja
  src/mesher.js         # budowa geometrii chunku (widoczne ściany, UV z atlasu)
  src/physics.js        # AABB gracza vs bloki, grawitacja, latanie
  src/raycast.js        # DDA promień celowania -> trafiony blok + normalna
  src/textures.js       # rysowanie atlasu tekstur na canvasie
  src/player.js         # sterowanie, kamera FPP/TPP, moce Bulbazaura
  src/bulbasaur.js      # model Bulbazaura z klocków (Three.js Group) + animacja chodzenia
  src/hud.js            # pasek bloków, portret, celownik, komunikaty
  src/main.js           # pętla gry, spinanie modułów, autozapis
  test/*.test.js        # testy Node dla logiki czystej
```

## Świat
- Rozmiar 128 x 128 bloków, wysokość 64, chunki 16 x 16 x 64 (8 x 8 chunków).
- Teren z szumu: wzgórza (wys. 20–40), jeziora poniżej poziomu wody 28, plaże z piasku przy wodzie,
  kamień poniżej 4 bloków od powierzchni, drzewa (pień 4–6, korona liści 5x5x3 zaokrąglona),
  kwiaty losowo na trawie.
- Seed stały z możliwością zmiany przez „Nowy świat” na ekranie startowym.
- Poza granicami świata: niewidzialna ściana (gracz nie wychodzi), bez bloków.

## Bloki
Trawa, ziemia, kamień, piasek, woda (przezroczysta, nie stawiana, przechodzi się przez nią wolniej),
drewno, liście (przezroczyste krawędzie), deski, szkło, kwiat (model krzyżowy, bez kolizji),
sadzonka (rośnie w drzewo), wełna w 8 kolorach (czerwona, pomarańczowa, żółta, zielona, niebieska,
fioletowa, różowa, biała). Bedrock na y=0 niezniszczalny.

## Sterowanie
- WASD ruch, mysz z Pointer Lock, spacja skok, podwójna spacja przełącza latanie,
  w locie spacja w górę / Shift w dół.
- LPM niszczy blok (natychmiast, tryb kreatywny), PPM stawia wybrany blok.
- 1–9 i kółko myszy: wybór bloku z paska (pasek ma 2 strony, przełączane klawiszem Tab).
- Esc zwalnia kursor i pokazuje menu z instrukcją.

## Moce Bulbazaura
- Q „Pnącza”: zielony bicz niszczy blok trafiony promieniem do 8 bloków; animacja rozciągającego
  się pnącza od dołu ekranu do celu (0,25 s).
- E „Nasionko”: stawia sadzonkę na trawie/ziemi przed graczem; po 5 s wyrasta w drzewo.
- Shift + spacja na ziemi: wysoki skok (ok. 5 bloków).
- F5: przełącza kamerę FPP <-> TPP. W TPP widać model Bulbazaura z klocków: ciało turkusowo-zielone,
  4 łapki, cebulka na grzbiecie (zielona), ciemne plamki, czerwone oczy; łapki animowane przy chodzeniu.

## HUD
Celownik, pasek 9 slotów z ikonami (miniatury z atlasu), portret Bulbazaura w lewym górnym rogu,
krótkie komunikaty („Zapisano”, nazwa wybranego bloku), ekran startowy „Graj” / „Nowy świat”
z instrukcją sterowania po polsku.

## Wydajność
Jedna siatka na chunk, przebudowa tylko chunków dotkniętych zmianą (plus sąsiednich przy krawędzi).
Cel: 60 FPS na przeciętnym laptopie. Mgła na horyzoncie.

## Testy
Node `--test`: noise (determinizm), world (get/set, granice, serializacja round-trip, generowanie:
trawa na powierzchni, woda w dołkach), mesher (liczba ścian dla pojedynczego bloku = 6, sąsiadujące
bloki ukrywają ściany), physics (stanie na bloku, brak przenikania), raycast (trafia najbliższy blok,
poprawna normalna). Sprawdzenie wizualne i sterowania w panelu przeglądarki.

## Aktualizacja 2026-09-06 (wersja 2)
- Świat nieskończony: chunki generowane na żądanie wokół gracza (promień 7 chunków), zwalniane po oddaleniu.
  Dekoracje (drzewa, kaktusy, kwiaty) liczone z marginesem 3 bloków, więc są spójne na granicach chunków.
- Wysokość 80, poziom wody 30, góry, doliny, biomy: łąka, las, pustynia (piasek, kaktusy), śnieg (świerki).
- Nowe bloki: śnieg, kaktus, cegła, bruk, żwir, tulipan. Pasek bloków ma 3 strony.
- Muzyka generatywna (pad akordowy, bas, melodia pentatoniczna z echem) i efekty dźwiękowe w Web Audio.
  Przełączniki w menu i klawisz M, preferencje zapamiętywane.
- Chmury nad światem, efekt pod wodą, współrzędne i nazwa biomu w HUD, klawisz H „do domu”, bieg na podwójne W.
- Zapis: format v2 (seed + lista zmian), stary v1 ignorowany. Pozycja gracza przywracana tylko dla tego samego seeda.
- Tryb awaryjny bez blokady kursora: rozglądanie przeciąganiem, klik bez ruchu = akcja.
