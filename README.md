# Startup Street

Startup Street is an evidence-first client acquisition workspace for a web development agency.

The product loop is:

**DISCOVER → AUDIT → SCORE → DIAGNOSE → PERSONALIZE → CONTACT → TRACK**

## Initial niche wedge

The workspace currently defaults to **Interior & renovation** because it combines:

- high-value project economics
- strongly visual proof/portfolio requirements
- local discovery
- clear enquiry/consultation CTAs
- an obvious before/after website story

The app can switch to home services, solar installers, restaurants/cafés, and private clinics.

## Live discovery

The app supports Google Places API (New) through the environment variable `GOOGLE_MAPS_API_KEY`.

The key is read only on the server. Restrict the key in Google Cloud and enable Places API (New).

Without a key, the app does not fabricate discovery results. Use CSV import instead.

## Optional AI outreach

Set `OPENAI_API_KEY` and optionally `OPENAI_MODEL=gpt-5.6-luna`.

Without the key, outreach generation falls back to a deterministic template based on verified audit findings.

## Local development

1. `npm install`
2. copy `.env.example` to `.env.local`
3. add any provider keys you have
4. `npm run dev`
5. open `http://localhost:3000`

## What is real vs planned

### Working in the MVP

- persistent local lead storage
- safe localStorage initialization
- CSV import/export
- manual lead creation
- lead scoring UI
- lead pipeline/statuses
- Google Places API discovery when configured
- static public website audit route
- evidence-backed finding display
- rule-based or optional AI outreach generation
- human approval before outreach
- responsive SaaS-style command center

### Planned

- persistent database (Postgres/SQLite)
- browser/Lighthouse visual audit
- deeper public-source research and enrichment
- automated follow-up scheduling
- compliant email/WhatsApp/CRM integrations

## Research used for the initial niche strategy

BrightLocal: https://www.brightlocal.com/research/consumer-search-behavior-channels/

BrightLocal: https://www.brightlocal.com/research/local-consumer-review-survey/

IMARC: https://www.imarcgroup.com/interior-design-market-india

Redseer: https://redseer.com/articles/tapping-into-the-everyday-instant-home-services-and-the-next-habit-loop/

Google Places API: https://developers.google.com/maps/documentation/places/web-service/text-search

OpenAI Responses API: https://platform.openai.com/docs/quickstart/make-your-first-api-request

## Safety / outreach rule

A lead is not a prospect just because the system found it.

The workflow requires:

**source → evidence → human verification → personalized message → human approval**

Do not bypass provider terms, CAPTCHAs, or collect private personal information.