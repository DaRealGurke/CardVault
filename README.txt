Card Vault modular v252

Fix:
- Löschen großer Karten mit hochauflösenden Bildern repariert.
- Ursache war sehr wahrscheinlich das localStorage-Speicherlimit beim Speichern in den Papierkorb.
- Papierkorb speichert bei großen Karten keine vollständigen Bilddaten mehr.
- Falls der Papierkorb wegen Speicherlimit trotzdem nicht gespeichert werden kann, wird die Karte trotzdem gelöscht und eine Warnung angezeigt.
- Basis: v251.
- CSS/JS mit ?v=252 cache-gebustet.
- JavaScript-Syntax geprüft.

Hinweis:
- Durch hochauflösende Bilder kann localStorage schnell voll werden.
- Gelöschte Karten mit entfernten Bilddaten können aus dem Papierkorb nicht mehr mit Bildern wiederhergestellt werden.
