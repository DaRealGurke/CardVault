Card Vault modular v261

Fix:
- Detailansicht nutzt jetzt zentrale Funktion cardImages(card).
- cardImages(card) gibt eigene hochgeladene Bilder aus card.images zuerst zurück.
- API-Bild wird nur noch als Fallback verwendet, wenn keine eigenen Bilder vorhanden sind.
- Dadurch sollten in der Detailansicht Vorderseite/Rückseite aus deinen hochgeladenen Bildern erscheinen.
- Basis: v260.
- CSS/JS mit ?v=261 cache-gebustet.
- JavaScript-Syntax geprüft.

Hinweis:
Wenn eine Karte gar keine eigenen Bilder in card.images enthält, können sie auch nicht angezeigt werden.
Dann bitte die Bilder einmal neu hochladen und die Karte speichern.
