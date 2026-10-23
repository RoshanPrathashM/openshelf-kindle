# OpenShelf

**A Kindle-first directory for discovering free books with clear sources, format guidance, and a quality-first mindset.**

OpenShelf is an open-source prototype. This initial release links to original sources; it does **not** host third-party book files, bypass subscriptions, or accept visitor uploads. “Free to read,” “free to borrow,” and “free to redistribute” are different permissions.

## Current features

- Responsive, lightweight site built with HTML, CSS, and vanilla JavaScript; no build tooling or third-party JavaScript dependencies.
- Search by title, author, subject, or language; filter by category and format guidance.
- Starter references for classics, STEM textbooks, Tamil texts, and discovery catalogues.
- Step-by-step Send to Kindle and USB transfer guidance.
- Simple branch-based GitHub Pages publishing (no GitHub Actions workflow required).
- Book recommendation and rights/takedown issue forms.
- No claim of a full Kindle Unlimited replacement or automatic Kindle delivery.

## Run locally

Open `index.html` in a modern browser. No installation is needed. Test the search and category/format filters, then open source links. External links may move or change over time.

## Publish with GitHub Pages

Open [DEPLOYMENT.md](DEPLOYMENT.md) and follow the **Deploy from a branch** steps. This is the simplest publishing route for this plain HTML website; the project does not need a custom workflow to build or deploy.

## Contributing a book/source

Read [RIGHTS_POLICY.md](RIGHTS_POLICY.md) and [CONTRIBUTING.md](CONTRIBUTING.md) before suggesting a title. Start with an authoritative source and record the exact licence or rights evidence. A random PDF link is not proof of permission.

## Quality policy

Visible labels such as “quality-focused source”, “publisher source”, and “check each work” describe discovery guidance, not a claim that OpenShelf has personally tested every file. A future release should record edition, source, licence, EPUBCheck result, table of contents, metadata, OCR review, accessibility checks, and Kindle-transfer smoke tests for each hosted file.

## Future architecture for community uploads

A later release could add a backend such as PostgreSQL plus private quarantine storage and a moderator interface. New files should remain private and pending until rights review, malware scanning, format validation, and manual QA are complete. Add sign-in, rate limits, file-size limits, takedown reporting, backups, and retention policies before enabling public uploads. Re-check service pricing and quotas before launch. Never collect Amazon passwords or claim to deliver to a Kindle without a supported, authorized user-controlled workflow.

## Licence

The OpenShelf source code is licensed under the MIT License in [LICENSE](LICENSE). That licence does **not** grant rights to external books, cover images, publisher marks, or linked websites. Each work retains its own copyright and licence.

## Project status

**Prototype / v0.1 — curated discovery directory.** It helps readers find free sources today, but is not a complete Kindle Unlimited alternative yet. The opportunity is to make legal availability, book quality, language coverage, and Kindle transfer easier.
