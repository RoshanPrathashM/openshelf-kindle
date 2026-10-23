# Privacy

OpenShelf v0.4 is a static website and has no OpenShelf user accounts or server-side book uploads.

## What stays in your browser

- Search/filter state is handled in the browser.
- Notes, saved books and reading-history signals for local recommendations are stored in your browser's local storage. They are not uploaded to an OpenShelf account or synced between devices.
- EPUB and text files selected in Book Studio are processed locally by JavaScript; this version does not upload these files to an OpenShelf server.
- API keys entered in the translation form are not saved by OpenShelf to local storage. Avoid leaving them in the password field on a shared device.

Local browser data is not encrypted by this project and does not sync across devices. Export important notes and keep a private backup. Clearing site data may erase notes and saved books.

## What is sent externally

- Book catalogue searches are sent to the selected catalogue provider: Gutendex, Open Textbook Library, DOAB or Open Library. Search terms can therefore be visible to that provider.
- Book-cover images may load directly from Project Gutenberg or Open Library’s cover service. Opening a book in the reading panel loads its page from the original source in an embedded frame where the source permits it.
- Static book-guide pages contain book metadata and a summary, plus links to original sources; the full text remains source-hosted.
- When you press Translate, the text in the translation box and the selected languages are sent to the endpoint URL you configure. If a key is supplied, it is sent with the translation request to that endpoint. Use only a server you trust; don't paste sensitive personal or confidential text into a public translation service.
- Loading EPUB inspection may fetch the JSZip library from cdnjs. This happens only after you request the EPUB tool.

Third-party sites and APIs have their own privacy policies, request logging, availability, cookies, analytics, and terms. GitHub Pages may process technical request logs for website delivery.

If a future version adds hosted uploads, user accounts, AI APIs, or analytics, OpenShelf must publish an updated privacy notice and a retention/deletion process before launch.
