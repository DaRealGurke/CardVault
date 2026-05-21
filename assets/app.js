
    window.addEventListener("error", event => {
      const box = document.getElementById("appErrorBox");
      const message = event && event.error && event.error.stack
        ? event.error.stack
        : ((event && event.message) ? event.message : "Unbekannter Scriptfehler");
      if (box) {
        box.style.display = "block";
        box.textContent = "Fehler: " + message;
      }
      console.error(event.error || event.message || event);
    });

    window.addEventListener("unhandledrejection", event => {
      const box = document.getElementById("appErrorBox");
      const reason = event.reason && event.reason.stack ? event.reason.stack : String(event.reason || "Unbekannter Promise-Fehler");
      if (box) {
        box.style.display = "block";
        box.textContent = "Fehler: " + reason;
      }
      console.error(event.reason || event);
    });


    const TRASH_KEY = "cardVaultTrash";
    window.addEventListener("error", function(event) {
      const box = document.getElementById("appErrorBox");
      const detail = event && event.error && event.error.stack ? event.error.stack : (event && event.message ? event.message : "Unbekannter Scriptfehler");
      if (box) {
        box.style.display = "block";
        box.textContent = "Fehler: " + detail;
      }
      console.error(event.error || event.message || event);
    });

    const STORAGE_KEY = "cardVaultStableV1";

    let cards = loadCards();
    let trashCards = loadTrash();
    let editingId = null;
    let currentMarkerSide = "front";
    let fineMode = false;
    let fineCenter = { x: 50, y: 50 };
    let fineCropReady = false;
    let fineCrop = null;
    let frontImage = "";
    let backImage = "";
    let extraImages = [];
    let currentDetailCard = null;
    let currentDamageSide = "front";
    let currentZoom = { card: null, side: "front", point: null, level: 800 };
    let activeQuickFilter = "all";
    let formTags = [];
    let formTimeline = [];
    let activeTagFilter = "";
    let activeGradingProfile = "normal";
    let currentDetailImageIndex = 0;
    let currentDetailOrder = [];
    let selectionMode = false;
    let selectedCardIds = new Set();
    let lastRenderedCardIds = [];
    let compactView = true;
    let pendingImportCards = [];
    let cardmarketPrices = loadCardmarketPrices();
    let cardmarketProducts = loadCardmarketProducts();
    let isImportingCardmarketPrices = false;
    let isImportingCardmarketCatalog = false;
    let selectedCatalogProduct = null;
    let quickSelectedCatalogProduct = null;
    let editingDamage = null;
    let damageEditCloseupData = "";
    let draggingMarker = null;

    function $(id) { return document.getElementById(id); }

    function demoCards() {
      return [
        {
          id: "COL-2026-0001",
          name: "Monkey D. Luffy",
          number: "OP05-060",
          set: "OP05 – Awakening of the New Era",
          rarity: "SEC",
          language: "Japanese",
          status: "Behalten",
          grade: "8.5",
          condition: "Near Mint",
          storage: "Binder 1 / Seite 4",
          value: "320 €",
          notes: "Demo-Karte. Lade eigene Bilder hoch, um die Schadensfunktion zu testen.",
          images: [],
          damageFront: [{ x: 14, y: 10, label: "Whitening oben links" }],
          damageBack: [],
          favorite: true,
          createdAt: "2026-01-10T10:00:00.000Z"
        }
      ];
    }

    function loadCards() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : demoCards();
      } catch {
        return demoCards();
      }
    }

    function loadTrash() {
      try {
        return JSON.parse(localStorage.getItem("cardVaultTrash") || "[]");
      } catch {
        return [];
      }
    }

    function saveTrash() {
      localStorage.setItem("cardVaultTrash", JSON.stringify(trashCards));
      updateTrashButton();
    }

    function updateTrashButton() {
      const btn = $("openTrashBtn");
      if (!btn) return;
      btn.textContent = trashCards.length ? "Papierkorb (" + trashCards.length + ")" : "Papierkorb";
    }

    function moveCardToTrash(card, reason = "gelöscht") {
      const deleted = JSON.parse(JSON.stringify(card));
      deleted.deletedAt = new Date().toISOString();
      deleted.deleteReason = reason;
      trashCards.unshift(deleted);
      saveTrash();
    }

    function restoreTrashCard(id) {
      const index = trashCards.findIndex(card => card.id === id);
      if (index < 0) return;

      const restored = trashCards.splice(index, 1)[0];
      delete restored.deletedAt;
      delete restored.deleteReason;

      if (cards.some(card => card.id === restored.id)) {
        restored.id = nextDuplicateId(restored.id);
      }

      restored.updatedAt = new Date().toISOString();
      cards.unshift(restored);
      saveCards();
      saveTrash();
      renderStats();
      enforceGalleryView();
      renderCards();
      updateMobileNav("overviewPage");
      initializePendingEdit();
      syncFloatingSaveBar();
      updateScrollTopButton();
      maybeAutoLoadCardmarketData();
      renderTrash();
    }

    function deleteTrashCardForever(id) {
      if (!confirm("Diese Karte endgültig löschen?")) return;
      trashCards = trashCards.filter(card => card.id !== id);
      saveTrash();
      renderTrash();
    }

    function restoreAllTrash() {
      if (!trashCards.length) return;

      const restored = trashCards.map(card => {
        const copy = JSON.parse(JSON.stringify(card));
        delete copy.deletedAt;
        delete copy.deleteReason;
        if (cards.some(existing => existing.id === copy.id)) {
          copy.id = nextDuplicateId(copy.id);
        }
        copy.updatedAt = new Date().toISOString();
        return copy;
      });

      cards = restored.concat(cards);
      trashCards = [];
      saveCards();
      saveTrash();
      renderStats();
      renderCards();
      renderTrash();
    }

    function emptyTrash() {
      if (!trashCards.length) return;
      if (!confirm("Papierkorb endgültig leeren?")) return;
      trashCards = [];
      saveTrash();
      renderTrash();
    }

    function renderTrash() {
      const list = $("trashList");
      if (!list) return;

      if (!trashCards.length) {
        list.innerHTML = '<div class="trash-empty">Der Papierkorb ist leer.</div>';
        return;
      }

      list.innerHTML = "";
      trashCards.forEach(card => {
        const item = document.createElement("div");
        item.className = "trash-item";
        const image = (card.images || [])[0];

        item.innerHTML = `
          <div class="trash-thumb">${image ? `<img src="${image}" alt="${escapeHtml(card.name || "Karte")}">` : "CARD"}</div>
          <div>
            <div class="trash-name">${escapeHtml(card.name || card.id)}</div>
            <div class="trash-meta">${escapeHtml(card.id)} · gelöscht: ${card.deletedAt ? shortDate(card.deletedAt) : "-"}</div>
          </div>
          <div class="trash-actions">
            <button class="secondary-button" type="button" data-restore-trash="${escapeHtml(card.id)}">Wiederherstellen</button>
            <button class="danger-button" type="button" data-delete-trash="${escapeHtml(card.id)}">Endgültig löschen</button>
          </div>
        `;

        list.appendChild(item);
      });

      list.querySelectorAll("[data-restore-trash]").forEach(button => {
        button.addEventListener("click", () => restoreTrashCard(button.dataset.restoreTrash));
      });

      list.querySelectorAll("[data-delete-trash]").forEach(button => {
        button.addEventListener("click", () => deleteTrashCardForever(button.dataset.deleteTrash));
      });
    }

    function generateId() {
      const existingIds = new Set((cards || []).map(card => String(card.id || "")));
      let id = "";
      do {
        id = "CV-" + new Date().toISOString().slice(0, 10).replace(/-/g, "") + "-" + Math.random().toString(36).slice(2, 8).toUpperCase();
      } while (existingIds.has(id));
      return id;
    }

    function clearQuickAdd() {
      quickSelectedCatalogProduct = null;
      if ($("quickCatalogSearchInput")) $("quickCatalogSearchInput").value = "";
      if ($("quickCatalogResults")) htmlIfExists("quickCatalogResults", "");
      ["quickName","quickNumber","quickSet","quickValue","quickMarketProductId","quickTags"].forEach(id => {
        if ($(id)) $(id).value = "";
      });
      if ($("quickStatus")) $("quickStatus").value = "Behalten";
    }

    function openQuickAdd() {
      clearQuickAdd();
      $("quickAddBackdrop").classList.add("active");
      setTimeout(() => {
        if ($("quickName")) $("quickName").focus();
      }, 80);
    }

    function closeQuickAdd() {
      $("quickAddBackdrop").classList.remove("active");
    }

    function quickTags() {
      return String($("quickTags") ? $("quickTags").value : "")
        .split(",")
        .map(tag => tag.trim())
        .filter(Boolean);
    }

    function fillFullFormFromQuick() {
      resetForm();
      $("cardName").value = $("quickName").value.trim();
      $("cardNumber").value = $("quickNumber").value.trim();
      if ($("cardmarketProductId") && $("quickMarketProductId")) $("cardmarketProductId").value = $("quickMarketProductId").value.trim();
      $("cardSet").value = $("quickSet").value.trim();
      if ($("cardRarity") && $("quickRarity")) $("cardRarity").value = $("quickRarity").value.trim();
      $("cardValue").value = $("quickValue").value.trim();
      $("cardStatus").value = $("quickStatus").value;
      formTags = quickTags();
      renderFormTags();
      updateProfitPreview();
      closeQuickAdd();
      showPage("addPage");
    }

    function saveQuickCard() {
      
      if (!validateGradeField("quickGrade")) return;
const name = $("quickName").value.trim();
      if (!name) {
        alert("Bitte mindestens einen Namen eintragen.");
        return;
      }

      const id = typeof generateId === "function" ? generateId() : ("CV-" + Date.now().toString(36).toUpperCase());
      const now = new Date().toISOString();
      const card = {
        id,
        name,
        number: $("quickNumber").value.trim(),
        marketProductId: $("quickMarketProductId") ? $("quickMarketProductId").value.trim() : "",
        set: $("quickSet").value.trim(),
        rarity: "",
        language: "",
        status: $("quickStatus").value,
        grade: "",
        condition: "",
        storage: "",
        value: $("quickValue").value.trim(),
        purchasePrice: "",
        purchaseDate: "",
        salePrice: "",
        saleDate: "",
        platform: "",
        buyer: "",
        tags: quickTags(),
        timeline: [{ date: todayIsoDate(), text: "Schnellerfassung erstellt", createdAt: now }],
        notes: "Schnellerfassung: Bilder und Bewertung später ergänzen.",
        quality: { centering: "", corners: "", edges: "", surface: "" },
        gradingProfile: activeGradingProfile,
        smartGrade: "",
        images: [],
        damageFront: [],
        damageBack: [],
        favorite: false,
        createdAt: now,
        updatedAt: now
      };

      cards.unshift(card);
      saveCards();
      renderStats();
      renderCards();
      closeQuickAdd();
      showPage("collectionPage");
      if (typeof showToast === "function") showToast("Karte schnell gespeichert: " + id);
    }

    function openTrash() {
      renderTrash();
      $("trashBackdrop").classList.add("active");
    }

    function closeTrash() {
      $("trashBackdrop").classList.remove("active");
    }

    function safeLocalSet(key, value) {
      try {
        localStorage.setItem(key, value);
        return true;
      } catch (error) {
        console.warn("localStorage write failed for", key, error);
        return false;
      }
    }

    function safeLocalRemove(key) {
      try {
        localStorage.removeItem(key);
      } catch (error) {
        console.warn("localStorage remove failed for", key, error);
      }
    }

    
    function normalizeGradeInputValue(value) {
      const raw = String(value || "").trim().replace(",", ".");
      if (!raw) return "";

      const number = Number(raw);
      if (!Number.isFinite(number)) return null;
      if (number < 1 || number > 10) return null;

      const rounded = Math.round(number * 10) / 10;
      return Number.isInteger(rounded) ? String(rounded) : String(rounded.toFixed(1));
    }

    function validateGradeField(fieldId) {
      const field = $(fieldId);
      if (!field) return true;

      const normalized = normalizeGradeInputValue(field.value);
      if (normalized === null) {
        field.focus();
        showImportToast("Bewertung ungültig", "Die Bewertung muss zwischen 1 und 10 liegen.", "error");
        return false;
      }

      field.value = normalized;
      return true;
    }

