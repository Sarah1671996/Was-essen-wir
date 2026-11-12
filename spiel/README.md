# Sonnenhof

Eigenes Farmspiel als Web-App (läuft im Browser und lässt sich aufs Handy legen), ganz ohne Bezahlinhalte.
Adresse auf GitHub Pages: `https://DEIN-NAME.github.io/Was-essen-wir/spiel/` · lokal: `node serve.mjs . 5175` → `http://localhost:5175/spiel/`

## Stand: Schritt 1 – der Hof

- Felder mit Weizen, Mais (Level 2) und Karotten (Level 3); nach dem ersten Säen weitere Felder einfach antippen
- Kühe, Hühner (Level 2) und Schafe (Level 4) füttern und einsammeln, Tiere dazukaufen
- Futtermühle, Bäckerei (Level 2) und Molkerei (Level 3) mit Warteschlange
- Auftragstafel mit wechselnden Aufträgen, Scheune als Lager (ausbaubar)
- Häuser (Einwohner) und Deko frei aufstellen und umstellen
- „Erste Schritte“ als kleine Anleitung, Level mit Freischaltungen
- Spielstand bleibt im Browser gespeichert, Zeiten laufen weiter, auch wenn das Spiel zu ist

## Stand: Schritt 2 – die Abenteuerinsel

- Über den Steg (ab Level 2) mit dem Boot zur Insel und zurück
- Dichte Büsche (Axt), Baumstümpfe (Schaufel) und Felsen (Spitzhacke) freiräumen, immer vom schon freien Weg aus
- Schatztruhen mit Münzen und Werkzeugen, zwei Brücken, die mit Waren vom Hof repariert werden
- Das alte Dorf und der Wasserfall als Ziele
- Quests der Entdeckerin Mila mit Punkten, Belohnungspfad mit Münzen, Werkzeugen und besonderer Deko für den Hof
- Werkzeuge gibt es für Aufträge auf dem Hof, in Truhen und alle 8 Minuten in der Kiste am Zelt
- Ist alles freigeräumt, startet auf Wunsch eine neue Expedition

## Stand: Schritt 3 – das Puzzle

- Über „Puzzle“ auf dem Hof und auf der Insel: Steine tauschen, drei oder mehr gleiche in einer Reihe
- 4 in einer Reihe ergeben eine Rakete (räumt Reihe oder Spalte), 5 oder eine L/T-Form eine Bombe (3 × 3)
- Ziele: bestimmte Steine sammeln, Kisten zerschlagen, Eis aufbrechen; begrenzte Züge
- 11 feste Level, danach geht es endlos mit wechselnden Karten weiter
- Gewinn: Münzen, Werkzeuge und Inselpunkte; verlieren kostet nichts, einfach noch mal
- Tipp nach ein paar Sekunden, automatisches Mischen, wenn kein Zug mehr geht

## Paket A: mehr Abwechslung

- **Tagesbelohnung** (Truhe oben rechts): 7-Tage-Kalender, wer einen Tag auslässt, fängt bei Tag 1 an
- **Eilaufträge** ab Level 2 auf der Auftragstafel: große Aufträge mit 2 Stunden Zeit, Lohn mit Helfer und Werkzeugen
- **Ausbau**: Fabriken bis Stufe 3 (mehr Plätze, schneller), Ställe bis Stufe 3 (mehr Tiere)
- **Dickicht** am Hofrand freiräumen (ab Level 2 bis 6), danach ist dort Platz zum Bauen
- **Puzzle-Helfer**: Hammer (ein Feld), Besen (eine Reihe), Regenbogen (eine Farbe); einsetzbar jederzeit und auch, wenn die Züge aus sind
- **Sterne** im Puzzle (1 bis 3 nach übrigen Zügen)
- **Leben**: Vögel, Schmetterlinge, Tag und Nacht nach Uhrzeit, Glühwürmchen nachts, Töne (⚙ zum Abschalten)
- Belohnungspfad der Insel ohne Deko, stattdessen Münzen, Werkzeuge und Helfer

## Paket B: Bewohner, neue Fabriken, Puzzle-Karte

- **Bewohner** mit Wünschen: Opa Willi, Bäckerin Rosi (ab Level 2), Lotte (ab 3), Handwerker Karl (ab 4); jeder erfüllte Wunsch gibt ein Herz und eine Freundschaftsbelohnung (bis 10 Herzen)
- **Neue Fabriken**: Imkerei (Honig, ab Level 5), Saftbar (Karottensaft, Maissuppe, ab 5), Schneiderei (Mütze, Pullover, ab 6), Konditorei (Kekse, Kuchen, ab 7)
- **Apfelbäume** aus dem Bauen-Menü tragen ab Level 5 Äpfel
- **Lieferwagen** steht bei der Auftragstafel, solange ein Eilauftrag läuft
- **Puzzle-Weltkarte** mit 41 Steinen pro Kapitel, Sterne pro Level, alte Level wiederholbar (kleiner Lohn)
- Echte Bilder für Hammer, Besen, Regenbogen und für das Dickicht

## Mehr Platz

- Hof auf 2700 × 2000 vergrößert (neues Land rechts und unten, zwei weitere Dickichte ab Level 8 und 9), Wasser am Steg ist jetzt ein See
- Viel weiter herauszoomen (am PC bis der ganze Hof passt), +/−-Knöpfe am rechten Rand, auch auf der Insel

## Auf Handy und PC spielen (Sync)

⚙ oben rechts → **Sync-Code für diesen Hof erstellen**, dann auf dem anderen Gerät den Code eingeben und **Verbinden**.
Der Spielstand liegt dann zusätzlich in Firebase (gleiches Projekt wie die anderen Apps, Dokument `reisen/sonnenhof-{code}`,
dieselbe Regel wie Kanada- und Film-App, also keine neue Firestore-Regel nötig). Der jeweils neuere Stand gewinnt.

Die Spielregeln (Zeiten, Preise, Rezepte, Inselplätze, Quests, Puzzle-Level) stehen alle in `daten.js`.

## Dateien


Eigenes Farm- und Inselspiel ohne Bezahlinhalte. Die Grafiken stammen aus Gemini.

- `assets/original/` – Gemini-Bilder im Original (weißer Hintergrund), nummeriert nach der Prompt-Liste
- `tools/freistellen.py QUELLORDNER ZIELORDNER` – entfernt den weißen Hintergrund und speichert PNG-Dateien
- `tools/sammelbild-zerlegen.py BILD name1,name2,… ZIELORDNER` – zerlegt ein Sammelbild in einzelne Teile
- `tools/build-assets.py` – erzeugt aus den Originalen die Spielbilder in `img/` (nach neuen Gemini-Bildern neu ausführen)
- `tools/artifact.py` – baut eine Vorschau-Seite mit eingebettetem Code
- `prototyp/vorschau-vorlage.html` – allererste klickbare Vorschau

Alle Bilder aus der Prompt-Liste sind vorhanden.
