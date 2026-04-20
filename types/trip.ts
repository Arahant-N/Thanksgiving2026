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
  airbnbBadge?: "Guest favorite" | "Superhost" | null;
  bedrooms: number;
  bathrooms: number;
  sleeps: number;
  nightlyRate: number;
  totalStayPrice: number;
  rating: number;
  reviewCount: number;
  distanceToDowntownMiles: number;
  distanceFromCenterMiles?: number;
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
  privacyNotes?: string | null;
  directBookingUrl?: string | null;
  directBookingLabel?: string | null;
  directBookingStatus?: "verified" | "likely" | "not-found" | null;
  highlights: string[];
  url: string;
  offers?: PropertyOffer[];
};

export type PropertyOffer = {
  id: string;
  source: "Airbnb" | "Vrbo" | "Direct";
  label: string;
  url: string;
  totalStayPrice?: number | null;
  nightlyRate?: number | null;
  captureStatus: "verified" | "link-only";
  availabilityStatus?: "available" | "unknown" | "unavailable";
  notes?: string | null;
};

export type LodgingVote = {
  tripId: string;
  destinationId: string;
  propertyId: string;
  voterId: string;
  voterEmail: string;
  voterName: string;
  createdAt: string;
  updatedAt: string;
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

export type DestinationOption = {
  id: string;
  label: string;
};

export type DestinationProfile = {
  id: string;
  label: string;
  destinationCity: string;
  destinationShortLabel: string;
  destinationAirport: string;
  stayReferenceArea: string;
  nearbyLabel: string;
  airbnbSearchSlug: string;
  vrboKeywordPath: string;
  googleVacationRentalQuery: string;
  flightSearchDestinationLabel: string;
  propertyHeading: string;
  activityHeading: string;
  activityRailLabel: string;
  heroTitle: string;
  heroImageUrl: string;
  generatedFolder: string;
  carRentalModel: {
    pickupLocation: string;
    preferredSmallFamilyVehicle: "SUV";
    preferredLargeFamilyVehicle: "Minivan";
    tripLengthDays: number;
  };
};

export type MealModel = {
  adultEatOutMealCost: number;
  childEatOutMealCost: number;
  adultEatInMealCost: number;
  childEatInMealCost: number;
  eatOutMeals: number;
  eatInMeals: number;
};

export type TripConfig = {
  destinationId: string;
  destinationLabel: string;
  destinationCity: string;
  destinationShortLabel: string;
  destinationAirport: string;
  checkInDate: string;
  checkOutDate: string;
  nights: number;
  nearbyLabel: string;
  stayReferenceArea: string;
  airbnbSearchSlug: string;
  vrboKeywordPath: string;
  googleVacationRentalQuery: string;
  flightSearchDestinationLabel: string;
  propertyHeading: string;
  activityHeading: string;
  activityRailLabel: string;
  heroTitle: string;
  heroImageUrl: string;
  generatedFolder: string;
  activityParticipationRate: number;
  carRentalModel: {
    pickupLocation: string;
    preferredSmallFamilyVehicle: "SUV";
    preferredLargeFamilyVehicle: "Minivan";
    tripLengthDays: number;
  };
  mealModel: MealModel;
  families: Family[];
};
