# Contributing to OpenShelf

Thank you for helping make open reading easier. For the current prototype, the best contribution is a **verified source recommendation**—not an unreviewed book file.

## Before proposing a title

Please include:

- Exact title, author/rightsholder, language, edition/year when known.
- Official publisher, author, institutional repository, or recognized open-library URL.
- The exact licence name and URL, or evidence that the contributor holds the necessary distribution rights.
- Available formats and approximate file size, if shown by the source.
- Formatting notes: table of contents, missing pages, OCR errors, diagrams, accessible text, or known issues.
- Whether rights for the intended territory are confirmed. If not, mark it **needs review**.

Use the GitHub issue form “Suggest an open book.” A moderator should verify the source before adding it to `index.html`.

## Do not submit

- Scans or copies of copyrighted books just because they are searchable online.
- Files copied from a subscription or borrowing service unless redistribution is explicitly permitted.
- DRM-removed files, passwords, personal data, or malware.
- AI-generated or OCR-derived corrections presented as an authoritative edition without a human-review note.

## Quality checks for future file submissions

1. Preserve source, edition, and licence records.
2. Verify the file is safe and opens correctly.
3. Run EPUBCheck for EPUB files where practical.
4. Review language metadata, table of contents, heading structure, chapter order, links, images, and alt text.
5. Review PDF page order, clipping, legibility, skew, OCR quality, and diagram readability.
6. Test on a standard EPUB reader and a documented Kindle transfer path.
7. Record what was checked and by whom. Do not label a work “verified” without evidence.

## Code contributions

Keep the site lightweight, accessible, keyboard-friendly, and compatible with older browsers where practical. Avoid unnecessary frameworks and trackers. Explain changes and test search/filter behaviour on the static site.
