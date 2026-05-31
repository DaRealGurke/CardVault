Card Vault modular v257

Fix:
- Bearbeiten erstellt nicht mehr versehentlich eine neue Karte.
- Beim Klick auf Bearbeiten wird eine feste Bearbeitungs-ID gespeichert.
- Beim Speichern wird anhand dieser Bearbeitungs-ID die bestehende Karte überschrieben.
- Lokaler Speicher wird ebenfalls gezielt per Bearbeitungs-ID aktualisiert.
- Nach dem Speichern werden die Bearbeitungsmarker wieder entfernt.
- Basis: v256.
- CSS/JS mit ?v=257 cache-gebustet.
- JavaScript-Syntax geprüft.

Hinweis:
Wenn in früheren Versionen bereits Duplikate entstanden sind, müssen diese einmalig manuell gelöscht werden.
