import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

import { chromium } from "playwright-core";

const generatedDir = path.join(process.cwd(), "data", "generated");
const outputPath = path.join(generatedDir, "restaurants.json");
const browserPath = process.env.PLAYWRIGHT_BROWSER_PATH;
const browserUserDataDir = process.env.BROWSER_USER_DATA_DIR;
const headless = String(process.env.RESTAURANT_SCRAPE_HEADLESS || "false").toLowerCase() === "true";

const SEARCH_TERMS = [
  "South Indian restaurant Asheville NC",
  "Tamil restaurant Asheville NC",
  "Dosa Asheville NC",
  "Chettinad restaurant Asheville NC",
  "Indian restaurant Asheville NC"
];

const SOUTH_KEYWORDS = [
  "south indian",
  "tamil",
  "tamizh",
  "dosa",
  "dosai",
  "udupi",
  "chettinad",
  "idli",
  "vada",
  "sambar",
  "kerala",
  "andhra"
];

const TAMIL_PRIORITY_KEYWORDS = ["tamil", "tamizh", "chettinad"];
const SOUTH_PRIORITY_KEYWORDS = [
  "south indian",
  "dosa",
  "dosai",
  "idli",
  "vada",
  "sambar",
  "udupi",
  "kerala",
  "andhra"
];
const DEPRIORITIZE_KEYWORDS = [
  "modern indian",
  "street food",
  "tandoori",
  "buffet",
  "bar"
];
const WEBSITE_CUISINE_KEYWORDS = [
  "south indian",
  "tamil",
  "tamizh",
  "chettinad",
  "dosa",
  "dosai",
  "idli",
  "vada",
  "sambar",
  "rasam",
  "uttapam",
  "uthappam",
  "pongal",
  "filter coffee",
  "podi",
  "kerala",
  "andhra",
  "udupi"
];

const downtownAsheville = {
  lat: 35.5951,
  lng: -82.5515
};
const MAX_RESTAURANT_DISTANCE_MILES = 12;

function requireValue(name, value) {
  if (!value) {
    throw new Error(`${name} is required for live collection.`);
  }

  return value;
}

function slug(value) {
  return createHash("sha1").update(value).digest("hex").slice(0, 24);
}

function normalizeText(value) {
  return value.replace(/\u202f/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeRestaurantName(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/\basheville\b/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseRating(text) {
  const match = text.match(/\b(\d\.\d)\b/);
  return match ? Number(match[1]) : 0;
}

function parseCoordsFromMapUrl(url) {
  const match = url.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if (!match) {
    return null;
  }

  return {
    lat: Number(match[1]),
    lng: Number(match[2])
  };
}

function toMiles(valueInKm) {
  return valueInKm * 0.621371;
}

function calculateDistanceMiles(from, to) {
  const earthRadiusKm = 6371;
  const dLat = ((to.lat - from.lat) * Math.PI) / 180;
  const dLng = ((to.lng - from.lng) * Math.PI) / 180;
  const lat1 = (from.lat * Math.PI) / 180;
  const lat2 = (to.lat * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);

  return Number((toMiles(earthRadiusKm * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))))).toFixed(1));
}

function getFocusScore(candidate) {
  const joined = `${candidate.name} ${candidate.previewText} ${candidate.matchedTerms.join(" ")}`.toLowerCase();

  return SOUTH_KEYWORDS.reduce((score, keyword) => {
    return joined.includes(keyword) ? score + 10 : score;
  }, 0);
}

function getTamilPreferenceScore(candidate) {
  const joined = `${candidate.name} ${candidate.previewText} ${candidate.matchedTerms.join(" ")}`.toLowerCase();

  const tamilScore = TAMIL_PRIORITY_KEYWORDS.reduce(
    (score, keyword) => score + (joined.includes(keyword) ? 30 : 0),
    0
  );
  const southScore = SOUTH_PRIORITY_KEYWORDS.reduce(
    (score, keyword) => score + (joined.includes(keyword) ? 14 : 0),
    0
  );
  const penalty = DEPRIORITIZE_KEYWORDS.reduce(
    (score, keyword) => score + (joined.includes(keyword) ? 8 : 0),
    0
  );

  return tamilScore + southScore - penalty;
}

