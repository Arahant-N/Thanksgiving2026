import { tripConfig } from "@/data/config";
import type { Family, FlightOffer, PropertyListing } from "@/types/trip";

export type FamilyCostEstimate = {
  familyId: string;
  lodgingShare: number;
  foodShare: number;
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

export function buildFamilyCostEstimates(
  families: Family[],
  properties: PropertyListing[],
  flights: FlightOffer[]
) {
  const cheapestProperty = [...properties].sort(
    (left, right) => left.totalStayPrice - right.totalStayPrice
  )[0];
  const totalTravelers = families.reduce(
    (count, family) => count + getFamilyTravelerCount(family),
    0
  );
  const lodgingPerTraveler = cheapestProperty ? cheapestProperty.totalStayPrice / totalTravelers : 0;

  return families.map<FamilyCostEstimate>((family) => {
    const travelerCount = getFamilyTravelerCount(family);
    const lodgingShare = lodgingPerTraveler * travelerCount;
    const foodShare = getFoodShare(family);
    const economyFlightTotal = getFlightTotal(flights, family.id, "Economy");
    const economyPlusFlightTotal = getFlightTotal(flights, family.id, "Economy Plus");

    return {
      familyId: family.id,
      lodgingShare,
      foodShare,
      economyFlightTotal,
      economyPlusFlightTotal,
      economyTripTotal:
        economyFlightTotal === null ? null : lodgingShare + foodShare + economyFlightTotal,
      economyPlusTripTotal:
        economyPlusFlightTotal === null
          ? null
          : lodgingShare + foodShare + economyPlusFlightTotal
    };
  });
}
