import type { PropertyListing, PropertyOffer } from "@/types/trip";

function isPositiveNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function getSourceRank(source: PropertyOffer["source"]) {
  if (source === "Direct") {
    return 0;
  }

  if (source === "Airbnb") {
    return 1;
  }

  return 2;
}

function buildLegacyPrimaryOffer(property: PropertyListing): PropertyOffer | null {
  if (!property.url) {
    return null;
  }

  return {
    id: `${property.id}-${property.source.toLowerCase()}`,
    source: property.source,
    label: property.source,
    url: property.url,
    totalStayPrice: isPositiveNumber(property.totalStayPrice) ? property.totalStayPrice : null,
    nightlyRate: isPositiveNumber(property.nightlyRate) ? property.nightlyRate : null,
    captureStatus: isPositiveNumber(property.totalStayPrice) ? "verified" : "link-only",
    availabilityStatus: property.availabilityStatus ?? "unknown",
    notes: null
  };
}

function buildLegacyDirectOffer(property: PropertyListing): PropertyOffer | null {
  if (!property.directBookingUrl) {
    return null;
  }

  if (property.source === "Direct" && property.url === property.directBookingUrl) {
    return null;
  }

  return {
    id: `${property.id}-direct`,
    source: "Direct",
    label: property.directBookingLabel || "Direct site",
    url: property.directBookingUrl,
    totalStayPrice: null,
    nightlyRate: null,
    captureStatus: "link-only",
    availabilityStatus: "unknown",
    notes:
      property.directBookingStatus === "verified"
        ? "Verified direct site found; live stay total still needs capture."
        : "Likely direct site found; live stay total still needs capture."
  };
}

function normalizeOffer(property: PropertyListing, offer: PropertyOffer): PropertyOffer {
  return {
    id: offer.id || `${property.id}-${offer.source.toLowerCase()}`,
    source: offer.source,
    label: offer.label || offer.source,
    url: offer.url,
    totalStayPrice: isPositiveNumber(offer.totalStayPrice) ? offer.totalStayPrice : null,
    nightlyRate: isPositiveNumber(offer.nightlyRate) ? offer.nightlyRate : null,
    captureStatus:
      offer.captureStatus === "verified" && isPositiveNumber(offer.totalStayPrice)
        ? "verified"
        : "link-only",
    availabilityStatus: offer.availabilityStatus ?? property.availabilityStatus ?? "unknown",
    notes: offer.notes ?? null
  };
}

export function getPropertyOffers(property: PropertyListing) {
  const offers =
    property.offers && property.offers.length > 0
      ? property.offers.map((offer) => normalizeOffer(property, offer))
      : [buildLegacyPrimaryOffer(property), buildLegacyDirectOffer(property)].filter(
          (offer): offer is PropertyOffer => Boolean(offer)
        );

  const seen = new Set<string>();

  return offers
    .filter((offer) => {
      const key = `${offer.source}:${offer.url}`;
      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    })
    .sort((left, right) => {
      const leftHasPrice = isPositiveNumber(left.totalStayPrice) ? 0 : 1;
      const rightHasPrice = isPositiveNumber(right.totalStayPrice) ? 0 : 1;
      if (leftHasPrice !== rightHasPrice) {
        return leftHasPrice - rightHasPrice;
      }

      if (isPositiveNumber(left.totalStayPrice) && isPositiveNumber(right.totalStayPrice)) {
        if (left.totalStayPrice !== right.totalStayPrice) {
          return left.totalStayPrice - right.totalStayPrice;
        }
      }

      return getSourceRank(left.source) - getSourceRank(right.source);
    });
}

export function getVerifiedPropertyOffers(property: PropertyListing) {
  return getPropertyOffers(property).filter(
    (offer) => offer.captureStatus === "verified" && isPositiveNumber(offer.totalStayPrice)
  );
}

export function getBestVerifiedOffer(property: PropertyListing) {
  return getVerifiedPropertyOffers(property)[0] || null;
}

export function getBestKnownOffer(property: PropertyListing) {
  return getBestVerifiedOffer(property) || getPropertyOffers(property)[0] || null;
}

export function getOfferBySource(
  property: PropertyListing,
  source: PropertyOffer["source"]
) {
  return getPropertyOffers(property).find((offer) => offer.source === source) || null;
}

export function getEffectiveTotalStayPrice(property: PropertyListing) {
  return getBestVerifiedOffer(property)?.totalStayPrice ?? 0;
}

export function getEffectiveNightlyRate(property: PropertyListing) {
  const bestOffer = getBestVerifiedOffer(property);
  if (!bestOffer) {
    return 0;
  }

  if (isPositiveNumber(bestOffer.nightlyRate)) {
    return bestOffer.nightlyRate;
  }

  if (isPositiveNumber(bestOffer.totalStayPrice)) {
    return Number((bestOffer.totalStayPrice / 4).toFixed(2));
  }

  return 0;
}

export function getDirectSavingsVsAirbnb(property: PropertyListing) {
  const airbnbOffer = getOfferBySource(property, "Airbnb");
  const directOffer = getOfferBySource(property, "Direct");

  if (
    !airbnbOffer ||
    !directOffer ||
    !isPositiveNumber(airbnbOffer.totalStayPrice) ||
    !isPositiveNumber(directOffer.totalStayPrice)
  ) {
    return null;
  }

  return airbnbOffer.totalStayPrice - directOffer.totalStayPrice;
}

export function hasVerifiedStayPrice(property: PropertyListing) {
  return isPositiveNumber(getEffectiveTotalStayPrice(property));
}
