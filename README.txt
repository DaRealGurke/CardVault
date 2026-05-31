Card Vault modular v262

Fix:
- Lokale Änderungen/Bilder überschreiben jetzt die öffentliche Version derselben Karte.
- Vorher konnte die öffentliche Karte aus data/collection.json die lokale Version mit hochgeladenen Bildern verdrängen.
- Detailansicht nutzt weiterhin eigene Bilder aus card.images zuerst.
- API-Bild wird nur als Fallback genutzt, wenn keine eigenen Bilder vorhanden sind.
- Status im Optionen-Menü zeigt jetzt lokale Änderungen und lokale Zusatzkarten getrennt.
- Basis: v261.
- CSS/JS mit ?v=262 cache-gebustet.
- JavaScript-Syntax geprüft.

Wichtig:
Wenn eine Karte lokal hochgeladene Bilder hat, sollte sie nach dem Laden als lokale Änderung über der öffentlichen Version liegen.
Danach collection.json exportieren und bei GitHub hochladen, damit die Bilder auf allen Geräten erscheinen.
