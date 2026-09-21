# Startup Street 2.0

Startup Street is an evidence-first, India-first client acquisition workspace for web agencies.

**Core loop:** Discover → Deduplicate → Enrich → Audit → Evidence → Score → Verify → Personalize → Approve → Track.

## Live providers

### Google Places API (New)
Configure:

`GOOGLE_MAPS_API_KEY`

The key is server-side only. Restrict it in Google Cloud and enable Places API (New).

### OpenStreetMap fallback
When Google is not configured, discovery can use OpenStreetMap + Nominatim + Overpass through the provider selector:

- Auto (Google → OSM)
- Google Places
- OpenStreetMap

OSM coverage is not complete and should be treated as a discovery source, not a source of truth.

## AI provider

The app now uses a configurable OpenAI-compatible Responses endpoint:

`AI_BASE_URL=https://api.openai.com/v1`
`AI_API_KEY=...`
`AI_MODEL=...`

Do not hard-code a model name. The Settings workflow should test the configured provider before using it.

## Persistence

The repository contains a PostgreSQL/Prisma schema and leads API.

Configure:

`DATABASE_URL=postgresql://...`

When configured, Startup Street loads and persists leads through PostgreSQL. Without it, local browser storage is used explicitly as a development fallback; no fake leads are inserted unless `NEXT_PUBLIC_DEMO_MODE=true`.

Run migrations with:

`npx prisma migrate dev --name init`

and generate the client with:

`npx prisma generate`

## Local development

1. Use Node 20+.
2. `npm install`
3. Copy `.env.example` to `.env.local`.
4. Configure the providers you need.
5. `npm run dev`
6. Open `http://localhost:3000`.

Useful checks:

`npm run typecheck`
`npm run lint`
`npm run build`

## Real vs demo

Production discovery does **not** seed businesses.

Demo businesses are allowed only when:

`NEXT_PUBLIC_DEMO_MODE=true`

They are clearly development data and are never evidence for outreach.

## Website audit

The audit route performs real public HTTP checks and records evidence such as:

- reachability
- HTTP status
- title
- viewport
- headings
- content density
- contact/WhatsApp/booking/order signals
- local map/hours signals
- PDF/image menu signals
- social links
- lightweight broken-link checks

The audit includes network safety checks to block local/private destinations and unsafe redirects.

A static HTML audit cannot reliably judge visual design or real mobile rendering. Browser/Lighthouse auditing remains a separate layer.

## Safety

The intended workflow is:

**source → evidence → human verification → personalized draft → human approval → contact**

Do not bypass CAPTCHAs, provider limits, robots/crawl controls, or collect private personal information.

## Research references

Google Places API:
https://developers.google.com/maps/documentation/places/web-service

OpenStreetMap:
https://www.openstreetmap.org/
https://operations.osmfoundation.org/policies/nominatim/

Open Government Data:
https://data.gov.in/

API Setu:
https://apisetu.gov.in/

OpenAI API:
https://platform.openai.com/docs/

The repository should verify current documentation and licensing before adding additional providers.


## UI direction

The interface uses a dark intelligence-workspace aesthetic with restrained liquid-glass motion. The hero uses React Three Fiber for a lightweight WebGL accent; reduced-motion and mobile fallbacks disable the effect. UI component choices should remain performance-conscious and preserve functionality first.
