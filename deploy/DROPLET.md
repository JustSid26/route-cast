# Deploying route-cast to a DigitalOcean Droplet

The whole app is a `docker-compose.yml`, so on a single Linux host deployment is
basically **clone + one command**. The database self-provisions on first boot
(Compose mounts the SQL migrations + seed into Postgres' init dir), so there are
no manual migration steps.

## 1. Create the Droplet
- **Ubuntu 24.04**, **2 vCPU / 4 GB** (`s-2vcpu-4gb`, ~$24/mo) is the sweet spot —
  OR-Tools is the only memory-hungry piece. 2 GB works for a demo but is tight
  during a simultaneous solve + image build.
- Add your SSH key during creation.

## 2. Install Docker
```bash
ssh root@<droplet-ip>
curl -fsSL https://get.docker.com | sh
```

## 3. Get the code
```bash
git clone https://github.com/JustSid26/route-cast.git
cd route-cast
```

## 4. Create the server-side `.env`
Type it on the server — never commit it. The API URL is **baked into the
frontend at build time**, so it must be the public URL clients will hit.

**Bare IP (quick demo, HTTP only):**
```bash
cat > .env <<'EOF'
POSTGRES_PASSWORD=<strong-password>
ORS_API_KEY=<your-ors-key>
ORS_GEOCODE_COUNTRY=IN
ORS_GEOCODE_RADIUS_KM=60
NEXT_PUBLIC_API_URL=http://<droplet-ip>:4000/api
FRONTEND_PORT=3000
BACKEND_PORT=4000
EOF
```

**Real domain with HTTPS (recommended — see step 6):**
```bash
cat > .env <<'EOF'
POSTGRES_PASSWORD=<strong-password>
ORS_API_KEY=<your-ors-key>
ORS_GEOCODE_COUNTRY=IN
ORS_GEOCODE_RADIUS_KM=60
DOMAIN=routecast.example.com
NEXT_PUBLIC_API_URL=https://routecast.example.com/api
EOF
```

## 5. Quick start (bare IP, no proxy)
```bash
docker compose up -d --build
ufw allow OpenSSH && ufw allow 3000 && ufw allow 4000 && ufw --force enable
```
Open `http://<droplet-ip>:3000`. The DB migrates + seeds itself on first boot.

## 6. Production: HTTPS with Caddy (recommended)
A public demo on a bare `http://` IP looks sketchy and some browser features are
restricted. The `docker-compose.prod.yml` overlay adds a **Caddy** reverse proxy
that auto-provisions a Let's Encrypt cert and routes `/api/*` → backend, `/*` →
frontend.

1. Point an **A record** for your domain at the Droplet's IP (DNS must resolve
   before Caddy can issue the cert).
2. Set `DOMAIN` and the `https://…/api` `NEXT_PUBLIC_API_URL` in `.env` (step 4).
3. Bring it up with both compose files:
   ```bash
   docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
   ```
4. Firewall down to web + SSH only:
   ```bash
   ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw --force enable
   ```
Open `https://routecast.example.com`. Caddy reaches `frontend:3000` and
`backend:4000` over the internal Compose network, so 3000/4000 don't need to be
public.

## Updating after a push to main
```bash
cd route-cast
git pull
# whichever command you started with:
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```
> The frontend's `NEXT_PUBLIC_API_URL` is fixed at build time — if you change the
> domain, you must rebuild the frontend (`--build` does this).

## Gotchas
1. **`NEXT_PUBLIC_API_URL` is build-time, public, and must include `/api`.**
   Changing it requires a rebuild.
2. **DNS first, then HTTPS.** Caddy can't get a cert until the A record resolves
   to the Droplet.
3. **Secrets stay out of git.** `.env` lives only on the server; it's gitignored.
4. **Memory.** If a build gets OOM-killed on a 2 GB box, add swap
   (`fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile`)
   or size up the Droplet.
