export type Family = {
  id: string;
  familyName: string;
  homeBase: string;
  airportCode: string;
  adults: number;
  children: number;
  members: string[];
  notes?: string;
};

export type PropertyListing = {
  id: string;
  title: string;
  source: "Airbnb" | "Vrbo" | "Direct";
  bedrooms: number;
  bathrooms: number;
  sleeps: number;
  nightlyRate: number;
  totalStayPrice: number;
  rating: number;
  reviewCount: number;
  distanceToDowntownMiles: number;
  highlights: string[];
  url: string;
};

export type FlightOffer = {
  id: string;
  familyId: string;
  cabin: "Economy" | "Economy Plus";
  stops: "Nonstop" | "1-stop";
  totalPrice: number;
  perTravelerPrice: number;
  carrierLabel: string;
  durationLabel: string;
  departSummary: string;
  returnSummary: string;
  bookingUrl: string;
  sourceLabel: string;
};

export type Restaurant = {
  id: string;
  name: string;
  rating: number;
  reviewCount: number;
  priceTier: "$" | "$$" | "$$$";
  cuisineTags: string[];
  distanceMiles: number;
  neighborhood: string;
  websiteUrl: string;
  mapUrl: string;
  notes: string;
};

export type TripConfig = {
  destinationCity: string;
  destinationAirport: string;
  checkInDate: string;
  checkOutDate: string;
  nights: number;
  stayReferenceArea: string;
  mealModel: {
    adultEatOutMealCost: number;
    childEatOutMealCost: number;
    adultEatInMealCost: number;
    childEatInMealCost: number;
    eatOutMeals: number;
    eatInMeals: number;
  };
  families: Family[];
};