function getTamilPreferenceScoreFromText(text) {
  const joined = normalizeText(text).toLowerCase();

  const tamilScore = TAMIL_PRIORITY_KEYWORDS.reduce(
    (score, keyword) => score + (joined.includes(keyword) ? 38 : 0),
    0
  );
  const southScore = SOUTH_PRIORITY_KEYWORDS.reduce(
    (score, keyword) => score + (joined.includes(keyword) ? 18 : 0),
    0
  );
  const websiteBoost = WEBSITE_CUISINE_KEYWORDS.reduce(
    (score, keyword) => score + (joined.includes(keyword) ? 6 : 0),
    0
  );
  const penalty = DEPRIORITIZE_KEYWORDS.reduce(
    (score, keyword) => score + (joined.includes(keyword) ? 10 : 0),
    0
  );

  return tamilScore + southScore + websiteBoost - penalty;
}

function buildSearchUrl(term) {
  return `https://www.google.com/maps/search/${encodeURIComponent(term)}`;
}

function parseDescriptor(previewText, name) {
  const normalized = normalizeText(previewText).replace(name, "").trim();
  const match = normalized.match(/\d\.\d\s*([^·]+?)\s*·/);
  const descriptor = match ? normalizeText(match[1]) : "Indian restaurant";

  if (!descriptor || /\(\d[\d,]*\)/.test(descriptor) || /\d/.test(descriptor)) {
    return "Indian restaurant";
  }

  return descriptor;
}

function parseShortNote(previewText, name) {
  const normalized = normalizeText(previewText);
  const withoutPrefix = normalized.replace(new RegExp(`^${escapeRegex(name)}\\s+\\d\\.\\d`, "i"), "").trim();
  const segments = withoutPrefix
    .split(/Closed|Opens soon|Opens|Temporarily closed|Order online|Reserve a table/i)
    .map((segment) => normalizeText(segment))
    .filter(Boolean);

  if (segments.length === 0) {
    return "";
  }

  const lastSegment = segments[0].split("·").map((segment) => normalizeText(segment)).filter(Boolean).at(-1);
  if (!lastSegment || lastSegment.length < 6 || /^re$/i.test(lastSegment)) {
    return "";
  }

  return !/indian restaurant|modern indian restaurant|restaurant/i.test(lastSegment)
    ? lastSegment
    : "";
}

function parseAddress(bodyText) {
  const addressMatch =
    bodyText.match(/\b\d{1,5}[^,\n]+,\s*Asheville,\s*NC\s*\d{5}\b/i) ||
    bodyText.match(/\b\d{1,5}[^,\n]+,\s*(?:Arden|Fletcher|Swannanoa|Weaverville|Black Mountain),\s*NC\s*\d{5}\b/i);

  return addressMatch ? normalizeText(addressMatch[0]) : "";
}

function parseWebsiteUrl(bodyText) {
  const domains = [...bodyText.matchAll(/\b(?:https?:\/\/)?(?:www\.)?([a-z0-9-]+\.(?:com|net|org|co|io|biz))\b/gi)]
    .map((match) => match[1].toLowerCase())
    .filter((domain) => !["google.com", "g.page", "opentable.com"].includes(domain));

  const uniqueDomain = [...new Set(domains)][0];
  return uniqueDomain ? `https://${uniqueDomain}` : null;
}

function getWebsiteDomain(url) {
  try {
    const target = new URL(url);
    return target.hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return "";
  }
}

function resolveImageUrl(baseUrl, candidateUrl) {
  if (!candidateUrl) {
    return null;
  }

  try {
    return new URL(candidateUrl, baseUrl).toString();
  } catch {
    return null;
  }
}

function isUsableRestaurantImage(url) {
  if (!url) {
    return false;
  }

  const normalized = url.toLowerCase();

  if (normalized.includes("userway")) {
    return false;
  }

  if (normalized.endsWith(".svg")) {
    return false;
  }

  return /^https?:\/\//i.test(url);
}

function isThirdPartyListingDomain(domain) {
  return [
    "singleplatform.com",
    "grubhub.com",
    "doordash.com",
    "ubereats.com",
    "opentable.com",
    "google.com"
  ].includes(domain);
}

function parseReviewCount(bodyText) {
  const counts = [...bodyText.matchAll(/\(([\d,]+)\)/g)]
    .map((match) => Number(match[1].replaceAll(",", "")))
    .filter((value) => Number.isFinite(value) && value >= 20 && value <= 10000);

  return counts[0] || 0;
}

