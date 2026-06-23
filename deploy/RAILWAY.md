# Deploying route-cast to Railway

This app is four services. On Railway they become **one project with four
services**: the three code services deploy from this GitHub repo (each pinned to
its own root directory), and Postgres is deployed from the official PostGIS
Docker image.

| Service              | Source                                   | Public? |
| -------------------- | ---------------------------------------- | ------- |
| `postgres`           | Docker image `postgis/postgis:16-3.4`    | no      |
| `optimization-service` | GitHub repo, root dir `optimization-service` | no      |
| `backend`            | GitHub repo, root dir `backend`          | **yes** |
| `frontend`           | GitHub repo, root dir `frontend`         | **yes** |

> Why GitHub deploy: every merge to `main` auto-redeploys. Why a Docker image
> for the DB: Railway's default managed Postgres has **no PostGIS**, and our
> schema needs `geography(Point,4326)`.

`backend` is public because the browser calls it directly (the frontend's
`NEXT_PUBLIC_API_URL` is a client-side URL). `optimization-service` is reached
only by the backend over Railway's private network, so it needs no public domain.

---

## Order of operations

Do this in order — the frontend build needs the backend's public URL to already exist.

### 1. Create the project + connect the repo
- **New Project → Deploy from GitHub repo →** `JustSid26/route-cast`.
- This creates one service; we'll set its root dir next and add the rest.

### 2. Postgres (PostGIS)
- **New → Docker Image →** `postgis/postgis:16-3.4`.
- **Variables:**
  - `POSTGRES_USER=vrp`
  - `POSTGRES_PASSWORD=<pick-a-strong-one>`
  - `POSTGRES_DB=vrp`
- **Add a Volume** mounted at `/var/lib/postgresql/data` (so data survives redeploys).
- Deploy. Railway exposes a `DATABASE_URL` reference variable on this service.

### 3. optimization-service
- Add a service from the repo; **Settings → Root Directory =** `optimization-service`.
- Railway detects its Dockerfile. No variables required (`SOLVER_TIME_LIMIT`
  defaults to 10; raise it if you want longer solves).
- **Do not** generate a public domain — it's internal only.
- Note its private address: `optimization-service.railway.internal:8000`.

### 4. backend
- Add a service from the repo; **Root Directory =** `backend`.
- **Variables:**
  - `DATABASE_URL` = reference the Postgres service's `DATABASE_URL`
    (Railway: `${{Postgres.DATABASE_URL}}`).
  - `OPTIMIZATION_SERVICE_URL=http://optimization-service.railway.internal:8000`
  - `ORS_API_KEY=<your ORS key>`  ← paste here; **never** commit it.
  - `ORS_PROFILE=driving-car`
  - `ORS_GEOCODE_COUNTRY=IN`
  - `ORS_GEOCODE_RADIUS_KM=60`
- **Settings → Generate Domain.** Copy it, e.g. `https://route-cast-backend.up.railway.app`.
- The backend binds Railway's injected `$PORT` automatically (see env.ts).

### 5. Run the migrations (once)
The Compose setup auto-runs SQL via `/docker-entrypoint-initdb.d`; Railway deploys
from an image, so there's no file mount — run them yourself once the DB is up.
Locally, with the Railway CLI (`npm i -g @railway/cli && railway link`):

```bash
# DATABASE_URL is the *public* connection string from the Postgres service's
# "Connect" tab (the .railway.internal host only resolves inside Railway).
export DATABASE_URL="postgresql://vrp:<pw>@<host>:<port>/vrp"
psql "$DATABASE_URL" -f db/migrations/001_init.sql
psql "$DATABASE_URL" -f db/migrations/002_analysis.sql
psql "$DATABASE_URL" -f db/seed.sql   # optional: demo depots/vehicles/deliveries
```

### 6. frontend
- Add a service from the repo; **Root Directory =** `frontend`.
- **Variables (set BEFORE the first build — it's inlined at build time):**
  - `NEXT_PUBLIC_API_URL=https://route-cast-backend.up.railway.app/api`
    (the backend domain from step 4, with `/api`).
- **Settings → Generate Domain.** This is the app URL you share.
- The frontend binds `$PORT` via its `start` script.

> If you accidentally built the frontend before setting `NEXT_PUBLIC_API_URL`,
> just **Redeploy** it after setting the variable — the value only takes effect
> on a fresh build.

---

## Gotchas (the ones that actually bite)

1. **Root Directory per service.** Without it, Railway builds from the repo root
   and fails. This is the #1 monorepo mistake.
2. **`NEXT_PUBLIC_API_URL` is build-time**, not runtime. Set it before building;
   changing it later requires a redeploy. Must be the backend's **public** URL.
3. **PostGIS, not plain Postgres.** Use the `postgis/postgis` image; the schema
   won't migrate on stock Postgres.
4. **`$PORT` binding.** Backend reads `process.env.PORT` first; frontend's
   `start` script uses `${PORT:-3000}`. Both honor Railway's injected port.
   The optimizer stays on fixed `8000` because it's only reached privately at
   `:8000`.
5. **Secrets.** `ORS_API_KEY` and `POSTGRES_PASSWORD` live in Railway's
   Variables UI only — never in git. `.env` stays gitignored.

## Cost
Four small services + a DB volume fit comfortably in Railway's **$5/mo Hobby**
plan (usage-based). Plenty for a demo and light production.
