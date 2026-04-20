import type { CSSProperties } from "react";

import { GoogleVoteAuthButton } from "@/components/google-vote-auth-button";
import { MapExplorer } from "@/components/map-explorer";
import { formatCompactDateRange, formatCurrency, formatDateRange, formatStops } from "@/lib/format";
import {
  getOfferHref,
  getOfferLinkLabel,
  getFlightHref,
  getFlightLinkLabel,
} from "@/lib/links";
import {
  getBestKnownOffer,
  getBestVerifiedOffer,
  getDirectSavingsVsAirbnb,
  getEffectiveTotalStayPrice,
  getEffectiveNightlyRate,
  getPropertyOffers
} from "@/lib/property-pricing";
import { countVotesForProperty } from "@/lib/voting";
import type { FamilyCostEstimate } from "@/lib/costs";
import type {
  Activity,
  CarRentalOffer,
  Family,
  FlightOffer,
  LodgingVote,
  PropertyListing,
  PropertyOffer,
  Restaurant,
  TripConfig
} from "@/types/trip";

type DashboardProps = {
  trip: TripConfig;
  families: Family[];
  properties: PropertyListing[];
  recommendedProperties: PropertyListing[];
  heroProperty?: PropertyListing;
  budgetProperty?: PropertyListing;
  cheapestProperty?: PropertyListing;
  flights: FlightOffer[];
  cars: CarRentalOffer[];
  activities: Activity[];
  restaurants: Restaurant[];
  costEstimates: FamilyCostEstimate[];
  returnTo: string;
  lodgingVotes: LodgingVote[];
  viewerVote: LodgingVote | null;
  viewerVoter: {
    googleSub: string;
    email: string;
    name: string;
    isAllowed: boolean;
  } | null;
  leadingVote: {
    property: PropertyListing;
    count: number;
  } | null;
  googleVotingConfigured: boolean;
  votingStorageReady: boolean;
  voteMessage: string | null;
};

const flightSlots: Array<{
  cabin: "Economy" | "Economy Plus";
  stops: "Nonstop" | "1-stop";
  label: string;
}> = [
  { cabin: "Economy", stops: "Nonstop", label: "Economy Nonstop" },
  { cabin: "Economy", stops: "1-stop", label: "Economy 1-stop" },
  { cabin: "Economy Plus", stops: "Nonstop", label: "Economy Plus Nonstop" },
  { cabin: "Economy Plus", stops: "1-stop", label: "Economy Plus 1-stop" }
];

function getTravelerCount(family: Family) {
  return family.adults + family.children;
}

function findOffer(
  flights: FlightOffer[],
  familyId: string,
  cabin: "Economy" | "Economy Plus",
  stops: "Nonstop" | "1-stop"
) {
  return flights.find(
    (flight) => flight.familyId === familyId && flight.cabin === cabin && flight.stops === stops
  );
}

function findCost(costs: FamilyCostEstimate[], familyId: string) {
  return costs.find((cost) => cost.familyId === familyId);
}

function findCarOffer(cars: CarRentalOffer[], familyId: string) {
  return cars.find((offer) => offer.familyId === familyId);
}

function formatCompactMoney(value: number | null) {
  if (value === null) {
    return "--";
  }

  if (value === 0) {
    return "$0";
  }

  const compact = new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: value >= 10000 ? 0 : 1
  }).format(value);

  return `$${compact.replace("K", "k").replace("M", "m")}`;
}

function formatActivityCost(value: number) {
  return value === 0 ? "Free" : `${formatCurrency(value)} pp`;
}

function formatMoneyOrDash(value: number | null) {
  return value === null ? "--" : formatCompactMoney(value);
}

function getMissingFlightSummary(
  flights: FlightOffer[],
  familyId: string,
  slots: typeof flightSlots = flightSlots
) {
  const missingSlots = slots.filter(
    (slot) => !findOffer(flights, familyId, slot.cabin, slot.stops)
  );

  if (missingSlots.length === 0) {
    return null;
  }

  return `${missingSlots.length} options not yet captured — ${missingSlots
    .map((slot) => slot.label)
    .join(", ")}`;
}

function normalizeText(value: string) {
  return value.replace(/\u202f/g, " ").replace(/\s+/g, " ").trim();
}

function getAvailabilityLabel(property: PropertyListing) {
  if (property.availabilityStatus === "available") {
    return "Dates look available";
  }

  if (property.availabilityStatus === "unknown") {
    return "Availability needs click-check";
  }

  return "Dates unavailable";
}

function getPropertyTrustSignal(property: PropertyListing) {
  if (property.airbnbBadge === "Guest favorite") {
    return "Guest favorite";
  }

  if (property.airbnbBadge === "Superhost") {
    return "Superhost";
  }

  return null;
}

function getOfferShortLabel(offer: PropertyOffer) {
  if (offer.source === "Direct") {
    return "Direct";
  }

  return offer.source;
}

function formatOfferTotal(offer: PropertyOffer) {
  return offer.totalStayPrice && offer.totalStayPrice > 0
    ? formatCurrency(offer.totalStayPrice)
    : "Quote not captured";
}

function formatOfferMeta(offer: PropertyOffer) {
  const details: string[] = [];

  if (offer.nightlyRate && offer.nightlyRate > 0) {
    details.push(`${formatCurrency(offer.nightlyRate)} / night`);
  }

  details.push(offer.captureStatus === "verified" ? "verified total" : "link only");

  if (offer.notes) {
    details.push(offer.notes);
  }

  return details.join(" | ");
}

function getBestOfferSummary(property: PropertyListing) {
  const bestOffer = getBestVerifiedOffer(property);

  if (!bestOffer || !bestOffer.totalStayPrice) {
    return {
      heading: "No verified stay total yet",
      detail: "Live links are ready, but a public stay quote has not been captured yet."
    };
  }

  return {
    heading: formatCurrency(bestOffer.totalStayPrice),
    detail: `${bestOffer.label} verified total | ${
      bestOffer.nightlyRate && bestOffer.nightlyRate > 0
        ? `${formatCurrency(bestOffer.nightlyRate)} / night`
        : "4-night total captured"
    }`
  };
}

function getDirectSiteSummary(property: PropertyListing) {
  const directOffer = getPropertyOffers(property).find((offer) => offer.source === "Direct");

  if (!directOffer) {
    return null;
  }

  const prefix = directOffer.captureStatus === "verified" ? "Verified direct site" : "Direct site found";
  return `${prefix}: ${directOffer.label}`;
}

