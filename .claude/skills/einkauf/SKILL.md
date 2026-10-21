---
name: einkauf
description: Liest und ändert die gemeinsamen Einkaufslisten der Einkaufs-App (pro Laden, z. B. Kaufland, Netto, Edeka). Verwenden, wenn die Nutzerin etwas auf eine Einkaufsliste setzen, abhaken, löschen, verschieben oder die Liste sehen will, z. B. „setz Milch auf Kaufland“, „was steht auf der Netto-Liste?“, „Butter hab ich, abhaken“.
---

# Einkaufslisten bearbeiten

Alle Änderungen gehen über `node einkauf-app/cli.mjs` (im Repo-Hauptordner ausführen). Das Werkzeug schreibt direkt in die gemeinsame Firebase-Datenbank; Mama sieht Änderungen sofort in der App, als „<Name> (über Claude)“.

## Befehle

```bash
node einkauf-app/cli.mjs liste                      # alle Läden, offene Einträge
node einkauf-app/cli.mjs liste kaufland             # ein Laden mit Abteilungen, Hinweisen, wer es eingetragen hat
node einkauf-app/cli.mjs neu kaufland "2 Liter Milch, Eier, Brot"
node einkauf-app/cli.mjs neu netto "Kaffee" --dringend --notiz "Jacobs Krönung"
node einkauf-app/cli.mjs ab kaufland "milch"        # abhaken; zurueck = wieder auf die Liste
node einkauf-app/cli.mjs weg kaufland "eier"        # löschen
node einkauf-app/cli.mjs verschieben kaufland "butter" netto
node einkauf-app/cli.mjs aufraeumen kaufland        # abgehakte Einträge entfernen
node einkauf-app/cli.mjs laden-neu "Apotheke"
```

- Ladennamen dürfen abgekürzt und kleingeschrieben sein („kauf“ → Kaufland).
- Mehrere Einträge in einem Aufruf mit Komma trennen. Mengen vorne mitschreiben („3 Paprika“), die Abteilung rät das Werkzeug selbst.
- Schon offene Einträge werden nicht doppelt angelegt.

## Ablauf

1. Sagt die Nutzerin keinen Laden, zuerst `liste` aufrufen und nachfragen, auf welche Liste es soll (oder den einzigen Laden nehmen).
2. Nach jeder Änderung kurz auf Deutsch bestätigen, was jetzt wo steht.
3. Löschen und `aufraeumen` nur, wenn sie es so gesagt hat. Abhaken ist harmlos und lässt sich mit `zurueck` rückgängig machen.

## Wenn die Verbindung fehlt

Meldet das Werkzeug „Noch keine Familienliste verbunden“, die Nutzerin nach dem 10-stelligen Code fragen (in der App unter ⚙ → Code) und dann:

```bash
node einkauf-app/cli.mjs code <code> <ihr Vorname>
```

Der Code ist der Schlüssel zur Liste: niemals ins Repo schreiben oder committen. Er liegt in `~/.einkauf.json` (oder in der Umgebungsvariable `EINKAUF_CODE`, z. B. in einer Cloud-Umgebung).
