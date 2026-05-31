Card Vault modular v260

Fix:
- Bilder werden beim Speichern zuverlässiger übernommen.
- Wenn eine Karte bearbeitet wird, werden vorhandene Bilder wieder in frontImage/backImage/extraImages übernommen.
- Beim Speichern wird images nicht mehr direkt stumpf aus den aktuellen Variablen gebaut, sondern über cv260CurrentFormImages(oldCard).
- Dadurch bleiben alte Bilder erhalten, wenn beim Bearbeiten keine neuen Bilder gesetzt werden.
- Neu hinzugefügte Bilder werden zusammen mit bestehenden Bildern gespeichert.
- Basis: v259.
- CSS/JS mit ?v=260 cache-gebustet.
- JavaScript-Syntax geprüft.

Hinweis:
Falls Bilder in einer früheren Version gar nicht gespeichert wurden, müssen diese einmal neu hochgeladen und gespeichert werden.
