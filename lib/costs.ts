import { tripConfig } from "@/data/config";
import type {
  Activity,
  CarRentalOffer,
  Family,
  FlightOffer,
  PropertyListing
} from "@/types/trip";

const minimumBedrooms = 8;
const minimumBathrooms = 6;
const minimumSleeps = 16;

export type FamilyCostEstimate = {
  familyId: string;
  lodgingShare: number;
  foodShare: number;
  activityShare: number;
  carRentalTotal: number | null;
  economyFlightTotal: number | null;
  economyPlusFlightTotal: number | null;
  economyTripTotal: number | null;
  economyPlusTripTotal: number | null;
};

function getFamilyTravelerCount(family: Family) {
  return family.adults + family.children;
}

function getFoodShare(family: Family) {
  const model = tripConfig.mealModel;
  const adultFood =
    family.adults *
    (model.eatOutMeals * model.adultEatOutMealCost +
      model.eatInMeals * model.adultEatInMealCost);
  const childFood =
    family.children *
    (model.eatOutMeals * model.childEatOutMealCost +
      model.eatInMeals * model.childEatInMealCost);

  return adultFood + childFood;
}

function getActivityShare(family: Family, activities: Activity[]) {
  const fullFeaturedActivitiesCost = activities
    .filter((activity) => activity.includedInBudget)
    .reduce((sum, activity) => sum + activity.costPerPerson, 0);
  const plannedActivitiesCost =
    fullFeaturedActivitiesCost * tripConfig.activityParticipationRate;

  return plannedActivitiesCost * getFamilyTravelerCount(family);
}

function getFlightTotal(
  offers: FlightOffer[],
  familyId: string,
  cabin: "Economy" | "Economy Plus"
) {
  const matchingOffers = offers.filter(
    (item) => item.familyId === familyId && item.cabin === cabin
  );

  if (matchingOffers.length === 0) {
    return null;
  }

  return matchingOffers.reduce((lowest, offer) =>
    offer.totalPrice < lowest ? offer.totalPrice : lowest
  , matchingOffers[0].totalPrice);
}

function getCarRentalTotal(offers: CarRentalOffer[], familyId: string) {
  const matchingOffers = offers.filter((item) => item.familyId === familyId);

  if (matchingOffers.length === 0) {
    return null;
  }

  return matchingOffers.reduce((lowest, offer) =>
    offer.estimatedTripTotal < lowest ? offer.estimatedTripTotal : lowest
  , matchingOffers[0].estimatedTripTotal);
}

function hasPlausibleLargeGroupPrice(property: PropertyListing) {
  if (!property.totalStayPrice) {
    return false;
  }

  if (
    property.bedrooms < minimumBedrooms ||
    property.bathrooms < minimumBathrooms ||
    property.sleeps < minimumSleeps
  ) {
    return false;
  }

  if (property.sleeps < 16 || property.sleeps > 40) {
    return false;
  }

  if (property.bedrooms >= 7 || property.bathrooms >= 5 || property.sleeps >= 16) {
    return property.totalStayPrice >= 1500;
  }

  return property.totalStayPrice >= 400;
}

export function buildFamilyCostEstimates(
  families: Family[],
  properties: PropertyListing[],
  flights: FlightOffer[],
  cars: CarRentalOffer[],
  activities: Activity[]
) {
  const cheapestProperty = [...properties]
    .filter(hasPlausibleLargeGroupPrice)
    .sort((left, right) => left.totalStayPrice - right.totalStayPrice)[0];
  const totalTravelers = families.reduce(
    (count, family) => count + getFamilyTravelerCount(family),
    0
  );
  const lodgingPerTraveler = cheapestProperty ? cheapestProperty.totalStayPrice / totalTravelers : 0;

  return families.map<FamilyCostEstimate>((family) => {
    const travelerCount = getFamilyTravelerCount(family);
    const lodgingShare = lodgingPerTraveler * travelerCount;
    const foodShare = getFoodShare(family);
    const activityShare = getActivityShare(family, activities);
    const carRentalTotal = getCarRentalTotal(cars, family.id);
    const economyFlightTotal = getFlightTotal(flights, family.id, "Economy");
    const economyPlusFlightTotal = getFlightTotal(flights, family.id, "Economy Plus");

    return {
      familyId: family.id,
      lodgingShare,
      foodShare,
      activityShare,
      carRentalTotal,
      economyFlightTotal,
      economyPlusFlightTotal,
      economyTripTotal:
        economyFlightTotal === null
          ? null
          : lodgingShare +
            foodShare +
            activityShare +
            (carRentalTotal || 0) +
            economyFlightTotal,
      economyPlusTripTotal:
        economyPlusFlightTotal === null
          ? null
          : lodgingShare +
            foodShare +
            activityShare +
            (carRentalTotal || 0) +
            economyPlusFlightTotal
    };
  });
}
