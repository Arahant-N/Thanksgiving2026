import { Fragment } from "react";

import { formatCompactDateRange, formatCurrency, formatDateRange, formatStops } from "@/lib/format";
import {
  getFlightHref,
  getFlightLinkLabel,
  getPropertyHref,
  getPropertyLinkLabel
} from "@/lib/links";
import type { FamilyCostEstimate } from "@/lib/costs";
import type {
  Activity,
  CarRentalOffer,
  Family,
  FlightOffer,
  PropertyListing,
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

function getMissingFlightSummary(flights: FlightOffer[], familyId: string) {
  const missingSlots = flightSlots.filter(
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

function FlightFamilyCard({
  family,
  flights,
  trip,
  lowestPrice
}: {
  family: Family;
  flights: FlightOffer[];
  trip: TripConfig;
  lowestPrice: number | null;
}) {
  const liveOffers = flightSlots
    .map((slot) => ({
      slot,
      offer: findOffer(flights, family.id, slot.cabin, slot.stops)
    }))
    .filter((entry): entry is { slot: (typeof flightSlots)[number]; offer: FlightOffer } =>
      Boolean(entry.offer)
    );
  const missingSummary = getMissingFlightSummary(flights, family.id);

  return (
    <article className="flight-family-card">
      <div className="flight-family-header">
        <div>
          <strong>{family.familyName}</strong>
          <span>{family.airportCode}</span>
        </div>
        <p>{liveOffers.length}/{flightSlots.length} captured</p>
      </div>
      {liveOffers.length > 0 ? (
        <div className="flight-family-offers">
          {liveOffers.map(({ slot, offer }) => (
            <div className="flight-family-offer" key={`${family.id}-${slot.cabin}-${slot.stops}`}>
              <p className="flight-family-slot">{slot.label}</p>
              <FlightCell family={family} offer={offer} trip={trip} lowestPrice={lowestPrice} />
            </div>
          ))}
        </div>
      ) : null}
      {missingSummary ? <p className="flight-family-missing">{missingSummary}</p> : null}
    </article>
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

function PropertyFeatureCard({
  property,
  label,
  trip,
  families
}: {
  property: PropertyListing;
  label: "Hero recommendation" | "Budget recommendation";
  trip: TripConfig;
  families: Family[];
}) {
  return (
    <article className="property-feature-card">
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
      <div className="property-feature-copy">
        <p className="property-feature-label">{label}</p>
        <h3>{property.title}</h3>
        <p className="property-feature-meta">
          {(property.area || "Near Asheville") +
            " | " +
            `${property.bedrooms} bd / ${property.bathrooms} ba` +
            " | " +
            `sleeps ${property.sleeps}`}
        </p>
        <p className="note-line">
          {property.recommendationSummary ||
            "Strong fit for a large family stay near Asheville."}
        </p>
      </div>
      <div className="property-feature-side">
        <strong>
          {property.totalStayPrice > 0
            ? `${formatCurrency(property.totalStayPrice)} total stay`
            : "Check live rate"}
        </strong>
        <span>
          {property.distanceFromAshevilleMiles || property.distanceToDowntownMiles || 0} mi from
          Asheville
        </span>
        <span>{getAvailabilityLabel(property)}</span>
        <a
          className="inline-link"
          href={getPropertyHref(property, trip, families)}
          target="_blank"
          rel="noreferrer"
        >
          {getPropertyLinkLabel(property)}
        </a>
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
  costEstimates
}: DashboardProps) {
  const capturedFlightOffers = flights.length;
  const totalFlightSlots = families.length * flightSlots.length;
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
  const flightMatrixStyle = {
    gridTemplateColumns: `168px repeat(${families.length}, minmax(180px, 1fr))`,
    minWidth: `${168 + families.length * 190}px`
  };
  const compactTripDates = formatCompactDateRange(trip.checkInDate, trip.checkOutDate);
  const featuredPropertyIds = new Set(
    [heroProperty?.id, budgetProperty?.id].filter((value): value is string => Boolean(value))
  );
  const shortlistProperties = recommendedProperties.filter(
    (property) => !featuredPropertyIds.has(property.id)
  );

  return (
    <main className="page-shell">
      <section className="hero-card">
        <div className="hero-copy">
          <p className="eyebrow">Private family planner</p>
          <h1>Asheville Thanksgiving 2026</h1>
          <p className="hero-text">
            One clean place to compare the stay, flights, restaurant options, and rough cost
            split for the cousin group.
          </p>
          <p className="hero-meta">
            Asheville, NC | {formatDateRange(trip.checkInDate, trip.checkOutDate)}
          </p>
          <div className="hero-stat-row">
            <div className="hero-stat">
              <strong>4</strong>
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
        <div className="family-grid">
          {families.map((family) => (
            <article className="family-card" key={family.id}>
              <div className="card-topline">
                <span>{family.familyName}</span>
                <strong>{getTravelerCount(family)} travelers</strong>
              </div>
              <p className="muted-line">
                {family.homeBase} | {family.airportCode}
              </p>
              <p className="member-list">{family.members.join(", ")}</p>
              {family.notes ? <p className="note-line">{family.notes}</p> : null}
            </article>
          ))}
        </div>
      </section>

      <section className="content-section">
        <div className="section-heading">
          <p className="eyebrow">Stay shortlist</p>
          <h2>Historic homes and estates near Asheville</h2>
        </div>
        {heroProperty ? (
          <div className="property-feature-grid">
            <PropertyFeatureCard
              property={heroProperty}
              label="Hero recommendation"
              trip={trip}
              families={families}
            />
            {budgetProperty && budgetProperty.id !== heroProperty.id ? (
              <PropertyFeatureCard
                property={budgetProperty}
                label="Budget recommendation"
                trip={trip}
                families={families}
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
                    <strong>
                      {property.totalStayPrice > 0
                        ? `${formatCurrency(property.totalStayPrice)} total stay`
                        : "Check live rate"}
                    </strong>
                  </div>
                  <p className="muted-line">
                    {(property.area || property.source) +
                      " | " +
                      `${property.bedrooms} bd | ${property.bathrooms} ba | sleeps ${property.sleeps}`}
                  </p>
                  {property.recommendationSummary ? (
                    <p className="note-line">{property.recommendationSummary}</p>
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
                  <p>
                    {property.rating.toFixed(1)} stars | {property.reviewCount} reviews
                  </p>
                  <p>
                    {(property.distanceFromAshevilleMiles || property.distanceToDowntownMiles || 0).toFixed(1)}{" "}
                    mi from Asheville
                  </p>
                  <p>
                    {property.nightlyRate > 0
                      ? `${formatCurrency(property.nightlyRate)} / night`
                      : "Live rate varies"}
                  </p>
                  <p>{getAvailabilityLabel(property)}</p>
                  <a
                    className="inline-link"
                    href={getPropertyHref(property, trip, families)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {getPropertyLinkLabel(property)}
                  </a>
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
            {capturedFlightOffers} of {totalFlightSlots} options captured
          </span>
          <span>
            {lowestPerTravelerPrice === null
              ? "No live fare yet"
              : `${formatCurrency(lowestPerTravelerPrice)} pp lowest`}
          </span>
          <span>{liveFamilyLabel}</span>
        </div>
        <div className="flight-matrix-shell">
          {flights.length === 0 ? (
            <EmptyCollectionCard
              title="No live flight snapshot yet"
              detail="Run npm run collect:flights after adding a supported live flight data source to refresh aggregator pricing."
            />
          ) : (
            <>
              <div className="flight-matrix flight-matrix--desktop" style={flightMatrixStyle}>
                <div className="flight-matrix-corner">Fare snapshot</div>
                {families.map((family) => {
                  const capturedCount = flightSlots.filter((slot) =>
                    findOffer(flights, family.id, slot.cabin, slot.stops)
                  ).length;

                  return (
                    <div className="flight-matrix-header" key={family.id}>
                      <strong>{family.familyName}</strong>
                      <span>
                        {family.airportCode} | {capturedCount}/{flightSlots.length} captured
                      </span>
                    </div>
                  );
                })}
                {flightSlots.map((slot) => (
                  <Fragment key={`${slot.cabin}-${slot.stops}`}>
                    <div className="flight-matrix-label">
                      <strong>{slot.label}</strong>
                    </div>
                    {families.map((family) => (
                      <FlightCell
                        key={`${family.id}-${slot.cabin}-${slot.stops}`}
                        family={family}
                        offer={findOffer(flights, family.id, slot.cabin, slot.stops)}
                        trip={trip}
                        lowestPrice={lowestPerTravelerPrice}
                      />
                    ))}
                  </Fragment>
                ))}
              </div>
              <div className="flight-family-list">
                {families.map((family) => (
                  <FlightFamilyCard
                    key={family.id}
                    family={family}
                    flights={flights}
                    trip={trip}
                    lowestPrice={lowestPerTravelerPrice}
                  />
                ))}
              </div>
            </>
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
            detail="Run npm run collect:cars to refresh AVL minivan and SUV pricing."
          />
        ) : (
          <div className="car-rental-grid">
            {families.map((family) => (
              <CarRentalCard
                key={family.id}
                family={family}
                offer={findCarOffer(cars, family.id)}
              />
            ))}
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
              {restaurants.map((restaurant, index) => (
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
                    <div className="restaurant-rank">#{index + 1}</div>
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
          <h2>Popular Asheville picks for the group</h2>
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
        <div className="activity-rail" aria-label="Popular Asheville activities">
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
            ? `Lodging model: ${cheapestProperty.title} (${cheapestProperty.area || "Asheville"}) at ${formatCurrency(cheapestProperty.totalStayPrice)} total stay. Car model: recent AVL Expedia ${trip.carRentalModel.preferredLargeFamilyVehicle.toLowerCase()} / ${trip.carRentalModel.preferredSmallFamilyVehicle.toLowerCase()} snapshot scaled to ${trip.carRentalModel.tripLengthDays} days.`
            : `Lodging model: waiting on a qualifying live stay price. Car model: recent AVL Expedia ${trip.carRentalModel.preferredLargeFamilyVehicle.toLowerCase()} / ${trip.carRentalModel.preferredSmallFamilyVehicle.toLowerCase()} snapshot scaled to ${trip.carRentalModel.tripLengthDays} days.`}
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
