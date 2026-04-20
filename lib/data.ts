import { readFile } from "node:fs/promises";
import path from "node:path";

import { featuredActivities } from "@/data/activities";
import { tripConfig } from "@/data/config";
import { buildFamilyCostEstimates } from "@/lib/costs";
import type { CarRentalOffer, FlightOffer, PropertyListing, Restaurant } from "@/types/trip";

const minimumBedrooms = 8;
const minimumBathrooms = 6;
const minimumSleeps = 16;

function hasPlausibleLargeGroupPrice(property: PropertyListing) {
  if (!property.totalStayPrice) {
    return false;
  }

  if (property.bedrooms >= 7 || property.bathrooms >= 5 || property.sleeps >= 16) {
    return property.totalStayPrice >= 1500;
  }

  return property.totalStayPrice >= 400;
}

function hasReasonableCapacity(property: PropertyListing) {
  return property.sleeps >= 16 && property.sleeps <= 40;
}

function meetsHardRequirements(property: PropertyListing) {
  return (
    property.bedrooms >= minimumBedrooms &&
    property.bathrooms >= minimumBathrooms &&
    property.sleeps >= minimumSleeps
  );
}

function getAvailabilityRank(property: PropertyListing) {
  if (property.availabilityStatus === "available") {
    return 0;
  }

  if (property.availabilityStatus === "unknown") {
    return 1;
  }

  return 2;
}

function isUsablePropertyListing(property: PropertyListing) {
  const normalizedTitle = property.title.trim().toLowerCase();

  if (!normalizedTitle || normalizedTitle === "too many requests") {
    return false;
  }

  if (!hasReasonableCapacity(property)) {
    return false;
  }

  if (!meetsHardRequirements(property)) {
    return false;
  }

  return property.availabilityStatus === "available";
}

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
  const [properties, flights, cars, restaurants] = await Promise.all([
    readGeneratedJson<PropertyListing[]>("properties.json", []),
    readGeneratedJson<FlightOffer[]>("flights.json", []),
    readGeneratedJson<CarRentalOffer[]>("cars.json", []),
    readGeneratedJson<Restaurant[]>("restaurants.json", [])
  ]);

  const families = tripConfig.families;
  const validProperties = properties.filter(isUsablePropertyListing);
  const rankedProperties = [...validProperties].sort((left, right) => {
    const availabilityDelta = getAvailabilityRank(left) - getAvailabilityRank(right);
    if (availabilityDelta !== 0) {
      return availabilityDelta;
    }

    const scoreDelta = (right.recommendationScore || 0) - (left.recommendationScore || 0);
    if (scoreDelta !== 0) {
      return scoreDelta;
    }

    return left.totalStayPrice - right.totalStayPrice;
  });
  const costEstimates = buildFamilyCostEstimates(
    families,
    validProperties,
    flights,
    cars,
    featuredActivities
  );
  const cheapestProperty = [...validProperties]
    .filter(
      (property) =>
        hasReasonableCapacity(property) &&
        meetsHardRequirements(property) &&
        hasPlausibleLargeGroupPrice(property)
    )
    .sort((left, right) => left.totalStayPrice - right.totalStayPrice)[0];
  const heroProperty = rankedProperties[0];
  const budgetCandidates = rankedProperties
    .filter(
      (property) =>
        (property.historicSignal || 0) >= 2 &&
        property.sleeps >= 18 &&
        hasPlausibleLargeGroupPrice(property) &&
        property.id !== heroProperty?.id
    )
    .sort((left, right) => {
      if (left.totalStayPrice !== right.totalStayPrice) {
        return left.totalStayPrice - right.totalStayPrice;
      }

      return (right.recommendationScore || 0) - (left.recommendationScore || 0);
    });
  const budgetProperty = budgetCandidates[0] || rankedProperties[1] || heroProperty;

  return {
    trip: tripConfig,
    families,
    properties: rankedProperties,
    recommendedProperties: rankedProperties.slice(0, 5),
    heroProperty,
    budgetProperty,
    flights,
    cars,
    activities: featuredActivities,
    restaurants: restaurants.slice(0, 5),
    costEstimates,
    cheapestProperty
  };
}
