# Restaurant Reservation System

The Restaurant Reservation System is a web application built on the MERN stack. Customers search for free tables and manage their own reservations; administrators manage restaurants, tables, users, and every reservation. A table can never be double-booked, even when two people book at the same instant.

## Quick start on Windows

1. Install Node.js 20 or newer from https://nodejs.org if you do not have it.
2. Extract this folder somewhere simple such as `C:\dev\restaurant-reservation-system`. Avoid OneDrive folders: syncing thousands of installed files makes `npm install` slow and error-prone.
3. Double-click **`setup.bat`**. It installs everything and creates `backend/.env` with a random secret and an administrator login, which it prints at the end. Write that login down.
4. Double-click **`start.bat`**. It opens the backend and the frontend in two windows and then opens http://localhost:5173 in your browser. Keep both windows open while you use the site.

By default the data lives in memory and is erased whenever the backend restarts. To keep data, create a MongoDB Atlas cluster and set `STORAGE_MODE=mongo` and `MONGODB_URI` in `backend/.env`.

On macOS or Linux, run the same steps by hand: `npm install` in `backend` and in `frontend`, copy `backend/.env.example` to `backend/.env` and fill it in, then `npm run dev` in each folder.

## Technologies

| Layer | Technology |
|---|---|
| Frontend | React with Vite, React Router |
| Backend | Node.js, Express.js (REST API) |
| Database | MongoDB with Mongoose (an in-memory mode exists for development and tests) |
| Authentication | JWT in an HttpOnly cookie plus a server-side session record |
| Passwords | scrypt (Node.js `crypto`) with a unique salt per password |

## Project structure

```text
backend/src/
  config/        environment, database, cookies, booking rules
  models/        Mongoose schemas
  repositories/  storage behind one interface (memory/ and mongo/)
  services/      business rules: auth, users, restaurants, tables, reservations
  controllers/   HTTP in and out, no business logic
  routes/        URL to controller mapping and role checks
  middleware/    authentication, roles, CSRF, rate limiting, errors
  validators/    strict request validation
  utils/         password hashing, tokens, CSRF, clock, pagination
backend/tests/   service tests and HTTP tests
```

Request flow: `route -> middleware (auth, role) -> controller (validate input) -> service (rules, ownership) -> repository -> database`.

## Setup

Requirements: Node.js 20 or newer, and a MongoDB Atlas cluster if you want persistent storage.

```bash
cd backend
npm install
cp .env.example .env     # then edit .env
npm run dev
```

### Environment variables (`backend/.env`)

| Variable | Purpose |
|---|---|
| `PORT` | API port (default 4000) |
| `STORAGE_MODE` | `memory` (data lost on restart) or `mongo` |
| `MONGODB_URI` | Atlas connection string, required in `mongo` mode, must be a replica set |
| `JWT_SECRET` | Random string of at least 32 characters. Generate: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `CLIENT_URL` | Exact frontend origin, used for CORS and the CSRF origin check |
| `SESSION_TTL_HOURS` | Session lifetime (default 8) |
| `COOKIE_SAMESITE` | `lax` (default), `strict`, or `none` (production only, for a frontend on a different site) |
| `TRUST_PROXY` | `true` when hosted behind a proxy such as Render |
| `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Creates the first administrator at startup if none exists. Set all three or none |

`.env` is git-ignored. Never commit real values; `.env.example` holds placeholders only. Nothing in the frontend may contain a secret.

## Design system

The interface follows one small design system, defined in `frontend/src/styles/tokens.css`: colours, type scale, spacing (a 4px scale), radii, shadows, motion timings, and layers. No other stylesheet contains a colour value, and there are no gradients.

- **Look:** a premium, restrained identity: warm ivory and near-black with a muted gold accent. Raised cards use soft shadows, form fields are inset, and the call-to-action bands are dark with gold buttons. All colours are flat; there are no gradients.
- **Buttons:** liquid glass. A translucent fill, a thin edge, a light line on top, a shade underneath, and a soft blur, all built from shadows rather than gradients. The primary button is a nearly solid tinted glass so the main action stays clear. Buttons grow to full width and stack on small phones, and keep a 44px touch height everywhere.
- **Light and dark mode:** the site follows the device setting by default. The sun/moon button in the header switches theme, and the choice is remembered in the browser (only the word "light" or "dark" is stored). Both themes live in `tokens.css`, and every text colour pair in both was checked against WCAG AA, including the glass buttons over the surfaces they sit on.
- **Glass elsewhere:** the header, dialogs, and toasts.
- **Type:** Playfair Display for headlines and Inter for the interface, both loaded from Google Fonts. Without internet the browser falls back to Georgia and the system font. For production you can self-host them with the `@fontsource` packages.
- **Home page content:** the highlights row states facts about how the system works (instant confirmation, no double bookings, 24/7 booking). It deliberately contains no invented customer counts, ratings, or reviews. Add real ones only when you have them.
- **Hero photo:** the home page shows a drawn plate by default. To use a real photograph, put it in `frontend/public/images/` and set `heroImage` in `frontend/src/config/brand.js` (for example `"/images/hero.jpg"`).
- **Components:** `components/ui` (Button, Card, Badge, Alert, Toast, Modal, FormField, PasswordField, loading skeletons, and more), `components/layout` (Header, Footer, AdminTabs), and `components/features` (AvailabilityPicker).
- **Responsive:** built mobile-first with breakpoints at 480, 768, and 1024px (the full header menu appears from 1200px). Admin tables turn into stacked cards on phones.
- **Accessibility:** visible focus rings, text colours above 4.5:1 contrast, 44px touch targets, labelled forms with linked error messages, keyboard-friendly dialogs and menus, and support for reduced motion and reduced transparency.

## Running the frontend

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
```

