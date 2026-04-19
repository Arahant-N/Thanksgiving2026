import type { Family, FlightOffer, PropertyListing, TripConfig } from "@/types/trip";

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

export function getPropertyHref(
  property: PropertyListing,
  trip: TripConfig,
  families: Family[]
) {
  if (property.source === "Airbnb" && isAirbnbListingUrl(property.url)) {
    if (hasAirbnbBookingParams(property.url)) {
      return property.url;
    }

    return withAirbnbTripParams(property.url, trip, families);
  }

  if (property.source === "Vrbo" && isVrboListingUrl(property.url)) {
    return withVrboTripParams(property.url, trip, families);
  }

  if (isDirectPropertyUrl(property.url)) {
    return property.url;
  }

  const adults = String(getTotalTravelers(families));

  if (property.source === "Airbnb") {
    return (
      "https://www.airbnb.com/s/Asheville--NC/homes?" +
      new URLSearchParams({
        checkin: trip.checkInDate,
        checkout: trip.checkOutDate,
        adults,
        min_bedrooms: String(Math.max(property.bedrooms, 8)),
        min_bathrooms: String(Math.max(property.bathrooms, 8))
      }).toString()
    );
  }

  if (property.source === "Vrbo") {
    return (
      "https://www.vrbo.com/search/keywords:Asheville--North-Carolina--United-States-of-America?" +
      new URLSearchParams({
        d1: trip.checkInDate,
        d2: trip.checkOutDate,
        adults,
        minBedrooms: String(Math.max(property.bedrooms, 8)),
        minBathrooms: String(Math.max(property.bathrooms, 8))
      }).toString()
    );
  }

  return (
    "https://www.google.com/search?" +
    new URLSearchParams({
      q: `${property.title} Asheville NC vacation rental ${trip.checkInDate} ${trip.checkOutDate}`
    }).toString()
  );
}

export function getPropertyLinkLabel(property: PropertyListing) {
  if (isDirectPropertyUrl(property.url)) {
    return "View listing";
  }

  if (
    (property.source === "Airbnb" && isAirbnbListingUrl(property.url)) ||
    (property.source === "Vrbo" && isVrboListingUrl(property.url))
  ) {
    return "View listing";
  }

  return "Open live search";
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
      q: `Round trip flights from ${family.airportCode} to ${trip.destinationAirport} departing ${trip.checkInDate} returning ${trip.checkOutDate} ${cabinQuery} ${stopsQuery}`
    }).toString()
  );
}

export function getFlightLinkLabel(offer: FlightOffer) {
  if (isGenericGoogleFlightsUrl(offer.bookingUrl)) {
    return "Open live search";
  }

  return "Open offer";
}
