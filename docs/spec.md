# Product Spec

## Product Name

Asheville Thanksgiving 2026 Planner

## Goal

Give the cousin group a private, polished planning website that centralizes:

- who is coming
- where everyone is flying from
- which large properties fit the trip
- what flights cost for each family
- where the best nearby Indian restaurants are
- what each family should roughly expect to pay

## Trip Context

- Destination: Asheville, North Carolina
- Dates: November 25, 2026 to November 29, 2026
- Audience: six related family groups, viewed mostly on phones
- Privacy: single shared password

## MVP Features

### 1. Family Roster

- Show each family, members, home city, traveler count, and departure airport.
- Make family metadata editable in code so names, airports, and counts can be adjusted later.

### 2. Property Recommendations

- Show top 10 group-friendly rentals in ascending order of price.
- Filter target: at least 8 bedrooms and at least 8 bathrooms.
- Include source, nightly price, trip-total price, sleeps, review score, and link out.
- Data refresh is local-script driven, not real-time in the browser.

### 3. Flight Comparison

- Show per-family round-trip flight options to Asheville Regional Airport (`AVL`).
- Show both `Economy` and `Economy Plus` views.
- Show `Nonstop` and `1-stop` options.
- Each offer links out to the source booking/search page.

### 4. Restaurant Ranking

- Show nearby Indian restaurants ranked in a Yelp-style format.
- Include rating, review count, cuisine tags, distance from central stay area, and map link.

### 5. Cost Projection

- Split lodging and group food by traveler count.
- Show each family's rough projected total with both economy and economy-plus flight assumptions.
- Food model assumes a 50/50 split between eating in and eating out.

### 6. Password Protection

- Require a shared password before accessing the planner.
- Keep auth simple for the first release.

## Non-Goals For MVP

- Full booking flow inside the app
- Multi-user accounts or invitations
- Real-time background refresh jobs
- Complex budget negotiations or custom split rules
- Admin CMS

# Technical Spec

## Architecture

- Framework: Next.js App Router with TypeScript
- Rendering: server-rendered pages for fast initial loads and simple local file access
- Styling: custom CSS with a premium editorial/travel visual direction
- Data source pattern: local generated JSON files + strongly typed trip config
- Authentication: cookie-based shared password gate via middleware
- Deployment target: Vercel Hobby

## Data Model

### Static Editable Config

- `data/config.ts`
- Stores trip metadata, family roster, meal assumptions, and default airport assumptions.

### Generated Files

- `data/generated/properties.json`
- `data/generated/flights.json`
- `data/generated/restaurants.json`

These files are overwritten by local collector scripts and are what the app reads at runtime.

## Provider Strategy

### Flights

- Primary provider choice: SerpApi Google Flights API
- Reason: supports structured Google Flights results, travel class filters, stop filters, and booking-option enrichment
- Official references:
  - [Google Flights API](https://serpapi.com/google-flights-api)
  - [Google Flights Booking Options API](https://serpapi.com/google-flights-booking-options)

### Restaurants

- Primary provider choice: Yelp Places API
- Reason: gives Yelp-style ratings, review counts, business metadata, and search by location/category
- Official references:
  - [Yelp Places Search](https://docs.developer.yelp.com/reference/v3_business_search)
  - [Yelp Places Authentication](https://docs.developer.yelp.com/docs/fusion-authentication)

### Properties

- Primary collection strategy: local collector scripts run on your PC, with provider adapters per source
- Airbnb is not treated as a normal public traveler API integration for this project; collection should stay local and refresh on demand
- Official reference used for the constraint:
  - [Airbnb API Terms](https://www.airbnb.com/terms/api)

## Security

- Shared password stored in `VACATION_SITE_PASSWORD`
- Cookie-based access gate for the whole site
- No sensitive API keys exposed to the browser
- Provider integrations run in local scripts or server-only code

## Hosting

- Recommended host: Vercel Hobby
- Reason: zero-cost personal deployment, direct Next.js support, easy env-var management
- Official reference:
  - [Vercel Hobby Plan](https://vercel.com/docs/accounts/plans/hobby)

## Local Workflow

1. Run the app locally with demo data.
2. Add keys later for live flight and restaurant pulls.
3. Run collector scripts on your machine whenever you want a refresh.
4. Redeploy after data or UI updates.

## Why Git

Yes, the project should use git.

- It gives you rollback when UI or data ingestion work breaks.
- It makes deployment to Vercel cleaner.
- It lets you evolve the site safely as the family list and travel assumptions change.
- It is the right baseline even for a private family tool.
