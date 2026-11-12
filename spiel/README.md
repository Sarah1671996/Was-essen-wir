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

Die Spielregeln (Zeiten, Preise, Rezepte, Inselplätze, Quests) stehen alle in `daten.js`.

## Dateien


Eigenes Farm- und Inselspiel ohne Bezahlinhalte. Die Grafiken stammen aus Gemini.

- `assets/original/` – Gemini-Bilder im Original (weißer Hintergrund), nummeriert nach der Prompt-Liste
- `tools/freistellen.py QUELLORDNER ZIELORDNER` – entfernt den weißen Hintergrund und speichert PNG-Dateien
- `tools/sammelbild-zerlegen.py BILD name1,name2,… ZIELORDNER` – zerlegt ein Sammelbild in einzelne Teile
- `tools/build-assets.py` – erzeugt aus den Originalen die Spielbilder in `img/` (nach neuen Gemini-Bildern neu ausführen)
- `tools/artifact.py` – baut eine Vorschau-Seite mit eingebettetem Code
- `prototyp/vorschau-vorlage.html` – allererste klickbare Vorschau

Alle Bilder aus der Prompt-Liste sind vorhanden.