Start the backend first (`cd backend && npm run dev`). In development the Vite server forwards `/api` to `http://localhost:4000`, so the browser only ever talks to one origin and cookies work without extra configuration. The backend `.env` must keep `CLIENT_URL=http://localhost:5173`.

`frontend/.env.example` has one variable, `VITE_API_URL`. Leave it empty in development. For a production build set it to the deployed API origin, then run `npm run build`. Everything in a Vite env file is public, so it must never hold a secret.

Frontend structure:

```text
frontend/src/
  components/  shared UI: forms, alerts, dialogs, pagination, availability picker
  context/     AuthContext (current user, login, logout)
  hooks/       data loading, action state, booking limits, page titles
  layouts/     main layout with navigation, admin layout
  pages/       customer pages and pages/admin/
  routes/      route guards (UX only; the API enforces access)
  services/    api.js (cookies + CSRF) and one small service per resource
  utils/       date and error helpers
```

## Roles

| Capability | Guest | User | Admin |
|---|---|---|---|
| Register, log in | Yes | | |
| Browse active restaurants and tables | No | Yes | Yes (also inactive) |
| Search availability | No | Yes | Yes |
| Create reservation | No | For themselves | For any user |
| View, edit, cancel reservations | No | Own, before start | Any |
| Complete a reservation (after it ends) | No | No | Yes |
| Delete a reservation (cancelled only) | No | No | Yes |
| Manage restaurants, tables, users | No | No | Yes |

The first administrator is seeded from the environment. Public registration always creates a regular user.

## API overview

All routes are under `/api`. Responses use standard status codes (200, 201, 204, 400, 401, 403, 404, 409, 429, 500).

- Public: `GET /health`, `GET /config`, `GET /auth/csrf`, `POST /auth/register`, `POST /auth/login`
- Session: `POST /auth/logout`, `GET /auth/me`, `PUT /auth/profile`
- Users (admin): `GET|POST /users`, `GET|PUT|PATCH|DELETE /users/:id`
- Restaurants: public search and details, admin management and import. See "Restaurant API" below.
- Tables: `GET /tables?restaurantId=`, `GET /tables/:id`; admin: `POST`, `PUT`, `PATCH`, `DELETE`
- Reservations: `GET|POST /reservations`, `GET|PUT|PATCH /reservations/:id`; admin: `DELETE /reservations/:id`
- Availability: `GET /availability?restaurantId=&startAt=&guestCount=&durationMinutes=&excludeId=`

Lists accept `page` and `limit`. Timestamps are UTC ISO strings such as `2030-06-02T18:00:00Z`.

State-changing requests must send the CSRF token: call `GET /api/auth/csrf`, then send the returned `csrfToken` in an `X-CSRF-Token` header on every POST, PUT, PATCH, and DELETE, with cookies included.

