# OpenShelf

**A free, Kindle-inspired reading library for discovering open books and reading supported editions inside one calm workspace.**

Live site: https://roshanprathashm.github.io/openshelf-kindle/  
Repository: https://github.com/RoshanPrathashM/openshelf-kindle

OpenShelf is an open-source prototype designed for phones, tablets and laptops. The current build focuses on a clean cover-first homepage, local reading, external book discovery, and lightweight reading tools that run in the browser.

## Current build

### Library and discovery
- Responsive cover grid, book search, categories, a **Continue Reading** card and a device-local **My Library** shelf.
- Search supported locally hosted titles and live results from Project Gutenberg via Gutendex, Open Library and Tamil Wikisource.
- Local full-text editions open in the OpenShelf reader. Results that are not hosted here open at their source/catalogue, where access and rights vary.
- Cards can be saved to the user's local library. Saved items, reading history and reading settings are not synced between devices.
- **OpenShelf Unlimited** is a discovery concept: one search across legitimate catalogues. It is not a subscription and does not make every result free to redistribute or readable inside OpenShelf.

### Reader
- Local reader editions currently include 10 English works: *The Time Machine*, *The Call of the Wild*, *The Jungle Book*, *Hamlet*, *The Adventures of Sherlock Holmes*, *Frankenstein*, *The Picture of Dorian Gray*, *Dracula*, *Alice's Adventures in Wonderland*, and *The Secret Garden*.
- Reading controls for font size, line spacing, typeface, warm-paper/sepia/dark themes, and a page-turn mode with horizontal swiping and transition animation. Continuous scrolling remains available.
- English dictionary lookup through a public dictionary API; an internet connection is required for definitions.
- Select text to highlight or underline it, add private notes, save notes/highlights on this browser, and export notes to a text file.
- Pencil mode lets touch and pointer users draw over the visible reading area. Drawings are stored locally on the device, separated by book/chapter and the current page or scroll region.
- Reading position and reader settings are saved locally.

### Install and offline use
- The site includes a web-app manifest and a service worker. Compatible browsers may offer **Add to Home Screen / Install** for an app-like experience.
- The service worker caches the app shell and same-origin files as they are opened. Previously visited local reader content may remain available offline.
- External catalogues, covers and dictionary lookups need a network connection. Offline caching is best-effort; users should open a book at least once while online before relying on it offline.

## Run locally

Open `index.html` through a local web server rather than a `file://` URL if you want the service worker and fetch-based library index to work. No build step is required.

For example, with Python installed:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000/`.

## Rights and limits

OpenShelf is a **discovery layer plus a small local reading library**, not a mirror of every book online. Being free to read is not the same as permission to copy or redistribute. Each provider and edition can have different rules, and copyright status can differ by country.

- Local full texts belong in the repository only when the underlying work and the source edition may lawfully be redistributed.
- If rights are unclear, link to the authorised source instead of copying the book.
- Project Gutenberg records should not be treated as globally public domain without checking the relevant country's rules.
- Open Library is a discovery/catalogue service, not a blanket redistribution licence.
- See [RIGHTS_POLICY.md](RIGHTS_POLICY.md), [catalog-registry.json](catalog-registry.json), and [CONTRIBUTING.md](CONTRIBUTING.md) before proposing content.

## What is not implemented yet

- **No central user-upload server.** The site is static; visitors cannot publish a book to every user's library by uploading a file. A public contribution system needs a backend, storage, file validation, licence/rights evidence, abuse controls and a review process. Personal browser-only imports are a separate feature from public redistribution.
- No user accounts, cloud sync, collaborative notes, paid subscription, or user analytics backend.
- No guarantee of complete global book coverage or a deduplicated global count. Search results come from a few live providers and can overlap.
- Tamil Wikisource is available through live source search, but this repository does not currently host a curated Tamil full-text shelf.
- Pencil drawings and notes stay in this browser profile and are not backed up automatically. Export notes before clearing site data or moving to another device.
- The page-turn and pencil experiences are an early web prototype; test them on the target phone/tablet before relying on them for long reading sessions.

## Project structure

- `index.html` — responsive home, local shelf and multi-source discovery.
- `read/index.html` — local book reader and reading tools.
- `content/` — hosted text editions and `library-index.json` manifest.
- `books/` — book information/SEO landing pages.
- `sources/` — directory of legitimate book collections.
- `catalog-registry.json` — catalogue sources and ingestion rules.
- `manifest.webmanifest` and `sw.js` — install metadata and offline caching.

## Feedback and contributions

For the current prototype, the safest useful contribution is a verified source suggestion with title, author, official URL, language, licence/rights evidence, and the country or jurisdiction reviewed. Please do not submit copyrighted book files unless permission to redistribute them is documented.
