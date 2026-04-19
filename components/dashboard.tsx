import { formatCurrency, formatDateRange, formatStops } from "@/lib/format";
import type { FamilyCostEstimate } from "@/lib/costs";
import type { Family, FlightOffer, PropertyListing, Restaurant, TripConfig } from "@/types/trip";

type DashboardProps = {
  trip: TripConfig;
  families: Family[];
  properties: PropertyListing[];
  flights: FlightOffer[];
  restaurants: Restaurant[];
  costEstimates: FamilyCostEstimate[];
};

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

export function Dashboard({
  trip,
  families,
  properties,
  flights,
  restaurants,
  costEstimates
}: DashboardProps) {
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
          <div className="hero-pill-row">
            <span className="hero-pill">{formatDateRange(trip.checkInDate, trip.checkOutDate)}</span>
            <span className="hero-pill">{trip.destinationCity}</span>
            <span className="hero-pill">{families.length} families</span>
            <span className="hero-pill">
              {families.reduce((sum, family) => sum + getTravelerCount(family), 0)} travelers
            </span>
          </div>
        </div>
        <div className="hero-panel">
          <p className="panel-label">Trip assumptions</p>
          <ul className="metric-list">
            <li>
              <span>Airport</span>
              <strong>{trip.destinationAirport}</strong>
            </li>
            <li>
              <span>Lodging filter</span>
              <strong>8 bed / 8 bath minimum</strong>
            </li>
            <li>
              <span>Food split</span>
              <strong>50% eat out, 50% eat in</strong>
            </li>
            <li>
              <span>Primary stay zone</span>
              <strong>{trip.stayReferenceArea}</strong>
            </li>
          </ul>
        </div>
      </section>

      <section className="content-section">
        <div className="section-heading">
          <p className="eyebrow">Travel party</p>
          <h2>Family roster</h2>
        </div>
        <div className="family-grid">
          {families.map((family) => (
            <article className="family-card" key={family.id}>
              <div className="card-topline">
                <span>{family.familyName}</span>
                <strong>{getTravelerCount(family)} travelers</strong>
              </div>
              <p className="muted-line">
                {family.homeBase} · {family.airportCode}
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
          <h2>Top 10 properties by price</h2>
        </div>
        <div className="property-list">
          {properties.map((property, index) => (
            <article className="property-card" key={property.id}>
              <div className="property-rank">#{index + 1}</div>
              <div className="property-main">
                <div className="card-topline">
                  <span>{property.title}</span>
                  <strong>{formatCurrency(property.totalStayPrice)}</strong>
                </div>
                <p className="muted-line">
                  {property.source} · {property.bedrooms} bd · {property.bathrooms} ba · sleeps{" "}
                  {property.sleeps}
                </p>
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
                  {property.rating.toFixed(1)} stars · {property.reviewCount} reviews
                </p>
                <p>{property.distanceToDowntownMiles.toFixed(1)} mi to downtown</p>
                <p>{formatCurrency(property.nightlyRate)} / night</p>
                <a className="inline-link" href={property.url} target="_blank" rel="noreferrer">
                  View listing
                </a>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="content-section">
        <div className="section-heading">
          <p className="eyebrow">Air travel</p>
          <h2>Flight snapshot by family</h2>
        </div>
        <div className="flight-grid">
          {families.map((family) => {
            const offerSlots: Array<{
              cabin: "Economy" | "Economy Plus";
              stops: "Nonstop" | "1-stop";
            }> = [
              { cabin: "Economy", stops: "Nonstop" },
              { cabin: "Economy", stops: "1-stop" },
              { cabin: "Economy Plus", stops: "Nonstop" },
              { cabin: "Economy Plus", stops: "1-stop" }
            ];

            return (
              <article className="flight-card" key={family.id}>
                <div className="card-topline">
                  <span>{family.familyName}</span>
                  <strong>
                    {family.airportCode} {"->"} {trip.destinationAirport}
                  </strong>
                </div>
                <div className="flight-offers">
                  {offerSlots.map(({ cabin, stops }) => {
                    const offer = findOffer(flights, family.id, cabin, stops);

                    return offer ? (
                      <div className="offer-row" key={offer.id}>
                        <div>
                          <p className="offer-title">
                            {offer.cabin} · {formatStops(offer.stops)}
                          </p>
                          <p className="muted-line">
                            {offer.carrierLabel}
                          </p>
                          <p className="muted-line">
                            {offer.durationLabel} · {offer.departSummary}
                          </p>
                        </div>
                        <div className="offer-side">
                          <strong>{formatCurrency(offer.totalPrice)}</strong>
                          <span>{formatCurrency(offer.perTravelerPrice)} pp</span>
                          <a
                            className="inline-link"
                            href={offer.bookingUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Open offer
                          </a>
                        </div>
                      </div>
                    ) : (
                      <div className="offer-row offer-row--empty" key={`${family.id}-${cabin}-${stops}`}>
                        <div>
                          <p className="offer-title">
                            {cabin} · {formatStops(stops)}
                          </p>
                          <p className="muted-line">No option captured in the current snapshot.</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="content-section">
        <div className="section-heading">
          <p className="eyebrow">Dining</p>
          <h2>Indian restaurants near the stay area</h2>
        </div>
        <div className="restaurant-list">
          {restaurants.map((restaurant, index) => (
            <article className="restaurant-card" key={restaurant.id}>
              <div className="restaurant-rank">#{index + 1}</div>
              <div className="restaurant-main">
                <div className="card-topline">
                  <span>{restaurant.name}</span>
                  <strong>
                    {restaurant.rating.toFixed(1)} · {restaurant.reviewCount} reviews
                  </strong>
                </div>
                <p className="muted-line">
                  {restaurant.neighborhood} · {restaurant.priceTier} ·{" "}
                  {restaurant.distanceMiles.toFixed(1)} mi away
                </p>
                <div className="chip-row">
                  {restaurant.cuisineTags.map((tag) => (
                    <span className="chip" key={tag}>
                      {tag}
                    </span>
                  ))}
                </div>
                <p className="note-line">{restaurant.notes}</p>
              </div>
              <div className="property-side">
                <a
                  className="inline-link"
                  href={restaurant.websiteUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Website
                </a>
                <a className="inline-link" href={restaurant.mapUrl} target="_blank" rel="noreferrer">
                  Open map
                </a>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="content-section">
        <div className="section-heading">
          <p className="eyebrow">Budget</p>
          <h2>Estimated cost by family</h2>
        </div>
        <div className="cost-grid">
          {families.map((family) => {
            const cost = findCost(costEstimates, family.id);
            if (!cost) {
              return null;
            }

            return (
              <article className="cost-card" key={family.id}>
                <div className="card-topline">
                  <span>{family.familyName}</span>
                  <strong>{getTravelerCount(family)} travelers</strong>
                </div>
                <ul className="metric-list">
                  <li>
                    <span>Lodging share</span>
                    <strong>{formatCurrency(cost.lodgingShare)}</strong>
                  </li>
                  <li>
                    <span>Food share</span>
                    <strong>{formatCurrency(cost.foodShare)}</strong>
                  </li>
                  <li>
                    <span>Total with economy</span>
                    <strong>
                      {cost.economyTripTotal === null
                        ? "n/a"
                        : formatCurrency(cost.economyTripTotal)}
                    </strong>
                  </li>
                  <li>
                    <span>Total with economy plus</span>
                    <strong>
                      {cost.economyPlusTripTotal === null
                        ? "n/a"
                        : formatCurrency(cost.economyPlusTripTotal)}
                    </strong>
                  </li>
                </ul>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
