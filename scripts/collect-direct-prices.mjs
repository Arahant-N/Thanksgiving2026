import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { chromium } from "playwright-core";

const generatedDir = path.join(process.cwd(), "data", "generated");
const outputPath = path.join(generatedDir, "properties.json");
const browserPath = process.env.PLAYWRIGHT_BROWSER_PATH;
const browserUserDataDir = process.env.BROWSER_USER_DATA_DIR;
const headless = String(process.env.PROPERTY_SCRAPE_HEADLESS || "true").toLowerCase() === "true";

function normalizeText(value) {
  return value.replace(/\u202f/g, " ").replace(/\s+/g, " ").trim();
}

function requireValue(name, value) {
  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value;
}

function isPositiveNumber(value) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function collectCurrencyValues(text) {
  return [...text.matchAll(/\$([\d,]+(?:\.\d{2})?)/g)]
    .map((match) => Number(match[1].replaceAll(",", "")))
    .filter((value) => Number.isFinite(value) && value > 0);
}

function parseNumber(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return Number(match[1].replaceAll(",", ""));
    }
  }

  return 0;
}

function parseLabeledTotalStayPrice(text) {
  return parseNumber(text, [
    /\$([\d,]+(?:\.\d{2})?)\s+total/i,
    /\$([\d,]+(?:\.\d{2})?)\s+for\s+\d+\s+nights?/i,
    /total\s+before\s+taxes\s*\$([\d,]+(?:\.\d{2})?)/i,
    /for\s+your\s+stay\s*\$([\d,]+(?:\.\d{2})?)/i,
    /total\s+price\s*\$([\d,]+(?:\.\d{2})?)/i
  ]);
}

function parseNightlyRate(text) {
  return (
    parseNumber(text, [/\$([\d,]+(?:\.\d{2})?)\s*\/\s*night/i, /\$([\d,]+(?:\.\d{2})?)\s+night/i]) ||
    0
  );
}

function detectAvailabilityStatus(text) {
  if (
    [
      /not available/i,
      /unavailable/i,
      /sold out/i,
      /choose different dates/i,
      /try different dates/i,
      /booked/i
    ].some((pattern) => pattern.test(text))
  ) {
    return "unavailable";
  }

  if (
    [/\breserve\b/i, /\bbook now\b/i, /\bcheck availability\b/i, /\$[\d,]+(?:\.\d{2})?/i].some(
      (pattern) => pattern.test(text)
    )
  ) {
    return "available";
  }

  return "unknown";
}

function isPlausibleLargeGroupTotal(value) {
  return value >= 1500;
}

function normalizePricing(totalStayPrice, nightlyRate) {
  const validTotal = isPlausibleLargeGroupTotal(totalStayPrice) ? totalStayPrice : 0;
  const validNightly = nightlyRate >= 375 ? nightlyRate : 0;

  if (validTotal && validNightly) {
    return { totalStayPrice: validTotal, nightlyRate: validNightly };
  }

  if (validTotal) {
    return {
      totalStayPrice: validTotal,
      nightlyRate: Number((validTotal / 4).toFixed(2))
    };
  }

  if (validNightly) {
    return {
      totalStayPrice: Number((validNightly * 4).toFixed(2)),
      nightlyRate: validNightly
    };
  }

  return { totalStayPrice: 0, nightlyRate: 0 };
}

function buildAirbnbOffer(property) {
  return {
    id: `${property.id}-airbnb`,
    source: "Airbnb",
    label: "Airbnb",
    url: property.url,
    totalStayPrice: isPositiveNumber(property.totalStayPrice) ? property.totalStayPrice : null,
    nightlyRate: isPositiveNumber(property.nightlyRate) ? property.nightlyRate : null,
    captureStatus: isPositiveNumber(property.totalStayPrice) ? "verified" : "link-only",
    availabilityStatus: property.availabilityStatus || "unknown",
    notes: null
  };
}

