import { readFile } from "node:fs/promises";
import path from "node:path";

import { getFeaturedActivities } from "@/data/activities";
import { getTripConfig } from "@/data/config";
import { buildFamilyCostEstimates } from "@/lib/costs";
import { getEffectiveTotalStayPrice } from "@/lib/property-pricing";
import type { CarRentalOffer, FlightOffer, PropertyListing, Restaurant } from "@/types/trip";

const minimumBedrooms = 8;
const minimumBathrooms = 6;
const minimumSleeps = 16;

function hasPlausibleLargeGroupPrice(property: PropertyListing) {
  const totalStayPrice = getEffectiveTotalStayPrice(property);

  if (!totalStayPrice) {
    return false;
  }

  if (property.bedrooms >= 7 || property.bathrooms >= 5 || property.sleeps >= 16) {
    return totalStayPrice >= 1500;
  }

  return totalStayPrice >= 400;
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

async function readGeneratedJson<T>(
  destinationFolder: string,
  filename: string,
  fallback: T
): Promise<T> {
  const candidatePaths = [
    path.join(process.cwd(), "data", "generated", destinationFolder, filename),
    path.join(process.cwd(), "data", "generated", filename)
  ];

  for (const targetPath of candidatePaths) {
    try {
      const file = await readFile(targetPath, "utf8");
      return JSON.parse(file) as T;
    } catch {
      // Try the next path.
    }
  }

  return fallback;
}

export async function loadDashboardData(destinationId?: string) {
  const trip = getTripConfig(destinationId);
  const activities = getFeaturedActivities(trip.destinationId);
  const [properties, flights, cars, restaurants] = await Promise.all([
    readGeneratedJson<PropertyListing[]>(trip.generatedFolder, "properties.json", []),
    readGeneratedJson<FlightOffer[]>(trip.generatedFolder, "flights.json", []),
    readGeneratedJson<CarRentalOffer[]>(trip.generatedFolder, "cars.json", []),
    readGeneratedJson<Restaurant[]>(trip.generatedFolder, "restaurants.json", [])
  ]);

  const families = trip.families;
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

    return getEffectiveTotalStayPrice(left) - getEffectiveTotalStayPrice(right);
  });
  const costEstimates = buildFamilyCostEstimates(
    trip,
    families,
    validProperties,
    flights,
    cars,
    activities
  );
  const cheapestProperty = [...validProperties]
    .filter(
      (property) =>
        hasReasonableCapacity(property) &&
        meetsHardRequirements(property) &&
        hasPlausibleLargeGroupPrice(property)
    )
    .sort((left, right) => getEffectiveTotalStayPrice(left) - getEffectiveTotalStayPrice(right))[0];
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
      const leftPrice = getEffectiveTotalStayPrice(left);
      const rightPrice = getEffectiveTotalStayPrice(right);

      if (leftPrice !== rightPrice) {
        return leftPrice - rightPrice;
      }

      return (right.recommendationScore || 0) - (left.recommendationScore || 0);
    });
  const budgetProperty = budgetCandidates[0] || rankedProperties[1] || heroProperty;

  return {
    trip,
    families,
    properties: rankedProperties,
    recommendedProperties: rankedProperties.slice(0, 5),
    heroProperty,
    budgetProperty,
    flights,
    cars,
    activities,
    restaurants: restaurants.slice(0, 5),
    costEstimates,
    cheapestProperty
  };
}
