Card Vault modular v251

Änderung:
- Basis: v250.
- Hochgeladene eigene Kartenbilder werden jetzt deutlich größer gespeichert:
  CARD_IMAGE_TARGET_WIDTH = 2400
  CARD_IMAGE_TARGET_HEIGHT = 3354
  CARD_IMAGE_JPEG_QUALITY = 0.95
- Vorher waren es nur 630 x 880 px mit JPEG 0.9.
- Dadurch bleiben feine Details bei Scans/Fotos besser sichtbar.
- Galerie nutzt weiterhin die bestehende Darstellung/API-Bilder; eigene Bilder sind vor allem für Detailansicht/Prüfung gedacht.
- CSS/JS mit ?v=251 cache-gebustet.
- JavaScript-Syntax geprüft.

Hinweis:
- Bereits gespeicherte Bilder werden dadurch nicht automatisch besser.
- Für höhere Qualität müssen die Kartenbilder nach dieser Version neu hochgeladen/neu gespeichert werden.
- Die exportierte collection.json wird dadurch deutlich größer.