function buildDirectOffer(property, snapshot = null) {
  const hasPrice = snapshot && isPositiveNumber(snapshot.totalStayPrice);

  return {
    id: `${property.id}-direct`,
    source: "Direct",
    label: property.directBookingLabel || "Direct site",
    url: snapshot?.url || property.directBookingUrl,
    totalStayPrice: hasPrice ? snapshot.totalStayPrice : null,
    nightlyRate: hasPrice ? snapshot.nightlyRate : null,
    captureStatus: hasPrice ? "verified" : "link-only",
    availabilityStatus: snapshot?.availabilityStatus || "unknown",
    notes: hasPrice
      ? "Direct booking site total captured."
      : "Direct booking site found, but the live stay total was not publicly exposed."
  };
}

async function dismissOverlays(page) {
  for (const label of ["Close", "Accept", "I agree", "Got it"]) {
    const button = page.getByRole("button", { name: new RegExp(label, "i") }).first();
    try {
      if (await button.isVisible({ timeout: 1000 })) {
        await button.click({ timeout: 1000 });
      }
    } catch {
      // Best effort only.
    }
  }
}

async function launchBrowser() {
  const executablePath =
    browserPath ||
    [
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
      "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
    ].find((candidatePath) => existsSync(candidatePath));

  requireValue(
    "PLAYWRIGHT_BROWSER_PATH or an installed Chrome/Edge executable",
    executablePath
  );

  if (browserUserDataDir) {
    const context = await chromium.launchPersistentContext(browserUserDataDir, {
      executablePath,
      headless,
      viewport: { width: 1440, height: 1600 }
    });
    return { context, close: () => context.close() };
  }

  const browser = await chromium.launch({
    executablePath,
    headless
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1600 }
  });
  return { context, close: () => browser.close() };
}

async function scrapeDirectPrice(page, property) {
  await page.goto(property.directBookingUrl, {
    waitUntil: "domcontentloaded",
    timeout: 30000
  });
  await dismissOverlays(page);
  await page.waitForTimeout(headless ? 1500 : 3500);

  const titleTag = await page.locator("title").textContent().catch(() => "");
  const metaDescription = await page
    .locator('meta[name="description"]')
    .getAttribute("content")
    .catch(() => null);
  const bodyText = await page.locator("body").innerText().catch(() => "");

  const combinedText = normalizeText([titleTag, metaDescription, bodyText].filter(Boolean).join("\n"));
  const labeledTotal = parseLabeledTotalStayPrice(combinedText);
  const currencyValues = collectCurrencyValues(combinedText).filter(isPlausibleLargeGroupTotal).sort((a, b) => a - b);
  const pricing = normalizePricing(labeledTotal || currencyValues[0] || 0, parseNightlyRate(combinedText));

  return {
    url: page.url(),
    totalStayPrice: pricing.totalStayPrice,
    nightlyRate: pricing.nightlyRate,
    availabilityStatus: detectAvailabilityStatus(combinedText)
  };
}

await mkdir(generatedDir, { recursive: true });

const properties = JSON.parse(await readFile(outputPath, "utf8"));
const { context, close } = await launchBrowser();

try {
  const page = await context.newPage();

  for (const property of properties) {
    const offers = [buildAirbnbOffer(property)];

    if (property.directBookingUrl) {
      try {
        const snapshot = await scrapeDirectPrice(page, property);
        offers.push(buildDirectOffer(property, snapshot));
        property.directBookingStatus = isPositiveNumber(snapshot.totalStayPrice)
          ? "verified"
          : property.directBookingStatus || "likely";
        property.directBookingUrl = snapshot.url;
      } catch (error) {
        console.warn(`Direct price capture failed for ${property.title}: ${String(error)}`);
        offers.push(buildDirectOffer(property, null));
      }
    }

    property.offers = offers;
  }

  await page.close();
} finally {
  await close();
}

await writeFile(outputPath, JSON.stringify(properties, null, 2));
console.log(`Direct-price enrichment wrote ${properties.length} property records.`);