## Real restaurant data

No restaurant in this project is typed in by hand. Restaurants are **imported from OpenStreetMap** (through the public Overpass API) into MongoDB, and everything the website shows comes from the database through the REST API.

- **Why OpenStreetMap:** it is a legitimate public source that needs no API key and allows storing the data (under the ODbL licence, which requires the credit "© OpenStreetMap contributors". The site shows it). Commercial APIs such as Google Places restrict storing their content in your own database, so they are not used.
- **What OpenStreetMap has:** name, coordinates, and often cuisine, opening hours, phone, website, and amenities. What it mostly does **not** have: ratings, review counts, price ranges, and photos. Those fields stay empty (the site says "No ratings yet") instead of being invented. An administrator can enter real values by hand, and imported images are limited to freely licensed Wikimedia Commons ones.
- **Coverage:** the list is only as complete as OpenStreetMap's mapping of Lipa City, Batangas City, Tanauan, Malvar, and Santo Tomas. Missing restaurants can be added in the admin screen, or mapped at openstreetmap.org, which then appear on the next import.
- **Tables are not public data.** OpenStreetMap does not know a restaurant's seating, so imported restaurants start with no tables. Add real tables in Administration, or for testing only run the seed command with `--demo-tables` (see below).

## Setting up MongoDB (needed to keep data)

With the default `STORAGE_MODE=memory` everything is erased when the backend restarts. For real data, use MongoDB:

1. Create a free cluster at https://www.mongodb.com/atlas (MongoDB Atlas). Atlas supports the transactions the booking logic needs.
2. Create a database user and allow your IP address under Network Access.
3. Copy the connection string, then in `backend/.env` set `STORAGE_MODE=mongo` and `MONGODB_URI=<your connection string>` (include a database name, for example `.../restaurant-reservations?retryWrites=true&w=majority`).
4. Restart the backend. It creates the collections and indexes on start.

## Importing restaurants

**From the command line** (needs MongoDB mode):

```bash
cd backend
npm run seed                                  # imports Lipa City and Batangas City
npm run seed -- --areas lipa,batangas,tanauan,malvar,santo-tomas
npm run seed -- --dry-run                     # show what would change, save nothing
npm run seed -- --demo-tables 4               # ALSO add 4 placeholder tables per restaurant (testing only)
```

**From the website:** log in as an administrator, open Administration, then Restaurants, then **Import restaurants**, choose the places, and press Start. Progress and results appear on the page, including any records that failed.

The import is safe to run again and again:
- Restaurants are matched by OpenStreetMap's stable id (`externalPlaceId`), never by name alone, so nothing is duplicated.
- The same place mapped twice (same name within 75 metres) is skipped.
- Existing restaurants are updated only with non-empty values. Empty values never overwrite good data.
- Fields an administrator edited by hand are remembered and never overwritten, and hidden restaurants stay hidden.
- Records that cannot be saved are logged and reported, and the rest continue.

The public Overpass service limits how fast it answers, so a large import can take a few minutes. Set `RESTAURANT_API_USER_AGENT` in `backend/.env` to your own name and email, as the service asks.

## Restaurant API

Browsing is public. Changing data needs an administrator. Errors always look like `{ "success": false, "message": "..." }`, and successful responses include `"success": true`.

| Method and path | Who | Purpose |
|---|---|---|
| `GET /api/restaurants` | anyone | Search and list. Filters: `q`, `city`, `cuisine`, `category`, `priceRange`, `minRating`, `hasTables`. Sort: `sort` (`featured`, `rating`, `name`, `price`, `newest`) and `order`. Paging: `page`, `limit` |
| `GET /api/restaurants/search` | anyone | Same as above |
| `GET /api/restaurants/city/:city` | anyone | Restaurants in a city (`Lipa` matches Lipa City) |
| `GET /api/restaurants/cuisine/:cuisine` | anyone | Restaurants by cuisine |
| `GET /api/restaurants/facets` | anyone | Counts of cities, cuisines, and categories |
| `GET /api/restaurants/:id` | anyone | Full details, including open tables |
| `POST /api/restaurants` | admin | Add a restaurant |
| `PUT` / `PATCH /api/restaurants/:id` | admin | Replace or update |
| `DELETE /api/restaurants/:id` | admin | Delete (not while it has tables) |
| `POST /api/admin/restaurants/sync` | admin | Start an import. Body: `{ "areas": ["lipa"], "dryRun": false }`. Answers 202 and runs in the background |
| `GET /api/admin/restaurants/sync/status` | admin | Progress and result of the latest import |

