Card Vault modular v263

Fix:
- Detailansicht zeigt niemals API-Bilder.
- Kartenreport nutzt ebenfalls keine API-Bilder mehr.
- cardImages(card) gibt nur noch eigene hochgeladene Bilder zurück, die als data:image/... in card.images gespeichert sind.
- API-Bilder bleiben für Galerie/Übersicht möglich, aber nicht für Detailansicht.
- Wenn keine eigenen Bilder vorhanden sind, steht in der Detailansicht „Kein eigenes Bild hinterlegt“.
- Basis: v262.
- CSS/JS mit ?v=263 cache-gebustet.
- JavaScript-Syntax geprüft.

Wichtig:
Wenn eine Karte keine eigenen Bilder in card.images enthält, muss sie einmal mit Vorder-/Rückseite neu gespeichert werden.
