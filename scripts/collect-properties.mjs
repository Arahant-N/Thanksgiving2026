import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

import { chromium } from "playwright-core";

const generatedDir = path.join(process.cwd(), "data", "generated");
const outputPath = path.join(generatedDir, "properties.json");
const browserPath = process.env.PLAYWRIGHT_BROWSER_PATH;
const browserUserDataDir = process.env.BROWSER_USER_DATA_DIR;
const headless = String(process.env.PROPERTY_SCRAPE_HEADLESS || "false").toLowerCase() === "true";
const useSearchDiscovery = String(process.env.PROPERTY_USE_DISCOVERY || "false").toLowerCase() === "true";
const minimumBedrooms = 8;
const minimumBathrooms = 6;
const minimumSleeps = 16;

// Actual headcount for the trip is larger, but Airbnb often hides pricing until the
// guest count is reduced below a listing's soft limit. Use a smaller search party to
// unlock the booking card price first, then rank by room-and-bath fit.
const searchAirbnbGuestBreakdown = {
  adults: 12,
  children: 0,
  infants: 0
};

const actualAirbnbGuestBreakdown = {
  adults: 18,
  children: 6,
  infants: 1
};

function buildAirbnbStayParams(guestBreakdown = searchAirbnbGuestBreakdown) {
  return new URLSearchParams({
    adults: String(guestBreakdown.adults),
    children: String(guestBreakdown.children),
    infants: String(guestBreakdown.infants),
    check_in: "2026-11-25",
    check_out: "2026-11-29"
  }).toString();
}

function withAirbnbDates(url, guestBreakdown = searchAirbnbGuestBreakdown) {
  const airbnbDates = buildAirbnbStayParams(guestBreakdown);
  return url.includes("?") ? `${url}&${airbnbDates}` : `${url}?${airbnbDates}`;
}

const fallbackTargets = [
  {
    url: withAirbnbDates("https://www.airbnb.com/rooms/626836383944715358"),
    areaHint: "Marshall",
    source: "Airbnb",
    fallback: {
      title: "Estate + Spa",
      bedrooms: 8,
      bathrooms: 8,
      sleeps: 20,
      historicSignal: 2,
      highlights: ["Spa retreat", "Large-group layout", "Mountain setting"]
    }
  },
  {
    url: withAirbnbDates("https://www.airbnb.com/rooms/752870280057576598"),
    areaHint: "Swannanoa",
    source: "Airbnb",
    fallback: {
      title: "Willow Ridge Lodging & Events",
      bedrooms: 9,
      bathrooms: 8,
      sleeps: 20,
      historicSignal: 1,
      highlights: ["Events-friendly", "Large group lodging", "Mountain foothills"]
    }
  },
  {
    url: withAirbnbDates("https://www.airbnb.com/rooms/16626189"),
    areaHint: "Asheville",
    source: "Airbnb",
    fallback: {
      title: "Luxury Estate with 8 bedrooms, luxury treehouse",
      bedrooms: 8,
      bathrooms: 9.5,
      sleeps: 21,
      historicSignal: 3,
      highlights: ["Luxury estate", "Private grounds", "Group retreat"]
    }
  },
  {
    url: withAirbnbDates("https://www.airbnb.com/rooms/1596674641314120939"),
    areaHint: "Alexander",
    source: "Airbnb",
    fallback: {
      title: "Home in Alexander",
      bedrooms: 8,
      bathrooms: 7,
      sleeps: 24,
      historicSignal: 2,
      highlights: ["Large-group layout", "Near Asheville", "Family trip fit"]
    }
  },
  {
    url: withAirbnbDates("https://www.airbnb.com/rooms/715897949102965338"),
    areaHint: "Penrose",
    source: "Airbnb",
    fallback: {
      title: "The Grand Lodge with HOT TUB",
      bedrooms: 12,
      bathrooms: 6.5,
      sleeps: 16,
      historicSignal: 2,
      highlights: ["Top guest favorite", "Large-group layout", "Mountain lodge"]
    }
  }
];

