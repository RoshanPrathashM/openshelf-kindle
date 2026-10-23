# OpenShelf

**A Kindle-first reading workspace for discovering open books, preparing your own ebook files, translating excerpts, and keeping private reading notes.**

OpenShelf v0.2 is a static open-source prototype. It now has a live public-domain discovery catalogue, a reader panel for supported Gutenberg HTML editions, private local notes and saved books, an optional translation connector, and local ebook utilities.

## Use the website

Open the deployed site (when GitHub Pages publication has finished):  
https://roshanprathashm.github.io/openshelf-kindle/

### Live book catalogue and reading panel

- Queries the Gutendex API for Project Gutenberg metadata, supporting title/author search and language filtering. The API returns paginated entries with metadata and format URLs.
- Loads results inside the OpenShelf page; **Read here** opens a reading panel rather than immediately navigating away.
- The embedded view depends on the source's HTML edition and whether its website permits framing. If a source blocks embedding, use **Open source** as a fallback.
- Source catalogues such as OpenStax, DOAB, Open Textbook Library, and Tamil Wikisource remain external links because their catalogues and rights/format rules differ.
- This is not an archive of every book on the internet. Verify the copyright status of each work in your country before downloading or redistributing it.

### OpenShelf Book Studio

- Inspect a locally selected EPUB's package structure, title/author/language metadata, manifest-to-spine references, chapter count/approximate words, navigation hints, and missing image alt text.
- Edit title/author/language metadata, then create a rebuilt EPUB with the mimetype entry written first and uncompressed.
- Preview an extracted chapter as plain text.
- Clean line endings and whitespace in TXT/Markdown files you choose locally.

The EPUB tool runs in the browser and does not upload your selected file to OpenShelf. It is a **quick structural review**, not full EPUB conformance testing and not a guarantee of clean OCR, correct rendering, or Kindle compatibility. Use the official [W3C/DAISY EPUBCheck project](https://github.com/w3c/epubcheck) for full format validation. Re-inspect any rebuilt file and test it on a real reader.

### Translation

- The translation form works with a user-selected LibreTranslate-compatible endpoint.
- By default it points to `http://localhost:5000`, suitable only if you have set up a local service and your browser allows the connection.
- A managed server may require an API key. The key is entered for a single session and is not written to local storage; the text you translate is sent to whichever endpoint you select.
- Public API quotas, CORS policy, supported languages, and translation quality are controlled by that service. This prototype has no built-in offline LLM and does not provide a translation endpoint itself.

### Notes and bookshelf

- Notes, translations saved as notes, and saved book IDs are stored in your browser's local storage.
- Export notes as JSON or Markdown and export the bookshelf as JSON.
- Data is local to one browser/profile/device and does not sync automatically. Export backups before clearing site data or changing browsers.

## Development

Open `index.html` in a modern browser. Catalogue search needs an internet connection and the Gutendex API. EPUB inspection loads JSZip from a CDN only when requested. No build step is required.

## Publish with GitHub Pages

See [DEPLOYMENT.md](DEPLOYMENT.md). The recommended setup for the current static site is **Settings → Pages → Deploy from a branch → `main` → `/(root)`**.

## Community and copyright

Read [CONTRIBUTING.md](CONTRIBUTING.md) and [RIGHTS_POLICY.md](RIGHTS_POLICY.md) before suggesting a title. The current version links out to source sites; it does not accept public uploads or host visitor-submitted book files. The MIT licence in [LICENSE](LICENSE) applies to OpenShelf software only and grants no rights in third-party books, images, or metadata.

## What is not implemented yet

- Server-side uploads, file storage, moderated contributor accounts, malware scanning, OCR, conversion jobs, synchronized notes, or a hosted AI/LLM translation endpoint.
- Full EPUBCheck integration, PDF/OCR repair, or guaranteed internal embedding for every source.
- Automatic delivery into a Kindle account.

Those require a backend and careful design for permission checks, file quarantine, service costs, secret/API-key handling, privacy, takedown requests, and abuse prevention. Don't publish a book file unless the rightsholder has authorized it or the relevant licence/public-domain status permits it.

## Licence

The OpenShelf software is licensed under the MIT License in [LICENSE](LICENSE). Third-party books remain governed by their own rights and terms.
