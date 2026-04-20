import { getBestKnownOffer } from "@/lib/property-pricing";
import type {
  Family,
  FlightOffer,
  PropertyListing,
  PropertyOffer,
  TripConfig
} from "@/types/trip";

function getTravelerCount(family: Family) {
  return family.adults + family.children;
}

function getTotalTravelers(families: Family[]) {
  return families.reduce((sum, family) => sum + getTravelerCount(family), 0);
}

function getAirbnbGuestBreakdown(families: Family[]) {
  return families.reduce(
    (totals, family) => {
      const teenagers = family.teenagers || 0;
      const childrenUnder12 = family.childrenUnder12 || 0;
      const infants = family.infants || 0;
      const fallbackChildren = Math.max(family.children - teenagers - childrenUnder12 - infants, 0);

      totals.adults += family.adults + teenagers + fallbackChildren;
      totals.children += childrenUnder12;
      totals.infants += infants;
      return totals;
    },
    { adults: 0, children: 0, infants: 0 }
  );
}

function isAirbnbListingUrl(url: string) {
  return /airbnb\.com\/rooms\//i.test(url);
}

function isVrboListingUrl(url: string) {
  return /vrbo\.com\/\d+/i.test(url) || /vrbo\.com\/p\d+/i.test(url);
}

function isGenericGoogleFlightsUrl(url: string) {
  return /^https:\/\/www\.google\.com\/travel\/flights\/?$/i.test(url);
}

function isDirectPropertyUrl(url: string) {
  return /^https?:\/\//i.test(url) && !/google\.com\/search/i.test(url);
}

function hasAirbnbBookingParams(url: string) {
  try {
    const target = new URL(url);
    return (
      target.searchParams.has("check_in") &&
      target.searchParams.has("check_out") &&
      target.searchParams.has("adults")
    );
  } catch {
    return false;
  }
}

function withAirbnbTripParams(url: string, trip: TripConfig, families: Family[]) {
  const target = new URL(url);
  const guestBreakdown = getAirbnbGuestBreakdown(families);
  target.searchParams.set("check_in", trip.checkInDate);
  target.searchParams.set("check_out", trip.checkOutDate);
  target.searchParams.set("adults", String(guestBreakdown.adults));
  target.searchParams.set("children", String(guestBreakdown.children));
  target.searchParams.set("infants", String(guestBreakdown.infants));
  return target.toString();
}

function withVrboTripParams(url: string, trip: TripConfig, families: Family[]) {
  const target = new URL(url);
  target.searchParams.set("adults", String(getTotalTravelers(families)));
  target.searchParams.set("arrival", trip.checkInDate);
  target.searchParams.set("departure", trip.checkOutDate);
  return target.toString();
}

export function getOfferHref(
  offer: PropertyOffer,
  trip: TripConfig,
  families: Family[]
) {
  if (offer.source === "Airbnb" && isAirbnbListingUrl(offer.url)) {
    if (hasAirbnbBookingParams(offer.url)) {
      return offer.url;
    }

    return withAirbnbTripParams(offer.url, trip, families);
  }

  if (offer.source === "Vrbo" && isVrboListingUrl(offer.url)) {
    return withVrboTripParams(offer.url, trip, families);
  }

  if (isDirectPropertyUrl(offer.url)) {
    return offer.url;
  }

  const adults = String(getTotalTravelers(families));

  if (offer.source === "Airbnb") {
    return (
      `https://www.airbnb.com/s/${trip.airbnbSearchSlug}/homes?` +
      new URLSearchParams({
        checkin: trip.checkInDate,
        checkout: trip.checkOutDate,
        adults,
        min_bedrooms: "8",
        min_bathrooms: "6"
      }).toString()
    );
  }

  if (offer.source === "Vrbo") {
    return (
      `https://www.vrbo.com/search/keywords:${trip.vrboKeywordPath}?` +
      new URLSearchParams({
        d1: trip.checkInDate,
        d2: trip.checkOutDate,
        adults,
        minBedrooms: "8",
        minBathrooms: "6"
      }).toString()
    );
  }

  return (
    "https://www.google.com/search?" +
    new URLSearchParams({
      q: `${offer.label} ${trip.googleVacationRentalQuery} ${trip.checkInDate} ${trip.checkOutDate}`
    }).toString()
  );
}

export function getOfferLinkLabel(offer: PropertyOffer) {
  if (offer.source === "Direct") {
    return "Open direct";
  }

  if (
    (offer.source === "Airbnb" && isAirbnbListingUrl(offer.url)) ||
    (offer.source === "Vrbo" && isVrboListingUrl(offer.url)) ||
    isDirectPropertyUrl(offer.url)
  ) {
    return `Open ${offer.source}`;
  }

  return "Open live search";
}

export function getPropertyHref(
  property: PropertyListing,
  trip: TripConfig,
  families: Family[]
) {
  const primaryOffer = getBestKnownOffer(property);

  if (!primaryOffer) {
    return (
      "https://www.google.com/search?" +
      new URLSearchParams({
        q: `${property.title} ${trip.googleVacationRentalQuery} ${trip.checkInDate} ${trip.checkOutDate}`
      }).toString()
    );
  }

  return getOfferHref(primaryOffer, trip, families);
}

export function getPropertyLinkLabel(property: PropertyListing) {
  const primaryOffer = getBestKnownOffer(property);

  if (!primaryOffer) {
    return "Open live search";
  }

  if (primaryOffer.captureStatus === "verified") {
    return "Open best offer";
  }

  return getOfferLinkLabel(primaryOffer);
}

export function getFlightHref(family: Family, offer: FlightOffer, trip: TripConfig) {
  if (!isGenericGoogleFlightsUrl(offer.bookingUrl)) {
    return offer.bookingUrl;
  }

  const cabinQuery = offer.cabin === "Economy Plus" ? "premium economy" : "economy";
  const stopsQuery = offer.stops === "Nonstop" ? "nonstop" : "1 stop or fewer";

  return (
    "https://www.google.com/travel/flights?" +
    new URLSearchParams({
      q: `Round trip flights from ${family.airportCode} to ${trip.flightSearchDestinationLabel} departing ${trip.checkInDate} returning ${trip.checkOutDate} ${cabinQuery} ${stopsQuery}`
    }).toString()
  );
}

export function getFlightLinkLabel(offer: FlightOffer) {
  if (isGenericGoogleFlightsUrl(offer.bookingUrl)) {
    return "Open live search";
  }

  return "Open offer";
}
