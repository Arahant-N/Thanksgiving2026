import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { chromium } from "playwright-core";

const generatedDir = path.join(process.cwd(), "data", "generated");
const outputPath = path.join(generatedDir, "cars.json");
const browserPath = process.env.PLAYWRIGHT_BROWSER_PATH;
const browserUserDataDir = process.env.BROWSER_USER_DATA_DIR;
const headless = String(process.env.CAR_SCRAPE_HEADLESS || "false").toLowerCase() === "true";
const tripLengthDays = 4;
const expediaGuideUrl =
  "https://www.expedia.com/Car-Rentals-In-Asheville-Regional.d6026313.Car-Rental-Guide";
const expediaSuvUrl =
  "https://www.expedia.com/SUV-Car-Rentals-In-Asheville-Regional.d6026313-tSUV.Car-Rental-Guide-Class";
const expediaVanUrl =
  "https://www.expedia.com/Van-Car-Rentals-In-Asheville-Regional.d6026313-tVan.Car-Rental-Guide-Class";

const families = [
  { id: "kumaran", familyName: "Kumaran Family", travelers: 4 },
  { id: "chandrasekaran", familyName: "Chandrasekaran Family", travelers: 4 },
  { id: "vaithilingam", familyName: "Vaithilingam Family", travelers: 4 },
  { id: "ajagane", familyName: "Ajagane Family", travelers: 3 },
  { id: "venkatesan-i", familyName: "Venkatesan Family I", travelers: 4 },
  { id: "venkatesan-ii", familyName: "Venkatesan Family II", travelers: 4 },
  { id: "aravind-keerthana", familyName: "Aravind + Keerthana", travelers: 2 }
];

const fallbackDeals = {
  SUV: {
    vehicleType: "SUV",
    vehicleLabel: "Chevrolet Equinox or similar",
    supplier: "Thrifty",
    seats: 5,
    observedTotalPrice: 65,
    dailyRate: 48,
    bookingUrl: expediaSuvUrl,
    sourceLabel: "Expedia indexed AVL SUV snapshot"
  },
  Minivan: {
    vehicleType: "Minivan",
    vehicleLabel: "Chrysler Pacifica or similar",
    supplier: "Thrifty",
    seats: 7,
    observedTotalPrice: 84,
    dailyRate: 63,
    bookingUrl: expediaVanUrl,
    sourceLabel: "Expedia AVL guide snapshot"
  }
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

function parseCurrency(text) {
  const match = text.match(/\$([\d,]+(?:\.\d{2})?)/);
  return match ? Number(match[1].replaceAll(",", "")) : 0;
}

function buildDealSection(text) {
  const start = text.indexOf("## Top Car Deals in Asheville Regional");
  if (start === -1) {
    return "";
  }

  const end = text.indexOf("## What you need to know", start);
  return end === -1 ? text.slice(start) : text.slice(start, end);
}

function parseDealBlock(block) {
  const lines = block
    .split("\n")
    .map((value) => value.trim())
    .filter(Boolean);

  if (lines.length < 8) {
    return null;
  }

  const vehicleType = lines[0];
  const vehicleLabel = lines[1];
  const seatsLine = lines.find((line) => /\b\d+\s+people\b/i.test(line)) || "";
  const seats = Number(seatsLine.match(/(\d+)\s+people/i)?.[1] || 0);
  const mileageIndex = lines.findIndex((line) => /Unlimited mileage/i.test(line));
  const supplier = mileageIndex >= 0 ? lines[mileageIndex + 1] || "Expedia" : "Expedia";
  const observedTotalPrice = parseCurrency(lines.find((line) => /^####\s*\$/.test(line)) || "");
  const dailyRate = parseCurrency(lines.find((line) => /\$[\d,]+(?:\.\d{2})?\s+per day/i.test(line)) || "");

  return {
    vehicleType,
    vehicleLabel,
    seats,
    supplier,
    observedTotalPrice,
    dailyRate
  };
}

function parseDeals(text) {
  const section = buildDealSection(text);

  if (!section) {
    return [];
  }

  return section
    .split("### ")
    .slice(1)
    .map((block) => parseDealBlock(block))
    .filter((deal) => deal && deal.observedTotalPrice > 0 && deal.dailyRate > 0);
}

function pickVehicleDeal(deals, vehicleType) {
  const vehiclePattern =
    vehicleType === "Minivan" ? /(mini van|passenger van|van)/i : /\bsuv\b/i;
  const directMatch = deals.find((deal) => vehiclePattern.test(deal.vehicleType));

  if (directMatch) {
    return {
      vehicleType,
      vehicleLabel: directMatch.vehicleLabel,
      supplier: directMatch.supplier,
      seats: directMatch.seats || (vehicleType === "Minivan" ? 7 : 5),
      observedTotalPrice: directMatch.observedTotalPrice,
      dailyRate: directMatch.dailyRate,
      bookingUrl: vehicleType === "Minivan" ? expediaVanUrl : expediaSuvUrl,
      sourceLabel: "Expedia AVL guide snapshot"
    };
  }

  return fallbackDeals[vehicleType];
}

function createFamilyOffer(family, vehicleDeal) {
  return {
    id: `${family.id}-${vehicleDeal.vehicleType.toLowerCase()}`,
    familyId: family.id,
    vehicleType: vehicleDeal.vehicleType,
    vehicleLabel: vehicleDeal.vehicleLabel,
    supplier: vehicleDeal.supplier,
    seats: vehicleDeal.seats,
    observedTotalPrice: vehicleDeal.observedTotalPrice,
    dailyRate: vehicleDeal.dailyRate,
    estimatedTripTotal: Number((vehicleDeal.observedTotalPrice * tripLengthDays).toFixed(2)),
    pickupLocation: "Asheville Regional Airport (AVL)",
    bookingUrl: vehicleDeal.bookingUrl,
    sourceLabel: vehicleDeal.sourceLabel,
    snapshotDate: new Date().toISOString().slice(0, 10),
    pricingContext: `Approx. ${tripLengthDays}-day trip estimate`,
    notes:
      family.travelers >= 4
        ? "Minivan model for a full family load with luggage."
        : "SUV model for the smaller household arrival."
  };
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

async function dismissOverlays(page) {
  for (const label of ["Accept all", "Accept", "I agree", "Got it"]) {
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

async function collectDeals() {
  const { context, close } = await launchBrowser();

  try {
    const page = await context.newPage();
    await page.goto(expediaGuideUrl, {
      waitUntil: "domcontentloaded",
      timeout: 45000
    });
    await dismissOverlays(page);
    await page.waitForTimeout(headless ? 4000 : 3000);

    const bodyText = normalizeText(await page.locator("body").innerText().catch(() => ""));
    const deals = parseDeals(bodyText);

    await page.close();
    return deals;
  } finally {
    await close();
  }
}

await mkdir(generatedDir, { recursive: true });
const deals = await collectDeals().catch((error) => {
  console.warn(`Car collector fell back to cached market rates: ${String(error)}`);
  return [];
});
const suvDeal = pickVehicleDeal(deals, "SUV");
const minivanDeal = pickVehicleDeal(deals, "Minivan");
const cars = families.map((family) =>
  createFamilyOffer(family, family.travelers >= 4 ? minivanDeal : suvDeal)
);

await writeFile(outputPath, JSON.stringify(cars, null, 2));
console.log(`Car collector wrote ${cars.length} family rental estimates.`);
