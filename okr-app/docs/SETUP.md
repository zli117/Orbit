# Setup Guide

Orbit is designed to run on a Raspberry Pi (or any Linux machine) behind a Caddy reverse proxy, with each service in its own Docker Compose and a shared Docker network.

## Quick Start (Development)

```bash
cd okr-app
npm install
npm run db:push
npm run dev
```

Opens on `http://localhost:5173` with hot reload.

## Deployment

### 1. One-time setup: create the shared network

```bash
docker network create proxy
```

### 2. Set up Caddy (if you haven't already)

Create a directory for Caddy (e.g. `~/caddy`) with:

**`docker-compose.yml`**:

```yaml
services:
  caddy:
    image: caddy:2
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
      - caddy_config:/config
    networks:
      - proxy

volumes:
  caddy_data:
  caddy_config:

networks:
  proxy:
    external: true
```

**`Caddyfile`**:

```caddyfile
{
    local_certs
}

https://orbit.rpi-01.lan {
    reverse_proxy orbit:3000
}

# Add more services here:
# https://photos.rpi-01.lan {
#     reverse_proxy photos:8080
# }
```

Start Caddy:

```bash
cd ~/caddy && docker compose up -d
```

### 3. Set up DNS

You need `*.rpi-01.lan` to resolve to your Pi's IP. Options:

- **Router DNS**: Add entries in your router's DNS settings (if supported)
- **Pi-hole / dnsmasq**: Add a wildcard rule on the Pi:
  ```bash
  echo "address=/.rpi-01.lan/YOUR_PI_IP" | sudo tee /etc/dnsmasq.d/rpi-wildcard.conf
  sudo systemctl restart dnsmasq
  ```
  Then set your router's DHCP DNS server to the Pi's IP.

### 4. Trust the self-signed certificate (one-time)

After Caddy starts, extract its root CA and install it on your devices:

```bash
cd ~/caddy
docker compose exec caddy cat /data/caddy/pki/authorities/local/root.crt > caddy-root.crt
```

Transfer `caddy-root.crt` to your phones/laptops and install it as a trusted certificate. After this, all `*.rpi-01.lan` sites show a green lock.

### 5. Deploy Orbit

```bash
cd okr-app
docker compose up -d --build
```

That's it. Access the app at `https://orbit.rpi-01.lan`.

### Adding more services

1. Add `networks: [proxy]` to the new service's compose file (no `ports` needed)
2. Add a block to the Caddyfile
3. `docker compose restart` Caddy

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_PATH` | `/app/data/okr.db` | Path to SQLite database inside the container |
| `ADMIN_USERNAME` | *(none)* | Username that gets admin privileges on login |

Plugin credentials (Fitbit client ID/secret, base URL) are configured through the admin UI at `/admin` — no environment variables needed.

## Admin

Set `ADMIN_USERNAME` in your docker-compose environment to grant admin privileges to that user:

```yaml
environment:
  - ADMIN_USERNAME=youruser
```

The admin dashboard at `/admin` gives you:
- **User management** — view, disable/enable, delete accounts
- **Plugin configuration** — set up Fitbit OAuth credentials, base URL
- **Query execution logs** — filter by user, success/failure, date range
- **Statistics** — user counts, query executions, error rates

## Database

All data lives in a single SQLite file at `DATABASE_PATH`.

**Backup:**

```bash
# Docker volume path (find it with: docker volume inspect okr-app_okr-data)
cp /var/lib/docker/volumes/okr-app_okr-data/_data/okr.db ~/backups/orbit-$(date +%F).db
```

Or use the in-app backup: Settings > Download Backup (exports as JSON).

**Reset:**

```bash
docker compose down
docker volume rm okr-app_okr-data
docker compose up -d --build
```

## First Time Setup

1. Open the app in your browser
2. Click "Create Account" — pick a username and password
3. Go to Settings to configure your metrics, tags, and integrations
4. Set yearly objectives at `/objectives`, then break them into monthly goals
5. Use `/daily` to plan each day
