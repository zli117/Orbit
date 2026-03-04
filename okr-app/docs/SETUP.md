# Setup Guide

RUOK is designed to run on a Raspberry Pi (or any Linux machine) behind a Caddy reverse proxy, with each service in its own Docker Compose and a shared Docker network.

## Quick Start (Development)

```bash
cd okr-app
export ADMIN_USERNAME=admin
export DATA_DIR=data
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

---

## Advanced: Let's Encrypt with Cloudflare DNS Challenge

This section covers how to get a real, publicly trusted TLS certificate for a server that sits behind NAT (e.g. a Raspberry Pi on your home network). Since the server isn't reachable from the internet, the standard HTTP-01 challenge won't work. Instead, we use the **DNS-01 challenge** — Let's Encrypt verifies you own the domain by checking a DNS TXT record, which Caddy creates automatically via the Cloudflare API. No ports need to be forwarded.

### How it works

```
You ──── home network ──── Pi (192.168.1.50)
                            ├── Caddy (HTTPS :443)
                            └── RUOK  (:3000)

Certificate flow (no inbound traffic needed):
  1. Caddy calls Cloudflare API to create a _acme-challenge TXT record
  2. Let's Encrypt reads the TXT record from public DNS
  3. Let's Encrypt issues the certificate to Caddy
  4. Caddy removes the TXT record
```

Your server never needs to be reachable from the internet. DNS points `ruok.example.com` to the Pi's LAN IP, so it only resolves for devices on your local network (or via VPN/Tailscale).

### Prerequisites

- A domain on Cloudflare (e.g. `example.com`) — free plan is fine
- A Cloudflare API token with **Zone:DNS:Edit** permission

#### Creating the Cloudflare API token

1. Go to [Cloudflare Dashboard → My Profile → API Tokens](https://dash.cloudflare.com/profile/api-tokens)
2. Click **Create Token**
3. Use the **Edit zone DNS** template, or create a custom token with:
   - **Permissions**: Zone → DNS → Edit
   - **Zone Resources**: Include → Specific zone → `example.com`
4. Copy the generated token

### 1. Build Caddy with the Cloudflare plugin

The official Caddy image doesn't include DNS provider modules. Create a `Dockerfile` in your Caddy directory:

**`~/caddy/Dockerfile`**:

```dockerfile
FROM caddy:2-builder AS builder
RUN xcaddy build --with github.com/caddy-dns/cloudflare

FROM caddy:2
COPY --from=builder /usr/bin/caddy /usr/bin/caddy
```

### 2. Update the Caddy docker-compose.yml

**`~/caddy/docker-compose.yml`**:

```yaml
services:
  caddy:
    build: .
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    environment:
      - CLOUDFLARE_API_TOKEN=${CLOUDFLARE_API_TOKEN}
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

Create a `.env` file in the Caddy directory:

```bash
CLOUDFLARE_API_TOKEN=your_cloudflare_api_token_here
```

### 3. Update the Caddyfile

Replace the `local_certs` config with the DNS challenge. Remove the `local_certs` global option entirely:

**`~/caddy/Caddyfile`**:

```caddyfile
ruok.example.com {
    tls {
        dns cloudflare {env.CLOUDFLARE_API_TOKEN}
    }
    reverse_proxy ruok:3000
}

# Add more services:
# photos.example.com {
#     tls {
#         dns cloudflare {env.CLOUDFLARE_API_TOKEN}
#     }
#     reverse_proxy photos:8080
# }
```

### 4. Set up DNS resolution

The certificate doesn't need the domain to resolve — Caddy obtains it via the Cloudflare API. But your **devices** need to resolve `ruok.example.com` to the Pi's LAN IP to actually reach the server.

**Important:** Cloudflare's DNS servers filter out private IPs (RFC 1918 like `192.168.x.x`, `10.x.x.x`). Adding an A record with a LAN IP in the Cloudflare dashboard won't work — `dig` will return nothing. You need to resolve the domain locally instead.

#### Option A: Local DNS with dnsmasq / Pi-hole (recommended)

Resolve the domain on your local network. Don't add any A record in Cloudflare — the domain only needs to resolve on your LAN.

**With dnsmasq / Pi-hole:**

```bash
# Single subdomain
echo "address=/ruok.example.com/192.168.1.50" | sudo tee /etc/dnsmasq.d/ruok.conf

# Or wildcard for all subdomains
echo "address=/.example.com/192.168.1.50" | sudo tee /etc/dnsmasq.d/ruok.conf

sudo systemctl restart dnsmasq
```

Then set your router's DHCP DNS server to the Pi's IP so all devices on the network use it.

#### Option B: Tailscale

If you use Tailscale, add an A record in Cloudflare pointing to the Pi's **Tailscale IP** (e.g. `100.x.y.z`). These aren't private IPs, so Cloudflare won't filter them. The app is then accessible from any device on your tailnet.

| Type | Name | Content | Proxy |
|------|------|---------|-------|
| A | `ruok` | `100.x.y.z` | DNS only (grey cloud) |

**Important:** Set the proxy toggle to **DNS only** (grey cloud icon). If you enable the orange-cloud proxy, Cloudflare will try to route traffic through its edge network.

#### Option C: `/etc/hosts` (quick and dirty)

On each device, add a line to `/etc/hosts` (or the equivalent on your OS):

```
192.168.1.50  ruok.example.com
```

Simple but doesn't scale — you have to do it on every device.

---

None of these affect certificate issuance. The DNS-01 challenge works via the Cloudflare API (Caddy creates a `_acme-challenge` TXT record directly), so it doesn't matter how — or whether — the domain's A record resolves.

### 5. Build and start

```bash
cd ~/caddy
docker compose up -d --build
```

Caddy will automatically:
1. Call the Cloudflare API to create a `_acme-challenge.ruok.example.com` TXT record
2. Wait for Let's Encrypt to verify it via public DNS
3. Receive the signed certificate
4. Clean up the TXT record
5. Serve HTTPS with the real certificate

The first request may take 30–60 seconds while the certificate is issued. Renewals happen automatically in the background (certificates last 90 days, Caddy renews at ~30 days remaining).

Your app is now at `https://ruok.example.com` — green lock, no certificate warnings, no ports forwarded.

### Wildcard certificates

To issue a single wildcard certificate for all subdomains, use a wildcard site block:

```caddyfile
*.example.com {
    tls {
        dns cloudflare {env.CLOUDFLARE_API_TOKEN}
    }

    @ruok host ruok.example.com
    handle @ruok {
        reverse_proxy ruok:3000
    }

    # @photos host photos.example.com
    # handle @photos {
    #     reverse_proxy photos:8080
    # }
}
```

### Troubleshooting

**Certificate not issuing:**
```bash
cd ~/caddy
docker compose logs caddy
```

Common issues:
- Token doesn't have DNS edit permission for the correct zone
- Token was created for the wrong zone or with account-level scope instead of zone-level

**"Connection refused" from browser:**

The domain resolves but the browser can't connect. Check:
- Is the DNS record pointing to the correct LAN IP? (`dig ruok.example.com`)
- Is Caddy running? (`docker compose ps`)
- Are you on the same network as the Pi?

**Certificate issued but browser still warns:**

Clear your browser's HSTS/certificate cache, or try an incognito window. Old self-signed certificate state can persist.
