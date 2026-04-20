import type { DestinationOption, DestinationProfile } from "@/types/trip";

export const defaultDestinationId = "asheville";

const destinationProfiles: Record<string, DestinationProfile> = {
  asheville: {
    id: "asheville",
    label: "Asheville",
    destinationCity: "Asheville, North Carolina",
    destinationShortLabel: "Asheville, NC",
    destinationAirport: "AVL",
    stayReferenceArea: "Downtown Asheville",
    nearbyLabel: "Asheville",
    airbnbSearchSlug: "Asheville--NC",
    vrboKeywordPath: "Asheville--North-Carolina--United-States-of-America",
    googleVacationRentalQuery: "Asheville NC vacation rental",
    flightSearchDestinationLabel: "Asheville",
    propertyHeading: "Historic homes and estates near Asheville",
    activityHeading: "Popular Asheville picks for the group",
    activityRailLabel: "Popular Asheville activities",
    heroTitle: "Asheville Thanksgiving 2026",
    heroImageUrl: "/asheville-hero.png",
    generatedFolder: "asheville",
    carRentalModel: {
      pickupLocation: "Asheville Regional Airport (AVL)",
      preferredSmallFamilyVehicle: "SUV",
      preferredLargeFamilyVehicle: "Minivan",
      tripLengthDays: 4
    }
  }
};

export function getDestinationProfile(destinationId: string) {
  return destinationProfiles[destinationId] || destinationProfiles[defaultDestinationId];
}

export function listDestinationOptions(): DestinationOption[] {
  return Object.values(destinationProfiles).map((profile) => ({
    id: profile.id,
    label: profile.label
  }));
}

export function isKnownDestinationId(destinationId: string | undefined | null): destinationId is string {
  return Boolean(destinationId && destinationProfiles[destinationId]);
}
