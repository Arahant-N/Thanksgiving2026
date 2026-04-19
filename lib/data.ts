import { readFile } from "node:fs/promises";
import path from "node:path";

import { tripConfig } from "@/data/config";
import { flightSeed, propertySeed, restaurantSeed } from "@/data/seed";
import { buildFamilyCostEstimates } from "@/lib/costs";
import type { FlightOffer, PropertyListing, Restaurant } from "@/types/trip";

async function readGeneratedJson<T>(filename: string, fallback: T): Promise<T> {
  const targetPath = path.join(process.cwd(), "data", "generated", filename);

  try {
    const file = await readFile(targetPath, "utf8");
    return JSON.parse(file) as T;
  } catch {
    return fallback;
  }
}

export async function loadDashboardData() {
  const [properties, flights, restaurants] = await Promise.all([
    readGeneratedJson<PropertyListing[]>("properties.json", propertySeed),
    readGeneratedJson<FlightOffer[]>("flights.json", flightSeed),
    readGeneratedJson<Restaurant[]>("restaurants.json", restaurantSeed)
  ]);

  const families = tripConfig.families;
  const costEstimates = buildFamilyCostEstimates(families, properties, flights);
  const cheapestProperty = [...properties].sort(
    (left, right) => left.totalStayPrice - right.totalStayPrice
  )[0];

  return {
    trip: tripConfig,
    families,
    properties: [...properties].sort((left, right) => left.totalStayPrice - right.totalStayPrice),
    flights,
    restaurants: [...restaurants].sort((left, right) => {
      if (right.rating !== left.rating) {
        return right.rating - left.rating;
      }

      return right.reviewCount - left.reviewCount;
    }),
    costEstimates,
    cheapestProperty
  };
}
