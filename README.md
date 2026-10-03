# Hidden Heritage

A travel and education app for discovering Kosovo’s monuments, built for the AI for Kosovo hackathon.

## Requirements

Node.js 20.19+ (or 22.12+) and MySQL 8+. React 18, Vite, Tailwind CSS, React Router, Axios, React Leaflet, Express, and MySQL.

## Setup (PowerShell)

Run from the repository root:

```powershell
npm install --prefix client
npm install --prefix server
Copy-Item client/.env.example client/.env
Copy-Item server/.env.example server/.env
```

Edit `server/.env` with your MySQL credentials and two different random JWT secrets. Keep AI keys only in `server/.env`. `POLLINATIONS_API_KEY` is optional. The client uses `VITE_API_URL=http://localhost:5000/api`.

Create the database and tables using the MySQL CLI (use the DB user configured in `.env`):

```powershell
mysql -u root -p --execute="source server/schema.sql"
npm run seed
```

The schema creates `hidden_heritage`. If you change `DB_NAME`, update the database name in `schema.sql` too.

Start the API and client in two terminals from the repository root:

```powershell
npm run dev:server
```

```powershell
npm run dev:client
```

Open http://localhost:5173. API health: http://localhost:5000/api/health. CORS allows `CLIENT_URL` with credentials.

## Build and production API

```powershell
npm run build
npm run preview --prefix client
npm start --prefix server
```

Vite preview uses port 4173 by default; set `CLIENT_URL=http://localhost:4173` and restart the API when testing preview. Production hosting must serve `client/dist` with an SPA fallback to `index.html` and configure the client API URL before building.

## Implemented scope

The client includes responsive public pages, a protected heritage map, Time Machine, and Groq-powered Ciceroni, with a sticky mobile navigation menu and reduced-motion support. Signup redirects to login with an account-created notification. Login opens `/map`; `/` remains the public homepage.

Add your Kosovo landscape photo at `client/public/hero.jpg` to supply the home hero background. The `/hero.jpg` path is already configured; a dark background keeps the text readable until the file is added. Replace the five team placeholder cards in `client/src/pages/About.jsx` with your team details.

`AuthProvider` holds the user and access token in memory, restores sessions silently with `/api/auth/refresh` on app load, and shows a small loader until that attempt finishes. Axios attaches the bearer token, shares one refresh request across concurrent 401 responses, and retries each original request at most once. Failed refresh clears the session and redirects to `/login`. Login/register failures are displayed on the form. No tokens are stored in localStorage or sessionStorage. `/map`, `/time-machine`, and `/ciceroni` are guarded by `ProtectedRoute`.

Phase 1 implements server registration, login, rotating refresh sessions, logout, current-user lookup, contact submission, and protected monument queries. Registration returns a message without logging in. Login returns `{accessToken, user}`; refresh returns the same shape. `/api/auth/me` returns the user directly. Passwords use bcrypt with 10 rounds; access JWTs last 15 minutes and refresh JWTs last 7 days. Only SHA-256 refresh-token hashes are stored in MySQL.

The refresh cookie is HTTP-only, `SameSite=Lax`, scoped to `/api/auth`, and `Secure` when `NODE_ENV=production`. Use HTTPS in production. Refresh rotation runs in a database transaction with a row lock. Logout revokes the current refresh token; an already-issued access token remains valid until its 15-minute expiry. Login permits 10 requests per IP per minute and then returns a JSON 429 response. Its in-memory rate counter resets when the server restarts.

