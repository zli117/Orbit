# Raspberry Pi Home Server Setup

Step-by-step guide to deploy OKR Tracker on a Raspberry Pi with HTTPS.

**Scenario:** Raspberry Pi on your home network, HTTPS for local access, VPN for remote access.

**Two approaches covered:**
1. **Local HTTPS only** (recommended) - DNS challenge for certificates, access via local network + VPN
2. **Public access** - Cloudflare Tunnel for internet-facing deployment

---

## Prerequisites

- Raspberry Pi 4 or 5 (2GB+ RAM)
- Raspberry Pi OS 64-bit (Bookworm or newer)
- A domain name (~$10/year, or free subdomain from DuckDNS)
- SSH access to your Pi

---

## Part 1: Prepare the Raspberry Pi

### Step 1.1: Update the system

```bash
sudo apt update && sudo apt upgrade -y
```

### Step 1.2: Install Node.js 20

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

Verify:
```bash
node --version
# Should show v20.x.x
```

### Step 1.3: Install build tools (needed for bcrypt)

```bash
sudo apt install -y build-essential python3 git
```

### Step 1.4: Install SQLite tools (for backups)

```bash
sudo apt install -y sqlite3
```

---

## Part 2: Install OKR Tracker

Choose **Option A (Docker)** for simplicity, or **Option B (Manual)** for more control.

### Option A: Docker (Recommended)

```bash
# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker

# Create directory
mkdir -p /opt/okr-tracker && cd /opt/okr-tracker

# Clone or copy the app
git clone https://github.com/yourusername/okr-tracker.git .

# Create data directory and env file
mkdir -p data
cat > .env << 'EOF'
ADMIN_USERNAME=youruser
ORIGIN=https://okr.yourdomain.com
EOF

# Build and start
docker compose up -d

# Verify it's running
curl http://localhost:3000
```

Done! Skip to Part 3.

---

### Option B: Manual Installation

### Step 2.1: Create app directory

```bash
sudo mkdir -p /opt/okr-tracker
sudo chown $USER:$USER /opt/okr-tracker
cd /opt/okr-tracker
```

### Step 2.2: Clone or copy the app

```bash
# If using git:
git clone https://github.com/yourusername/okr-tracker.git .

# Or copy files manually via SCP/SFTP
```

### Step 2.3: Install dependencies

```bash
npm ci
```

This may take 5-10 minutes on a Pi.

### Step 2.4: Create environment file

```bash
cat > .env << 'EOF'
ADMIN_USERNAME=youruser
ORIGIN=https://okr.yourdomain.com
EOF
```

Replace `okr.yourdomain.com` with your actual domain.

### Step 2.5: Build the app

```bash
npm run build
```

### Step 2.6: Initialize the database

```bash
npm run db:push
```

### Step 2.7: Test that it works

```bash
node build
```

Open another terminal and test:
```bash
curl http://localhost:3000
```

You should see HTML output. Press `Ctrl+C` to stop.

---

## Part 3: Local HTTPS with DNS Challenge (Recommended)

This approach:
- Gets valid HTTPS certificates without opening any ports
- Works entirely within your home network
- Use VPN (Tailscale/WireGuard) for remote access

### Step 3.1: Choose your DNS provider

DNS challenge requires API access to your DNS provider. Supported providers include:
- **Cloudflare** (free, recommended)
- **DuckDNS** (free subdomain)
- **Route53**, **DigitalOcean**, **Namecheap**, etc.

### Step 3.2: Install Caddy with DNS plugin

Standard Caddy doesn't include DNS plugins. We need to build a custom version.

```bash
# Install xcaddy (Caddy build tool)
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/xcaddy/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/xcaddy-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/xcaddy/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/xcaddy.list
sudo apt update
sudo apt install -y xcaddy

# Build Caddy with Cloudflare DNS plugin
xcaddy build --with github.com/caddy-dns/cloudflare

# Install it
sudo mv caddy /usr/bin/caddy
sudo chmod +x /usr/bin/caddy
```

For DuckDNS instead:
```bash
xcaddy build --with github.com/caddy-dns/duckdns
```

### Step 3.3: Get your DNS API token

**For Cloudflare:**
1. Go to https://dash.cloudflare.com/profile/api-tokens
2. Click "Create Token"
3. Use template "Edit zone DNS"
4. Zone Resources: Include → Specific zone → your domain
5. Copy the token

**For DuckDNS:**
1. Go to https://www.duckdns.org
2. Login and copy your token from the top of the page

### Step 3.4: Point your domain to your Pi's local IP

