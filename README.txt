Card Vault modular v264

Fix:
- Eigene hochgeladene Bilder werden beim Speichern zusätzlich in IndexedDB gespeichert.
- In card.images stehen danach platzsparende cv-img:-Referenzen.
- Detailansicht lädt die Bilder aus IndexedDB und zeigt weiterhin niemals API-Bilder.
- API-Bilder bleiben nur für Galerie/Übersicht möglich.
- Export der collection.json löst cv-img:-Referenzen wieder zu data:image/... auf, damit die Bilder nach GitHub-Upload auf anderen Geräten sichtbar sind.
- Basis: v263.
- CSS/JS mit ?v=264 cache-gebustet.
- JavaScript-Syntax geprüft.

Wichtig:
- Bereits vorher gespeicherte Karten ohne Bilder müssen einmal neu mit Bildern gespeichert werden.
- Nach dem Speichern Export verwenden, damit die Bilder in collection.json landen.
