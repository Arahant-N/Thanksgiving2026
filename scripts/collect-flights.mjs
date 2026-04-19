import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { chromium } from "playwright-core";

const generatedDir = path.join(process.cwd(), "data", "generated");
const outputPath = path.join(generatedDir, "flights.json");
const debugDir = path.join(generatedDir, "flight-debug");
const checkInDate = "2026-11-25";
const checkOutDate = "2026-11-29";
const browserPath = process.env.PLAYWRIGHT_BROWSER_PATH;
const browserUserDataDir = process.env.BROWSER_USER_DATA_DIR;
const headless = String(process.env.FLIGHT_SCRAPE_HEADLESS || "false").toLowerCase() === "true";
const slotScope = String(process.env.FLIGHT_SLOT_SCOPE || "all").toLowerCase();
const stopScope = String(process.env.FLIGHT_STOP_SCOPE || "all").toLowerCase();
const retryAttempts = Number(process.env.FLIGHT_RETRY_ATTEMPTS || 2);
const originFilter = String(process.env.FLIGHT_ORIGIN_FILTER || "").trim().toUpperCase();
const debugMode = String(process.env.FLIGHT_DEBUG || "false").toLowerCase() === "true";
const airportSearchLabels = {
  DTW: "Detroit",
  SFO: "San Francisco",
  OAK: "Oakland",
  SEA: "Seattle",
  ORD: "Chicago O'Hare",
  SJC: "San Jose"
};

const families = [
  { id: "kumaran", airportCode: "DTW", travelers: 4 },
  { id: "chandrasekaran", airportCode: "SFO", travelers: 4 },
  { id: "vaithilingam", airportCode: "OAK", travelers: 4 },
  { id: "ajagane", airportCode: "SFO", travelers: 3 },
  { id: "venkatesan-i", airportCode: "SEA", travelers: 4 },
  { id: "venkatesan-ii", airportCode: "ORD", travelers: 4 },
  { id: "aravind-keerthana", airportCode: "SJC", travelers: 2 }
];

const allSlots = [
  { cabin: "Economy", stops: "Nonstop" },
  { cabin: "Economy", stops: "1-stop" },
  { cabin: "Economy Plus", stops: "Nonstop" },
  { cabin: "Economy Plus", stops: "1-stop" }
];

const slots =
  allSlots.filter((slot) => {
    const cabinMatch = slotScope === "economy" ? slot.cabin === "Economy" : true;
    const stopMatch =
      stopScope === "1-stop"
        ? slot.stops === "1-stop"
        : stopScope === "nonstop"
          ? slot.stops === "Nonstop"
          : true;

    return cabinMatch && stopMatch;
  });

function requireValue(name, value) {
  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value;
}

function normalizeText(value) {
  return value.replace(/\u202f/g, " ").replace(/\s+/g, " ").trim();
}

function parseCurrency(text) {
  const match = text.match(/\$([\d,]+)/);
  return match ? Number(match[1].replaceAll(",", "")) : 0;
}

function parseCard(cardText) {
  const lines = cardText
    .split("\n")
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value) => value !== "–" && value !== "round trip" && value !== "1" && value !== "0");

  const price = parseCurrency(cardText);
  const departTime = lines[0] || "";
  const arriveTime = lines[1] || "";
  const carrierLabel = lines[2] || "Google Flights";
  const durationLabel = lines.find((line) => /\d+\s*hr/.test(line)) || "See itinerary";
  const routeLabel = lines.find((line) => /^[A-Z]{3}–[A-Z]{3}$/.test(line)) || "";
  const stopLine =
    lines.find((line) => /nonstop|1 stop|2 stops|3 stops/i.test(line)) || "See itinerary";
  const layoverLine =
    lines.find((line) => /\b[A-Z]{3}\b/.test(line) && /\d+\s*(?:hr|min)/i.test(line)) || "";

  return {
    price,
    departTime,
    arriveTime,
    carrierLabel: normalizeText(carrierLabel),
    durationLabel: normalizeText(durationLabel),
    routeLabel: normalizeText(routeLabel),
    stopLine: normalizeText(stopLine),
    layoverLine: normalizeText(layoverLine)
  };
}

