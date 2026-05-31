Card Vault modular v265

Fix:
- Detailansicht zeigt weiterhin niemals API-Bilder.
- Beim Speichern bleiben die echten hochgeladenen Bilddaten in der aktuellen Kartenansicht erhalten, damit die Detailansicht sie sofort anzeigen kann.
- Zusätzlich werden Bilder in IndexedDB gespeichert und lokal nur als cv-img:-Referenzen abgelegt.
- Dadurch wird localStorage weniger belastet.
- Export der collection.json löst cv-img:-Referenzen wieder zu data:image/... auf.
- Basis: v263.
- CSS/JS mit ?v=265 cache-gebustet.
- JavaScript-Syntax geprüft.

Wichtig:
- Bitte Bilder nach dieser Version einmal neu hochladen und die Karte speichern.
- Danach Detailansicht prüfen.
- Danach collection.json exportieren und bei GitHub hochladen, damit andere Geräte die Bilder sehen.
