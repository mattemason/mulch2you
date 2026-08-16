# Mulch2U — Product & Technical Plan

_Draft v1 — a two-sided marketplace matching arborists with surplus wood chip to gardeners who want it._

---

## 1. The real problem (and why the naive version fails)

The pitch: loppers pay to dump chip, gardeners pay to buy mulch, connect them. Correct. But
this exact model already exists overseas (ChipDrop, US) and its failure modes are well known.
Designing around them is most of the work.

### The four things that kill this marketplace

**1. Volume mismatch.** A tipper truck holds 6–10 m³. A suburban gardener wants 1–3 m³.
If a lopper drives 25 minutes to a pin and can only unload a third of the load, they never
come back. **Every listing must capture a maximum load the person will accept**, and the map
must let loppers filter on "will take a full truck". Solve this by recruiting high-volume
receivers early (below).

**2. Truck access.** Tippers need driveway width, overhead clearance to raise the tray, and
somewhere to dump that isn't a lawn they'll rut. This is the #1 reason a drop is aborted
on arrival. **Require a photo of the drop spot** at listing time — it's the single highest-value
field in the whole app.

**3. Material quality.** Fresh chip is not uniform. Gardeners care about: palm (won't break
down), pine (acidic), camphor laurel / privet / ivy (weed seed and regrowth), thorny species,
diseased wood (myrtle rust, phytophthora), and whether it's been through a chipper vs stump
grinder. Let receivers exclude species and let suppliers declare what's on the truck. This is
a genuine differentiator over "free mulch on Facebook Marketplace".

**4. Stale pins.** The slow death of every map marketplace. Someone lists, gets their mulch,
forgets to remove the pin. Loppers ring three dead pins and never open the app again.
**Listings auto-pause after 30 days unless re-confirmed by a one-click email link.**

### The timing constraint that shapes the whole design

The lopper is standing in someone's front yard with a full truck at 2pm. Their alternative
is a 40-minute round trip to a transfer station plus tip fees. They will give your app about
**90 seconds** of attention. That means:

- Phone-first, map-first, geolocation on open. No dashboard, no onboarding on the supply side.
- Email alone is far too slow for the accept loop. **SMS is not optional** on this flow.
- And the killer feature: **pre-authorised drops**. Receivers who tick "just dump it, don't
  ask" become instant-claim pins. The lopper taps once, gets the address, and drives. No
  waiting on a human. Expect these pins to receive the large majority of drops — build the
  UI to push people towards ticking it.

### Naming

Careful with "tree lopper" — in the AU industry, *lopping* is bad practice and qualified
arborists find the term insulting. Your supply side is the harder side to recruit; don't open
with a slur. Recommend **Arborist** (or "Tree Service") for suppliers and **Gardener** for
receivers. Internal DB role values: `supplier` / `receiver`.

---

## 2. Privacy — decide this before writing schema

You are collecting home addresses of (often) people home alone during the day, and putting
them on a map. This must be handled deliberately.

| Rule | Implementation |
| --- | --- |
| No public map | Pins only visible to logged-in, verified suppliers |
| Fuzzed pins | Store `lat`/`lng` **and** `approx_lat`/`approx_lng` rounded/jittered to ~300 m. The API only ever serves the approximate pair until a drop is accepted |
| Progressive disclosure | Exact address + phone released only on acceptance, to that one supplier |
| Supplier verification | Business name + ABN + mobile verified by OTP before map access. Optional: public liability certificate upload |
| Kill switch | One-tap "pause my listing" in every notification |

Also required in AU: a privacy policy covering collection/use/disclosure under the Australian
Privacy Principles, and terms that make clear the platform is an **introducer only** — it does
not own, inspect, or warrant the material, and is not liable for driveway damage or weed
contamination. Material is accepted as-is.

---

## 3. Core flows

### A. Gardener lists
1. Sign up with email magic link (no passwords).
2. Address via autocomplete → geocoded to lat/lng, plus fuzzed pair.
3. Listing wizard: max load (m³ / "half a truck" / "full truck" / "unlimited"), exclusions
   (no palm / no pine / no thorny / no diseased), drop location (driveway / nature strip /
   behind gate), access notes, **photo of the drop spot**, and the big one:
   `[ ] Drop anytime without asking me first` → makes it an instant-claim pin.
4. Confirm email → pin goes live.

### B. Arborist finds a drop
1. Log in on phone → map centres on current GPS.
2. Pins within radius; filter by min volume accepted and instant-claim only.
3. Tap pin → volume, exclusions, access photo, approximate location, distance/ETA.
4. Two paths:
   - **Instant-claim**: tap Claim → exact address revealed immediately → receiver gets
     "Dave's Tree Service is on the way with ~6 m³ today".
   - **Ask-first**: tap Offer → choose load size + ETA window → receiver gets SMS + email
     with one-tap Accept / Decline (signed token, no login needed).