The server requires two different JWT secrets and refuses to start with missing secrets or the example placeholders. Generate each secret with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`. Passwords require at least 8 characters and at most 72 UTF-8 bytes (bcrypt's input limit). Emails are trimmed and normalized to lowercase; roles are `tourist` (default), `teacher`, or `guide`. Validation failures return 400 `{error}`, bad login credentials return 401 with the same message for both unknown emails and wrong passwords, and duplicate registration returns 409.

`server/data/monuments.json` contains the curated monument records. Each monument has `slug`, `name_en`, `name_sq`, `type`, `municipality`, numeric `lat` and `lng`, and optional `built_period`, `short_description`, `history`, `image_now`, `image_now_credit`, `image_then`, and `sources` (an array of source strings). Put images in `client/public/monuments/<slug>/now.jpg` and `then.jpg`; use `/monuments/<slug>/now.jpg` and `/monuments/<slug>/then.jpg` in records. The seed validates the full dataset, upserts by slug in a transaction, and can be rerun without creating duplicates.

All AI calls run server-side. `server/src/services/ai.js` provides a generic 20-second JSON-request helper. The Time Machine's upload/generation/polling workflow lives entirely in `server/src/services/leonardoService.js`, with a 20-second timeout per external call and a 55-second overall deadline.

## Phase 4: heritage map dashboard

The protected `/map` dashboard draws local Natural Earth 1:50m country polygons from `client/public/geo/countries.geojson`; it uses no tile layer or external map service. Kosovo is highlighted in yellow, nearby countries are labeled, and navigation is constrained to the Balkans. Search filters markers by name and flies to a selected result. Typed SVG markers turn black when selected; closing the panel or pressing Escape clears the selection. Reset restores the Kosovo view and clears search.

The detail panel is 420px wide on desktop and becomes a scrolling bottom sheet below 1024px. It loads the protected monument detail endpoint, displays bilingual names, period, photographs, history, sources and a monument-specific Ciceroni link. Loading skeletons and retry states cover API failures. Rapid selection changes cancel stale detail requests.

Seed the existing dataset and start both services from the root:

```powershell
npm run seed
npm run dev:server
```

In another terminal:

```powershell
npm run dev:client
```

Log in and open `http://localhost:5173/map`. The current dataset contains four monuments, but their image fields are empty. Add credited photos and reconstructions under `client/public/monuments/<slug>/`, set `image_now`, `image_now_credit` and `image_then` in `server/data/monuments.json`, and rerun the seed. Missing or broken images show explicit unavailable states.

Verification commands:

```powershell
npm test --prefix client
npm run build
```

The map tests check the actual local GeoJSON's separate Kosovo feature and neighbors, map colors, all marker types, accent-insensitive search, dataset coordinate validity and safe source/image URLs. A real MySQL HTTP check verified unauthenticated 401, all four map records and detail responses, and unknown-slug 404. Browser visual verification was unavailable. Before the demo, check marker switching, search/Enter, zoom/reset, close/Escape, detail retry, source links and the Ciceroni link on desktop and a mobile screen. No before/after slider is included; both images appear separately.

## Structure

```text
client/src/api/           Axios instance
client/src/components/    Shared layout and protected route
client/src/context/       Authentication scaffold
client/public/monuments/  Monument photographs and reconstructions
server/src/routes/        Express routers
server/src/controllers/   Request handlers
server/src/middleware/    Error handling
server/src/services/      Server-only AI helper
server/data/              Curated monument seed data
server/schema.sql         MySQL tables
server/test/              HTTP route tests and optional live MySQL integration
```

## Tests

Client auth and validation tests:

```powershell
npm test --prefix client
npm run build
```

The client tests use an Axios adapter to cover in-memory sessions, token attachment, shared refreshes, delayed 401 responses, failed refresh, one-retry limits, logout races, and form validation. A browser smoke check should cover mobile navigation, invalid and valid form submissions, signup notification, login redirect, reload/session restoration, logout, and the home CTA for both visitors and logged-in users. Successful registration, login, and contact submission require a running API and initialized MySQL database.

```powershell
npm test --prefix server
```

The default suite exercises every endpoint over HTTP using the real Express app, bcrypt, JWT verification, cookies, validation, and rate limiter with an in-memory database adapter. It checks invalid input, duplicate registration, protected routes, token lifetimes, refresh rotation/replay/expiry, transaction rollback, concurrent refresh requests, logout, and the eleventh login request. It needs no `.env` secrets or running MySQL. These tests do not verify the MySQL engine or SQL execution.

An optional live MySQL integration test verifies all routes and concurrent refresh locking against real tables. With MySQL running and `server/.env` configured, run:

```powershell
$env:TEST_DB_NAME = 'hidden_heritage_test'
npm test --prefix server
Remove-Item Env:TEST_DB_NAME
```

