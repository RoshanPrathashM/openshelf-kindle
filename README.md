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


### 3. Kindle-style reader

For curated editions and private local imports, the fullscreen reader provides:
- Four reading themes: Paperwhite, Sepia, Kindle Sage and Night E-Ink.
- Paginated horizontal columns with animated page turns, next/previous buttons, left/right arrows, Page Up/Page Down, Space/Shift+Space and touch swipe; smooth-scroll mode is also available.
- Serif, sans-serif and monospace type; font size, line spacing and reading-margin controls.
- Progress percentage, estimated reading time remaining and saved reading position.
- Bookmarks, private notes, text highlights, underlines and export of notes/bookmarks as JSON.
- One-click offline storage with IndexedDB. A title can be removed from offline storage without deleting its separately saved reading-progress metadata.
- Personal import for <code>.txt</code>, <code>.md</code>, <code>.markdown</code>, <code>.html</code> and <code>.htm</code> files. Imported text stays in the user's own browser storage and is not published or shared.

The reader sanitizes source chapter markup before inserting it into the page. The built-in content is loaded from this repository, avoiding cross-origin reader embedding for those editions.

### 4. Unified live search

After two or more characters, search runs with a 400 ms debounce against:
- Project Gutenberg via Gutendex
- Open Library
- Tamil Wikisource
- Open Textbook Library
- Directory of Open Access Books (DOAB)

The app filters the local shelf immediately while showing loading skeletons for external results. Requests time out; stale searches are cancelled where supported; source failures are shown without hiding successful results. Provider APIs and CORS policies can change, so source discovery is best-effort. Unverified records stay external.

### 5. Offline and device storage

- Small preferences, saved-book metadata, progress, bookmarks and annotations are stored in <code>localStorage</code>.
- Full saved book content and imported text are stored in the IndexedDB database **OpenShelfOfflineDB**.
- The Device Storage panel displays offline-book count and approximate content size, along with the browser's reported storage quota when available.
- The PWA manifest and service worker cache the home page, app script, stylesheet, reader shell and local catalogue index. A title should be saved offline before relying on it without a network.

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
- <code>manifest.webmanifest</code> — install metadata.
- <code>content/library-index.json</code> — curated local shelf and source notes.
- <code>content/featured-free.json</code> — 10 featured Project Gutenberg source links; popular catalogue results are cached locally as metadata only.
- <code>catalog-registry.json</code> — sources and content-ingestion policy.
- <code>read/index.html</code> — the earlier standalone reader page retained for compatibility.

## Contribution guidance

Suggest books by submitting the official source URL, title, author, language, exact licence/rights evidence, and jurisdiction reviewed. Do not add book files to the local hosted shelf unless redistribution permission is documented. Where terms are uncertain, link to the authorised source.