function PropertyPricingRows({ property }: { property: PropertyListing }) {
  const offers = getPropertyOffers(property);
  const pricedOffers = offers.filter((offer) => offer.totalStayPrice && offer.totalStayPrice > 0);
  const linkOnlyOffers = offers.filter((offer) => !offer.totalStayPrice || offer.totalStayPrice <= 0);
  const directSavings = getDirectSavingsVsAirbnb(property);

  return (
    <div className="property-price-stack">
      {pricedOffers.map((offer) => (
        <div className="property-price-row" key={offer.id}>
          <div>
            <p className="property-price-label">{getOfferShortLabel(offer)}</p>
            <p className="property-price-meta">{formatOfferMeta(offer)}</p>
          </div>
          <strong className="property-price-value">{formatOfferTotal(offer)}</strong>
        </div>
      ))}
      {pricedOffers.length === 0 ? (
        <p className="property-price-note">No public total stay quote is captured yet.</p>
      ) : null}
      {linkOnlyOffers.map((offer) => (
        <p className="property-price-note" key={offer.id}>
          {getOfferShortLabel(offer)} site found, but no public stay total is captured yet.
        </p>
      ))}
      {directSavings !== null ? (
        <p className="property-savings-line">
          {directSavings > 0
            ? `Direct saves ${formatCurrency(directSavings)} vs Airbnb`
            : directSavings < 0
              ? `Airbnb is ${formatCurrency(Math.abs(directSavings))} lower than direct`
              : "Direct matches Airbnb pricing"}
        </p>
      ) : null}
    </div>
  );
}

function PropertyActionLinks({
  property,
  trip,
  families
}: {
  property: PropertyListing;
  trip: TripConfig;
  families: Family[];
}) {
  const offers = getPropertyOffers(property);
  const primaryOffer = getBestKnownOffer(property);
  const secondaryOffers = offers.filter((offer) => offer.id !== primaryOffer?.id);

  return (
    <div className="property-link-row">
      {primaryOffer ? (
        <a
          className="inline-link"
          href={getOfferHref(primaryOffer, trip, families)}
          target="_blank"
          rel="noreferrer"
        >
          {primaryOffer.captureStatus === "verified" ? "Open best offer" : getOfferLinkLabel(primaryOffer)}
        </a>
      ) : null}
      {secondaryOffers.map((offer) => (
        <a
          className="inline-link inline-link--secondary"
          href={getOfferHref(offer, trip, families)}
          key={offer.id}
          target="_blank"
          rel="noreferrer"
        >
          {getOfferShortLabel(offer)}
        </a>
      ))}
    </div>
  );
}

function getPropertyDistanceMiles(property: PropertyListing) {
  return property.distanceFromCenterMiles ?? property.distanceFromAshevilleMiles ?? property.distanceToDowntownMiles ?? 0;
}

function buildGoogleMapsHref(query: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function getSupermarketMapPoints(trip: TripConfig) {
  if (trip.destinationId === "asheville") {
    return [
      {
        id: "supermarket-walmart",
        label: "Supermarket",
        title: "Walmart Supercenter",
        subtitle: "1636 Hendersonville Rd | broad one-stop supply run",
        query: "Walmart Supercenter, 1636 Hendersonville Rd, Asheville, NC 28803",
        latitude: 35.5308,
        longitude: -82.5279,
        href: buildGoogleMapsHref(
          "Walmart Supercenter, 1636 Hendersonville Rd, Asheville, NC 28803"
        )
      },
      {
        id: "supermarket-publix",
        label: "Supermarket",
        title: "Publix at Pinnacle Point",
        subtitle: "1830 Hendersonville Rd | polished grocery fallback",
        query: "Publix Super Market at Pinnacle Point, 1830 Hendersonville Rd, Asheville, NC 28803",
        latitude: 35.5278,
        longitude: -82.5286,
        href: buildGoogleMapsHref(
          "Publix Super Market at Pinnacle Point, 1830 Hendersonville Rd, Asheville, NC 28803"
        )
      },
      {
        id: "supermarket-harristeeter",
        label: "Supermarket",
        title: "Harris Teeter Village at Chestnut Street",
        subtitle: "136 Merrimon Ave | strongest downtown grocery anchor",
        query: "Harris Teeter, 136 Merrimon Ave, Asheville, NC 28801",
        latitude: 35.6064,
        longitude: -82.5558,
        href: buildGoogleMapsHref("Harris Teeter, 136 Merrimon Ave, Asheville, NC 28801")
      },
      {
        id: "supermarket-wholefoods",
        label: "Supermarket",
        title: "Whole Foods Market Asheville",
        subtitle: "70 Merrimon Ave | premium grocery option",
        query: "Whole Foods Market, 70 Merrimon Ave, Asheville, NC 28801",
        latitude: 35.6016,
        longitude: -82.5548,
        href: buildGoogleMapsHref("Whole Foods Market, 70 Merrimon Ave, Asheville, NC 28801")
      }
    ];
  }

  return [
    {
      id: `supermarket-${trip.destinationId}`,
      label: "Supermarket",
      title: `Supermarket near ${trip.stayReferenceArea}`,
      subtitle: `Generic grocery search anchor for ${trip.destinationShortLabel}.`,
      query: `supermarket near ${trip.stayReferenceArea}, ${trip.destinationCity}`,
      latitude: 35.5951,
      longitude: -82.5515,
      href: buildGoogleMapsHref(`supermarket near ${trip.stayReferenceArea}, ${trip.destinationCity}`)
    }
  ];
}

function getPropertyMapCoordinates(property: PropertyListing, trip: TripConfig) {
  const area = normalizeText(property.area || trip.destinationCity).toLowerCase();

  if (area.includes("marshall")) {
    return { latitude: 35.7973, longitude: -82.6846 };
  }

  if (area.includes("alexander")) {
    return { latitude: 35.6982, longitude: -82.6293 };
  }

  if (area.includes("swannanoa")) {
    return { latitude: 35.6009, longitude: -82.4023 };
  }

  if (area.includes("penrose")) {
    return { latitude: 35.2284, longitude: -82.6437 };
  }

  if (area.includes("asheville")) {
    return { latitude: 35.5951, longitude: -82.5515 };
  }

  return { latitude: 35.5951, longitude: -82.5515 };
}

function formatCarrierLabel(value: string) {
  const normalized = normalizeText(value)
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\bAirline\b/g, "Airlines");

  return normalized
    .replace(/^American Airlines$/i, "American Airlines")
    .replace(/^Delta Airlines$/i, "Delta")
    .replace(/^United Airlines$/i, "United")
    .replace(/^Southwest Airlines$/i, "Southwest")
    .trim();
}

function getCarrierMeta(value: string) {
  const label = formatCarrierLabel(value);
  const mappings = [
    { match: /american/i, code: "AA", name: "American Airlines" },
    { match: /delta/i, code: "DL", name: "Delta" },
    { match: /united/i, code: "UA", name: "United" },
    { match: /alaska/i, code: "AS", name: "Alaska" },
    { match: /southwest/i, code: "WN", name: "Southwest" }
  ];

  const match = mappings.find((candidate) => candidate.match.test(label));
  return {
    label,
    logoUrl: match
      ? `https://www.gstatic.com/flights/airline_logos/70px/${match.code}.png`
      : null,
    monogram: match?.code || label.slice(0, 2).toUpperCase()
  };
}

function parseFlightSummary(summary: string) {
  const normalized = normalizeText(summary);
  const match = normalized.match(/^([A-Z]{3})\s+(.+?)\s+->\s+([A-Z]{3})\s+(.+)$/);

  if (!match) {
    return {
      fromAirport: "",
      fromTime: normalized,
      toAirport: "",
      toTime: ""
    };
  }

  return {
    fromAirport: match[1],
    fromTime: match[2],
    toAirport: match[3],
    toTime: match[4]
  };
}

