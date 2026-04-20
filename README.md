# Thanksgiving 2026 Asheville Planner

Private, mobile-first trip-planning site for the cousin group Thanksgiving trip to Asheville, North Carolina.

## Stack

- Next.js App Router + TypeScript
- Server-rendered dashboard with local JSON data files
- Simple password gate through Next middleware and cookies
- Local collector scripts for properties, flights, rental cars, and restaurants
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
npm run collect:cars
npm run collect:restaurants
npm run collect:live
npm run verify
```

`npm run refresh:demo` still exists for UI-only fallback work, but the app now expects live snapshots in `data/generated` for flights, rental cars, restaurants, and homes.

## Editable Data

- Trip and family configuration: `data/config.ts`
- Generated property data: `data/generated/properties.json`
- Generated flight data: `data/generated/flights.json`
- Generated car rental data: `data/generated/cars.json`
- Generated restaurant data: `data/generated/restaurants.json`

## Deployment

This app is ready to deploy as a normal Next.js app. The easiest path is Vercel.

### Before Deploying

1. Run your local collectors as needed so `data/generated/*.json` contains the latest snapshots you want to publish.
2. Run `npm run verify`.
3. Commit the updated generated JSON files along with the app changes.

The deployed site serves the committed snapshot files. Property, flight, car-rental, and restaurant collectors are still meant to run from your local machine, not on the host.

### Vercel Setup

1. Push the repo to GitHub.
2. Import the repo into Vercel.
3. Add the environment variable `VACATION_SITE_PASSWORD` for Production.
4. Deploy.

No extra build command is needed.

- Install command: `npm install`
- Build command: `npm run build`
- Output: Next.js default

### Recommended Production Env

- `VACATION_SITE_PASSWORD`
  This is required in production. There is no production fallback password.

### Optional Local Collector Env

- `PLAYWRIGHT_BROWSER_PATH`
- `BROWSER_USER_DATA_DIR`
- `PROPERTY_SCRAPE_HEADLESS`
- `FLIGHT_SCRAPE_HEADLESS`
- `CAR_SCRAPE_HEADLESS`
- `RESTAURANT_SCRAPE_HEADLESS`

### Updating Live Data Later

1. Run a collector locally.
2. Review the generated JSON in `data/generated`.
3. Run `npm run verify`.
4. Commit and push.
5. Redeploy, or let Vercel auto-deploy from GitHub.

## Notes

- The app reads the generated snapshots in `data/generated` and does not treat seed data as live data.
- The login gate is cookie-based and intended for a shared family password, not per-user accounts.
- The app sets `noindex` / `nofollow` metadata so public hosts do not advertise this dashboard to search engines.
- `npm run collect:properties`, `npm run collect:flights`, `npm run collect:cars`, and `npm run collect:restaurants` are Playwright-driven local collectors that run from your machine using your own browser session.
