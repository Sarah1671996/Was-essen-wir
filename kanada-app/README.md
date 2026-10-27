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
- **Start (Dashboard)**: Countdown, bisher gebucht und voraussichtliche Gesamtkosten, alle gefahrenen Kilometer
  (Etappen + Ausflüge zu Sehenswürdigkeiten, ab der gebuchten Unterkunft), Spritkosten (Verbrauch und Preis einstellbar),
  wohin das Geld geht und wie weit die Buchungen sind.
- **Flüge**: nur direkt bei den Fluggesellschaften (Lufthansa, Air Canada, Condor, Discover, Edelweiss, SWISS, Icelandair,
  KLM, Air France, British Airways). Wohnort eingeben → Abflughäfen nach Entfernung mit Zugzeit, mehrere gleichzeitig wählbar.
  Abfahrtsbahnhof (z. B. Essen Hbf) → die App zeigt, wo der Zug im Flugpreis enthalten ist (Lufthansa Express Rail ab FRA/MUC)
  und wo Rail&Fly extra kostet,
  Gabelflug (rein am ersten, raus am letzten Ort). Die App zeigt, welche Airline die Strecke direkt oder mit Umstieg fliegt,
  und kopiert die Buchungsdaten zum Einfügen. **Preiswächter**: Zielpreis festlegen, gefundenen Preis eintragen,
  die App zeigt den Verlauf, erinnert alle paar Tage ans Nachsehen und schlägt Alarm, wenn der Zielpreis erreicht ist.
- **Mietwagen**: eintragen mit Abholung/Rückgabe, Preis und was versichert ist. Versicherungs-Check (Vollkasko,
  Selbstbeteiligung, Zusatzhaftpflicht, Glas/Reifen, Kilometer …) mit Punkten. Andere Angebote eintragen → Vergleich
  von Preis *und* Schutz („131 € günstiger und gleich gut versichert“).
  **✨ Automatisch ausfüllen** (KI über Firebase AI Logic, wie in der Essens-App): aus Link, Text der Bestätigungsmail,
  Screenshot/PDF oder nur Anbieter + Vermittler. Die App zeigt, woher die Angaben stammen (Buchung, Webseite oder nur geschätzt)
  und was nicht drinstand. Am zuverlässigsten ist der Mailtext; Buchungslinks sind oft nur mit Login lesbar.
  Die Google-Suche für die KI ist im kostenlosen Firebase-Tarif nicht freigeschaltet – dann schätzt die KI aus ihrem Wissen.
- **Restaurants**: im Tagesplan pro Tag Restaurants mittags am Programmpunkt und abends bei der Unterkunft
  (aus OpenStreetMap, ohne Ketten) mit Link zu den Google-Bewertungen. „+ Einplanen“ ersetzt die Mittagspause.
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
- Karte: OpenStreetMap-Kacheln mit Leaflet. Ortssuche: Nominatim. Restaurants: Overpass (OpenStreetMap; die öffentlichen Server sind manchmal überlastet). Wetter: Open-Meteo. Wechselkurs: EZB über Frankfurter.

## Testen

`node serve.mjs . 5177` im übergeordneten Ordner, dann http://localhost:5177/kanada-app/?demo
(`?demo` = ohne Reisecode-Abgleich). Auf dem Startbildschirm „Beispielreise ansehen“ lädt eine fertige Westkanada-Tour.
Nach Änderungen an den App-Dateien in `sw.js` die Version hochzählen (`kanada-v1` → `kanada-v2`).

## Neu: KI-Auslesen, Zeitzonen, gemeinsames Planen, Ausgaben

- **✨ Auslesen per KI** (Gemini über Firebase, nicht im Demo-Modus): Unterkunfts-Buchung (Mail, Screenshot, PDF, öffentlicher Link) →
  Formular ausgefüllt, Adresse auf der Karte gesucht, passendem Ort zugeordnet. Flugbuchung → als gebucht eingetragen,
  Ankunftszeit (+1,5 h) und Rückflug (−3 h) in den Tagesplan übernommen. **📷 Preis aus Screenshot** im Preiswächter:
  Screenshot vom Suchergebnis der Airline → Preis landet im Verlauf.
- **Zeitzonen**: Jeder Ort kennt seine Zeitzone (Golden/Radium = Mountain Time). An Reisetagen über eine Zonengrenze stellt der
  Tagesplan die Uhr um und weist darauf hin.
- **Gemeinsam planen**: Stände von zwei Geräten werden Eintrag für Eintrag zusammengeführt; Gelöschtes wird gemerkt (90 Tage),
  damit es nicht zurückkommt.
- **Restaurants** werden 60 Tage auf dem Gerät gemerkt (auch offline).
- **Öffnungszeiten**: übliche Sommer-Schließzeiten von Gondeln, Museen, Bootstouren; der Planer legt Besuche davor und warnt sonst.
  Endet eine Wanderung nach Sonnenuntergang, steht beim Tag ein Hinweis.
- **Ausgaben & Aufteilen** (Mehr): Betrag, Kategorie, wer bezahlt hat, für wen; die App rechnet aus, wer wem was schuldet,
  mit PayPal.Me-Link. Getankte Beträge erscheinen auf dem Dashboard neben der Sprit-Schätzung.
