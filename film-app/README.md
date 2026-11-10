# Was gucken wir? – Filme & Serien

Eine App fürs Handy und den PC: merken, was man gesehen hat und noch sehen will, bewerten, und passende Empfehlungen bekommen.
Adresse auf GitHub Pages: `https://sarah1671996.github.io/Was-essen-wir/film-app/`

## Was die App kann

- **Für dich**: Empfehlungen nach deinem Geschmack, mit Begründung („Weil dir *Dark* und *Stranger Things* gefallen haben“)
  und Warnung, wenn etwas einem Titel ähnelt, der dir nicht gefallen hat. Filter Filme/Serien und Genre.
  Oben steht, was du magst und was eher nicht (z. B. „Mystery · düster · Zeitreise“).
- **✨ KI fragen**: freier Wunsch („was Lustiges, kurze Serie, wie Dark“). Die KI (Gemini über Firebase, wie in den anderen Apps)
  kennt fast alle Filme und Serien, auch ganz neue, und bekommt dafür nur die Titel aus deiner Liste mit Bewertung.
- **Schnell bewerten**: bekannte Titel nacheinander – ❤️ Geliebt, 👍 Gut, 👎 Nicht meins, 🔖 Will ich sehen oder „Kenne ich nicht“.
  So lernt die App am schnellsten deinen Geschmack.
- **Suchen**: zuerst im eingebauten Katalog, dann im Internet (Serien über TVmaze, Filme über iTunes/Apple TV). Ohne Suchwort: Stöbern nach Genre.
- **Meine Liste**: Will ich sehen · Schaue ich gerade (bei Serien mit Staffel) · Gesehen · Abgebrochen, sortierbar.
  „🎲 Zufällig was aussuchen“ für Abende ohne Entscheidung.
- **Titel antippen**: Poster, Beschreibung (Wikipedia), Genres und Merkmale, Status, Bewertung, Notiz,
  **📺 Wo läuft das?** (JustWatch zeigt alle Streamingdienste in Deutschland), Trailer und **Ähnliche** Titel.
- **Mehr**: deine Zahlen, Abgleich zwischen Geräten über einen Listen-Code, Sicherung als Datei.

## Wie die Empfehlungen funktionieren

Im Katalog (`catalog.js`, rund 380 Titel) hat jeder Titel Genres und Merkmale (z. B. *düster, zeitreise, miniserie, wahre Geschichte*).
Aus deinen Bewertungen entsteht ein Geschmacksprofil: ❤️ zählt doppelt, 👍 einfach, 👎 negativ, „Will ich sehen“ leicht positiv,
„Interessiert mich nicht“ leicht negativ. Jeder unbekannte Titel bekommt damit Punkte (`recs.js`).
Titel aus der Online-Suche oder der KI zählen mit, sobald sie in deiner Liste stehen.
Neue Titel kommen in den Katalog, indem man in `catalog.js` eine Zeile ergänzt.

## Was sie nicht kann (und warum)

Es gibt keine freie Schnittstelle, die sagt, auf welchem Streamingdienst etwas läuft – deshalb öffnet „Wo läuft das?“ JustWatch.
Die Beschreibungen aus der Serien-Suche (TVmaze) sind manchmal englisch; dann wird zuerst die deutsche Wikipedia versucht.

## Einmalig: Firestore-Regeln veröffentlichen (für den Listen-Code)

Die Regel steht mit in `../essen-match-app/firestore.rules` (Sammlung `filme`).
Im Ordner `essen-match-app` `firebase deploy --only firestore:rules` ausführen,
oder in der Firebase-Konsole unter **Firestore → Regeln** den Inhalt der Datei einfügen und **Veröffentlichen**.
Ohne Listen-Code bleibt alles nur auf dem jeweiligen Gerät (das ist auch so voll benutzbar).

## Testen

`node serve.mjs . 5178` im übergeordneten Ordner, dann http://localhost:5178/film-app/?demo
(`?demo` = ohne Firebase, also ohne KI und Abgleich).
Nach Änderungen an den App-Dateien in `sw.js` die Version hochzählen (`filme-v1` → `filme-v2`).