The DB user needs permission to create the test database. The test requires a database name ending in `_test` that differs from `DB_NAME`, creates the tables from `schema.sql`, and removes only its own unique fixture records afterward. It leaves the test database/tables in place. The integration test is skipped when `TEST_DB_NAME` is unset.

## API examples with curl (PowerShell)

Start the API first. Use `curl.exe` because Windows PowerShell may alias `curl` to another command. Here-strings pipe JSON through stdin so quotes survive PowerShell argument handling. Use a fresh demo email if you have already registered this account.

Register (201, no cookie or access token):

```powershell
@'
{"full_name":"Demo Guide","email":"demo@example.com","password":"heritage123","role":"guide"}
'@ | curl.exe -i http://localhost:5000/api/auth/register -H "Content-Type: application/json" --data-binary '@-'
```

Login (200, saves the HTTP-only refresh cookie in a cookie jar):

```powershell
$login = @'
{"email":"demo@example.com","password":"heritage123"}
'@ | curl.exe -sS http://localhost:5000/api/auth/login -H "Content-Type: application/json" --data-binary '@-' -c "$env:TEMP/hidden-heritage-cookies.txt"
$accessToken = ($login | ConvertFrom-Json).accessToken
$login
```

Current user (200; omit the bearer header to get 401):

```powershell
curl.exe -i http://localhost:5000/api/auth/me -H "Authorization: Bearer $accessToken"
```

Protected map list (200, an empty array until monuments are seeded):

```powershell
curl.exe -i http://localhost:5000/api/monuments -H "Authorization: Bearer $accessToken"
```

Protected monument detail (200 for an existing slug, otherwise 404):

```powershell
$slug = 'replace-with-a-seeded-slug'
curl.exe -i "http://localhost:5000/api/monuments/$slug" -H "Authorization: Bearer $accessToken"
```

Refresh (200; both read and rewrite the cookie jar to keep the rotated token):

```powershell
$session = curl.exe -sS -X POST http://localhost:5000/api/auth/refresh -b "$env:TEMP/hidden-heritage-cookies.txt" -c "$env:TEMP/hidden-heritage-cookies.txt"
$accessToken = ($session | ConvertFrom-Json).accessToken
$session
```

Public contact submission (201):

```powershell
@'
{"name":"Demo Teacher","email":"teacher@example.com","message":"I would like to arrange a class visit."}
'@ | curl.exe -i http://localhost:5000/api/contact -H "Content-Type: application/json" --data-binary '@-'
```

Logout (200, revokes the refresh token and clears the cookie):

```powershell
curl.exe -i -X POST http://localhost:5000/api/auth/logout -b "$env:TEMP/hidden-heritage-cookies.txt" -c "$env:TEMP/hidden-heritage-cookies.txt"
```

Refreshing after logout returns 401:

```powershell
curl.exe -i -X POST http://localhost:5000/api/auth/refresh -b "$env:TEMP/hidden-heritage-cookies.txt"
```

## Phase 5: Time Machine with Leonardo

Put the real key only in **`server/.env`**:

```dotenv
LEONARDO_API_KEY=your-leonardo-api-key
```

`server/.env.example` contains an empty template entry. Do not copy the example over an existing `.env`, put the key in `client/.env`, prefix it with `VITE_`, or commit it. Restart the API after editing the key. No new database tables or dependencies are required for Phase 5; the existing MySQL/auth setup is needed to log in normally.

From the repository root, install dependencies if needed:

```powershell
npm install --prefix server
npm install --prefix client
```

Start the API and client in separate terminals:

```powershell
npm run dev:server
```

```powershell
npm run dev:client
```

Checks:

```powershell
npm test --prefix server
npm test --prefix client
npm run build
```

### Manual test

