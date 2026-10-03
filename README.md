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

## Phase 0 scope

Shared branded navigation/footer and all requested routes are scaffolded. `/map`, `/time-machine`, and `/ciceroni` redirect unauthenticated visitors to `/login`. Login, signup, contact submission, the map, and AI experiences are placeholders for subsequent phases. `AuthContext` starts without a user; real session restoration and server authorization must be implemented with authentication.

`server/data/monuments.json` starts as an empty array, ready for curated data. Each monument has `slug`, `name_en`, `name_sq`, `type`, `municipality`, numeric `lat` and `lng`, and optional `built_period`, `short_description`, `history`, `image_now`, `image_now_credit`, `image_then`, and `sources` (an array of source strings). Put images in `client/public/monuments/<slug>/now.jpg` and `then.jpg`; use `/monuments/<slug>/now.jpg` and `/monuments/<slug>/then.jpg` in records. The seed validates the full dataset, upserts by slug in a transaction, and can be rerun without creating duplicates.

All future AI calls must run server-side through `server/src/services/ai.js`, which enforces a 20-second timeout and returns a supplied fallback on failure. No external AI call is made in Phase 0.

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
```
