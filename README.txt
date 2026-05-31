Card Vault modular v259

Fix:
- Bearbeiten übernimmt Kartendaten jetzt robuster.
- Beim Klick auf Bearbeiten wird die komplette Karte kurz in sessionStorage/localStorage zwischengespeichert.
- Auf add.html?edit=... wird das Formular aus dieser zwischengespeicherten Karte befüllt, auch wenn die öffentliche collection.json noch nicht geladen ist.
- Dadurch sollten vorhandene Kartendaten beim Bearbeiten wieder übernommen werden.
- Beim Speichern wird der Zwischenspeicher wieder gelöscht.
- Basis: v258.
- CSS/JS mit ?v=259 cache-gebustet.
- JavaScript-Syntax geprüft.
