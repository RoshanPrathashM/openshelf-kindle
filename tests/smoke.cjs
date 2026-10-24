"use strict";

const assert = require("node:assert/strict");
const { chromium } = require("playwright");

const BASE_URL = process.env.OPENSHELF_BASE_URL || "http://127.0.0.1:4173/";
const pageErrors = [];
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
    await page.route("https://**/*", route => route.abort());

    const response = await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
    assert(response && response.ok(), "Homepage should return a successful HTTP response");
    assert.match(await page.title(), /OpenShelf/i);
    pass("homepage loads with the expected title");

    await waitForCards(page, 10);
    const initialCount = await page.locator("#book-grid .book-card").count();
    assert(initialCount >= 10, "The 10 curated editions should render");
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
    await page.waitForFunction(
      () => {
        const content = document.getElementById("reader-content");
        return content && content.innerText.trim().length > 150 &&
          !content.innerText.includes("Opening your book…") &&
          !content.innerText.includes("Could not load this edition");
      },
      null,
      { timeout: 20000 }
    );
    assert.equal((await page.locator("#reader-title").innerText()).trim(), firstTitle);
    pass("a curated edition opens inside the built-in reader");

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
