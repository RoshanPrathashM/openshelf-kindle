/* OpenShelf SPA — legal discovery, curated reader, local-first offline library. */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const ROOT = "./";
  const KEYS = {
    settings: "openshelf.spa.settings.v1",
    saved: "openshelf.spa.saved.v1",
    progress: "openshelf.spa.progress.v1",
    bookmarks: "openshelf.spa.bookmarks.v1",
    notes: "openshelf.spa.notes.v1",
    externalProgress: "openshelf.spa.external-progress.v1",
    imports: "openshelf.spa.imports.v1"
  };
  const DB_NAME = "OpenShelfOfflineDB";
  const DB_VERSION = 1;
  const STORE_NAME = "books";
  const READING_SPEED_WPM = 220;
  const SEARCH_DEBOUNCE_MS = 400;
  const API_TIMEOUT_MS = 12000;
  const themes = ["paperwhite", "sepia", "sage", "night"];
  const themeLabels = {
    paperwhite: "Paperwhite",
    sepia: "Sepia",
    sage: "Kindle Sage",
    night: "Night E-Ink"
  };
  const readerFiles = {
    "the-time-machine": ["content/the-time-machine.json"],
    "the-call-of-the-wild": ["content/the-call-of-the-wild.json"],
    "the-jungle-book": ["content/the-jungle-book.json"],
    "hamlet": ["content/hamlet.json"],
    "adventures-of-sherlock-holmes": ["content/adventures-of-sherlock-holmes.json"],
    "frankenstein": ["content/frankenstein-part-01.json", "content/frankenstein-part-02.json"],
    "picture-of-dorian-gray": ["content/the-picture-of-dorian-gray-part-01.json", "content/the-picture-of-dorian-gray-part-02.json"],
    "dracula": ["content/dracula-part-01.json", "content/dracula-part-02.json"],
    "alice-adventures-in-wonderland": ["content/alice-adventures-in-wonderland.json"],
    "the-secret-garden": ["content/the-secret-garden-part-01.json", "content/the-secret-garden-part-02.json"]
  };
  const localGenres = {
    "the-time-machine": ["classics", "scifi"],
    "the-call-of-the-wild": ["classics", "adventure"],
    "the-jungle-book": ["classics", "adventure"],
    "hamlet": ["classics", "philosophy"],
    "adventures-of-sherlock-holmes": ["classics", "mystery"],
    "frankenstein": ["classics", "horror", "scifi"],
    "picture-of-dorian-gray": ["classics", "horror", "philosophy"],
    "dracula": ["classics", "horror"],
    "alice-adventures-in-wonderland": ["classics", "adventure"],
    "the-secret-garden": ["classics", "adventure"]
  };
  const genreLabels = {
    classics: "Classics", scifi: "Science fiction", mystery: "Mystery",
    horror: "Horror & gothic", adventure: "Adventure", philosophy: "Philosophy"
  };

  let localBooks = [];
  let remoteBooks = [];
  let importedBooks = [];
  let offlineRecords = [];
  let currentFilter = "all";
  let currentGenre = "all";
  let currentView = "library";
  let currentBook = null;
  let currentChapters = [];
  let currentChapterIndex = 0;
  let currentMode = "paginated";
  let lastProgressWrite = 0;
  let searchTimer = null;
  let searchToken = 0;
  let searchController = null;
  let openTextbooksCachePromise = null;
  let lastReaderSelection = null;
  let dbPromise = null;
  let drawerMode = "appearance";
  let touchStart = null;
  let scrollSaveTimer = null;
  let pendingExternal = null;
  let lastExternalOpened = null;
  let toastTimer = null;
  let readerReturnFocus = null;

  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) {
      return fallback;
    }
  }
  function writeJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (_) {
      toast("Browser storage is full or unavailable. Export your notes or remove offline books.");
      return false;
    }
  }
  function escapeHTML(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (character) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character];
    });
  }
  function normalizeText(value) {
    return String(value || "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\u0B80-\u0BFF]+/g, " ").trim();
  }
  function safeHTTPURL(value) {
    try {
      const url = new URL(String(value || ""), location.href);
      return url.protocol === "http:" || url.protocol === "https:" ? url.href : "";
    } catch (_) {
      return "";
    }
  }
  function bytesLabel(bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(bytes < 10240 ? 1 : 0) + " KB";
    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
  }
  function getSavedBooks() {
    const value = readJSON(KEYS.saved, []);
    return Array.isArray(value) ? value : [];
  }
  function isSaved(id) {
    return getSavedBooks().some((item) => item.id === id);
  }
  function getProgressMap() {
    const value = readJSON(KEYS.progress, {});
    return value && typeof value === "object" ? value : {};
  }
  function getExternalProgressMap() {
    const value = readJSON(KEYS.externalProgress, {});
    return value && typeof value === "object" ? value : {};
  }
  function getCurrentSettings() {
    return Object.assign({ theme: "paperwhite", font: "serif", fontSize: 21, lineSpacing: 1.8, margin: 1, mode: "paginated" }, readJSON(KEYS.settings, {}));
  }
  function toast(message) {
    const node = $("toast");
    node.textContent = message;
    node.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => node.classList.remove("show"), 2600);
  }

  /* IndexedDB is reserved for full book content. localStorage stores only small metadata. */
  function openDatabase() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      if (!("indexedDB" in window)) {
        reject(new Error("IndexedDB is not available in this browser."));
        return;
      }
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = function () {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
          store.createIndex("savedAt", "savedAt", { unique: false });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Could not open offline storage."));
      request.onblocked = () => reject(new Error("Offline storage is blocked by another open OpenShelf tab."));
    });
    return dbPromise;
  }
  async function idbRequest(mode, action) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, mode);
      const store = tx.objectStore(STORE_NAME);
      let request;
      try { request = action(store); }
      catch (error) { reject(error); return; }
      tx.oncomplete = () => { if (request && request.result !== undefined) resolve(request.result); };
      tx.onerror = () => reject(tx.error || new Error("Offline storage request failed."));
      tx.onabort = () => reject(tx.error || new Error("Offline storage transaction aborted."));
      if (request) {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error("Offline storage request failed."));
      }
    });
  }
  async function idbGet(id) {
    return idbRequest("readonly", (store) => store.get(id));
  }
  async function idbGetAll() {
    const result = await idbRequest("readonly", (store) => store.getAll());
    return Array.isArray(result) ? result : [];
  }
  async function idbPut(record) {
    return idbRequest("readwrite", (store) => store.put(record));
  }
  async function idbDelete(id) {
    return idbRequest("readwrite", (store) => store.delete(id));
  }
  function estimateJSONBytes(value) {
    try { return new Blob([JSON.stringify(value)]).size; }
    catch (_) { return JSON.stringify(value).length * 2; }
  }

  function localBookFromManifest(record) {
    const slug = record.slug;
    return {
      id: "local:" + slug,
      slug,
      title: record.title || "Untitled",
      author: record.author || "Author not listed",
      year: record.year || "",
      language: record.language || "en",
      coverUrl: safeHTTPURL(record.cover || ""),
      tier: "unlimited",
      tierLabel: "∞ UNLIMITED",
      sourceName: record.source_name || "OpenShelf curated edition",
      sourceUrl: safeHTTPURL(record.source_url || ""),
      licenseNote: record.rights || "Review the source edition's rights before reusing it.",
      genres: localGenres[slug] || ["classics"],
      contentFiles: readerFiles[slug] || [],
      readerAvailable: Boolean((readerFiles[slug] || []).length),
      local: true,
      searchableText: [record.title, record.author, record.category, record.language].join(" ")
    };
  }
  async function loadLocalCatalogue() {
    try {
      const response = await fetch(ROOT + "content/library-index.json", { cache: "no-cache" });
      if (!response.ok) throw new Error("Could not load local book index (" + response.status + ").");
      const manifest = await response.json();
      localBooks = (Array.isArray(manifest.books) ? manifest.books : []).map(localBookFromManifest);
      renderShelf();
      setStatus("Showing " + localBooks.length + " curated local reading editions.");
      renderContinueCard();
    } catch (error) {
      localBooks = [];
      renderShelf();
      setStatus("Local book index unavailable. " + error.message);
      $("empty-title").textContent = "Library could not load";
      $("empty-message").textContent = "Refresh while online. Imported books already saved on this device may still be available.";
      $("empty-state").classList.remove("hidden");
    }
  }
  function addImportedMetadata(item) {
    const all = readJSON(KEYS.imports, []);
    const next = Array.isArray(all) ? all.filter((entry) => entry.id !== item.id) : [];
    next.unshift(item);
    writeJSON(KEYS.imports, next.slice(0, 300));
    importedBooks = next.slice(0, 300).map((entry) => Object.assign({}, entry, {
      tier: "import", tierLabel: "YOUR IMPORT", local: true, readerAvailable: true,
      genres: Array.isArray(entry.genres) ? entry.genres : ["classics"]
    }));
  }
  function buildDisplayPool() {
    const unique = new Map();
    localBooks.forEach((book) => unique.set(book.id, book));
    importedBooks.forEach((book) => unique.set(book.id, book));
    remoteBooks.forEach((book) => {
      if (book.tier === "external" && !localBooks.some((local) => normalizeText(local.title) === normalizeText(book.title))) {
        unique.set(book.id, book);
      }
    });
    getSavedBooks().forEach((book) => {
      if (book.tier === "external" && !unique.has(book.id)) unique.set(book.id, book);
    });
    return Array.from(unique.values());
  }
  function inferGenres(title, subjects, year) {
    const hay = normalizeText([title, subjects].join(" "));
    const genres = [];
    if (Number(year) && Number(year) < 1940) genres.push("classics");
    if (/science fiction|sci fi|space opera|time travel|future|robot|mars|alien|speculative/.test(hay)) genres.push("scifi");
    if (/mystery|detective|crime|sherlock|police|whodunit/.test(hay)) genres.push("mystery");
    if (/horror|gothic|ghost|vampire|dracula|frankenstein|supernatural/.test(hay)) genres.push("horror");
    if (/adventure|journey|expedition|survival|voyage|travel|island/.test(hay)) genres.push("adventure");
    if (/philosophy|ethics|metaphysics|logic|socrates|plato|aristotle/.test(hay)) genres.push("philosophy");
    return genres.length ? Array.from(new Set(genres)) : ["classics"];
  }
  function coverMarkup(book) {
    if (book.coverUrl) {
      return '<img data-cover-image src="' + escapeHTML(book.coverUrl) + '" alt="" loading="lazy" referrerpolicy="no-referrer"><span class="cover-fallback hidden" aria-hidden="true">' + escapeHTML(book.title) + '</span>';
    }
    return '<span class="cover-fallback">' + escapeHTML(book.title) + '</span>';
  }
  function cardMarkup(book, offlineIds) {
    const saved = isSaved(book.id);
    const isUnlimited = book.tier === "unlimited";
    const isImport = book.tier === "import";
    const isOffline = offlineIds.has(book.id);
    const external = book.tier === "external";
    const externalLink = safeHTTPURL(book.url || book.sourceUrl || "");
    const badge = external ? "↗ EXTERNAL FREE" : isImport ? "YOUR IMPORT" : "∞ UNLIMITED";
    let openControl;
    if (external) {
      openControl = externalLink
        ? '<a class="book-cover-button" href="' + escapeHTML(externalLink) + '" target="_blank" rel="noopener noreferrer" data-external-id="' + escapeHTML(book.id) + '" aria-label="Open ' + escapeHTML(book.title) + ' at ' + escapeHTML(book.sourceName || "the source") + '">' + coverMarkup(book) + '<span class="tier-badge external">' + badge + '</span></a>'
        : '<button class="book-cover-button" type="button" disabled aria-label="Source link unavailable">' + coverMarkup(book) + '<span class="tier-badge external">' + badge + '</span></button>';
    } else {
      openControl = '<button class="book-cover-button" type="button" data-open-book="' + escapeHTML(book.id) + '" aria-label="Read ' + escapeHTML(book.title) + '">' + coverMarkup(book) + '<span class="tier-badge">' + badge + '</span></button>';
    }
    const genreText = (book.genres || []).map((genre) => genreLabels[genre] || genre).join(" · ");
    const externalProgress = external ? getExternalProgressMap()[book.id] : null;
    const externalLabel = external
      ? '<p class="book-open-label">Opens on ' + escapeHTML(book.sourceName || "source website") + ' ↗ · Internal Kindle features unavailable' + (externalProgress ? ' · ' + Math.round(externalProgress.percent || 0) + '% logged' : '') + '</p>'
      : '<p class="book-open-label">' + (isImport ? "Private file · stored on this device" : "Read in the OpenShelf Kindle Reader") + '</p>';
    const readButton = external
      ? (externalLink ? '<a class="button" href="' + escapeHTML(externalLink) + '" target="_blank" rel="noopener noreferrer" data-external-id="' + escapeHTML(book.id) + '">Open source ↗</a>' : '<button class="button" disabled>Source unavailable</button>')
      : '<button class="button primary" type="button" data-open-book="' + escapeHTML(book.id) + '">' + (isImport ? "Open import" : "Read here") + '</button>';
    const offlineButton = (isUnlimited || isImport)
      ? '<button class="button" type="button" data-offline-book="' + escapeHTML(book.id) + '">' + (isOffline ? "✓ Saved offline" : "⬇ Save offline") + '</button>'
      : "";
    return '<article class="book-card" data-book-id="' + escapeHTML(book.id) + '">' +
      openControl +
      '<button class="save-button" type="button" data-save-book="' + escapeHTML(book.id) + '" aria-pressed="' + (saved ? "true" : "false") + '" aria-label="' + (saved ? "Remove from My Library" : "Save to My Library") + '">' + (saved ? "♥" : "♡") + '</button>' +
      '<h3 class="book-title">' + escapeHTML(book.title) + '</h3>' +
      '<p class="book-author">' + escapeHTML(book.author || "Author not listed") + '</p>' +
      '<p class="book-detail-line">' + escapeHTML(genreText) + '</p>' + externalLabel +
      '<div class="book-actions">' + readButton + offlineButton + '</div>' +
      '</article>';
  }
  function setStatus(message) {
    $("result-status").textContent = message;
  }
  function showEmpty(title, message) {
    $("empty-title").textContent = title;
    $("empty-message").textContent = message;
    $("empty-state").classList.remove("hidden");
  }
  function hideEmpty() {
    $("empty-state").classList.add("hidden");
  }
  function setFilter(filter) {
    currentFilter = filter;
    currentView = "library";
    $("library-view").classList.remove("hidden");
    $("directory-view").classList.add("hidden");
    document.querySelectorAll("[data-filter]").forEach((button) => button.classList.toggle("active", button.dataset.filter === filter));
    document.querySelectorAll("[data-view]").forEach((button) => button.classList.toggle("active", false));
    document.querySelectorAll("[data-mobile-view]").forEach((button) => button.classList.toggle("active", button.dataset.mobileView === "home"));
    renderShelf();
  }
  function setGenre(genre) {
    currentGenre = genre;
    currentView = "library";
    $("library-view").classList.remove("hidden");
    $("directory-view").classList.add("hidden");
    document.querySelectorAll("[data-genre]").forEach((button) => button.classList.toggle("active", button.dataset.genre === genre));
    renderShelf();
  }
  async function renderShelf() {
    const pool = buildDisplayPool();
    const saved = getSavedBooks().map((item) => item.id);
    const offlineIds = new Set(offlineRecords.map((record) => record.id));
    let list = pool;
    if (currentFilter === "unlimited") list = list.filter((book) => book.tier === "unlimited");
    if (currentFilter === "external") list = list.filter((book) => book.tier === "external");
    if (currentFilter === "saved") list = list.filter((book) => saved.includes(book.id));
    if (currentFilter === "downloaded") list = list.filter((book) => offlineIds.has(book.id));
    if (currentGenre !== "all") list = list.filter((book) => (book.genres || []).includes(currentGenre));
    const query = normalizeText($("global-search").value);
    if (query) list = list.filter((book) => normalizeText([book.title, book.author, book.searchableText, (book.genres || []).join(" ")].join(" ")).includes(query));
    const grid = $("book-grid");
    grid.innerHTML = list.map((book) => cardMarkup(book, offlineIds)).join("");
    grid.querySelectorAll("img[data-cover-image]").forEach((img) => {
      img.addEventListener("error", function () {
        img.hidden = true;
        const fallback = img.nextElementSibling;
        if (fallback) fallback.classList.remove("hidden");
      }, { once: true });
    });
    if (list.length) {
      hideEmpty();
    } else if ($("global-search").value.trim().length > 1 && searchIsRunning()) {
      hideEmpty();
    } else {
      const titles = {
        saved: "Your library is waiting", downloaded: "No offline books yet",
        external: "No external matches", unlimited: "No curated books match"
      };
      const messages = {
        saved: "Tap ♡ on any book to save it here. Saved books stay on this device.",
        downloaded: "Choose “Save offline” on a curated edition or import a local book.",
        external: "Search for a title to find additional free books at legitimate sources.",
        unlimited: "Try another genre or search, or browse the legal source directory."
      };
      showEmpty(titles[currentFilter] || "No books match this filter", messages[currentFilter] || "Try another search or category.");
    }
    const filterName = { all: "All books", unlimited: "OpenShelf Unlimited", external: "External free books", saved: "My Library", downloaded: "Downloaded offline" }[currentFilter];
    $("shelf-heading").textContent = query ? "Search results" : currentGenre !== "all" ? genreLabels[currentGenre] : filterName;
    $("shelf-description").textContent = currentFilter === "external"
      ? "Opens at the original source; access and rights differ by title."
      : currentFilter === "unlimited"
        ? "Curated local reading editions with recorded provenance. Copyright status can vary by country."
        : currentFilter === "downloaded" ? "Full book text currently stored in this browser's IndexedDB." : "Curated editions plus live search from legitimate catalogues.";
    if (searchRunning && $("global-search").value.trim().length >= 2) {
      grid.insertAdjacentHTML("beforeend", Array.from({ length: 5 }, () => '<article class="skeleton-card"><div class="skeleton-cover"></div><div class="skeleton-line"></div><div class="skeleton-line short"></div></article>').join(""));
    }
    document.querySelectorAll("[data-genre]").forEach((button) => button.classList.toggle("active", button.dataset.genre === currentGenre));
    document.querySelectorAll("[data-filter]").forEach((button) => button.classList.toggle("active", button.dataset.filter === currentFilter));
  }
  let searchRunning = false;
  function searchIsRunning() { return searchRunning; }
  function showSkeletons() {
    $("book-grid").innerHTML = Array.from({ length: 8 }, () => '<article class="skeleton-card"><div class="skeleton-cover"></div><div class="skeleton-line"></div><div class="skeleton-line short"></div></article>').join("");
    hideEmpty();
  }
  function showDirectory(view) {
    currentView = view;
    $("library-view").classList.toggle("hidden", view !== "library");
    $("directory-view").classList.toggle("hidden", view === "library");
    $("directory-heading").textContent = view === "sources" ? "Legal sources & rights directory" : "Browse all categories";
    $("directory-categories").classList.toggle("hidden", view === "sources");
    document.querySelectorAll("[data-mobile-view]").forEach((button) => button.classList.toggle("active", button.dataset.mobileView === (view === "library" ? "home" : "sources")));
    if (view !== "library") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function timeoutFetch(url, options) {
    const requestOptions = Object.assign({}, options || {});
    const externalSignal = requestOptions.signal || null;
    const controller = new AbortController();
    let unlinkAbort = null;
    if (externalSignal) {
      if (externalSignal.aborted) controller.abort();
      else {
        const abortRequest = () => controller.abort();
        externalSignal.addEventListener("abort", abortRequest, { once: true });
        unlinkAbort = () => externalSignal.removeEventListener("abort", abortRequest);
      }
    }
    const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
    requestOptions.signal = controller.signal;
    return fetch(url, requestOptions).then((response) => {
      if (!response.ok) throw new Error("Source returned HTTP " + response.status);
      return response.json();
    }).finally(() => {
      clearTimeout(timer);
      if (unlinkAbort) unlinkAbort();
    });
  }
  function externalBook(data) {
    const safeURL = safeHTTPURL(data.url || data.sourceUrl || "");
    return Object.assign({
      id: "external:" + (data.sourceKey || normalizeText(data.title) + ":" + normalizeText(data.author)),
      tier: "external", tierLabel: "↗ EXTERNAL FREE", local: false,
      title: "Untitled", author: "Author not listed", coverUrl: "", sourceName: "External source",
      url: safeURL, genres: ["classics"]
    }, data, { url: safeURL, tier: "external", tierLabel: "↗ EXTERNAL FREE" });
  }
  async function searchGutendex(query, signal) {
    const data = await timeoutFetch("https://gutendex.com/books/?search=" + encodeURIComponent(query) + "&page=1", { signal });
    return (data.results || []).slice(0, 12).map((item) => {
      const formats = item.formats || {};
      const cover = formats["image/jpeg"] || "";
      return externalBook({
        id: "external:gutenberg:" + item.id, sourceKey: "gutenberg:" + item.id, title: item.title,
        author: (item.authors || []).map((person) => person.name).filter(Boolean).join(", ") || "Author not listed",
        coverUrl: cover, sourceName: "Project Gutenberg", url: "https://www.gutenberg.org/ebooks/" + item.id,
        genres: inferGenres(item.title, (item.subjects || []).join(" "), ""),
        searchableText: (item.subjects || []).join(" ") + " " + (item.bookshelves || []).join(" "),
        sourceNote: "Project Gutenberg entry. Territory-specific copyright rules may apply; this live record has not been approved for local redistribution."
      });
    });
  }
  async function searchOpenLibrary(query, signal) {
    const data = await timeoutFetch("https://openlibrary.org/search.json?q=" + encodeURIComponent(query) + "&limit=12", { signal });
    return (data.docs || []).slice(0, 12).map((item) => {
      const key = item.key || "";
      const cover = item.cover_i ? "https://covers.openlibrary.org/b/id/" + item.cover_i + "-M.jpg" : "";
      return externalBook({
        id: "external:openlibrary:" + key, sourceKey: "openlibrary:" + key, title: item.title || "Untitled",
        author: (item.author_name || []).slice(0, 3).join(", ") || "Author not listed",
        coverUrl: cover, sourceName: "Open Library", url: key.startsWith("/works/") ? "https://openlibrary.org" + key : "https://openlibrary.org/search?q=" + encodeURIComponent(item.title || query),
        genres: inferGenres(item.title, (item.subject || []).join(" "), item.first_publish_year),
        searchableText: (item.subject || []).slice(0, 8).join(" "),
        sourceNote: "Open Library discovery record. Edition access and permission to redistribute vary."
      });
    });
  }
  async function searchTamilWikisource(query, signal) {
    const data = await timeoutFetch("https://ta.wikisource.org/w/api.php?action=query&generator=search&gsrsearch=" + encodeURIComponent(query) + "&gsrnamespace=0&gsrlimit=8&prop=info&inprop=url&format=json&origin=*", { signal });
    return Object.values((data.query && data.query.pages) || {}).map((page) => externalBook({
      id: "external:tawikisource:" + page.pageid, sourceKey: "tawikisource:" + page.pageid,
      title: page.title, author: "Tamil Wikisource", coverUrl: "", sourceName: "Tamil Wikisource",
      url: page.fullurl || "https://ta.wikisource.org/wiki/" + encodeURIComponent(String(page.title).replace(/ /g, "_")),
      genres: ["classics"], searchableText: "Tamil Tamil literature",
      sourceNote: "Check the individual page's rights notice."
    }));
  }
  async function searchOpenTextbooks(query) {
    if (!openTextbooksCachePromise) {
      openTextbooksCachePromise = timeoutFetch("https://open.umn.edu/opentextbooks/textbooks.json")
        .then((data) => {
          const items = Array.isArray(data) ? data : data.textbooks || data.results || data.data || data.items || [];
          if (!Array.isArray(items)) throw new Error("Unexpected Open Textbook Library response.");
          return items;
        })
        .catch((error) => { openTextbooksCachePromise = null; throw error; });
    }
    const items = await openTextbooksCachePromise;
    const words = normalizeText(query).split(/\s+/).filter(Boolean);
    return items.map((item) => {
      const authorValue = item.authors || item.author || [];
      const authors = Array.isArray(authorValue) ? authorValue.map((a) => typeof a === "string" ? a : a.name || a.full_name || "").filter(Boolean).join(", ") : String(authorValue || "");
      const title = item.title || item.name || item.book_title || "Untitled textbook";
      const subjectsValue = item.subjects || item.subject || item.disciplines || [];
      const subjects = Array.isArray(subjectsValue) ? subjectsValue.join(" ") : String(subjectsValue || "");
      return externalBook({
        id: "external:opentextbooks:" + String(item.id || item.slug || title),
        sourceKey: "opentextbooks:" + String(item.id || item.slug || title),
        title, author: authors || "Author not listed",
        coverUrl: item.cover_url || item.cover_image || item.thumbnail_url || "",
        sourceName: "Open Textbook Library",
        url: safeHTTPURL(item.textbook_url || item.book_url || item.website || item.url || item.link || "") || "https://open.umn.edu/opentextbooks/",
        genres: inferGenres(title, subjects, ""),
        searchableText: subjects + " " + String(item.description || item.summary || ""),
        sourceNote: "Open textbook. Check the individual licence and attribution terms."
      });
    }).filter((book) => {
      const haystack = normalizeText([book.title, book.author, book.searchableText].join(" "));
      return words.every((word) => haystack.includes(word));
    }).slice(0, 8);
  }
  function doabMetadata(item, keyPart) {
    const metadata = item.metadata;
    if (!metadata) return "";
    if (Array.isArray(metadata)) {
      const found = [];
      metadata.forEach((entry) => {
        const key = String(entry.key || entry.name || entry.element || "").toLowerCase();
        if (!key.includes(keyPart.toLowerCase())) return;
        let value = entry.value || entry.values || entry.text || "";
        if (Array.isArray(value)) value = value.map((v) => typeof v === "string" ? v : v.value || "").join(", ");
        if (value) found.push(String(value));
      });
      return found.join("; ");
    }
    return String(metadata[keyPart] || "");
  }
  async function searchDOAB(query, signal) {
    const params = new URLSearchParams({ query, limit: "8", start: "0", expand: "metadata,bitstreams" });
    const data = await timeoutFetch("https://directory.doabooks.org/rest/search?" + params.toString(), { headers: { Accept: "application/json" }, signal });
    const parent = data.searchResults || data.search_results || data;
    let items = parent.results || parent.searchResult || parent.search_result || data.results || data.items || [];
    if (!Array.isArray(items) && Array.isArray(items.searchResult)) items = items.searchResult;
    if (!Array.isArray(items)) return [];
    return items.map((item) => {
      const title = doabMetadata(item, "dc.title") || item.title || item.name || "Open-access scholarly book";
      const handle = item.handle || item.identifier || item.id || "";
      const author = doabMetadata(item, "dc.contributor.author") || doabMetadata(item, "dc.creator");
      const url = item.link || item.url || (String(handle).startsWith("http") ? handle : handle ? "https://directory.doabooks.org/handle/" + handle : "https://www.doabooks.org/");
      const subjects = doabMetadata(item, "dc.subject");
      return externalBook({
        id: "external:doab:" + String(item.uuid || item.id || handle || title), sourceKey: "doab:" + String(item.uuid || item.id || handle || title),
        title, author: author || "Academic publisher / contributor", coverUrl: "",
        sourceName: "Directory of Open Access Books", url,
        genres: inferGenres(title, subjects, ""),
        searchableText: subjects + " " + doabMetadata(item, "dc.description.abstract"),
        sourceNote: "Open-access scholarly record. Verify the publisher's individual licence before reuse."
      });
    });
  }
  async function runLiveSearch(query, token) {
    if (searchController) searchController.abort();
    searchController = new AbortController();
    if (token !== searchToken) return;
    if (!query.trim() || normalizeText(query).length < 2) {
      remoteBooks = [];
      searchRunning = false;
      renderShelf();
      setStatus("Showing curated books. Enter at least two characters to search live sources.");
      return;
    }
    searchRunning = true;
    remoteBooks = [];
    renderShelf();
    setStatus("Searching live catalogues…");
    const signal = searchController.signal;
    const tasks = [
      searchGutendex(query, signal), searchOpenLibrary(query, signal), searchTamilWikisource(query, signal),
      searchOpenTextbooks(query), searchDOAB(query, signal)
    ];
    const settled = await Promise.allSettled(tasks);
    if (token !== searchToken) return;
    let succeeded = 0;
    let unavailable = 0;
    const combined = [];
    settled.forEach((result) => {
      if (result.status === "fulfilled") { succeeded += 1; combined.push(...result.value); }
      else unavailable += 1;
    });
    const seen = new Set();
    remoteBooks = combined.filter((book) => {
      const titleKey = normalizeText(book.title);
      const localMatch = localBooks.some((local) => normalizeText(local.title) === titleKey);
      const uniqueKey = titleKey + "|" + normalizeText(book.author);
      if (!titleKey || localMatch || seen.has(uniqueKey)) return false;
      seen.add(uniqueKey);
      return true;
    });
    searchRunning = false;
    renderShelf();
    if (!succeeded) {
      setStatus("External catalogues are unavailable right now. Your local shelf and offline books remain usable.");
    } else {
      setStatus(remoteBooks.length + " matching external source records · " + succeeded + "/5 catalogues responded" + (unavailable ? " · " + unavailable + " unavailable" : "") + ". Unverified records open at their source.");
    }
  }

  function currentBookLookup(id) {
    return buildDisplayPool().find((book) => book.id === id) ||
      getSavedBooks().find((book) => book.id === id) ||
      offlineRecords.find((book) => book.id === id) ||
      null;
  }
  function wordCountFromHTML(html) {
    const parser = new DOMParser();
    const text = parser.parseFromString(String(html || ""), "text/html").body.textContent || "";
    return text.trim().split(/\s+/).filter(Boolean).length;
  }
  function scrubNode(node, parent) {
    if (node.nodeType === Node.TEXT_NODE) {
      parent.appendChild(document.createTextNode(node.nodeValue || ""));
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const tag = node.tagName.toLowerCase();
    if (["script", "style", "iframe", "object", "embed", "form", "input", "button", "video", "audio", "svg", "math", "link", "meta"].includes(tag)) return;
    const allowed = new Set(["section", "div", "p", "h1", "h2", "h3", "h4", "h5", "blockquote", "hr", "br", "em", "strong", "i", "b", "span", "sub", "sup", "ol", "ul", "li", "table", "thead", "tbody", "tr", "th", "td", "pre", "code", "dl", "dt", "dd", "figure", "figcaption"]);
    if (tag === "a") {
      const link = document.createElement("a");
      const url = safeHTTPURL(node.getAttribute("href") || "");
      if (url) {
        link.href = url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
      }
      Array.from(node.childNodes).forEach((child) => scrubNode(child, link));
      parent.appendChild(link);
      return;
    }
    if (!allowed.has(tag)) {
      Array.from(node.childNodes).forEach((child) => scrubNode(child, parent));
      return;
    }
    const clean = document.createElement(tag);
    Array.from(node.childNodes).forEach((child) => scrubNode(child, clean));
    parent.appendChild(clean);
  }
  function sanitizeHTML(html) {
    const parsed = new DOMParser().parseFromString(String(html || ""), "text/html");
    const safe = document.createElement("div");
    Array.from(parsed.body.childNodes).forEach((node) => scrubNode(node, safe));
    return safe.innerHTML;
  }
  async function loadBookContent(book) {
    const cached = await idbGet(book.id).catch(() => null);
    if (cached && Array.isArray(cached.chapters) && cached.chapters.length) {
      return { chapters: cached.chapters, cached: true, record: cached };
    }
    if (book.tier === "import") {
      throw new Error("This imported file is not available in offline storage. Import it again from your device.");
    }
    const paths = book.contentFiles || readerFiles[book.slug] || [];
    if (!paths.length) throw new Error("This title has no verified in-app reading edition. Open its official source instead.");
    const parts = await Promise.all(paths.map(async (path) => {
      const response = await fetch(ROOT + path.replace(/^\.\//, ""), { cache: "default" });
      if (!response.ok) throw new Error("The local reading edition could not be loaded (" + response.status + ").");
      return response.json();
    }));
    const chapters = parts.flatMap((part) => Array.isArray(part.chapters) ? part.chapters : []);
    if (!chapters.length) throw new Error("This reading edition contains no chapters.");
    return { chapters, cached: false, record: null };
  }
  function getBookWords(chapters) {
    return chapters.reduce((total, chapter) => total + wordCountFromHTML(chapter.html || ""), 0);
  }
  function readerProgressRecord() {
    if (!currentBook) return null;
    const progress = getProgressMap()[currentBook.id] || {};
    return progress;
  }
  function readScrollRatio() {
    const reader = currentMode === "paginated" ? $("reader-content") : $("reader-main");
    if (currentMode === "paginated") {
      const max = Math.max(0, reader.scrollWidth - reader.clientWidth);
      return max > 0 ? Math.max(0, Math.min(1, reader.scrollLeft / max)) : 0;
    }
    const max = Math.max(0, reader.scrollHeight - reader.clientHeight);
    return max > 0 ? Math.max(0, Math.min(1, reader.scrollTop / max)) : 0;
  }
  function pageCount() {
    const reader = $("reader-content");
    if (currentMode !== "paginated") return 1;
    const gap = parseFloat(getComputedStyle(reader).columnGap) || 0;
    return Math.max(1, Math.ceil((reader.scrollWidth + gap) / Math.max(1, reader.clientWidth + gap)));
  }
  function pageIndex() {
    if (currentMode !== "paginated") return 0;
    const reader = $("reader-content");
    const gap = parseFloat(getComputedStyle(reader).columnGap) || 0;
    return Math.max(0, Math.round(reader.scrollLeft / Math.max(1, reader.clientWidth + gap)));
  }
  function estimatePercentage() {
    if (!currentChapters.length) return 0;
    let priorWords = 0;
    for (let i = 0; i < currentChapterIndex; i += 1) priorWords += wordCountFromHTML(currentChapters[i].html || "");
    const chapterWords = wordCountFromHTML(currentChapters[currentChapterIndex] && currentChapters[currentChapterIndex].html || "");
    const ratio = readScrollRatio();
    const total = Math.max(1, getBookWords(currentChapters));
    return Math.max(0, Math.min(100, Math.round((priorWords + chapterWords * ratio) / total * 100)));
  }
  function updateReaderProgressUI() {
    if (!currentBook || !currentChapters.length) return;
    const percent = estimatePercentage();
    const totalWords = getBookWords(currentChapters);
    const remainingMinutes = Math.max(0, Math.ceil(totalWords * (100 - percent) / 100 / READING_SPEED_WPM));
    $("reader-progress-label").textContent = percent + "% · " + (remainingMinutes ? remainingMinutes + " min left" : "Finished");
    $("reader-progress-fill").style.width = percent + "%";
    $("reader-progress-bar").setAttribute("aria-valuenow", String(percent));
    $("reader-chapter-label").textContent = (currentChapters[currentChapterIndex] && currentChapters[currentChapterIndex].title ? currentChapters[currentChapterIndex].title : "Chapter " + (currentChapterIndex + 1));
    $("reader-page-label").textContent = currentMode === "paginated"
      ? "Page " + (pageIndex() + 1) + " of " + pageCount()
      : "Chapter " + (currentChapterIndex + 1) + " of " + currentChapters.length;
    const scrollArea = $("reader-main");
    const atScrollStart = scrollArea.scrollTop <= 3;
    const atScrollEnd = scrollArea.scrollTop >= Math.max(0, scrollArea.scrollHeight - scrollArea.clientHeight - 3);
    const atStart = currentChapterIndex === 0 && (currentMode === "paginated" ? pageIndex() === 0 : atScrollStart);
    const atEnd = currentChapterIndex === currentChapters.length - 1 && (currentMode === "paginated" ? pageIndex() >= pageCount() - 1 : atScrollEnd);
    $("previous-page").disabled = atStart;
    $("next-page").disabled = atEnd;
  }
  function storeProgress() {
    if (!currentBook || !currentChapters.length) return;
    const percent = estimatePercentage();
    const progress = getProgressMap();
    progress[currentBook.id] = {
      id: currentBook.id,
      title: currentBook.title,
      author: currentBook.author,
      coverUrl: currentBook.coverUrl || "",
      tier: currentBook.tier,
      chapter: currentChapterIndex,
      scrollRatio: readScrollRatio(),
      page: pageIndex(),
      mode: currentMode,
      percent,
      words: getBookWords(currentChapters),
      updatedAt: Date.now()
    };
    writeJSON(KEYS.progress, progress);
    lastProgressWrite = Date.now();
    renderContinueCard();
    updateReaderProgressUI();
  }
  function scheduleProgressSave() {
    clearTimeout(scrollSaveTimer);
    scrollSaveTimer = setTimeout(storeProgress, 180);
  }
  function restorePosition(progress) {
    if (!progress) return;
    currentChapterIndex = Math.max(0, Math.min(Number(progress.chapter) || 0, currentChapters.length - 1));
    renderReaderChapter(false);
    requestAnimationFrame(() => {
      const reader = $("reader-content");
      if (currentMode === "paginated") {
        const gap = parseFloat(getComputedStyle(reader).columnGap) || 0;
        reader.scrollLeft = (Number(progress.page) || 0) * (reader.clientWidth + gap);
      } else {
        const area = $("reader-main");
        area.scrollTop = (Number(progress.scrollRatio) || 0) * Math.max(0, area.scrollHeight - area.clientHeight);
      }
      updateReaderProgressUI();
    });
  }
  function renderSavedAnnotations() {
    if (!currentBook) return;
    const notesMap = readJSON(KEYS.notes, {});
    const notes = Array.isArray(notesMap[currentBook.id]) ? notesMap[currentBook.id] : [];
    notes.filter((item) => item.kind === "highlight" || item.kind === "underline").filter((item) => item.chapter === currentChapterIndex).forEach((item) => {
      const text = String(item.text || "").trim();
      if (!text) return;
      const walker = document.createTreeWalker($("reader-content"), NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          if (!node.nodeValue || !node.nodeValue.includes(text)) return NodeFilter.FILTER_SKIP;
          if (node.parentElement && node.parentElement.closest(".os-highlight,.os-underline")) return NodeFilter.FILTER_SKIP;
          return NodeFilter.FILTER_ACCEPT;
        }
      });
      let node;
      while ((node = walker.nextNode())) {
        const index = node.nodeValue.indexOf(text);
        if (index < 0) continue;
        const range = document.createRange();
        range.setStart(node, index);
        range.setEnd(node, index + text.length);
        const wrapper = document.createElement(item.kind === "highlight" ? "mark" : "span");
        wrapper.className = item.kind === "highlight" ? "os-highlight" : "os-underline";
        try { range.surroundContents(wrapper); } catch (_) {}
        break;
      }
    });
  }
  function renderReaderChapter(animate, direction) {
    if (!currentChapters.length) return;
    currentChapterIndex = Math.max(0, Math.min(currentChapterIndex, currentChapters.length - 1));
    const chapter = currentChapters[currentChapterIndex];
    const reader = $("reader-content");
    reader.classList.remove("paginated", "anim-forward", "anim-back", "font-serif", "font-sans", "font-mono");
    if (currentMode === "paginated") reader.classList.add("paginated");
    const settings = getCurrentSettings();
    reader.classList.add("font-" + settings.font);
    reader.innerHTML = sanitizeHTML(chapter.html || "<p>This chapter is empty.</p>");
    if (animate) {
      void reader.offsetWidth;
      reader.classList.add(direction === "back" ? "anim-back" : "anim-forward");
    }
    renderSavedAnnotations();
    reader.scrollTop = 0;
    reader.scrollLeft = 0;
    $("reader-main").scrollTop = 0;
    updateReaderProgressUI();
    scheduleProgressSave();
  }
  async function openReader(book, focusReturn) {
    if (!book || book.tier === "external") return;
    readerReturnFocus = focusReturn || document.activeElement;
    currentBook = book;
    currentChapterIndex = 0;
    currentChapters = [];
    currentMode = getCurrentSettings().mode || "paginated";
    $("reader-view").classList.remove("hidden");
    document.body.style.overflow = "hidden";
    $("reader-title").textContent = book.title || "Reading";
    $("reader-author").textContent = (book.author || "Author not listed") + " · " + (book.tier === "import" ? "Private imported file" : "Curated edition; regional copyright status may vary");
    $("reader-content").innerHTML = '<div class="empty-state"><strong>Opening your book…</strong><span>Loading a local reading edition or offline copy.</span></div>';
    $("reader-offline-button").textContent = "Checking offline copy…";
    $("reader-offline-button").disabled = true;
    $("reader-offline-button").classList.remove("hidden");
    closeDrawer();
    applyReaderSettings();
    try {
      const loaded = await loadBookContent(book);
      if (!currentBook || currentBook.id !== book.id) return;
      currentChapters = loaded.chapters;
      const position = getProgressMap()[book.id];
      restorePosition(position);
      $("reader-offline-button").disabled = false;
      const offline = offlineRecords.some((item) => item.id === book.id);
      $("reader-offline-button").textContent = offline ? "✓ Saved Offline (Remove)" : "⬇ Save Offline";
      $("reader-offline-button").setAttribute("aria-pressed", String(offline));
      if (!offline && !loaded.cached) setStatus("Ready to read " + book.title + ". Save it offline to keep the full text on this device.");
      storeProgress();
    } catch (error) {
      $("reader-content").innerHTML = '<div class="empty-state"><strong>Could not load this edition</strong><span>' + escapeHTML(error.message) + '</span><p><button class="button" id="reader-retry" type="button">Try again</button> ' +
        (book.sourceUrl ? '<a class="button" href="' + escapeHTML(book.sourceUrl) + '" target="_blank" rel="noopener noreferrer">Open source ↗</a>' : "") +
        '</p><p>This reader only opens curated or user-imported content inside OpenShelf. Unverified live catalogue records open at their original source instead.</p></div>';
      const retry = $("reader-retry");
      if (retry) retry.addEventListener("click", () => openReader(book, readerReturnFocus));
      $("reader-offline-button").disabled = false;
      $("reader-offline-button").textContent = "⬇ Save Offline";
    }
  }
  function exitReader() {
    if (!currentBook) return;
    storeProgress();
    $("reader-view").classList.add("hidden");
    document.body.style.overflow = "";
    closeDrawer();
    currentBook = null;
    currentChapters = [];
    currentChapterIndex = 0;
    renderShelf();
    renderContinueCard();
    updateStorageIndicator();
    if (readerReturnFocus && typeof readerReturnFocus.focus === "function") readerReturnFocus.focus({ preventScroll: true });
  }
  function goToChapter(index, direction) {
    if (!currentChapters.length) return;
    currentChapterIndex = Math.max(0, Math.min(index, currentChapters.length - 1));
    renderReaderChapter(true, direction || "forward");
  }
  function turnPage(direction) {
    if (!currentChapters.length) return;
    const reader = $("reader-content");
    if (currentMode === "paginated") {
      const gap = parseFloat(getComputedStyle(reader).columnGap) || 0;
      const step = reader.clientWidth + gap;
      const max = Math.max(0, reader.scrollWidth - reader.clientWidth);
      if (direction > 0 && reader.scrollLeft < max - 3) {
        reader.classList.remove("anim-forward", "anim-back"); void reader.offsetWidth; reader.classList.add("anim-forward");
        reader.scrollTo({ left: Math.min(max, reader.scrollLeft + step), behavior: "smooth" });
        updateReaderProgressUI(); scheduleProgressSave(); return;
      }
      if (direction < 0 && reader.scrollLeft > 3) {
        reader.classList.remove("anim-forward", "anim-back"); void reader.offsetWidth; reader.classList.add("anim-back");
        reader.scrollTo({ left: Math.max(0, reader.scrollLeft - step), behavior: "smooth" });
        updateReaderProgressUI(); scheduleProgressSave(); return;
      }
    } else {
      const area = $("reader-main");
      const max = Math.max(0, area.scrollHeight - area.clientHeight);
      if (direction > 0 && area.scrollTop < max - 3) {
        area.scrollBy({ top: area.clientHeight * 0.88, behavior: "smooth" });
        updateReaderProgressUI(); scheduleProgressSave(); return;
      }
      if (direction < 0 && area.scrollTop > 3) {
        area.scrollBy({ top: -area.clientHeight * 0.88, behavior: "smooth" });
        updateReaderProgressUI(); scheduleProgressSave(); return;
      }
    }
    if (direction > 0 && currentChapterIndex < currentChapters.length - 1) {
      goToChapter(currentChapterIndex + 1, "forward");
    } else if (direction < 0 && currentChapterIndex > 0) {
      goToChapter(currentChapterIndex - 1, "back");
      if (currentMode === "paginated") requestAnimationFrame(() => { const el = $("reader-content"); el.scrollLeft = Math.max(0, el.scrollWidth - el.clientWidth); updateReaderProgressUI(); });
      else requestAnimationFrame(() => { const el = $("reader-main"); el.scrollTop = Math.max(0, el.scrollHeight - el.clientHeight); updateReaderProgressUI(); });
    } else {
      toast(direction > 0 ? "End of this book." : "Beginning of this book.");
    }
  }
  function applyReaderSettings() {
    const settings = getCurrentSettings();
    document.documentElement.dataset.theme = themes.includes(settings.theme) ? settings.theme : "paperwhite";
    const reader = $("reader-content");
    reader.style.fontSize = settings.fontSize + "px";
    reader.style.lineHeight = String(settings.lineSpacing);
    reader.style.maxWidth = settings.margin === 0 ? "100%" : settings.margin === 2 ? "600px" : "760px";
    reader.style.fontFamily = settings.font === "sans"
      ? 'Arial, Helvetica, sans-serif'
      : settings.font === "mono"
        ? '"Courier New", monospace'
        : 'Georgia, "Times New Roman", serif';
    currentMode = settings.mode === "scroll" ? "scroll" : "paginated";
    reader.classList.toggle("paginated", currentMode === "paginated");
    $("font-family").value = settings.font;
    $("font-size").value = settings.fontSize;
    $("font-size-value").textContent = settings.fontSize + " px";
    $("line-spacing").value = settings.lineSpacing;
    $("line-spacing-value").textContent = Number(settings.lineSpacing).toFixed(1);
    $("reader-margin").value = settings.margin;
    $("reader-margin-value").textContent = ["narrow", "wide", "extra-wide"][settings.margin] || "wide";
    $("mode-paginated").classList.toggle("active", currentMode === "paginated");
    $("mode-scroll").classList.toggle("active", currentMode === "scroll");
    $("theme-choices").querySelectorAll("[data-theme-choice]").forEach((button) => button.classList.toggle("active", button.dataset.themeChoice === settings.theme));
    $("reader-theme-button").textContent = settings.theme === "night" ? "☀" : "☾";
    $("header-theme-button").textContent = settings.theme === "night" ? "☀" : "☾";
  }
  function saveReaderSetting(name, value) {
    const settings = getCurrentSettings();
    settings[name] = value;
    writeJSON(KEYS.settings, settings);
    const oldRatio = readScrollRatio();
    applyReaderSettings();
    if (currentBook && currentChapters.length) {
      renderReaderChapter(false);
      requestAnimationFrame(() => {
        const reader = $("reader-content");
        if (currentMode === "paginated") {
          const gap = parseFloat(getComputedStyle(reader).columnGap) || 0;
          const page = Math.round(oldRatio * Math.max(0, pageCount() - 1));
          reader.scrollLeft = page * (reader.clientWidth + gap);
        } else {
          const area = $("reader-main");
          area.scrollTop = oldRatio * Math.max(0, area.scrollHeight - area.clientHeight);
        }
        updateReaderProgressUI();
      });
    }
  }
  function cycleTheme() {
    const settings = getCurrentSettings();
    const current = themes.indexOf(settings.theme);
    saveReaderSetting("theme", themes[(current + 1) % themes.length]);
    toast("Theme: " + themeLabels[getCurrentSettings().theme]);
  }
  function openDrawer(mode) {
    drawerMode = mode || "appearance";
    $("reader-overlay").classList.add("open");
    $("reader-drawer").classList.add("open");
    $("reader-drawer").setAttribute("aria-hidden", "false");
    $("appearance-panel").classList.toggle("hidden", drawerMode !== "appearance");
    $("notes-panel").classList.toggle("hidden", drawerMode !== "notes");
    $("drawer-heading").textContent = drawerMode === "notes" ? "Notes & bookmarks" : "Reading appearance";
    document.querySelectorAll("[data-drawer-tab]").forEach((button) => {
      const active = button.dataset.drawerTab === drawerMode;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", String(active));
    });
    if (drawerMode === "notes") renderNotesAndBookmarks();
  }
  function closeDrawer() {
    $("reader-overlay").classList.remove("open");
    $("reader-drawer").classList.remove("open");
    $("reader-drawer").setAttribute("aria-hidden", "true");
  }
  function getBookNotes() {
    if (!currentBook) return [];
    const map = readJSON(KEYS.notes, {});
    return Array.isArray(map[currentBook.id]) ? map[currentBook.id] : [];
  }
  function putBookNotes(notes) {
    if (!currentBook) return;
    const map = readJSON(KEYS.notes, {});
    map[currentBook.id] = notes;
    writeJSON(KEYS.notes, map);
    renderNotesAndBookmarks();
  }
  function getBookBookmarks() {
    if (!currentBook) return [];
    const map = readJSON(KEYS.bookmarks, {});
    return Array.isArray(map[currentBook.id]) ? map[currentBook.id] : [];
  }
  function putBookBookmarks(bookmarks) {
    if (!currentBook) return;
    const map = readJSON(KEYS.bookmarks, {});
    map[currentBook.id] = bookmarks;
    writeJSON(KEYS.bookmarks, map);
    renderNotesAndBookmarks();
  }
  function addBookmark(label) {
    if (!currentBook) return;
    const bookmarks = getBookBookmarks();
    const samePosition = bookmarks.find((bookmark) => bookmark.chapter === currentChapterIndex &&
      bookmark.mode === currentMode && (currentMode === "paginated" ? bookmark.page === pageIndex() :
      Math.abs((bookmark.scrollRatio || 0) - readScrollRatio()) < 0.03));
    if (samePosition) {
      putBookBookmarks(bookmarks.filter((bookmark) => bookmark.id !== samePosition.id));
      toast("Bookmark removed from this page.");
      return;
    }
    const position = {
      id: "bookmark:" + Date.now(),
      chapter: currentChapterIndex,
      page: pageIndex(),
      scrollRatio: readScrollRatio(),
      mode: currentMode,
      label: label || (currentChapters[currentChapterIndex] && currentChapters[currentChapterIndex].title) || "Page " + (pageIndex() + 1),
      percent: estimatePercentage(),
      createdAt: Date.now()
    };
    bookmarks.push(position);
    putBookBookmarks(bookmarks);
    toast("Bookmark saved on this device.");
  }
  function restoreBookmark(bookmark) {
    if (!currentBook) return;
    goToChapter(bookmark.chapter || 0, "forward");
    requestAnimationFrame(() => {
      const reader = $("reader-content");
      if (bookmark.mode === "paginated" && currentMode === "paginated") {
        const gap = parseFloat(getComputedStyle(reader).columnGap) || 0;
        reader.scrollLeft = (Number(bookmark.page) || 0) * (reader.clientWidth + gap);
      } else {
        reader.scrollTop = (Number(bookmark.scrollRatio) || 0) * Math.max(0, reader.scrollHeight - reader.clientHeight);
      }
      updateReaderProgressUI();
      storeProgress();
    });
    closeDrawer();
  }
  function renderNotesAndBookmarks() {
    if (!currentBook) return;
    const bookmarks = getBookBookmarks();
    $("bookmarks-list").innerHTML = bookmarks.length ? bookmarks.slice().reverse().map((bookmark) =>
      '<div class="note-item"><strong>🔖 ' + escapeHTML(bookmark.label) + ' · ' + Math.round(bookmark.percent || 0) + '%</strong><div>Chapter ' + ((bookmark.chapter || 0) + 1) + ' · saved ' + new Date(bookmark.createdAt).toLocaleString() + '</div><div class="note-item-actions"><button type="button" data-jump-bookmark="' + escapeHTML(bookmark.id) + '">Go to page</button><button type="button" data-delete-bookmark="' + escapeHTML(bookmark.id) + '">Delete</button></div></div>'
    ).join("") : '<p class="empty-state">No bookmarks yet. Use “Bookmark page” while reading.</p>';
    const notes = getBookNotes();
    $("notes-list").innerHTML = notes.length ? notes.slice().reverse().map((note) =>
      '<div class="note-item"><strong>' + escapeHTML(note.kind === "highlight" ? "Highlighted text" : note.kind === "underline" ? "Underlined text" : "Private note") + ' · Chapter ' + ((note.chapter || 0) + 1) + '</strong>' +
      (note.text ? '<blockquote>' + escapeHTML(note.text) + '</blockquote>' : '') +
      (note.body ? '<div>' + escapeHTML(note.body) + '</div>' : '') +
      '<div class="note-item-actions"><button type="button" data-delete-note="' + escapeHTML(note.id) + '">Delete</button></div></div>'
    ).join("") : '<p class="empty-state">No notes or highlights yet.</p>';
  }
  function savePrivateNote(body) {
    if (!currentBook) return;
    const noteText = String(body || "").trim();
    if (!noteText) { toast("Write a note first."); return; }
    const notes = getBookNotes();
    notes.push({ id: "note:" + Date.now() + ":" + Math.random().toString(36).slice(2, 7), kind: "note", text: "", body: noteText, chapter: currentChapterIndex, page: pageIndex(), createdAt: Date.now() });
    putBookNotes(notes);
    $("note-input").value = "";
    toast("Private note saved.");
  }
  function rememberReaderSelection() {
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount || selection.isCollapsed) return;
    const range = selection.getRangeAt(0);
    if (!$("reader-content").contains(range.commonAncestorContainer)) return;
    lastReaderSelection = { range: range.cloneRange(), text: String(selection).trim(), chapter: currentChapterIndex };
  }
  function wrapSelection(kind) {
    if (!currentBook) return;
    const selection = window.getSelection();
    let range = selection && selection.rangeCount && !selection.isCollapsed ? selection.getRangeAt(0) : null;
    let selectedText = range ? String(selection).trim() : "";
    if ((!range || !selectedText) && lastReaderSelection && lastReaderSelection.chapter === currentChapterIndex) {
      range = lastReaderSelection.range;
      selectedText = lastReaderSelection.text;
      try {
        const restored = window.getSelection();
        restored.removeAllRanges();
        restored.addRange(range);
      } catch (_) {}
    }
    if (!range || !selectedText) { toast("Select text in the book first."); return; }
    if (!$("reader-content").contains(range.commonAncestorContainer)) { toast("Select text inside the reader."); return; }
    const wrapper = document.createElement(kind === "highlight" ? "mark" : "span");
    wrapper.className = kind === "highlight" ? "os-highlight" : "os-underline";
    try {
      wrapper.appendChild(range.extractContents());
      range.insertNode(wrapper);
      selection.removeAllRanges();
    } catch (_) {
      toast("That selection spans complex formatting. Try a shorter selection.");
      return;
    }
    const notes = getBookNotes();
    notes.push({ id: kind + ":" + Date.now() + ":" + Math.random().toString(36).slice(2, 7), kind, text: selectedText.slice(0, 1200), body: "", chapter: currentChapterIndex, page: pageIndex(), createdAt: Date.now() });
    putBookNotes(notes);
    lastReaderSelection = null;
    toast(kind === "highlight" ? "Selection highlighted and saved." : "Underline saved.");
  }
  function exportNotes() {
    if (!currentBook) return;
    const payload = { title: currentBook.title, author: currentBook.author, exportedAt: new Date().toISOString(), notes: getBookNotes(), bookmarks: getBookBookmarks() };
    downloadBlob(JSON.stringify(payload, null, 2), slugify(currentBook.title) + "-notes-bookmarks.json", "application/json");
  }
  function downloadBlob(content, filename, type) {
    const blob = content instanceof Blob ? content : new Blob([content], { type: type || "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }
  function slugify(value) {
    return normalizeText(value).replace(/\s+/g, "-").slice(0, 90) || "openshelf-book";
  }

  async function loadContentForOffline(book) {
    const loaded = await loadBookContent(book);
    const record = {
      id: book.id,
      title: book.title,
      author: book.author,
      tier: book.tier,
      slug: book.slug || "",
      coverUrl: book.coverUrl || "",
      sourceName: book.sourceName || "OpenShelf",
      sourceUrl: book.sourceUrl || "",
      genres: book.genres || [],
      language: book.language || "en",
      chapters: loaded.chapters,
      savedAt: Date.now()
    };
    record.approxBytes = estimateJSONBytes(record);
    await idbPut(record);
    return record;
  }
  async function saveOffline(book) {
    if (!book || book.tier === "external") {
      toast("This source is not licensed as an OpenShelf-hosted edition. Save its link to My Library instead.");
      return;
    }
    try {
      toast("Preparing offline copy…");
      const record = await loadContentForOffline(book);
      await refreshOfflineRecords();
      updateStorageIndicator();
      renderShelf();
      if (currentBook && currentBook.id === book.id) {
        $("reader-offline-button").textContent = "✓ Saved Offline (Remove)";
        $("reader-offline-button").setAttribute("aria-pressed", "true");
      }
      toast("Saved “" + book.title + "” for offline reading.");
      return record;
    } catch (error) {
      toast("Could not save offline: " + error.message);
    }
  }
  async function removeOffline(book) {
    try {
      await idbDelete(book.id);
      if (book.tier === "import") {
        const remainingImports = readJSON(KEYS.imports, []).filter((item) => item.id !== book.id);
        writeJSON(KEYS.imports, remainingImports);
      }
      await refreshOfflineRecords();
      updateStorageIndicator();
      renderShelf();
      if (currentBook && currentBook.id === book.id) {
        $("reader-offline-button").textContent = "⬇ Save Offline";
        $("reader-offline-button").setAttribute("aria-pressed", "false");
      }
      toast("Removed the offline copy. Your progress, notes and bookmarks remain.");
    } catch (error) {
      toast("Could not remove offline copy: " + error.message);
    }
  }
  async function toggleOffline(book) {
    if (!book) return;
    const exists = offlineRecords.some((record) => record.id === book.id);
    if (exists) await removeOffline(book); else await saveOffline(book);
  }
  async function refreshOfflineRecords() {
    try {
      offlineRecords = await idbGetAll();
    } catch (_) {
      offlineRecords = [];
    }
    const imports = readJSON(KEYS.imports, []);
    importedBooks = (Array.isArray(imports) ? imports : []).map((record) => Object.assign({}, record, { tier: "import", tierLabel: "YOUR IMPORT", local: true, readerAvailable: true, genres: record.genres || ["classics"] }));
  }
  async function updateStorageIndicator() {
    const totalBytes = offlineRecords.reduce((sum, record) => sum + (record.approxBytes || estimateJSONBytes(record)), 0);
    $("storage-summary").textContent = offlineRecords.length + " offline book" + (offlineRecords.length === 1 ? "" : "s") + " · " + bytesLabel(totalBytes);
    let quotaText = "Stored in this browser with IndexedDB.";
    try {
      if (navigator.storage && navigator.storage.estimate) {
        const estimate = await navigator.storage.estimate();
        if (estimate.quota) {
          const ratio = Math.min(100, totalBytes / estimate.quota * 100);
          $("storage-meter").style.width = ratio + "%";
          quotaText = bytesLabel(estimate.usage || 0) + " browser storage used of " + bytesLabel(estimate.quota) + " estimated available quota.";
        }
      }
    } catch (_) {}
    $("storage-quota").textContent = quotaText;
  }

  function renderContinueCard() {
    const progress = getProgressMap();
    const rows = Object.values(progress).filter((item) => item && item.updatedAt && (localBooks.some((book) => book.id === item.id) || importedBooks.some((book) => book.id === item.id))).sort((a, b) => b.updatedAt - a.updatedAt);
    if (!rows.length) {
      $("continue-card").classList.add("hidden");
      return;
    }
    const row = rows[0];
    const book = currentBookLookup(row.id) || row;
    $("continue-card").classList.remove("hidden");
    $("continue-cover").src = safeHTTPURL(book.coverUrl || row.coverUrl || "") || "";
    $("continue-cover").alt = "Cover of " + (book.title || row.title || "your book");
    $("continue-title").textContent = book.title || row.title || "Continue reading";
    $("continue-description").textContent = (book.author || row.author || "Author not listed") + " · " + Math.round(row.percent || 0) + "% complete";
    $("continue-progress").style.width = Math.max(0, Math.min(100, row.percent || 0)) + "%";
    $("resume-button").onclick = function () {
      const target = currentBookLookup(row.id);
      if (target && target.tier !== "external") openReader(target, $("resume-button"));
      else toast("This book is not available as a local reading edition anymore.");
    };
  }
  function saveLibraryBook(book) {
    if (!book) return;
    const list = getSavedBooks();
    const exists = list.some((item) => item.id === book.id);
    if (exists) {
      writeJSON(KEYS.saved, list.filter((item) => item.id !== book.id));
      toast("Removed from My Library.");
    } else {
      const metadata = {
        id: book.id, title: book.title, author: book.author, tier: book.tier,
        coverUrl: book.coverUrl || "", url: book.url || "", sourceName: book.sourceName || "",
        sourceUrl: book.sourceUrl || "", genres: book.genres || [], slug: book.slug || "",
        contentFiles: book.contentFiles || [], year: book.year || "", language: book.language || "en",
        searchableText: book.searchableText || ""
      };
      writeJSON(KEYS.saved, list.concat(metadata).slice(-1000));
      toast("Saved to My Library on this device.");
    }
    renderShelf();
  }
  function markExternalOpen(book) {
    if (!book) return;
    pendingExternal = {
      id: book.id, title: book.title, author: book.author,
      url: book.url || "", sourceName: book.sourceName || "External source",
      openedAt: Date.now()
    };
    writeJSON("openshelf.spa.pending-external.v1", pendingExternal);
    lastExternalOpened = pendingExternal;
    $("external-return-title").textContent = "Back from “" + book.title + "”?";
    $("external-return-text").textContent = "This book opened on " + (book.sourceName || "its source website") + ". You can record your progress without importing or copying its text.";
    $("external-percent").value = String((getExternalProgressMap()[book.id] || {}).percent || 10);
    $("external-page-note").value = String((getExternalProgressMap()[book.id] || {}).note || "");
  }
  function showExternalReturn() {
    const pending = readJSON("openshelf.spa.pending-external.v1", null);
    if (!pending || Date.now() - pending.openedAt > 24 * 60 * 60 * 1000) return;
    pendingExternal = pending;
    $("external-return-title").textContent = "Back from “" + pending.title + "”?";
    $("external-return-text").textContent = "Log your progress or save the source to My Library. OpenShelf's internal reader tools are not available for this external edition.";
    $("external-percent").value = String((getExternalProgressMap()[pending.id] || {}).percent || 10);
    $("external-page-note").value = String((getExternalProgressMap()[pending.id] || {}).note || "");
    $("external-return-banner").classList.remove("hidden");
  }
  function saveExternalProgress() {
    if (!pendingExternal) return;
    let percent = Number($("external-percent").value);
    if (!Number.isFinite(percent)) percent = 0;
    percent = Math.max(0, Math.min(100, Math.round(percent)));
    const progress = getExternalProgressMap();
    progress[pendingExternal.id] = {
      id: pendingExternal.id, title: pendingExternal.title, author: pendingExternal.author,
      url: pendingExternal.url, sourceName: pendingExternal.sourceName,
      percent, note: String($("external-page-note").value || "").trim().slice(0, 300), updatedAt: Date.now()
    };
    writeJSON(KEYS.externalProgress, progress);
    $("external-return-banner").classList.add("hidden");
    toast("External reading progress saved.");
    if (localStorage.getItem("openshelf.spa.pending-external.v1")) localStorage.removeItem("openshelf.spa.pending-external.v1");
    pendingExternal = null;
    lastExternalOpened = null;
  }

  function localPlainTextToChapters(text, filename) {
    const source = String(text || "").replace(/\r\n?/g, "\n").replace(/\u0000/g, "").trim();
    if (!source) throw new Error("The selected file is empty.");
    const isMarkdown = /\.m(?:d|arkdown)$/i.test(filename || "");
    let sections = [];
    if (isMarkdown && /^#{1,3}\s+.+$/m.test(source)) {
      const split = source.split(/(?=^#{1,3}\s+.+$)/m).map((piece) => piece.trim()).filter(Boolean);
      sections = split.map((piece, index) => {
        const lines = piece.split("\n");
        const heading = lines[0].replace(/^#{1,3}\s+/, "").trim() || "Part " + (index + 1);
        return { title: heading, text: lines.slice(1).join("\n") };
      });
    } else {
      const paragraphs = source.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean);
      const batches = [];
      let current = [];
      let currentWords = 0;
      paragraphs.forEach((paragraph) => {
        const count = paragraph.split(/\s+/).length;
        if (currentWords > 1100 && current.length) {
          batches.push(current.join("\n\n"));
          current = []; currentWords = 0;
        }
        current.push(paragraph); currentWords += count;
      });
      if (current.length) batches.push(current.join("\n\n"));
      sections = (batches.length ? batches : [source]).map((value, index) => ({ title: batches.length > 1 ? "Part " + (index + 1) : filename || "Imported text", text: value }));
    }
    return sections.map((section, index) => {
      const paragraphs = section.text.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean);
      const html = (section.title ? "<h2>" + escapeHTML(section.title) + "</h2>" : "") +
        paragraphs.map((paragraph) => "<p>" + escapeHTML(paragraph).replace(/\n/g, "<br>") + "</p>").join("");
      return { title: section.title || "Part " + (index + 1), html };
    });
  }
  async function importLocalFile(file) {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast("Please import a text file smaller than 10 MB.");
      return;
    }
    const extension = (file.name.split(".").pop() || "").toLowerCase();
    if (!["txt", "md", "markdown", "html", "htm"].includes(extension)) {
      toast("Supported file types: .txt, .md, .markdown, .html and .htm.");
      return;
    }
    try {
      const raw = await file.text();
      let text = raw;
      if (["html", "htm"].includes(extension)) {
        const parsed = new DOMParser().parseFromString(raw, "text/html");
        parsed.querySelectorAll("script,style,iframe,object,embed,form,nav,footer,header").forEach((node) => node.remove());
        text = parsed.body ? parsed.body.innerText || parsed.body.textContent || "" : parsed.documentElement.textContent || "";
      }
      const chapters = localPlainTextToChapters(text, file.name);
      const id = "import:" + (window.crypto && crypto.randomUUID ? crypto.randomUUID() : Date.now() + "-" + Math.random().toString(36).slice(2));
      const title = file.name.replace(/\.(txt|md|markdown|html|htm)$/i, "").replace(/[_-]+/g, " ").trim() || "Imported book";
      const book = { id, title, author: "Personal import", tier: "import", tierLabel: "YOUR IMPORT", sourceName: "Your device", genres: ["classics"], chapters, savedAt: Date.now(), coverUrl: "", language: "en", local: true, approxBytes: 0 };
      book.approxBytes = estimateJSONBytes(book);
      await idbPut(book);
      const meta = { id, title, author: book.author, tier: "import", coverUrl: "", sourceName: "Your device", genres: ["classics"], savedAt: book.savedAt, readerAvailable: true };
      addImportedMetadata(meta);
      await refreshOfflineRecords();
      updateStorageIndicator();
      renderShelf();
      toast("Imported and saved “" + title + "” for offline reading.");
      $("import-file").value = "";
      openReader(Object.assign({}, book, { readerAvailable: true }), $("import-button"));
    } catch (error) {
      toast("Import failed: " + error.message);
    }
  }

  function wireEvents() {
    document.querySelectorAll("[data-filter]").forEach((button) => button.addEventListener("click", () => setFilter(button.dataset.filter)));
    document.querySelectorAll("[data-genre]").forEach((button) => button.addEventListener("click", () => setGenre(button.dataset.genre)));
    document.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => showDirectory(button.dataset.view)));
    document.querySelectorAll("[data-genre-jump]").forEach((button) => button.addEventListener("click", () => {
      showDirectory("categories");
      setFilter("all");
      setGenre(button.dataset.genreJump);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }));
    $("back-to-library").addEventListener("click", () => { showDirectory("library"); setFilter("all"); });
    $("global-search").addEventListener("input", () => {
      const query = $("global-search").value;
      searchToken += 1;
      clearTimeout(searchTimer);
      searchRunning = query.trim().length >= 2;
      renderShelf();
      searchTimer = setTimeout(() => runLiveSearch(query, searchToken), SEARCH_DEBOUNCE_MS);
    });
    $("global-search").addEventListener("keydown", (event) => {
      if (event.key === "Enter") { clearTimeout(searchTimer); runLiveSearch($("global-search").value, ++searchToken); }
      if (event.key === "Escape") { $("global-search").value = ""; remoteBooks = []; setFilter("all"); }
    });
    $("clear-search").addEventListener("click", () => {
      $("global-search").value = "";
      remoteBooks = [];
      searchRunning = false;
      searchToken += 1;
      if (searchController) searchController.abort();
      setFilter("all");
      setStatus("Search cleared.");
      $("global-search").focus();
    });
    $("book-grid").addEventListener("click", async (event) => {
      const saveButton = event.target.closest("[data-save-book]");
      if (saveButton) {
        event.preventDefault(); event.stopPropagation();
        saveLibraryBook(currentBookLookup(saveButton.dataset.saveBook));
        return;
      }
      const offlineButton = event.target.closest("[data-offline-book]");
      if (offlineButton) {
        event.preventDefault(); event.stopPropagation();
        const book = currentBookLookup(offlineButton.dataset.offlineBook);
        if (book) await toggleOffline(book);
        return;
      }
      const openButton = event.target.closest("[data-open-book]");
      if (openButton) {
        const book = currentBookLookup(openButton.dataset.openBook);
        if (book) await openReader(book, openButton);
      }
    });
    $("book-grid").addEventListener("click", (event) => {
      const anchor = event.target.closest("a[data-external-id]");
      if (!anchor) return;
      const book = currentBookLookup(anchor.dataset.externalId);
      markExternalOpen(book);
    });
    $("reader-offline-button").addEventListener("click", async () => {
      if (!currentBook) return;
      await toggleOffline(currentBook);
    });
    $("exit-reader").addEventListener("click", exitReader);
    $("reader-theme-button").addEventListener("click", cycleTheme);
    $("header-theme-button").addEventListener("click", cycleTheme);
    $("open-appearance").addEventListener("click", () => openDrawer("appearance"));
    $("open-notes").addEventListener("click", () => openDrawer("notes"));
    $("close-drawer").addEventListener("click", closeDrawer);
    $("reader-overlay").addEventListener("click", closeDrawer);
    document.querySelectorAll("[data-drawer-tab]").forEach((button) => button.addEventListener("click", () => openDrawer(button.dataset.drawerTab)));
    document.querySelectorAll("[data-theme-choice]").forEach((button) => button.addEventListener("click", () => saveReaderSetting("theme", button.dataset.themeChoice)));
    $("font-family").addEventListener("change", () => saveReaderSetting("font", $("font-family").value));
    $("font-size").addEventListener("input", () => saveReaderSetting("fontSize", Number($("font-size").value)));
    $("font-decrease").addEventListener("click", () => saveReaderSetting("fontSize", Math.max(16, getCurrentSettings().fontSize - 1)));
    $("font-increase").addEventListener("click", () => saveReaderSetting("fontSize", Math.min(34, getCurrentSettings().fontSize + 1)));
    $("line-spacing").addEventListener("input", () => saveReaderSetting("lineSpacing", Number($("line-spacing").value)));
    $("reader-margin").addEventListener("input", () => saveReaderSetting("margin", Number($("reader-margin").value)));
    $("mode-paginated").addEventListener("click", () => saveReaderSetting("mode", "paginated"));
    $("mode-scroll").addEventListener("click", () => saveReaderSetting("mode", "scroll"));
    $("previous-page").addEventListener("click", () => turnPage(-1));
    $("next-page").addEventListener("click", () => turnPage(1));
    $("reader-content").addEventListener("scroll", () => {
      updateReaderProgressUI();
      scheduleProgressSave();
    }, { passive: true });
    $("reader-main").addEventListener("scroll", () => {
      if (currentMode === "scroll") {
        updateReaderProgressUI();
        scheduleProgressSave();
      }
    }, { passive: true });
    $("reader-content").addEventListener("mouseup", rememberReaderSelection);
    $("reader-content").addEventListener("keyup", rememberReaderSelection);
    $("reader-content").addEventListener("touchstart", (event) => {
      rememberReaderSelection();
      if (currentMode !== "paginated" || !event.touches.length) return;
      touchStart = { x: event.touches[0].clientX, y: event.touches[0].clientY };
    }, { passive: true });
    $("reader-content").addEventListener("touchend", (event) => {
      rememberReaderSelection();
      if (currentMode !== "paginated" || !touchStart || !event.changedTouches.length) return;
      const dx = event.changedTouches[0].clientX - touchStart.x;
      const dy = event.changedTouches[0].clientY - touchStart.y;
      touchStart = null;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.2) turnPage(dx < 0 ? 1 : -1);
    }, { passive: true });
    $("bookmark-page").addEventListener("click", () => addBookmark());
    $("bookmark-current").addEventListener("click", () => addBookmark());
    $("note-form").addEventListener("submit", (event) => { event.preventDefault(); savePrivateNote($("note-input").value); });
    $("add-highlight").addEventListener("click", () => wrapSelection("highlight"));
    $("add-underline").addEventListener("click", () => wrapSelection("underline"));
    $("export-notes").addEventListener("click", exportNotes);
    $("notes-list").addEventListener("click", (event) => {
      const button = event.target.closest("[data-delete-note]");
      if (!button || !currentBook) return;
      const notes = getBookNotes().filter((note) => note.id !== button.dataset.deleteNote);
      putBookNotes(notes);
      if (currentChapters.length) renderReaderChapter(false);
      toast("Note or highlight removed.");
    });
    $("bookmarks-list").addEventListener("click", (event) => {
      const jump = event.target.closest("[data-jump-bookmark]");
      const remove = event.target.closest("[data-delete-bookmark]");
      if (!currentBook) return;
      if (jump) {
        const found = getBookBookmarks().find((bookmark) => bookmark.id === jump.dataset.jumpBookmark);
        if (found) restoreBookmark(found);
      } else if (remove) {
        putBookBookmarks(getBookBookmarks().filter((bookmark) => bookmark.id !== remove.dataset.deleteBookmark));
        toast("Bookmark removed.");
      }
    });
    $("import-button").addEventListener("click", () => $("import-file").click());
    $("import-file").addEventListener("change", () => importLocalFile($("import-file").files && $("import-file").files[0]));
    $("manage-downloads").addEventListener("click", () => setFilter("downloaded"));
    $("resume-button").addEventListener("click", () => {});
    $("save-external-progress").addEventListener("click", saveExternalProgress);
    $("bookmark-external").addEventListener("click", () => {
      if (!pendingExternal) return;
      saveLibraryBook({
        id: pendingExternal.id, title: pendingExternal.title, author: pendingExternal.author,
        tier: "external", url: pendingExternal.url, sourceName: pendingExternal.sourceName,
        genres: ["classics"], coverUrl: ""
      });
      $("external-return-banner").classList.add("hidden");
      if (localStorage.getItem("openshelf.spa.pending-external.v1")) localStorage.removeItem("openshelf.spa.pending-external.v1");
      pendingExternal = null;
      lastExternalOpened = null;
    });
    $("dismiss-external").addEventListener("click", () => {
      $("external-return-banner").classList.add("hidden");
      if (localStorage.getItem("openshelf.spa.pending-external.v1")) localStorage.removeItem("openshelf.spa.pending-external.v1");
      pendingExternal = null;
      lastExternalOpened = null;
    });
    document.querySelectorAll("[data-mobile-view]").forEach((button) => button.addEventListener("click", () => {
      const action = button.dataset.mobileView;
      if (action === "home") { showDirectory("library"); setFilter("all"); }
      if (action === "sources") showDirectory("sources");
      if (action === "search") { showDirectory("library"); $("global-search").focus(); window.scrollTo({ top: 0, behavior: "smooth" }); }
      if (action === "import") $("import-file").click();
    }));
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        if (lastExternalOpened) {
          const saved = Object.assign({}, lastExternalOpened, { openedAt: lastExternalOpened.openedAt || Date.now() });
          writeJSON("openshelf.spa.pending-external.v1", saved);
        }
      } else {
        showExternalReturn();
        refreshOfflineRecords().then(() => { renderShelf(); updateStorageIndicator(); });
      }
    });
    window.addEventListener("online", updateNetworkStatus);
    window.addEventListener("offline", updateNetworkStatus);
    window.addEventListener("focus", () => { showExternalReturn(); });
    window.addEventListener("pageshow", () => { showExternalReturn(); });
    window.addEventListener("resize", () => {
      if (currentBook && currentChapters.length && currentMode === "paginated") updateReaderProgressUI();
    });
    window.addEventListener("beforeunload", () => {
      if (currentBook && currentChapters.length) storeProgress();
    });
    document.addEventListener("keydown", (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if ($("reader-view").classList.contains("hidden")) $("global-search").focus();
        else openDrawer("appearance");
      }
      if (!$("reader-view").classList.contains("hidden")) {
        if (event.key === "Escape") {
          if ($("reader-drawer").classList.contains("open")) closeDrawer();
          else exitReader();
        } else if (event.key === "ArrowRight" && !/input|textarea|select/i.test(event.target.tagName)) {
          event.preventDefault(); turnPage(1);
        } else if (event.key === "ArrowLeft" && !/input|textarea|select/i.test(event.target.tagName)) {
          event.preventDefault(); turnPage(-1);
        }
      }
    });
  }

  function updateNetworkStatus() {
    const offline = !navigator.onLine;
    $("network-status").classList.toggle("is-offline", offline);
    $("network-label").textContent = offline ? "Offline" : "Online";
    $("network-status").title = offline ? "You are offline. Local and downloaded books remain available." : "You are online.";
    if (offline) setStatus("Offline: local and downloaded books remain available; live search is paused.");
    else if (!searchRunning) setStatus(localBooks.length + " curated editions available · type to search live catalogues.");
  }
  async function initialise() {
    updateNetworkStatus();
    const settings = getCurrentSettings();
    document.documentElement.dataset.theme = themes.includes(settings.theme) ? settings.theme : "paperwhite";
    $("header-theme-button").textContent = settings.theme === "night" ? "☀" : "☾";
    wireEvents();
    await refreshOfflineRecords();
    await loadLocalCatalogue();
    await updateStorageIndicator();
    renderShelf();
    renderContinueCard();
    showExternalReturn();
    if ("serviceWorker" in navigator && location.protocol !== "file:") {
      navigator.serviceWorker.register(ROOT + "sw.js").catch(() => {});
    }
  }

  initialise().catch((error) => {
    console.error("OpenShelf could not initialise:", error);
    setStatus("OpenShelf encountered a setup problem: " + error.message);
  });
})();