function FlightTimeline({ offer }: { offer: FlightOffer }) {
  const segment = parseFlightSummary(offer.departSummary);

  return (
    <div className="flight-timeline">
      <p className="flight-timeline-duration">
        {offer.durationLabel} | {formatStops(offer.stops)}
      </p>
      <div className="flight-timeline-track" aria-hidden="true">
        <span className="flight-timeline-dot" />
        <span className="flight-timeline-line" />
        <span className="flight-timeline-dot" />
      </div>
      <div className="flight-timeline-points">
        <div>
          <strong>{segment.fromTime}</strong>
          <span>{segment.fromAirport}</span>
        </div>
        <div>
          <strong>{segment.toTime}</strong>
          <span>{segment.toAirport}</span>
        </div>
      </div>
    </div>
  );
}

function FlightCell({
  family,
  offer,
  trip,
  lowestPrice
}: {
  family: Family;
  offer: FlightOffer | undefined;
  trip: TripConfig;
  lowestPrice: number | null;
}) {
  if (!offer) {
    return <div className="flight-cell flight-cell--empty">--</div>;
  }

  const carrier = getCarrierMeta(offer.carrierLabel);
  const isLowest = lowestPrice !== null && offer.perTravelerPrice === lowestPrice;

  return (
    <a
      className="flight-cell flight-cell--live"
      href={getFlightHref(family, offer, trip)}
      target="_blank"
      rel="noreferrer"
    >
      <div className="flight-price-block">
        <strong className={isLowest ? "flight-price flight-price--lowest" : "flight-price"}>
          {formatCurrency(offer.perTravelerPrice)}
          <span>pp</span>
        </strong>
        <span className="flight-total-price">{formatCurrency(offer.totalPrice)} total</span>
      </div>
      <div className="flight-carrier">
        {carrier.logoUrl ? (
          <img src={carrier.logoUrl} alt="" aria-hidden="true" />
        ) : (
          <span className="flight-carrier-monogram" aria-hidden="true">
            {carrier.monogram}
          </span>
        )}
        <span>{carrier.label}</span>
      </div>
      <FlightTimeline offer={offer} />
      <span className="flight-link-hint">
        {getFlightLinkLabel(offer)} <span aria-hidden="true">-&gt;</span>
      </span>
    </a>
  );
}

function PlaneIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path
        d="M21 15.5v-7l-8.5 3-4-6H6.8l2.4 6.9L5 14l-2-1.2v1.9l2 1.3 4.2-.7-2.4 6.7h1.7l4-5.7 8.5-.8Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function BedIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path
        d="M3.5 18.5v-9m0 5h17m0 4v-7.5m-6.5 3.5v-2.2a2.3 2.3 0 0 1 2.3-2.3h1.9a2.3 2.3 0 0 1 2.3 2.3v2.2m-16.5 0v-4a2 2 0 0 1 2-2h5.5a2 2 0 0 1 2 2v4"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function UtensilsIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path
        d="M6 3v7m-2.2-7v4.4A2.2 2.2 0 0 0 6 9.6a2.2 2.2 0 0 0 2.2-2.2V3M6 9.6V21M14.5 3c-1.6 1.8-2.5 4.2-2.5 6.7h4.3V21m0-11.3c0-2.4.6-4.8 2-6.7"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path
        d="M12 21s6-5.8 6-11a6 6 0 1 0-12 0c0 5.2 6 11 6 11Zm0-8.2a2.8 2.8 0 1 0 0-5.6 2.8 2.8 0 0 0 0 5.6Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function AssumptionCard({
  icon,
  label,
  value,
  emphasize = false
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div className="assumption-card">
      <div className="assumption-icon">{icon}</div>
      <div>
        <p className="assumption-label">{label}</p>
        <p className={emphasize ? "assumption-value assumption-value--accent" : "assumption-value"}>
          {value}
        </p>
      </div>
    </div>
  );
}

function EmptyCollectionCard({ title, detail }: { title: string; detail: string }) {
  return (
    <article className="family-card empty-collection-card">
      <div className="card-topline">
        <span>{title}</span>
      </div>
      <p className="note-line">{detail}</p>
    </article>
  );
}

function getVoteCountLabel(count: number) {
  return count === 1 ? "1 vote" : `${count} votes`;
}

function VotingSummaryStrip({
  returnTo,
  voteMessage,
  lodgingVotes,
  viewerVoter,
  leadingVote,
  googleVotingConfigured,
  votingStorageReady
}: {
  returnTo: string;
  voteMessage: string | null;
  lodgingVotes: LodgingVote[];
  viewerVoter: DashboardProps["viewerVoter"];
  leadingVote: DashboardProps["leadingVote"];
  googleVotingConfigured: boolean;
  votingStorageReady: boolean;
}) {
  return (
    <>
      <div className="vote-status-strip">
        <span>{lodgingVotes.length} authenticated ballots</span>
        <span>
          {leadingVote
            ? `${leadingVote.property.title} leading with ${getVoteCountLabel(leadingVote.count)}`
            : "No lodging leader yet"}
        </span>
        <span>
          {viewerVoter
            ? `Voting as ${viewerVoter.email}`
            : googleVotingConfigured
              ? "Google sign-in required to vote"
              : "Google voting not configured"}
        </span>
        {viewerVoter ? (
          <GoogleVoteAuthButton
            callbackUrl={`${returnTo}#stay-shortlist`}
            className="ghost-button ghost-button--small"
            label="Sign out of voting"
            mode="signout"
          />
        ) : googleVotingConfigured ? (
          <GoogleVoteAuthButton
            callbackUrl={`${returnTo}#stay-shortlist`}
            className="ghost-button ghost-button--small"
            label="Sign in with Google"
            mode="signin"
          />
        ) : null}
      </div>
      {voteMessage ? <p className="vote-message">{voteMessage}</p> : null}
      {!votingStorageReady ? (
        <p className="vote-message vote-message--muted">
          Voting works locally right now. Production needs Upstash Redis env vars to persist ballots.
        </p>
      ) : null}
    </>
  );
}

function PropertyVoteControls({
  property,
  trip,
  returnTo,
  voteCount,
  viewerVote,
  viewerVoter,
  googleVotingConfigured,
  votingStorageReady
}: {
  property: PropertyListing;
  trip: TripConfig;
  returnTo: string;
  voteCount: number;
  viewerVote: LodgingVote | null;
  viewerVoter: DashboardProps["viewerVoter"];
  googleVotingConfigured: boolean;
  votingStorageReady: boolean;
}) {
  const isSelected = viewerVote?.propertyId === property.id;

  return (
    <div className="property-vote-stack">
      <p className={voteCount > 0 ? "property-vote-count property-vote-count--live" : "property-vote-count"}>
        {getVoteCountLabel(voteCount)}
      </p>
      {!googleVotingConfigured ? (
        <p className="property-vote-note">Google voting is not configured yet.</p>
      ) : !votingStorageReady ? (
        <p className="property-vote-note">Vote storage still needs production Redis config.</p>
      ) : !viewerVoter ? (
        <GoogleVoteAuthButton
          callbackUrl={`${returnTo}#stay-shortlist`}
          className="inline-link inline-link--secondary"
          label="Sign in to vote"
          mode="signin"
        />
      ) : !viewerVoter.isAllowed ? (
        <p className="property-vote-note">This account is not on the approved voter list.</p>
      ) : (
        <form action="/api/votes" className="property-vote-form" method="post">
          <input name="returnTo" type="hidden" value={returnTo} />
          <input name="destinationId" type="hidden" value={trip.destinationId} />
          <input name="propertyId" type="hidden" value={property.id} />
          <button
            className={isSelected ? "inline-link inline-link--selected" : "inline-link inline-link--secondary"}
            type="submit"
          >
            {isSelected ? "Your top pick" : "Make top pick"}
          </button>
        </form>
      )}
    </div>
  );
}

