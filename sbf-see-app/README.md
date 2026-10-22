# SBF-See Trainer

Lern-App für den Sportbootführerschein See mit allen 285 Fragen des amtlichen Katalogs (72 Basisfragen, 213 See-Fragen) und den 82 Abbildungen
(Tafelzeichen, Lichter, Sichtzeichen, Schallsignale). Die richtige Antwort steht bei jeder Frage an einer anderen Stelle.

Adresse auf GitHub Pages: `https://sarah1671996.github.io/Was-essen-wir/sbf-see-app/`

## Aufs Handy und an den PC

1. **Handy:** Adresse öffnen, **Teilen → Zum Home-Bildschirm** (iPhone) bzw. **⋮ → App installieren** (Android).
2. **PC:** dieselbe Adresse im Browser öffnen (Chrome/Edge bieten oben in der Adresszeile auch „App installieren“ an).
3. Auf einem Gerät unter **Übersicht → Handy und PC verbinden** einen **Lerncode erstellen**, auf dem anderen Gerät den Code eingeben.
   Danach haben beide denselben Lernstand (Markierungen, Tagesfragen, Prüfungen).

Ohne Lerncode bleibt der Lernstand nur auf dem jeweiligen Gerät. Die App funktioniert nach dem ersten Öffnen auch ohne Internet;
Änderungen werden nachgeholt, sobald wieder Empfang da ist.

## Was die App kann

- **Karteikarten** zum Umdrehen oder Ankreuzen, jede Karte als **sicher / mittel / schlecht** markieren.
- **Tagesfragen** (5–30), bevorzugt schlecht markierte und noch unbekannte Fragen; als Lernblatt mit verdeckten Antworten oder zum Abfragen.
- **Prüfungsbogen** wie in der Prüfung: 30 Fragen (7 Basis + 23 See), 60 Minuten, bestanden ab 24 richtigen.
- **Drucken:** A4-PDF als Bogen zum Ankreuzen (Lösungen auf der letzten Seite) oder als Lernblatt mit Lösung.
- Fragen auswählen nach **Nummern** (`1-10, 22, 30`), nach **Markierung**, Basis/See oder „mit Bild“ – in Karteikarten, Drucken und Katalog.
- **Katalog** mit Suche nach Wort oder Nummer.

## Dateien

- `quelle/app.html` – die App (Oberfläche und Code). **Hier ändern**, dann `node sbf-see-app/build.mjs` ausführen.
- `quelle/daten/` – aus der PDF gelesene Fragen (`fragen.json`, Antwort `a[0]` ist richtig), Bilder und `extract.mjs` (Auslese-Skript, braucht das npm-Paket `mupdf`).
- `index.html`, `app.js`, `daten.js` – von `build.mjs` erzeugt, werden auf GitHub Pages ausgeliefert.
- `quelle/artifact.html` – ebenfalls erzeugt: dieselbe App als eine Datei für den Claude-Artifact-Link (nicht im Repo).
- `sw.js` – Offline-Speicher; bei Änderungen die Versionsnummer `CACHE` hochzählen.

## Lernstand und Sicherheit

Der Lernstand liegt im Firebase-Projekt der Essens-App in der Sammlung `lernstand`, ein Dokument pro Lerncode.
Die Regeln dafür stehen in `../essen-match-app/firestore.rules` (Block `lernstand`): nur mit Code lesbar, Auflisten und Löschen verboten,
nur die Felder der App erlaubt. Nach einer Regeländerung im Ordner `essen-match-app` `firebase deploy --only firestore:rules` ausführen.

## Testen

`node serve.mjs . 5175` im übergeordneten Ordner, dann http://localhost:5175/sbf-see-app/ (mit `?demo` ohne Firebase).
