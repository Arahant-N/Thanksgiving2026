import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const generatedDir = path.join(process.cwd(), "data", "generated");
const outputPath = path.join(generatedDir, "restaurants.json");
const YELP_API_KEY = process.env.YELP_API_KEY;

async function fetchRestaurants() {
  if (!YELP_API_KEY) {
    return [
      {
        id: "rest-demo-1",
        name: "Mela Indian Restaurant",
        rating: 4.6,
        reviewCount: 816,
        priceTier: "$$",
        cuisineTags: ["Indian", "Buffet"],
        distanceMiles: 0.4,
        neighborhood: "Downtown Asheville",
        websiteUrl: "https://melaasheville.com/",
        mapUrl: "https://www.google.com/maps/search/?api=1&query=Mela+Indian+Restaurant+Asheville",
        notes: "Demo fallback. Add YELP_API_KEY for live search refresh."
      }
    ];
  }

  const response = await fetch(
    "https://api.yelp.com/v3/businesses/search?" +
      new URLSearchParams({
        term: "Indian restaurant",
        location: "Asheville, NC",
        limit: "10",
        sort_by: "rating"
      }),
    {
      headers: {
        Authorization: `Bearer ${YELP_API_KEY}`,
        accept: "application/json"
      }
    }
  );

  if (!response.ok) {
    throw new Error(`Yelp request failed with status ${response.status}`);
  }

  const payload = await response.json();
  return (payload.businesses || []).map((business) => ({
    id: business.id,
    name: business.name,
    rating: business.rating,
    reviewCount: business.review_count,
    priceTier: business.price || "$$",
    cuisineTags: (business.categories || []).map((category) => category.title).slice(0, 3),
    distanceMiles: Number(((business.distance || 0) / 1609.34).toFixed(1)),
    neighborhood: [business.location?.city, business.location?.state].filter(Boolean).join(", "),
    websiteUrl: business.url,
    mapUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      business.name + " " + (business.location?.display_address || []).join(" ")
    )}`,
    notes: "Live Yelp Places result"
  }));
}

await mkdir(generatedDir, { recursive: true });
const restaurants = await fetchRestaurants();
await writeFile(outputPath, JSON.stringify(restaurants, null, 2));
console.log(`Restaurant collector wrote ${restaurants.length} entries.`);