1. Open http://localhost:5173/time-machine while logged out: it must redirect to `/login`.
2. Log in with an existing account, then open **Time Machine** in the navbar.
3. Select or drop a PNG/JPG/JPEG/SVG of a heritage building under 5 MB. Original-era reconstruction is selected by default; 100 years ago is a separate optional mode. Only the photo is required: the backend reads monuments.json automatically and sends the dataset context with the uploaded photo to Leonardo. SVG is rasterized as an input PNG, never used as a replacement result.
4. Try a GIF, unreadable image, or image larger than 5 MB: show a clear error and disable generation. Drop multiple files: show an error. Both browser and server enforce validation; the server additionally checks raster signatures and dimensions. Images over 40 megapixels are rejected to keep the demo manageable.
5. Click **Travel back in time**. Upload/generation controls disable and the right panel shows **Travelling back in time…** with a warm shimmer that stays visible while the server polls Leonardo. On success, the generated image appears with **Download** and **Try again**. It should be recognizable as the same place, with a historically inspired treatment; exact geometry and historical accuracy are not guaranteed by an image model.
6. Click **Try again**: it reuses the same uploaded photo but starts a new Leonardo generation. Click **Download** to save the result. If the remote CDN blocks browser download requests, the page offers **Open image** so you can save it directly.
7. To test failure, temporarily blank LEONARDO_API_KEY in server/.env, restart the API, and generate again. Expect ?Historical reconstruction could not be generated. Please try again.? and a **Try again** button, with no replacement image. Restore your key and restart afterward. Provider failures return errors; timeouts show a timeout message.
8. Test at mobile width: panels stack vertically. At desktop width they appear side by side. Enable reduced motion: the shimmer must stop moving.

### Endpoint and workflow

`POST /api/time-machine` requires the existing bearer access token and multipart field **`image`**. The optional multipart mode field accepts original-era (default) or 100-years; historical context is loaded server-side from server/data/monuments.json. The server uses multer memory storage, accepts one PNG/JPEG up to 5 MB, and never writes the uploaded photo to disk. Direct SVG uploads are rejected; the frontend uploads their PNG conversion instead.

Using `$accessToken` obtained from the login curl example above:

```powershell
curl.exe -i -X POST http://localhost:5000/api/time-machine -H "Authorization: Bearer $accessToken" -F "image=@C:/path/to/heritage-photo.jpg"
```

Expected success: `200 {"imageUrl":"https://...","historicalContext":{...}}`, exclusively after Leonardo reports COMPLETE. Provider failure: `502 {"error":"Historical reconstruction could not be generated. Please try again."}`. Missing key: 503 with the same message. Timeout: `504 {"error":"Historical reconstruction timed out. Please try again."}`. Missing/invalid image: `400 {"error":"..."}`. Oversized file: `413 {"error":"..."}`. Missing/expired access token: `401 {"error":"Unauthorized"}`.

Leonardo-specific behavior is centralized in `server/src/services/leonardoService.js`: request `/v1/init-image`, POST every presigned field and binary file to S3 without a Leonardo authorization header, create `/v2/generations`, then poll `/v1/generations/{id}` about every 1.75 seconds until `COMPLETE`, `FAILED`, or the deadline. Generation uses `public:false`, `parameters.quantity:1`, and `parameters.guidances.image_reference` with `{image:{id,type:'UPLOADED'},strength:'MID'}`. Source dimensions preserve the aspect ratio approximately, rounding to multiples of 32 with a longest side around 1024. Prompt enhancement is off and the style is None to avoid changing the supplied historical prompt or adding an unrelated style.

Change **`LEONARDO_MODEL`** or **`LEONARDO_REFERENCE_STRENGTH`** in that one service file; The default `MID` reference strength allows structural changes while the prompt retains the site footprint and viewpoint. The Axios request overrides its usual timeout to 65 seconds for this route. The server stops its workflow after 55 seconds and each external call after 20 seconds. In development, server logs include the failing step, generation ID when available, and exact provider error/response with the API key redacted; production logs retain only controlled diagnostic codes. No local filtered or replacement image is generated. Stopping local polling does not cancel a job already queued at Leonardo; **Try again** creates another job.

### API verification and remaining assumptions