function matchesRequestedStops(cardText, requestedStops) {
  const text = normalizeText(cardText).toLowerCase();

  if (requestedStops === "Nonstop") {
    return text.includes("nonstop");
  }

  return text.includes("1 stop");
}

function buildGoogleFlightsUrl(origin, cabin, stops) {
  const cabinQuery = cabin === "Economy Plus" ? "premium economy" : "economy";
  const stopQuery = stops === "Nonstop" ? "nonstop" : "1 stop";
  const originQuery = airportSearchLabels[origin] || origin;
  const query = encodeURIComponent(
    `Round trip flights from ${originQuery} to Asheville departing ${checkInDate} returning ${checkOutDate} ${cabinQuery} ${stopQuery}`
  );

  return `https://www.google.com/travel/flights?q=${query}`;
}

function getOriginGroups() {
  const groups = new Map();

  for (const family of families) {
    const existing = groups.get(family.airportCode);
    if (existing) {
      existing.familyIds.push(family.id);
      continue;
    }

    groups.set(family.airportCode, {
      airportCode: family.airportCode,
      familyIds: [family.id]
    });
  }

  return [...groups.values()].filter((group) =>
    originFilter ? group.airportCode === originFilter : true
  );
}

async function writeDebugSnapshot(page, airportCode, cabin, stops) {
  if (!debugMode) {
    return;
  }

  await mkdir(debugDir, { recursive: true });
  const slug = `${airportCode}-${cabin}-${stops}`.replace(/\s+/g, "-").toLowerCase();
  const bodyText = await page.locator("body").innerText().catch(() => "");
  const html = await page.content().catch(() => "");

  await writeFile(path.join(debugDir, `${slug}.txt`), bodyText);
  await writeFile(path.join(debugDir, `${slug}.html`), html);
  await page.screenshot({
    path: path.join(debugDir, `${slug}.png`),
    fullPage: true
  }).catch(() => {});
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
      viewport: { width: 1440, height: 1800 }
    });
    return { context, close: () => context.close() };
  }

  const browser = await chromium.launch({
    executablePath,
    headless
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1800 }
  });
  return { context, close: () => browser.close() };
}

async function waitForResults(page) {
  await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
  await page.locator("div.KhL0De").first().waitFor({ timeout: 12000 }).catch(() => {});
  await page.waitForTimeout(headless ? 5000 : 4000);
}

async function extractCards(page) {
  const texts = await page
    .locator("div.KhL0De")
    .evaluateAll((nodes) => nodes.map((node, index) => ({ index, text: node.innerText || "" })));

  return texts
    .map((item) => ({
      ...item,
      parsed: parseCard(item.text)
    }))
    .filter((item) => item.parsed.price > 0);
}

async function pickCheapestCard(page, requestedStops) {
  const cards = (await extractCards(page)).filter((item) =>
    matchesRequestedStops(item.text, requestedStops)
  );

  if (cards.length === 0) {
    return null;
  }

  return [...cards].sort((left, right) => left.parsed.price - right.parsed.price)[0];
}

async function clickCardByIndex(page, index) {
  await page.locator("div.KhL0De").nth(index).click({ timeout: 10000 });
  await page.waitForTimeout(4000);
}

