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

Copy the example environment file and edit it:

```bash
cd okr-app
cp .env.example .env
```

Edit `.env` with your settings:

```bash
# Host path where the SQLite database will be stored
DATA_DIR=/mnt/ssd/ruok

# Username that gets admin privileges on login
ADMIN_USERNAME=youruser
```

- **`DATA_DIR`** — Where the database is stored on the host. Point this at your external storage (e.g. `/mnt/ssd/ruok`, `/mnt/usb/ruok`). Defaults to `./data` if not set. The directory must exist:
  ```bash
  mkdir -p /mnt/ssd/ruok
  ```
- **`ADMIN_USERNAME`** — The username you'll create on first login. That account gets admin privileges.

The `.env` file is gitignored, so your config won't conflict with `git pull`.

Deploy:

```bash
docker compose up -d --build
```

Access the app at `https://ruok.rpi-01.lan`.

### Updating

Pull the latest code and rebuild:

```bash
cd okr-app
git pull
docker compose up -d --build
```

Your data is safe — the database lives on the host at `$DATA_DIR`, not inside the image. The `.env` file is gitignored so `git pull` won't overwrite your config.

To clean up old images after updating:

```bash
docker image prune -f
```

### Adding more services

1. Add `networks: [proxy]` to the new service's compose file (no `ports` needed)
2. Add a block to the Caddyfile
3. `docker compose restart` Caddy

## Environment Variables

Configuration is set via a `.env` file (gitignored). Copy `.env.example` to `.env` and edit it.

| Variable | Default | Description |
|----------|---------|-------------|
| `DATA_DIR` | `./data` | Host path where the SQLite database is stored |
| `ADMIN_USERNAME` | *(none)* | Username that gets admin privileges on login |

These are referenced by `docker-compose.yml` via variable substitution. Plugin credentials (Fitbit client ID/secret, base URL) are configured through the admin UI at `/admin` — no environment variables needed.

## Admin

The admin dashboard at `/admin` gives you:
- **User management** — view, disable/enable, delete accounts
- **Plugin configuration** — set up Fitbit OAuth credentials, base URL
- **Query execution logs** — filter by user, success/failure, date range
- **Statistics** — user counts, query executions, error rates

## Database

All data lives in a single SQLite file at `$DATA_DIR/okr.db` on the host (the path you set in `.env`).

**Backup:**

```bash
# Copy directly from your DATA_DIR
cp $DATA_DIR/okr.db ~/backups/ruok-$(date +%F).db
```

Or use the in-app backup: Settings > Download Backup (exports as JSON).

**Reset:**

```bash
docker compose down
rm $DATA_DIR/okr.db
docker compose up -d --build
```

## First Time Setup

1. Open the app in your browser
2. Click "Create Account" — pick a username and password (use the one you set as `ADMIN_USERNAME`)
3. Go to Settings to configure your metrics, tags, and integrations
4. Set yearly objectives at `/objectives`, then break them into monthly goals
5. Use `/daily` to plan each day