Examples:

```bash
curl "http://localhost:4000/api/restaurants?q=Lipa"
curl "http://localhost:4000/api/restaurants?cuisine=Japanese&sort=name"
curl "http://localhost:4000/api/restaurants/city/Batangas?hasTables=true"
```

## Data model

```text
User ──< Reservation >── Restaurant ──< Table
              └───────────────────────────┘ (a reservation also points at one table)
```

All ids are UUID strings stored in `_id`, referenced with Mongoose `ref`. Using UUIDs instead of ObjectIds keeps memory mode and MongoDB mode identical.

**Restaurant:** `name`, `description`, `cuisine[]`, `category`, `address`, `barangay`, `city`, `province`, `latitude`, `longitude`, `location` (GeoJSON, 2dsphere index), `phone`, `email`, `website`, `image`, `imageCredit`, `gallery[]`, `openingHours`, `priceRange` (`$` to `$$$$` or empty), `rating`, `reviewCount`, `amenities[]`, `active`, `externalPlaceId` (unique when present), `source` (provider, url, license, importedAt), `manualFields[]`, `profileScore`, `createdAt`, `updatedAt`. Indexes: name, city, province, cuisine, category, active+city, rating, profileScore, location, and a unique partial index on `externalPlaceId`.

**Table:** `restaurantId`, `label` (shown as `tableNumber`), `capacity`, `active` (shown as `status`: available or unavailable).

**Reservation:** `userId`, `restaurantId`, `tableId`, `startAt`, `endAt`, `durationMinutes`, `guestCount`, `notes`, `status`.

Some names differ slightly from a plain reading of the requirements, on purpose:
- `status` for restaurants and tables is stored as a boolean `active` and shown as a `status` text in the API.
- A reservation stores one exact start time (`startAt`) rather than a separate date and time, which avoids time zone mistakes. The API adds `reservationDate`, `reservationTime` (in `APP_TIMEZONE`, default Asia/Manila), `numberOfGuests`, and `specialRequest` to every reservation.
- `availableTables` is worked out from the Table collection each time it is read, so it can never be out of date.

## Authentication and security

- Passwords are hashed with scrypt and a unique salt, compared in constant time, and never returned.
- Login creates a session record and a signed JWT (HS256) holding only the user and session ids, stored in an HttpOnly cookie (`Secure` in production). Every request checks the signature, the expiry, and that the session still exists; logout deletes the session, so it stops working immediately.
- The role is read from the database on every request, never from the token or the request body.
- Authorization is enforced on the server: role middleware on admin routes and an ownership check in the reservation service. Another user's reservation returns 404.
- CSRF: SameSite cookies, an origin check, and a signed double-submit token.
- Input: strict validation that rejects unknown fields and operator-shaped values (NoSQL injection), plus a simple query parser and Mongoose `sanitizeFilter`.
- Also: Helmet security headers, CORS limited to `CLIENT_URL`, a 10 KB body limit, rate limiting (stricter on login and register), and error responses that never include stack traces.
- Double-booking: validation, the conflict check, and the write run in one transaction, and a per-table write lock makes simultaneous requests take turns.

## Testing

```bash
cd backend
npm install --save-dev supertest
npm test                      # service tests and HTTP tests
npm run smoke:store           # storage checks against the configured STORAGE_MODE
```

Run `smoke:store` once with `STORAGE_MODE=mongo` against a throwaway Atlas database to confirm transactions and the concurrent-booking lock on real MongoDB.

## Deployment notes

- Set every variable above in the host's dashboard, never in the repository.
- Use `STORAGE_MODE=mongo` with an Atlas URI and `NODE_ENV=production`.
- If the frontend and API are on different sites, set `COOKIE_SAMESITE=none`; both cookies are then sent cross-site and the CSRF token and origin check are what protect state-changing requests.
- Set `TRUST_PROXY=true` behind a proxy and `CLIENT_URL` to the deployed frontend origin.
