import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const generatedDir = path.join(process.cwd(), "data", "generated");
const outputPath = path.join(generatedDir, "flights.json");
const SERPAPI_KEY = process.env.SERPAPI_KEY;

const families = [
  { id: "kumaran", airportCode: "DTW", travelers: 4 },
  { id: "chandrasekaran", airportCode: "SFO", travelers: 4 },
  { id: "vaithilingam", airportCode: "OAK", travelers: 4 },
  { id: "ajagane", airportCode: "SFO", travelers: 3 },
  { id: "venkatesan-i", airportCode: "SEA", travelers: 4 },
  { id: "venkatesan-ii", airportCode: "ORD", travelers: 4 }
];

async function fetchSerpApiOffers(family, travelClass, stops) {
  const response = await fetch("https://serpapi.com/search.json?" + new URLSearchParams({
    engine: "google_flights",
    api_key: SERPAPI_KEY,
      departure_id: family.airportCode,
      arrival_id: "AVL",
    outbound_date: "2026-11-25",
    return_date: "2026-11-29",
    currency: "USD",
    hl: "en",
    gl: "us",
    travel_class: travelClass,
    stops
  }));

  if (!response.ok) {
    throw new Error(`SerpApi request failed with status ${response.status}`);
  }

  const payload = await response.json();
  const candidate = [...(payload.best_flights || []), ...(payload.other_flights || [])][0];

  if (!candidate) {
    return null;
  }

  const totalPrice = Number(candidate.price);
  return {
    carrierLabel: candidate.flights?.map((flight) => flight.airline).join(" + ") || "Live result",
    durationLabel: candidate.total_duration
      ? `${Math.floor(candidate.total_duration / 60)}h ${candidate.total_duration % 60}m`
      : "See booking page",
    totalPrice: totalPrice * family.travelers,
    perTravelerPrice: totalPrice,
    bookingUrl: payload.search_metadata?.google_flights_url || "https://www.google.com/travel/flights"
  };
}

async function buildOffers() {
  if (!SERPAPI_KEY) {
    return [
      {
        id: "flt-demo-1",
        familyId: "kumaran",
        cabin: "Economy",
        stops: "1-stop",
        totalPrice: 1460,
        perTravelerPrice: 365,
        carrierLabel: "Demo cached option",
        durationLabel: "6h 35m",
        departSummary: "DTW -> AVL, Wed Nov 25",
        returnSummary: "AVL -> DTW, Sun Nov 29",
        bookingUrl: "https://www.google.com/travel/flights",
        sourceLabel: "Demo"
      }
    ];
  }

  const offers = [];

  for (const family of families) {
    for (const slot of [
      { cabin: "Economy", travelClass: "1", stops: "1", label: "Nonstop" },
      { cabin: "Economy", travelClass: "1", stops: "2", label: "1-stop" },
      { cabin: "Economy Plus", travelClass: "2", stops: "1", label: "Nonstop" },
      { cabin: "Economy Plus", travelClass: "2", stops: "2", label: "1-stop" }
    ]) {
      const result = await fetchSerpApiOffers(family, slot.travelClass, slot.stops);

      if (!result) {
        continue;
      }

      offers.push({
        id: `${family.id}-${slot.cabin}-${slot.label}`,
        familyId: family.id,
        cabin: slot.cabin,
        stops: slot.label,
        totalPrice: result.totalPrice,
        perTravelerPrice: result.perTravelerPrice,
        carrierLabel: result.carrierLabel,
        durationLabel: result.durationLabel,
        departSummary: `${family.airportCode} -> AVL, Wed Nov 25`,
        returnSummary: `AVL -> ${family.airportCode}, Sun Nov 29`,
        bookingUrl: result.bookingUrl,
        sourceLabel: "SerpApi"
      });
    }
  }

  return offers;
}

await mkdir(generatedDir, { recursive: true });
const offers = await buildOffers();
await writeFile(outputPath, JSON.stringify(offers, null, 2));
console.log(`Flight collector wrote ${offers.length} offers.`);
