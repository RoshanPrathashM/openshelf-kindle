# OpenShelf

**A free, Kindle-inspired web reading library for discovering open books, reading curated editions in-app, and keeping private notes.**

- **Live app:** https://roshanprathashm.github.io/openshelf-kindle/
- **Repository:** https://github.com/RoshanPrathashM/openshelf-kindle

OpenShelf is a static progressive web app built for phone, tablet and laptop browsers. It uses a single-page shell plus separate CSS and JavaScript files; no build step, account, paid API key or application server is required for the basic experience.

## Current architecture

### 1. Two-tier catalogue

**OpenShelf Unlimited** contains the curated local full-text editions with source and rights notes recorded in this repository. They open in the built-in reader and can be saved to browser storage for offline reading.

**External Free** contains live catalogue records that have not been verified for local redistribution. Those cards open their official/source page in a new tab and explicitly state that OpenShelf's internal reader tools are unavailable for that source edition. Users can save the source record to My Library and manually record a completion percentage plus a page/reading note when they return.

A free-to-read source is not automatically a licence to copy or redistribute. Project Gutenberg and other providers may have different territorial copyright status, edition licences or access conditions. The word “Unlimited” describes the curated in-app shelf, not a promise that every book in every country is rights-free.

### 2. Local reading shelf

The curated local catalogue currently has 10 English text editions:
- *The Time Machine* — H. G. Wells
- *The Call of the Wild* — Jack London
- *The Jungle Book* — Rudyard Kipling
- *Hamlet* — William Shakespeare
- *The Adventures of Sherlock Holmes* — Arthur Conan Doyle
- *Frankenstein* — Mary Shelley
- *The Picture of Dorian Gray* — Oscar Wilde
- *Dracula* — Bram Stoker
- *Alice’s Adventures in Wonderland* — Lewis Carroll
- *The Secret Garden* — Frances Hodgson Burnett

The local library manifest is at [content/library-index.json](content/library-index.json). Curated text data lives in [content/](content/), with the chapter-file map in <code>app.js</code>.

### 3. About 100 free-source catalogue titles

OpenShelf now features 10 additional source-linked classics: *Pride and Prejudice*, *Moby-Dick*, *The Adventures of Tom Sawyer*, *Treasure Island*, *Jane Eyre*, *The Wonderful Wizard of Oz*, *A Christmas Carol*, *The Strange Case of Dr. Jekyll and Mr. Hyde*, *The Scarlet Letter*, and *A Tale of Two Cities*. The **Browse 100 free books** button fetches popular English-language listings through Gutendex/Project Gutenberg and combines up to 80 more unique source links with the 10 local editions and 10 featured external titles.

