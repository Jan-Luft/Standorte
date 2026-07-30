# Standortkarte

## Inhalt
- `index.html`
- `styles.css`
- `app.js`
- `data/standorte.csv`

## Datenbasis
Die Karte nutzt nur geocodierte und freigegebene Zeilen (`GeocodeStatus = ok`).

## Lokal testen
Einfaches Oeffnen per Doppelklick kann je nach Browser CSV-Ladevorgaenge blockieren.
Zuverlaessiger ist ein kleiner lokaler Webserver.

### Option A: VS Code Live Server
- Ordner in VS Code oeffnen
- Extension `Live Server` starten

### Option B: Python-HTTP-Server
Falls spaeter verfuegbar:
- `python -m http.server 8000`
- dann `http://localhost:8000/standortkarte/`

## Hosting
Die Dateien koennen unveraendert auf einem internen Webserver oder Fileserver mit Static Hosting gelegt werden.