function buildCuisineTags(candidate, descriptor) {
  const joined = `${candidate.name} ${descriptor} ${candidate.previewText}`.toLowerCase();
  const tags = [];

  if (/south indian|dosa|idli|vada|sambar|udupi/.test(joined)) tags.push("South Indian");
  if (/tamil|tamizh|chettinad/.test(joined)) tags.push("Tamil / Chettinad");
  if (/modern indian/.test(joined)) tags.push("Modern Indian");
  if (/street food/.test(joined)) tags.push("Indian Street Food");
  if (tags.length === 0) tags.push(descriptor);
  if (!tags.some((tag) => /Indian/i.test(tag))) tags.push("Indian");

  return tags.slice(0, 4);
}

function buildCuisineTagsFromSignals(candidate, descriptor, websiteCuisineText) {
  const joined =
    `${candidate.name} ${descriptor} ${candidate.previewText} ${websiteCuisineText}`.toLowerCase();
  const tags = [];

  if (/tamil|tamizh|chettinad/.test(joined)) tags.push("Tamil / Chettinad");
  if (/south indian|dosa|dosai|idli|vada|sambar|rasam|uttapam|uthappam|udupi|filter coffee/.test(joined)) {
    tags.push("South Indian");
  }
  if (/andhra/.test(joined)) tags.push("Andhra");
  if (/kerala/.test(joined)) tags.push("Kerala");
  if (/modern indian/.test(joined)) tags.push("Modern Indian");
  if (/street food/.test(joined)) tags.push("Indian Street Food");
  if (tags.length === 0) {
    return buildCuisineTags(candidate, descriptor);
  }
  if (!tags.some((tag) => /Indian/i.test(tag))) {
    tags.push("Indian");
  }

  return [...new Set(tags)].slice(0, 4);
}

function getCuisinePriority(candidate) {
  const joined = `${candidate.cuisineTags.join(" ")} ${candidate.notes || ""}`.toLowerCase();

  if (/tamil|tamizh|chettinad/.test(joined)) {
    return 3;
  }

  if (/south indian|andhra|kerala/.test(joined)) {
    return 2;
  }

  if (/dosa|dosai|idli|vada|sambar|rasam|uttapam|uthappam|filter coffee/.test(joined)) {
    return 1;
  }

  return 0;
}

async function extractWebsiteCuisineText(page) {
  return normalizeText(
    await page.evaluate(() => {
      const title = document.title || "";
      const metaDescription =
        document.querySelector('meta[name="description"]')?.getAttribute("content") || "";
      const metaKeywords =
        document.querySelector('meta[name="keywords"]')?.getAttribute("content") || "";
      const headings = [...document.querySelectorAll("h1, h2, h3")]
        .slice(0, 20)
        .map((node) => node.textContent || "")
        .join(" ");
      const menuLinks = [...document.querySelectorAll("a")]
        .map((node) => `${node.textContent || ""} ${node.getAttribute("href") || ""}`)
        .filter((value) => /menu|dosa|idli|vada|chettinad|south indian|tamil|tamizh/i.test(value))
        .slice(0, 20)
        .join(" ");
      const body = document.body?.innerText?.slice(0, 8000) || "";

      return `${title} ${metaDescription} ${metaKeywords} ${headings} ${menuLinks} ${body}`;
    }).catch(() => "")
  );
}

