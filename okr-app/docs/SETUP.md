# Setup Guide

RUOK is designed to run on a Raspberry Pi (or any Linux machine) behind a Caddy reverse proxy, with each service in its own Docker Compose and a shared Docker network.

## Quick Start (Development)

```bash
cd okr-app
npm install
npm run db:push
npm run dev
```

Opens on `http://localhost:5180` with hot reload.

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

https://ruok.rpi-01.lan {
    reverse_proxy ruok:3000
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

### 5. Configure and deploy RUOK

Edit `docker-compose.yml` in the `okr-app` directory before deploying:

```yaml
services:
  ruok:
    build: .
    container_name: ruok
    restart: unless-stopped
    volumes:
      # Bind mount — change the left side to your desired host path
      - /mnt/data/ruok:/app/data
    environment:
      - NODE_ENV=production
      - DATABASE_PATH=/app/data/okr.db
      - ADMIN_USERNAME=youruser
    networks:
      - proxy

networks:
  proxy:
    external: true
```

**Before starting**, configure these:

1. **`volumes`** — The left side of the `:` is the host path where the SQLite database will be stored. Change `/mnt/data/ruok` to wherever you want it (e.g. `/mnt/ssd/ruok`, `~/ruok-data`, etc.). The directory must exist:
   ```bash
   mkdir -p /mnt/data/ruok
   ```

2. **`ADMIN_USERNAME`** — Replace `youruser` with the username you'll create on first login. That account gets admin privileges.

Then deploy:

```bash
cd okr-app
docker compose up -d --build
```

Access the app at `https://ruok.rpi-01.lan`.

### Adding more services

1. Add `networks: [proxy]` to the new service's compose file (no `ports` needed)
2. Add a block to the Caddyfile
3. `docker compose restart` Caddy

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `production` | Set to `production` for deployed instances |
| `DATABASE_PATH` | `/app/data/okr.db` | Path to the SQLite database inside the container |
| `ADMIN_USERNAME` | *(none)* | Username that gets admin privileges on login |

All variables are set directly in the `environment` section of `docker-compose.yml`. Plugin credentials (Fitbit client ID/secret, base URL) are configured through the admin UI at `/admin` — no environment variables needed.

## Admin

The admin dashboard at `/admin` gives you:
- **User management** — view, disable/enable, delete accounts
- **Plugin configuration** — set up Fitbit OAuth credentials, base URL
- **Query execution logs** — filter by user, success/failure, date range
- **Statistics** — user counts, query executions, error rates

## Database

All data lives in a single SQLite file. Its location on the host is determined by the `volumes` bind mount in `docker-compose.yml`.

**Backup:**

```bash
# Copy directly from the host path you configured
cp /mnt/data/ruok/okr.db ~/backups/ruok-$(date +%F).db
```

Or use the in-app backup: Settings > Download Backup (exports as JSON).

**Reset:**

```bash
docker compose down
rm /mnt/data/ruok/okr.db
docker compose up -d --build
```

## First Time Setup

1. Open the app in your browser
2. Click "Create Account" — pick a username and password (use the one you set as `ADMIN_USERNAME`)
3. Go to Settings to configure your metrics, tags, and integrations
4. Set yearly objectives at `/objectives`, then break them into monthly goals
5. Use `/daily` to plan each day
