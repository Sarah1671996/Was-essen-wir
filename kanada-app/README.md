# Kanada-Reiseplaner

Eine App fürs Handy und den PC, um eine Kanada-Reise zu planen: Route, Tage mit Fahrzeiten, Flüge mit Preiswächter,
Unterkünfte mit „Günstiger finden“, Checkliste, Packliste und Budget.
Adresse auf GitHub Pages: `https://sarah1671996.github.io/Was-essen-wir/kanada-app/`

## Was die App kann

- **Route**: Orte mit Datum von/bis eintragen (aus der Liste mit über 30 Orten oder frei auf der Karte suchen).
  Die App zeigt die Strecke auf der Karte, echte Fahrzeiten zwischen den Orten und Verbesserungen:
  fehlende/doppelte Nächte, sehr lange Fahrten (mit Vorschlag für eine Übernachtung unterwegs), schöne Stopps auf der Strecke,
  eine kürzere Reihenfolge der Orte und „hier lieber fliegen“.
- **Tage**: pro Ort auswählen, was man sehen/machen will (rund 200 Sehenswürdigkeiten sind hinterlegt, eigene Orte gehen auch),
  jeweils als *Muss*, *Gern* oder *Optional*. Die App verteilt alles auf die Tage, sucht die beste Reihenfolge,
  rechnet Uhrzeiten mit Fahrzeit und Mittagspause und sagt, was nicht mehr reinpasst (mit „+1 Nacht“-Knopf).
  Hinweise: früh am Morgen am schönsten (Tag startet dann um 7 Uhr), Reservierung nötig (z. B. Moraine Lake), falsche Jahreszeit,
  „liegt von einem anderen Ort viel näher“. Vorschläge in der Nähe nach Vorlieben: Sehenswürdigkeiten, Natur, Ruhe, Wandern, Tiere,
  Aussicht, Seen, Kultur, Stadt, Kinder, Geheimtipp. Dazu Wetter pro Tag (Vorhersage bzw. wie es letztes Jahr war) und Sonnenaufgang.
- **Kosten**: bei jeder Sehenswürdigkeit steht, ob sie kostenlos ist, den Nationalpark-Pass braucht oder ungefähr wie viel Eintritt kostet
  (Stand 2025/26, ändert sich oft). Pro Tag und Ort zeigt die App die geschätzten Eintritte, unter Mehr → Budget die Summe
  und wie viele Tage man im Nationalpark ist. Der Vorschlags-Filter „🆓 Kostenlos“ zeigt nur Kostenloses.
- **Liste hochladen**: eine Liste mit Wünschen (Text, .txt, .csv) wird automatisch dem passenden Ort zugeordnet;
  bekannte Sehenswürdigkeiten werden auch unter anderen Namen erkannt (z. B. „The Beehive“, „Sulphur Mountain“).
- **Flüge**: passende Suchen aus der Route (auch Gabelflug: rein in Vancouver, raus aus Calgary), mit einem Tipp bei
  Google Flights, Kayak, Momondo oder Skyscanner. **Preiswächter**: Zielpreis festlegen, gefundenen Preis eintragen,
  die App zeigt den Verlauf, erinnert alle paar Tage ans Nachsehen und schlägt Alarm, wenn der Zielpreis erreicht ist.
- **Unterkünfte**: pro Ort Suche bei Airbnb, Booking.com, Vrbo, Expedia, Google Hotels (und Parks-Canada-Camping),
  schon mit Daten, Personen und Höchstpreis. Gebuchte Unterkunft eintragen → „Günstiger finden“ sucht mit denselben Daten
  im Umkreis von ca. 4 km unter dem eigenen Preis pro Nacht. Gefundene Angebote vergleichen, Erinnerung vor Ende der kostenlosen Stornierung.
- **Start**: Countdown, alles Wichtige auf einen Blick (Preisalarm, Stornofrist, fehlende Unterkünfte, was jetzt zu erledigen ist),
  während der Reise „Heute“ mit Navigation zu jedem Punkt.
- **Mehr**: Checkliste (eTA, Mietwagen, Shuttles …) mit Fälligkeit, Packliste, Budget mit CAD-Umrechnung, Kanada-Tipps,
  Tagesplan als Kalenderdatei (.ics), Sicherung als Datei, Abgleich über Reisecode.

## Was sie nicht kann (und warum)

Flug- und Unterkunftsportale geben ihre Preise nicht frei heraus (keine kostenlose Schnittstelle, Abrufen von fremden Seiten ist gesperrt).
Deshalb öffnet die App die fertig ausgefüllte Suche, und den Preis trägt man selbst ein. Für automatische E-Mails bei Preisänderungen
bei Google Flights „Preise beobachten“ einschalten.

## Einmalig: Firestore-Regeln veröffentlichen (für den Reisecode)

Die Regel für die Reisen steht mit in `../essen-match-app/firestore.rules` (Sammlung `reisen`).
Im Ordner `essen-match-app` `firebase deploy --only firestore:rules` ausführen,
oder in der Firebase-Konsole unter **Firestore → Regeln** den Inhalt der Datei einfügen und **Veröffentlichen**.
Ohne Reisecode bleibt alles nur auf dem jeweiligen Gerät.

## Daten von außen

- Fahrzeiten und Straßenverlauf: OSRM-Demoserver auf Basis von OpenStreetMap (ohne Schlüssel, für privaten Gebrauch).
  Offline oder bevor die Zeiten da sind, schätzt die App aus der Luftlinie (dann steht „≈“ davor).
- Karte: OpenStreetMap-Kacheln mit Leaflet. Ortssuche: Nominatim. Wetter: Open-Meteo. Wechselkurs: EZB über Frankfurter.

## Testen

`node serve.mjs . 5177` im übergeordneten Ordner, dann http://localhost:5177/kanada-app/?demo
(`?demo` = ohne Reisecode-Abgleich). Auf dem Startbildschirm „Beispielreise ansehen“ lädt eine fertige Westkanada-Tour.
Nach Änderungen an den App-Dateien in `sw.js` die Version hochzählen (`kanada-v1` → `kanada-v2`).