**For Cloudflare:**
1. Add an A record: `okr.yourdomain.com` → `192.168.1.x` (your Pi's local IP)
2. Set Proxy status to "DNS only" (gray cloud)

**For DuckDNS:**
```bash
# Update DuckDNS to point to your local IP
curl "https://www.duckdns.org/update?domains=yoursubdomain&token=YOUR_TOKEN&ip=192.168.1.x"
```

### Step 3.5: Configure Caddy

```bash
sudo mkdir -p /etc/caddy

# For Cloudflare:
sudo tee /etc/caddy/Caddyfile << 'EOF'
{
    acme_dns cloudflare YOUR_CLOUDFLARE_API_TOKEN
}

okr.yourdomain.com {
    reverse_proxy localhost:3000
}
EOF

# For DuckDNS:
sudo tee /etc/caddy/Caddyfile << 'EOF'
{
    acme_dns duckdns YOUR_DUCKDNS_TOKEN
}

yoursubdomain.duckdns.org {
    reverse_proxy localhost:3000
}
EOF
```

Replace the token and domain with your actual values.

### Step 3.6: Set up Caddy as a service

```bash
# Create caddy user
sudo useradd --system --home /var/lib/caddy --shell /usr/sbin/nologin caddy
sudo mkdir -p /var/lib/caddy
sudo chown caddy:caddy /var/lib/caddy

# Create systemd service
sudo tee /etc/systemd/system/caddy.service << 'EOF'
[Unit]
Description=Caddy
After=network.target network-online.target
Requires=network-online.target

[Service]
Type=notify
User=caddy
Group=caddy
ExecStart=/usr/bin/caddy run --config /etc/caddy/Caddyfile
ExecReload=/usr/bin/caddy reload --config /etc/caddy/Caddyfile
TimeoutStopSec=5s
LimitNOFILE=1048576
PrivateTmp=true
AmbientCapabilities=CAP_NET_BIND_SERVICE

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable caddy
sudo systemctl start caddy
```

### Step 3.7: Update OKR environment

```bash
# Update ORIGIN to use HTTPS
sed -i 's|ORIGIN=.*|ORIGIN=https://okr.yourdomain.com|' /opt/okr-tracker/.env
```

### Step 3.8: Test HTTPS

Open `https://okr.yourdomain.com` from any device on your home network.

You should see:
- Valid HTTPS certificate (green padlock)
- OKR Tracker login page

### Step 3.9: Set up remote access with Tailscale (Optional)

For accessing from outside your home:

```bash
# Install Tailscale
curl -fsSL https://tailscale.com/install.sh | sh

# Start and authenticate
sudo tailscale up

# Your Pi gets a Tailscale IP (100.x.x.x)
```

Then from any device with Tailscale installed, access via:
- `https://okr.yourdomain.com` (if your DNS resolves locally)
- Or add the Tailscale IP to your hosts file

---

## Part 4: Public Access with Cloudflare Tunnel (Alternative)

Skip this section if you set up local HTTPS above. This is for internet-facing deployment.

### Step 4.1: Add your domain to Cloudflare

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Click "Add a site"
3. Enter your domain name
4. Select the **Free** plan
5. Cloudflare will scan existing DNS records
6. Update your domain registrar's nameservers to Cloudflare's (they'll show you which ones)

Wait 5-30 minutes for nameservers to propagate.

### Step 4.2: Verify domain is active

In Cloudflare dashboard, your domain should show "Active" status.

---

### Step 4.3: Install cloudflared on the Pi

```bash
# For 64-bit Raspberry Pi OS:
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64.deb -o cloudflared.deb
sudo dpkg -i cloudflared.deb
rm cloudflared.deb
```

Verify:
```bash
cloudflared --version
```

### Step 4.4: Authenticate with Cloudflare

```bash
cloudflared tunnel login
```

This opens a browser URL. Copy the URL and open it on any device, then:
1. Select your domain
2. Click "Authorize"

A certificate is saved to `~/.cloudflared/cert.pem`.

### Step 4.5: Create a tunnel

```bash
cloudflared tunnel create okr-tracker
```

Note the **Tunnel ID** shown (looks like: `a1b2c3d4-e5f6-7890-abcd-ef1234567890`).

### Step 4.6: Create tunnel config

```bash
mkdir -p ~/.cloudflared

cat > ~/.cloudflared/config.yml << 'EOF'
tunnel: TUNNEL_ID_HERE
credentials-file: /home/YOUR_USERNAME/.cloudflared/TUNNEL_ID_HERE.json

ingress:
  - hostname: okr.yourdomain.com
    service: http://localhost:3000
  - service: http_status:404
EOF
```

Edit the file to replace:
- `TUNNEL_ID_HERE` with your actual tunnel ID (in both places)
- `YOUR_USERNAME` with your Pi username (e.g., `pi`)
- `okr.yourdomain.com` with your actual subdomain

```bash
nano ~/.cloudflared/config.yml
```

### Step 4.7: Create DNS record for the tunnel

```bash
cloudflared tunnel route dns okr-tracker okr.yourdomain.com
```

Replace `okr.yourdomain.com` with your subdomain.

### Step 4.8: Test the tunnel

```bash
# Start OKR in one terminal
cd /opt/okr-tracker && node build

# In another terminal, start the tunnel
cloudflared tunnel run okr-tracker
```

Open `https://okr.yourdomain.com` in your browser. You should see the OKR Tracker login page with a valid HTTPS certificate!

Press `Ctrl+C` in both terminals to stop.

---

## Part 5: Run as System Services

Make OKR Tracker start automatically on boot.

**Docker users:** Skip Step 5.1 - Docker Compose with `restart: unless-stopped` handles this automatically. Just ensure Docker starts on boot:
```bash
sudo systemctl enable docker
```

### Step 5.1: Create OKR Tracker service (Manual install only)

```bash
sudo tee /etc/systemd/system/okr-tracker.service << 'EOF'
[Unit]
Description=OKR Tracker
After=network.target

[Service]
Type=simple
User=YOUR_USERNAME
WorkingDirectory=/opt/okr-tracker
ExecStart=/usr/bin/node build
Restart=on-failure
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF
```

Edit to replace `YOUR_USERNAME`:
```bash
sudo nano /etc/systemd/system/okr-tracker.service
```

Enable and start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable okr-tracker
sudo systemctl start okr-tracker
```

Check status:
```bash
sudo systemctl status okr-tracker
```

### Step 5.2: Install cloudflared as a service (Part 4 users only)

Skip this if you used Part 3 (local HTTPS with DNS challenge).

```bash
sudo cloudflared service install
sudo systemctl enable cloudflared
sudo systemctl start cloudflared
```

Check status:
```bash
sudo systemctl status cloudflared
```

### Step 5.3: Verify everything works

1. Reboot your Pi: `sudo reboot`
2. Wait 1-2 minutes
3. Open `https://okr.yourdomain.com` - should work!

---

## Part 6: Set Up Automatic Backups

### Step 6.1: Create backup script

```bash
sudo tee /opt/okr-tracker/backup.sh << 'EOF'
#!/bin/bash
set -e

DB_PATH="/opt/okr-tracker/data/okr.db"
BACKUP_DIR="/opt/okr-tracker/backups"
RETENTION_DAYS=30

mkdir -p "$BACKUP_DIR"

# Checkpoint WAL to main database
sqlite3 "$DB_PATH" "PRAGMA wal_checkpoint(TRUNCATE);" 2>/dev/null || true

# Create timestamped backup
BACKUP_FILE="$BACKUP_DIR/okr-$(date +%Y%m%d-%H%M%S).db"
cp "$DB_PATH" "$BACKUP_FILE"
gzip "$BACKUP_FILE"

# Remove old backups
find "$BACKUP_DIR" -name "okr-*.db.gz" -mtime +$RETENTION_DAYS -delete

echo "$(date): Backup created: ${BACKUP_FILE}.gz"
EOF

sudo chmod +x /opt/okr-tracker/backup.sh
```

### Step 6.2: Schedule daily backups

```bash
# Add cron job
(crontab -l 2>/dev/null; echo "0 3 * * * /opt/okr-tracker/backup.sh >> /var/log/okr-backup.log 2>&1") | crontab -
```

### Step 6.3: Test backup

```bash
/opt/okr-tracker/backup.sh
ls -la /opt/okr-tracker/backups/
```

---

## Part 7: Sync Backups to Nextcloud (Optional)

### Step 7.1: Install rclone

```bash
curl https://rclone.org/install.sh | sudo bash
```

### Step 7.2: Configure Nextcloud remote

```bash
rclone config
```

Follow the prompts:
1. `n` (new remote)
2. Name: `nextcloud`
3. Type: `webdav` (find the number)
4. URL: `https://your-nextcloud.com/remote.php/webdav/`
5. Vendor: `nextcloud` (find the number)
6. User: your Nextcloud username
7. Password: `y`, then enter your password (or use an app password)
8. Bearer token: leave blank
9. Advanced config: `n`
10. Confirm: `y`

### Step 7.3: Test connection

```bash
rclone ls nextcloud:
```

Should list your Nextcloud files.

### Step 7.4: Update backup script to sync

```bash
sudo tee /opt/okr-tracker/backup.sh << 'EOF'
#!/bin/bash
set -e

DB_PATH="/opt/okr-tracker/data/okr.db"
BACKUP_DIR="/opt/okr-tracker/backups"
RETENTION_DAYS=30

mkdir -p "$BACKUP_DIR"

# Checkpoint and backup
sqlite3 "$DB_PATH" "PRAGMA wal_checkpoint(TRUNCATE);" 2>/dev/null || true
BACKUP_FILE="$BACKUP_DIR/okr-$(date +%Y%m%d-%H%M%S).db"
cp "$DB_PATH" "$BACKUP_FILE"
gzip "$BACKUP_FILE"

# Sync to Nextcloud
rclone copy "$BACKUP_DIR" nextcloud:OKR-Backups/ --max-age 30d

# Local cleanup (keep 7 days locally, 30 days on Nextcloud)
find "$BACKUP_DIR" -name "okr-*.db.gz" -mtime +7 -delete

echo "$(date): Backup synced to Nextcloud: ${BACKUP_FILE}.gz"
EOF
```

### Step 7.5: Test the sync

```bash
/opt/okr-tracker/backup.sh
rclone ls nextcloud:OKR-Backups/
```

---

## Maintenance Commands

### Docker

```bash
# View logs
docker compose logs -f okr

# Restart
docker compose restart okr

# Update the app
cd /opt/okr-tracker
git pull
docker compose build
docker compose up -d

# Shell into container
docker compose exec okr sh
```

### Manual Installation

```bash
# View OKR logs
sudo journalctl -u okr-tracker -f

# Restart OKR
sudo systemctl restart okr-tracker

# Update the app
cd /opt/okr-tracker
git pull
npm ci
npm run build
sudo systemctl restart okr-tracker
```

### Common (Both)

```bash
# View Caddy logs
sudo journalctl -u caddy -f

# View tunnel logs (Part 4 users)
sudo journalctl -u cloudflared -f

# Manual backup
/opt/okr-tracker/backup.sh

# Check disk space
df -h

# Check memory
free -h
```

---

## Troubleshooting

### Site not loading

```bash
# Docker: Check if OKR is running
docker compose ps
docker compose logs okr

# Manual: Check if OKR is running
sudo systemctl status okr-tracker

# Check Caddy
sudo systemctl status caddy

# Test local connection
curl http://localhost:3000
```

### 502 Bad Gateway

Caddy/tunnel can't reach OKR:
```bash
# Docker: Restart and check logs
docker compose restart okr
docker compose logs okr

# Manual: Restart and check logs
sudo systemctl restart okr-tracker
sudo journalctl -u okr-tracker --since "10 minutes ago"
```

### Certificate errors

Usually means DNS isn't configured correctly:
```bash
# Verify DNS record exists
cloudflared tunnel route dns okr-tracker okr.yourdomain.com

# Check Cloudflare dashboard for the CNAME record
```

### Database locked

```bash
# Force checkpoint
sqlite3 /opt/okr-tracker/data/okr.db "PRAGMA wal_checkpoint(TRUNCATE);"

# Restart service
sudo systemctl restart okr-tracker
```

### Out of memory

```bash
# Check memory
free -h

# Add memory limit to service
sudo systemctl edit okr-tracker
# Add under [Service]:
# Environment=NODE_OPTIONS=--max-old-space-size=512
```

---

## Security Notes

1. **Cloudflare Tunnel** encrypts all traffic - your Pi never exposes any ports to the internet
2. **No port forwarding** means no attack surface on your router
3. **HTTPS is automatic** and always valid (Cloudflare handles certificates)
4. **Firewall optional** but you can add `ufw` for extra safety:
   ```bash
   sudo apt install ufw
   sudo ufw default deny incoming
   sudo ufw default allow outgoing
   sudo ufw allow ssh
   sudo ufw enable
   ```

---

## Adding More Services Later

To add another service (e.g., Nextcloud) through the same tunnel:

1. Edit `~/.cloudflared/config.yml`:
   ```yaml
   ingress:
     - hostname: okr.yourdomain.com
       service: http://localhost:3000
     - hostname: nextcloud.yourdomain.com
       service: http://localhost:8080
     - service: http_status:404
   ```

2. Add DNS route:
   ```bash
   cloudflared tunnel route dns okr-tracker nextcloud.yourdomain.com
   ```

3. Restart tunnel:
   ```bash
   sudo systemctl restart cloudflared
   ```

---

## Quick Reference

### Docker

| What | Command |
|------|---------|
| Start OKR | `docker compose up -d` |
| Stop OKR | `docker compose down` |
| Restart OKR | `docker compose restart okr` |
| View OKR logs | `docker compose logs -f okr` |
| Backup now | `/opt/okr-tracker/backup.sh` |
| Update app | `git pull && docker compose build && docker compose up -d` |

### Manual Installation

| What | Command |
|------|---------|
| Start OKR | `sudo systemctl start okr-tracker` |
| Stop OKR | `sudo systemctl stop okr-tracker` |
| Restart OKR | `sudo systemctl restart okr-tracker` |
| View OKR logs | `sudo journalctl -u okr-tracker -f` |
| Backup now | `/opt/okr-tracker/backup.sh` |
| Update app | `git pull && npm ci && npm run build && sudo systemctl restart okr-tracker` |
