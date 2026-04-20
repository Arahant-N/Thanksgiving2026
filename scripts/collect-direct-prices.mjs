import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { chromium } from "playwright-core";

const generatedDir = path.join(process.cwd(), "data", "generated");
const outputPath = path.join(generatedDir, "properties.json");
const configPath = path.join(process.cwd(), "data", "config.ts");
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

function parseTripContext(configText) {
  const checkInDate = configText.match(/checkInDate\s*=\s*"([^"]+)"/)?.[1] || "2026-11-25";
  const checkOutDate = configText.match(/checkOutDate\s*=\s*"([^"]+)"/)?.[1] || "2026-11-29";
  const adults = [...configText.matchAll(/\badults:\s*(\d+)/g)].reduce(
    (total, match) => total + Number(match[1]),
    0
  );
  const children = [...configText.matchAll(/\bchildren:\s*(\d+)/g)].reduce(
    (total, match) => total + Number(match[1]),
    0
  );

  return {
    checkInDate,
    checkOutDate,
    travelerCount: adults + children
  };
}

function parseNightlyRate(text) {
  return (
    parseNumber(text, [/\$([\d,]+(?:\.\d{2})?)\s*\/\s*night/i, /\$([\d,]+(?:\.\d{2})?)\s+night/i]) ||
    0
  );
}

