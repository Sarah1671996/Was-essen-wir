# Versionen der Einkaufs-App

Die aktuelle Version steht in der App unter ⚙ ganz unten.
Jede Version hat in Git einen Tag `einkauf-vN`.

## Zurück zu einer älteren Version

Die App-Dateien kommen aus dem Tag zurück. Das wird als **neue** Version veröffentlicht, z. B. „Version 5 = Stand von Version 3“, damit nichts verloren geht und man auch wieder vorwärts springen kann:

```bash
git checkout einkauf-v3 -- einkauf-app
```

Danach in `app.js` `APP_VERSION`/`APP_DATE` und in `sw.js` die `CACHE`-Nummer hochzählen (die Handys laden sonst die neue alte Version nicht), committen, taggen, pushen.
Die Firestore-Regeln bleiben, wie sie sind: Sie erlauben die neueren Felder nur zusätzlich, ältere Versionen laufen damit weiter.

## Versionen

### Version 3 · 10.11.2026
- Notbremse beim Start (boot.js): Startet die App nicht, kommt statt eines schwarzen Bildschirms eine Meldung mit dem Fehler und „Neu laden“ (leert den Zwischenspeicher).
- Sonst wie Version 2.

### Version 2 · 10.11.2026
- Reiter in jeder Liste: „Jetzt“, „ab Mo …“ (Prospekt der nächsten Woche) und 📅 für einen anderen Tag. Was man dort einträgt, steht ab dem Tag von selbst unter „Jetzt“.
- Angebot am Eintrag: „Im Angebot?“ mit „Gilt schon“, „ab Do/Fr/Mo …“ oder Kalender. Anzeige mit Kalenderwoche, z. B. „KW 46 · Angebot bis Sa“ oder „Angebot vorbei“.
- Einträge, die älter als eine Woche sind, zeigen „seit KW …“.
- Nach dem Eintragen scrollt die Liste zum Eintrag, und er leuchtet kurz auf.
- Versionsnummer unter ⚙.

### Version 1 · 06.11.2026
Alles bis einschließlich: abgehakte Sachen bleiben nach „Fertig eingekauft“ durchgestrichen stehen, Prospekt-Taste mit eigenem Link pro Laden, Meine Einkaufszeit, Abteilungen in Ladenreihenfolge.
