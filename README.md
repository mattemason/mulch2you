# Mulch2U

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
5. **Set `AUTH_URL` to that domain** (`https://…`, no trailing slash). Without
   it, Auth.js derives its base URL from request headers, which behind the
   proxy can come out as `https://localhost:8080` — magic links then point at
   the container instead of your site.

`GET /api/health` reports the hostname the app sees, so if links still come out
wrong, compare `origin.host` and `origin.forwardedHost` against your domain.

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

## Verification scripts

```bash
npm run verify        # both of the below
```

`verify:geo` applies the real migrations to a throwaway in-process Postgres
(PGlite — no Docker, no install), seeds listings at real Blue Mountains
coordinates, and asserts the radius search, ordering, filters and the privacy
guarantee. Run after touching `lib/geo.ts`, `lib/db/queries.ts` or `drizzle/`.

`verify:images` stamps a JPEG with camera and GPS EXIF, pushes it through the
upload pipeline, and asserts none of it survives — plus that oversized files,
non-images and path-traversal storage keys are all rejected. Run after touching
`lib/images.ts` or `lib/storage.ts`.

## Photos

Two photos matter, and neither is ever served from a public URL — a driveway
plus a suburb identifies a house, so `/api/photos/[...key]` decides per object:
a listing photo goes to its owner or any approved supplier, a proof photo only
to the two parties to that drop.

**Drop-spot photo** (receiver, at listing time) — shown to drivers on the map
before they commit. Overhead clearance and driveway width are what turn a truck
around on arrival, and a photo shows both.

**Proof photo** (supplier, on delivery) — mandatory to mark a drop delivered.
It's the evidence in a dispute and the event that will trigger payment.

Uploads are downscaled in the browser first (a driver on 4G won't wait for 6 MB)
then re-encoded server-side with `sharp`. The re-encode is load-bearing, not
cosmetic: phone cameras write GPS coordinates into EXIF by default, so an
un-stripped drop-spot photo would hand suppliers the exact address of a house
whose pin we deliberately fuzz to ~300 m.

### Railway: mount a volume before anyone uploads a photo

Container filesystems are ephemeral, so without a volume every deploy deletes
every uploaded photo. The database keeps the key and the file is gone, which
surfaces as "the photo file is missing" on the listing page.

1. Railway → your **app** service (not Postgres) → **Settings**
2. Scroll to **Volumes** → **Add Volume**
3. Mount path: `/data` — leave the name as offered
4. **Variables** → set `UPLOAD_DIR=/data`
5. Deploy

Adding a volume restarts the service and pins it to one instance, which is
fine at this size. Photos uploaded before the volume existed are gone; re-add
them from each listing page.

Object storage (R2/S3) is the right move once volume grows — `lib/storage.ts`
is the only file that needs to change.

## Address lookup

`lib/geocode.ts` has two providers behind one interface, chosen at runtime:

**Google Places (New)** when `GOOGLE_MAPS_KEY` is set. Autocomplete returns
predictions, then one Place Details call resolves the pick. Both share a
**session token** so Google bills the whole typing session as one unit instead
of charging per keystroke — the token is minted client-side and discarded once
details are fetched. Enable *Places API (New)* and *Geocoding API*, attach
billing, and restrict the key by API only (calls are server-side; there is no
stable Railway egress IP to lock to and the key never reaches a browser).

**Photon** otherwise — free, keyless, fuzzy. Returns everything in one hit, so
predictions arrive pre-resolved and no second call happens.

The address step deliberately keeps the street number editable under both. OSM
answers "1 Hastings Street" with number 18 and has nothing at all for many rural
roads; Google is much better but still misses unit numbers. A geocoder silently
overwriting a typed number sends a truck to the wrong house, so the user
confirms it. Coordinates only need to be street-accurate — pins are fuzzed
~300 m regardless.

The address step footer names the live provider, which is the quickest way to
confirm a key took effect.

## Admin

Set `ADMIN_EMAILS` to your sign-in address and `/admin` appears, linked from the
dashboard. Config rather than a database column on purpose: a flag in the
database has no way to grant itself the first time. `app/admin/layout.tsx` holds
one guard for the whole area, and every action re-checks independently.

| Tab | What it's for |
| --- | --- |
| Overview | Counts, live configuration, and diagnostics |
| Tree services | Approve or revoke, with ABN links to the ABR |
| Listings | Every pin with owner contact details, drop-spot photo, staleness, and a pause/reactivate override |
| Drops | Every claim and delivery with proof photos — the record to check on a disputed load |

Approving a supplier is the moment they gain sight of strangers' home
locations, which is why it stays a human decision. It also sends the "you're
in" email the supplier dashboard promises.

**Diagnostics** on the overview tab runs a live address lookup and prints the
provider's own error. Ordinary users get a deliberately vague "temporarily
unavailable" because they can't act on more; nearly every real failure is a
missing API enablement, an unattached billing account, or a key restriction,
and the provider names which.

## Brand assets

`node scripts/build-brand-assets.mjs "path/to/logo.png"` regenerates everything
from the master logo: the full lockup, a header wordmark, a recoloured
dark-mode wordmark, and the app icons. Band boundaries are detected from the
image rather than hardcoded, so a logo revision needs no code change. Palette
colours in `globals.css` were sampled from the artwork — `#385020` is the
wordmark green and the truck tray.

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
| `MAPTILER_KEY` | *Optional.* Map uses OpenFreeMap — free vector tiles, no key, fine for production. A key only buys a paid CDN with an uptime commitment | maptiler.com |
| `TWILIO_*` | No SMS, so the Phase 2 accept loop is email-only | twilio.com |