function parseSchemaOfferPrice(text) {
  const jsonLdBlocks = [...text.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
    .map((match) => match[1])
    .filter(Boolean);

  for (const block of jsonLdBlocks) {
    const priceMatch =
      block.match(/"offers"\s*:\s*\{[\s\S]{0,600}?"price"\s*:\s*"?([0-9]+(?:\.[0-9]+)?)"?/i) ||
      block.match(/"price"\s*:\s*"?([0-9]+(?:\.[0-9]+)?)"?/i);

    if (!priceMatch) {
      continue;
    }

    const price = Number(priceMatch[1]);
    if (Number.isFinite(price) && price >= 375) {
      return price;
    }
  }

  return 0;
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

function normalizePricing(totalStayPrice, nightlyRate, options = {}) {
  const { inferTotalFromNightly = true } = options;
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
    if (!inferTotalFromNightly) {
      return {
        totalStayPrice: 0,
        nightlyRate: validNightly
      };
    }

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
  const hasVerifiedTotal = snapshot && isPositiveNumber(snapshot.totalStayPrice);
  const hasNightlyOnly =
    snapshot && !hasVerifiedTotal && isPositiveNumber(snapshot.nightlyRate);

  return {
    id: `${property.id}-direct`,
    source: "Direct",
    label: property.directBookingLabel || "Direct site",
    url: snapshot?.url || property.directBookingUrl,
    totalStayPrice: hasVerifiedTotal ? snapshot.totalStayPrice : null,
    nightlyRate: hasVerifiedTotal || hasNightlyOnly ? snapshot.nightlyRate : null,
    captureStatus: hasVerifiedTotal ? "verified" : "link-only",
    availabilityStatus: snapshot?.availabilityStatus || "unknown",
    notes:
      snapshot?.notes ||
      (hasVerifiedTotal
        ? "Direct booking site total captured."
        : hasNightlyOnly
          ? "Direct booking site publishes a nightly rate, but not an exact stay total."
          : "Direct booking site found, but the live stay total was not publicly exposed.")
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
  const html = await page.content().catch(() => "");
  const bodyText = await page.locator("body").innerText().catch(() => "");

  const combinedText = normalizeText([titleTag, metaDescription, bodyText].filter(Boolean).join("\n"));
  const labeledTotal = parseLabeledTotalStayPrice(combinedText);
  const currencyValues = collectCurrencyValues(combinedText).filter(isPlausibleLargeGroupTotal).sort((a, b) => a - b);
  const nightlyRate =
    parseNightlyRate(combinedText) ||
    parseSchemaOfferPrice(html);
  const pricing = normalizePricing(labeledTotal || currencyValues[0] || 0, nightlyRate, {
    inferTotalFromNightly: false
  });

  return {
    url: page.url(),
    totalStayPrice: pricing.totalStayPrice,
    nightlyRate: pricing.nightlyRate,
    availabilityStatus: detectAvailabilityStatus(combinedText),
    notes: null
  };
}

async function scrapeHostawayCheckout(page, property, trip) {
  const listingId = property.directBookingUrl?.match(/\/listings\/(\d+)/)?.[1];
  if (!listingId) {
    return null;
  }

  const guestCount = Math.max(trip.travelerCount, 1);
  const checkoutUrl = `https://bookings.townsproperty.com/checkout/${listingId}?start=${trip.checkInDate}&end=${trip.checkOutDate}&numberOfGuests=${guestCount}`;

  await page.goto(checkoutUrl, {
    waitUntil: "domcontentloaded",
    timeout: 30000
  });
  await page.waitForTimeout(headless ? 2500 : 4000);

  const text = normalizeText(await page.locator("body").innerText().catch(() => ""));
  const total = parseNumber(text, [/Total\s+\$([\d,]+(?:\.\d{2})?)/i]);
  const nightlyRate = parseNumber(text, [/\$([\d,]+(?:\.\d{2})?)\s+X\s+\d+\s+nights?/i]);
  const availabilityStatus = detectAvailabilityStatus(text);

  if (!isPositiveNumber(total)) {
    return {
      url: checkoutUrl,
      totalStayPrice: 0,
      nightlyRate: 0,
      availabilityStatus,
      notes: "Direct checkout page loaded, but an exact stay total was not rendered publicly."
    };
  }

  return {
    url: checkoutUrl,
    totalStayPrice: total,
    nightlyRate: nightlyRate || Number((total / 4).toFixed(2)),
    availabilityStatus: availabilityStatus === "unknown" ? "available" : availabilityStatus,
    notes: `Exact direct checkout total captured for ${trip.checkInDate} to ${trip.checkOutDate}.`
  };
}

async function scrapeBlackberrySprings(page, property) {
  const bookingEngineUrl = "https://www.blackberrysprings.com/booking-engine#/search";

  await page.goto(bookingEngineUrl, {
    waitUntil: "domcontentloaded",
    timeout: 30000
  });
  await page.waitForTimeout(headless ? 2500 : 4000);

  const text = normalizeText(await page.locator("body").innerText().catch(() => ""));
  const hasComparableEstateGap =
    /THE MANOR HOUSE/i.test(text) && /10 Adults max/i.test(text);

  return {
    url: bookingEngineUrl,
    totalStayPrice: 0,
    nightlyRate: 0,
    availabilityStatus: detectAvailabilityStatus(text),
    notes: hasComparableEstateGap
      ? "Public direct checkout only exposes The Manor House (10 adults max), not the comparable full 20-guest estate total."
      : "Direct booking engine is public, but it does not expose an exact comparable stay total."
  };
}

async function scrapeCarolinaJewel(page, property) {
  const reservationsUrl = "https://carolinajewel.com/reservations";

  await page.goto(reservationsUrl, {
    waitUntil: "domcontentloaded",
    timeout: 30000
  });
  await page.waitForTimeout(headless ? 1500 : 2500);

  const text = normalizeText(await page.locator("body").innerText().catch(() => ""));
  const notes = /New services are coming soon!/i.test(text)
    ? "Reservations page does not publish live rates yet; the site currently requires a manual inquiry for exact pricing."
    : "Direct site does not publish a live stay total for this property.";

  return {
    url: reservationsUrl,
    totalStayPrice: 0,
    nightlyRate: 0,
    availabilityStatus: detectAvailabilityStatus(text),
    notes
  };
}

async function scrapeBarnInPenrose(page, property) {
  await page.goto(property.directBookingUrl, {
    waitUntil: "domcontentloaded",
    timeout: 30000
  });
  await page.waitForTimeout(headless ? 1500 : 2500);

  const text = normalizeText(await page.locator("body").innerText().catch(() => ""));
  const notes = /Contact us directly for in house rates/i.test(text)
    ? "Direct site asks guests to contact the host for rates, and the listed lodging links route back to Airbnb."
    : "Direct site does not publish a live stay total for this property.";

  return {
    url: page.url(),
    totalStayPrice: 0,
    nightlyRate: 0,
    availabilityStatus: detectAvailabilityStatus(text),
    notes
  };
}

async function collectDirectSnapshot(page, property, trip) {
  const directUrl = property.directBookingUrl || "";

  if (/bookings\.townsproperty\.com\/listings\//i.test(directUrl)) {
    return scrapeHostawayCheckout(page, property, trip);
  }

  if (/blackberrysprings\.com/i.test(directUrl)) {
    return scrapeBlackberrySprings(page, property);
  }

  if (/carolinajewel\.com/i.test(directUrl)) {
    return scrapeCarolinaJewel(page, property);
  }

  if (/thebarninpenrose\.com/i.test(directUrl)) {
    return scrapeBarnInPenrose(page, property);
  }

  return scrapeDirectPrice(page, property);
}

await mkdir(generatedDir, { recursive: true });

const properties = JSON.parse(await readFile(outputPath, "utf8"));
const trip = parseTripContext(await readFile(configPath, "utf8"));
const { context, close } = await launchBrowser();

try {
  const page = await context.newPage();

  for (const property of properties) {
    const offers = [buildAirbnbOffer(property)];

    if (property.directBookingUrl) {
      try {
        const snapshot = await collectDirectSnapshot(page, property, trip);
        offers.push(buildDirectOffer(property, snapshot));
        property.directBookingStatus = isPositiveNumber(snapshot.totalStayPrice)
          ? "verified"
          : "likely";
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
