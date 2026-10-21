# Was essen wir?

Eine kleine App für zwei (oder mehr): Ihr swipt durch Gerichte, und was euch beiden schmeckt, landet bei den Matches.
Dazu gibt es Freitext-Wünsche und eine Gerichteliste, in der ihr eigene Gerichte mit Foto und Rezept anlegt.

Die App ist eine Web-App (PWA). Sie läuft im Browser und lässt sich auf dem Handy wie eine normale App zum Startbildschirm hinzufügen.
Gehostet wird sie auf **GitHub Pages**, die gemeinsamen Daten liegen in **Firebase**. Beides ist für diesen Zweck kostenlos.

Ohne Firebase läuft die App im **Demo-Modus**: Sie funktioniert dann, aber alles bleibt nur auf dem einen Gerät.

---

## Schritt 1: Auf GitHub hochladen

1. Auf github.com oben rechts **+ → New repository**, Name z. B. `was-essen-wir`, **Public**, dann **Create repository**.
2. Auf der leeren Repo-Seite **uploading an existing file** anklicken.
3. **Alle Dateien und den Ordner `icons` aus diesem Ordner** in das Fenster ziehen, dann **Commit changes**.
4. Im Repo **Settings → Pages**: unter *Branch* `main` und `/ (root)` wählen, **Save**.
5. Nach 1–2 Minuten steht dort die Adresse, z. B. `https://DEIN-NAME.github.io/was-essen-wir/`.

Die App läuft jetzt schon im Demo-Modus.

## Schritt 2: Firebase einrichten (für gemeinsame Daten)

1. Auf https://console.firebase.google.com mit einem Google-Konto anmelden und **Projekt erstellen**. Google Analytics kannst du ausschalten.
2. In der Projektübersicht auf das Symbol **</>** (Web-App hinzufügen) klicken. Gib einen Spitznamen ein, *Firebase Hosting* bleibt aus, dann **App registrieren**.
3. Firebase zeigt einen Block `const firebaseConfig = { ... }`. Übernimm die Werte in die Datei **`firebase-config.js`**.
4. Links **Build → Authentication → Jetzt starten → Anmeldemethode → Anonym** aktivieren und speichern.
5. Unter **Authentication → Einstellungen → Autorisierte Domains → Domain hinzufügen** trägst du `DEIN-NAME.github.io` ein.
6. Links **Build → Firestore Database → Datenbank erstellen**:
   - Standort: `europe-west3 (Frankfurt)`
   - Modus: **Produktionsmodus**
7. In Firestore auf den Reiter **Regeln** gehen, den Inhalt durch den Inhalt der Datei **`firestore.rules`** ersetzen und auf **Veröffentlichen** klicken.
8. Die geänderte `firebase-config.js` auf GitHub hochladen: Datei im Repo öffnen, auf den Stift klicken, Inhalt ersetzen und **Commit changes**.

Der `apiKey` in `firebase-config.js` ist kein Geheimnis. Er darf öffentlich auf GitHub stehen.
Geschützt werden die Daten durch die Regeln aus Schritt 7. Eine Küche kann nur öffnen, wer ihren 10-stelligen Code kennt.

## Schritt 3: Aufs Handy holen

**iPhone (Safari):** Öffne die Adresse, tippe auf **Teilen → Zum Home-Bildschirm** und dann auf das neue Symbol.
**Android (Chrome):** Öffne die Adresse und wähle im Menü **⋮ → App installieren** bzw. **Zum Startbildschirm hinzufügen**.

Öffne die App danach über das Symbol. Gib deinen Namen ein und tippe auf **Neue Küche anlegen**.

## Schritt 4: Deinen Freund einladen

Tippe in der App oben rechts auf deinen Kreis. Dort findest du den **Einladungslink** und den **Code**.

> Wichtig fürs iPhone: Die App auf dem Home-Bildschirm hat einen eigenen Speicher, getrennt von Safari.
> Dein Freund fügt die App deshalb erst zum Home-Bildschirm hinzu, öffnet sie dort und gibt den **Code** unter „mit Code beitreten“ ein.

## Gerichte und Rezepte pflegen

- Unter **Gerichte → + Neu** legst du ein Gericht mit Foto, Zutaten, Zubereitung und optionalem Link an. Ein Foto kannst du direkt mit der Kamera machen.
- Ein Gericht öffnest du mit einem Tipp, über **Bearbeiten** änderst oder löschst du es.
- Unter **Wünsche** kann jeder frei reinschreiben, worauf er Lust hat. Mit **Zum Stapel** wird daraus ein Gericht zum Swipen.
- Fotos werden automatisch verkleinert (auf etwa 100–400 KB). Der kostenlose Firebase-Speicher reicht für mehrere Tausend Gerichte.
- Die Startgerichte jeder neuen Küche stehen in `starter-dishes.js`.

## Gut zu wissen

- Die Anmeldung läuft unsichtbar und anonym pro Gerät. Wer die Website-Daten bzw. die App löscht, tritt danach mit dem Code neu bei. Die eigenen alten Swipes sind dann weg, die Gerichte bleiben.
- Nach Änderungen an den App-Dateien zählst du in `sw.js` die Version hoch (`essen-v1` → `essen-v2`), damit die Handys die neue Fassung laden.
- Zum lokalen Testen gibt es im übergeordneten Ordner `serve.mjs` (`node serve.mjs`, dann http://localhost:5173).