const searchAreas = [
  { slug: "Asheville--NC", areaHint: "Asheville" },
  { slug: "Swannanoa--NC", areaHint: "Swannanoa" },
  { slug: "Fletcher--NC", areaHint: "Fletcher" },
  { slug: "Marshall--NC", areaHint: "Marshall" },
  { slug: "Mills-River--NC", areaHint: "Mills River" },
  { slug: "Black-Mountain--NC", areaHint: "Black Mountain" }
];

const areaDistances = {
  Asheville: 6,
  Fletcher: 15,
  Marshall: 25,
  Swannanoa: 12,
  Alexander: 18,
  Penrose: 30,
  "Mills River": 20,
  Skyland: 10,
  Arden: 15,
  Weaverville: 10,
  "Black Mountain": 17
};

function requireValue(name, value) {
  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value;
}

function normalizeText(value) {
  return value.replace(/\u202f/g, " ").replace(/\s+/g, " ").trim();
}

function slug(value) {
  return createHash("sha1").update(value).digest("hex").slice(0, 24);
}

function parseCurrency(text) {
  const matches = [...text.matchAll(/\$([\d,]+(?:\.\d{2})?)/g)].map((match) =>
    Number(match[1].replaceAll(",", ""))
  );

  return matches.find((value) => Number.isFinite(value)) || 0;
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
      return Number(match[1]);
    }
  }

  return 0;
}

function parseRating(text) {
  const match =
    text.match(/Rated\s+(\d\.\d+)/i) ||
    text.match(/(\d\.\d+)\s*(?:out of 5|stars?|average rating)/i);
  return match ? Number(match[1]) : 0;
}

function parseReviewCount(text) {
  const match = text.match(/(\d[\d,]*)\s*reviews?/i);
  return match ? Number(match[1].replaceAll(",", "")) : 0;
}

function parseTotalStayPrice(text) {
  return (
    parseNumber(text, [
      /\$([\d,]+(?:\.\d{2})?)\s+total/i,
      /\$([\d,]+(?:\.\d{2})?)\s+for\s+\d+\s+nights?/i,
      /total\s+before\s+taxes\s*\$([\d,]+(?:\.\d{2})?)/i,
      /for\s+your\s+stay\s*\$([\d,]+(?:\.\d{2})?)/i
    ]) ||
    parseCurrency(text) ||
    0
  );
}

function parseLabeledTotalStayPrice(text) {
  return parseNumber(text, [
    /\$([\d,]+(?:\.\d{2})?)\s+total/i,
    /\$([\d,]+(?:\.\d{2})?)\s+for\s+\d+\s+nights?/i,
    /total\s+before\s+taxes\s*\$([\d,]+(?:\.\d{2})?)/i,
    /for\s+your\s+stay\s*\$([\d,]+(?:\.\d{2})?)/i
  ]);
}

function parseNightlyRate(text) {
  return (
    parseNumber(text, [/\$([\d,]+(?:\.\d{2})?)\s*\/\s*night/i, /\$([\d,]+(?:\.\d{2})?)\s+night/i]) ||
    0
  );
}

function cleanTitle(value, fallbackTitle) {
  const title = value
    .replace(/\s*\|\s*(Airbnb|Vrbo).*$/i, "")
    .replace(/\s*-\s*(Houses?|Villas?|Cabins?|Homes?)\s+for\s+Rent.*$/i, "")
    .trim();

  return title || fallbackTitle;
}

function scoreHistoricSignal(text, baseScore = 0) {
  const signals = [
    [/historic|history|heritage/i, 2],
    [/estate|manor|mansion|inn/i, 1.5],
    [/national register|richard sharp smith|1903|victorian/i, 2.5],
    [/biltmore/i, 1],
    [/downtown condos?|walk downtown/i, -3]
  ];

  return signals.reduce((score, [pattern, points]) => {
    return pattern.test(text) ? score + points : score;
  }, baseScore);
}