5. On accept: contact details exchanged both ways, drop marked `accepted`.
6. Offers auto-expire in 2 hours (configurable) so the lopper isn't left hanging — on expiry
   they're notified and the pin returns to the pool.

### C. After the drop
Both parties get a "did it happen?" prompt. Receiver confirms → listing auto-fulfilled/paused.
Simple two-way rating (thumbs + optional note) plus a "report a problem" path for contaminated
loads or no-shows. Ratings gate nothing in v1 but give you the data to act on abuse later.

---

## 4. Schema (Postgres)

Plain `lat`/`lng` columns with a bounding-box prefilter and Haversine ordering is entirely
sufficient at this scale and avoids fighting PostGIS on Railway. PostGIS is a later upgrade
if you ever need polygon service areas.

```sql
create type user_role as enum ('receiver', 'supplier', 'admin');

create table users (
  id            uuid primary key default gen_random_uuid(),
  email         citext not null unique,
  name          text not null,
  phone         text,                       -- E.164, required for suppliers
  role          user_role not null,
  phone_verified_at timestamptz,
  created_at    timestamptz not null default now()
);

create table supplier_profiles (
  user_id       uuid primary key references users(id) on delete cascade,
  business_name text not null,
  abn           text,
  truck_capacity_m3 numeric(4,1),
  verified_at   timestamptz,                -- admin/automatic gate for map access
  insurance_doc_url text
);

create table listings (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references users(id) on delete cascade,
  address_line  text not null,
  suburb        text not null,
  postcode      text not null,
  state         text not null,
  lat           double precision not null,  -- exact; never leaves the server pre-match
  lng           double precision not null,
  approx_lat    double precision not null,  -- ~300 m fuzz; safe to serve
  approx_lng    double precision not null,
  max_volume_m3 numeric(4,1),               -- null = unlimited
  excludes      text[] not null default '{}',  -- palm, pine, thorny, diseased, conifer
  drop_spot     text not null,              -- driveway | nature_strip | behind_gate | other
  access_notes  text,
  photo_url     text,
  pre_authorised boolean not null default false,
  status        text not null default 'active',   -- active | paused | fulfilled
  confirmed_at  timestamptz not null default now(),  -- staleness clock
  created_at    timestamptz not null default now()
);
create index on listings (status, approx_lat, approx_lng);

create table drops (
  id            uuid primary key default gen_random_uuid(),
  listing_id    uuid not null references listings(id) on delete cascade,
  supplier_id   uuid not null references users(id) on delete cascade,
  volume_m3     numeric(4,1),
  species       text,
  eta_window    text,                       -- 'within_2h' | 'today' | 'tomorrow'
  status        text not null default 'offered',
  -- offered | accepted | declined | expired | completed | no_show | cancelled
  accept_token  text unique,                -- signed, single-use, for no-login accept links
  expires_at    timestamptz not null,
  responded_at  timestamptz,
  completed_at  timestamptz,
  created_at    timestamptz not null default now()
);
create index on drops (listing_id, status);

create table ratings (
  id         uuid primary key default gen_random_uuid(),
  drop_id    uuid not null references drops(id) on delete cascade,
  rater_id   uuid not null references users(id),
  positive   boolean not null,
  note       text,
  created_at timestamptz not null default now()
);
```

Nearby query (bounding box then Haversine — fast enough to five figures of listings):

```sql
select *, 6371 * acos(least(1,
    cos(radians($1)) * cos(radians(approx_lat)) * cos(radians(approx_lng) - radians($2))
  + sin(radians($1)) * sin(radians(approx_lat))
  )) as distance_km
from listings
where status = 'active'
  and approx_lat between $1 - $3/111.0 and $1 + $3/111.0
  and approx_lng between $2 - $3/(111.0*cos(radians($1)))
                     and $2 + $3/(111.0*cos(radians($1)))
order by distance_km
limit 200;
```

---

## 5. Stack (Railway + Postgres)

| Layer | Choice | Why |
| --- | --- | --- |
| App | **Next.js 15, App Router, TypeScript** | One Railway service for API + UI; server components keep exact addresses off the client |
| DB access | **Drizzle ORM** | Typed, light, and doesn't fight you when you need raw SQL for the distance query |
| Auth | **Auth.js v5, email magic link** | Tradies on phones will not manage a password. Add SMS OTP for supplier phone verification |
| Map render | **MapLibre GL JS + MapTiler tiles** | Tiles are the high-volume cost; free tier covers launch. Leaflet + OSM is an even cheaper fallback |
| Address entry | **Google Places Autocomplete (AU-restricted)** | Best Australian address data. Called once per listing, so cost is trivial |
| Email | **Postmark** | Strong transactional deliverability; separate streams keep sign-in links out of any bulk reputation |
| SMS | **Twilio** (AU alphanumeric sender) | The accept loop depends on it. Budget ~5c/msg |
| Photos | **Cloudflare R2** presigned uploads | Railway has no durable disk by default |
| Cron | Railway cron service → signed internal endpoint | Offer expiry, 30-day staleness pings, digests |
| Errors | Sentry | |