async function dismissOverlays(page) {
  for (const label of ["Accept all", "Accept", "I agree", "Got it", "Reject all"]) {
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

async function discoverCandidates(context) {
  const discovered = new Map();

  for (const term of SEARCH_TERMS) {
    const page = await context.newPage();

    try {
      await page.goto(buildSearchUrl(term), {
        waitUntil: "domcontentloaded",
        timeout: 45000
      });
      await dismissOverlays(page);
      await page.waitForTimeout(headless ? 7000 : 5000);

      const results = await page.evaluate(() =>
        [...document.querySelectorAll('a[href*="/maps/place/"]')]
          .slice(0, 12)
          .map((anchor) => {
            const container =
              anchor.closest('[role="article"]') ||
              anchor.parentElement?.parentElement ||
              anchor.parentElement;

            return {
              name: anchor.getAttribute("aria-label") || "",
              href: anchor.href,
              previewText: (container?.textContent || "").replace(/\s+/g, " ").trim(),
              previewImageUrl:
                container?.querySelector("img")?.getAttribute("src") ||
                anchor.querySelector("img")?.getAttribute("src") ||
                null
            };
          })
          .filter((result) => result.name && result.href)
      );

      for (const result of results) {
        const key = slug(result.href.split("?")[0]);
        const existing = discovered.get(key);

        if (existing) {
          existing.matchedTerms.add(term);
          existing.previewText = existing.previewText.length >= result.previewText.length
            ? existing.previewText
            : result.previewText;
          continue;
        }

        discovered.set(key, {
          ...result,
          matchedTerms: new Set([term])
        });
      }
    } catch (error) {
      console.warn(`Skipping restaurant search term "${term}": ${String(error)}`);
    } finally {
      await page.close();
    }
  }

  return [...discovered.values()].map((candidate) => ({
    ...candidate,
    matchedTerms: [...candidate.matchedTerms]
  }));
}

async function enrichCandidate(context, candidate) {
  const page = await context.newPage();

  try {
    await page.goto(candidate.href, {
      waitUntil: "domcontentloaded",
      timeout: 45000
    });
    await dismissOverlays(page);
    await page.waitForTimeout(headless ? 5000 : 3500);

    const bodyText = normalizeText(await page.locator("body").innerText().catch(() => ""));
    const coords = parseCoordsFromMapUrl(candidate.href);
    const distanceMiles = coords ? calculateDistanceMiles(downtownAsheville, coords) : 0;
    if (distanceMiles > MAX_RESTAURANT_DISTANCE_MILES) {
      throw new Error(`Outside Asheville dining radius at ${distanceMiles} miles.`);
    }
    const descriptor = parseDescriptor(candidate.previewText, candidate.name);
    const shortNote = parseShortNote(candidate.previewText, candidate.name);
    const websiteUrl = parseWebsiteUrl(bodyText) || candidate.href;
    const address = parseAddress(bodyText);
    const websiteDomain = getWebsiteDomain(websiteUrl);
    let imageUrl = resolveImageUrl(candidate.href, candidate.previewImageUrl);
    let websiteCuisineText = "";

    if (websiteUrl && !isThirdPartyListingDomain(websiteDomain)) {
      const websitePage = await context.newPage();

      try {
        await websitePage.goto(websiteUrl, {
          waitUntil: "domcontentloaded",
          timeout: 30000
        });
        await websitePage.waitForTimeout(headless ? 2500 : 1500);
        websiteCuisineText = await extractWebsiteCuisineText(websitePage);
        const websiteImageUrl = resolveImageUrl(
          websiteUrl,
          (await websitePage
            .locator('meta[property="og:image"], meta[name="twitter:image"]')
            .first()
            .getAttribute("content")
            .catch(() => null)) ||
            (await websitePage.locator("img").first().getAttribute("src").catch(() => null))
        );

        if (isUsableRestaurantImage(websiteImageUrl)) {
          imageUrl = websiteImageUrl;
        }
      } catch {
        // Best effort only. Keep the preview image if the website blocks us.
      } finally {
        await websitePage.close();
      }
    }

    if (!isUsableRestaurantImage(imageUrl)) {
      imageUrl = resolveImageUrl(candidate.href, candidate.previewImageUrl);
    }

    const cuisineTags = buildCuisineTagsFromSignals(candidate, descriptor, websiteCuisineText);
    const tamilPreferenceScore =
      getTamilPreferenceScore(candidate) + getTamilPreferenceScoreFromText(websiteCuisineText);
    const cuisineEvidenceNote = WEBSITE_CUISINE_KEYWORDS.filter((keyword) =>
      websiteCuisineText.toLowerCase().includes(keyword)
    ).slice(0, 3);

    return {
      id: slug(candidate.href),
      name: candidate.name,
      rating: parseRating(candidate.previewText),
      reviewCount: parseReviewCount(bodyText),
      priceTier: "$$",
      cuisineTags,
      distanceMiles,
      neighborhood: address ? address.split(",").slice(1, 3).join(",").trim() || "Asheville, NC" : "Asheville, NC",
      imageUrl: isUsableRestaurantImage(imageUrl) ? imageUrl : null,
      websiteUrl,
      mapUrl: candidate.href,
      notes:
        shortNote ||
        (cuisineEvidenceNote.length > 0
          ? `Website cuisine signals: ${cuisineEvidenceNote.join(", ")}`
          : getFocusScore(candidate) > 0
            ? `South-focused live Maps match via ${candidate.matchedTerms.join(", ")}`
            : `Live Asheville Maps result via ${candidate.matchedTerms.join(", ")}`),
      focusScore: getFocusScore(candidate),
      tamilPreferenceScore,
      websiteDomain
    };
  } finally {
    await page.close();
  }
}

function getRestaurantDedupeKey(restaurant) {
  const normalizedName = normalizeRestaurantName(restaurant.name);
  const domain =
    restaurant.websiteDomain && !isThirdPartyListingDomain(restaurant.websiteDomain)
      ? restaurant.websiteDomain
      : "";

  return `${normalizedName}::${domain}`;
}

function choosePreferredRestaurant(left, right) {
  const cuisineDelta = getCuisinePriority(right) - getCuisinePriority(left);
  if (cuisineDelta !== 0) {
    return cuisineDelta > 0 ? right : left;
  }

  if (!!right.imageUrl !== !!left.imageUrl) {
    return right.imageUrl ? right : left;
  }

  const leftDirect = left.websiteDomain && !isThirdPartyListingDomain(left.websiteDomain);
  const rightDirect = right.websiteDomain && !isThirdPartyListingDomain(right.websiteDomain);
  if (rightDirect !== leftDirect) {
    return rightDirect ? right : left;
  }

  if (right.focusScore !== left.focusScore) {
    return right.focusScore > left.focusScore ? right : left;
  }

  if (right.tamilPreferenceScore !== left.tamilPreferenceScore) {
    return right.tamilPreferenceScore > left.tamilPreferenceScore ? right : left;
  }

  if (right.reviewCount !== left.reviewCount) {
    return right.reviewCount > left.reviewCount ? right : left;
  }

  if (right.rating !== left.rating) {
    return right.rating > left.rating ? right : left;
  }

  return right.distanceMiles < left.distanceMiles ? right : left;
}

async function fetchRestaurants() {
  const { context, close } = await launchBrowser();

  try {
    const candidates = await discoverCandidates(context);
    const prioritized = [...candidates]
      .sort((left, right) => {
        const tamilDelta = getTamilPreferenceScore(right) - getTamilPreferenceScore(left);
        if (tamilDelta !== 0) {
          return tamilDelta;
        }

        const focusDelta = getFocusScore(right) - getFocusScore(left);
        if (focusDelta !== 0) {
          return focusDelta;
        }

        return parseRating(right.previewText) - parseRating(left.previewText);
      })
      .slice(0, 12);

    const restaurants = [];

    for (const candidate of prioritized) {
      try {
        restaurants.push(await enrichCandidate(context, candidate));
      } catch (error) {
        console.warn(`Skipping restaurant ${candidate.name}: ${String(error)}`);
      }
    }

    const dedupedRestaurants = [...restaurants.reduce((map, restaurant) => {
      const key = getRestaurantDedupeKey(restaurant);
      const existing = map.get(key);

      if (!existing) {
        map.set(key, restaurant);
        return map;
      }

      map.set(key, choosePreferredRestaurant(existing, restaurant));
      return map;
    }, new Map()).values()];

    return dedupedRestaurants
      .sort((left, right) => {
        const cuisineDelta = getCuisinePriority(right) - getCuisinePriority(left);
        if (cuisineDelta !== 0) {
          return cuisineDelta;
        }

        if (right.tamilPreferenceScore !== left.tamilPreferenceScore) {
          return right.tamilPreferenceScore - left.tamilPreferenceScore;
        }

        const leftDirect = left.websiteDomain && !isThirdPartyListingDomain(left.websiteDomain);
        const rightDirect = right.websiteDomain && !isThirdPartyListingDomain(right.websiteDomain);
        if (rightDirect !== leftDirect) {
          return rightDirect ? 1 : -1;
        }

        if (right.focusScore !== left.focusScore) {
          return right.focusScore - left.focusScore;
        }

        if (!!right.imageUrl !== !!left.imageUrl) {
          return right.imageUrl ? 1 : -1;
        }

        if (right.reviewCount !== left.reviewCount) {
          return right.reviewCount - left.reviewCount;
        }

        if (right.rating !== left.rating) {
          return right.rating - left.rating;
        }

        return left.distanceMiles - right.distanceMiles;
      })
      .slice(0, 5)
      .map(({ focusScore, tamilPreferenceScore, websiteDomain, ...restaurant }) => restaurant);
  } finally {
    await close();
  }
}

await mkdir(generatedDir, { recursive: true });
const restaurants = await fetchRestaurants();
await writeFile(outputPath, JSON.stringify(restaurants, null, 2));
console.log(`Restaurant collector wrote ${restaurants.length} entries.`);
