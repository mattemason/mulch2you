# Mulch2You

Connects arborists with a full truck of wood chip to gardeners who want it —
free mulch for the garden, no tip fees for the tree crew.

Product thinking, schema rationale and go-to-market live in
[docs/PRODUCT-PLAN.md](docs/PRODUCT-PLAN.md). Read that first; it explains *why*
listings store two sets of coordinates and why suppliers are approved by hand.

## Stack

| | |
| --- | --- |
| Framework | Next.js 16 (App Router, Turbopack), React 19, TypeScript |
| Styling | Tailwind v4 |
| Database | Postgres via Drizzle ORM (`pg` driver) |
| Auth | Auth.js v5, email magic links (no passwords) |
| Email | Postmark |
| Hosting | Railway |

## Local setup

```bash
npm install
cp .env.example .env.local
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Paste that value into `AUTH_SECRET` in `.env.local`. (Don't use `npx auth secret`
— the `auth` package on npm is better-auth's CLI, not Auth.js, and emits a
differently-named variable.)

Point `DATABASE_URL` at a local Postgres or at Railway's public proxy URL, then:

```bash
npm run db:migrate       # apply migrations in ./drizzle
npm run dev
```

Without `POSTMARK_SERVER_TOKEN`, magic-link emails are printed to the server
console instead of sent — enough to sign in locally. Production throws instead,
since a magic link is a live credential and shouldn't be written to a log.

### Postmark setup

1. Create a Postmark account and a **Server** (transactional).
2. **Sender Signatures** → add the address you'll send from and click the
   confirmation email. `EMAIL_FROM` must match it exactly or every send fails.
3. **Servers → your server → API Tokens** → copy the *server* token (not the
   account token) into `POSTMARK_SERVER_TOKEN`.

New Postmark accounts are approval-limited: until approved, you can generally
only send to addresses on the same domain as your confirmed sender signature.
That's enough to test your own login; request approval before real signups.

## Scripts

| Command | Does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` / `start` | Production build and serve |
| `npm run typecheck` | `tsc --noEmit` (run `build` once first so Next generates its route types) |
| `npm run db:generate` | Generate a migration from schema changes |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:studio` | Drizzle Studio |

Schema changes go through `db:generate` → review the SQL in `drizzle/` → commit
it → `db:migrate`. Don't use `db:push` against production.

## Deploying to Railway

1. New project → **Deploy from GitHub repo** → this repo.
2. Add a **Postgres** service. Railway injects `DATABASE_URL` automatically.
3. Set service variables from `.env.example` — at minimum `AUTH_SECRET`,
   plus `POSTMARK_SERVER_TOKEN` and `EMAIL_FROM` for real emails.
4. Generate a public domain. `railway.json` already sets the pre-deploy
   migration, start command and `/api/health` healthcheck.

## Layout

```
app/
  page.tsx              landing
  signin/               magic-link request + check-email
  onboarding/           role choice, then receiver or supplier details
  dashboard/            role-dependent home
  api/auth/[...nextauth]/
  api/health/           Railway healthcheck (verifies DB connectivity)
lib/
  db/schema.ts          Drizzle schema — auth tables + listings/drops/ratings
  db/queries.ts         findNearbyListings: bounding box + Haversine
  session.ts            getCurrentUser, isApprovedSupplier (role read from DB)
  geo.ts                coordinate fuzzing, distance, bounding box
  phone.ts              AU mobile normalisation to E.164
  email.ts              Postmark wrapper + templates
auth.ts                 Auth.js config
proxy.ts                signed-in check on protected routes
drizzle/                generated migrations
```

## Two rules worth not breaking

**Exact addresses never reach a client before a match.** `listings` stores both
`lat`/`lng` (true) and `approx_lat`/`approx_lng` (~300 m fuzz). `findNearbyListings`
selects only the approximate pair and only the suburb — no street, no name, no
phone. Those are released by the drop-acceptance path and nowhere else.

**Role is read from the database, not the JWT.** `proxy.ts` only checks that
someone is signed in. Authority checks use `getCurrentUser()` / `isApprovedSupplier()`
so a token minted before approval can't keep asserting stale access.

## Verifying the geo query

```bash
npm run verify:geo
```

Applies the real migrations to a throwaway in-process Postgres (PGlite — no
Docker, no install), seeds listings at real Blue Mountains coordinates, and
asserts the radius search, ordering, filters and the privacy guarantee. Run it
after touching `lib/geo.ts`, `lib/db/queries.ts` or anything in `drizzle/`.

## Status

**Phase 0 — done.** Auth, schema, migrations, deploy config.

**Phase 1 — done.** Address lookup and geocoding, listing wizard, listing
management with pause/delete, the nearby API, and the supplier map with
GPS centring and filters.

**Phase 2 — next.** The offer/claim loop: SMS + email with one-tap accept,
contact exchange on acceptance, offer expiry. Then drop-spot photo upload
(needs object storage) and Stripe on delivery confirmation.

### Keys still to add

| Variable | Without it | Get it from |
| --- | --- | --- |
| `GOOGLE_MAPS_KEY` | Address lookup falls back to OpenStreetMap — fine for testing, patchy on new estates and units | Google Cloud Console (Geocoding API) |
| `MAPTILER_KEY` | Map uses raw OSM raster tiles, whose usage policy **does not permit production traffic** | maptiler.com |
| `TWILIO_*` | No SMS, so the Phase 2 accept loop is email-only | twilio.com |