Request fields were checked against the official [FLUX.1 Kontext Max guide](https://docs.leonardo.ai/docs/flux1-kontext-max), [init-image endpoint](https://docs.leonardo.ai/v1.0/reference/uploadinitimage), [presigned-upload guide](https://docs.leonardo.ai/docs/how-to-upload-an-image-using-a-presigned-url), [generation-status endpoint](https://docs.leonardo.ai/v1.0/reference/getgenerationbyid), and [current v2 async response example](https://docs.leonardo.ai/me/docs/remove-bg).

During implementation, a live authenticated `/v2/models` lookup returned 200 and listed FLUX.1 Kontext Max. A synthetic PNG test received a real init-image response (200) and completed its presigned upload (204). The check intentionally stopped before creating a paid generation. Automated tests mock generation and polling responses and cover validation, authentication, timeout, provider failure, malformed responses, SVG input conversion, polling until completion, and error responses without substitute images. Browser visual checks and a paid end-to-end generation have not been performed.

The written Kontext Max guide documents `strength:MID`, but the live model metadata does not list the strength property. The implementation keeps the explicitly requested/documented setting; its actual influence remains unverified. The code expects v2's documented top-level `generationId` and also accepts the older `generate.generationId` envelope, then uses the documented v1 status/result shape `generations_by_pk.status` and `generated_images[0].url`. A paid generation is still needed to verify that complete flow for your account. Private mode means `public:false` prevents the generation from being listed in Leonardo's community feed; it does not imply that remote CDN URLs require your app's authentication.

The reconstruction prompt explicitly requests physical changes to buildings and surroundings in natural color, and prohibits unchanged-photo aging effects. The default original-era mode uses reconstruction_period and original_appearance when compatible with the visible monument. It does not calculate or label a 100-year date. The separate 100-years mode targets 100 years before the current year and may depict ruins. Uncertain identities or phases are hypothetical, not verified dates. Prompt instructions cannot guarantee historical accuracy or force every generated result to satisfy the reconstruction request.

The Time Machine has no monument selector or historical-context form; only an optional two-button period switch. Users upload a photo and click Travel back in time. The server reads the dataset directly, so this feature does not require seeding the monument records into MySQL (authentication still does). Leonardo receives all current dataset entries and is instructed to use only the entry matching the actual photo, avoid mixing sites, and keep uncertain matches conservative. The app does not claim a separately verified monument identification. Dataset source links shown under the result cover possible matching records, not a confirmed identification. No additional recognition API or key is required. A dataset that exceeds the model prompt limit returns a clear error rather than silently discarding records.

### Architectural reconstruction correction

Original-era mode requests complete architecture along the actual photo footprints rather than unchanged ruins. For archaeological foundations only, the prompt describes modest masonry buildings, standing walls, entrances, connected structures, timber roofs, terracotta tiles, compatible curved roof forms and a proportionate visible circular footprint. These details are explicitly hypothetical where evidence is missing. Separate church, mosque, castle, tower and bridge instructions prevent this concept from being used as a universal style. The original camera angle, terrain and agricultural surroundings must remain recognizable. Dataset matches are inferred by Leonardo and are not independently verified.

The interface labels the left panel Present-day reference and the default right panel AI reconstruction ? original era, with Hypothetical historical interpretation. Architectural details may be uncertain. The desired transformation example is never uploaded as a content reference, returned as a result, or used as a fallback.

The documented FLUX.1 Kontext Max image-reference mechanism remains parameters.guidances.image_reference with the actual uploaded init ID, type UPLOADED, and strength MID. Prompt enhancement remains OFF and the style is None. No unsupported negative-prompt or denoising field is sent. Development logs record the reference ID/byte count and accepted generation ID without credentials. Tests verify reference bytes, reference ID in the generation payload, separate period semantics, structural prompt instructions and failed/empty/timed-out results.

Visual validation still requires the original reference photo: only a completed-building illustrative example was available in the latest message, and no raster reference files exist in the workspace. No real generation or visual success is claimed for this correction. With the original photo, generate in Original-era mode and check complete buildings, foundation layout, matching viewpoint, retained surroundings, no unrelated architecture, and a COMPLETE Leonardo generation rather than accepting HTTP success alone.

## Ciceroni with Groq

Ciceroni uses the official groq-sdk on the server and POST /api/chat. The initial checkout had only a Ciceroni placeholder, so this implementation adds a heritage-styled waving SVG mascot, Talk to me entry point, responsive conversation panel and selected-monument context. Leonardo and the Time Machine files are unchanged by this integration.

Backend-only configuration in server/.env (already ignored by Git):

```dotenv
GROQ_API_KEY=your-key-here
GROQ_MODEL=openai/gpt-oss-120b
```

The example environment file intentionally leaves both Groq values empty. Never put these in client/.env or use a VITE_ key. The provided key has been configured locally without printing it. Models and API methods were checked against [Groq models](https://console.groq.com/docs/models), the [official JavaScript SDK](https://github.com/groq/groq-typescript), the [chat API reference](https://console.groq.com/docs/api-reference) and [structured-output support](https://console.groq.com/docs/structured-outputs). GPT-OSS 120B was also confirmed in the authenticated models endpoint. The current implementation requires a model supporting strict JSON schema output; 120B and 20B are documented supported examples.

From the root:

```powershell
npm install --prefix server
npm run dev:server
```

In a separate terminal:

```powershell
npm run dev:client
```

Checks and optional real-provider verification:

```powershell
npm test --prefix server
npm test --prefix client
npm run build
npm run verify:chat --prefix server
```

The live verifier makes real Groq requests and prints answers and dataset-resolved sources, never the key. It uses a local authenticated test server without requiring a database login. Normal app login still uses MySQL.

### Chat endpoint and evidence

POST /api/chat requires Authorization: Bearer <accessToken> and JSON:

```json
{ "message": "Tell me about Ulpiana", "monumentId": "ulpiana", "language": "en", "history": [] }
```

monumentId is optional and accepts a dataset slug or a positive MySQL monument ID. Messages must contain 1?2000 characters. History accepts at most 12 user/assistant turns, at most 2000 characters per turn and 16000 total. Client system roles, extra instructions and unknown payload keys are rejected. Sources resolve only from server-selected dataset entries; returned IDs are validated and generated source URLs are discarded. The model receives one matching monument, or up to three candidate names for a clarification question, never the full dataset. Numeric IDs resolve to a slug through MySQL; slug matching and the protected GET /api/chat/monuments list use server/data/monuments.json directly. Previous user messages can supply context for follow-ups. Reconstruction dates are excluded from chat evidence to avoid conflating illustrative dates with documented history. Architectural interpretations are marked hypothetical.

The server uses a 20-second deadline and disables SDK retries. Each authenticated user may submit 10 requests per minute. Provider authentication failures are mapped to 502 rather than client 401, so an invalid Groq key does not trigger the user-session refresh interceptor. Missing configuration returns 503; provider rate limits return 429; timeouts return 504; network/empty/malformed responses return 502. Provider failures use the message Ciceroni couldn’t respond right now. Please try again. Validation, authentication and unknown-monument errors use appropriate 400/401/404 statuses. Development diagnostics include controlled error codes and status only, not request content, raw provider errors or credentials. No hardcoded answer substitutes for a failed provider response.

The frontend renders answers as escaped plain text with preserved newlines, not raw HTML. Citation links appear separately from trusted server source records. Enter sends, Shift+Enter inserts a newline, duplicate sends are blocked, Ciceroni is thinking is shown while awaiting the response, and Retry resends the exact failed request without appending a duplicate user message. Context and history are preserved. /ciceroni?monumentId=ulpiana preselects a monument; the legacy monument query parameter is also accepted. Reduced-motion preferences disable the mascot wave.

### Checks performed and limits

Live GPT-OSS 120B responses were checked for an Albanian question, a selected Ulpiana question with an approved source link, a follow-up using conversation history, and unavailable ticket/opening/first-builder information. Unsupported questions returned uncertainty without invented sources. An early trial exposed reconstruction-date contamination; those concept dates were removed from historical chat evidence before the final live check. Albanian wording can still be imperfect and model-generated historical claims need human review; source IDs validate provenance, not factual entailment. Dataset URLs are allowlisted and protocol-validated, not browsed or revalidated for current availability. Mocked integration checks cover missing keys/models, provider authentication/rate/network errors, invalid/empty output, bounded timeout, per-user rate limiting, invalid system instructions and invented source IDs/URLs. Browser interaction/visual checks and the optional live MySQL test were not performed.
