# Thanksgiving 2026 Asheville Planner

Private, mobile-first trip-planning site for the cousin group Thanksgiving trip to Asheville, North Carolina.

## Stack

- Next.js App Router + TypeScript
- Server-rendered dashboard with local JSON data files
- Simple password gate through Next middleware and cookies
- Local collector scripts for properties, flights, and restaurants
- Vercel-friendly deployment shape

## Local Setup

```bash
npm install
copy .env.example .env
npm run dev
```

Open `http://localhost:3000`.

If `VACATION_SITE_PASSWORD` is not set during local development, the fallback password is `asheville2026`.

## Key Commands

```bash
npm run dev
npm run typecheck
npm run refresh:demo
npm run collect:properties
npm run collect:flights
npm run collect:restaurants
```

`npm run refresh:demo` is optional. The repo already includes generated demo data for the first local run.

## Editable Data

- Trip and family configuration: `data/config.ts`
- Generated property data: `data/generated/properties.json`
- Generated flight data: `data/generated/flights.json`
- Generated restaurant data: `data/generated/restaurants.json`

## Notes

- The app is fully testable locally with seeded demo data.
- Flights are designed around SerpApi's Google Flights endpoints and booking-option links.
- Restaurant ranking is designed around Yelp Places search data.
- Vacation-rental collection is intentionally local-first because Airbnb's public API access is restricted and traveler-side listing access is not exposed as a normal public developer API.