Env vars to plan for: `DATABASE_URL`, `AUTH_SECRET`, `POSTMARK_SERVER_TOKEN`, `TWILIO_*`,
`GOOGLE_MAPS_KEY` (server-side, referrer-restricted), `MAPTILER_KEY`, `R2_*`, `CRON_SECRET`.

Ship it as a **PWA** (manifest + install prompt). A lopper who adds it to their home screen
opens it at the job site; one buried in a browser tab does not. Native apps are unnecessary.

---

## 6. Build order

**Phase 0 — Skeleton (week 1)**
Next.js + Drizzle + Railway Postgres deployed and green. Magic-link auth with roles. Schema
migrated.

**Phase 1 — Listings & map (week 2)**
Address autocomplete → geocode → fuzz. Listing wizard incl. photo upload. Supplier map with
GPS centring, radius query, pin detail sheet. *Milestone: you can see real pins on a phone.*

**Phase 2 — The loop (week 3)**
Offer → SMS/email with signed accept links → accept reveals contact details → expiry cron.
Instant-claim path. *This is the product. Everything before it is plumbing.*

**Phase 3 — Trust & hygiene (week 4)**
Completion confirmation, two-way ratings, report-a-problem, 30-day re-confirm cron,
supplier verification gate, admin view.

**Phase 4 — Growth**
Organisation accounts (below), saved search alerts ("text me when a pin appears within 10 km
of my depot"), monetisation.

---

## 7. Go-to-market — this matters more than the code

**Launch one metro area, one suburb cluster at a time.** A national map with 40 pins across
Australia is useless to everyone. Density is the entire value proposition.

**Seed the receiver side with high-volume takers first.** Before you approach a single tree
service, sign up 15–25 of these in your target area:
community gardens, school kitchen gardens, Landcare/Bushcare groups, small acreage and
hobby farms, plant nurseries, horse properties (bedding/arena base), permaculture groups.
They take unlimited loads, they're delighted to get them, and they make the map immediately
worth opening. Give them an `unlimited` listing type with no max volume.

**Then recruit suppliers by phone, not by ads.** There are maybe 30–60 tree services in a
given metro area. Ring them. The pitch is money, not sustainability: *"how much do you spend
a week tipping green waste, and how long does the round trip take?"* Green-waste tipping plus
driver time is real cost — quantify it in their terms and the app sells itself.

**Monetisation — deferred. Launching free on both sides.**

Nobody pays: no fee for gardeners, nothing for crews, no card on file. The
economics still work without us in the middle, which is the point — a crew
tipping two streets from the job avoids a gate fee and a round trip, and that
saving is real money whether or not anyone invoices for it.

The reason to start here is liquidity. A marketplace with four pins and one
crew has nothing to sell; charging before there's density taxes the very
behaviour you're trying to create. Free removes every reason not to try it.

The figures already decided, for when that changes: $20 up to 3 m³, $35 up to
6 m³, $50 for a full truck or an open listing. They live in
`VOLUME_TIERS.priceCents` and nothing displays them. Three constraints from
when this was designed still hold and are worth not relearning:

- **Charge on delivery, not on listing.** Listing must stay free or the map
  goes thin, and pin density is the entire product. A free marketplace can
  shrug off "no crew came this week"; a prepaid one owes refunds on the one
  thing you can't control.
- **Price the tier requested, never the volume delivered.** Nobody can verify
  what actually hit the driveway, and you do not want to arbitrate it.
- **Sell the introduction, not the mulch.** If a fee reads as the price of
  goods, Australian Consumer Law guarantees attach to the material itself, and
  every weed-seeded load becomes your liability.


---

## 8. Open questions for you

1. **Geography** — is this Australia-only for v1? It changes address autocomplete, SMS
   sender setup, and units (m³ vs cubic yards).
2. **SMS budget** — Twilio is ~5c/message in AU. Fine at low volume; confirm you're happy
   to run it, because email-only will visibly hurt conversion.
3. **Supplier verification** — how strict? ABN check alone (fast, weak) vs manual approval
   of the first N (slow, safe). Given you're publishing people's home addresses, I'd manually
   approve every supplier until it's painful, then automate.
4. **The volume question** — do you want organisation/high-volume accounts in v1? I think
   yes, because they're what make the map usable on day one.