async function buildBaseOffer(page, airportCode, cabin, stops) {
  const searchUrl = buildGoogleFlightsUrl(airportCode, cabin, stops);
  await page.goto(searchUrl, {
    waitUntil: "domcontentloaded",
    timeout: 45000
  });
  await waitForResults(page);

  const outbound = await pickCheapestCard(page, stops);
  if (!outbound) {
    return null;
  }

  await clickCardByIndex(page, outbound.index);

  const inbound = await pickCheapestCard(page, stops);
  if (!inbound) {
    return {
      id: `${airportCode}-${cabin}-${stops}`,
      familyId: "",
      cabin,
      stops,
      totalPrice: Number(outbound.parsed.price.toFixed(2)),
      perTravelerPrice: Number(outbound.parsed.price.toFixed(2)),
      carrierLabel: outbound.parsed.carrierLabel,
      durationLabel: outbound.parsed.durationLabel,
      departSummary: `${airportCode} ${outbound.parsed.departTime} -> AVL ${outbound.parsed.arriveTime}`,
      returnSummary: `AVL -> ${airportCode}`,
      bookingUrl: page.url(),
      sourceLabel: "Google Flights live scrape"
    };
  }

  await clickCardByIndex(page, inbound.index);

  const bookingPageText = await page.locator("body").innerText();
  const finalPrice = parseCurrency(bookingPageText) || outbound.parsed.price;
  const bookingCarrier =
    bookingPageText.match(/Book with\s+([A-Za-z0-9 +/&.-]+)/)?.[1]?.trim() ||
    outbound.parsed.carrierLabel;

  return {
    id: `${airportCode}-${cabin}-${stops}`,
    familyId: "",
    cabin,
    stops,
    totalPrice: Number(finalPrice.toFixed(2)),
    perTravelerPrice: Number(finalPrice.toFixed(2)),
    carrierLabel: bookingCarrier,
    durationLabel: outbound.parsed.durationLabel,
    departSummary: `${airportCode} ${outbound.parsed.departTime} -> AVL ${outbound.parsed.arriveTime}`,
    returnSummary: `AVL ${inbound.parsed.departTime} -> ${airportCode} ${inbound.parsed.arriveTime}`,
    bookingUrl: page.url(),
    sourceLabel: "Google Flights live scrape"
  };
}

function materializeOffer(baseOffer, family) {
  return {
    ...baseOffer,
    id: `${family.id}-${baseOffer.cabin}-${baseOffer.stops}`,
    familyId: family.id,
    totalPrice: Number((baseOffer.perTravelerPrice * family.travelers).toFixed(2))
  };
}

async function buildOfferWithRetries(page, airportCode, cabin, stops, attempts = retryAttempts) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const offer = await buildBaseOffer(page, airportCode, cabin, stops);
      if (offer) {
        return offer;
      }
    } catch (error) {
      console.warn(
        `Attempt ${attempt} failed for ${airportCode} ${cabin} ${stops}: ${String(error)}`
      );
    }

    await page.waitForTimeout(2500 * attempt);
  }

  await writeDebugSnapshot(page, airportCode, cabin, stops);
  return null;
}

async function collectOffers() {
  const { context, close } = await launchBrowser();

  try {
    const page = await context.newPage();
    const offers = [];
    const originGroups = getOriginGroups();

    for (const originGroup of originGroups) {
      for (const slot of slots) {
        console.log(`Collecting ${originGroup.airportCode} ${slot.cabin} ${slot.stops}...`);
        const baseOffer = await buildOfferWithRetries(
          page,
          originGroup.airportCode,
          slot.cabin,
          slot.stops
        );

        if (!baseOffer) {
          console.warn(`No live fare captured for ${originGroup.airportCode} ${slot.cabin} ${slot.stops}.`);
          continue;
        }

        for (const familyId of originGroup.familyIds) {
          const family = families.find((candidate) => candidate.id === familyId);
          if (!family) {
            continue;
          }

          offers.push(materializeOffer(baseOffer, family));
        }
      }
    }

    await page.close();
    return offers;
  } finally {
    await close();
  }
}

async function readExistingOffers() {
  try {
    const raw = await readFile(outputPath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function mergeOffers(existingOffers, newOffers) {
  const merged = new Map(existingOffers.map((offer) => [offer.id, offer]));

  for (const offer of newOffers) {
    merged.set(offer.id, offer);
  }

  return [...merged.values()].sort((left, right) => left.id.localeCompare(right.id));
}

await mkdir(generatedDir, { recursive: true });
const existingOffers = await readExistingOffers();
const offers = await collectOffers();
const mergedOffers = mergeOffers(existingOffers, offers);
await writeFile(outputPath, JSON.stringify(mergedOffers, null, 2));
console.log(
  `Flight collector wrote ${offers.length} offers and saved ${mergedOffers.length} total.${headless ? " Headless mode may miss some results on Google Flights." : ""}`
);