function buildSearchUrl(areaSlug) {
  const params = new URLSearchParams({
    checkin: "2026-11-25",
    checkout: "2026-11-29",
    adults: String(searchAirbnbGuestBreakdown.adults),
    children: String(searchAirbnbGuestBreakdown.children),
    infants: String(searchAirbnbGuestBreakdown.infants),
    min_bedrooms: String(minimumBedrooms),
    min_bathrooms: String(minimumBathrooms)
  });

  return `https://www.airbnb.com/s/${areaSlug}/homes?${params.toString()}`;
}

function buildFallbackFromPreview(areaHint, previewText = "") {
  const normalized = normalizeText(previewText);
  const bedrooms =
    parseNumber(normalized, [/\b(\d+)\s+bedrooms?\b/i, /\b(\d+)\s+bedroom\b/i]) || 8;
  const bathrooms = parseNumber(normalized, [/\b(\d+(?:\.\d+)?)\s+baths?\b/i]) || 6;
  const sleeps =
    parseNumber(normalized, [/\b(\d+)\+?\s+guests?\b/i, /\b(?:sleeps?|accommodates?)\s+(\d+)\b/i]) ||
    Math.max(18, bedrooms * 2);

  return {
    title: `Large group stay near ${areaHint}`,
    bedrooms,
    bathrooms,
    sleeps,
    historicSignal: Math.max(1, Math.round(scoreHistoricSignal(normalized, 0))),
    highlights: [
      /historic|estate|manor|lodge|mountain/i.test(normalized)
        ? "Character-rich setting"
        : "Large-group layout",
      /views?|mountain/i.test(normalized) ? "Mountain setting" : "Near Asheville",
      /favorite|rare find|guest favorite/i.test(normalized) ? "High-demand stay" : "Family trip fit"
    ]
  };
}

async function discoverAirbnbCandidates(context) {
  const discovered = [];

  for (const area of searchAreas) {
    const page = await context.newPage();

    try {
      await page.goto(buildSearchUrl(area.slug), {
        waitUntil: "domcontentloaded",
        timeout: 45000
      });
      await dismissOverlays(page);
      await page.waitForTimeout(headless ? 7000 : 5000);

      const areaResults = await page.evaluate((areaHint) => {
        const anchors = [...document.querySelectorAll('a[href*="/rooms/"]')];

        return anchors
          .map((anchor) => {
            const href = anchor instanceof HTMLAnchorElement ? anchor.href : "";
            const container =
              anchor.closest("[itemprop='itemListElement']") ||
              anchor.closest("article") ||
              anchor.parentElement;
            const text = (container?.textContent || anchor.textContent || "").replace(/\s+/g, " ").trim();
            const imageUrl =
              container?.querySelector("img")?.getAttribute("src") ||
              anchor.querySelector("img")?.getAttribute("src") ||
              null;

            return { href, text, imageUrl, areaHint };
          })
          .filter((item) => /\/rooms\/\d+/i.test(item.href));
      }, area.areaHint);

      for (const result of areaResults) {
        const cleanUrl = withAirbnbDates(result.href.split("?")[0]);
        discovered.push({
          url: cleanUrl,
          areaHint: result.areaHint,
          source: "Airbnb",
          previewText: result.text,
          previewImageUrl: result.imageUrl,
          fallback: buildFallbackFromPreview(result.areaHint, result.text)
        });
      }
    } catch (error) {
      console.warn(`Search discovery failed for ${area.slug}: ${String(error)}`);
    } finally {
      await page.close();
    }
  }

  return [...new Map(discovered.map((item) => [slug(item.url), item])).values()].slice(0, 12);
}

function scoreFamilyFit(bedrooms, bathrooms, sleeps) {
  let score = 0;

  if (bedrooms >= 8) score += 4;
  else if (bedrooms >= 7) score += 3;
  else if (bedrooms >= 6) score += 1.5;

  if (bathrooms >= 8) score += 4;
  else if (bathrooms >= 6) score += 3;
  else if (bathrooms >= 5) score += 2;
  else if (bathrooms >= 4) score += 1;

  if (sleeps >= 23) score += 3;
  else if (sleeps >= 20) score += 2;
  else if (sleeps >= 18) score += 1;

  return score;
}

