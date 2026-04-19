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
npm run collect:live
```

`npm run refresh:demo` still exists for UI-only fallback work, but the app now expects live snapshots in `data/generated` for flights, restaurants, and homes.

## Editable Data

- Trip and family configuration: `data/config.ts`
- Generated property data: `data/generated/properties.json`
- Generated flight data: `data/generated/flights.json`
- Generated restaurant data: `data/generated/restaurants.json`

## Notes

- The app reads the generated snapshots in `data/generated` and does not treat seed data as live data.
- `npm run collect:flights` requires `SKYSCANNER_API_KEY`.
- `npm run collect:restaurants` requires `YELP_API_KEY`.
- `npm run collect:properties` is an on-demand Playwright scraper that runs from your local machine using your own browser session.
