# Wir zwei

Eine Date-App für zwei. Ihr wischt durch Date-Ideen, und wenn ihr beide bei einer Idee ♥ wählt, landet sie bei „Unsere Dates“ und kann gleich geplant werden.
Dazu stellt die App jeden Tag Fragen, damit ihr euch (wieder) besser kennenlernt.

Die App liegt im selben Repo wie „Was essen wir?“ und nutzt dasselbe Firebase-Projekt (`../essen-match-app/firebase-config.js`),
aber eine eigene Sammlung `couples`. Adresse auf GitHub Pages: `https://sarah1671996.github.io/Was-essen-wir/date-app/`

## Einmalig: Firestore-Regeln veröffentlichen

Die Regeln für die Date-App stehen mit in `../essen-match-app/firestore.rules`.
Entweder im Ordner `essen-match-app` `firebase deploy --only firestore:rules` ausführen,
oder in der Firebase-Konsole unter **Firestore → Regeln** den Inhalt der Datei einfügen und **Veröffentlichen**.

## Aufs Handy holen

1. Adresse öffnen, **Teilen → Zum Home-Bildschirm** (iPhone) bzw. **⋮ → App installieren** (Android).
2. Über das neue Symbol öffnen, Namen eingeben, **Loslegen**.
3. Oben rechts ⚙ → **Einladung teilen** und den Link an deinen Freund schicken.
   Auf dem iPhone fügt er die App zuerst zum Home-Bildschirm hinzu und gibt dort den **Code** ein.

## Was die App kann

- **Ideen**: rund 70 Date-Ideen als Kartenstapel. Rechts wischen (♥) = Lust drauf, links (✕) = eher nicht, ↻ = später nochmal.
- **Worauf habt ihr Lust?**: Auswahl nach Ort (Zuhause, Drinnen, Draußen, Ausflug), Kosten (umsonst bis teuer), Zeit und Stimmung.
- **Eigene Ideen** anlegen, jede Idee bearbeiten oder löschen (Karte antippen).
- **Unsere Dates**: was ihr beide mögt, geplante Dates mit Termin und „Nächstes Date in 3 Tagen“, danach **Erinnerungen** mit Herzen und Notiz.
- **Fragen**: eine Frage nach der anderen, eigene Antworten lassen sich nachlesen und ändern.

## Der Planer (versteckt)

Für deinen Freund sieht die App ganz normal aus. Den Planer öffnest du, indem du **das Herz oben links lange gedrückt hältst** (gut 1 Sekunde).
Beim ersten Mal legst du einen Code (mindestens 4 Ziffern) fest, danach fragt die App nur noch nach dem Code.
Wer den Code einmal eingegeben hat, sieht die App selbst ohne Anpassungen; alle anderen sind „Partner“.

Im Planer kannst du:
- sehen, bei welchen Ideen er ♥ oder ✕ gewählt hat,
- Ideen für ihn **bevorzugt** zeigen, vor ihm **verstecken** oder ihm mit **eigenem Titel/Text** zeigen (Idee antippen, unten „Nur für …“),
- **Ideen nur für ihn** anlegen (kommen bei ihm zuerst),
- seine **Antworten** auf die Fragen lesen und **eigene Fragen** stellen, die bei ihm als Nächstes kommen und wie normale Fragen aussehen.

Oben steht im Planer „🔒 Planer · schließen“. Er schließt sich auch von selbst, wenn die App länger als 2 Minuten im Hintergrund war.

Gut zu wissen: Das versteckt die Funktionen nur in der Oberfläche. Wer sich mit Technik auskennt, könnte sie im Quelltext finden (das Repo ist öffentlich).

## Sicherheit

- Ein Paar ist nur mit seinem 10-stelligen Code erreichbar; Auflisten aller Paare ist verboten.
- Die Firestore-Regeln nehmen nur an, was die App selbst schreibt: feste Felder, begrenzte Längen.
- Der Planer-Code wird nicht gespeichert, nur ein daraus abgeleiteter Prüfwert (PBKDF2).

## Testen

`node serve.mjs . 5175` im übergeordneten Ordner, dann http://localhost:5175/date-app/?demo
(`?demo` = alles nur auf diesem Gerät, ohne Firebase).
Nach Änderungen an den App-Dateien in `sw.js` die Version hochzählen (`date-v1` → `date-v2`).
