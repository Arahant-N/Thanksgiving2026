export type Family = {
  id: string;
  familyName: string;
  homeBase: string;
  airportCode: string;
  adults: number;
  children: number;
  teenagers?: number;
  childrenUnder12?: number;
  infants?: number;
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
  distanceFromAshevilleMiles?: number;
  area?: string;
  imageUrl?: string | null;
  recommendationScore?: number;
  historicSignal?: number;
  familyFitScore?: number;
  valueScore?: number;
  availabilityStatus?: "available" | "unknown" | "unavailable";
  recommendationSummary?: string;
  recommendationTag?: "Hero pick" | "Budget pick" | null;
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

export type CarRentalOffer = {
  id: string;
  familyId: string;
  vehicleType: "SUV" | "Minivan";
  vehicleLabel: string;
  supplier: string;
  seats: number;
  observedTotalPrice: number;
  dailyRate: number;
  estimatedTripTotal: number;
  pickupLocation: string;
  bookingUrl: string;
  sourceLabel: string;
  snapshotDate: string;
  pricingContext: string;
  notes?: string;
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
  imageUrl?: string | null;
  websiteUrl: string;
  mapUrl: string;
  notes: string;
};

export type Activity = {
  id: string;
  name: string;
  description: string;
  costPerPerson: number;
  area: string;
  priceNote: string;
  imageUrl: string;
  websiteUrl: string;
  includedInBudget: boolean;
};

export type TripConfig = {
  destinationCity: string;
  destinationAirport: string;
  checkInDate: string;
  checkOutDate: string;
  nights: number;
  stayReferenceArea: string;
  activityParticipationRate: number;
  carRentalModel: {
    pickupLocation: string;
    preferredSmallFamilyVehicle: "SUV";
    preferredLargeFamilyVehicle: "Minivan";
    tripLengthDays: number;
  };
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
