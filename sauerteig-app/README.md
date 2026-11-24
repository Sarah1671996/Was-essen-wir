# Sauerteig

Backplan rückwärts vom Ofen aus, Mengen pro Brotsorte (Klassisch, Kräuterbutter, Kinderschokolade, Körnerbrot,
Oliven & Rosmarin, Dinkel-Vollkorn) und ein Starter-Tagebuch mit Erinnerungen ans Füttern, auch im Kühlschrank-Modus.

Adresse auf GitHub Pages: `https://sarah1671996.github.io/Was-essen-wir/sauerteig-app/`

## Aufs Handy holen

1. Adresse in Chrome öffnen, **⋮ → App installieren**.
2. Über das neue Symbol öffnen, Tab **Mein Starter** → **Benachrichtigungen erlauben** → **Test-Benachrichtigung**.

## Wie die Erinnerungen funktionieren

- Die App rechnet die nächsten Erinnerungen aus (Starter füttern, auf Wunsch jeder Schritt des Backplans) und speichert sie
  zusammen mit dem Push-Token in Firestore unter `sauerteig/<code>` (Felder `due` und `next`).
- `functions/index.js` → `sauerteigReminders` schaut alle 5 Minuten nach fälligen Erinnerungen und verschickt sie,
  `sauerteigOnWrite` schickt sofort, was beim Speichern schon fällig ist, und die Test-Benachrichtigung.
- In der Starter-Erinnerung gibt es den Knopf **Gerade gefüttert**: öffnet die App mit `#fed` und trägt die Fütterung ein.
- Ohne Firebase (offline beim Start) läuft alles auf dem Gerät, nur ohne Erinnerungen.

## Mehrere Geräte

Unter **Mein Starter → Auf einem anderen Gerät** steht der 10-stellige Code. Auf dem zweiten Gerät eingeben und **Übernehmen**.

## Einmalig veröffentlichen

Regeln und Server-Funktionen (im Hauptordner):

```
firebase deploy --only firestore:rules,functions:sauerteigOnWrite,functions:sauerteigReminders
```

## Testen

`node serve.mjs . 5178` im übergeordneten Ordner, dann http://localhost:5178/sauerteig-app/
Nach Änderungen an den App-Dateien in `sw.js` die Version hochzählen (`sauerteig-v1` → `sauerteig-v2`).
Icons neu zeichnen: `icons/make-icons.ps1`.
