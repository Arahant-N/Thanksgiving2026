import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const generatedDir = path.join(process.cwd(), "data", "generated");
const outputPath = path.join(generatedDir, "properties.json");
const city = process.env.PROPERTY_SEARCH_CITY || "Asheville, NC";

const fallbackResults = [
  {
    id: "prop-local-1",
    title: "Asheville Collector Demo Estate",
    source: "Airbnb",
    bedrooms: 8,
    bathrooms: 8,
    sleeps: 24,
    nightlyRate: 1725,
    totalStayPrice: 6900,
    rating: 4.8,
    reviewCount: 33,
    distanceToDowntownMiles: 5.3,
    highlights: ["Collector fallback", "Replace with live scraper", "Sorted by total price"],
    url: "https://www.airbnb.com/s/Asheville--NC/homes"
  },
  {
    id: "prop-local-2",
    title: "Blue Ridge Collector Demo Lodge",
    source: "Vrbo",
    bedrooms: 9,
    bathrooms: 8,
    sleeps: 24,
    nightlyRate: 1890,
    totalStayPrice: 7560,
    rating: 4.7,
    reviewCount: 41,
    distanceToDowntownMiles: 7.2,
    highlights: ["Local script output", "Provider adapter ready", "Top-10 shape"],
    url: "https://www.vrbo.com/search/keywords:Asheville--North-Carolina--United-States-of-America"
  }
];

await mkdir(generatedDir, { recursive: true });
await writeFile(outputPath, JSON.stringify(fallbackResults, null, 2));

console.log(
  `Property collector wrote demo data for ${city}. Replace this script's provider adapter with a Playwright or authenticated fetch flow when ready.`
);