These 20 featured source-linked titles and the larger popular list are **external**: they open at the source's official eBook page; OpenShelf does not host their full text and does not enable in-app notes or offline copies for them. The locally readable shelf remains the 10 curated full-text books plus files a person imports. Project Gutenberg says its public-domain determination is US-based and that copyright status can differ outside the US; therefore the app labels these as free at source, not as universally public-domain or licensed for redistribution. See [Project Gutenberg's permission guidance](https://www.gutenberg.org/policy/permission.html).


### 3. Full-text Kindle reader

For curated editions, Gutendex books with a listed <code>text/plain</code> format, and private local imports, the reader provides:
- An IndexedDB-first full-edition cache, then an optional repository file at <code>books/pg&lt;ID&gt;.txt</code>, then source plain text and a sequential CORS-proxy fallback chain.
- Project Gutenberg header/footer removal, chapter-heading detection, an interactive table of contents, and logical page chunks of approximately 260 words each.
- A page slider and a Go to Page number input, plus previous/next, Page Up/Page Down, arrow-key and Space/Shift+Space controls.
- A loading skeleton while the full text is retrieved and automatic local caching of the parsed reading edition. Once cached, a title can reopen without refetching while its browser storage remains available.
- Four reading themes, font-family/size, line-spacing and margin settings, progress percentage, estimated remaining time, bookmarks and private notes.
- Selection toolbar actions for yellow/green/pink highlighting, a note attached to selected text, a free Dictionary API lookup for one English word, and copying the selected quote.
- Personal import for <code>.txt</code>, <code>.md</code>, <code>.markdown</code>, <code>.html</code> and <code>.htm</code> files. Imported text stays in the user's own browser storage and is not published or shared.

The reader sanitizes bundled chapter markup before inserting it into the page. Full-text source access and public-domain status are not guaranteed in every jurisdiction; a listed text URL is not a redistribution licence. Project Gutenberg states that its public-domain assessment follows US law, so users outside the US need to check local copyright rules and the individual ebook's notice.

### 4. Unified live search

After two or more characters, search runs with a 400 ms debounce against:
- Project Gutenberg via Gutendex
- Open Library
- Tamil Wikisource
- Open Textbook Library
- Directory of Open Access Books (DOAB)

The app filters the local shelf immediately while showing loading skeletons for external results. “Browse 100 free books” loads a starter catalogue, and “Load More Free Books” advances through Gutendex pages and publicly readable Open Library records. Gutendex records with a listed plain-text format can open in the in-app full-text reader; other entries remain source links. Requests time out; stale searches are cancelled where supported; source failures are shown without hiding successful results. Provider APIs and CORS policies can change, so source discovery and proxy availability are best-effort.

### 5. Offline and device storage

- Small preferences, saved-book metadata, progress, bookmarks and annotations are stored in <code>localStorage</code>.
- Full saved book content and imported text are stored in the IndexedDB database **OpenShelfOfflineDB**.
- The Device Storage panel displays offline-book count and approximate content size, along with the browser's reported storage quota when available.
- The PWA manifest and service worker cache the home page, app script, stylesheet, icons, manifests, reader shell and local catalogue index. Full-text editions are cached in IndexedDB after a successful fetch; a title should be saved offline before relying on it without a network. The app can be installed from a compatible browser using Install app or Add to Home Screen. The manifest includes 192px and 512px raster icons plus an SVG fallback.

Browser storage is finite and can be cleared by users or browser policy. “Unlimited” does not mean unlimited device disk space. Data is local to the current browser/profile and does not automatically sync to another device.

## Deploy and run locally

GitHub Pages deploys the static files directly from the repository. To run locally, use a local web server instead of opening the HTML as a <code>file://</code> URL:

<pre><code>python3 -m http.server 8000</code></pre>

Then open <code>http://localhost:8000/</code>.

## Important product limitations

- OpenShelf is a book discovery and reading app, not a subscription database containing every book on the internet.
- Live catalogue search does not mean that every result can be hosted, downloaded or redistributed. The app only uses the built-in reader for curated local editions or files the user personally imports.
- This GitHub Pages version has **no server-side public uploads, user accounts, cloud notes, cross-device sync, payment system or public contribution moderation**. A book a user imports is private to that device/browser; it is not sent to the repository or other users.
- An external title's access, licence, reader UI and availability remain controlled by its source.
- Offline storage depends on IndexedDB and the browser's site-storage quota. Back up exported notes if they matter to you.
- Syntax and manifest/catalogue validation run through GitHub Actions; real-device interaction, browser-specific CORS and offline behavior should still be tested on target phones/tablets.

## Main files

- <code>index.html</code> — app shell, library filters, directory and fullscreen reader markup.
- <code>styles.css</code> — responsive app and reader styling.
- <code>app.js</code> — catalogue search, IndexedDB, reading position, themes, bookmarks, notes, annotations and imports.
- <code>sw.js</code> — service worker and static-shell cache.
- <code>manifest.json</code> and <code>manifest.webmanifest</code> — install metadata.
- <code>app-icon-192.png</code> and <code>app-icon-512.png</code> — raster install icons for Chromium-based browsers; <code>app-icon.svg</code> remains the scalable fallback.
- <code>content/library-index.json</code> — curated local shelf and source notes.
- <code>content/featured-free.json</code> — 10 featured Project Gutenberg source links; popular catalogue results are cached locally as metadata only.
- <code>catalog-registry.json</code> — sources and content-ingestion policy.
- <code>read/index.html</code> — the earlier standalone reader page retained for compatibility.

## Contribution guidance

Suggest books by submitting the official source URL, title, author, language, exact licence/rights evidence, and jurisdiction reviewed. Do not add book files to the local hosted shelf unless redistribution permission is documented. Where terms are uncertain, link to the authorised source.


## Full text, page caching and legal scope

OpenShelf fetches one full-text edition when a reader opens a title; it does not bulk-download or republish the entire Gutendex catalogue. The loader checks IndexedDB, an optional repository-hosted `books/pg<ID>.txt`, the source `text/plain` URL and a sequential proxy fallback. It strips Project Gutenberg's start/end boilerplate, detects common chapter headings and caches the parsed 260-word logical pages plus table of contents in the user's browser. Proxy services and upstream URLs can change or be unavailable; in that case bundled curated editions still fall back to their local chapter JSON when available.

A Gutendex `text/plain` format is a reading-source signal, not proof that a book is public domain worldwide or that redistribution is authorised. Project Gutenberg's rights assessment follows US law; check the ebook notice and local copyright law before reusing or redistributing any text. OpenShelf leaves source attribution visible and does not bulk mirror live catalogue books.