function saveCards() {
      safeLocalSet(STORAGE_KEY, JSON.stringify(cards));
      safeLocalSet("cardVaultLastChange", new Date().toISOString());
      updateTrashButton();
      updateBackupReminder();
    }

    function daysBetween(dateA, dateB) {
      const a = new Date(dateA).getTime();
      const b = new Date(dateB).getTime();
      if (Number.isNaN(a) || Number.isNaN(b)) return 999;
      return Math.floor(Math.abs(b - a) / (1000 * 60 * 60 * 24));
    }

    function updateBackupReminder() {
      const box = $("backupReminder");
      const text = $("backupReminderText");
      if (!box || !text) return;

      const lastExport = localStorage.getItem("cardVaultLastExport");
      const lastDismiss = localStorage.getItem("cardVaultBackupDismissed");
      const lastChange = localStorage.getItem("cardVaultLastChange");
      const now = new Date().toISOString();

      const changedCards = cards.length > 0;
      const daysSinceExport = lastExport ? daysBetween(lastExport, now) : 999;
      const dismissedRecently = lastDismiss && daysBetween(lastDismiss, now) < 1;

      if (!changedCards || dismissedRecently || daysSinceExport < 7) {
        box.classList.remove("active");
        return;
      }

      box.classList.add("active");
      text.textContent = lastExport
        ? "Backup empfohlen: Dein letzter Export ist ca. " + daysSinceExport + " Tage her."
        : "Backup empfohlen: Du hast noch keinen Export dieser Sammlung erstellt.";
    }

    function markBackupExported() {
      localStorage.setItem("cardVaultLastExport", new Date().toISOString());
      localStorage.removeItem("cardVaultBackupDismissed");
      updateBackupReminder();
    }

    function dismissBackupReminder() {
      localStorage.setItem("cardVaultBackupDismissed", new Date().toISOString());
      updateBackupReminder();
    }

    function applyTheme(theme) {
      const dark = theme === "dark";
      document.body.classList.toggle("dark", dark);
      localStorage.setItem("cardVaultTheme", theme);

      const btn = $("themeToggleBtn");
      if (btn) btn.textContent = dark ? "☀️ Hell" : "🌙 Dunkel";
    }

    function toggleCollectionOptionsMenu(force) {
      const menu = $("collectionOptionsMenu");
      if (!menu) return;

      const shouldOpen = typeof force === "boolean" ? force : !menu.classList.contains("active");
      menu.classList.toggle("active", shouldOpen);
    }

    function closeCollectionOptionsMenu() {
      toggleCollectionOptionsMenu(false);
    }

    function toggleOptionsMenu(force) {
      const menu = $("optionsMenu");
      if (!menu) return;

      const shouldOpen = typeof force === "boolean" ? force : !menu.classList.contains("active");
      menu.classList.toggle("active", shouldOpen);
    }

    function closeOptionsMenu() {
      toggleOptionsMenu(false);
    }

    function toggleTheme() {
      const isDark = document.body.classList.contains("dark");
      applyTheme(isDark ? "light" : "dark");
    }

    function initTheme() {
      const saved = localStorage.getItem("cardVaultTheme") || "light";
      applyTheme(saved);
    }

    function updateMobileNav(pageId) {
      document.querySelectorAll(".mobile-nav-button[data-page]").forEach(button => {
        button.classList.toggle("active", button.dataset.page === pageId);
      });
    }

    function updateScrollTopButton() {
      const button = $("scrollTopBtn");
      if (!button) return;
      button.classList.toggle("active", window.scrollY > 420);
    }



    function currentPageIdFromFile() {
      const file = (window.location.pathname.split("/").pop() || "index.html").toLowerCase();
      if (file.includes("collection")) return "collectionPage";
      if (file.includes("add")) return "addPage";
      if (file.includes("check")) return "checkPage";
      return "overviewPage";
    }

    function markCurrentNav() {
      const current = currentPageIdFromFile();
      document.querySelectorAll(".nav-link").forEach(link => link.classList.toggle("active", link.dataset.page === current));
      updateMobileNav(current);
    }

    function getQueryParam(name) {
      return new URLSearchParams(window.location.search).get(name);
    }

    function isAddPageActiveFile() {
      return Boolean(document.getElementById("addPage"));
    }

    function openEditOnAddPage(id) {
      if (!id) return;
      localStorage.setItem("cardVaultPendingEditId", id);
      if (isAddPageActiveFile()) {
        const card = cards.find(item => item.id === id);
        if (card) editCard(id, true);
      } else {
        window.location.href = "add.html?edit=" + encodeURIComponent(id);
      }
    }

    function pageIdToHref(pageId) {
      const map = {
        overviewPage: "index.html",
        collectionPage: "collection.html",
        addPage: "add.html",
        checkPage: "check.html"
      };
      return map[pageId] || "index.html";
    }

    function goToPageFile(pageId) {
      window.location.href = pageIdToHref(pageId);
    }

    function showPage(pageId) {
      if (!document.getElementById(pageId)) {
        goToPageFile(pageId);
        return;
      }
      document.querySelectorAll(".page").forEach(page => page.classList.toggle("active", page.id === pageId));
      document.querySelectorAll(".nav-link").forEach(link => link.classList.toggle("active", link.dataset.page === pageId));
      updateMobileNav(pageId);
      window.scrollTo({ top: 0, behavior: "smooth" });
      if (pageId === "collectionPage") renderCards();
      if (pageId === "overviewPage") renderStats();
    }

    function escapeHtml(value) {
      return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
    }

    function parseMoney(value) {
      const n = parseFloat(String(value || "0").replace(",", ".").replace(/[^\d.]/g, ""));
      return Number.isNaN(n) ? 0 : n;
    }

    function parseGrade(value) {
      const n = parseFloat(String(value || "0").replace(",", ".").replace(/[^\d.]/g, ""));
      return Number.isNaN(n) ? 0 : n;
    }

    function formatEuro(value) {
      return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);
    }

    function showMessage(text, type = "success") {
      const box = $("toolMessage");
      if (!box) return;
      box.className = "tool-message " + type;
      box.textContent = text;
    }

    function showToast(message) {
      // Fallback für kurze Hinweise, damit Buttons nicht abbrechen.
      const box = $("toolMessage");
      if (box) {
        box.className = "tool-message success";
        box.textContent = message;
      }
    }


    function updateSmartGradePreview() {
      // Diese Datei enthält keine aktive Smart-Grade-Box.
      // Die Funktion bleibt als sichere Brücke erhalten, damit Bearbeiten/Speichern nicht abbrechen.
    }

    function renderSmartGradeBox() {
      // Sichere Brücke für ältere Detailansicht-Aufrufe.
    }

    function calculateSmartGradeForCard() {
      return { grade: "", breakdown: [] };
    }

    function readFile(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = () => {
          const original = String(reader.result || "");
          const img = new Image();

          img.onload = () => {
            // WICHTIG:
            // Alle Bilder werden auf exakt dasselbe Kartenformat gebracht.
            // Dadurch sind Markierung, Detailansicht und Zoom immer deckungsgleich.
            const canvas = document.createElement("canvas");
            canvas.width = 630;
            canvas.height = 880;

            const ctx = canvas.getContext("2d");
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            const scale = Math.min(canvas.width / img.naturalWidth, canvas.height / img.naturalHeight);
            const drawW = img.naturalWidth * scale;
            const drawH = img.naturalHeight * scale;
            const dx = (canvas.width - drawW) / 2;
            const dy = (canvas.height - drawH) / 2;

            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = "high";
            ctx.drawImage(img, dx, dy, drawW, drawH);

            resolve(canvas.toDataURL("image/jpeg", 0.9));
          };

          img.onerror = () => resolve(original);
          img.src = original;
        };

        reader.onerror = () => reject(new Error("Datei konnte nicht gelesen werden."));
        reader.readAsDataURL(file);
      });
    }

    function rotateImageData(dataUrl, direction) {
      return new Promise((resolve, reject) => {
        if (!dataUrl) {
          resolve("");
          return;
        }

        const img = new Image();

        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = 630;
          canvas.height = 880;
          const ctx = canvas.getContext("2d");

          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          /*
            Das Bild ist bereits auf 630x880 normalisiert.
            Beim Drehen wird es direkt auf die volle Kartenfläche gezeichnet,
            damit es nicht bei jeder Rotation kleiner wird.
          */
          ctx.save();
          ctx.translate(canvas.width / 2, canvas.height / 2);
          ctx.rotate(direction === "left" ? -Math.PI / 2 : Math.PI / 2);
          ctx.drawImage(img, -canvas.height / 2, -canvas.width / 2, canvas.height, canvas.width);
          ctx.restore();

          resolve(canvas.toDataURL("image/jpeg", 0.9));
        };

        img.onerror = () => reject(new Error("Bild konnte nicht gedreht werden."));
        img.src = dataUrl;
      });
    }

    async function rotateFront(direction) {
      if (!frontImage) {
        showMessage("Bitte zuerst die Vorderseite hochladen.", "error");
        return;
      }
      frontImage = await rotateImageData(frontImage, direction);
      markersFront = [];
      fineCropReady = false;
      fineCrop = null;
      refreshPreviews();
      showMessage("Vorderseite wurde gedreht. Markierungen wurden zurückgesetzt.", "success");
    }

    async function rotateBack(direction) {
      if (!backImage) {
        showMessage("Bitte zuerst die Rückseite hochladen.", "error");
        return;
      }
      backImage = await rotateImageData(backImage, direction);
      markersBack = [];
      fineCropReady = false;
      fineCrop = null;
      refreshPreviews();
      showMessage("Rückseite wurde gedreht. Markierungen wurden zurückgesetzt.", "success");
    }

    function removeFrontImage() {
      if (!frontImage) {
        showMessage("Es ist keine Vorderseite vorhanden.", "error");
        return;
      }

      if (!confirm("Vorderseite entfernen? Markierungen der Vorderseite werden ebenfalls gelöscht.")) return;

      frontImage = "";
      markersFront = [];
      fineCropReady = false;
      fineCrop = null;
      $("frontFile").value = "";
      refreshPreviews();
      showMessage("Vorderseite wurde entfernt.", "success");
    }

    function removeBackImage() {
      if (!backImage) {
        showMessage("Es ist keine Rückseite vorhanden.", "error");
        return;
      }

      if (!confirm("Rückseite entfernen? Markierungen der Rückseite werden ebenfalls gelöscht.")) return;

      backImage = "";
      markersBack = [];
      fineCropReady = false;
      fineCrop = null;
      $("backFile").value = "";
      refreshPreviews();
      showMessage("Rückseite wurde entfernt.", "success");
    }

    function setImagePreview(el, source, label) {
      if (!el) return;
      if (!source) {
        el.textContent = label;
        return;
      }
      el.innerHTML = "";
      const img = document.createElement("img");
      img.src = source;
      img.alt = label;
      img.onerror = () => { el.textContent = "Bild konnte nicht angezeigt werden"; };
      el.appendChild(img);
    }

    function setCloseupPreview(element, source) {
      if (!element) return;
      if (!source) {
        element.textContent = "Kein Close-up hinterlegt";
        return;
      }
      element.innerHTML = "";
      const img = document.createElement("img");
      img.src = source;
      img.alt = "Close-up";
      img.onerror = () => { element.textContent = "Close-up konnte nicht angezeigt werden"; };
      element.appendChild(img);
    }

    function refreshPreviews() {
      if (!$("frontPreview") && !$("backPreview")) return;
      setImagePreview($("frontPreview"), frontImage, "Vorderseite");
      setImagePreview($("backPreview"), backImage, "Rückseite");
      setImagePreview($("extraPreview"), extraImages[0] || "", "Detailbilder");
      textIfExists("frontStatus", frontImage ? "Vorderseite geladen." : "Kein Bild geladen.");
      textIfExists("backStatus", backImage ? "Rückseite geladen." : "Kein Bild geladen.");
      textIfExists("extraStatus", extraImages.length ? extraImages.length + " Detailbild(er) geladen." : "Keine Detailbilder geladen.");
      const debug = $("coordinateDebug");
      if (debug) debug.textContent = "Noch keine Markierung gesetzt.";

      renderMarkerEditor();
      updateSmartGradePreview();
      updateProfileGradePreview();
    }

    async function handleFrontUpload() {
      const file = $("frontFile").files[0];
      if (!file) return;
      setImagePreview($("frontPreview"), URL.createObjectURL(file), "Vorderseite");
      textIfExists("frontStatus", "Vorderseite wird geladen ...");
      frontImage = await readFile(file);
      refreshPreviews();
      showMessage("Vorderseite wurde geladen und auf Kartenformat normalisiert.");
    }

    async function handleBackUpload() {
      const file = $("backFile").files[0];
      if (!file) return;
      setImagePreview($("backPreview"), URL.createObjectURL(file), "Rückseite");
      textIfExists("backStatus", "Rückseite wird geladen ...");
      backImage = await readFile(file);
      refreshPreviews();
      showMessage("Rückseite wurde geladen und auf Kartenformat normalisiert.");
    }

    async function handleExtraUpload() {
      const files = Array.from($("extraFiles").files || []);
      if (!files.length) return;
      textIfExists("extraStatus", "Detailbilder werden geladen ...");
      for (const file of files) {
        extraImages.push(await readFile(file));
      }
      refreshPreviews();
      showMessage(files.length + " Detailbild(er) wurden geladen.");
    }

    function currentMarkerImage() {
      return currentMarkerSide === "front" ? frontImage : backImage;
    }

    function currentMarkers() {
      return currentMarkerSide === "front" ? markersFront : markersBack;
    }

    let markersFront = [];
    let markersBack = [];

    function startDragMarker(event, index) {
      event.preventDefault();
      event.stopPropagation();

      draggingMarker = {
        side: currentMarkerSide,
        index
      };

      document.body.style.userSelect = "none";
    }

    function moveDragMarker(event) {
      if (!draggingMarker) return;

      const card = $("markerCard");
      const pos = markerPositionFromEvent(event, card);
      const list = getMarkerArray(draggingMarker.side);
      const point = list[draggingMarker.index];

      if (!point) return;

      point.x = Number(pos.x.toFixed(3));
      point.y = Number(pos.y.toFixed(3));
      point.px = Math.round((pos.x / 100) * 630);
      point.py = Math.round((pos.y / 100) * 880);

      renderMarkerEditor();
      updateSmartGradePreview();
      updateProfileGradePreview();

      const debug = $("coordinateDebug");
      if (debug) {
        debug.textContent = "Markierung verschoben:\nSeite: " + (draggingMarker.side === "front" ? "Vorderseite" : "Rückseite") + "\nProzent: " + point.x.toFixed(3) + " / " + point.y.toFixed(3) + "\nPixelbasis: " + point.px + " / " + point.py;
      }
    }

    function endDragMarker() {
      if (!draggingMarker) return;

      draggingMarker = null;
      document.body.style.userSelect = "";
      renderMarkerEditor();
    }

    function renderMarkerEditor() {
      if (!$("markerCard")) return;
      const card = $("markerCard");
      if (!card) return;
      const img = currentMarkerImage();
      const points = currentMarkers();

      if ($("markFrontBtn")) $("markFrontBtn").classList.toggle("active", currentMarkerSide === "front");
      if ($("markBackBtn")) $("markBackBtn").classList.toggle("active", currentMarkerSide === "back");
      if ($("fineModeBtn")) $("fineModeBtn").classList.toggle("active", fineMode);
      if ($("fineArea")) $("fineArea").classList.toggle("active", fineMode);

      setImagePreview(card, img, currentMarkerSide === "front" ? "Vorderseite hochladen" : "Rückseite hochladen");

      points.forEach((point, index) => {
        const dot = document.createElement("div");
        dot.className = "marker-dot draggable";
        dot.textContent = index + 1;
        positionDotByPoint(dot, point);
        dot.addEventListener("mousedown", event => startDragMarker(event, index));
        dot.addEventListener("touchstart", event => {
          if (event.touches && event.touches.length) startDragMarker(event.touches[0], index);
        }, { passive: false });
        card.appendChild(dot);
      });

      if (fineMode && fineCropReady) {
        const rough = document.createElement("div");
        rough.className = "rough-dot";
        positionDotByPoint(rough, fineCenter);
        card.appendChild(rough);
      }

      const list = $("markerList");
      if (!list) return;
      list.innerHTML = "";
      if ($("markerEmpty")) $("markerEmpty").style.display = points.length ? "none" : "block";

      points.forEach((point, index) => {
        const item = document.createElement("div");
        item.className = "marker-item";
        const p = normalizePoint(point);
        item.innerHTML = `
          <div class="marker-item-main">
            <span>${index + 1}. ${escapeHtml(point.label)}</span>
            <div class="damage-meta">
              <span class="damage-badge">${escapeHtml(damageCategory(point))}</span>
              <span class="damage-badge ${severityClass(damageSeverity(point))}">${severityLabel(damageSeverity(point))}</span>
              <span class="damage-badge">${p.x.toFixed(2)}% / ${p.y.toFixed(2)}%</span>
              ${point.closeup ? `<span class="damage-badge">Close-up</span>` : ""}
            </div>
          </div>`;
        const edit = document.createElement("button");
        edit.className = "secondary-button";
        edit.type = "button";
        edit.textContent = "Bearbeiten";
        edit.dataset.damageEditContext = "form";
        edit.dataset.damageEditSide = currentMarkerSide;
        edit.dataset.damageEditIndex = String(index);
        edit.addEventListener("click", event => {
          event.preventDefault();
          event.stopPropagation();
          openDamageEditor("form", currentMarkerSide, index);
        });
        item.appendChild(edit);
        list.appendChild(item);
      });

      updateFineStage(fineCenter.x, fineCenter.y);
    }

    function renderFineCanvasCrop(imgSrc, centerXPercent, centerYPercent) {
      const stage = $("fineStage");
      if (!stage || !imgSrc) return;

      stage.innerHTML = "";

      const canvas = document.createElement("canvas");
      canvas.width = 630;
      canvas.height = 880;
      stage.appendChild(canvas);

      const ctx = canvas.getContext("2d");
      const img = new Image();

      img.onload = function () {
        // Feste Feinzoom-Stufe: 6,5x.
        const zoomFactor = 6.5;
        const cropW = 630 / zoomFactor;
        const cropH = 880 / zoomFactor;

        const centerX = (centerXPercent / 100) * 630;
        const centerY = (centerYPercent / 100) * 880;

        let sx = centerX - cropW / 2;
        let sy = centerY - cropH / 2;

        sx = Math.max(0, Math.min(630 - cropW, sx));
        sy = Math.max(0, Math.min(880 - cropH, sy));

        fineCrop = { sx, sy, cropW, cropH };

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, sx, sy, cropW, cropH, 0, 0, canvas.width, canvas.height);
      };

      img.src = imgSrc;
    }

    function updateFineStage(x, y) {
      fineCenter = { x, y };
      const img = currentMarkerImage();
      const stage = $("fineStage");
      if (!stage) return;

      if (!img) {
        stage.innerHTML = "";
        stage.textContent = "Bild hochladen";
        fineCrop = null;
        return;
      }

      if (!fineCropReady) {
        stage.innerHTML = "";
        stage.textContent = "Erst grob im Kartenbild klicken";
        fineCrop = null;
        return;
      }

      renderFineCanvasCrop(img, x, y);
    }

    function addMarker(x, y) {
      const label = prompt("Beschreibung des Schadens:");
      if (!label || !label.trim()) return;
      const category = prompt("Kategorie des Schadens (Whitening, Kratzer, Druckstelle, Ecke, Kante, Oberfläche, Sonstiges):", "Sonstiges") || "Sonstiges";
      const severityInput = prompt("Schweregrad: leicht, mittel oder stark", "leicht") || "leicht";
      const severity = severityInput.toLowerCase().includes("stark") ? "high" : severityInput.toLowerCase().includes("mittel") ? "medium" : "low";
      const point = {
        x: Number(x.toFixed(3)),
        y: Number(y.toFixed(3)),
        px: Math.round((x / 100) * 630),
        py: Math.round((y / 100) * 880),
        label: label.trim(),
        category: category.trim(),
        severity,
        closeup: ""
      };
      if (currentMarkerSide === "front") markersFront.push(point);
      else markersBack.push(point);
      renderMarkerEditor();
    }

    function markerPositionFromEvent(event, element) {
      const rect = element.getBoundingClientRect();

      const displayX = Math.min(rect.width, Math.max(0, event.clientX - rect.left));
      const displayY = Math.min(rect.height, Math.max(0, event.clientY - rect.top));

      const x = (displayX / rect.width) * 100;
      const y = (displayY / rect.height) * 100;

      return {
        x,
        y,
        px: Math.round((x / 100) * 630),
        py: Math.round((y / 100) * 880)
      };
    }

    function normalizePoint(point) {
      if (point.px !== undefined && point.py !== undefined) {
        return {
          x: (Number(point.px) / 630) * 100,
          y: (Number(point.py) / 880) * 100,
          px: Number(point.px),
          py: Number(point.py),
          label: point.label
        };
      }

      return {
        x: Number(point.x || 0),
        y: Number(point.y || 0),
        px: Math.round((Number(point.x || 0) / 100) * 630),
        py: Math.round((Number(point.y || 0) / 100) * 880),
        label: point.label
      };
    }

    function positionDotByPoint(dot, point) {
      const p = normalizePoint(point);
      dot.style.left = p.x + "%";
      dot.style.top = p.y + "%";
    }

    function severityLabel(value){return value==="high"?"stark":value==="medium"?"mittel":"leicht";}
    function severityClass(value){return value==="high"?"high":value==="medium"?"medium":"low";}
    function damageCategory(point){return point.category||"Sonstiges";}
    function damageSeverity(point){return point.severity||"low";}
    function getMarkerArray(side){return side==="front"?markersFront:markersBack;}
    function setMarkerArray(side,value){if(side==="front")markersFront=value;else markersBack=value;}
    function summarizeDamage(card){const pts=(card.damageFront||[]).concat(card.damageBack||[]);const s={low:0,medium:0,high:0};pts.forEach(p=>{s[damageSeverity(p)]=(s[damageSeverity(p)]||0)+1});return s;}

    function openDamageEditor(context, side, index){
      if (Number.isNaN(index)) return;
      if (context !== "form" && !currentDetailCard) return;
      const list=context==="form"?getMarkerArray(side):(side==="front"?(currentDetailCard.damageFront||[]):(currentDetailCard.damageBack||[]));
      const point=list[index]; if(!point)return;
      editingDamage={context,side,index};
      textIfExists("damageEditKicker", (side==="front"?"Vorderseite":"Rückseite")+" · Markierung "+(index+1));
      $("damageEditLabel").value=point.label||"";
      $("damageEditCategory").value=point.category||"Sonstiges";
      $("damageEditSeverity").value=point.severity||"low";
      damageEditCloseupData = point.closeup || "";
      if ($("damageEditCloseupFile")) $("damageEditCloseupFile").value = "";
      setCloseupPreview($("damageEditCloseupPreview"), damageEditCloseupData);
      $("damageEditBackdrop").style.display="flex";
    }
    function closeDamageEditor(){ $("damageEditBackdrop").style.display="none"; editingDamage=null; damageEditCloseupData=""; }

    function refreshAfterDamageEdit() {
      saveCards();

      if (typeof renderDamageMap === "function") renderDamageMap();
      if (typeof renderCards === "function") renderCards();

      // Diese Version enthält nicht in jeder Datei alle Report-Funktionen.
      // Darum werden sie nur ausgeführt, wenn sie vorhanden sind.
      if (typeof renderReport === "function" && currentDetailCard) if (typeof renderReport === "function") renderReport(currentDetailCard);
      if (typeof renderReviewBox === "function" && currentDetailCard) if (typeof renderReviewBox === "function") renderReviewBox(currentDetailCard);
      if (typeof renderSmartGradeBox === "function" && typeof calculateSmartGradeForCard === "function" && currentDetailCard) {
        renderSmartGradeBox("detailSmartGradeValue", "detailSmartGradeBreakdown", calculateSmartGradeForCard(currentDetailCard));
      }
    }
    function saveDamageEditor(){
      if(!editingDamage)return;
      const label=$("damageEditLabel").value.trim()||"Schaden";
      const category=$("damageEditCategory").value;
      const severity=$("damageEditSeverity").value;
      if(editingDamage.context==="form"){
        const list=getMarkerArray(editingDamage.side);
        if(list[editingDamage.index]){list[editingDamage.index].label=label;list[editingDamage.index].category=category;list[editingDamage.index].severity=severity;}
        renderMarkerEditor();
        updateSmartGradePreview();
      updateProfileGradePreview();
      } else if(currentDetailCard){
        const list=editingDamage.side==="front"?currentDetailCard.damageFront:currentDetailCard.damageBack;
        if(list&&list[editingDamage.index]){list[editingDamage.index].label=label;list[editingDamage.index].category=category;list[editingDamage.index].severity=severity;}
        cards=cards.map(card=>card.id===currentDetailCard.id?currentDetailCard:card);
        refreshAfterDamageEdit();
      }
      closeDamageEditor(); showToast("Markierung aktualisiert");
    }
    function deleteDamageEditor(){
      if(!editingDamage)return;
      if(editingDamage.context==="form"){
        const list=getMarkerArray(editingDamage.side); list.splice(editingDamage.index,1); setMarkerArray(editingDamage.side,list); renderMarkerEditor();
      } else if(currentDetailCard){
        const list=editingDamage.side==="front"?currentDetailCard.damageFront:currentDetailCard.damageBack; if(list)list.splice(editingDamage.index,1);
        cards=cards.map(card=>card.id===currentDetailCard.id?currentDetailCard:card); saveCards(); renderDamageMap(); if (typeof renderReport === "function") if (typeof renderReport === "function") renderReport(currentDetailCard); if (typeof renderReviewBox === "function") if (typeof renderReviewBox === "function") renderReviewBox(currentDetailCard); renderCards();
      }
      closeDamageEditor(); showToast("Markierung gelöscht");
    }

    function resetForm() {
      editingId = null;
      textIfExists("formHeadline", "Karte zur Sammlung hinzufügen");
      textIfExists("saveCardBtn", "Karte speichern");
      syncFloatingSaveBar();
      if ($("cancelEditBtn")) $("cancelEditBtn").style.display = "none";
      ["cardId","cardName","cardNumber","cardmarketProductId","cardSet","cardGrade","cardCondition","cardStorage","cardValue","purchasePrice","purchaseDate","salePrice","saleDate","platform","buyer","cardNotes"].forEach(id => { if ($(id)) $(id).value = ""; });
      if ($("cardLanguage")) $("cardLanguage").selectedIndex = 0;
      if ($("cardStatus")) $("cardStatus").selectedIndex = 0;
      frontImage = "";
      backImage = "";
      extraImages = [];
      markersFront = [];
      markersBack = [];
      if ($("frontFile")) $("frontFile").value = "";
      if ($("backFile")) $("backFile").value = "";
      if ($("extraFiles")) $("extraFiles").value = "";
      selectedCatalogProduct = null;
      if ($("catalogSelectedBox")) {
        $("catalogSelectedBox").classList.remove("active");
        htmlIfExists("catalogSelectedBox", "");
      }
      if ($("catalogSearchResults")) htmlIfExists("catalogSearchResults", "");
      if ($("catalogSearchInput")) $("catalogSearchInput").value = "";
      renderInlineCatalogSelection(null);
      renderInlineCatalogSuggestions([]);
      formTags = [];
      formTimeline = [];
      renderFormTags();
      renderFormTimeline();
      if ($("timelineDate")) $("timelineDate").value = todayIsoDate();
      renderInlineCatalogSelection(null);
refreshPreviews();
    }

    function syncFloatingSaveBar() {
      const bar = $("floatingSaveBar");
      if (!bar) return;

      const save = $("floatingSaveCardBtn");
      const cancel = $("floatingCancelEditBtn");
      const isEditing = Boolean(editingId || getQueryParam("edit") || localStorage.getItem("cardVaultEditingId") || localStorage.getItem("cardVaultPendingEditId"));

      if (save) save.textContent = isEditing ? "Änderungen speichern" : "Karte speichern";
      if (cancel) cancel.style.display = isEditing ? "inline-flex" : "none";
    }

    function saveCard() {
      
      if (!validateGradeField("cardGrade")) return;
const existingEditId = editingId || getQueryParam("edit") || localStorage.getItem("cardVaultEditingId") || localStorage.getItem("cardVaultPendingEditId") || "";
      const idFromField = valueOf("cardId").trim();
      const id = existingEditId || idFromField || (typeof generateId === "function" ? generateId() : ("CV-" + Date.now().toString(36).toUpperCase()));

      const name = valueOf("cardName").trim();
      const number = valueOf("cardNumber").trim();

      if (!name || !number) {
        alert("Bitte mindestens Name und Kartennummer eintragen.");
        return;
      }

      const now = new Date().toISOString();
      const oldCard = cards.find(card => String(card.id) === String(id));

      const card = {
        ...(oldCard || {}),
        id,
        name,
        number,
        marketProductId: valueOf("cardmarketProductId").trim(),
        set: valueOf("cardSet").trim(),
        rarity: valueOf("cardRarity").trim(),
        language: valueOf("cardLanguage").trim(),
        status: valueOf("cardStatus", "Behalten"),
        grade: valueOf("cardGrade").trim(),
        condition: valueOf("cardCondition").trim(),
        storage: valueOf("cardStorage").trim(),
        value: valueOf("cardValue").trim(),
        purchasePrice: valueOf("purchasePrice").trim(),
        purchaseDate: valueOf("purchaseDate").trim(),
        salePrice: valueOf("salePrice").trim(),
        saleDate: valueOf("saleDate").trim(),
        platform: valueOf("platform").trim(),
        buyer: valueOf("buyer").trim(),
        notes: valueOf("cardNotes").trim(),
        tags: Array.isArray(formTags) ? formTags.slice() : [],
        timeline: Array.isArray(formTimeline) ? JSON.parse(JSON.stringify(formTimeline)) : [],
        images: [frontImage, backImage].concat(extraImages || []).filter(Boolean),
        damageFront: JSON.parse(JSON.stringify(markersFront || [])),
        damageBack: JSON.parse(JSON.stringify(markersBack || [])),
        favorite: oldCard ? Boolean(oldCard.favorite) : false,
        createdAt: oldCard ? (oldCard.createdAt || now) : now,
        updatedAt: now
      };

      const existingIndex = cards.findIndex(item => String(item.id) === String(id));

      if (existingIndex >= 0) {
        cards[existingIndex] = card;
        showImportToast("Karte aktualisiert", card.name, "success");
      } else {
        cards.unshift(card);
        showImportToast("Karte gespeichert", card.name, "success");
      }

      saveCards();
      editingId = "";
      localStorage.removeItem("cardVaultEditingId");
      localStorage.removeItem("cardVaultPendingEditId");

      renderStats();
      renderCards();

      resetForm();

      if (isAddPageActiveFile()) {
        window.location.href = "collection.html";
      } else {
        showPage("collectionPage");
      }
    }

    
    function editCard(id, stayOnPage = false) {
      const card = cards.find(item => String(item.id) === String(id));
      if (!card) {
        showImportToast("Karte nicht gefunden", "Die Karte konnte nicht zum Bearbeiten geladen werden.", "error");
        return;
      }

      if (!isAddPageActiveFile() && !stayOnPage) {
        localStorage.setItem("cardVaultPendingEditId", card.id);
        window.location.href = "add.html?edit=" + encodeURIComponent(card.id);
        return;
      }

      editingId = card.id;
      localStorage.setItem("cardVaultEditingId", card.id);

      textIfExists("formHeadline", "Karte bearbeiten");
      textIfExists("saveCardBtn", "Änderungen speichern");
      syncFloatingSaveBar();
      if ($("cancelEditBtn")) $("cancelEditBtn").style.display = "inline-flex";

      setValueIfExists("cardId", card.id || "");
      setValueIfExists("cardName", card.name || "");
      setValueIfExists("cardNumber", card.number || "");
      setValueIfExists("cardmarketProductId", card.marketProductId || card.idProduct || "");
      setValueIfExists("cardSet", card.set || "");
      setValueIfExists("cardRarity", card.rarity || "");
      setValueIfExists("cardLanguage", card.language || "");
      setValueIfExists("cardStatus", card.status || "Behalten");
      setValueIfExists("cardGrade", card.grade || "");
      setValueIfExists("cardCondition", card.condition || "");
      setValueIfExists("cardStorage", card.storage || "");
      setValueIfExists("cardValue", card.value || "");
      setValueIfExists("purchasePrice", card.purchasePrice || "");
      setValueIfExists("purchaseDate", card.purchaseDate || "");
      setValueIfExists("salePrice", card.salePrice || "");
      setValueIfExists("saleDate", card.saleDate || "");
      setValueIfExists("platform", card.platform || "");
      setValueIfExists("buyer", card.buyer || "");
      setValueIfExists("cardNotes", card.notes || "");

      selectedCatalogProduct = null;
      if (card.marketProductId && Array.isArray(cardmarketProducts)) {
        selectedCatalogProduct = cardmarketProducts.find(product => String(product.idProduct) === String(card.marketProductId)) || null;
      }
      if (typeof renderInlineCatalogSelection === "function") renderInlineCatalogSelection(selectedCatalogProduct);

      formTags = Array.isArray(card.tags) ? card.tags.slice() : [];
      formTimeline = Array.isArray(card.timeline) ? JSON.parse(JSON.stringify(card.timeline)) : [];
      frontImage = (card.images || [])[0] || "";
      backImage = (card.images || [])[1] || "";
      extraImages = (card.images || []).slice(2);
      markersFront = JSON.parse(JSON.stringify(card.damageFront || []));
      markersBack = JSON.parse(JSON.stringify(card.damageBack || []));

      if (typeof renderFormTags === "function") renderFormTags();
      if (typeof renderFormTimeline === "function") renderFormTimeline();
      if (typeof refreshPreviews === "function") refreshPreviews();
      if (typeof renderMarkerEditor === "function") renderMarkerEditor();
      if (typeof updateProfitPreview === "function") updateProfitPreview();
      if (typeof updateProfileGradePreview === "function") updateProfileGradePreview();

      window.scrollTo({ top: 0, behavior: "smooth" });
      showImportToast("Bearbeitungsmodus", "Karte wurde zum Bearbeiten geladen.", "success");
    }

    
    function renderStats() {
      if (!$("overviewPage") && !$("collectionPage")) return;
      textIfExists("totalCardsStat", cards.length);
      textIfExists("ratedCardsStat", cards.filter(c => c.grade).length);
      textIfExists("totalValueStat", formatEuro(cards.reduce((sum, c) => sum + parseMoney(c.value), 0)));
      if (typeof renderProDashboard === "function") renderProDashboard();
      if (typeof renderSmartSuggestions === "function") renderSmartSuggestions();
      if (typeof renderRecentDashboard === "function") renderRecentDashboard();
      if (typeof renderDashboardCharts === "function") renderDashboardCharts();
      if (typeof renderDuplicateDashboard === "function") renderDuplicateDashboard();
    }

    function hasHighDamage(card) {
      const points = (card.damageFront || []).concat(card.damageBack || []);
      return points.some(point => point.severity === "high");
    }

    function hasAnyDamage(card) {
      return ((card.damageFront || []).length + (card.damageBack || []).length) > 0;
    }

    function normalizeQuickFilter(value) {
      const hiddenFilters = new Set(["missing-back", "damaged", "high-damage"]);
      return hiddenFilters.has(value) ? "all" : (value || "all");
    }

    function matchesQuickFilter(card) {
      if (activeQuickFilter === "all") return true;
      if (activeQuickFilter === "favorites") return Boolean(card.favorite);
      if (activeQuickFilter === "missing-back") return !(card.images || [])[1];
      if (activeQuickFilter === "damaged") return hasAnyDamage(card);
      if (activeQuickFilter === "high-damage") return hasHighDamage(card);
      if (activeQuickFilter === "grade9") return parseGrade(card.grade) >= 9;
      if (activeQuickFilter === "for-sale") return card.status === "Verkaufen";
      if (activeQuickFilter === "incomplete") return documentationScore(card) < 80;
      if (activeQuickFilter === "duplicates") return cardIsDuplicate(card);
      return true;
    }

    function updateQuickFilterButtons() {
      if ($("saveDetailMarketProductIdBtn")) onIfExists("saveDetailMarketProductIdBtn", "click", saveDetailMarketProductId);

      if ($("cardName")) onIfExists("cardName", "input", debounce(updateInlineCatalogSuggestions, 180));
      if ($("cardNumber")) onIfExists("cardNumber", "input", debounce(updateInlineCatalogSuggestions, 180));
      if ($("cardmarketProductId")) onIfExists("cardmarketProductId", "input", () => {
        if (!$("cardmarketProductId").value.trim()) {
          selectedCatalogProduct = null;
          renderInlineCatalogSelection(null);
        }
      });
      if ($("clearInlineCatalogSelectionBtn")) onIfExists("clearInlineCatalogSelectionBtn", "click", clearInlineCatalogSelection);
      if ($("clearCardmarketInfoBtn")) onIfExists("clearCardmarketInfoBtn", "click", clearInlineCatalogSelection);
      if ($("toggleManualExtraBtn")) onIfExists("toggleManualExtraBtn", "click", toggleManualExtraFields);

      if ($("catalogSearchBtn")) onIfExists("catalogSearchBtn", "click", runCatalogSearch);
      if ($("catalogSearchInput")) onIfExists("catalogSearchInput", "input", debounce(runCatalogSearch, 250));
      if ($("catalogSearchInput")) onIfExists("catalogSearchInput", "keydown", event => {
        if (event.key === "Enter") {
          event.preventDefault();
          runCatalogSearch();
        }
      });
      if ($("quickCatalogSearchInput")) onIfExists("quickCatalogSearchInput", "input", debounce(runQuickCatalogSearch, 250));
      if ($("quickCatalogSearchInput")) onIfExists("quickCatalogSearchInput", "keydown", event => {
        if (event.key === "Enter") {
          event.preventDefault();
          runQuickCatalogSearch();
        }
      });

      if ($("autoLoadCardmarketBtn")) onIfExists("autoLoadCardmarketBtn", "click", () => {
        closeOptionsMenu();
        autoLoadCardmarketData(true, true);
      });
      if ($("clearCardmarketStorageBtn")) onIfExists("clearCardmarketStorageBtn", "click", () => {
        closeOptionsMenu();
        clearCardmarketStorage();
      });
      if ($("cardmarketImportBtn")) onIfExists("cardmarketImportBtn", "click", () => {
        closeOptionsMenu();
        openCardmarketImportPicker();
      });
      if ($("cardmarketCatalogImportBtn")) onIfExists("cardmarketCatalogImportBtn", "click", () => {
        closeOptionsMenu();
        const input = $("cardmarketCatalogFile");
        if (!input) {
          showImportToast("Produktkatalog-Import nicht möglich", "Das Datei-Feld wurde nicht gefunden.", "error");
          return;
        }
        input.click();
      });
      if ($("cardmarketPriceFile")) onIfExists("cardmarketPriceFile", "change", () => {
        const input = $("cardmarketPriceFile");
        const file = input && input.files ? input.files[0] : null;
        if (file) importCardmarketPriceFile(file);
      });
      if ($("cardmarketCatalogFile")) onIfExists("cardmarketCatalogFile", "change", () => {
        const input = $("cardmarketCatalogFile");
        const file = input && input.files ? input.files[0] : null;
        if (file) importCardmarketCatalogFile(file);
      });

      if ($("openQuickAddBtn")) onIfExists("openQuickAddBtn", "click", openQuickAdd);
      if ($("openQuickAddHeroBtn")) onIfExists("openQuickAddHeroBtn", "click", openQuickAdd);
      if ($("closeQuickAddBtn")) onIfExists("closeQuickAddBtn", "click", closeQuickAdd);
      if ($("quickAddBackdrop")) onIfExists("quickAddBackdrop", "click", event => {
        if (event.target === $("quickAddBackdrop")) closeQuickAdd();
      });
      if ($("quickAddSaveBtn")) onIfExists("quickAddSaveBtn", "click", saveQuickCard);
      if ($("quickAddFullBtn")) onIfExists("quickAddFullBtn", "click", fillFullFormFromQuick);
      if ($("quickName")) onIfExists("quickName", "keydown", event => {
        if (event.key === "Enter") saveQuickCard();
      });

      if ($("openTrashBtn")) onIfExists("openTrashBtn", "click", openTrash);
      if ($("closeTrashBtn")) onIfExists("closeTrashBtn", "click", closeTrash);
      if ($("trashBackdrop")) onIfExists("trashBackdrop", "click", event => {
        if (event.target === $("trashBackdrop")) closeTrash();
      });
      if ($("restoreAllTrashBtn")) onIfExists("restoreAllTrashBtn", "click", restoreAllTrash);
      if ($("emptyTrashBtn")) onIfExists("emptyTrashBtn", "click", emptyTrash);

      if ($("importMergeBtn")) onIfExists("importMergeBtn", "click", () => finishImport("merge"));
      if ($("importOnlyNewBtn")) onIfExists("importOnlyNewBtn", "click", () => finishImport("only-new"));
      if ($("importReplaceBtn")) onIfExists("importReplaceBtn", "click", () => finishImport("replace"));
      if ($("importCancelBtn")) onIfExists("importCancelBtn", "click", closeImportChoice);
      if ($("importChoiceBackdrop")) onIfExists("importChoiceBackdrop", "click", event => {
        if (event.target === $("importChoiceBackdrop")) closeImportChoice();
      });

      if ($("toggleSelectModeBtn")) onIfExists("toggleSelectModeBtn", "click", toggleSelectionMode);
      if ($("bulkSelectAllBtn")) onIfExists("bulkSelectAllBtn", "click", selectAllVisible);
      if ($("bulkClearSelectionBtn")) onIfExists("bulkClearSelectionBtn", "click", clearSelection);
      if ($("bulkFavoriteBtn")) onIfExists("bulkFavoriteBtn", "click", toggleBulkFavorite);
      if ($("bulkDeleteBtn")) onIfExists("bulkDeleteBtn", "click", bulkDeleteSelected);

      if ($("openCardReportBtn")) onIfExists("openCardReportBtn", "click", () => {
        if (currentDetailCard) openCardReport(currentDetailCard);
      });
      if ($("closeCardReportBtn")) onIfExists("closeCardReportBtn", "click", closeCardReport);
      if ($("printCardReportBtn")) onIfExists("printCardReportBtn", "click", () => window.print());
      if ($("cardReportBackdrop")) onIfExists("cardReportBackdrop", "click", event => {
        if (event.target === $("cardReportBackdrop")) closeCardReport();
      });

      if ($("fullscreenCloseBtn")) onIfExists("fullscreenCloseBtn", "click", closeFullscreenImage);
      if ($("fullscreenImageBackdrop")) onIfExists("fullscreenImageBackdrop", "click", event => {
        if (event.target === $("fullscreenImageBackdrop")) closeFullscreenImage();
      });

      if ($("refreshSuggestionsBtn")) onIfExists("refreshSuggestionsBtn", "click", renderSmartSuggestions);
      if ($("saveCurrentViewBtn")) onIfExists("saveCurrentViewBtn", "click", saveCurrentView);

      if ($("showDuplicatesBtn")) onIfExists("showDuplicatesBtn", "click", () => {
        showPage("collectionPage");
        activeQuickFilter = "duplicates";
        renderCards();
      });

      if ($("floatingAddBtn")) onIfExists("floatingAddBtn", "click", event => {
        if (document.getElementById("addPage")) {
          event.preventDefault();
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      });
      if ($("toggleFiltersBtn")) onIfExists("toggleFiltersBtn", "click", toggleFilters);
      if ($("resetFiltersBtn")) onIfExists("resetFiltersBtn", "click", resetAllFilters);
      if ($("emptyResetFiltersBtn")) onIfExists("emptyResetFiltersBtn", "click", resetAllFilters);

      document.addEventListener("keydown", event => {
        const target = event.target;
        const typing = target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
        if (event.key === "Escape") {
          closeFullscreenImage();
          if ($("importChoiceBackdrop")) closeImportChoice();
          if ($("trashBackdrop")) closeTrash();
          if ($("cardReportBackdrop")) closeCardReport();
          if ($("quickAddBackdrop")) closeQuickAdd();
          closeOptionsMenu();
          closeCollectionOptionsMenu();
          return;
        }

        if (typing) return;

        if ($("detailBackdrop") && $("detailBackdrop").style.display === "flex") {
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            openAdjacentDetail(-1);
            return;
          }
          if (event.key === "ArrowRight") {
            event.preventDefault();
            openAdjacentDetail(1);
            return;
          }
        }

        if (event.key === "/") {
          event.preventDefault();
          focusSearch();
        }

        if (event.key.toLowerCase() === "n") {
          event.preventDefault();
          showPage("addPage");
        }

        if (event.key.toLowerCase() === "q") {
          event.preventDefault();
          openQuickAdd();
        }

        if (event.key.toLowerCase() === "a") {
          event.preventDefault();
          toggleSelectionMode();
        }
      });

      document.querySelectorAll("[data-quick-filter]").forEach(button => {
        button.classList.toggle("active", button.dataset.quickFilter === activeQuickFilter);
      });
    }

    function renderCollectionAnalysis(filtered) {
      const averageGradeEl = $("averageGradeStat");
      if (!averageGradeEl) return;

      const graded = filtered.map(card => parseGrade(card.grade)).filter(value => value > 0);
      if (graded.length) {
        const avg = graded.reduce((sum, value) => sum + value, 0) / graded.length;
        textIfExists("averageGradeStat", avg.toFixed(1).replace(".", ","));
      } else {
        textIfExists("averageGradeStat", "-");
      }

      if (filtered.length) {
        const avgDoc = filtered.reduce((sum, card) => sum + documentationScore(card), 0) / filtered.length;
        textIfExists("averageDocStat", Math.round(avgDoc) + "%");
      } else {
        textIfExists("averageDocStat", "-");
      }

      textIfExists("valuedCardsStat", filtered.filter(card => parseMoney(card.value) > 0).length);
    }

    function normalizeTag(value) {
      return String(value || "").trim().replace(/\s+/g, " ");
    }

    function renderFormTags() {
      if (!$("formTagsList")) return;
      const list = $("formTagList");
      if (!list) return;

      list.innerHTML = "";
      formTags.forEach((tag, index) => {
        const chip = document.createElement("span");
        chip.className = "custom-tag-chip";
        chip.innerHTML = `${escapeHtml(tag)} <button type="button" title="Tag entfernen">×</button>`;
        chip.querySelector("button").addEventListener("click", () => {
          formTags.splice(index, 1);
          renderFormTags();
        });
        list.appendChild(chip);
      });
    }

    function addFormTag() {
      const input = $("tagInput");
      if (!input) return;

      const raw = normalizeTag(input.value);
      if (!raw) return;

      raw.split(",").map(normalizeTag).filter(Boolean).forEach(tag => {
        if (!formTags.some(existing => existing.toLowerCase() === tag.toLowerCase())) {
          formTags.push(tag);
        }
      });

      input.value = "";
      renderFormTags();
    }

    function allTags() {
      const map = new Map();
      cards.forEach(card => {
        (card.tags || []).forEach(tag => {
          const clean = normalizeTag(tag);
          if (!clean) return;
          const key = clean.toLowerCase();
          map.set(key, clean);
        });
      });
      return Array.from(map.values()).sort((a, b) => a.localeCompare(b));
    }

    function renderTagCloud() {
      if (!$("tagCloud")) return;
      const cloud = $("tagCloud");
      if (!cloud) return;

      const tags = allTags();
      if (!tags.length) {
        cloud.innerHTML = '<span class="hint">Noch keine Tags vorhanden.</span>';
        return;
      }

      cloud.innerHTML = '<button class="tag-cloud-chip ' + (!activeTagFilter ? 'active' : '') + '" type="button" data-tag-filter="">Alle Tags</button>' +
        tags.map(tag => `<button class="tag-cloud-chip ${activeTagFilter.toLowerCase() === tag.toLowerCase() ? "active" : ""}" type="button" data-tag-filter="${escapeHtml(tag)}">#${escapeHtml(tag)}</button>`).join("");

      cloud.querySelectorAll("[data-tag-filter]").forEach(button => {
        button.addEventListener("click", () => {
          activeTagFilter = button.dataset.tagFilter || "";
          renderCards();
        });
      });
    }

    function cardMatchesTag(card) {
      if (!activeTagFilter) return true;
      return (card.tags || []).some(tag => String(tag).toLowerCase() === activeTagFilter.toLowerCase());
    }

    function updateBulkToolbar() {
      const toolbar = $("bulkToolbar");
      const count = $("bulkSelectedCount");
      const toggle = $("toggleSelectModeBtn");

      if (toolbar) toolbar.classList.toggle("active", selectionMode);
      if (count) count.textContent = selectedCardIds.size ? (selectedCardIds.size + " ausgewählt") : "Auswahlmodus aktiv";
      if (toggle) toggle.textContent = selectionMode ? "Auswahlmodus beenden" : "Auswahlmodus";

      const cardsList = $("cardsList");
      if (cardsList) cardsList.classList.toggle("selection-mode", selectionMode);
    }
    function toggleSelectionMode() {
      selectionMode = !selectionMode;
      if (!selectionMode) selectedCardIds.clear();
      renderCards();
    }

    function toggleCardSelected(id) {
      if (selectedCardIds.has(id)) selectedCardIds.delete(id);
      else selectedCardIds.add(id);
      renderCards();
    }

    function clearSelection() {
      selectedCardIds.clear();
      renderCards();
    }

    function selectAllVisible() {
      lastRenderedCardIds.forEach(id => selectedCardIds.add(id));
      renderCards();
    }

    function bulkUpdateSelected(updater) {
      if (!selectedCardIds.size) return;
      cards = cards.map(card => {
        if (!selectedCardIds.has(card.id)) return card;
        const next = JSON.parse(JSON.stringify(card));
        updater(next);
        next.updatedAt = new Date().toISOString();
        return next;
      });
      saveCards();
      renderStats();
      renderCards();
    }

    function bulkDeleteSelected() {
      if (!selectedCardIds.size) return;
      if (!confirm(selectedCardIds.size + " Karte(n) in den Papierkorb verschieben?")) return;
      cards.forEach(card => {
        if (selectedCardIds.has(card.id)) moveCardToTrash(card, "Mehrfachauswahl");
      });
      cards = cards.filter(card => !selectedCardIds.has(card.id));
      selectedCardIds.clear();
      saveCards();
      renderStats();
      renderCards();
    }

    function resetAllFilters() {
      setValueIfExists("searchInput", "");
      setValueIfExists("statusFilter", "");
      setValueIfExists("conditionFilter", "");
      setValueIfExists("favoriteFilter", "");
      setValueIfExists("sortSelect", "newest");
      activeQuickFilter = "all";
      activeTagFilter = "";
      renderCards();
    }

    function toggleFilters() {
      const panel = $("filterPanel");
      const button = $("toggleFiltersBtn");
      if (!panel || !button) return;

      const collapsed = panel.classList.toggle("collapsed");
      button.textContent = collapsed ? "Filter anzeigen" : "Filter ausblenden";
    }

    function focusSearch() {
      showPage("collectionPage");
      window.setTimeout(() => {
        if ($("searchInput")) $("searchInput").focus();
      }, 80);
    }

    function applyViewPreferences() {
      if (!$("cardsList")) return;
      const list = $("cardsList");
      if (!list) return;

      list.classList.toggle("compact-view", compactView);
      if ($("compactViewBtn")) $("compactViewBtn").classList.toggle("active", compactView);

      localStorage.setItem("cardVaultCompactView", "true");
      localStorage.setItem("cardVaultSort", $("sortSelect") ? $("sortSelect").value : "newest");
      localStorage.setItem("cardVaultViewMode", list.classList.contains("grid-view") ? "grid" : "list");
    }

    function restoreViewPreferences() {
      if (!$("cardsList")) return;
      if ($("sortSelect")) {
        const savedSort = localStorage.getItem("cardVaultSort");
        if (savedSort && Array.from($("sortSelect").options).some(option => option.value === savedSort)) {
          $("sortSelect").value = savedSort;
        }
      }

      const savedMode = localStorage.getItem("cardVaultViewMode");
      if (savedMode === "grid" && $("cardsList")) {
        $("cardsList").classList.add("grid-view");
        if ($("gridViewBtn")) $("gridViewBtn").classList.add("active");
        if ($("listViewBtn")) $("listViewBtn").classList.remove("active");
      }
    }

    function cardProfitValue(card) {
      const f = typeof financeForCard === "function" ? financeForCard(card) : { profit: 0, purchase: 0, target: 0 };
      return f.purchase && f.target ? f.profit : 0;
    }


    function gradingProfileMultiplier(profile) {
      if (profile === "loose") return 0.65;
      if (profile === "strict") return 1.45;
      return 1;
    }
    function gradingProfileLabel(profile) {
      if (profile === "loose") return "Locker";
      if (profile === "strict") return "Streng";
      return "Normal";
    }
    function updateProfileGradePreview() {
      if (!$("gradingProfilePanel")) return;}

    function todayIsoDate() {
      return new Date().toISOString().slice(0, 10);
    }

    function timelineDisplayDate(value) {
      if (!value) return "-";
      try {
        return new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value + "T00:00:00"));
      } catch {
        return value;
      }
    }

    function sortedTimeline(entries) {
      return (entries || []).slice().sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
    }

    function renderFormTimeline() {
      if (!$("formTimelineList")) return;
      const list = $("formTimelineList");
      if (!list) return;
      if (!formTimeline.length) {
        list.innerHTML = '<div class="timeline-empty">Noch keine Ereignisse eingetragen.</div>';
        return;
      }
      list.innerHTML = "";
      sortedTimeline(formTimeline).forEach(entry => {
        const originalIndex = formTimeline.indexOf(entry);
        const item = document.createElement("div");
        item.className = "timeline-entry";
        item.innerHTML = `
          <div class="timeline-entry-date">${timelineDisplayDate(entry.date)}</div>
          <div class="timeline-entry-text">${escapeHtml(entry.text || "")}</div>
          <button class="timeline-delete" type="button">Löschen</button>
        `;
        item.querySelector("button").addEventListener("click", () => {
          formTimeline.splice(originalIndex, 1);
          renderFormTimeline();
        });
        list.appendChild(item);
      });
    }

    function addTimelineEntry() {
      const textValue = $("timelineText") ? String($("timelineText").value || "").trim() : "";
      const dateValue = $("timelineDate") && $("timelineDate").value ? $("timelineDate").value : todayIsoDate();
      if (!textValue) return;
      formTimeline.push({ date: dateValue, text: textValue, createdAt: new Date().toISOString() });
      if ($("timelineText")) $("timelineText").value = "";
      if ($("timelineDate")) $("timelineDate").value = todayIsoDate();
      renderFormTimeline();
    }

    function renderDetailTimeline(card) {
      const box = $("detailTimelineBox");
      const list = $("detailTimelineList");
      if (!box || !list) return;
      const entries = sortedTimeline(card.timeline || []);
      if (!entries.length) {
        box.style.display = "none";
        list.innerHTML = "";
        return;
      }
      box.style.display = "block";
      list.innerHTML = entries.map(entry => `
        <div class="timeline-entry">
          <div class="timeline-entry-date">${timelineDisplayDate(entry.date)}</div>
          <div class="timeline-entry-text">${escapeHtml(entry.text || "")}</div>
          <div></div>
        </div>
      `).join("");
    }

    function loadSavedViews() {
      try {
        return JSON.parse(localStorage.getItem("cardVaultSavedViews") || "[]");
      } catch {
        return [];
      }
    }

    function saveSavedViews(views) {
      localStorage.setItem("cardVaultSavedViews", JSON.stringify(views));
      renderSavedViews();
    }

    function currentViewState() {
      return {
        search: valueOf("searchInput"),
        status: valueOf("statusFilter"),
        condition: valueOf("conditionFilter"),
        sort: valueOf("sortSelect", "newest"),
        favorite: valueOf("favoriteFilter"),
        quick: activeQuickFilter || "all",
        tag: activeTagFilter || "",
        compact: true
      };
    }

    function applyViewState(state) {
      setValueIfExists("searchInput", state.search || "");
      setValueIfExists("statusFilter", state.status || "");
      setValueIfExists("conditionFilter", state.condition || "");
      setValueIfExists("sortSelect", state.sort || "newest");
      setValueIfExists("favoriteFilter", state.favorite || "");
      activeQuickFilter = state.quick || "all";
      activeTagFilter = state.tag || "";
      compactView = true;
      renderCards();
    }

    function saveCurrentView() {
      const name = prompt("Name für diese Ansicht:", "Meine Ansicht");
      if (!name || !name.trim()) return;

      const views = loadSavedViews();
      const cleanName = name.trim();
      const existingIndex = views.findIndex(view => view.name.toLowerCase() === cleanName.toLowerCase());
      const entry = {
        id: Date.now().toString(36),
        name: cleanName,
        state: currentViewState(),
        createdAt: new Date().toISOString()
      };

      if (existingIndex >= 0) views[existingIndex] = entry;
      else views.push(entry);

      saveSavedViews(views);
      if (typeof showToast === "function") showToast("Ansicht gespeichert");
    }

    function deleteSavedView(id) {
      const views = loadSavedViews().filter(view => view.id !== id);
      saveSavedViews(views);
    }

    function renderSavedViews() {
      if (!$("savedViewsList")) return;
      const list = $("savedViewsList");
      const bar = $("savedViewsBar");
      if (!list || !bar) return;

      const views = loadSavedViews();

      if (!views.length) {
        list.innerHTML = '<span class="hint">Noch keine gespeicherten Ansichten.</span>';
        return;
      }

      list.innerHTML = "";
      views.forEach(view => {
        const chip = document.createElement("button");
        chip.className = "saved-view-chip";
        chip.type = "button";
        chip.innerHTML = `${escapeHtml(view.name)} <span class="saved-view-remove" title="Löschen">×</span>`;

        chip.addEventListener("click", event => {
          if (event.target.classList.contains("saved-view-remove")) {
            event.stopPropagation();
            deleteSavedView(view.id);
            return;
          }
          applyViewState(view.state || {});
        });

        list.appendChild(chip);
      });
    }

    function safeRun(label, fn) {
      try {
        if (typeof fn === "function") fn();
      } catch (error) {
        console.error(label, error);
        const box = $("appErrorBox");
        if (box) {
          box.style.display = "block";
          box.textContent = "Fehler in " + label + ": " + (error && error.stack ? error.stack : error);
        }
      }
    }

    function hasPage(pageId) {
      return Boolean(document.getElementById(pageId));
    }

    function onIfExists(id, eventName, handler, options) {
      const el = $(id);
      if (el) el.addEventListener(eventName, handler, options);
    }

    function clickIfExists(id, handler) {
      onIfExists(id, "click", handler);
    }

    function valueOf(id, fallback = "") {
      const el = $(id);
      return el ? el.value : fallback;
    }

    function setValueIfExists(id, value) {
      const el = $(id);
      if (el) el.value = value;
    }

    function textIfExists(id, value) {
      const el = $(id);
      if (el) el.textContent = value;
    }

    function htmlIfExists(id, value) {
      const el = $(id);
      if (el) el.innerHTML = value;
    }

    function enforceGalleryView() {
      compactView = true;
      if (typeof currentView !== "undefined") currentView = "grid";
      if (typeof viewMode !== "undefined") viewMode = "grid";
      document.body.classList.add("force-gallery");
      const cardsList = $("cardsList");
      if (cardsList) {
        cardsList.classList.add("grid-view", "compact-view");
        cardsList.classList.remove("list-view");
      }
    }

    function deleteCard(id) {
      const card = cards.find(item => item.id === id);
      if (!card) return;
      if (!confirm("Karte in den Papierkorb verschieben?")) return;
      if (typeof moveCardToTrash === "function") moveCardToTrash(card);
      cards = cards.filter(item => item.id !== id);
      saveCards();
      renderStats();
      renderCards();
    }

    function setupDelegatedCardActionMenus() {
      if (window.__cardActionMenuDelegated) return;
      window.__cardActionMenuDelegated = true;

      document.addEventListener("click", event => {
        const menuButton = event.target.closest("[data-card-menu]");
        if (menuButton) {
          event.preventDefault();
          event.stopPropagation();

          const cardEl = menuButton.closest(".card, .card-item, .collection-card, .card-row");
          const menu = cardEl ? cardEl.querySelector(".card-actions-menu") : null;
          if (!menu) return;

          const wasActive = menu.classList.contains("active");
          closeAllCardActionMenus();
          menu.classList.toggle("active", !wasActive);
          return;
        }

        const editButton = event.target.closest("[data-action-edit]");
        if (editButton) {
          event.preventDefault();
          event.stopPropagation();
          closeAllCardActionMenus();
          editCard(editButton.dataset.actionEdit);
          return;
        }

        const duplicateButton = event.target.closest("[data-action-duplicate]");
        if (duplicateButton) {
          event.preventDefault();
          event.stopPropagation();
          closeAllCardActionMenus();
          duplicateCard(duplicateButton.dataset.actionDuplicate);
          return;
        }

        const deleteButton = event.target.closest("[data-action-delete]");
        if (deleteButton) {
          event.preventDefault();
          event.stopPropagation();
          closeAllCardActionMenus();
          deleteCard(deleteButton.dataset.actionDelete);
          return;
        }

        if (!event.target.closest(".card-actions-menu")) {
          closeAllCardActionMenus();
        }
      }, true);
    }

    function closeAllCardActionMenus() {
      document.querySelectorAll(".card-actions-menu.active").forEach(menu => menu.classList.remove("active"));
    }

    function cssEscapeSafe(value) {
      if (window.CSS && typeof CSS.escape === "function") return CSS.escape(String(value));
      return String(value).replace(/"/g, '\"');
    }

    function bindCardActionMenus() {
      document.querySelectorAll("[data-card-menu]").forEach(button => {
        button.addEventListener("click", event => {
          event.preventDefault();
          event.stopPropagation();

          const id = button.dataset.cardMenu;
          const menu = document.querySelector(`[data-card-menu-panel="${cssEscapeSafe(id)}"]`);
          if (!menu) return;

          const wasActive = menu.classList.contains("active");
          closeAllCardActionMenus();
          menu.classList.toggle("active", !wasActive);
        });
      });

      document.querySelectorAll("[data-card-menu-panel]").forEach(menu => {
        menu.addEventListener("click", event => event.stopPropagation());
      });

      document.querySelectorAll("[data-action-edit]").forEach(button => {
        button.addEventListener("click", event => {
          event.preventDefault();
          event.stopPropagation();
          closeAllCardActionMenus();
          editCard(button.dataset.actionEdit);
        });
      });

      document.querySelectorAll("[data-action-duplicate]").forEach(button => {
        button.addEventListener("click", event => {
          event.preventDefault();
          event.stopPropagation();
          closeAllCardActionMenus();
          duplicateCard(button.dataset.actionDuplicate);
        });
      });

      document.querySelectorAll("[data-action-delete]").forEach(button => {
        button.addEventListener("click", event => {
          event.preventDefault();
          event.stopPropagation();
          closeAllCardActionMenus();
          deleteCard(button.dataset.actionDelete);
        });
      });
    }

    function updateQuickFilterButtonsSafe() {
      document.querySelectorAll("[data-quick-filter]").forEach(btn => {
        btn.classList.toggle("active", (btn.dataset.quickFilter || "all") === activeQuickFilter);
      });
    }

    function closeSelectionMode() {
      selectionMode = false;
      selectedCardIds.clear();
      document.body.classList.remove("selection-mode-active");
      updateBulkToolbar();
      renderCards();
      showImportToast("Auswahlmodus beendet", "Auswahl wurde aufgehoben.", "success");
    }

    function toggleSelectMode() {
      if (selectionMode) {
        closeSelectionMode();
        return;
      }
      selectionMode = true;
      document.body.classList.add("selection-mode-active");
      updateBulkToolbar();
      renderCards();
      showImportToast("Auswahlmodus aktiv", "Karten können jetzt ausgewählt werden.", "success");
    }

    
    const OPTCG_IMAGE_BASE_URL = "https://optcg-api.arjunbansal-ai.workers.dev/images/";

    function normalizeOnePieceCardNumber(value) {
      const raw = String(value || "").trim().toUpperCase();
      const match = raw.match(/(OP|ST|EB|PRB|P)-?\s?(\d{2,3})-?(\d{3})/i);
      if (!match) return "";
      const prefix = match[1].toUpperCase();
      const setNo = match[2].padStart(2, "0");
      const cardNo = match[3].padStart(3, "0");
      if (prefix === "P") return "P-" + cardNo;
      return prefix + setNo + "-" + cardNo;
    }

    function getCardmarketProductForCard(card) {
      if (!card) return null;
      const productId = String(card.cardmarketProductId || card.idProduct || card.productId || "").trim();
      if (!productId || !Array.isArray(cardmarketProducts)) return null;

      return cardmarketProducts.find(item => {
        const product = item && (item.product || item);
        if (!product) return false;
        return String(product.idProduct || product.productId || product.id || "").trim() === productId;
      }) || null;
    }

    function enrichCardForVariantImage(card) {
      const found = getCardmarketProductForCard(card);
      if (!found) return card;

      const product = found.product || found;
      const titleParts = [
        card.name,
        card.number,
        card.set,
        card.rarity,
        card.notes,
        product.enName,
        product.name,
        product.productName,
        product.expansionName,
        product.categoryName,
        product.idProduct
      ].filter(Boolean);

      return {
        ...card,
        marketTitle: titleParts.join(" "),
        cardmarketName: product.name || product.enName || product.productName || "",
        cardmarketProductName: product.productName || product.enName || product.name || "",
        variant: inferCatalogVariant(product) || card.variant || "",
        version: product.categoryName || card.version || "",
        cardmarketProductId: product.idProduct || card.cardmarketProductId || ""
      };
    }

    function cardLooksLikeVariant(card) {
      const text = [
        card.name,
        card.number,
        card.set,
        card.rarity,
        card.notes,
        card.marketTitle,
        card.cardmarketName,
        card.cardmarketProductName,
        card.productName,
        card.variant,
        card.version
      ].filter(Boolean).join(" ").toLowerCase();

      return /(alt|alternate|alternative|parallel|manga|special|sp\b|sec\*|super parallel|wanted|treasure|comic|anniversary|winner|championship|promo|pre-release|pre release|judge|store tournament|sealed battle|revision pack|full art|aa\b|sr\*|l\*)/i.test(text);
    }

    function onePieceApiImageCandidates(card) {
      const base = normalizeOnePieceCardNumber(card.number);
      if (!base) return [];

      const candidates = [];
      const add = id => {
        if (!id || candidates.includes(id)) return;
        candidates.push(id);
      };

      const variant = cardLooksLikeVariant(card);

      if (variant) {
        for (let i = 1; i <= 20; i += 1) add(base + "_p" + i);
        for (let i = 1; i <= 12; i += 1) add(base + "_r" + i);
        for (let i = 1; i <= 8; i += 1) add(base + "_jp" + i);
        for (let i = 1; i <= 8; i += 1) add(base + "_sp" + i);
        add(base);
      } else {
        add(base);
        for (let i = 1; i <= 8; i += 1) add(base + "_p" + i);
      }

      return candidates.map(id => OPTCG_IMAGE_BASE_URL + encodeURIComponent(id));
    }

    function galleryImageSources(card) {
      const enrichedCard = enrichCardForVariantImage(card);
      const apiSources = onePieceApiImageCandidates(enrichedCard);
      const ownFront = (card.images || [])[0] || "";
      return apiSources.concat(ownFront ? [ownFront] : []).filter(Boolean);
    }

    function galleryImageHtml(card) {
      const sources = galleryImageSources(card);
      if (!sources.length) return "CARD";
      const first = sources[0];
      const rest = sources.slice(1).map(src => escapeHtml(src)).join("|");
      return `<img src="${escapeHtml(first)}" data-fallbacks="${rest}" data-own-front="${escapeHtml((card.images || [])[0] || "")}" alt="${escapeHtml(card.name || "Karte")}">`;
    }

    function bindGalleryImageFallbacks(scope = document) {
      scope.querySelectorAll("img[data-fallbacks]").forEach(img => {
        if (img.dataset.galleryFallbackBound === "1") return;
        img.dataset.galleryFallbackBound = "1";
        img.addEventListener("error", () => {
          const fallbacks = (img.dataset.fallbacks || "").split("|").filter(Boolean);
          const next = fallbacks.shift();
          if (!next) {
            const parent = img.parentElement;
            if (parent && !img.dataset.ownFront) parent.textContent = "CARD";
            return;
          }
          img.dataset.fallbacks = fallbacks.join("|");
          img.src = next;
        });
      });
    }

    function renderCards() {
      if (!$("cardsList")) return;
      enforceGalleryView();

      const query = valueOf("searchInput").toLowerCase().trim();
      const status = valueOf("statusFilter");
      const condition = valueOf("conditionFilter");
      const favorite = valueOf("favoriteFilter");
      const sort = valueOf("sortSelect", "newest");

      let filtered = cards.filter(card => {
        const haystack = [card.id, card.name, card.number, card.set, card.rarity, card.language, card.status, card.grade, card.condition, card.storage, card.notes, (card.tags || []).join(" ")].join(" ").toLowerCase();
        return (!query || haystack.includes(query))
          && (!status || card.status === status)
          && (!condition || String(card.condition || "").toLowerCase().includes(condition.toLowerCase()))
          && (!favorite || card.favorite)
          && matchesQuickFilter(card)
          && cardMatchesTag(card);
      });

      filtered.sort((a,b) => {
        if (sort === "name") return String(a.name).localeCompare(String(b.name));
        if (sort === "value-desc") return parseMoney(b.value) - parseMoney(a.value);
        if (sort === "value-asc") return parseMoney(a.value) - parseMoney(b.value);
        if (sort === "grade-desc") return parseGrade(b.grade) - parseGrade(a.grade);
        if (sort === "grade-asc") return parseGrade(a.grade) - parseGrade(b.grade);
        if (sort === "doc-desc") return documentationScore(b) - documentationScore(a);
        if (sort === "doc-asc") return documentationScore(a) - documentationScore(b);
        if (sort === "profit-desc") return cardProfitValue(b) - cardProfitValue(a);
        if (sort === "profit-asc") return cardProfitValue(a) - cardProfitValue(b);
        if (sort === "updated-desc") return new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0);
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      });

      lastRenderedCardIds = filtered.map(card => card.id);
      currentDetailOrder = lastRenderedCardIds.slice();
      htmlIfExists("cardsList", "");
      textIfExists("resultCount", filtered.length);
      textIfExists("filteredCount", filtered.length);
      textIfExists("filteredValue", formatEuro(filtered.reduce((sum,c) => sum + parseMoney(c.value), 0)));
      textIfExists("favoriteCount", cards.filter(c => c.favorite).length);
      textIfExists("markedCount", filtered.filter(c => (c.damageFront || []).length + (c.damageBack || []).length > 0).length);
      renderCollectionAnalysis(filtered);
      updateQuickFilterButtons();
      renderTagCloud();
      bindCardActionMenus();
      $("emptyState").style.display = filtered.length ? "none" : "block";

      filtered.forEach(card => {
        const el = document.createElement("article");
        el.className = "glass card-row" + (selectedCardIds.has(card.id) ? " selected-card" : "");
        const damageCount = (card.damageFront || []).length + (card.damageBack || []).length;
        el.innerHTML = `
          
          <div class="card-actions-menu-wrap">
            <button class="card-actions-trigger" type="button" data-card-menu="${escapeHtml(card.id)}" title="Kartenoptionen" aria-label="Kartenoptionen">⋯</button>
            <div class="card-actions-menu" data-card-menu-panel="${escapeHtml(card.id)}">
              <button class="card-action-menu-button" type="button" data-action-edit="${escapeHtml(card.id)}">Bearbeiten</button>
              <button class="card-action-menu-button" type="button" data-action-duplicate="${escapeHtml(card.id)}">Duplizieren</button>
              <button class="card-action-menu-button danger" type="button" data-action-delete="${escapeHtml(card.id)}">Löschen</button>
            </div>
          </div>
<div class="select-card-check">${selectedCardIds.has(card.id) ? "✓" : ""}</div>
          <div class="card-image gallery-api-image">${galleryImageHtml(card)}</div>
          <div class="card-fixed-content">
<div class="card-title-line">
              <div class="card-title">${escapeHtml(card.name)}</div>
            </div>
            <div class="card-meta">${escapeHtml(card.number || "-")} · ${escapeHtml(card.set || "-")} · ${escapeHtml(card.rarity || "-")}</div>
            <div class="details">
              <div><div class="detail-label">ID</div><div class="detail-value">${escapeHtml(card.id)}</div></div>
              <div><div class="detail-label">Zustand</div><div class="detail-value">${escapeHtml(card.condition || "-")}</div></div>
              <div><div class="detail-label">Lagerort</div><div class="detail-value">${escapeHtml(card.storage || "-")}</div></div>
              <div><div class="detail-label">Wert</div><div class="detail-value">${escapeHtml(card.value || "-")}</div></div>

            </div>
            ${renderDocScore(card)}
            ${!(card.images || [])[1] ? `<span class="missing-pill">Rückseite fehlt</span>` : ""}
          </div>
          <div class="card-tools compact-card-tools">
            <div class="gallery-grade-toolbar-badge" title="Bewertung">${escapeHtml(card.grade || "-")}</div>
            <button class="favorite-button ${card.favorite ? "active" : ""}" type="button">${card.favorite ? "★" : "☆"}</button>
          </div>
        `;

        el.addEventListener("click", event => {
          if (event.target.closest("button")) return;
          if (selectionMode) {
            toggleCardSelected(card.id);
            return;
          }
          openDetail(card.id);
        });
        const favoriteButton = el.querySelector(".favorite-button");
        if (favoriteButton) favoriteButton.addEventListener("click", event => {
          event.stopPropagation();
          card.favorite = !card.favorite;
          saveCards();
          renderCards();
          renderStats();
        });

        const duplicateButton = el.querySelector(".duplicate-button");
        if (duplicateButton) {
          duplicateButton.addEventListener("click", event => {
            event.preventDefault();
            event.stopPropagation();
            duplicateCard(card.id);
          });
        }


        $("cardsList").appendChild(el);
      });

      bindGalleryImageFallbacks($("cardsList"));

      updateBulkToolbar();
      applyViewPreferences();
    }

    function cardImages(card) {
      return (card.images || []).filter(Boolean);
    }

    function reportImageHtml(src, label) {
      return `<div><div class="report-image">${src ? `<img src="${src}" alt="${escapeHtml(label)}">` : "Kein Bild"}</div><div class="thumb-label">${escapeHtml(label)}</div></div>`;
    }

    function reportKv(label, value) {
      return `<div class="report-kv"><div class="report-k">${escapeHtml(label)}</div><div class="report-v">${escapeHtml(value || "-")}</div></div>`;
    }

    function openCardReport(card) {
      if (!card) return;

      const images = cardImages(card);
      const damage = (card.damageFront || []).map(point => ({...point, side: "Vorderseite"}))
        .concat((card.damageBack || []).map(point => ({...point, side: "Rückseite"})));

      textIfExists("cardReportTitle", card.name || "Kartenreport");
      textIfExists("cardReportSub", (card.id || "-") + " · " + (card.set || "-") + " · erstellt mit Card Vault");

      const finance = typeof formatProfit === "function" ? formatProfit(card) : "-";
      const docScore = typeof documentationScore === "function" ? documentationScore(card) + "%" : "-";

      (($("cardReportBody") || {}).innerHTML) = `
        <div class="report-image-stack">
          ${reportImageHtml(images[0], "Vorderseite")}
          ${reportImageHtml(images[1], "Rückseite")}
        </div>

        <div>
          <div class="report-section">
            <div class="report-section-title">Stammdaten</div>
            <div class="report-kv-grid">
              ${reportKv("ID", card.id)}
              ${reportKv("Nummer", card.number)}
              ${reportKv("Cardmarket Produkt-ID", card.marketProductId || card.idProduct)}
              ${reportKv("Set", card.set)}

              ${reportKv("Status", card.status)}
              ${reportKv("Tags", (card.tags || []).join(", "))}
              ${reportKv("Dokumentation", docScore)}
            </div>
          </div>

          <div class="report-section">
            <div class="report-section-title">Bewertung</div>
            <div class="report-kv-grid">
              ${reportKv("Eigene Note", card.grade)}
              ${reportKv("Zustand", card.condition)}
              ${reportKv("Centering", card.quality && card.quality.centering)}
              ${reportKv("Ecken", card.quality && card.quality.corners)}
              ${reportKv("Kanten", card.quality && card.quality.edges)}
              ${reportKv("Oberfläche", card.quality && card.quality.surface)}
            </div>
          </div>

          <div class="report-section">
            <div class="report-section-title">Wert / Trading</div>
            <div class="report-kv-grid">
              ${reportKv("Marktwert", card.value)}
              ${reportKv("Einkaufspreis", card.purchasePrice)}
              ${reportKv("Verkaufspreis", card.salePrice)}
              ${reportKv("Gewinn / Verlust", finance)}
              ${reportKv("Plattform", card.platform)}
              ${reportKv("Lagerort", card.storage)}
            </div>
          </div>

          <div class="report-section">
            <div class="report-section-title">Schäden</div>
            <div class="report-damage-list">
              ${damage.length ? damage.map((point, index) => `
                <div class="report-damage-item">
                  <strong>${index + 1}. ${escapeHtml(point.label || "Schaden")}</strong>
                  <div class="report-damage-meta">${escapeHtml(point.side)} · ${escapeHtml(point.category || "Sonstiges")} · ${escapeHtml(point.severity === "high" ? "stark" : point.severity === "medium" ? "mittel" : "leicht")}</div>
                </div>
              `).join("") : `<div class="report-damage-item">Keine Schäden markiert.</div>`}
            </div>
          </div>

          <div class="report-section">
            <div class="report-section-title">Notizen</div>
            <div class="report-note">${escapeHtml(card.notes || "Keine Notizen vorhanden.")}</div>
          </div>

          <div class="report-section">
            <div class="report-section-title">Verlauf / Ereignisse</div>
            <div class="report-damage-list">
              ${(card.timeline || []).length ? sortedTimeline(card.timeline).map(entry => `
                <div class="report-damage-item">
                  <strong>${timelineDisplayDate(entry.date)}</strong>
                  <div class="report-damage-meta">${escapeHtml(entry.text || "")}</div>
                </div>
              `).join("") : `<div class="report-damage-item">Keine Ereignisse eingetragen.</div>`}
            </div>
          </div>
        </div>
      `;

      $("cardReportBackdrop").classList.add("active");
    }

    function closeCardReport() {
      $("cardReportBackdrop").classList.remove("active");
    }

    function currentDetailIndex() {
      if (!currentDetailCard) return -1;
      return currentDetailOrder.indexOf(currentDetailCard.id);
    }

    function updateDetailNavigation() {
      const position = $("detailPosition");
      const prev = $("prevDetailBtn");
      const next = $("nextDetailBtn");
      if (!position || !prev || !next) return;

      const order = currentDetailOrder.length ? currentDetailOrder : cards.map(card => card.id);
      const index = currentDetailCard ? order.indexOf(currentDetailCard.id) : -1;

      if (index < 0) {
        position.textContent = "-";
        prev.disabled = true;
        next.disabled = true;
        return;
      }

      position.textContent = (index + 1) + " / " + order.length;
      prev.disabled = index <= 0;
      next.disabled = index >= order.length - 1;
    }

    function openAdjacentDetail(direction) {
      const order = currentDetailOrder.length ? currentDetailOrder : cards.map(card => card.id);
      const index = currentDetailIndex();
      if (index < 0) return;

      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= order.length) return;

      openDetail(order[nextIndex]);
    }

    function openDetail(id) {
      const card = cards.find(c => c.id === id);
      if (!card) return;
      currentDetailCard = card;
      currentDamageSide = "front";
      if ($("detailEditBtn")) $("detailEditBtn").dataset.cardEdit = card.id;

      textIfExists("detailKicker", card.id + " · " + (card.status || "-") + " · Note " + (card.grade || "-"));
      textIfExists("detailTitle", card.name || "Karte");
      textIfExists("detailVerification", "Diese Karte ist in deiner Sammlung gespeichert.");
      renderCompletionDetail(card);
      renderFinanceDetail(card);
      renderDetailTimeline(card);
      renderMarketPriceDetail(card);

      (($("detailInfo") || {}).innerHTML) = `
        <div class="info-box"><div class="info-label">Kartennummer</div><div class="info-value">${escapeHtml(card.number || "-")}</div></div>
        <div class="info-box"><div class="info-label">Set</div><div class="info-value">${escapeHtml(card.set || "-")}</div></div>
        <div class="info-box"><div class="info-label">Status</div><div class="info-value">${escapeHtml(card.status || "-")}</div></div>
        <div class="info-box"><div class="info-label">Eigene Note</div><div class="info-value">${escapeHtml(card.grade || "-")}</div></div>
        <div class="info-box"><div class="info-label">Zustand</div><div class="info-value">${escapeHtml(card.condition || "-")}</div></div>
        <div class="info-box"><div class="info-label">Lagerort</div><div class="info-value">${escapeHtml(card.storage || "-")}</div></div>
      `;

      const detailTagsBox = $("detailTagsBox");
      const detailTagsList = $("detailTagsList");
      if (detailTagsBox && detailTagsList) {
        const tags = card.tags || [];
        detailTagsBox.style.display = tags.length ? "block" : "none";
        detailTagsList.innerHTML = tags.map(tag => `<span class="custom-tag-chip">#${escapeHtml(tag)}</span>`).join("");
      }

      if (card.notes) {
        $("detailNoteBox").style.display = "block";
        textIfExists("detailNotes", card.notes);
      } else {
        $("detailNoteBox").style.display = "none";
      }

      renderDetailImages(card);
      renderDamageMap();
      updateDetailNavigation();
      $("detailBackdrop").style.display = "flex";
      document.body.style.overflow = "hidden";
    }

    function setDetailMainImage(card, index) {
      const images = cardImages(card);
      const main = $("detailMainImage");

      if (!images.length) {
        currentDetailImageIndex = 0;
        main.textContent = "CARD";
        return;
      }

      currentDetailImageIndex = Math.max(0, Math.min(index, images.length - 1));
      setImagePreview(main, images[currentDetailImageIndex], card.name);

      document.querySelectorAll(".thumb").forEach((thumb, thumbIndex) => {
        thumb.classList.toggle("active", thumbIndex === currentDetailImageIndex);
      });

      if ($("showFrontImageBtn")) $("showFrontImageBtn").classList.toggle("active", currentDetailImageIndex === 0);
      if ($("showBackImageBtn")) $("showBackImageBtn").classList.toggle("active", currentDetailImageIndex === 1);
    }

    function openFullscreenImage() {
      if (!currentDetailCard) return;
      const images = cardImages(currentDetailCard);
      const src = images[currentDetailImageIndex];
      if (!src) return;

      $("fullscreenImage").src = src;
      $("fullscreenImageBackdrop").classList.add("active");
    }

    function closeFullscreenImage() {
      $("fullscreenImageBackdrop").classList.remove("active");
      $("fullscreenImage").src = "";
    }

    function renderDetailImages(card) {
      const images = cardImages(card);
      const thumbs = $("thumbs");
      thumbs.innerHTML = "";

      if (!images.length) {
        setDetailMainImage(card, 0);
        return;
      }

      setDetailMainImage(card, 0);

      images.forEach((img, index) => {
        const wrap = document.createElement("div");
        wrap.className = "thumb-wrap";

        const btn = document.createElement("button");
        btn.className = "thumb" + (index === 0 ? " active" : "");
        btn.type = "button";
        btn.innerHTML = `<img src="${img}" alt="Bild ${index + 1}">`;
        btn.onclick = () => setDetailMainImage(card, index);

        const label = document.createElement("div");
        label.className = "thumb-label";
        label.textContent = index === 0 ? "Vorne" : index === 1 ? "Hinten" : "Detail " + (index - 1);

        wrap.appendChild(btn);
        wrap.appendChild(label);
        thumbs.appendChild(wrap);
      });

      if ($("showFrontImageBtn")) {
        $("showFrontImageBtn").onclick = () => setDetailMainImage(card, 0);
      }

      if ($("showBackImageBtn")) {
        $("showBackImageBtn").onclick = () => {
          if (images[1]) setDetailMainImage(card, 1);
        };
        $("showBackImageBtn").disabled = !images[1];
      }

      if ($("fullscreenImageBtn")) {
        $("fullscreenImageBtn").onclick = openFullscreenImage;
      }
    }

    function renderDamageMap() {
      if (!currentDetailCard) return;

      $("damageFrontBtn").classList.toggle("active", currentDamageSide === "front");
      $("damageBackBtn").classList.toggle("active", currentDamageSide === "back");

      const img = currentDamageSide === "front" ? cardImages(currentDetailCard)[0] : (cardImages(currentDetailCard)[1] || cardImages(currentDetailCard)[0]);
      const points = currentDamageSide === "front" ? (currentDetailCard.damageFront || []) : (currentDetailCard.damageBack || []);
      const cardEl = $("damageCard");
      setImagePreview(cardEl, img, "CARD");

      points.forEach((point, index) => {
        const dot = document.createElement("button");
        dot.className = "damage-dot";
        dot.type = "button";
        dot.textContent = index + 1;
        positionDotByPoint(dot, point);
        dot.onclick = () => openZoom(point);
        dot.ondblclick = (event) => { event.stopPropagation(); openDamageEditor("detail", currentDamageSide, index); };
        cardEl.appendChild(dot);
      });

      htmlIfExists("damageList", "");
      $("damageEmpty").style.display = points.length ? "none" : "block";
      points.forEach((point, index) => {
        const item = document.createElement("div");
        item.className = "damage-item";
        item.innerHTML = `
          <div><strong>${index + 1}. ${escapeHtml(point.label)}</strong></div>
          <div class="damage-meta">
            <span class="damage-badge">${escapeHtml(damageCategory(point))}</span>
            <span class="damage-badge ${severityClass(damageSeverity(point))}">${severityLabel(damageSeverity(point))}</span>
            ${point.closeup ? `<span class="damage-badge">Close-up vorhanden</span>` : ""}
          </div>
          ${point.closeup ? `<div class="closeup-thumb"><img src="${point.closeup}" alt="Close-up"></div>` : ""}
          <div class="closeup-section">
            <button class="closeup-button" type="button">Zoom öffnen</button>
            <button class="closeup-button" type="button" data-damage-edit-context="detail" data-damage-edit-side="${currentDamageSide}" data-damage-edit-index="${index}">Bearbeiten</button>
          </div>`;
        const zoomButton = item.querySelector(".closeup-button");
        if (zoomButton) zoomButton.onclick = (event) => { event.stopPropagation(); point.closeup ? openCloseup(point) : openZoom(point); };

        const thumb = item.querySelector(".closeup-thumb");
        if (thumb) thumb.onclick = (event) => { event.stopPropagation(); openCloseup(point); };

        const editDamageButton = item.querySelector("[data-damage-edit-context]");
        if (editDamageButton) {
          editDamageButton.addEventListener("click", event => {
            event.preventDefault();
            event.stopPropagation();
            openDamageEditor("detail", currentDamageSide, index);
          });
        }
        item.addEventListener("dblclick", () => openDamageEditor("detail", currentDamageSide, index));
        $("damageList").appendChild(item);
      });
    }

    function openCloseup(point) {
      if (!point.closeup) return;
      currentZoom = { card: currentDetailCard, side: currentDamageSide, point, level: 800 };
      textIfExists("zoomKicker", "Close-up Foto");
      textIfExists("zoomTitle", point.label || "Close-up");
      textIfExists("zoomDesc", "Hochgeladenes Detailfoto des Schadens.");
      htmlIfExists("zoomStage", "");
      const img = document.createElement("img");
      img.src = point.closeup;
      img.alt = "Close-up";
      img.style.width = "100%";
      img.style.height = "100%";
      img.style.objectFit = "contain";
      img.style.background = "white";
      $("zoomStage").appendChild(img);
      $("zoomBackdrop").style.display = "flex";
    }

    function openZoom(point) {
      const img = currentDamageSide === "front" ? cardImages(currentDetailCard)[0] : (cardImages(currentDetailCard)[1] || cardImages(currentDetailCard)[0]);
      if (!img) return;
      currentZoom = { card: currentDetailCard, side: currentDamageSide, point, level: 800 };
      const zp = normalizePoint(point);
      textIfExists("zoomKicker", (currentDamageSide === "front" ? "Vorderseite" : "Rückseite") + " · " + zp.x.toFixed(2) + "% / " + zp.y.toFixed(2) + "%");
      textIfExists("zoomTitle", point.label);
      updateZoom();
      $("zoomBackdrop").style.display = "flex";
    }

    function updateZoom() {
      const imgSrc = currentZoom.side === "front"
        ? cardImages(currentZoom.card)[0]
        : (cardImages(currentZoom.card)[1] || cardImages(currentZoom.card)[0]);

      const stage = $("zoomStage");
      const info = $("zoomCropInfo");

      if (!imgSrc || !currentZoom.point) {
        stage.textContent = "Kein Bild verfügbar";
        return;
      }

      document.querySelectorAll(".zoom-button").forEach(btn => {
        btn.classList.toggle("active", Number(btn.dataset.zoom) === currentZoom.level);
      });

      stage.innerHTML = "";

      const canvas = document.createElement("canvas");
      canvas.width = 630;
      canvas.height = 880;
      stage.appendChild(canvas);

      const ctx = canvas.getContext("2d");
      const img = new Image();

      img.onload = function () {
        const zoomFactor = currentZoom.level / 100;

        const normalizedPoint = normalizePoint(currentZoom.point);
        const centerX = (normalizedPoint.x / 100) * img.naturalWidth;
        const centerY = (normalizedPoint.y / 100) * img.naturalHeight;

        let cropW = img.naturalWidth / zoomFactor;
        let cropH = img.naturalHeight / zoomFactor;

        // Kartenformat im Zoom beibehalten: 63:88
        const targetRatio = canvas.width / canvas.height;
        const cropRatio = cropW / cropH;

        if (cropRatio > targetRatio) {
          cropW = cropH * targetRatio;
        } else {
          cropH = cropW / targetRatio;
        }

        let sx = centerX - cropW / 2;
        let sy = centerY - cropH / 2;

        sx = Math.max(0, Math.min(img.naturalWidth - cropW, sx));
        sy = Math.max(0, Math.min(img.naturalHeight - cropH, sy));

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, sx, sy, cropW, cropH, 0, 0, canvas.width, canvas.height);

        if (info) {
          info.textContent = "Ausschnitt zentriert auf: " + currentZoom.point.x + "% / " + currentZoom.point.y + "% · Zoom " + (zoomFactor.toString().replace(".", ",")) + "×";
        }
      };

      img.onerror = function () {
        stage.textContent = "Zoom konnte für dieses Bild nicht erstellt werden.";
        if (info) info.textContent = "Hinweis: Bei externen Bild-URLs kann der Browser Canvas-Zoom blockieren. Hochgeladene Bilder funktionieren zuverlässig.";
      };

      img.src = imgSrc;
    }

    function closeDetail() {
      $("detailBackdrop").style.display = "none";
      $("zoomBackdrop").style.display = "none";
      document.body.style.overflow = "auto";
      currentDetailCard = null;
    }

    function csvEscape(value) {
      const content = String(value ?? "");
      return '"' + content.replaceAll('"', '""') + '"';
    }

    function financeForCard(card) {
      const purchase = parseMoney(card.purchasePrice);
      const sale = parseMoney(card.salePrice);
      const current = parseMoney(card.value);
      const target = sale || current;
      const profit = purchase && target ? target - purchase : 0;
      const percent = purchase && target ? (profit / purchase) * 100 : 0;

      return { purchase, sale, current, target, profit, percent };
    }

    function formatProfit(card) {
      const f = financeForCard(card);
      if (!f.purchase || !f.target) return "-";
      const sign = f.profit > 0 ? "+" : "";
      return sign + formatEuro(f.profit) + " / " + sign + f.percent.toFixed(1).replace(".", ",") + "%";
    }

    function profitClass(card) {
      const f = financeForCard(card);
      if (!f.purchase || !f.target || f.profit === 0) return "profit-neutral";
      return f.profit > 0 ? "profit-positive" : "profit-negative";
    }

    function updateProfitPreview() {
      const preview = $("profitPreview");
      if (!preview) return;

      const temp = {
        purchasePrice: $("purchasePrice") ? $("purchasePrice").value : "",
        salePrice: $("salePrice") ? $("salePrice").value : "",
        value: $("cardValue") ? $("cardValue").value : ""
      };

      preview.textContent = formatProfit(temp);
      preview.className = "profit-pill " + profitClass(temp);
    }

    function documentationItems(card) {
      const images = card.images || [];
      const quality = card.quality || {};
      const damageCount = (card.damageFront || []).length + (card.damageBack || []).length;

      return [
        ["Vorderseite", Boolean(images[0])],
        ["Rückseite", Boolean(images[1])],
        ["Eigene Note", Boolean(card.grade)],
        ["Zustand", Boolean(card.condition)],
        ["Lagerort", Boolean(card.storage)],
        ["Marktwert", Boolean(card.value)],
        ["Notizen", Boolean(card.notes)],
        ["Subgrades", Boolean(quality.centering || quality.corners || quality.edges || quality.surface)],
        ["Schäden geprüft", damageCount > 0 || Boolean(card.notes)]
      ];
    }

    function documentationScore(card) {
      const items = documentationItems(card);
      const done = items.filter(item => item[1]).length;
      return Math.round((done / items.length) * 100);
    }

    function scoreClass(score) {
      if (score >= 80) return "doc-score-good";
      if (score >= 50) return "doc-score-mid";
      return "doc-score-low";
    }

    function renderDocScore(card) {
      const score = documentationScore(card);
      return `
        <div class="doc-score ${scoreClass(score)}">
          <div class="doc-score-head"><span><span class="status-dot ${score >= 80 ? "ok" : score >= 50 ? "warn" : "bad"}"></span>Dokumentation</span><span>${score}%</span></div>
          <div class="doc-score-bar"><div class="doc-score-fill" style="width:${score}%"></div></div>
        </div>
      `;
    }

    function nextDuplicateId(baseId) {
      const year = new Date().getFullYear();
      const existing = new Set(cards.map(card => card.id));
      let n = cards.length + 1;
      let candidate = "COL-" + year + "-" + String(n).padStart(4, "0");

      while (existing.has(candidate)) {
        n++;
        candidate = "COL-" + year + "-" + String(n).padStart(4, "0");
      }

      return candidate;
    }

    function duplicateCard(id) {
      const original = cards.find(card => card.id === id);
      if (!original) return;

      const copy = JSON.parse(JSON.stringify(original));
      copy.id = nextDuplicateId(original.id);
      copy.name = original.name;
      copy.favorite = false;
      copy.createdAt = new Date().toISOString();
      copy.updatedAt = new Date().toISOString();
      copy.notes = (copy.notes ? copy.notes + "\n\n" : "") + "Duplikat von " + original.id + ". Bilder/Zustand bitte prüfen.";

      // Bilder und Schäden werden bewusst nicht übernommen, weil jedes Exemplar einzeln dokumentiert werden sollte.
      copy.images = [];
      copy.damageFront = [];
      copy.damageBack = [];

      cards.unshift(copy);
      saveCards();
      renderStats();
      renderCards();
      showPage("collectionPage");
      if (typeof showToast === "function") showToast("Exemplar dupliziert: " + copy.id);
    }

    function damageSummaryText(card) {
      const points = (card.damageFront || []).concat(card.damageBack || []);
      if (!points.length) return "keine";
      return points.map(point => {
        const category = point.category || "Sonstiges";
        const severity = point.severity === "high" ? "stark" : point.severity === "medium" ? "mittel" : "leicht";
        return (point.label || "Schaden") + " (" + category + ", " + severity + ")";
      }).join(" | ");
    }

    function exportCsv() {
      const headers = [
        "ID",
        "Name",
        "Kartennummer",
        "Cardmarket Produkt-ID",
        "Set",

        "Status",
        "Tags",
        "Eigene Note",
        "Zustand",
        "Lagerort",
        "Marktwert",
        "Einkaufspreis",
        "Verkaufspreis",
        "Gewinn/Verlust",
        "Plattform",
        "Gekauft am",
        "Verkauft am",
        "Favorit",
        "Vorderseite vorhanden",
        "Rückseite vorhanden",
        "Anzahl Schäden",
        "Dokumentation %",
        "Schäden",
        "Notizen",
        "Verlauf",
        "Erstellt",
        "Aktualisiert"
      ];

      const rows = cards.map(card => {
        const images = card.images || [];
        const damageCount = (card.damageFront || []).length + (card.damageBack || []).length;

        return [
          card.id,
          card.name,
          card.number,
          card.marketProductId || card.idProduct || "",
          card.set,

          card.status,
          (card.tags || []).join(", "),
          card.grade,
          card.condition,
          card.storage,
          card.value,
          card.purchasePrice || "",
          card.salePrice || "",
          formatProfit(card),
          card.platform || "",
          card.purchaseDate || "",
          card.saleDate || "",
          card.favorite ? "ja" : "nein",
          images[0] ? "ja" : "nein",
          images[1] ? "ja" : "nein",
          damageCount,
          documentationScore(card),
          damageSummaryText(card),
          card.notes,
          (card.timeline || []).map(entry => (entry.date || "") + ": " + (entry.text || "")).join(" | "),
          card.createdAt,
          card.updatedAt || card.createdAt
        ].map(csvEscape).join(";");
      });

      const csv = "\ufeff" + [headers.map(csvEscape).join(";")].concat(rows).join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "card-vault-export.csv";
      a.click();
      URL.revokeObjectURL(url);
      markBackupExported();
    }

    function renderProDashboard() {
      const topValueEl = $("topValueCard");
      if (!topValueEl) return;

      const byValue = cards
        .filter(card => parseMoney(card.value) > 0)
        .slice()
        .sort((a, b) => parseMoney(b.value) - parseMoney(a.value));

      if (byValue[0]) {
        textIfExists("topValueCard", formatEuro(parseMoney(byValue[0].value)));
        textIfExists("topValueCardSub", byValue[0].name || byValue[0].id);
      } else {
        textIfExists("topValueCard", "-");
        textIfExists("topValueCardSub", "Noch keine Werte eingetragen.");
      }

      const byGrade = cards
        .filter(card => parseGrade(card.grade) > 0)
        .slice()
        .sort((a, b) => parseGrade(b.grade) - parseGrade(a.grade));

      if (byGrade[0]) {
        textIfExists("bestGradeCard", byGrade[0].grade);
        textIfExists("bestGradeCardSub", byGrade[0].name || byGrade[0].id);
      } else {
        textIfExists("bestGradeCard", "-");
        textIfExists("bestGradeCardSub", "Noch keine Bewertung vorhanden.");
      }

      textIfExists("missingBackCount", cards.filter(card => !(card.images || [])[1]).length);

      (($("highDamageCount") || {}).textContent) = cards.filter(card => {
        const points = (card.damageFront || []).concat(card.damageBack || []);
        return points.some(point => point.severity === "high");
      }).length;

      if ($("profitDashboardValue")) {
        const totalProfit = cards.reduce((sum, card) => {
          const f = financeForCard(card);
          return sum + (f.purchase && f.target ? f.profit : 0);
        }, 0);
        textIfExists("profitDashboardValue", formatEuro(totalProfit));
      }

      if ($("duplicateDashboardCount")) {
        textIfExists("duplicateDashboardCount", duplicateGroups().length);
      }
    }

    function renderFinanceDetail(card) {
      const grid = $("detailFinanceGrid");
      if (!grid) return;

      const f = financeForCard(card);

      grid.innerHTML = `
        <div class="finance-summary-item">
          <div class="finance-summary-label">Einkaufspreis</div>
          <div class="finance-summary-value">${escapeHtml(card.purchasePrice || "-")}</div>
        </div>
        <div class="finance-summary-item">
          <div class="finance-summary-label">Aktueller Wert</div>
          <div class="finance-summary-value">${escapeHtml(card.value || "-")}</div>
        </div>
        <div class="finance-summary-item">
          <div class="finance-summary-label">Verkaufspreis</div>
          <div class="finance-summary-value">${escapeHtml(card.salePrice || "-")}</div>
        </div>
        <div class="finance-summary-item">
          <div class="finance-summary-label">Gewinn / Verlust</div>
          <div class="finance-summary-value"><span class="profit-pill ${profitClass(card)}">${formatProfit(card)}</span></div>
        </div>
        <div class="finance-summary-item">
          <div class="finance-summary-label">Plattform / Quelle</div>
          <div class="finance-summary-value">${escapeHtml(card.platform || "-")}</div>
        </div>
        <div class="finance-summary-item">
          <div class="finance-summary-label">Gekauft / Verkauft</div>
          <div class="finance-summary-value">${escapeHtml(card.purchaseDate || "-")} / ${escapeHtml(card.saleDate || "-")}</div>
        </div>
      `;
    }

    function renderCompletionDetail(card) {
      const scoreEl = $("detailCompletionScore");
      const listEl = $("detailCompletionList");
      if (!scoreEl || !listEl) return;

      const score = documentationScore(card);
      scoreEl.innerHTML = "Dokumentation: <strong>" + score + "%</strong>";

      listEl.innerHTML = documentationItems(card).map(item => {
        return `
          <div class="completion-item">
            <span>${escapeHtml(item[0])}</span>
            <span class="${item[1] ? "completion-ok" : "completion-missing"}">${item[1] ? "vorhanden" : "fehlt"}</span>
          </div>
        `;
      }).join("");
    }

    function cardUpdatedTime(card) {
      return new Date(card.updatedAt || card.createdAt || 0).getTime();
    }

    function shortDate(value) {
      if (!value) return "-";
      try {
        return new Intl.DateTimeFormat("de-DE", {
          day: "2-digit",
          month: "2-digit",
          year: "2-digit"
        }).format(new Date(value));
      } catch {
        return "-";
      }
    }

    function cardTodoReason(card) {
      const reasons = [];
      if (!(card.images || [])[0]) reasons.push("Vorderseite fehlt");
      if (!(card.images || [])[1]) reasons.push("Rückseite fehlt");
      if (!card.grade) reasons.push("Note fehlt");
      if (!card.condition) reasons.push("Zustand fehlt");
      if (typeof documentationScore === "function" && documentationScore(card) < 80) reasons.push("Dokumentation unvollständig");
      return reasons;
    }

    function countBy(items, mapper) {
      const counts = new Map();
      items.forEach(item => {
        const key = mapper(item);
        counts.set(key, (counts.get(key) || 0) + 1);
      });
      return Array.from(counts.entries()).map(([label, count]) => ({ label, count }));
    }

    function renderMiniChart(containerId, rows) {
      const container = $(containerId);
      if (!container) return;

      if (!rows.length) {
        container.innerHTML = '<div class="mini-chart-empty">Noch keine Daten vorhanden.</div>';
        return;
      }

      const max = Math.max(...rows.map(row => row.count), 1);
      container.innerHTML = rows.map(row => {
        const width = Math.round((row.count / max) * 100);
        return `
          <div class="mini-chart-row">
            <div class="mini-chart-label">${escapeHtml(row.label)}</div>
            <div class="mini-chart-bar"><div class="mini-chart-fill" style="width:${width}%"></div></div>
            <div class="mini-chart-count">${row.count}</div>
          </div>
        `;
      }).join("");
    }

    function conditionGroup(card) {
      const condition = String(card.condition || "Unbekannt").trim();
      if (!condition) return "Unbekannt";
      const lower = condition.toLowerCase();
      if (lower.includes("gem")) return "Gem Mint";
      if (lower.includes("near")) return "Near Mint";
      if (lower.includes("mint")) return "Mint";
      if (lower.includes("excellent")) return "Excellent";
      if (lower.includes("light")) return "Light Played";
      if (lower.includes("played")) return "Played";
      if (lower.includes("damaged")) return "Damaged";
      return condition;
    }

    function documentationGroup(card) {
      const score = typeof documentationScore === "function" ? documentationScore(card) : 0;
      if (score >= 90) return "90–100 %";
      if (score >= 75) return "75–89 %";
      if (score >= 50) return "50–74 %";
      if (score >= 25) return "25–49 %";
      return "0–24 %";
    }

    function duplicateKey(card) {
      return [
        String(card.name || "").trim().toLowerCase(),
        String(card.set || "").trim().toLowerCase(),
        String(card.number || "").trim().toLowerCase()
      ].join("|");
    }

    function duplicateGroups() {
      const map = new Map();

      cards.forEach(card => {
        const key = duplicateKey(card);
        if (!key.replaceAll("|", "").trim()) return;
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(card);
      });

      return Array.from(map.values())
        .filter(group => group.length > 1)
        .sort((a, b) => b.length - a.length || String(a[0].name || "").localeCompare(String(b[0].name || "")));
    }

    function cardIsDuplicate(card) {
      const key = duplicateKey(card);
      return duplicateGroups().some(group => duplicateKey(group[0]) === key);
    }

    function renderDuplicateDashboard() {
      const list = $("duplicateGroupsList");
      if (!list) return;

      const groups = duplicateGroups().slice(0, 8);

      if (!groups.length) {
        list.innerHTML = '<div class="duplicates-empty">Keine mehrfach vorhandenen Karten erkannt.</div>';
        return;
      }

      list.innerHTML = groups.map(group => {
        const first = group[0];
        const ids = group.map(card => card.id).join(",");
        const values = group.map(card => card.grade || "-").join(" / ");
        return `
          <button class="duplicate-group" type="button" data-duplicate-ids="${escapeHtml(ids)}">
            <div>
              <div class="duplicate-name">${escapeHtml(first.name || "Unbenannte Karte")}</div>
              <div class="duplicate-meta">${escapeHtml(first.set || "-")} · ${escapeHtml(first.number || "-")} · Noten: ${escapeHtml(values)}</div>
            </div>
            <span class="duplicate-count">${group.length}×</span>
          </button>
        `;
      }).join("");

      list.querySelectorAll("[data-duplicate-ids]").forEach(button => {
        button.addEventListener("click", () => {
          const firstId = String(button.dataset.duplicateIds || "").split(",")[0];
          if (firstId) openDetail(firstId);
        });
      });
    }

    function renderDashboardCharts() {
      const conditionRows = countBy(cards, conditionGroup)
        .sort((a, b) => b.count - a.count)
        .slice(0, 7);

      const docOrder = ["90–100 %", "75–89 %", "50–74 %", "25–49 %", "0–24 %"];
      const docRowsRaw = countBy(cards, documentationGroup);
      const docRows = docOrder
        .map(label => ({ label, count: (docRowsRaw.find(row => row.label === label) || { count: 0 }).count }))
        .filter(row => row.count > 0);

      renderMiniChart("conditionChart", conditionRows);
      renderMiniChart("documentationChart", docRows);
    }

    function buildSmartSuggestions() {
      const suggestions = [];

      cards.forEach(card => {
        const value = parseMoney(card.value);
        const hasBack = Boolean((card.images || [])[1]);
        const hasFront = Boolean((card.images || [])[0]);
        const damagePoints = (card.damageFront || []).concat(card.damageBack || []);
        const highDamage = damagePoints.some(point => point.severity === "high");
        const doc = typeof documentationScore === "function" ? documentationScore(card) : 100;

        if (value >= 100 && !hasBack) {
          suggestions.push({
            type: "warn",
            label: "High Value",
            card,
            text: "Hoher Wert eingetragen, aber Rückseite fehlt noch."
          });
        }

        if (!hasFront || !hasBack) {
          suggestions.push({
            type: "warn",
            label: "Bild fehlt",
            card,
            text: !hasFront ? "Vorderseite fehlt noch." : "Rückseite fehlt noch."
          });
        }

        if (highDamage) {
          suggestions.push({
            type: "danger",
            label: "Starker Schaden",
            card,
            text: "Mindestens eine Markierung ist als stark bewertet."
          });
        }

        if (doc < 60) {
          suggestions.push({
            type: "warn",
            label: "Unvollständig",
            card,
            text: "Dokumentationsgrad liegt unter 60 %."
          });
        }

        if (card.status === "Verkaufen" && !card.salePrice && !card.value) {
          suggestions.push({
            type: "info",
            label: "Verkauf",
            card,
            text: "Status ist Verkaufen, aber Verkaufspreis/Marktwert fehlt."
          });
        }

        if (value >= 150 && !(card.timeline || []).length) {
          suggestions.push({
            type: "info",
            label: "Verlauf",
            card,
            text: "Wertvolle Karte ohne Verlaufseintrag."
          });
        }
      });

      const priority = { danger: 0, warn: 1, info: 2 };
      return suggestions
        .sort((a, b) => (priority[a.type] ?? 2) - (priority[b.type] ?? 2) || parseMoney(b.card.value) - parseMoney(a.card.value))
        .slice(0, 6);
    }

    function renderSmartSuggestions() {
      if (!$("smartSuggestionsGrid")) return;
      const grid = $("smartSuggestionsGrid");
      if (!grid) return;

      const suggestions = buildSmartSuggestions();

      if (!suggestions.length) {
        grid.innerHTML = '<div class="suggestion-empty">Keine offenen Hinweise. Deine Sammlung sieht aktuell sauber gepflegt aus.</div>';
        return;
      }

      grid.innerHTML = suggestions.map(item => `
        <button class="suggestion-card" type="button" data-suggestion-card="${escapeHtml(item.card.id)}">
          <span class="suggestion-type ${item.type === "danger" ? "danger" : item.type === "warn" ? "warn" : ""}">${escapeHtml(item.label)}</span>
          <div class="suggestion-name">${escapeHtml(item.card.name || item.card.id)}</div>
          <div class="suggestion-text">${escapeHtml(item.text)}</div>
        </button>
      `).join("");

      grid.querySelectorAll("[data-suggestion-card]").forEach(button => {
        button.addEventListener("click", () => openDetail(button.dataset.suggestionCard));
      });
    }

    function renderRecentDashboard() {
      if (!$("recentCardsList") && !$("todoCardsList")) return;
      const recentEl = $("recentCardsList");
      const todoEl = $("todoCardsList");
      if (!recentEl || !todoEl) return;

      const recent = cards
        .slice()
        .sort((a, b) => cardUpdatedTime(b) - cardUpdatedTime(a))
        .slice(0, 5);

      if (!recent.length) {
        recentEl.innerHTML = '<div class="recent-empty">Noch keine Karten in der Sammlung.</div>';
      } else {
        recentEl.innerHTML = recent.map(card => `
          <button class="recent-item" type="button" data-open-card="${escapeHtml(card.id)}">
            <div class="recent-item-title">${escapeHtml(card.name || card.id)}</div>
            <div class="recent-item-sub">${escapeHtml(card.number || "-")} · Note ${escapeHtml(card.grade || "-")} · ${shortDate(card.updatedAt || card.createdAt)}</div>
          </button>
        `).join("");
      }

      const todos = cards
        .map(card => ({ card, reasons: cardTodoReason(card) }))
        .filter(item => item.reasons.length)
        .sort((a, b) => a.reasons.length - b.reasons.length)
        .slice(0, 5);

      if (!todos.length) {
        todoEl.innerHTML = '<div class="recent-empty">Alles sieht vollständig aus.</div>';
      } else {
        todoEl.innerHTML = todos.map(item => `
          <button class="recent-item" type="button" data-open-card="${escapeHtml(item.card.id)}">
            <div class="recent-item-title">${escapeHtml(item.card.name || item.card.id)}</div>
            <div class="recent-item-sub">${escapeHtml(item.reasons.slice(0, 3).join(" · "))}</div>
            <span class="todo-pill">${item.reasons.length} To-do${item.reasons.length === 1 ? "" : "s"}</span>
          </button>
        `).join("");
      }

      document.querySelectorAll("[data-open-card]").forEach(button => {
        button.addEventListener("click", () => openDetail(button.dataset.openCard));
      });
    }

    function debounce(fn, delay = 250) {
      let timer = null;
      return (...args) => {
        window.clearTimeout(timer);
        timer = window.setTimeout(() => fn(...args), delay);
      };
    }

    function showImportToast(title, message = "", type = "") {
      const stack = $("cvToastStack");
      if (!stack) {
        console.log(title, message);
        return;
      }

      const toast = document.createElement("div");
      toast.className = "cv-toast" + (type ? " " + type : "");
      toast.innerHTML = `
        <div>
          <strong>${escapeHtml(title)}</strong>
          <div>${escapeHtml(message)}</div>
        </div>
        <button type="button" aria-label="Schließen">×</button>
      `;

      toast.querySelector("button").addEventListener("click", () => toast.remove());
      stack.appendChild(toast);
      setTimeout(() => toast.remove(), type === "error" ? 9000 : 5500);
    }

    function loadCardmarketPrices() {
      try {
        return JSON.parse(localStorage.getItem("cardVaultCardmarketPrices") || "[]");
      } catch {
        return [];
      }
    }

    function saveCardmarketPrices() {
      const payload = JSON.stringify(cardmarketPrices);
      const ok = safeLocalSet(CARDMARKET_PRICE_STORAGE_KEY, payload);
      if (!ok) {
        // Auf iPhone/Safari können große Cardmarket-Dateien das Speicherlimit überschreiten.
        // Die Daten bleiben dann trotzdem in dieser Sitzung im Arbeitsspeicher nutzbar.
        safeLocalSet("cardVaultCardmarketPricesUpdated", new Date().toISOString());
        if (typeof setMarketAutoloadPill === "function") {
          setMarketAutoloadPill("Cardmarket geladen, aber nicht dauerhaft gespeichert", "success");
        }
      } else {
        safeLocalSet("cardVaultCardmarketPricesUpdated", new Date().toISOString());
      }
    }

    
    function loadCardmarketProducts() {
      try {
        return JSON.parse(localStorage.getItem("cardVaultCardmarketProducts") || "[]");
      } catch {
        return [];
      }
    }

    function saveCardmarketProducts() {
      const payload = JSON.stringify(cardmarketProducts);
      const ok = safeLocalSet(CARDMARKET_PRODUCTS_STORAGE_KEY, payload);
      if (!ok) {
        // Auf iPhone/Safari können große Cardmarket-Dateien das Speicherlimit überschreiten.
        // Die Daten bleiben dann trotzdem in dieser Sitzung im Arbeitsspeicher nutzbar.
        safeLocalSet("cardVaultCardmarketProductsUpdated", new Date().toISOString());
        if (typeof setMarketAutoloadPill === "function") {
          setMarketAutoloadPill("Cardmarket geladen, aber nicht dauerhaft gespeichert", "success");
        }
      } else {
        safeLocalSet("cardVaultCardmarketProductsUpdated", new Date().toISOString());
      }
    }

    
    function compactCardmarketPriceRecord(record) {
      return {
        idProduct: String(record.idProduct || ""),
        idCategory: String(record.idCategory || ""),
        avg: record.avg === "" ? "" : Number(record.avg),
        low: record.low === "" ? "" : Number(record.low),
        trend: record.trend === "" ? "" : Number(record.trend),
        avg1: record.avg1 === "" ? "" : Number(record.avg1),
        avg7: record.avg7 === "" ? "" : Number(record.avg7),
        avg30: record.avg30 === "" ? "" : Number(record.avg30),
        lowFoil: record.lowFoil === "" ? "" : Number(record.lowFoil),
        trendFoil: record.trendFoil === "" ? "" : Number(record.trendFoil),
        avgFoil: record.avgFoil === "" ? "" : Number(record.avgFoil)
      };
    }

    function compactCardmarketProductRecord(record) {
      const product = record || {};
      const name = product.name || product.enName || product.productName || product.product_name || "";
      const baseName = product.baseName || product.name || product.enName || product.productName || product.product_name || "";
      const number = product.number || product.collectorNumber || product.collector_number || product.cardNumber || product.card_number || product.nr || "";
      const categoryName = product.categoryName || product.category_name || product.category || "";
      const expansionName = product.expansionName || product.expansion_name || product.expansion || product.setName || product.set_name || "";
      const rarity = product.rarity || product.rarityName || product.rarity_name || "";
      const language = product.language || product.languageName || product.language_name || product.lang || "";
      const version = product.version || product.variant || product.comment || product.description || product.subType || product.subtype || "";
      const idProduct = product.idProduct || product.id_product || product.id || "";
      const idExpansion = product.idExpansion || product.id_expansion || "";
      const idMetacard = product.idMetacard || product.id_metacard || "";
      const dateAdded = product.dateAdded || product.date_added || "";

      return {
        idProduct,
        idExpansion,
        idMetacard,
        name,
        baseName,
        number,
        categoryName,
        expansionName,
        rarity,
        language,
        version,
        dateAdded
      };
    }
    function safeSetLargeLocalStorage(key, value, label) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch (error) {
        console.error(error);
        showImportToast(
          label + " nicht dauerhaft gespeichert",
          "Der Browser-Speicher ist voll. Die Daten bleiben bis zum Neuladen nutzbar. Alte Backups/Website-Daten im Browser können Speicher freigeben.",
          "error"
        );
        return false;
      }
    }

    function normalizeMarketText(value) {
      return String(value || "")
        .toLowerCase()
        .replace(/[^a-z0-9äöüß]+/gi, " ")
        .replace(/\s+/g, " ")
        .trim();
    }

    function parseMarketNumber(value) {
      if (value === undefined || value === null) return "";
      const clean = String(value)
        .replace("€", "")
        .replace(/\s/g, "")
        .replace(",", ".")
        .replace(/[^0-9.\-]/g, "");
      const num = Number(clean);
      return Number.isFinite(num) ? num : "";
    }

    function pickFirst(obj, keys) {
      for (const key of keys) {
        if (obj[key] !== undefined && obj[key] !== null && obj[key] !== "") return obj[key];
      }
      return "";
    }

    function normalizeMarketRecord(raw) {
      const name = pickFirst(raw, ["name", "productName", "enName", "localizedName", "cardName", "Product Name", "Name"]);
      const number = pickFirst(raw, ["number", "collectorNumber", "nr", "cardNumber", "Number", "Collector Number"]);
      const expansion = pickFirst(raw, ["expansion", "set", "setName", "expansionName", "Expansion", "Set"]);
      const idProduct = pickFirst(raw, ["idProduct", "productId", "id", "ID Product"]);

      return {
        idProduct: String(idProduct || ""),
        idCategory: String(pickFirst(raw, ["idCategory", "categoryId", "Category ID"]) || ""),
        name: String(name || ""),
        number: String(number || ""),
        set: String(expansion || ""),
        low: parseMarketNumber(pickFirst(raw, ["low", "lowPrice", "priceLow", "LOW", "Low"])),
        trend: parseMarketNumber(pickFirst(raw, ["trend", "trendPrice", "priceTrend", "TREND", "Trend"])),
        avg: parseMarketNumber(pickFirst(raw, ["avg", "avgPrice", "average", "AVG", "Average"])),
        avg1: parseMarketNumber(pickFirst(raw, ["avg1", "avg1Days", "oneDay", "AVG1"])),
        avg7: parseMarketNumber(pickFirst(raw, ["avg7", "avg7Days", "sevenDays", "AVG7"])),
        avg30: parseMarketNumber(pickFirst(raw, ["avg30", "avg30Days", "thirtyDays", "AVG30"])),
        lowFoil: parseMarketNumber(pickFirst(raw, ["low-foil", "lowFoil"])),
        trendFoil: parseMarketNumber(pickFirst(raw, ["trend-foil", "trendFoil"])),
        avgFoil: parseMarketNumber(pickFirst(raw, ["avg-foil", "avgFoil"])),
      };
    }

    function splitCardmarketProductName(value) {
      const full = String(value || "").trim();
      const match = full.match(/^(.*?)\s*\(([^()]+)\)\s*$/);
      if (!match) {
        return { displayName: full, baseName: full, number: "" };
      }
      return {
        displayName: full,
        baseName: match[1].trim(),
        number: match[2].trim()
      };
    }

    function normalizeCardNameForMatch(value) {
      return String(value || "")
        .toLowerCase()
        .replace(/monkey\s*\.\s*d\s*\.\s*luffy/g, "monkey d luffy")
        .replace(/portgas\s*\.\s*d\s*\.\s*ace/g, "portgas d ace")
        .replace(/trafalgar\s*\.\s*law/g, "trafalgar law")
        .replace(/edward\s*\.\s*newgate/g, "edward newgate")
        .replace(/marshall\s*\.\s*d\s*\.\s*teach/g, "marshall d teach")
        .replace(/tony\s*tony\s*\.\s*chopper/g, "tony tony chopper")
        .replace(/[´’]/g, "'")
        .replace(/[^a-z0-9]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    }

    function normalizeCatalogRecord(raw) {
      const idProduct = pickFirst(raw, ["idProduct", "productId", "id", "ID Product"]);
      const idCategory = pickFirst(raw, ["idCategory", "categoryId", "Category ID"]);
      const idExpansion = pickFirst(raw, ["idExpansion", "expansionId", "Expansion ID"]);
      const idMetacard = pickFirst(raw, ["idMetacard", "metacardId", "Metacard ID"]);
      const categoryName = pickFirst(raw, ["categoryName", "Category Name"]);
      const name = pickFirst(raw, ["name", "productName", "enName", "localizedName", "cardName", "Product Name", "Name"]);
      const parsed = splitCardmarketProductName(name);
      const number = pickFirst(raw, ["number", "collectorNumber", "nr", "cardNumber", "Number", "Collector Number"]) || parsed.number;
      const expansion = pickFirst(raw, ["expansion", "set", "setName", "expansionName", "Expansion", "Set"]);
      const rarity = pickFirst(raw, ["rarity", "Rarity"]);

      return {
        idProduct: String(idProduct || ""),
        idCategory: String(idCategory || ""),
        categoryName: String(categoryName || ""),
        idExpansion: String(idExpansion || ""),
        idMetacard: String(idMetacard || ""),
        name: parsed.displayName || String(name || ""),
        baseName: parsed.baseName || String(name || ""),
        number: String(number || ""),
        set: String(expansion || ""),
        rarity: String(rarity || ""),
        dateAdded: String(raw.dateAdded || ""),
      };
    }

    function flattenCatalogJson(value, results = []) {
      if (Array.isArray(value)) {
        value.forEach(item => flattenCatalogJson(item, results));
      } else if (value && typeof value === "object") {
        if (Array.isArray(value.products)) {
          value.products.forEach(item => flattenCatalogJson(item, results));
          return results;
        }

        if (Array.isArray(value.productCatalog)) {
          value.productCatalog.forEach(item => flattenCatalogJson(item, results));
          return results;
        }

        const keys = Object.keys(value);
        const hasProductId = keys.includes("idProduct") || keys.includes("productId") || keys.includes("id");
        const hasName = keys.some(key => /name|product/i.test(key));

        if (hasProductId && hasName) {
          results.push(value);
          return results;
        }

        keys.forEach(key => {
          if (Array.isArray(value[key]) || (value[key] && typeof value[key] === "object")) {
            flattenCatalogJson(value[key], results);
          }
        });
      }
      return results;
    }

    function parseCatalogFileContent(content) {
      let rawRecords = [];

      try {
        const json = JSON.parse(content);
        rawRecords = flattenCatalogJson(json);
      } catch {
        rawRecords = parseMarketCsv(content);
      }

      return rawRecords
        .map(normalizeCatalogRecord)
        .filter(record => record.idProduct && record.name);
    }

    function flattenMarketJson(value, results = []) {
      if (Array.isArray(value)) {
        value.forEach(item => flattenMarketJson(item, results));
      } else if (value && typeof value === "object") {
        if (Array.isArray(value.priceGuides)) {
          value.priceGuides.forEach(item => flattenMarketJson(item, results));
          return results;
        }

        const keys = Object.keys(value);
        const hasProductId = keys.includes("idProduct") || keys.includes("productId") || keys.includes("id");
        const hasPrice = keys.some(key => /trend|avg|low|price/i.test(key));

        if (hasProductId && hasPrice) {
          results.push(value);
          return results;
        }

        keys.forEach(key => {
          if (Array.isArray(value[key]) || (value[key] && typeof value[key] === "object")) {
            flattenMarketJson(value[key], results);
          }
        });
      }
      return results;
    }

    function detectCsvDelimiter(line) {
      const semicolons = (line.match(/;/g) || []).length;
      const commas = (line.match(/,/g) || []).length;
      return semicolons >= commas ? ";" : ",";
    }

    function parseCsvLine(line, delimiter = null) {
      const result = [];
      let current = "";
      let quoted = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const next = line[i + 1];

        if (char === '"' && quoted && next === '"') {
          current += '"';
          i++;
        } else if (char === '"') {
          quoted = !quoted;
        } else if ((delimiter ? char === delimiter : (char === ";" || char === ",")) && !quoted) {
          result.push(current);
          current = "";
        } else {
          current += char;
        }
      }

      result.push(current);
      return result;
    }

    function parseMarketCsv(text) {
      const lines = text.split(/\r?\n/).filter(line => line.trim());
      if (lines.length < 2) return [];
      const delimiter = detectCsvDelimiter(lines[0]);
      const headers = parseCsvLine(lines[0], delimiter).map(header => header.trim());

      return lines.slice(1).map(line => {
        const values = parseCsvLine(line, delimiter);
        const obj = {};
        headers.forEach((header, index) => obj[header] = values[index] || "");
        return obj;
      });
    }

    function parseMarketFileContent(content) {
      let rawRecords = [];

      try {
        const json = JSON.parse(content);

        if (json && Array.isArray(json.priceGuides)) {
          rawRecords = json.priceGuides;
        } else if (Array.isArray(json)) {
          rawRecords = json;
        } else {
          rawRecords = flattenMarketJson(json);
        }
      } catch {
        rawRecords = parseMarketCsv(content);
      }

      const normalized = rawRecords
        .map(normalizeMarketRecord)
        .filter(record => record.idProduct && (
          record.avg !== "" ||
          record.low !== "" ||
          record.trend !== "" ||
          record.avg1 !== "" ||
          record.avg7 !== "" ||
          record.avg30 !== ""
        ));

      return normalized;
    }

    function marketMatchScore(card, price) {
      let score = 0;
      const cardProductId = String(card.marketProductId || card.idProduct || "").trim();
      const priceProductId = String(price.idProduct || "").trim();

      if (cardProductId && priceProductId && cardProductId === priceProductId) {
        return 999;
      }

      const cardName = normalizeCardNameForMatch(card.name);
      const priceName = normalizeCardNameForMatch(price.baseName || price.name);
      const cardNumber = normalizeMarketText(card.number);
      const priceNumber = normalizeMarketText(price.number);
      const cardSet = normalizeMarketText(card.set);
      const priceSet = normalizeMarketText(price.set);

      if (cardName && priceName) {
        if (cardName === priceName) score += 80;
        else if (priceName.includes(cardName) || cardName.includes(priceName)) score += 45;
      }

      if (cardNumber && priceNumber) {
        if (cardNumber === priceNumber) score += 90;
        else if (priceNumber.includes(cardNumber) || cardNumber.includes(priceNumber)) score += 35;
      }

      if (cardSet && priceSet && (cardSet === priceSet || priceSet.includes(cardSet) || cardSet.includes(priceSet))) score += 20;

      if (cardNumber && priceNumber && cardName && priceName && cardName === priceName && cardNumber === priceNumber) score += 100;

      return score;
    }

    function findCardmarketProduct(card) {
      const cardProductId = String(card.marketProductId || card.idProduct || "").trim();
      if (cardProductId) {
        return cardmarketProducts.find(product => String(product.idProduct) === cardProductId) || null;
      }

      if (!cardmarketProducts.length) return null;

      const ranked = cardmarketProducts
        .map(product => ({ product, score: marketMatchScore(card, product) }))
        .filter(item => item.score >= 100)
        .sort((a, b) => b.score - a.score || String(a.product.dateAdded || "").localeCompare(String(b.product.dateAdded || "")));

      return ranked[0] ? ranked[0].product : null;
    }

    function findCardmarketProductCandidates(card, limit = 5) {
      if (!cardmarketProducts.length) return [];

      return cardmarketProducts
        .map(product => ({ product, score: marketMatchScore(card, product) }))
        .filter(item => item.score >= 70)
        .sort((a, b) => b.score - a.score || String(a.product.dateAdded || "").localeCompare(String(b.product.dateAdded || "")))
        .slice(0, limit);
    }

    function findMarketPrice(card) {
      if (!cardmarketPrices.length) return null;

      const cardProductId = String(card.marketProductId || card.idProduct || "").trim();
      const catalogProduct = findCardmarketProduct(card);
      const effectiveProductId = cardProductId || (catalogProduct ? String(catalogProduct.idProduct) : "");

      if (effectiveProductId) {
        const exact = cardmarketPrices.find(price => String(price.idProduct) === effectiveProductId);
        if (exact) {
          return { price: { ...exact, name: exact.name || (catalogProduct ? catalogProduct.name : "") }, score: 999 };
        }
      }

      const ranked = cardmarketPrices
        .map(price => ({ price, score: marketMatchScore(card, price) }))
        .filter(item => item.score >= 50)
        .sort((a, b) => b.score - a.score);

      return ranked[0] || null;
    }

    function formatMarketEuro(value) {
      if (value === "" || value === undefined || value === null || Number.isNaN(Number(value))) return "-";
      return Number(value).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
    }

    function formatDateTime(value) {
      if (!value) return "-";
      try {
        return new Intl.DateTimeFormat("de-DE", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit"
        }).format(new Date(value));
      } catch {
        return String(value);
      }
    }

    function saveDetailMarketProductId() {
      if (!currentDetailCard || !$("detailMarketProductIdInput")) return;
      const value = $("detailMarketProductIdInput").value.trim();
      if (!value) {
        showImportToast("Product-ID fehlt", "Bitte eine Cardmarket Produkt-ID eintragen.", "error");
        return;
      }

      cards = cards.map(card => {
        if (card.id !== currentDetailCard.id) return card;
        const next = { ...card };
        next.marketProductId = value;
        next.updatedAt = new Date().toISOString();
        next.timeline = Array.isArray(next.timeline) ? next.timeline.slice() : [];
        next.timeline.unshift({
          date: todayIsoDate(),
          text: "Cardmarket Produkt-ID hinterlegt: " + value,
          createdAt: new Date().toISOString()
        });
        currentDetailCard = next;
        return next;
      });

      saveCards();
      renderStats();
      renderCards();
      openDetail(currentDetailCard.id);
    }

    function applyMarketPriceToCard(price) {
      if (!currentDetailCard || !price) return;
      const value = price.trend || price.avg || price.avg30 || price.avg7 || price.low;
      if (value === "" || value === null || value === undefined) return;

      cards = cards.map(card => {
        if (card.id !== currentDetailCard.id) return card;
        const next = { ...card };
        next.value = formatMarketEuro(value);
        next.marketProductId = next.marketProductId || String(price.idProduct || "");
        next.updatedAt = new Date().toISOString();
        next.timeline = Array.isArray(next.timeline) ? next.timeline.slice() : [];
        next.timeline.unshift({
          date: todayIsoDate(),
          text: "Cardmarket-Preis übernommen: " + formatMarketEuro(value),
          createdAt: new Date().toISOString()
        });
        currentDetailCard = next;
        return next;
      });

      saveCards();
      renderStats();
      renderCards();
      openDetail(currentDetailCard.id);
    }

    function saveProductCandidate(productId) {
      if (!currentDetailCard || !productId) return;
      if ($("detailMarketProductIdInput")) $("detailMarketProductIdInput").value = productId;
      saveDetailMarketProductId();
    }

    function renderProductCandidates(card) {
      const candidates = findCardmarketProductCandidates(card, 5);
      if (!candidates.length) return "";

      return `
        <div class="catalog-match-box">
          <strong>Mögliche Treffer aus dem Produktkatalog:</strong>
          <div class="catalog-match-list">
            ${candidates.map(item => `
              <button class="catalog-match-option" type="button" data-product-candidate="${escapeHtml(item.product.idProduct)}">
                <div>
                  <strong>${escapeHtml(item.product.name || item.product.baseName || item.product.idProduct)}</strong><br>
                  <span>Product-ID ${escapeHtml(item.product.idProduct)} · ${escapeHtml(item.product.categoryName || "-")} · Expansion ${escapeHtml(item.product.idExpansion || "-")}</span>
                </div>
                <span class="catalog-score">${item.score}</span>
              </button>
            `).join("")}
          </div>
        </div>
      `;
    }

    function bindProductCandidateButtons() {
      document.querySelectorAll("[data-product-candidate]").forEach(button => {
        button.addEventListener("click", () => saveProductCandidate(button.dataset.productCandidate));
      });
    }

    function renderMarketPriceDetail(card) {
      const box = $("detailMarketPriceBox");
      const grid = $("detailMarketPriceGrid");
      const note = $("detailMarketPriceNote");
      if (!box || !grid || !note) return;

      const match = findMarketPrice(card);

      if (!match) {
        box.style.display = "block";
        grid.innerHTML = "";
        if ($("detailMarketPriceActions")) htmlIfExists("detailMarketPriceActions", "");
        const updated = localStorage.getItem("cardVaultCardmarketPricesUpdated");
        const hasProductId = Boolean(card.marketProductId || card.idProduct);
        const catalogUpdated = localStorage.getItem("cardVaultCardmarketProductsUpdated");

        if (!cardmarketPrices.length) {
          note.innerHTML = '<div class="market-warning-box">Noch keine Cardmarket-Preisdatei importiert.</div>';
        } else if (!hasProductId && !cardmarketProducts.length) {
          note.innerHTML = '<div class="market-warning-box">Kein Preis gefunden, weil die Preisdatei nur Product-IDs enthält. Trage die Cardmarket Produkt-ID ein oder importiere zusätzlich den Cardmarket Produktkatalog.</div>';
        } else if (!hasProductId) {
          note.innerHTML = '<div class="market-warning-box">Kein Preis gefunden. Es wurde zwar ein Produktkatalog importiert, aber zu dieser Karte konnte keine Product-ID gematcht werden.</div>';
        } else {
          note.innerHTML = '<div class="market-warning-box">Keine passende Product-ID in der importierten Preisdatei gefunden.</div>';
        }

        if (updated && cardmarketPrices.length) note.innerHTML += '<div class="market-import-summary">Letzter Preisimport: ' + (typeof formatDateTime === "function" ? formatDateTime(updated) : updated) + '.</div>';
        if (catalogUpdated && cardmarketProducts.length) note.innerHTML += '<div class="market-import-summary">Letzter Produktkatalog-Import: ' + (typeof formatDateTime === "function" ? formatDateTime(catalogUpdated) : catalogUpdated) + '.</div>';
        note.innerHTML += renderProductCandidates(card);
        bindProductCandidateButtons();

        if ($("detailMarketProductIdInput")) $("detailMarketProductIdInput").value = card.marketProductId || card.idProduct || "";
        return;
      }

      const price = match.price;
      if ($("detailMarketProductIdInput")) $("detailMarketProductIdInput").value = card.marketProductId || card.idProduct || price.idProduct || "";
      grid.innerHTML = `
        <div class="market-price-item"><div class="market-price-label">Trend</div><div class="market-price-value">${formatMarketEuro(price.trend)}</div></div>
        <div class="market-price-item"><div class="market-price-label">Low</div><div class="market-price-value">${formatMarketEuro(price.low)}</div></div>
        <div class="market-price-item"><div class="market-price-label">Ø</div><div class="market-price-value">${formatMarketEuro(price.avg)}</div></div>
        <div class="market-price-item"><div class="market-price-label">Ø 1 Tag</div><div class="market-price-value">${formatMarketEuro(price.avg1)}</div></div>
        <div class="market-price-item"><div class="market-price-label">Ø 7 Tage</div><div class="market-price-value">${formatMarketEuro(price.avg7)}</div></div>
        <div class="market-price-item"><div class="market-price-label">Ø 30 Tage</div><div class="market-price-value">${formatMarketEuro(price.avg30)}</div></div>
      `;

      const actions = $("detailMarketPriceActions");
      if (actions) {
        actions.innerHTML = `
          <button class="market-action-button" type="button" id="applyTrendPriceBtn">Trend als Marktwert übernehmen</button>
          <button class="market-action-button secondary" type="button" id="copyProductIdBtn">Product-ID kopieren</button>
        `;

        if ($("applyTrendPriceBtn")) onIfExists("applyTrendPriceBtn", "click", () => applyMarketPriceToCard(price));
        if ($("copyProductIdBtn")) onIfExists("copyProductIdBtn", "click", () => navigator.clipboard?.writeText(String(price.idProduct || "")));
      }

      const product = findCardmarketProduct(card);
      const productText = product ? product.name + " · Product-ID " + product.idProduct : (price.name || "Product-ID " + price.idProduct);
      note.innerHTML = `<span class="market-match-pill">${match.score >= 999 ? "Exakter Treffer über Product-ID/Produktkatalog" : "Treffer"}: ${escapeHtml(productText)} · Score ${match.score}</span>`;
      if (!card.marketProductId && product && product.idProduct) {
        note.innerHTML += '<div class="catalog-match-box">Der Treffer kommt aus dem Produktkatalog. Du kannst die Product-ID speichern, damit die Karte künftig eindeutig gematcht wird.</div>';
      }
    }


    function normalizeProductId(value) {
      return String(value || "").trim();
    }

    function getCardProductId(card) {
      return normalizeProductId(
        card.cardmarketProductId ||
        card.marketProductId ||
        card.idProduct ||
        card.productId ||
        ""
      );
    }

    function getPriceProductId(price) {
      return normalizeProductId(
        price.idProduct ||
        price.productId ||
        price.cardmarketProductId ||
        price.id ||
        ""
      );
    }

    function extractMarketPriceValue(price) {
      if (!price) return "";
      const candidates = [
        price.trend,
        price.avg,
        price.avg30,
        price.avg7,
        price.low,
        price.lowest,
        price.marketPrice,
        price.price,
        price.value
      ];

      for (const candidate of candidates) {
        if (candidate === undefined || candidate === null || candidate === "") continue;
        const normalized = String(candidate).replace("€", "").replace(",", ".").trim();
        const number = Number(normalized);
        if (Number.isFinite(number)) return number;
      }
      return "";
    }

    function formatMarketPriceValue(value) {
      const number = Number(value);
      if (!Number.isFinite(number)) return "";
      return number.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
    }

    function findCardmarketPriceForCard(card) {
      const productId = getCardProductId(card);
      if (!productId || !Array.isArray(cardmarketPrices) || !cardmarketPrices.length) return null;

      return cardmarketPrices.find(price => getPriceProductId(price) === productId) || null;
    }

    function refreshCardmarketPricesForCollection(options = {}) {
      const silent = options.silent !== false;
      if (!Array.isArray(cards) || !cards.length || !Array.isArray(cardmarketPrices) || !cardmarketPrices.length) {
        return { updated: 0, matched: 0, total: cards.length || 0 };
      }

      let updated = 0;
      let matched = 0;
      const now = new Date().toISOString();

      cards = cards.map(card => {
        const price = findCardmarketPriceForCard(card);
        if (!price) return card;

        const priceValue = extractMarketPriceValue(price);
        if (priceValue === "") return card;

        matched += 1;

        const formatted = formatMarketPriceValue(priceValue);
        const previousMarketValue = String(card.marketPrice || "");
        const previousValue = String(card.value || "");

        const next = { ...card };
        next.marketPrice = formatted;
        next.marketPriceRaw = priceValue;
        next.marketPriceUpdatedAt = now;
        next.marketPriceSource = "Cardmarket";

        // Das alte Feld value wird weiterhin für die Galerie genutzt.
        // Kaufpreis bleibt separat in purchasePrice erhalten.
        next.value = formatted;

        if (previousMarketValue !== formatted || previousValue !== formatted) {
          updated += 1;
          next.updatedAt = now;
        }

        return next;
      });

      if (matched) {
        saveCards();
        if (typeof renderStats === "function") renderStats();
        if (typeof renderCards === "function") renderCards();
      }

      if (!silent && matched) {
        showImportToast(
          "Preise aktualisiert",
          matched + " Karte(n) wurden mit der aktuellen Cardmarket-Preisliste abgeglichen.",
          "success"
        );
      }

      return { updated, matched, total: cards.length };
    }

    function catalogProductPrice(product) {
      if (!product || !cardmarketPrices.length) return null;
      const productId = normalizeProductId(product.idProduct || product.productId || product.id);
      return cardmarketPrices.find(price => getPriceProductId(price) === productId) || null;
    }

    function catalogProductDisplayName(product) {
      if (!product) return "";
      return product.name || ((product.baseName || "Karte") + (product.number ? " (" + product.number + ")" : ""));
    }
    function inferCatalogLanguage(product) {
      if (!product) return "";
      const raw = [
        product.language,
        product.languageName,
        product.lang,
        product.name,
        product.categoryName,
        product.version
      ].filter(Boolean).join(" ").toLowerCase();

      if (/\bdeutsch\b|\bgerman\b|\bde\b/.test(raw)) return "Deutsch";
      if (/\benglish\b|\benglisch\b|\ben\b/.test(raw)) return "Englisch";
      if (/\bjapanese\b|\bjapanisch\b|\bjp\b|\bja\b/.test(raw)) return "Japanisch";
      if (/\bfrench\b|\bfranzösisch\b|\bfr\b/.test(raw)) return "Französisch";
      if (/\bitalian\b|\bitalienisch\b|\bit\b/.test(raw)) return "Italienisch";
      if (/\bspanish\b|\bspanisch\b|\bes\b/.test(raw)) return "Spanisch";
      return product.language || "";
    }

    function inferCatalogVariant(product) {
      if (!product) return "";
      const raw = [
        product.name,
        product.version,
        product.rarity,
        product.categoryName,
        product.expansionName
      ].filter(Boolean).join(" ");
      const lower = raw.toLowerCase();
      const parts = [];

      if (/parallel|alt\s*art|alternative|alternate/.test(lower)) parts.push("Alt/Parallel");
      if (/manga/.test(lower)) parts.push("Manga");
      if (/promo|promotion/.test(lower)) parts.push("Promo");
      if (/winner|championship|tournament/.test(lower)) parts.push("Event/Winner");
      if (/foil|holo/.test(lower)) parts.push("Foil");
      if (product.rarity && !parts.includes(product.rarity)) parts.push(product.rarity);
      if (product.version && !parts.includes(product.version)) parts.push(product.version);

      return parts.slice(0, 3).join(" · ");
    }

    function catalogProductMeta(product) {
      if (!product) return "";
      const parts = [];
      if (product.number) parts.push(product.number);

      const language = inferCatalogLanguage(product);
      if (language) parts.push(language);

      const expansion = product.expansionName || "";
      if (expansion) parts.push(expansion);

      const variant = inferCatalogVariant(product);
      if (variant) parts.push(variant);

      return parts.join(" · ");
    }

    function catalogProductImageSources(product) {
      if (!product) return [];
      const candidates = onePieceApiImageCandidates(product);
      return candidates.filter(Boolean);
    }

    function catalogProductImageHtml(product) {
      const sources = catalogProductImageSources(product);
      if (!sources.length) return '<div class="catalog-result-thumb placeholder">CARD</div>';
      const first = sources[0];
      const rest = sources.slice(1).map(src => escapeHtml(src)).join("|");
      return `
        <div class="catalog-result-thumb has-image">
          <img src="${escapeHtml(first)}" data-fallbacks="${rest}" alt="${escapeHtml(catalogProductDisplayName(product))}">
        </div>
      `;
    }

    function searchCatalogProducts(query, limit = 12) {
      const q = String(query || "").trim();
      if (!q || !cardmarketProducts.length) return [];

      const normalized = normalizeCardNameForMatch(q);
      const numberMatch = q.match(/[A-Z]{1,4}\d{1,2}-\d{3}|P-\d{3}|ST\d{2}-\d{3}/i);
      const queryNumber = numberMatch ? normalizeMarketText(numberMatch[0]) : "";

      return cardmarketProducts
        .map(product => {
          const name = normalizeCardNameForMatch(product.baseName || product.name);
          const full = normalizeCardNameForMatch(product.name);
          const number = normalizeMarketText(product.number);
          let score = 0;

          if (name && normalized) {
            if (name === normalized) score += 120;
            else if (name.includes(normalized) || normalized.includes(name)) score += 70;
            else {
              const words = normalized.split(" ").filter(Boolean);
              const hits = words.filter(word => name.includes(word) || full.includes(word)).length;
              score += hits * 18;
            }
          }

          if (queryNumber && number) {
            if (queryNumber === number) score += 160;
            else if (number.includes(queryNumber) || queryNumber.includes(number)) score += 60;
          } else if (number && normalized.includes(number)) {
            score += 120;
          }

          if (product.idProduct && normalized.includes(String(product.idProduct))) score += 220;

          return { product, score };
        })
        .filter(item => item.score >= 35)
        .sort((a, b) => b.score - a.score || String(a.product.dateAdded || "").localeCompare(String(b.product.dateAdded || "")))
        .slice(0, limit);
    }

    function renderCatalogSearchResults(targetId, results, mode = "full") {
      const target = $(targetId);
      if (!target) return;

      if (!cardmarketProducts.length) {
        target.innerHTML = '<div class="market-warning-box">Noch kein Produktkatalog geladen. Bitte Produktkatalog importieren oder Auto-Load nutzen.</div>';
        return;
      }

      if (!results.length) {
        target.innerHTML = '<div class="market-warning-box">Keine Treffer gefunden. Versuche Name + Kartennummer, z. B. Monkey D Luffy OP01-003.</div>';
        return;
      }

      target.innerHTML = results.map(item => {
        const product = item.product;
        const price = catalogProductPrice(product);
        const trend = price ? (price.trend || price.avg || price.avg30 || price.low) : "";
        return `
          <button class="catalog-result-card with-image" type="button" data-catalog-pick="${escapeHtml(product.idProduct)}" data-catalog-mode="${escapeHtml(mode)}">
            ${catalogProductImageHtml(product)}
            <div class="catalog-result-main">
              <div class="catalog-result-name">${escapeHtml(catalogProductDisplayName(product))}</div>
              <div class="catalog-result-meta">${escapeHtml(catalogProductMeta(product))}</div>
            </div>
            <div class="catalog-result-price">
              <span class="catalog-price-pill">${trend !== "" ? formatMarketEuro(trend) : "kein Preis"}</span>
            </div>
          </button>
        `;
      }).join("");

      target.querySelectorAll("[data-catalog-pick]").forEach(button => {
        button.addEventListener("click", () => pickCatalogProduct(button.dataset.catalogPick, button.dataset.catalogMode));
      });
      bindGalleryImageFallbacks(target);
    }

    function pickCatalogProduct(productId, mode = "full") {
      const product = cardmarketProducts.find(item => String(item.idProduct) === String(productId));
      if (!product) return;

      const price = catalogProductPrice(product);
      const trend = price ? (price.trend || price.avg || price.avg30 || price.low) : "";

      if (mode === "quick") {
        quickSelectedCatalogProduct = product;
        if ($("quickName")) $("quickName").value = product.baseName || product.name || "";
        if ($("quickNumber")) $("quickNumber").value = product.number || "";
        if ($("quickMarketProductId")) $("quickMarketProductId").value = product.idProduct || "";
        if ($("quickValue") && trend !== "") $("quickValue").value = formatMarketEuro(trend);
        if ($("quickTags")) {
          const existing = String($("quickTags").value || "").trim();
          const autoTag = product.categoryName ? product.categoryName : "Cardmarket";
          $("quickTags").value = existing ? existing + ", " + autoTag : autoTag;
        }
        if ($("quickCatalogResults")) {
          htmlIfExists("quickCatalogResults", '<div class="catalog-selected-box active"><strong>Ausgewählt: ' + escapeHtml(catalogProductDisplayName(product)) + '</strong><span>Product-ID ' + escapeHtml(product.idProduct) + ' · ' + escapeHtml(catalogProductMeta(product)) + '</span></div>');
        }
        showImportToast("Karte ausgewählt", catalogProductDisplayName(product), "success");
        return;
      }

      selectedCatalogProduct = product;
      if ($("cardName")) $("cardName").value = product.baseName || product.name || "";
      if ($("cardNumber")) $("cardNumber").value = product.number || "";
      if ($("cardmarketProductId")) $("cardmarketProductId").value = product.idProduct || "";
      if ($("cardValue") && trend !== "") $("cardValue").value = formatMarketEuro(trend);

      if ($("catalogSelectedBox")) {
        $("catalogSelectedBox").classList.add("active");
        htmlIfExists("catalogSelectedBox", '<strong>Ausgewählt: ' + escapeHtml(catalogProductDisplayName(product)) + '</strong><span>Product-ID ' + escapeHtml(product.idProduct) + ' · ' + escapeHtml(catalogProductMeta(product)) + (trend !== "" ? ' · Trend: ' + escapeHtml(formatMarketEuro(trend)) : '') + '</span>');
      }

      if ($("catalogSearchResults")) htmlIfExists("catalogSearchResults", "");
      renderInlineCatalogSelection(product);
      updateProfitPreview();
      showImportToast("Karte ausgewählt", catalogProductDisplayName(product), "success");
    }

    function buildInlineCatalogQuery() {
      const name = $("cardName") ? $("cardName").value.trim() : "";
      const number = $("cardNumber") ? $("cardNumber").value.trim() : "";
      return (name + " " + number).trim();
    }

    function renderCardmarketInfoPanel(product) {
      const panel = $("cardmarketInfoPanel");
      const title = $("cardmarketInfoTitle");
      const sub = $("cardmarketInfoSub");
      const grid = $("cardmarketInfoGrid");
      if (!panel || !grid) return;

      if (!product) {
        panel.classList.remove("active");
        grid.innerHTML = "";
        return;
      }

      const price = catalogProductPrice(product);
      const trend = price ? (price.trend || price.avg || price.avg30 || price.low) : "";

      panel.classList.add("active");
      if (title) title.textContent = catalogProductDisplayName(product);
      if (sub) sub.textContent = "Aus dem Cardmarket-Produktkatalog übernommen.";

      grid.innerHTML = `
        <div class="cardmarket-info-item">
          <div class="cardmarket-info-label">Kartennummer</div>
          <div class="cardmarket-info-value">${escapeHtml(product.number || "-")}</div>
        </div>
        <div class="cardmarket-info-item">
          <div class="cardmarket-info-label">Trendpreis</div>
          <div class="cardmarket-info-value">${trend !== "" ? formatMarketEuro(trend) : "-"}</div>
        </div>
      `;
    }
    function toggleManualExtraFields() {
      const fields = $("manualExtraFields");
      const button = $("toggleManualExtraBtn");
      if (!fields || !button) return;

      const active = fields.classList.toggle("active");
      button.textContent = active ? "Manuelle Zuordnung ausblenden ▴" : "Manuelle Zuordnung anzeigen ▾";
    }

    function renderInlineCatalogSelection(product) {
      renderCardmarketInfoPanel(product);
      const box = $("inlineSelectedCardmarket");
      if (!box) return;

      if (!product) {
        box.classList.remove("active");
        if ($("inlineSelectedTitle")) textIfExists("inlineSelectedTitle", "Cardmarket-Karte ausgewählt");
        if ($("inlineSelectedMeta")) textIfExists("inlineSelectedMeta", "");
        return;
      }

      const price = catalogProductPrice(product);
      const trend = price ? (price.trend || price.avg || price.avg30 || price.low) : "";
      box.classList.add("active");

      if ($("inlineSelectedTitle")) textIfExists("inlineSelectedTitle", catalogProductDisplayName(product));
      if ($("inlineSelectedMeta")) {
        (($("inlineSelectedMeta") || {}).textContent) =
          catalogProductMeta(product) +
          (trend !== "" ? " · Trend: " + formatMarketEuro(trend) : "");
      }
    }

    function renderInlineCatalogSuggestions(results) {
      const box = $("inlineCatalogSuggestions");
      const list = $("inlineCatalogSuggestionList");
      const count = $("inlineSuggestionCount");
      if (!box || !list) return;

      if (!cardmarketProducts.length) {
        box.classList.add("active");
        list.innerHTML = '<div class="market-warning-box">Produktkatalog noch nicht geladen. Lege products_singles_18.json in den App-Ordner oder nutze im Zahnrad-Menü „Produktkatalog importieren“.</div>';
        if (count) count.textContent = "Katalog fehlt";
        return;
      }

      if (!results.length) {
        box.classList.remove("active");
        list.innerHTML = "";
        if (count) count.textContent = "0 Treffer";
        return;
      }

      box.classList.add("active");
      if (count) count.textContent = results.length + " Treffer";

      list.innerHTML = results.slice(0, 8).map(item => {
        const product = item.product;
        const price = catalogProductPrice(product);
        const trend = price ? (price.trend || price.avg || price.avg30 || price.low) : "";
        return `
          <button class="inline-suggestion-card with-image" type="button" data-inline-catalog-pick="${escapeHtml(product.idProduct)}">
            ${catalogProductImageHtml(product)}
            <div class="inline-suggestion-main">
              <div class="inline-suggestion-name">${escapeHtml(catalogProductDisplayName(product))}</div>
              <div class="inline-suggestion-meta">${escapeHtml(catalogProductMeta(product))}</div>
            </div>
            <span class="inline-suggestion-price">${trend !== "" ? formatMarketEuro(trend) : "kein Preis"}</span>
          </button>
        `;
      }).join("");

      list.querySelectorAll("[data-inline-catalog-pick]").forEach(button => {
        button.addEventListener("click", () => pickInlineCatalogProduct(button.dataset.inlineCatalogPick));
      });
      bindGalleryImageFallbacks(list);
    }

    function updateInlineCatalogSuggestions() {
      if (selectedCatalogProduct) return;

      const query = buildInlineCatalogQuery();
      if (query.length < 3) {
        renderInlineCatalogSuggestions([]);
        return;
      }

      renderInlineCatalogSuggestions(searchCatalogProducts(query, 8));
    }

    function pickInlineCatalogProduct(productId) {
      const product = cardmarketProducts.find(item => String(item.idProduct) === String(productId));
      if (!product) return;

      selectedCatalogProduct = product;
      const price = catalogProductPrice(product);
      const trend = price ? (price.trend || price.avg || price.avg30 || price.low) : "";

      if ($("cardName")) $("cardName").value = product.baseName || product.name || "";
      if ($("cardNumber")) $("cardNumber").value = product.number || "";
      if ($("cardmarketProductId")) $("cardmarketProductId").value = product.idProduct || "";
      if ($("cardValue") && trend !== "") $("cardValue").value = formatMarketEuro(trend);

      renderInlineCatalogSuggestions([]);
      renderInlineCatalogSelection(product);
      updateProfitPreview();
      showImportToast("Cardmarket-Karte übernommen", catalogProductDisplayName(product), "success");
    }

    function clearInlineCatalogSelection() {
      selectedCatalogProduct = null;
      if ($("cardmarketProductId")) $("cardmarketProductId").value = "";
      renderInlineCatalogSelection(null);
      updateInlineCatalogSuggestions();
    }

    function initializeAddPageCatalogSearch() {
      if (!document.getElementById("addPage")) return;
      if (window.__addPageCatalogSearchInitialized) return;
      window.__addPageCatalogSearchInitialized = true;

      const nameInput = $("cardName");
      const numberInput = $("cardNumber");

      if (nameInput) {
        nameInput.addEventListener("input", debounce(() => {
          selectedCatalogProduct = null;
          updateInlineCatalogSuggestions();
        }, 180));
      }

      if (numberInput) {
        numberInput.addEventListener("input", debounce(() => {
          selectedCatalogProduct = null;
          updateInlineCatalogSuggestions();
        }, 180));
      }

      if ($("cardmarketProductId")) onIfExists("cardmarketProductId", "input", () => {
        if (!valueOf("cardmarketProductId").trim()) {
          selectedCatalogProduct = null;
          renderInlineCatalogSelection(null);
        }
      });

      if ($("clearInlineCatalogSelectionBtn")) onIfExists("clearInlineCatalogSelectionBtn", "click", clearInlineCatalogSelection);
      if ($("clearCardmarketInfoBtn")) onIfExists("clearCardmarketInfoBtn", "click", clearInlineCatalogSelection);
      if ($("toggleManualExtraBtn")) onIfExists("toggleManualExtraBtn", "click", toggleManualExtraFields);

      // Falls der Katalog schon im Browser-Speicher liegt, direkt Vorschläge ermöglichen.
      updateInlineCatalogSuggestions();
    }

    function runCatalogSearch() {
      const query = $("catalogSearchInput") ? $("catalogSearchInput").value : "";
      renderCatalogSearchResults("catalogSearchResults", searchCatalogProducts(query), "full");
    }

    function runQuickCatalogSearch() {
      const query = $("quickCatalogSearchInput") ? $("quickCatalogSearchInput").value : "";
      renderCatalogSearchResults("quickCatalogResults", searchCatalogProducts(query, 8), "quick");
    }

    const CARDMARKET_PRICE_AUTO_CANDIDATES = [
      "./price_guide_18.json",
      "price_guide_18.json",
      "./price_guide_18(1).json",
      "price_guide_18(1).json",
      "./price_guide_18%281%29.json",
      "price_guide_18%281%29.json",
      "./price_guide_18(2).json",
      "price_guide_18(2).json",
      "./price_guide_18%282%29.json",
      "price_guide_18%282%29.json",
      "./price_guide_18_1.json",
      "price_guide_18_1.json",
      "./price_guide_18_2.json",
      "price_guide_18_2.json"
    ];

    const CARDMARKET_PRODUCTS_AUTO_CANDIDATES = [
      "./products_singles_18.json",
      "products_singles_18.json",
      "./products_singles_18(1).json",
      "products_singles_18(1).json",
      "./products_singles_18%281%29.json",
      "products_singles_18%281%29.json",
      "./products_singles_18(2).json",
      "products_singles_18(2).json",
      "./products_singles_18%282%29.json",
      "products_singles_18%282%29.json",
      "./products_singles_18_1.json",
      "products_singles_18_1.json",
      "./products_singles_18_2.json",
      "products_singles_18_2.json"
    ];

    async function fetchFirstAvailableTextFile(candidates) {
      let lastError = null;
      for (const fileName of candidates) {
        try {
          const text = await fetchTextFile(fileName);
          return { fileName, text };
        } catch (error) {
          lastError = error;
        }
      }
      throw lastError || new Error("Keine passende Datei gefunden.");
    }

    const CARDMARKET_PRICE_AUTO_FILE = "price_guide_18.json";
    const CARDMARKET_PRODUCTS_AUTO_FILE = "products_singles_18.json";

    function setAutoMarketStatus(message) {
      const box = $("autoMarketStatus");
      if (box) box.innerHTML = message;
    }

    function isLocalFileMode() {
      return window.location.protocol === "file:";
    }

    function setupAutoLoadAvailability() {
      const warning = $("autoLoadLocalWarning");
      const button = $("autoLoadCardmarketBtn");

      if (isLocalFileMode()) {
        if (warning) warning.style.display = "block";
        if (button) {
          button.querySelector("span").textContent = "Bei file:// blockiert der Browser den automatischen Zugriff auf lokale JSON-Dateien.";
        }
        setAutoMarketStatus("Auto-Load ist bei Doppelklick/file:// nicht möglich. Nutze manuellen Import oder starte die Seite über http://localhost.");
      } else {
        if (warning) warning.style.display = "none";
      }
    }

    async function fetchTextFile(fileName) {
      const sep = fileName.includes("?") ? "&" : "?";
      const url = fileName + sep + "v=" + encodeURIComponent(Date.now().toString());
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(fileName + " nicht gefunden oder nicht erreichbar (HTTP " + response.status + ").");
      }
      return response.text();
    }

    
    function maybeAutoLoadCardmarketData() {
      setMarketAutoloadPill("Cardmarket wird geladen", "loading");
      setupAutoLoadAvailability();

      if (isLocalFileMode()) return;

      // Beim Öffnen automatisch laden. Wenn Daten schon vorhanden sind, nicht unnötig neu laden.
      autoLoadCardmarketData(false, false);
    }

    
    function clearCardmarketStorage() {
      if (!confirm("Cardmarket Preis- und Produktkatalogdaten aus dem Browser-Speicher löschen? Deine Karten bleiben erhalten.")) return;
      localStorage.removeItem("cardVaultCardmarketPrices");
      localStorage.removeItem("cardVaultCardmarketProducts");
      localStorage.removeItem("cardVaultCardmarketPricesUpdated");
      localStorage.removeItem("cardVaultCardmarketProductsUpdated");
      cardmarketPrices = [];
      cardmarketProducts = [];
      renderCards();
      if (currentDetailCard) renderMarketPriceDetail(currentDetailCard);
      setAutoMarketStatus("Cardmarket-Speicher wurde geleert. Auto-Load erwartet <strong>price_guide_18.json</strong> und <strong>products_singles_18.json</strong> im gleichen Ordner.");
      showImportToast("Cardmarket Speicher geleert", "Preis- und Produktkatalogdaten wurden entfernt. Deine Karten wurden nicht gelöscht.", "success");
    }

    function openCardmarketImportPicker() {
      const input = $("cardmarketPriceFile");
      if (!input) {
        showImportToast("Preisimport nicht möglich", "Das Datei-Feld wurde nicht gefunden. Bitte diese neueste Datei verwenden.", "error");
        return;
      }
      input.click();
    }

    function importCardmarketCatalogFile(file) {
      if (isImportingCardmarketCatalog) return;
      isImportingCardmarketCatalog = true;

      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = parseCatalogFileContent(String(reader.result || ""));
          if (!parsed.length) {
            showImportToast("Keine Produktdaten erkannt", "Die Datei wurde gelesen, aber es wurden keine Produktkatalog-Datensätze gefunden.", "error");
            return;
          }

          cardmarketProducts = parsed.map(compactCardmarketProductRecord);
          saveCardmarketProducts();
          renderCards();
          if (currentDetailCard) renderMarketPriceDetail(currentDetailCard);
          if (typeof updateInlineCatalogSuggestions === "function") updateInlineCatalogSuggestions();

          const uniqueMetacards = new Set(parsed.map(row => row.idMetacard).filter(Boolean)).size;
          showImportToast("Produktkatalog importiert", parsed.length + " Produktdatensätze importiert. Metacards: " + uniqueMetacards + ".", "success");
        } catch (error) {
          console.error(error);
          showImportToast("Produktkatalog-Import fehlgeschlagen", error && error.message ? error.message : "Die Datei konnte nicht verarbeitet werden.", "error");
        } finally {
          isImportingCardmarketCatalog = false;
          const input = $("cardmarketCatalogFile");
          if (input) input.value = "";
        }
      };
      reader.onerror = () => {
        isImportingCardmarketCatalog = false;
        showImportToast("Produktkatalog-Import fehlgeschlagen", "Die Datei konnte nicht gelesen werden.", "error");
      };
      reader.readAsText(file);
    }

    function importCardmarketPriceFile(file) {
      if (isImportingCardmarketPrices) return;
      isImportingCardmarketPrices = true;

      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = parseMarketFileContent(String(reader.result || ""));
          if (!parsed.length) {
            showImportToast("Keine Preisdatensätze erkannt", "Die Datei wurde gelesen, aber es wurden keine Cardmarket-Preisdatensätze gefunden. Erwartet wird z. B. eine Datei mit priceGuides.", "error");
            return;
          }

          cardmarketPrices = parsed.map(compactCardmarketPriceRecord);
          saveCardmarketPrices();
      refreshCardmarketPricesForCollection({ silent: false });
          renderCards();
          if (currentDetailCard) renderMarketPriceDetail(currentDetailCard);

          const categories = new Set(parsed.map(row => row.idCategory).filter(Boolean)).size;
          showImportToast("Preisimport abgeschlossen", parsed.length + " Preisdatensätze importiert. Kategorien: " + categories + ".", "success");
        } catch (error) {
          console.error(error);
          showImportToast("Preisimport fehlgeschlagen", error && error.message ? error.message : "Die Datei konnte nicht verarbeitet werden.", "error");
        } finally {
          isImportingCardmarketPrices = false;
          const input = $("cardmarketPriceFile");
          if (input) input.value = "";
        }
      };
      reader.onerror = () => {
        isImportingCardmarketPrices = false;
        showImportToast("Preisimport fehlgeschlagen", "Die Datei konnte nicht gelesen werden.", "error");
      };
      reader.readAsText(file);
    }

    function exportData() {
      const blob = new Blob([JSON.stringify({ app: "Card Vault", version: "stable-v1", cards }, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "card-vault-export.json";
      a.click();
      URL.revokeObjectURL(url);
      markBackupExported();
    }

    function analyzeImport(imported) {
      const existingIds = new Set(cards.map(card => card.id));
      const duplicates = imported.filter(card => existingIds.has(card.id)).length;
      return {
        total: imported.length,
        duplicates,
        fresh: imported.length - duplicates
      };
    }

    function openImportChoice(imported) {
      pendingImportCards = imported;
      const stats = analyzeImport(imported);

      textIfExists("importCountStat", stats.total);
      textIfExists("importNewStat", stats.fresh);
      textIfExists("importDuplicateStat", stats.duplicates);

      (($("importChoiceText") || {}).textContent) = stats.duplicates
        ? "Der Import enthält IDs, die bereits in deiner Sammlung vorhanden sind."
        : "Alle importierten Karten haben neue IDs.";

      $("importChoiceBackdrop").classList.add("active");
    }

    function closeImportChoice() {
      pendingImportCards = [];
      $("importChoiceBackdrop").classList.remove("active");
      if ($("importFile")) $("importFile").value = "";
    }

    function finishImport(mode) {
      if (!pendingImportCards.length) {
        closeImportChoice();
        return;
      }

      if (mode === "replace") {
        if (!confirm("Aktuelle Sammlung wirklich vollständig ersetzen?")) return;
        cards = pendingImportCards;
      }

      if (mode === "only-new") {
        const existingIds = new Set(cards.map(card => card.id));
        const fresh = pendingImportCards.filter(card => !existingIds.has(card.id));
        cards = fresh.concat(cards);
      }

      if (mode === "merge") {
        const map = new Map(cards.map(card => [card.id, card]));
        pendingImportCards.forEach(card => {
          map.set(card.id, card);
        });
        cards = Array.from(map.values()).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      }

      saveCards();
      renderStats();
      renderCards();
      closeImportChoice();
      showPage("collectionPage");

      if (typeof showToast === "function") showToast("Import abgeschlossen");
    }

    function importData(file) {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result);
          const imported = Array.isArray(data) ? data : data.cards;
          if (!Array.isArray(imported)) throw new Error("Keine Kartenliste.");
          openImportChoice(imported);
        } catch {
          alert("Import fehlgeschlagen.");
        }
      };
      reader.readAsText(file);
    }

    function initializePendingEdit() {
      if (!isAddPageActiveFile()) return;

      const editId = getQueryParam("edit") || localStorage.getItem("cardVaultPendingEditId");
      if (!editId) return;

      localStorage.removeItem("cardVaultPendingEditId");
      const card = cards.find(item => item.id === editId);
      if (card) {
        editCard(editId, true);
      }
    }

    
    function selectedCardsList() {
      return cards.filter(card => selectedCardIds.has(card.id));
    }

    function updateSelectedCards(mutator) {
      if (!selectedCardIds.size) {
        showImportToast("Keine Auswahl", "Wähle erst eine oder mehrere Karten aus.", "error");
        return false;
      }

      cards = cards.map(card => {
        if (!selectedCardIds.has(card.id)) return card;
        return mutator({ ...card });
      });

      saveCards();
      renderStats();
      renderCards();
      updateBulkToolbar();
      return true;
    }

    function toggleBulkFavorite() {
      const selected = selectedCardsList();
      if (!selected.length) {
        showImportToast("Keine Auswahl", "Wähle erst eine oder mehrere Karten aus.", "error");
        return;
      }

      const allAreFavorite = selected.every(card => !!card.favorite);
      updateSelectedCards(card => {
        card.favorite = !allAreFavorite;
        return card;
      });

      showImportToast(
        allAreFavorite ? "Favorit entfernt" : "Favorit gesetzt",
        allAreFavorite ? "Favoriten wurden bei der Auswahl entfernt." : "Ausgewählte Karten wurden favorisiert.",
        "success"
      );
    }

    function toggleBulkStatus(targetStatus) {
      const selected = selectedCardsList();
      if (!selected.length) {
        showImportToast("Keine Auswahl", "Wähle erst eine oder mehrere Karten aus.", "error");
        return;
      }

      const allHaveStatus = selected.every(card => String(card.status || "") === targetStatus);
      updateSelectedCards(card => {
        card.status = allHaveStatus ? "" : targetStatus;
        return card;
      });

      showImportToast(
        allHaveStatus ? "Status entfernt" : "Status gesetzt",
        allHaveStatus ? "Der Status wurde bei der Auswahl entfernt." : "Status wurde für die Auswahl gesetzt: " + targetStatus,
        "success"
      );
    }