function PropertyFeatureCard({
  property,
  label,
  trip,
  families,
  returnTo,
  voteCount,
  viewerVote,
  viewerVoter,
  googleVotingConfigured,
  votingStorageReady
}: {
  property: PropertyListing;
  label: "Hero recommendation" | "Budget recommendation";
  trip: TripConfig;
  families: Family[];
  returnTo: string;
  voteCount: number;
  viewerVote: LodgingVote | null;
  viewerVoter: DashboardProps["viewerVoter"];
  googleVotingConfigured: boolean;
  votingStorageReady: boolean;
}) {
  const bestOffer = getBestOfferSummary(property);

  return (
    <article className="property-feature-card">
      <div className="property-feature-media">
        {property.imageUrl ? (
          <img
            className="property-feature-image"
            src={property.imageUrl}
            alt={property.title}
            loading="lazy"
          />
        ) : (
          <div className="property-feature-image property-feature-image--empty" aria-hidden="true" />
        )}
      </div>
      <div className="property-feature-body">
        <div className="property-feature-header">
          <div className="property-feature-heading">
            <p className="property-feature-label">{label}</p>
            <h3>{property.title}</h3>
            <p className="property-feature-meta">
              {(property.area || `Near ${trip.nearbyLabel}`) +
                " | " +
                `${property.bedrooms} bd / ${property.bathrooms} ba` +
                " | " +
                `sleeps ${property.sleeps}`}
            </p>
          </div>
          <div className="property-best-offer">
            <p className="property-best-offer-label">Best verified offer</p>
            <strong>{bestOffer.heading}</strong>
            <span>{bestOffer.detail}</span>
          </div>
        </div>
        <div className="property-feature-facts">
          {getPropertyTrustSignal(property) ? (
            <div className="property-feature-fact">
              <span className="property-feature-fact-label">Signal</span>
              <strong className="property-trust-line">{getPropertyTrustSignal(property)}</strong>
            </div>
          ) : null}
          <div className="property-feature-fact">
            <span className="property-feature-fact-label">Distance</span>
            <strong>{getPropertyDistanceMiles(property)} mi from {trip.nearbyLabel}</strong>
          </div>
          <div className="property-feature-fact">
            <span className="property-feature-fact-label">Availability</span>
            <strong>{getAvailabilityLabel(property)}</strong>
          </div>
          {getDirectSiteSummary(property) ? (
            <div className="property-feature-fact">
              <span className="property-feature-fact-label">Direct site</span>
              <strong className="property-direct-line">{getDirectSiteSummary(property)}</strong>
            </div>
          ) : null}
        </div>
        <div className="property-feature-copy">
          <p className="note-line">
            {property.recommendationSummary || `Strong fit for a large family stay near ${trip.nearbyLabel}.`}
          </p>
          {property.privacyNotes ? <p className="property-privacy-line">{property.privacyNotes}</p> : null}
        </div>
        <PropertyPricingRows property={property} />
        <PropertyVoteControls
          property={property}
          trip={trip}
          returnTo={returnTo}
          voteCount={voteCount}
          viewerVote={viewerVote}
          viewerVoter={viewerVoter}
          googleVotingConfigured={googleVotingConfigured}
          votingStorageReady={votingStorageReady}
        />
        <PropertyActionLinks property={property} trip={trip} families={families} />
      </div>
    </article>
  );
}

function CarRentalCard({ family, offer }: { family: Family; offer?: CarRentalOffer }) {
  if (!offer) {
    return (
      <article className="car-rental-card car-rental-card--empty">
        <div className="car-rental-header">
          <div>
            <strong>{family.familyName}</strong>
            <span>{family.airportCode} arrival</span>
          </div>
          <p>No live car snapshot yet</p>
        </div>
        <p className="car-rental-missing">
          Preferred vehicle: {getTravelerCount(family) >= 4 ? "Minivan" : "SUV"}.
        </p>
      </article>
    );
  }

  return (
    <article className="car-rental-card">
      <div className="car-rental-header">
        <div>
          <strong>{family.familyName}</strong>
          <span>{offer.pickupLocation}</span>
        </div>
        <p>{offer.vehicleType}</p>
      </div>
      <div className="car-rental-price-block">
        <strong>{formatCurrency(offer.estimatedTripTotal)}</strong>
        <span>{offer.pricingContext}</span>
      </div>
      <div className="car-rental-meta">
        <span>
          {offer.vehicleLabel} • {offer.seats} seats
        </span>
        <span>{offer.supplier}</span>
        <span>
          Snapshot: {formatCurrency(offer.observedTotalPrice)} total • {formatCurrency(offer.dailyRate)}
          / day
        </span>
      </div>
      {offer.notes ? <p className="car-rental-note">{offer.notes}</p> : null}
      <a className="inline-link" href={offer.bookingUrl} target="_blank" rel="noreferrer">
        Open car offer
      </a>
    </article>
  );
}

