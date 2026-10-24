"use strict";

const assert = require("node:assert/strict");
const { chromium } = require("playwright");

const BASE_URL = process.env.OPENSHELF_BASE_URL || "http://127.0.0.1:4173/";
const pageErrors = [];
const browserMessages = [];
const passed = [];

function pass(label) {
  passed.push(label);
  console.log("PASS " + label);
}

async function expectVisible(locator, label) {
  await locator.waitFor({ state: "visible", timeout: 15000 });
  pass(label);
}

async function waitForCards(page, minimum = 1) {
  await page.waitForFunction(
    ({ selector, count }) => document.querySelectorAll(selector).length >= count,
    { selector: "#book-grid .book-card", count: minimum },
    { timeout: 20000 }
  );
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    // Block non-local requests so that smoke tests are deterministic and do not
    // depend on live catalogue APIs or remote cover-image hosts.
    const desktop = await browser.newContext({
      viewport: { width: 1365, height: 900 },
      serviceWorkers: "allow"
    });
    const page = await desktop.newPage();
    page.on("pageerror", error => pageErrors.push("desktop: " + error.message));
    page.on("console", message => { if (message.type() === "error") browserMessages.push("console: " + message.text()); });
    page.on("request", request => { if (request.url().startsWith(BASE_URL)) browserMessages.push("request: " + request.method() + " " + request.url()); });
    page.on("response", response => { if (response.url().startsWith(BASE_URL)) browserMessages.push("response: " + response.status() + " " + response.url()); });
    page.on("requestfailed", request => browserMessages.push("request failed: " + request.url() + " · " + request.failure()?.errorText));
    await page.addInitScript(() => {
      const originalFetch = window.fetch.bind(window);
      window.fetch = async (input, init) => {
        const requestUrl = typeof input === "string" ? input : input && input.url;
        if (requestUrl && requestUrl.includes("/cache/epub/123/pg123.txt")) {
          const firstChapter = Array.from({ length: 920 }, () => "unabridged").join(" ");
          const secondChapter = Array.from({ length: 420 }, () => "chapterword").join(" ");
          const text = "*** START OF THE PROJECT GUTENBERG EBOOK FULL TEXT SMOKE NOVEL ***\n\nCHAPTER I\n\n" +
            firstChapter + "\n\nCHAPTER II\n\n" + secondChapter +
            "\n\n*** END OF THE PROJECT GUTENBERG EBOOK FULL TEXT SMOKE NOVEL ***";
          return new Response(text, { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8" } });
        }
        if (requestUrl && requestUrl.startsWith("https://api.dictionaryapi.dev/api/v2/entries/en/")) {
          return new Response(JSON.stringify([{
            word: "unabridged",
            meanings: [{ partOfSpeech: "adjective", definitions: [{ definition: "Complete; not shortened or abridged." }] }]
          }]), { status: 200, headers: { "Content-Type": "application/json" } });
        }
        if (requestUrl && requestUrl.startsWith("https://gutendex.com/books/")) {
          const url = new URL(requestUrl);
          if (url.searchParams.has("search")) {
            return new Response(JSON.stringify({
              count: 1, next: null, previous: null,
              results: [{
                id: 123, title: "Full Text Smoke Novel",
                authors: [{ name: "Browser Test Author" }],
                subjects: ["Adventure"], bookshelves: ["Adventure"],
                formats: { "text/plain; charset=utf-8": "https://www.gutenberg.org/cache/epub/123/pg123.txt" },
                download_count: 400
              }]
            }), { status: 200, headers: { "Content-Type": "application/json" } });
          }
          const pageNumber = Number(url.searchParams.get("page") || 1);
          const results = Array.from({ length: 32 }, (_, index) => {
            const id = 20000 + (pageNumber - 1) * 32 + index;
            return {
              id,
              title: "Smoke Catalogue Book " + id,
              authors: [{ name: "Smoke Author " + id }],
              subjects: ["Adventure stories"],
              bookshelves: ["Adventure"],
              formats: {},
              download_count: 10000 - id
            };
          });
          return new Response(JSON.stringify({
            count: 160,
            next: pageNumber < 5 ? "https://gutendex.com/books/?languages=en&page=" + (pageNumber + 1) : null,
            previous: pageNumber > 1 ? "https://gutendex.com/books/?languages=en&page=" + (pageNumber - 1) : null,
            results
          }), { status: 200, headers: { "Content-Type": "application/json" } });
        }
        return originalFetch(input, init);
      };
    });
    await page.route("https://**/*", route => route.abort());
    await page.route("https://gutendex.com/books/**", async route => {
      const url = new URL(route.request().url());
      const pageNumber = Number(url.searchParams.get("page") || 1);
      const results = Array.from({ length: 32 }, (_, index) => {
        const id = 20000 + (pageNumber - 1) * 32 + index;
        return {
          id,
          title: "Smoke Catalogue Book " + id,
          authors: [{ name: "Smoke Author " + id }],
          subjects: ["Adventure stories"],
          bookshelves: ["Adventure"],
          formats: {},
          download_count: 10000 - id
        };
      });
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
        count: 160,
        next: pageNumber < 5 ? "https://gutendex.com/books/?languages=en&page=" + (pageNumber + 1) : null,
        previous: pageNumber > 1 ? "https://gutendex.com/books/?languages=en&page=" + (pageNumber - 1) : null,
        results
      }) });
    });

    const response = await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
    assert(response && response.ok(), "Homepage should return a successful HTTP response");
    assert.match(await page.title(), /OpenShelf/i);
    pass("homepage loads with the expected title");

    await waitForCards(page, 20);
    const initialCount = await page.locator("#book-grid .book-card").count();
    assert(initialCount >= 20, "The 10 curated editions and 10 featured free-source books should render");
    assert((await page.locator("#book-grid .book-title").allTextContents()).some(t => /The Time Machine/i.test(t)));
    pass("curated local catalogue renders and includes The Time Machine");

    const firstCard = page.locator("#book-grid .book-card").first();
    const firstTitle = (await firstCard.locator(".book-title").innerText()).trim();
    await firstCard.locator(".book-actions [data-open-book]").click();
    await page.waitForFunction(
      () => !document.getElementById("reader-view").classList.contains("hidden"),
      null,
      { timeout: 10000 }
    );
    try {
      await page.waitForFunction(
        () => {
          const content = document.getElementById("reader-content");
          return content && !content.innerText.includes("Opening your book…");
        },
        null,
        { timeout: 20000 }
      );
    } catch (error) {
      const stuckText = await page.locator("#reader-content").innerText().catch(() => "(unavailable)");
      throw new Error("Reader remained in loading state. Visible content: " + stuckText.slice(0, 600) +
        "\nBrowser events:\n" + browserMessages.slice(-30).join("\n") + "\n" + error.message);
    }
    const firstReaderText = (await page.locator("#reader-content").innerText()).trim();
    if (firstReaderText.includes("Could not load this edition")) {
      throw new Error("Curated reader failed to open " + firstTitle + ": " + firstReaderText.slice(0, 1200) +
        "\nBrowser diagnostics: " + browserMessages.slice(-12).join("\n"));
    }
    assert(firstReaderText.length > 50, "Reader should contain actual book text; diagnostics: " + browserMessages.slice(-12).join("\n"));
    assert.equal((await page.locator("#reader-title").innerText()).trim(), firstTitle);
    pass("a curated edition opens inside the built-in reader");

    await page.evaluate(() => {
      window.__pageTurnAnimations = [];
      document.getElementById("reader-view").addEventListener("animationstart", event => {
        if (/pageSweepForward|pageSweepBack/.test(event.animationName)) window.__pageTurnAnimations.push(event.animationName);
      }, true);
    });
    await page.locator("#reader-content").focus();
    await page.keyboard.press("PageDown");
    await page.waitForFunction(
      () => window.__pageTurnAnimations.includes("pageSweepForward"),
      null,
      { timeout: 3000 }
    );
    pass("Page Down triggers the forward page-turn animation");
    await page.waitForTimeout(400);
    await page.keyboard.press("PageUp");
    await page.waitForFunction(
      () => window.__pageTurnAnimations.includes("pageSweepBack"),
      null,
      { timeout: 3000 }
    );
    pass("Page Up triggers the backward page-turn animation");
    await page.waitForTimeout(400);

    await page.locator("#reader-offline-button").click();
    await page.waitForFunction(
      () => document.getElementById("reader-offline-button").innerText.includes("Saved Offline"),
      null,
      { timeout: 20000 }
    );
    pass("Save Offline stores a curated book in browser storage");

    await page.locator("#bookmark-page").click();
    await page.locator("#open-notes").click();
    await expectVisible(page.locator("#reader-drawer.open"), "reader notes/bookmarks drawer opens");
    await page.locator("#close-drawer").click();
    await page.locator("#exit-reader").click();
    await page.waitForFunction(
      () => document.getElementById("reader-view").classList.contains("hidden"),
      null,
      { timeout: 10000 }
    );

    await expectVisible(page.locator("#continue-card:not(.hidden)"), "Continue Reading card appears after progress is saved");
    await page.locator("#resume-button").click();
    await page.waitForFunction(
      () => !document.getElementById("reader-view").classList.contains("hidden"),
      null,
      { timeout: 10000 }
    );
    assert.equal((await page.locator("#reader-title").innerText()).trim(), firstTitle);
    pass("Continue Reading resumes the most recently read book");
    await page.locator("#exit-reader").click();

    await page.locator('.filter-tabs [data-filter="downloaded"]').click();
    await waitForCards(page, 1);
    assert((await page.locator("#book-grid .book-title").allTextContents()).some(t => t.trim() === firstTitle));
    pass("Downloaded Offline filter shows the saved book");

    await page.locator("#header-theme-button").click();
    const theme = await page.locator("html").getAttribute("data-theme");
    assert(["paperwhite", "sepia", "sage", "night"].includes(theme));
    pass("theme control changes to a supported reading theme");

    // Importing a file should save it locally and open it in the reader.
    await page.locator("#import-file").setInputFiles({
      name: "OpenShelf smoke import.txt",
      mimeType: "text/plain",
      buffer: Buffer.from(
        "OpenShelf smoke import\n\nChapter One\n\nThis is a browser smoke-test paragraph for the locally imported reading experience. It verifies that user-owned text is imported and readable."
      )
    });
    await page.waitForFunction(
      () => !document.getElementById("reader-view").classList.contains("hidden") &&
        document.getElementById("reader-title").innerText.includes("OpenShelf smoke import"),
      null,
      { timeout: 20000 }
    );
    await page.waitForFunction(
      () => document.getElementById("reader-content").innerText.includes("browser smoke-test paragraph"),
      null,
      { timeout: 10000 }
    );
    pass("local TXT import saves privately and opens as readable content");
    await page.locator("#exit-reader").click();

    await page.waitForFunction(
      async () => {
        if (!("serviceWorker" in navigator)) return false;
        const registration = await navigator.serviceWorker.getRegistration();
        return Boolean(registration && registration.active);
      },
      null,
      { timeout: 20000 }
    );
    pass("service worker installs and activates");

    // Check that the app shell survives an offline reload after the user has
    // opened a local book and the service worker has had time to cache content.
    await desktop.setOffline(true);
    const offlineResponse = await page.reload({ waitUntil: "domcontentloaded", timeout: 15000 });
    assert(offlineResponse && offlineResponse.ok(), "Offline reload should be served by the service worker");
    await waitForCards(page, 10);
    await page.waitForFunction(
      () => document.getElementById("network-label").innerText === "Offline",
      null,
      { timeout: 10000 }
    );
    pass("offline reload keeps the local catalogue accessible and shows Offline status");
    await desktop.setOffline(false);

    await page.locator("#load-free-catalogue").click();
    try {
      await page.waitForFunction(
        () => {
          const cards = Array.from(document.querySelectorAll("#book-grid .book-card"));
          const publicCards = cards.filter(card => !String(card.dataset.bookId || "").startsWith("import:"));
          return publicCards.length === 100;
        },
        null,
        { timeout: 20000 }
      );
    } catch (error) {
      const diagnostics = {
        cardCount: await page.locator("#book-grid .book-card").count().catch(() => -1),
        publicCardCount: await page.locator("#book-grid .book-card:not([data-book-id^=\"import:\"])").count().catch(() => -1),
        status: await page.locator("#result-status").innerText().catch(() => "(unavailable)"),
        button: await page.locator("#load-free-catalogue").innerText().catch(() => "(unavailable)"),
        browserMessages: browserMessages.slice(-30),
        pageErrors
      };
      throw new Error("100-title catalogue assertion failed: " + JSON.stringify(diagnostics) + "\\n" + error.message);
    }
    assert((await page.locator("#book-grid .book-title").allTextContents()).some(t => /Smoke Catalogue Book 20000/.test(t)));
    pass("Browse 100 free books builds a 100-title rights-aware catalogue");

    await page.locator("#global-search").fill("Full Text Smoke Novel");
    await page.waitForFunction(
      () => Array.from(document.querySelectorAll("#book-grid .book-title")).some(node => node.innerText.includes("Full Text Smoke Novel")),
      null, { timeout: 12000 }
    );
    await page.locator('#book-grid [data-open-book="external:gutenberg:123"]').first().click();
    await page.waitForFunction(
      () => document.getElementById("reader-title").innerText.includes("Full Text Smoke Novel") &&
        document.getElementById("reader-content").innerText.includes("unabridged"),
      null, { timeout: 20000 }
    );
    const fullPageCount = Number(await page.locator("#reader-page-slider").getAttribute("max"));
    assert(fullPageCount >= 5, "The full text should be split into multiple approximately 260-word pages");
    assert(await page.locator("#reader-toc-select option").count() >= 2, "Detected chapter headings should populate the TOC");
    await page.locator("#reader-page-number").fill("4");
    await page.locator("#reader-page-number").press("Enter");
    await page.waitForFunction(() => document.getElementById("reader-page-number").value === "4", null, { timeout: 5000 });
    pass("Gutendex text/plain books open as paginated full text with chapter and page navigation");

    await page.evaluate(() => {
      const reader = document.getElementById("reader-content");
      const textNode = Array.from(reader.querySelectorAll("p")).map(p => p.firstChild).find(node => node && node.nodeType === Node.TEXT_NODE && node.textContent.includes("unabridged"));
      if (!textNode) throw new Error("No selectable source text was found");
      const offset = textNode.textContent.indexOf("unabridged");
      const range = document.createRange();
      range.setStart(textNode, offset);
      range.setEnd(textNode, offset + "unabridged".length);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      reader.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
      window.prompt = () => "A note attached to this word.";
    });
    await page.waitForFunction(
      () => !document.getElementById("reader-selection-toolbar").classList.contains("hidden"),
      null, { timeout: 5000 }
    );
    await page.locator("#selection-define-word").click();
    await page.waitForFunction(
      () => document.getElementById("selection-definition").innerText.includes("Complete; not shortened"),
      null, { timeout: 5000 }
    );
    await page.locator("#selection-add-note").click();
    await page.waitForFunction(
      () => document.getElementById("toast").innerText.includes("Private note saved"),
      null, { timeout: 5000 }
    );
    await page.evaluate(() => {
      const reader = document.getElementById("reader-content");
      const walker = document.createTreeWalker(reader, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        if (node.textContent.includes("unabridged") && !(node.parentElement && node.parentElement.closest(".os-highlight"))) break;
      }
      if (!node) throw new Error("No text remains for a second selection");
      const offset = node.textContent.indexOf("unabridged");
      const range = document.createRange();
      range.setStart(node, offset); range.setEnd(node, offset + "unabridged".length);
      const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
      reader.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    });
    await page.waitForFunction(
      () => !document.getElementById("reader-selection-toolbar").classList.contains("hidden"),
      null, { timeout: 5000 }
    );
    await page.locator('[data-selection-highlight="green"]').click();
    await page.waitForFunction(() => document.querySelector("#reader-content .os-highlight-green"), null, { timeout: 5000 });
    await page.evaluate(() => {
      const reader = document.getElementById("reader-content");
      const walker = document.createTreeWalker(reader, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        if (node.textContent.includes("unabridged") && !(node.parentElement && node.parentElement.closest(".os-highlight"))) break;
      }
      if (!node) throw new Error("No text remains for quote-copy selection");
      const offset = node.textContent.indexOf("unabridged");
      const range = document.createRange();
      range.setStart(node, offset); range.setEnd(node, offset + "unabridged".length);
      const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
      reader.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    });
    await page.waitForFunction(
      () => !document.getElementById("reader-selection-toolbar").classList.contains("hidden"),
      null, { timeout: 5000 }
    );
    await page.locator("#selection-copy-quote").click();
    await page.waitForFunction(() => document.getElementById("toast").innerText.includes("Quote copied"), null, { timeout: 5000 });
    pass("selection toolbar supports dictionary definitions, selected-text notes, colored highlights and quote copying");
    await page.locator("#exit-reader").click();
    await desktop.close();

    // Verify the actual narrow-screen layout and the mobile bottom navigation.
    const mobile = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      serviceWorkers: "allow"
    });
    const mobilePage = await mobile.newPage();
    mobilePage.on("pageerror", error => pageErrors.push("mobile: " + error.message));
    await mobilePage.route("https://**/*", route => route.abort());
    const mobileResponse = await mobilePage.goto(BASE_URL, { waitUntil: "domcontentloaded" });
    assert(mobileResponse && mobileResponse.ok(), "Mobile homepage should return successfully");
    await waitForCards(mobilePage, 10);
    await expectVisible(mobilePage.locator(".mobile-bottom-nav"), "mobile bottom navigation is visible");
    assert.equal(await mobilePage.locator(".sidebar").isVisible(), false, "desktop sidebar should be hidden on mobile");
    const widths = await mobilePage.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth
    }));
    assert(widths.content <= widths.viewport + 1, "mobile layout must not overflow horizontally: " + JSON.stringify(widths));
    pass("390px mobile layout fits the viewport without horizontal overflow");

    await mobilePage.locator('.mobile-bottom-nav [data-mobile-view="sources"]').click();
    await mobilePage.waitForFunction(
      () => !document.getElementById("directory-view").classList.contains("hidden") &&
        document.getElementById("directory-heading").innerText.includes("Legal sources"),
      null,
      { timeout: 10000 }
    );
    pass("mobile navigation opens the legal sources directory");
    await mobilePage.locator('.mobile-bottom-nav [data-mobile-view="home"]').click();
    await mobilePage.waitForFunction(
      () => !document.getElementById("library-view").classList.contains("hidden"),
      null,
      { timeout: 10000 }
    );
    pass("mobile navigation returns to the library");

    assert.deepEqual(pageErrors, [], "No uncaught browser JavaScript errors should occur");
    pass("no uncaught browser JavaScript errors on desktop or mobile");
    console.log("\nOpenShelf browser smoke tests passed: " + passed.length);
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