function scoreValue(totalStayPrice) {
  if (!totalStayPrice) {
    return 0;
  }

  if (totalStayPrice <= 7000) return 4;
  if (totalStayPrice <= 9000) return 3;
  if (totalStayPrice <= 11000) return 2;
  if (totalStayPrice <= 14000) return 1;
  return 0;
}

function estimateDistance(areaHint) {
  return areaDistances[areaHint] || 28;
}

function meetsHardRequirements(property) {
  return (
    property.bedrooms >= minimumBedrooms &&
    property.bathrooms >= minimumBathrooms &&
    property.sleeps >= minimumSleeps
  );
}

function normalizeSleeps(parsedSleeps, fallbackSleeps, bedrooms) {
  if (!parsedSleeps) {
    return fallbackSleeps;
  }

  const minimumReasonableSleeps = Math.max(Math.floor(bedrooms * 1.5), Math.floor(fallbackSleeps * 0.6), 8);
  const maximumReasonableSleeps = Math.max(fallbackSleeps * 1.5, bedrooms * 4, 24);

  if (parsedSleeps < minimumReasonableSleeps || parsedSleeps > maximumReasonableSleeps) {
    return fallbackSleeps;
  }

  return parsedSleeps;
}

function detectAvailabilityStatus(text) {
  const unavailablePatterns = [
    /not available for (those|these) dates?/i,
    /those dates are not available/i,
    /those dates are unavailable/i,
    /these dates are not available/i,
    /this place is unavailable/i,
    /this listing is unavailable/i,
    /this place is no longer available/i,
    /sold out/i,
    /booked for your dates/i,
    /try different dates/i,
    /choose different dates/i,
    /no availability/i
  ];
  const availablePatterns = [
    /\breserve\b/i,
    /\bcheck availability\b/i,
    /\baircover\b/i,
    /\bbook now\b/i,
    /\bfor 4 nights\b/i,
    /\$\d[\d,]*(?:\.\d{2})?\s+total/i
  ];

  if (unavailablePatterns.some((pattern) => pattern.test(text))) {
    return "unavailable";
  }

  if (availablePatterns.some((pattern) => pattern.test(text))) {
    return "available";
  }

  return "unknown";
}

function isPlausibleTotalStayPrice(totalStayPrice, bedrooms, bathrooms, sleeps) {
  if (!totalStayPrice) {
    return false;
  }

  if (bedrooms >= 7 || bathrooms >= 5 || sleeps >= 16) {
    return totalStayPrice >= 1500;
  }

  return totalStayPrice >= 400;
}

function isPlausibleNightlyRate(nightlyRate, bedrooms, bathrooms, sleeps) {
  if (!nightlyRate) {
    return false;
  }

  if (bedrooms >= 7 || bathrooms >= 5 || sleeps >= 16) {
    return nightlyRate >= 375;
  }

  return nightlyRate >= 125;
}

function pickBestTotalStayPrice(text, fallbackBedrooms, fallbackBathrooms, fallbackSleeps) {
  const labeledTotal = parseLabeledTotalStayPrice(text);

  if (isPlausibleTotalStayPrice(labeledTotal, fallbackBedrooms, fallbackBathrooms, fallbackSleeps)) {
    return labeledTotal;
  }

  const candidateTotals = collectCurrencyValues(text)
    .filter((value) =>
      isPlausibleTotalStayPrice(value, fallbackBedrooms, fallbackBathrooms, fallbackSleeps)
    )
    .sort((left, right) => left - right);

  return candidateTotals[0] || 0;
}

function getBookableAirbnbGuestCount(guestBreakdown) {
  return guestBreakdown.adults + guestBreakdown.children;
}

function capAirbnbGuestBreakdown(maxBookableGuests, guestBreakdown = actualAirbnbGuestBreakdown) {
  let adults = guestBreakdown.adults;
  let children = guestBreakdown.children;
  const infants = guestBreakdown.infants;

  while (adults + children > maxBookableGuests && children > 0) {
    children -= 1;
  }

  while (adults + children > maxBookableGuests && adults > 1) {
    adults -= 1;
  }

  return { adults, children, infants };
}