function CarRentalTableCell({
  family,
  offer
}: {
  family: Family;
  offer?: CarRentalOffer;
}) {
  if (!offer) {
    return (
      <tr>
        <th className="car-table-family" scope="row">
          <strong>{family.familyName}</strong>
          <span>{tripLabelForFamilyAirport(family)}</span>
        </th>
        <td className="car-table-number car-table-number--missing">--</td>
        <td className="car-table-copy car-table-number--missing">--</td>
        <td className="car-table-copy">
          <span className="car-table-missing">No live offer captured yet</span>
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <th className="car-table-family" scope="row">
        <strong>{family.familyName}</strong>
        <span>{offer.pickupLocation}</span>
      </th>
      <td className="car-table-number" title={formatCurrency(offer.estimatedTripTotal)}>
        {formatCompactMoney(offer.estimatedTripTotal)}
      </td>
      <td className="car-table-copy">
        <strong>{offer.vehicleType}</strong>
        <span>
          {offer.vehicleLabel} | {offer.seats} seats
        </span>
      </td>
      <td className="car-table-copy">
        <strong>{offer.supplier}</strong>
        <span>{formatCurrency(offer.observedTotalPrice)} snapshot</span>
        <span>{formatCurrency(offer.dailyRate)} / day</span>
        <span>{offer.pricingContext}</span>
        <a className="inline-link" href={offer.bookingUrl} target="_blank" rel="noreferrer">
          Open offer
        </a>
        {offer.notes ? <small>{offer.notes}</small> : null}
      </td>
    </tr>
  );
}

function tripLabelForFamilyAirport(family: Family) {
  return `${family.airportCode} arrival`;
}

export function Dashboard({
  trip,
  families,
  properties,
  recommendedProperties,
  heroProperty,
  budgetProperty,
  cheapestProperty,
  flights,
  cars,
  activities,
  restaurants,
  costEstimates,
  returnTo,
  lodgingVotes,
  viewerVote,
  viewerVoter,
  leadingVote,
  googleVotingConfigured,
  votingStorageReady,
  voteMessage
}: DashboardProps) {
  const capturedFlightOffers = flights.length;
  const visibleFlightSlots = flightSlots.filter((slot) =>
    families.some((family) => findOffer(flights, family.id, slot.cabin, slot.stops))
  );
  const hiddenFlightSlots = flightSlots.filter(
    (slot) => !visibleFlightSlots.some((visibleSlot) => visibleSlot.label === slot.label)
  );
  const flightTableMinWidth = 220 + visibleFlightSlots.length * 320;
  const totalFlightSlots = families.length * visibleFlightSlots.length;
  const lowestPerTravelerPrice =
    flights.length > 0
      ? flights.reduce(
          (lowest, flight) =>
            flight.perTravelerPrice < lowest ? flight.perTravelerPrice : lowest,
          flights[0].perTravelerPrice
        )
      : null;
  const liveFamilies = families.filter((family) =>
    flights.some((offer) => offer.familyId === family.id)
  );
  const liveFamilyLabel =
    liveFamilies.length === 0
      ? "No families yet"
      : liveFamilies.length <= 3
        ? liveFamilies.map((family) => family.familyName.replace(" Family", "")).join(", ")
        : `${liveFamilies.length} families live`;
  const featuredActivityCostPerTraveler = activities
    .filter((activity) => activity.includedInBudget)
    .reduce((sum, activity) => sum + activity.costPerPerson, 0);
  const budgetedActivityCostPerTraveler =
    featuredActivityCostPerTraveler * trip.activityParticipationRate;
  const paidActivityCount = activities.filter((activity) => activity.costPerPerson > 0).length;
  const freeActivityCount = activities.length - paidActivityCount;
  const minivanCount = cars.filter((offer) => offer.vehicleType === "Minivan").length;
  const suvCount = cars.filter((offer) => offer.vehicleType === "SUV").length;
  const costRows = families
    .map((family) => {
      const cost = findCost(costEstimates, family.id);

      return {
        family,
        lodgingShare: cost?.lodgingShare ?? 0,
        foodShare: cost?.foodShare ?? 0,
        activityShare: cost?.activityShare ?? 0,
        carTotal: cost?.carRentalTotal ?? null,
        flightTotal: cost?.economyFlightTotal ?? null,
        economyTotal: cost?.economyTripTotal ?? null
      };
    });
  const capturedCostRows = costRows.filter((row) => row.economyTotal !== null);
  const capturedCostTotal = capturedCostRows.reduce(
    (sum, row) => sum + (row.economyTotal ?? 0),
    0
  );
  const pendingCostFamilies = costRows.length - capturedCostRows.length;
  const totalLodgingShare = costRows.reduce((sum, row) => sum + row.lodgingShare, 0);
  const totalCarShare = costRows.reduce((sum, row) => sum + (row.carTotal ?? 0), 0);
  const capturedFlightTotal = costRows.reduce((sum, row) => sum + (row.flightTotal ?? 0), 0);
  const totalFoodShare = costRows.reduce((sum, row) => sum + row.foodShare, 0);
  const totalActivityShare = costRows.reduce((sum, row) => sum + row.activityShare, 0);
  const compactTripDates = formatCompactDateRange(trip.checkInDate, trip.checkOutDate);
  const totalTravelers = families.reduce((sum, family) => sum + getTravelerCount(family), 0);
  const departureBases = new Set(families.map((family) => family.airportCode)).size;
  const featuredPropertyIds = new Set(
    [heroProperty?.id, budgetProperty?.id].filter((value): value is string => Boolean(value))
  );
  const shortlistProperties = recommendedProperties.filter(
    (property) => !featuredPropertyIds.has(property.id)
  );
  const stayMapPoints = properties.map((property, index) => ({
    id: `stay-${property.id}`,
    label: `Stay ${index + 1}`,
    title: property.title,
    subtitle: `${property.area || trip.nearbyLabel} | ${getPropertyDistanceMiles(property).toFixed(1)} mi from ${trip.nearbyLabel}`,
    query: `${property.title}, ${property.area || trip.destinationCity}, North Carolina`,
    ...getPropertyMapCoordinates(property, trip),
    href: buildGoogleMapsHref(`${property.title}, ${property.area || trip.destinationCity}, North Carolina`)
  }));
  const supermarketMapPoints = getSupermarketMapPoints(trip);
  const mapGroups = [
    {
      id: "stays",
      title: "Possible stay locations",
      subtitle: "Shortlisted stays plotted together so the spread is obvious at a glance.",
      points: stayMapPoints
    },
    {
      id: "supermarkets",
      title: "Nearest supermarkets",
      subtitle: "Quick supply-run anchors near the Asheville stay area.",
      points: supermarketMapPoints
    }
  ];

  return (
    <main className="page-shell">
      <section
        className="hero-card"
        style={
          {
            "--hero-image-url": `url("${trip.heroImageUrl}")`
          } as CSSProperties
        }
      >
        <div className="hero-copy">
          <p className="eyebrow">Private family planner</p>
          <h1>{trip.heroTitle}</h1>
          <p className="hero-text">
            One clean place to compare the stay, flights, restaurant options, and rough cost
            split for the cousin group.
          </p>
          <p className="hero-meta">
            {trip.destinationShortLabel} | {formatDateRange(trip.checkInDate, trip.checkOutDate)}
          </p>
          <div className="hero-stat-row">
            <div className="hero-stat">
              <strong>{trip.nights}</strong>
              <span>Nights</span>
            </div>
            <div className="hero-stat">
              <strong>{families.length}</strong>
              <span>Families</span>
            </div>
            <div className="hero-stat hero-stat--primary">
              <strong>{families.reduce((sum, family) => sum + getTravelerCount(family), 0)}</strong>
              <span>Travelers</span>
            </div>
            <div className="hero-stat hero-stat--date">
              <strong>{compactTripDates}</strong>
              <span>Dates</span>
            </div>
          </div>
        </div>
        <div className="hero-panel">
          <p className="hero-panel-kicker">The plan at a glance</p>
          <div className="assumption-grid">
            <AssumptionCard
              icon={<PlaneIcon />}
              label="Airport"
              value={trip.destinationAirport}
              emphasize
            />
            <AssumptionCard icon={<BedIcon />} label="Lodging" value="8 bed / 8 bath minimum" />
            <AssumptionCard icon={<UtensilsIcon />} label="Food split" value="50% eat out, 50% eat in" />
            <AssumptionCard icon={<PinIcon />} label="Stay zone" value={trip.stayReferenceArea} />
          </div>
        </div>
      </section>

      <section className="content-section">
        <div className="section-heading">
          <p className="eyebrow">Travel party</p>
          <h2>Family roster</h2>
        </div>
        <figure className="family-photo-frame">
          <img src="/group-photo.png" alt="Family group photo" loading="lazy" />
          <figcaption>The cousin crew</figcaption>
        </figure>
        <div className="family-roster-board">
          <div className="family-roster-summary">
            <div className="family-roster-stat">
              <strong>{families.length}</strong>
              <span>Families</span>
            </div>
            <div className="family-roster-stat">
              <strong>{totalTravelers}</strong>
              <span>Travelers</span>
            </div>
            <div className="family-roster-stat">
              <strong>{departureBases}</strong>
              <span>Airports</span>
            </div>
          </div>
          <div className="family-roster-list">
          {families.map((family) => (
            <article className="family-roster-row" key={family.id}>
              <div className="family-roster-head">
                <div>
                  <h3>{family.familyName}</h3>
                  <p className="family-roster-route">
                    {family.homeBase} | {family.airportCode}
                  </p>
                </div>
                <span className="family-roster-count">{getTravelerCount(family)}</span>
              </div>
              <p className="family-roster-members">{family.members.join(", ")}</p>
              {family.notes ? <p className="family-roster-note">{family.notes}</p> : null}
            </article>
          ))}
          </div>
        </div>
      </section>

      <section className="content-section">
        <div className="section-heading">
          <p className="eyebrow">Stay shortlist</p>
          <h2>{trip.propertyHeading}</h2>
        </div>
        <div id="stay-shortlist">
          <VotingSummaryStrip
            returnTo={returnTo}
            voteMessage={voteMessage}
            lodgingVotes={lodgingVotes}
            viewerVoter={viewerVoter}
            leadingVote={leadingVote}
            googleVotingConfigured={googleVotingConfigured}
            votingStorageReady={votingStorageReady}
          />
        </div>
        {heroProperty ? (
          <div className="property-feature-grid">
            <PropertyFeatureCard
              property={heroProperty}
              label="Hero recommendation"
              trip={trip}
              families={families}
              returnTo={returnTo}
              voteCount={countVotesForProperty(lodgingVotes, heroProperty.id)}
              viewerVote={viewerVote}
              viewerVoter={viewerVoter}
              googleVotingConfigured={googleVotingConfigured}
              votingStorageReady={votingStorageReady}
            />
            {budgetProperty && budgetProperty.id !== heroProperty.id ? (
              <PropertyFeatureCard
                property={budgetProperty}
                label="Budget recommendation"
                trip={trip}
                families={families}
                returnTo={returnTo}
                voteCount={countVotesForProperty(lodgingVotes, budgetProperty.id)}
                viewerVote={viewerVote}
                viewerVoter={viewerVoter}
                googleVotingConfigured={googleVotingConfigured}
                votingStorageReady={votingStorageReady}
              />
            ) : null}
          </div>
        ) : null}
        <div className="property-list">
          {properties.length === 0 ? (
            <EmptyCollectionCard
              title="No live property snapshot yet"
              detail="Run npm run collect:properties from your local machine to scrape homes on demand."
            />
          ) : shortlistProperties.length === 0 ? null : (
            shortlistProperties.map((property, index) => (
              <article className="property-card" key={property.id}>
                <div className="property-card-media">
                  {property.imageUrl ? (
                    <img
                      className="property-card-image"
                      src={property.imageUrl}
                      alt={property.title}
                      loading="lazy"
                    />
                  ) : (
                    <div className="property-card-image property-card-image--empty" aria-hidden="true" />
                  )}
                  <div className="property-rank">#{index + 1}</div>
                </div>
                <div className="property-main">
                  <div className="card-topline">
                    <span>{property.title}</span>
                    <strong>{getBestOfferSummary(property).heading}</strong>
                  </div>
                  <p className="muted-line">
                    {(property.area || property.source) +
                      " | " +
                      `${property.bedrooms} bd | ${property.bathrooms} ba | sleeps ${property.sleeps}`}
                  </p>
                  {property.recommendationSummary ? (
                    <p className="note-line">{property.recommendationSummary}</p>
                  ) : null}
                  {property.privacyNotes ? (
                    <p className="property-privacy-line">{property.privacyNotes}</p>
                  ) : null}
                  <div className="chip-row">
                    {property.highlights.map((highlight) => (
                      <span className="chip" key={highlight}>
                        {highlight}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="property-side">
                  {getPropertyTrustSignal(property) ? (
                    <p className="property-trust-line">{getPropertyTrustSignal(property)}</p>
                  ) : null}
                  <p>
                    {property.rating.toFixed(1)} stars | {property.reviewCount} reviews
                  </p>
                  <p>
                    {getPropertyDistanceMiles(property).toFixed(1)} mi from {trip.nearbyLabel}
                  </p>
                  <p>
                    {getEffectiveNightlyRate(property) > 0
                      ? `${formatCurrency(getEffectiveNightlyRate(property))} / night`
                      : "Live rate varies"}
                  </p>
                  <p>{getAvailabilityLabel(property)}</p>
                  {getDirectSiteSummary(property) ? (
                    <p className="property-direct-line">{getDirectSiteSummary(property)}</p>
                  ) : (
                    <p className="property-direct-line property-direct-line--muted">
                      No verified direct site found yet
                    </p>
                  )}
                  <PropertyPricingRows property={property} />
                  <PropertyVoteControls
                    property={property}
                    trip={trip}
                    returnTo={returnTo}
                    voteCount={countVotesForProperty(lodgingVotes, property.id)}
                    viewerVote={viewerVote}
                    viewerVoter={viewerVoter}
                    googleVotingConfigured={googleVotingConfigured}
                    votingStorageReady={votingStorageReady}
                  />
                  <PropertyActionLinks property={property} trip={trip} families={families} />
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="content-section content-section--flights">
        <div className="section-heading">
          <p className="eyebrow">Air travel</p>
          <h2>Flight snapshot</h2>
        </div>
        <div className="flight-status-strip">
          <span>
            {capturedFlightOffers} of {totalFlightSlots} visible options captured
          </span>
          <span>
            {lowestPerTravelerPrice === null
              ? "No live fare yet"
              : `${formatCurrency(lowestPerTravelerPrice)} pp lowest`}
          </span>
          <span>{liveFamilyLabel}</span>
          {hiddenFlightSlots.length > 0 ? (
            <span>
              No fares currently captured for {hiddenFlightSlots.map((slot) => slot.label).join(", ")}
            </span>
          ) : null}
        </div>
        <div className="flight-matrix-shell">
          {flights.length === 0 ? (
            <EmptyCollectionCard
              title="No live flight snapshot yet"
              detail="Run npm run collect:flights after adding a supported live flight data source to refresh aggregator pricing."
            />
          ) : visibleFlightSlots.length === 0 ? (
            <EmptyCollectionCard
              title="No comparable fare columns yet"
              detail="Live fares exist, but none of the standard fare buckets have enough captured data to render yet."
            />
          ) : (
            <table
              className={
                visibleFlightSlots.length === 1
                  ? "flight-table flight-table--single-column"
                  : "flight-table"
              }
              style={{ minWidth: `${flightTableMinWidth}px` }}
            >
              <thead>
                <tr>
                  <th scope="col">Family</th>
                  {visibleFlightSlots.map((slot) => (
                    <th key={`${slot.cabin}-${slot.stops}`} scope="col">
                      {slot.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {families.map((family) => {
                  const capturedCount = visibleFlightSlots.filter((slot) =>
                    findOffer(flights, family.id, slot.cabin, slot.stops)
                  ).length;
                  const missingSummary = getMissingFlightSummary(flights, family.id, visibleFlightSlots);

                  return (
                    <tr key={family.id}>
                      <th className="flight-table-family" scope="row">
                        <strong>{family.familyName}</strong>
                        <span>
                          {family.airportCode} | {capturedCount}/{flightSlots.length} captured
                        </span>
                        {missingSummary ? (
                          <small>{missingSummary.replace(" options not yet captured", " missing")}</small>
                        ) : null}
                      </th>
                      {visibleFlightSlots.map((slot) => (
                        <td key={`${family.id}-${slot.cabin}-${slot.stops}`}>
                          <FlightCell
                            family={family}
                            offer={findOffer(flights, family.id, slot.cabin, slot.stops)}
                            trip={trip}
                            lowestPrice={lowestPerTravelerPrice}
                          />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section className="content-section">
        <div className="section-heading">
          <p className="eyebrow">Ground transport</p>
          <h2>Rental car snapshot</h2>
        </div>
        <div className="activity-status-strip">
          <span>
            {cars.length} of {families.length} family cars estimated
          </span>
          <span>
            {minivanCount} minivan + {suvCount} SUV
          </span>
          <span>{trip.carRentalModel.pickupLocation}</span>
        </div>
        {cars.length === 0 ? (
          <EmptyCollectionCard
            title="No live car snapshot yet"
            detail={`Run npm run collect:cars to refresh ${trip.destinationAirport} minivan and SUV pricing.`}
          />
        ) : (
          <div className="car-table-shell">
            <table className="car-table">
              <thead>
                <tr>
                  <th scope="col">Family</th>
                  <th scope="col">Est total</th>
                  <th scope="col">Vehicle</th>
                  <th scope="col">Offer</th>
                </tr>
              </thead>
              <tbody>
                {families.map((family) => (
                  <CarRentalTableCell
                    key={family.id}
                    family={family}
                    offer={findCarOffer(cars, family.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="content-section">
        <div className="section-heading">
          <p className="eyebrow">Dining</p>
          <h2>Indian restaurants near the stay area</h2>
        </div>
        <div className="restaurant-list">
          {restaurants.length === 0 ? (
            <EmptyCollectionCard
              title="No live restaurant snapshot yet"
              detail="Run npm run collect:restaurants to refresh South Indian and Tamil-focused results near the stay area."
            />
          ) : (
            <div className="restaurant-rail" aria-label="South Indian and Tamil restaurant picks">
              {restaurants.map((restaurant) => (
                <article className="restaurant-rail-card" key={restaurant.id}>
                  <div className="restaurant-card-media">
                    {restaurant.imageUrl ? (
                      <img
                        className="restaurant-card-image"
                        src={restaurant.imageUrl}
                        alt={restaurant.name}
                        loading="lazy"
                      />
                    ) : (
                      <div
                        className="restaurant-card-image restaurant-card-image--empty"
                        aria-hidden="true"
                      />
                    )}
                  </div>
                  <div className="restaurant-rail-body">
                    <div className="restaurant-card-header">
                      <p className="restaurant-card-title">{restaurant.name}</p>
                      <p className="restaurant-card-rating">
                        {restaurant.rating.toFixed(1)} | {restaurant.reviewCount} reviews
                      </p>
                    </div>
                    <p className="muted-line">
                      {restaurant.neighborhood} | {restaurant.priceTier} |{" "}
                      {restaurant.distanceMiles.toFixed(1)} mi away
                    </p>
                    <p className="note-line">{restaurant.notes}</p>
                    <p className="restaurant-rail-tags">{restaurant.cuisineTags.join(" • ")}</p>
                  </div>
                  <div className="restaurant-rail-links">
                    <a
                      className="inline-link"
                      href={restaurant.websiteUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Website
                    </a>
                    <a
                      className="inline-link"
                      href={restaurant.mapUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open map
                    </a>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="content-section">
        <div className="section-heading">
          <p className="eyebrow">Things to do</p>
          <h2>{trip.activityHeading}</h2>
        </div>
        <div className="activity-status-strip">
          <span>{activities.length} featured ideas</span>
          <span>
            {paidActivityCount} paid + {freeActivityCount} free
          </span>
          <span>
            {formatCurrency(featuredActivityCostPerTraveler)} pp full slate |{" "}
            {formatCurrency(budgetedActivityCostPerTraveler)} pp budgeted
          </span>
        </div>
        <div className="activity-rail" aria-label={trip.activityRailLabel}>
          {activities.map((activity) => (
            <article className="activity-card" key={activity.id}>
              <img
                className="activity-card-image"
                src={activity.imageUrl}
                alt={activity.name}
                loading="lazy"
              />
              <div className="activity-card-body">
                <div className="card-topline">
                  <span>{activity.name}</span>
                  <strong>{formatActivityCost(activity.costPerPerson)}</strong>
                </div>
                <p className="muted-line">{activity.area}</p>
                <p className="note-line">{activity.description}</p>
                <p className="activity-card-note">{activity.priceNote}</p>
              </div>
              <a
                className="inline-link"
                href={activity.websiteUrl}
                target="_blank"
                rel="noreferrer"
              >
                Open activity
              </a>
            </article>
          ))}
        </div>
      </section>

      <section className="content-section">
        <div className="section-heading">
          <p className="eyebrow">Area map</p>
          <h2>Relative spread around the stay</h2>
        </div>
        <MapExplorer
          title={`${trip.destinationShortLabel} quick map`}
          subtitle="All stay candidates plus grocery anchors in one place. No toggles, no one-at-a-time map view."
          groups={mapGroups}
          apiKey={process.env.GOOGLE_MAPS_API_KEY || ""}
        />
      </section>

      <section className="content-section">
        <div className="section-heading">
          <p className="eyebrow">Budget</p>
          <h2>Cost so far</h2>
        </div>
        <div className="cost-summary-strip">
          <span>
            {capturedCostRows.length} of {costRows.length} family totals estimated
          </span>
          <span>{formatCurrency(capturedCostTotal)} captured</span>
          <span>
            {capturedCostRows.length === 0
              ? "No family average yet"
              : `avg ${formatCompactMoney(capturedCostTotal / capturedCostRows.length)} per family`}
          </span>
          <span>{formatCompactMoney(totalCarShare)} cars modeled</span>
        </div>
        <p className="budget-model-note">
          {cheapestProperty
            ? `Lodging model: ${cheapestProperty.title} (${cheapestProperty.area || trip.nearbyLabel}) at ${formatCurrency(getEffectiveTotalStayPrice(cheapestProperty))} best verified total stay. Car model: recent ${trip.destinationAirport} Expedia ${trip.carRentalModel.preferredLargeFamilyVehicle.toLowerCase()} / ${trip.carRentalModel.preferredSmallFamilyVehicle.toLowerCase()} snapshot scaled to ${trip.carRentalModel.tripLengthDays} days.`
            : `Lodging model: waiting on a qualifying live stay price. Car model: recent ${trip.destinationAirport} Expedia ${trip.carRentalModel.preferredLargeFamilyVehicle.toLowerCase()} / ${trip.carRentalModel.preferredSmallFamilyVehicle.toLowerCase()} snapshot scaled to ${trip.carRentalModel.tripLengthDays} days.`}
        </p>
        {/* Mobile uses the same scrollable table below; keep one comparison surface. */}
        <div className="cost-mobile-list" aria-hidden="true" hidden>
          {costRows.map((row) => (
            <article className="cost-mobile-card" key={`mobile-${row.family.id}`}>
              <div className="cost-mobile-header">
                <strong>{row.family.familyName}</strong>
                <span
                  className={
                    row.economyTotal === null
                      ? "cost-mobile-total cost-mobile-total--missing"
                      : "cost-mobile-total"
                  }
                >
                  {formatCompactMoney(row.economyTotal)}
                </span>
              </div>
              <div className="cost-mobile-grid">
                <div>
                  <span>Lodging</span>
                  <strong>{formatCompactMoney(row.lodgingShare)}</strong>
                </div>
                <div className="cost-mobile-grid-card cost-mobile-grid-card--transport">
                  <span>Transport</span>
                  <strong
                    className={
                      row.flightTotal === null && row.carTotal === null
                        ? "cost-mobile-total--missing"
                        : undefined
                    }
                  >
                    {formatMoneyOrDash(
                      row.flightTotal === null && row.carTotal === null
                        ? null
                        : (row.flightTotal ?? 0) + (row.carTotal ?? 0)
                    )}
                  </strong>
                  <p>
                    Flight {formatMoneyOrDash(row.flightTotal)} • Car {formatMoneyOrDash(row.carTotal)}
                  </p>
                </div>
                <div>
                  <span>Activities</span>
                  <strong>{formatCompactMoney(row.activityShare)}</strong>
                </div>
                <div>
                  <span>Food</span>
                  <strong>{formatCompactMoney(row.foodShare)}</strong>
                </div>
              </div>
            </article>
          ))}
          <article className="cost-mobile-card cost-mobile-card--totals">
            <div className="cost-mobile-header">
              <strong>Totals</strong>
              <span className="cost-mobile-total">{formatCompactMoney(capturedCostTotal)}</span>
            </div>
            <div className="cost-mobile-grid">
              <div>
                <span>Lodging</span>
                <strong>{formatCompactMoney(totalLodgingShare)}</strong>
              </div>
              <div className="cost-mobile-grid-card cost-mobile-grid-card--transport">
                <span>Transport</span>
                <strong>{formatCompactMoney(capturedFlightTotal + totalCarShare)}</strong>
                <p>
                  Flight {formatCompactMoney(capturedFlightTotal)} • Car {formatCompactMoney(totalCarShare)}
                </p>
              </div>
              <div>
                <span>Activities</span>
                <strong>{formatCompactMoney(totalActivityShare)}</strong>
              </div>
              <div>
                <span>Food</span>
                <strong>{formatCompactMoney(totalFoodShare)}</strong>
              </div>
            </div>
          </article>
        </div>
        <p className="cost-table-hint">Swipe sideways on mobile to compare all columns.</p>
        <div className="cost-table-shell">
          <table className="cost-table">
            <thead>
              <tr>
                <th scope="col">Family</th>
                <th scope="col">Total</th>
                <th scope="col">Stay</th>
                <th scope="col">Flight</th>
                <th scope="col">Car</th>
                <th scope="col">Activities</th>
                <th scope="col">Food</th>
              </tr>
            </thead>
            <tbody>
              {costRows.map((row) => {
                return (
                  <tr className="cost-table-row" key={row.family.id}>
                    <td className="cost-table-family">
                      <strong>{row.family.familyName}</strong>
                    </td>
                    <td
                      className={
                        row.economyTotal === null
                          ? "cost-table-number cost-table-number--missing"
                          : "cost-table-number cost-table-number--primary"
                      }
                      title={row.economyTotal === null ? undefined : formatCurrency(row.economyTotal)}
                    >
                      {formatCompactMoney(row.economyTotal)}
                    </td>
                    <td className="cost-table-number" title={formatCurrency(row.lodgingShare)}>
                      {formatCompactMoney(row.lodgingShare)}
                    </td>
                    <td className="cost-table-transport">
                      <strong
                        className={
                          row.flightTotal === null
                            ? "cost-table-number cost-table-number--missing"
                            : "cost-table-number"
                        }
                        title={row.flightTotal === null ? undefined : formatCurrency(row.flightTotal)}
                      >
                        {formatMoneyOrDash(row.flightTotal)}
                      </strong>
                    </td>
                    <td className="cost-table-transport">
                      <strong
                        className={
                          row.carTotal === null
                            ? "cost-table-number cost-table-number--missing"
                            : "cost-table-number"
                        }
                        title={row.carTotal === null ? undefined : formatCurrency(row.carTotal)}
                      >
                        {formatMoneyOrDash(row.carTotal)}
                      </strong>
                    </td>
                    <td className="cost-table-number" title={formatCurrency(row.activityShare)}>
                      {formatCompactMoney(row.activityShare)}
                    </td>
                    <td className="cost-table-number" title={formatCurrency(row.foodShare)}>
                      {formatCompactMoney(row.foodShare)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td>
                  <strong>Totals</strong>
                </td>
                <td className="cost-table-number">
                  {formatCompactMoney(capturedCostTotal)}
                </td>
                <td className="cost-table-number" title={formatCurrency(totalLodgingShare)}>
                  {formatCompactMoney(totalLodgingShare)}
                </td>
                <td className="cost-table-transport">
                  <strong className="cost-table-number" title={formatCurrency(capturedFlightTotal)}>
                    {formatCompactMoney(capturedFlightTotal)}
                  </strong>
                </td>
                <td className="cost-table-transport">
                  <strong className="cost-table-number" title={formatCurrency(totalCarShare)}>
                    {formatCompactMoney(totalCarShare)}
                  </strong>
                </td>
                <td className="cost-table-number" title={formatCurrency(totalActivityShare)}>
                  {formatCompactMoney(totalActivityShare)}
                </td>
                <td className="cost-table-number" title={formatCurrency(totalFoodShare)}>
                  {formatCompactMoney(totalFoodShare)}
                </td>
              </tr>
              <tr>
                <td colSpan={7} className="cost-table-meta">
                  {pendingCostFamilies} families still need live economy fares to complete totals.
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="cost-footnote">
          Total includes lodging, flight, rental car, food, and a 50% activity participation
          assumption.
        </p>
      </section>
    </main>
  );
}
