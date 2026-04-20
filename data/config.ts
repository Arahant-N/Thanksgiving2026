import { defaultDestinationId, getDestinationProfile, listDestinationOptions } from "@/data/destinations";
import type { Family, MealModel, TripConfig } from "@/types/trip";

export const checkInDate = "2026-11-25";
export const checkOutDate = "2026-11-29";
export const nights = 4;
export const activityParticipationRate = 0.5;

export const mealModel: MealModel = {
  adultEatOutMealCost: 28,
  childEatOutMealCost: 16,
  adultEatInMealCost: 12,
  childEatInMealCost: 8,
  eatOutMeals: 4,
  eatInMeals: 4
};

export const families: Family[] = [
  {
    id: "kumaran",
    familyName: "Kumaran Family",
    homeBase: "Troy, Michigan",
    airportCode: "DTW",
    adults: 2,
    children: 2,
    teenagers: 2,
    childrenUnder12: 0,
    infants: 0,
    members: ["Lavanya", "Adithi", "Nithilan", "Kumaran Palani"]
  },
  {
    id: "chandrasekaran",
    familyName: "Chandrasekaran Family",
    homeBase: "Redwood City, California",
    airportCode: "SFO",
    adults: 2,
    children: 2,
    teenagers: 0,
    childrenUnder12: 1,
    infants: 1,
    members: ["Deepak", "Tara", "Lyra", "Lina"],
    notes: "Children: Lyra (4), Lina (1)."
  },
  {
    id: "vaithilingam",
    familyName: "Vaithilingam Family",
    homeBase: "San Ramon, California",
    airportCode: "OAK",
    adults: 2,
    children: 2,
    teenagers: 1,
    childrenUnder12: 1,
    infants: 0,
    members: ["Ganesh", "Ramya", "Krishna", "Madhava"],
    notes: "Children: Krishna (13), Madhava (9)."
  },
  {
    id: "ajagane",
    familyName: "Ajagane Family",
    homeBase: "San Mateo, California",
    airportCode: "SFO",
    adults: 2,
    children: 1,
    teenagers: 0,
    childrenUnder12: 1,
    infants: 0,
    members: ["Nivasse", "Mridhoula", "Shaya"]
  },
  {
    id: "venkatesan-i",
    familyName: "Venkatesan Family I",
    homeBase: "Seattle, Washington",
    airportCode: "SEA",
    adults: 2,
    children: 2,
    teenagers: 1,
    childrenUnder12: 1,
    infants: 0,
    members: ["Karthick", "Priyadarshini", "Aditya", "Iniya"],
    notes: "Children: Aditya (15), Iniya (6)."
  },
  {
    id: "venkatesan-ii",
    familyName: "Venkatesan Family II",
    homeBase: "Columbus, Ohio",
    airportCode: "CMH",
    adults: 2,
    children: 2,
    teenagers: 1,
    childrenUnder12: 1,
    infants: 0,
    members: ["Vikneswaran", "Keerthi", "Vasi", "Vaibhav"],
    notes: "Children: Vasi (12), Vaibhav (6)."
  },
  {
    id: "aravind-keerthana",
    familyName: "Aravind + Keerthana",
    homeBase: "San Jose, California",
    airportCode: "SJC",
    adults: 2,
    children: 0,
    teenagers: 0,
    childrenUnder12: 0,
    infants: 0,
    members: ["Aravind", "Keerthana"]
  }
];

export function getTripConfig(destinationId = defaultDestinationId): TripConfig {
  const destination = getDestinationProfile(destinationId);

  return {
    destinationId: destination.id,
    destinationLabel: destination.label,
    destinationCity: destination.destinationCity,
    destinationShortLabel: destination.destinationShortLabel,
    destinationAirport: destination.destinationAirport,
    checkInDate,
    checkOutDate,
    nights,
    nearbyLabel: destination.nearbyLabel,
    stayReferenceArea: destination.stayReferenceArea,
    airbnbSearchSlug: destination.airbnbSearchSlug,
    vrboKeywordPath: destination.vrboKeywordPath,
    googleVacationRentalQuery: destination.googleVacationRentalQuery,
    flightSearchDestinationLabel: destination.flightSearchDestinationLabel,
    propertyHeading: destination.propertyHeading,
    activityHeading: destination.activityHeading,
    activityRailLabel: destination.activityRailLabel,
    heroTitle: destination.heroTitle,
    heroImageUrl: destination.heroImageUrl,
    generatedFolder: destination.generatedFolder,
    activityParticipationRate,
    carRentalModel: destination.carRentalModel,
    mealModel,
    families
  };
}

export function getDestinationOptions() {
  return listDestinationOptions();
}

export const tripConfig = getTripConfig();

export const totalTravelers = families.reduce((count, family) => count + family.adults + family.children, 0);