function buildAirbnbGuestBreakdownVariants(maxBookableGuests) {
  const cappedGuests = Math.max(
    1,
    Math.min(maxBookableGuests, getBookableAirbnbGuestCount(actualAirbnbGuestBreakdown))
  );
  const variants = [
    capAirbnbGuestBreakdown(cappedGuests, searchAirbnbGuestBreakdown),
    capAirbnbGuestBreakdown(cappedGuests, {
      adults: Math.min(cappedGuests, 8),
      children: 0,
      infants: 0
    }),
    capAirbnbGuestBreakdown(cappedGuests, {
      ...actualAirbnbGuestBreakdown,
      infants: 0
    })
  ];

  return [...new Map(variants.map((item) => [JSON.stringify(item), item])).values()];
}

function normalizePricing({ totalStayPrice, nightlyRate, bedrooms, bathrooms, sleeps }) {
  const validTotal = isPlausibleTotalStayPrice(totalStayPrice, bedrooms, bathrooms, sleeps)
    ? totalStayPrice
    : 0;
  const validNightly = isPlausibleNightlyRate(nightlyRate, bedrooms, bathrooms, sleeps)
    ? nightlyRate
    : 0;

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

function buildSummary(property) {
  if ((property.historicSignal || 0) >= 5) {
    return "Best historic-character pick for the group, with the strongest sense of place outside downtown.";
  }

  if ((property.valueScore || 0) >= 3) {
    return "Best value among the stronger large-group fits, with enough scale for a cousin-trip basecamp.";
  }

  if ((property.familyFitScore || 0) >= 9) {
    return "Strong operational fit for six families, with the best room-and-bath layout in the shortlist.";
  }

  return "Worth keeping in the shortlist for a larger family stay within an easy drive of Asheville.";
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

async function extractPricingText(page, source) {
  const selectors =
    source === "Airbnb"
      ? [
          '[data-section-id="BOOK_IT_SIDEBAR"]',
          '[data-plugin-in-point-id*="BOOK_IT"]',
          '[data-testid="book-it-default"]',
          "aside"
        ]
      : ["aside", '[data-testid*="price"]'];

  const blocks = [];

  for (const selector of selectors) {
    try {
      const locator = page.locator(selector).first();
      const text = await locator.innerText({ timeout: 1500 }).catch(() => "");
      if (text) {
        blocks.push(text);
      }
    } catch {
      // Best effort only.
    }
  }

  return normalizeText(blocks.join("\n"));
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

async function scrapeTarget(context, target) {
  const page = await context.newPage();

  try {
    const listingUrl = target.url.split("?")[0];

    async function visit(url) {
      await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 20000
      });
      await dismissOverlays(page);
      await page.waitForTimeout(headless ? 2000 : 4000);
    }

    async function collectSnapshot(url) {
      await visit(url);

      const titleTag = await page.locator("title").textContent().catch(() => "");
      const ogTitle = await page
        .locator('meta[property="og:title"]')
        .getAttribute("content")
        .catch(() => null);
      const ogDescription = await page
        .locator('meta[property="og:description"]')
        .getAttribute("content")
        .catch(() => null);
      const metaDescription = await page
        .locator('meta[name="description"]')
        .getAttribute("content")
        .catch(() => null);
      let imageUrl = await page
        .locator('meta[property="og:image"]')
        .getAttribute("content")
        .catch(() => null);
      if (!imageUrl) {
        imageUrl =
          target.previewImageUrl ||
          (await page.locator("img").first().getAttribute("src").catch(() => null));
      }
      const bodyText = await page.locator("body").innerText().catch(() => "");
      const pricingText = await extractPricingText(page, target.source);
      const combinedText = normalizeText(
        [ogTitle, titleTag, ogDescription, metaDescription, bodyText].filter(Boolean).join("\n")
      );

      const title = cleanTitle(ogTitle || titleTag || target.fallback.title, target.fallback.title);
      const bedrooms =
        parseNumber(combinedText, [/\b(\d+)\s+bedrooms?\b/i, /\b(\d+)\s*BR\b/i]) ||
        target.fallback.bedrooms;
      const bathrooms =
        parseNumber(combinedText, [/\b(\d+(?:\.\d+)?)\s+baths?\b/i]) || target.fallback.bathrooms;
      const parsedSleeps = parseNumber(combinedText, [
        /\b(?:sleeps?|accommodates?)\s+(\d+)\b/i,
        /\b(\d+)\s+guests?\b/i
      ]);
      const sleeps = normalizeSleeps(parsedSleeps, target.fallback.sleeps, bedrooms);
      const pricingSourceText = pricingText || combinedText;
      const labeledTotalStayPrice = parseLabeledTotalStayPrice(pricingSourceText);
      const pricing = normalizePricing({
        totalStayPrice: pickBestTotalStayPrice(
          pricingSourceText,
          bedrooms || target.fallback.bedrooms,
          bathrooms || target.fallback.bathrooms,
          sleeps || target.fallback.sleeps
        ),
        nightlyRate: parseNightlyRate(pricingSourceText),
        bedrooms,
        bathrooms,
        sleeps
      });

      return {
        url,
        imageUrl,
        combinedText,
        pricingText: pricingSourceText,
        title,
        bedrooms,
        bathrooms,
        sleeps,
        labeledTotalStayPrice,
        totalStayPrice: pricing.totalStayPrice,
        nightlyRate: pricing.nightlyRate
      };
    }

    const initialSnapshot = await collectSnapshot(target.url);
    let chosenSnapshot = initialSnapshot;

    if (target.source === "Airbnb") {
      const fullGuestCount = getBookableAirbnbGuestCount(actualAirbnbGuestBreakdown);
      const maxBookableGuests = Math.max(1, Math.min(initialSnapshot.sleeps || target.fallback.sleeps, fullGuestCount));
      const shouldRetryWithReducedGuests =
        !initialSnapshot.labeledTotalStayPrice ||
        initialSnapshot.totalStayPrice === 0 ||
        fullGuestCount > maxBookableGuests;

      if (shouldRetryWithReducedGuests) {
        const guestVariants = buildAirbnbGuestBreakdownVariants(maxBookableGuests);

        for (const guestBreakdown of guestVariants.slice(1)) {
          const candidateSnapshot = await collectSnapshot(withAirbnbDates(listingUrl, guestBreakdown));

          if (
            candidateSnapshot.labeledTotalStayPrice &&
            detectAvailabilityStatus(candidateSnapshot.combinedText) !== "unavailable"
          ) {
            chosenSnapshot = candidateSnapshot;
            break;
          }

          if (
            !chosenSnapshot.labeledTotalStayPrice &&
            candidateSnapshot.totalStayPrice > chosenSnapshot.totalStayPrice
          ) {
            chosenSnapshot = candidateSnapshot;
          }
        }
      }
    }

    const combinedText = chosenSnapshot.combinedText;
    const title = chosenSnapshot.title;
    const bedrooms = chosenSnapshot.bedrooms;
    const bathrooms = chosenSnapshot.bathrooms;
    const sleeps = chosenSnapshot.sleeps;
    const imageUrl = chosenSnapshot.imageUrl;
    let totalStayPrice = chosenSnapshot.totalStayPrice;
    let nightlyRate = chosenSnapshot.nightlyRate;

    if (target.source === "Airbnb" && !chosenSnapshot.labeledTotalStayPrice) {
      totalStayPrice = 0;
      nightlyRate = 0;
    }

    const rating = parseRating(combinedText);
    const reviewCount = parseReviewCount(combinedText);
    const distanceFromAshevilleMiles = estimateDistance(target.areaHint);
    const availabilityStatus = detectAvailabilityStatus(combinedText);
    const historicSignal = scoreHistoricSignal(combinedText, target.fallback.historicSignal || 0);
    const familyFitScore = scoreFamilyFit(bedrooms, bathrooms, sleeps);
    const valueScore = scoreValue(totalStayPrice);
    const reviewScore =
      (rating ? Math.min(rating, 5) : 0) + Math.min(reviewCount / 20, 3) + (sleeps >= 20 ? 1 : 0);
    const recommendationScore = Number(
      (historicSignal * 1.8 + familyFitScore * 1.4 + valueScore * 1.2 + reviewScore).toFixed(2)
    );
    const highlights = [...new Set(target.fallback.highlights)].slice(0, 3);

    return {
      id: slug(listingUrl),
      title,
      source: target.source,
      bedrooms,
      bathrooms,
      sleeps,
      nightlyRate,
      totalStayPrice,
      rating,
      reviewCount,
      distanceToDowntownMiles: distanceFromAshevilleMiles,
      distanceFromAshevilleMiles,
      area: target.areaHint,
      imageUrl,
      recommendationScore,
      historicSignal,
      familyFitScore,
      valueScore,
      availabilityStatus,
      recommendationSummary: "",
      recommendationTag: null,
      highlights,
      url: chosenSnapshot.url
    };
  } finally {
    await page.close();
  }
}

async function scrapeProperties() {
  const { context, close } = await launchBrowser();

  try {
    const discoveredTargets = useSearchDiscovery ? await discoverAirbnbCandidates(context) : [];
    const activeTargets =
      discoveredTargets.length > 0
        ? [
            ...discoveredTargets,
            ...fallbackTargets.filter((target) => target.source !== "Airbnb")
          ]
        : fallbackTargets;
    const collected = [];

    for (const target of activeTargets) {
      try {
        const property = await scrapeTarget(context, target);
        if (
          meetsHardRequirements(property) &&
          property.distanceFromAshevilleMiles <= 30 &&
          property.availabilityStatus !== "unavailable"
        ) {
          collected.push(property);
        }
      } catch (error) {
        console.warn(`Skipping property ${target.url}: ${String(error)}`);
      }
    }

    const uniqueProperties = [...new Map(collected.map((item) => [item.id, item])).values()]
      .sort((left, right) => {
        if ((right.recommendationScore || 0) !== (left.recommendationScore || 0)) {
          return (right.recommendationScore || 0) - (left.recommendationScore || 0);
        }

        if (left.availabilityStatus !== right.availabilityStatus) {
          return left.availabilityStatus === "available" ? -1 : 1;
        }

        if (left.totalStayPrice && right.totalStayPrice) {
          return left.totalStayPrice - right.totalStayPrice;
        }

        return right.reviewCount - left.reviewCount;
      })
      .slice(0, 7);

    const hero = uniqueProperties[0];
    const budget = [...uniqueProperties]
      .filter(
        (property) =>
          property.id !== hero?.id &&
          (property.historicSignal || 0) >= 2 &&
          property.sleeps >= 18 &&
          isPlausibleTotalStayPrice(
            property.totalStayPrice,
            property.bedrooms,
            property.bathrooms,
            property.sleeps
          )
      )
      .sort((left, right) => left.totalStayPrice - right.totalStayPrice)[0];

    return uniqueProperties.map((property) => ({
      ...property,
      recommendationTag:
        property.id === hero?.id
          ? "Hero pick"
          : property.id === budget?.id
            ? "Budget pick"
            : null,
      recommendationSummary:
        property.id === hero?.id
          ? "Best overall fit for the family’s new brief: a memorable large-group home with the strongest balance of character, scale, and setting."
          : property.id === budget?.id
            ? "Best lower-cost recommendation that still fits the family’s preference for a larger, character-rich home outside downtown."
            : buildSummary(property)
    }));
  } finally {
    await close();
  }
}

await mkdir(generatedDir, { recursive: true });
const properties = await scrapeProperties();
await writeFile(outputPath, JSON.stringify(properties, null, 2));
console.log(`Property scraper wrote ${properties.length} recommendations near Asheville.`);