document.addEventListener("DOMContentLoaded", () => {
      // v202: Beim Öffnen der Website Preise aus der zuletzt importierten Cardmarket-Preisliste aktualisieren.
      setTimeout(() => refreshCardmarketPricesForCollection({ silent: true }), 0);

      const gradeInputIds = ["cardGrade", "quickGrade"];
      gradeInputIds.forEach(id => {
        const field = $(id);
        if (!field) return;
        field.setAttribute("min", "1");
        field.setAttribute("max", "10");
        field.setAttribute("step", "0.1");
        field.setAttribute("inputmode", "decimal");
        field.addEventListener("blur", () => {
          const normalized = normalizeGradeInputValue(field.value);
          if (normalized !== null) field.value = normalized;
        });
      });


      window.__cardVaultStorageTest = true;
      try {
        localStorage.setItem("cardVaultStorageTest", "1");
        localStorage.removeItem("cardVaultStorageTest");
      } catch (error) {
        console.warn("Browser storage limited", error);
        if (typeof setMarketAutoloadPill === "function") {
          setMarketAutoloadPill("Browser-Speicher eingeschränkt – Cardmarket nur temporär", "warning");
        }
      }
      initializePendingEdit();
      markCurrentNav();
      setupDelegatedCardActionMenus();
      updateBackupReminder();
      if ($("backupNowBtn")) onIfExists("backupNowBtn", "click", exportData);
      if ($("backupDismissBtn")) onIfExists("backupDismissBtn", "click", dismissBackupReminder);

      initTheme();
      if ($("openCollectionOptionsBtn")) onIfExists("openCollectionOptionsBtn", "click", event => {
        event.stopPropagation();
        toggleCollectionOptionsMenu();
      });
      if ($("collectionOptionsMenu")) onIfExists("collectionOptionsMenu", "click", event => event.stopPropagation());

      if ($("menuExportBackupBtn")) onIfExists("menuExportBackupBtn", "click", () => {
        closeCollectionOptionsMenu();
        exportData();
      });
      if ($("menuCsvExportBtn")) onIfExists("menuCsvExportBtn", "click", () => {
        closeCollectionOptionsMenu();
        if (typeof exportCsv === "function") exportCsv();
      });
      if ($("menuImportBackupBtn")) onIfExists("menuImportBackupBtn", "click", () => {
        closeCollectionOptionsMenu();
        const input = $("importFile");
        if (input) input.click();
      });

      if ($("menuOpenQuickAddBtn")) onIfExists("menuOpenQuickAddBtn", "click", () => {
        closeCollectionOptionsMenu();
        openQuickAdd();
      });
      if ($("menuOpenTrashBtn")) onIfExists("menuOpenTrashBtn", "click", () => {
        closeCollectionOptionsMenu();
        openTrash();
      });
      if ($("menuToggleSelectModeBtn")) onIfExists("menuToggleSelectModeBtn", "click", () => {
        closeCollectionOptionsMenu();
        toggleSelectMode();
      });
      if ($("closeSelectionModeBtn")) onIfExists("closeSelectionModeBtn", "click", () => {
        closeSelectionMode();
      });
      if ($("menuToggleFiltersBtn")) onIfExists("menuToggleFiltersBtn", "click", () => {
        closeCollectionOptionsMenu();
        if (typeof toggleFilters === "function") toggleFilters();
      });
      if ($("menuResetFiltersBtn")) onIfExists("menuResetFiltersBtn", "click", () => {
        closeCollectionOptionsMenu();
        if (typeof resetFilters === "function") resetFilters();
      });

      if ($("openOptionsMenuBtn")) onIfExists("openOptionsMenuBtn", "click", event => {
        event.stopPropagation();
        toggleOptionsMenu();
      });
      if ($("optionsMenu")) onIfExists("optionsMenu", "click", event => event.stopPropagation());
      document.addEventListener("click", () => {
        closeOptionsMenu();
        closeCollectionOptionsMenu();
        closeAllCardActionMenus();
      });
      if ($("optionsThemeBtn")) onIfExists("optionsThemeBtn", "click", () => {
        toggleTheme();
        closeOptionsMenu();
      });

      if ($("optionsOpenTrashBtn")) onIfExists("optionsOpenTrashBtn", "click", () => {
        closeOptionsMenu();
        openTrash();
      });
      if ($("themeToggleBtn")) onIfExists("themeToggleBtn", "click", toggleTheme);
      if ($("mobileBackupBtn")) onIfExists("mobileBackupBtn", "click", exportData);
      if ($("scrollTopBtn")) onIfExists("scrollTopBtn", "click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
      window.addEventListener("scroll", updateScrollTopButton, { passive: true });

      document.querySelectorAll("[data-page]").forEach(btn => btn.addEventListener("click", event => {
        const targetPage = btn.dataset.page;
        if (!document.getElementById(targetPage) && btn.tagName === "A" && btn.getAttribute("href")) {
          return;
        }
        event.preventDefault();
        showPage(targetPage);
      }));

      document.addEventListener("click", function(event) {
        const cardEditButton = event.target.closest("[data-card-edit]");
        if (cardEditButton) {
          event.preventDefault();
          event.stopPropagation();
          editCard(cardEditButton.dataset.cardEdit);
          return;
        }

        const damageEditButton = event.target.closest("[data-damage-edit-context]");
        if (damageEditButton) {
          event.preventDefault();
          event.stopPropagation();
          const context = damageEditButton.dataset.damageEditContext;
          const side = damageEditButton.dataset.damageEditSide;
          const index = Number(damageEditButton.dataset.damageEditIndex);
          openDamageEditor(context, side, index);
          return;
        }
      });


      if ($("frontFile")) onIfExists("frontFile", "change", handleFrontUpload);
      if ($("backFile")) onIfExists("backFile", "change", handleBackUpload);
      if ($("extraFiles")) onIfExists("extraFiles", "change", handleExtraUpload);

      if ($("rotateFrontLeftBtn")) onIfExists("rotateFrontLeftBtn", "click", () => rotateFront("left"));
      if ($("rotateFrontRightBtn")) onIfExists("rotateFrontRightBtn", "click", () => rotateFront("right"));
      if ($("rotateBackLeftBtn")) onIfExists("rotateBackLeftBtn", "click", () => rotateBack("left"));
      if ($("rotateBackRightBtn")) onIfExists("rotateBackRightBtn", "click", () => rotateBack("right"));
      if ($("removeFrontBtn")) onIfExists("removeFrontBtn", "click", removeFrontImage);
      if ($("removeBackBtn")) onIfExists("removeBackBtn", "click", removeBackImage);
      ["purchasePrice","salePrice","cardValue"].forEach(id => {
        const el = $(id);
        if (el) el.addEventListener("input", updateProfitPreview);
      });

      document.querySelectorAll("[data-grading-profile-disabled]").forEach(button => {
        button.addEventListener("click", () => {
          activeGradingProfile = button.dataset.gradingProfile;
          localStorage.setItem("cardVaultGradingProfile", activeGradingProfile);
          updateProfileGradePreview();
        });
      });

      if ($("addTimelineBtn")) onIfExists("addTimelineBtn", "click", addTimelineEntry);
      if ($("timelineText")) {
        if ($("timelineText")) onIfExists("timelineText", "keydown", event => {
          if (event.key === "Enter") {
            event.preventDefault();
            addTimelineEntry();
          }
        });
      }

      if ($("addTagBtn")) onIfExists("addTagBtn", "click", addFormTag);
      if ($("tagInput")) {
        if ($("tagInput")) onIfExists("tagInput", "keydown", event => {
          if (event.key === "Enter") {
            event.preventDefault();
            addFormTag();
          }
        });
      }

      initializeAddPageCatalogSearch();
      if ($("saveCardBtn")) onIfExists("saveCardBtn", "click", saveCard);
      if ($("floatingSaveCardBtn")) onIfExists("floatingSaveCardBtn", "click", saveCard);
      if ($("floatingCancelEditBtn")) onIfExists("floatingCancelEditBtn", "click", resetForm);
      syncFloatingSaveBar();
      if ($("cancelEditBtn")) onIfExists("cancelEditBtn", "click", resetForm);

      if ($("markFrontBtn")) onIfExists("markFrontBtn", "click", () => {
        currentMarkerSide = "front";
        fineCropReady = false;
        fineCenter = { x: 50, y: 50 };
        renderMarkerEditor();
      });
      if ($("markBackBtn")) onIfExists("markBackBtn", "click", () => {
        currentMarkerSide = "back";
        fineCropReady = false;
        fineCenter = { x: 50, y: 50 };
        renderMarkerEditor();
      });
      if ($("fineModeBtn")) onIfExists("fineModeBtn", "click", () => {
        fineMode = !fineMode;
        fineCropReady = false;
        fineCenter = { x: 50, y: 50 };
        renderMarkerEditor();
      });
      if ($("clearMarkersBtn")) onIfExists("clearMarkersBtn", "click", () => {
        if (currentMarkerSide === "front") markersFront = [];
        else markersBack = [];
        renderMarkerEditor();
      });

      if ($("markerCard")) onIfExists("markerCard", "mousemove", event => {
        // Feinmarkierung ist bewusst zweistufig:
        // 1. grob klicken, 2. im fixierten Ausschnitt exakt markieren.
      });

      document.addEventListener("mousemove", moveDragMarker);
      document.addEventListener("mouseup", endDragMarker);
      document.addEventListener("touchmove", function (event) {
        if (!draggingMarker || !event.touches || !event.touches.length) return;
        moveDragMarker(event.touches[0]);
      }, { passive: false });
      document.addEventListener("touchend", endDragMarker);

      if ($("markerCard")) onIfExists("markerCard", "click", event => {
        if (!currentMarkerImage()) {
          alert(currentMarkerSide === "front" ? "Bitte zuerst die Vorderseite hochladen." : "Bitte zuerst die Rückseite hochladen.");
          return;
        }
        const pos = markerPositionFromEvent(event, $("markerCard"));
        if (fineMode) {
          fineCropReady = true;
          updateFineStage(pos.x, pos.y);
          renderMarkerEditor();
        } else {
          addMarker(pos.x, pos.y);
        }
      });

      if ($("fineStage")) onIfExists("fineStage", "click", event => {
        if (!currentMarkerImage()) return;
        if (!fineCropReady || !fineCrop) {
          alert("Bitte zuerst im normalen Kartenbild grob auf die Schadensstelle klicken.");
          return;
        }

        const rect = $("fineStage").getBoundingClientRect();
        const localX = Math.min(rect.width, Math.max(0, event.clientX - rect.left));
        const localY = Math.min(rect.height, Math.max(0, event.clientY - rect.top));

        // Klick im Canvas-Ausschnitt zurück auf die Originalkarte 630x880 rechnen.
        const imageX = fineCrop.sx + (localX / rect.width) * fineCrop.cropW;
        const imageY = fineCrop.sy + (localY / rect.height) * fineCrop.cropH;

        const x = Math.min(100, Math.max(0, (imageX / 630) * 100));
        const y = Math.min(100, Math.max(0, (imageY / 880) * 100));

        addMarker(x, y);
        fineCropReady = false;
        fineCrop = null;
        renderMarkerEditor();
      });

      document.querySelectorAll("[data-quick-filter]").forEach(button => {
        button.addEventListener("click", event => {
          event.preventDefault();
          try {
            activeQuickFilter = normalizeQuickFilter(button.dataset.quickFilter || "all");
            if (activeQuickFilter === "all") {
              setValueIfExists("favoriteFilter", "");
              activeTagFilter = "";
            }
            updateQuickFilterButtonsSafe();
            renderCards();
          } catch (error) {
            console.error("Quick filter failed", error);
            const box = $("appErrorBox");
            if (box) {
              box.style.display = "block";
              box.textContent = "Fehler beim Filterwechsel: " + (error && error.message ? error.message : error);
            }
          }
        });
      });

      ["searchInput","statusFilter","conditionFilter","sortSelect","favoriteFilter"].forEach(id => {
        const el = $(id);
        if (el) el.addEventListener("input", () => {
          renderCards();
          applyViewPreferences();
        });
      });
      ["statusFilter","conditionFilter","sortSelect","favoriteFilter"].forEach(id => {
        const el = $(id);
        if (el) el.addEventListener("change", renderCards);
      });
if ($("exportBtn")) onIfExists("exportBtn", "click", exportData);
      if ($("csvExportBtn")) onIfExists("csvExportBtn", "click", exportCsv);
      if ($("importBtn")) onIfExists("importBtn", "click", () => { const input = $("importFile"); if (input) input.click(); });
      if ($("importFile")) onIfExists("importFile", "change", () => {
        const file = $("importFile").files[0];
        if (file) importData(file);
      });

      if ($("checkBtn")) onIfExists("checkBtn", "click", () => {
        const id = $("checkInput").value.trim();
        const card = cards.find(c => c.id === id);
        const result = $("checkResult");
        if (!id) {
          result.className = "tool-message error";
          result.textContent = "Bitte eine Sammlungs-ID eingeben.";
          return;
        }
        if (!card) {
          result.className = "tool-message error";
          result.textContent = "Diese Sammlungs-ID wurde nicht gefunden.";
          return;
        }
        result.className = "tool-message success";
        result.innerHTML = "Karte gefunden: <strong>" + escapeHtml(card.name) + "</strong> · Note " + escapeHtml(card.grade || "-");
        openDetail(card.id);
      });

      $("detailEditBtn").onclick = function(event) {
        event.preventDefault();
        event.stopPropagation();
        if (currentDetailCard) editCard(currentDetailCard.id);
        return false;
      };
      if ($("prevDetailBtn")) onIfExists("prevDetailBtn", "click", () => openAdjacentDetail(-1));
      if ($("nextDetailBtn")) onIfExists("nextDetailBtn", "click", () => openAdjacentDetail(1));
      if ($("closeDetailBtn")) onIfExists("closeDetailBtn", "click", closeDetail);
      if ($("detailBackdrop")) onIfExists("detailBackdrop", "click", event => { if (event.target === $("detailBackdrop")) closeDetail(); });

      if ($("damageFrontBtn")) onIfExists("damageFrontBtn", "click", () => { currentDamageSide = "front"; renderDamageMap(); });
      if ($("damageBackBtn")) onIfExists("damageBackBtn", "click", () => { currentDamageSide = "back"; renderDamageMap(); });

      if ($("closeDamageEditBtn")) onIfExists("closeDamageEditBtn", "click", closeDamageEditor);
      if ($("cancelDamageEditBtn")) onIfExists("cancelDamageEditBtn", "click", closeDamageEditor);
      if ($("saveDamageEditBtn")) onIfExists("saveDamageEditBtn", "click", saveDamageEditor);
      if ($("deleteDamageEditBtn")) onIfExists("deleteDamageEditBtn", "click", deleteDamageEditor);
      if ($("damageEditCloseupFile")) onIfExists("damageEditCloseupFile", "change", async () => {
        const file = $("damageEditCloseupFile").files[0];
        if (!file) return;
        damageEditCloseupData = await readFile(file);
        setCloseupPreview($("damageEditCloseupPreview"), damageEditCloseupData);
      });
      if ($("damageEditBackdrop")) onIfExists("damageEditBackdrop", "click", event => { if (event.target === $("damageEditBackdrop")) closeDamageEditor(); });

      if ($("closeZoomBtn")) onIfExists("closeZoomBtn", "click", () => $("zoomBackdrop").style.display = "none");
      if ($("zoomBackdrop")) onIfExists("zoomBackdrop", "click", event => { if (event.target === $("zoomBackdrop")) $("zoomBackdrop").style.display = "none"; });
      document.querySelectorAll(".zoom-button").forEach(btn => btn.addEventListener("click", () => {
        currentZoom.level = Number(btn.dataset.zoom);
        updateZoom();
      }));

      restoreViewPreferences();
      refreshPreviews();
      renderMarkerEditor();
      renderStats();
      renderCards();
    });
  