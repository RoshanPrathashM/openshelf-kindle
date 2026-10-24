# OpenShelf

**A Kindle-inspired reading workspace for discovering open books, preparing your own ebook files, translating excerpts, and keeping private reading notes.**

OpenShelf v0.5 is a static open-source discovery and reading prototype. It federates live search across Project Gutenberg via Gutendex, Open Textbook Library, DOAB, and Open Library public-access records. Catalogue totals belong to the selected source and current filters; the site shows the count returned by each source at runtime. OpenShelf does not have a single master index of all books on the internet and does not store the entire catalogues or full book files.

## What's new in v0.5

- Kindle-inspired desktop sidebar, responsive cover shelves, and a right-hand book details/tools panel.
- A dedicated **Read inside OpenShelf** shelf is populated from [content/library-index.json](content/library-index.json), with covers, author/year metadata, source links, local-reader links and a count of full-text editions hosted by this repository.
- The full-text shelf shares the main search and language filters; opening a supported cover routes to the first-party OpenShelf reader instead of sending the reader to an external website.
- The floating Tools drawer now targets only the real tool workspaces (Book Studio, Translate, Notes and Kindle help), so it cannot hide the book shelves because their descriptions happen to mention notes or reading tools.
- Covers use the original source cover when available, or a generated typographic placeholder that does not copy external artwork.
- Clicking a book opens a side panel with book details, subjects, authorised source links, Save to shelf, notes, translation, and Send to Kindle guidance. “Read full book” opens the source reading page in a new tab so the full text does not get trapped in a blank embedded frame.
- The reader has a top toolbar and a side note/tools panel where the original source permits embedding.
- Multi-collection selector for Project Gutenberg, Open Textbook Library, DOAB and Open Library public-access records.
- Source-aware cover/format links, public-access filters where the source exposes them, and local reading-history recommendations ranked by matching authors, subjects and languages.
- Twenty crawlable classic-book title pages with source-linked cover images, book summaries, canonical URLs, Open Graph metadata, Book/Breadcrumb structured data and a generated XML sitemap.
- Stable book guide index, source directory, engineering textbook page, Tamil book page and public-domain guide.
- Featured book covers and “Read full book” buttons open the official Project Gutenberg book page. “Open book tools in OpenShelf” returns to the matching title panel.

## Current features

### Live catalogue and book reading

- Queries Gutendex for Project Gutenberg books, Open Textbook Library’s public JSON API for textbooks, DOAB’s REST API for open-access scholarly records, and Open Library’s Search API for public-access editions. Availability and response formats depend on each provider’s live API and CORS settings.
- Supports title/author/topic search, language filtering where supported, pagination, source-format links and title/author/recommendation sorting (recommendations are local and heuristic, not AI).
- The built-in reader currently includes 10 English full-text editions: *The Time Machine*, *The Call of the Wild*, *The Jungle Book*, *Hamlet*, *The Adventures of Sherlock Holmes*, *Frankenstein*, *The Picture of Dorian Gray*, *Dracula*, *Alice’s Adventures in Wonderland*, and *The Secret Garden*. Other search results may still open at their original source.
- Tamil and additional educational collections are listed in the source directory/registry, but this release does not yet have a locally hosted Tamil full-text collection. A source being listed does not mean its API is integrated into live search.
- The API is paginated; the first page contains at most 32 records. The count badge is the total matches for the selected live source and current filters, not the number downloaded into this repository. OpenShelf has four live searchable integrations today; the repository’s curated source registry also includes sources that are link-only rather than API-integrated.
- Full text opens on the authorised publisher/archive reading page. Project Gutenberg asks independent sites to use plain links rather than embedding its books, so its official page opens in a new tab; keep OpenShelf open for private notes and reading tools.
- OpenStax, Standard Ebooks, Tamil Wikisource, Project Madurai and other collections are linked in the source directory where the best experience is still the publisher/archive page.
- SEO pages are maintained at [`/books/`](books/index.html), [`/sources/`](sources/index.html), and [`/sitemap.xml`](sitemap.xml). Search engines decide when and whether they index these pages; a sitemap helps discovery but does not guarantee ranking.
- The library is not a list of every book in the world and does not have one deduplicated global total. The built-in count is for local full-text editions; live counts belong to the selected source and can overlap across providers. Check rights and source conditions before downloading or redistributing an edition.

