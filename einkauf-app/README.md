# Einkauf

Gemeinsame Einkaufslisten für die Familie, eine Liste pro Laden (Kaufland, Netto, Edeka …).
Was eine Person einträgt, sieht die andere sofort auf ihrem Handy.

Die App liegt im selben Repo wie „Was essen wir?“ und nutzt dasselbe Firebase-Projekt (`../essen-match-app/firebase-config.js`),
aber eine eigene Sammlung `households`. Adresse auf GitHub Pages: `https://DEIN-NAME.github.io/Was-essen-wir/einkauf-app/`

## Einmalig: Firestore-Regeln veröffentlichen

Die Regeln für die Einkaufs-App stehen mit in `../essen-match-app/firestore.rules`.
Entweder im Ordner `essen-match-app` `firebase deploy --only firestore:rules` ausführen,
oder in der Firebase-Konsole unter **Firestore → Regeln** den Inhalt der Datei einfügen und **Veröffentlichen**.

## Aufs Handy holen

1. Adresse öffnen, **Teilen → Zum Home-Bildschirm** (iPhone) bzw. **⋮ → App installieren** (Android).
2. Über das neue Symbol öffnen, Namen eingeben, **Neue Familienliste anlegen**.
3. Oben rechts ⚙ → **Einladung teilen** und den Link an Mama schicken.
   Auf dem iPhone fügt sie die App zuerst zum Home-Bildschirm hinzu und gibt dort den **Code** ein.

## Was die App kann

- Eine Liste pro Laden, mit eigener Farbe. Läden lassen sich umbenennen und löschen (✎ in der Liste).
- Einträge werden automatisch nach Abteilungen sortiert (Obst & Gemüse, Kühlregal, …). Ändert man die Abteilung, merkt sich die App das.
- Menge direkt mittippen: „2 Liter Milch“ wird zu Menge „2 Liter“ und „Milch“.
- Hinweis und **Foto vom Produkt** pro Eintrag, damit es die richtige Marke wird.
- **Dringend** markieren: steht ganz oben und auf der Übersicht.
- **Gab's nicht**: bleibt auf der Liste, die andere Person sieht, dass es nicht da war.
- Auf eine andere Liste verschieben, wenn es im anderen Laden doch günstiger ist.
- Vorschläge beim Tippen und „Oft gekauft“ zum schnellen Wiederhinzufügen.
- „neu von Mama“ zeigt, was seit deinem letzten Blick dazukam.
- Große Schrift (⚙) und Bildschirm bleibt im Laden an.
- Funktioniert auch bei schlechtem Empfang, Änderungen werden nachgeholt.

## Testen

`node serve.mjs . 5175` im übergeordneten Ordner, dann http://localhost:5175/einkauf-app/?demo
(`?demo` = alles nur auf diesem Gerät, ohne Firebase).
Nach Änderungen an den App-Dateien in `sw.js` die Version hochzählen (`einkauf-v1` → `einkauf-v2`).
