# Sauerteig

Backplan rückwärts vom Ofen aus, Mengen pro Brotsorte (Klassisch, Kräuterbutter, Kinderschokolade, Körnerbrot,
Oliven & Rosmarin, Dinkel-Vollkorn) und ein Tagebuch für mehrere Starter (Weizen, Vollkorn, Roggen, Dinkel, glutenfrei …)
mit Erinnerungen ans Füttern pro Starter, auch im Kühlschrank-Modus. Dazu ein glutenfreies Brot, eigene Rezepte,
Abhaken mit Verschieben, Back-Tagebuch mit Fotos, Höhepunkt messen und Urlaubsplan.

Adresse auf GitHub Pages: `https://sarah1671996.github.io/Was-essen-wir/sauerteig-app/`

## Aufs Handy holen

1. Adresse in Chrome öffnen, **⋮ → App installieren**.
2. Über das neue Symbol öffnen, Tab **Meine Starter** → **Benachrichtigungen erlauben** → **Test-Benachrichtigung**.

## Wie die Erinnerungen funktionieren

- Die App rechnet die nächsten Erinnerungen aus (Starter füttern, auf Wunsch jeder Schritt des Backplans) und speichert sie
  zusammen mit dem Push-Token in Firestore unter `sauerteig/<code>` (Felder `due` und `next`).
- `functions/index.js` → `sauerteigReminders` schaut alle 5 Minuten nach fälligen Erinnerungen und verschickt sie,
  `sauerteigOnWrite` schickt sofort, was beim Speichern schon fällig ist, und die Test-Benachrichtigung.
- In der Starter-Erinnerung gibt es den Knopf **Gerade gefüttert**: öffnet die App mit `#fed-<Kennung>` und trägt die Fütterung bei genau diesem Starter ein.
- Ohne Firebase (offline beim Start) läuft alles auf dem Gerät, nur ohne Erinnerungen.

## Mehrere Geräte

Unter **Meine Starter → Auf einem anderen Gerät** steht der 10-stellige Code. Auf dem zweiten Gerät eingeben und **Übernehmen**.

## Einmalig veröffentlichen

Regeln und Server-Funktionen (im Hauptordner):

```
firebase deploy --only firestore:rules,functions:sauerteigOnWrite,functions:sauerteigReminders
```

## Aufbau

- `recipes.js` Brote und Mengen, `plan.js` Zeitplan und Verschieben, `starters.js` Starter, Urlaub, Abgleich (alles reine Funktionen mit Tests)
- `app.js` Oberfläche, `editor.js` eigene Rezepte, `diary.js` Tagebuch, `store.js` Firebase
- Wer einen Schritt später abhakt, schiebt alles Folgende mit. Die kalte Gare fängt Verspätung auf, solange der Teig 6–18 h kühl steht.

## Abgleich

`starters.js` führt die Stände mehrerer Geräte zusammen: Pro Starter, Rezept und Tagebuch-Eintrag und für den Backplan gewinnt die neuere Änderung (Feld `u`),
gespeichert wird in einer Transaktion. Der Stand der ersten Version (nur ein Starter) wird automatisch übernommen.

## Testen

`node --test sauerteig-app/starters.test.mjs sauerteig-app/app.test.mjs` prüft Rechnen, Abgleich und Erinnerungen. Mit `?demo` läuft die App ohne Firebase.

`node serve.mjs . 5178` im übergeordneten Ordner, dann http://localhost:5178/sauerteig-app/
Nach Änderungen an den App-Dateien in `sw.js` die Version hochzählen (`sauerteig-v3` → `sauerteig-v4`).
Icons neu zeichnen: `icons/make-icons.ps1`.