### OpenShelf Book Studio

- Inspect a locally selected EPUB's package structure, title/author/language metadata, manifest-to-spine references, chapter count/approximate words, navigation hints, and missing image alt text.
- Edit title/author/language metadata, then create a rebuilt EPUB with the mimetype entry written first and uncompressed.
- Preview an extracted chapter as plain text.
- Clean line endings and whitespace in TXT/Markdown files you choose locally.

Book Studio processes the selected file in the browser; it does not upload the file to an OpenShelf server. It is a **quick structural review**, not complete EPUB conformance testing and not a guarantee of clean OCR, correct rendering, or Kindle compatibility. Use the official [W3C/DAISY EPUBCheck project](https://github.com/w3c/epubcheck) for full format validation. Re-inspect any rebuilt file and test it on an actual reader.

### Translation

- Works with a user-selected LibreTranslate-compatible endpoint.
- The default is a community mirror, which may be rate-limited, change, or go offline. Use **Check languages** first.
- A managed server may require an API key. The key is entered for a session and is not written to local storage; text is sent to the endpoint you select.
- This prototype has no built-in offline LLM and does not provide a translation server itself.

### Notes and bookshelf

- Notes and saved book IDs are stored in the browser's local storage.
- Export notes as JSON or Markdown and export the bookshelf as JSON.
- Data is local to one browser/profile/device and does not sync automatically. Export backups before clearing site data.

## Run and publish

Open `index.html` in a modern browser. No build step is required. Catalogue search needs an internet connection and the Gutendex API. EPUB inspection loads JSZip from a CDN only when requested.

For GitHub Pages settings, see [DEPLOYMENT.md](DEPLOYMENT.md). Recommended settings: **Settings → Pages → Deploy from a branch → `main` → `/(root)`**.


### Search indexing and SEO

- The root page has a canonical URL, title/description metadata, social-preview metadata and `WebSite` structured data.
- The 20 featured classic-book guides have stable URLs, source-linked cover images, unique descriptions, canonical URLs and `Book`/breadcrumb structured data. The sitemap lists the home page, collection indexes and guide pages.
- After deployment, add the GitHub Pages URL-prefix property in [Google Search Console](https://search.google.com/search-console/about), complete the verification method it gives you, then submit `https://roshanprathashm.github.io/openshelf-kindle/sitemap.xml`. Add the same site to [Bing Webmaster Tools](https://www.bing.com/webmasters/) if desired.
- A sitemap improves discovery but cannot guarantee indexing, immediate ranking or a particular search position. Review Search Console coverage and API health as the catalogue grows.

## Privacy and copyright

Read [PRIVACY.md](PRIVACY.md), [CONTRIBUTING.md](CONTRIBUTING.md), and [RIGHTS_POLICY.md](RIGHTS_POLICY.md). The current version links out to source sites; it does not accept public uploads or host visitor-submitted book files. The MIT licence in [LICENSE](LICENSE) applies to OpenShelf software only and grants no rights in third-party books, images, or metadata.

## Not implemented yet

- Bulk mirroring of all catalogues, hosting the full text and binaries for every book, per-title licence evidence collection, crawl monitoring/Search Console submission, server-side index/sitemap generation, or guaranteed search-engine ranking.

- Server-side uploads, user accounts, moderated contributor submissions with file storage, malware scanning, OCR, conversion jobs, synchronized notes, or hosted AI/LLM translation.
- Full EPUBCheck integration, PDF/OCR repair, or guaranteed in-page embedding for every source.
- Automatic delivery into a Kindle account.

Those require a backend and careful design for permission checks, file quarantine, service costs, secret/API-key handling, privacy, takedown requests, and abuse prevention. Never publish a book file unless its rightsholder authorizes it or the relevant licence/public-domain status permits it.

## Licence

OpenShelf software is licensed under the MIT License in [LICENSE](LICENSE). Third-party books remain governed by their own rights and terms.
