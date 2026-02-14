# Setup Guide

## Prerequisites

- Node.js 20+
- npm

## Local Development

```bash
cd okr-app

# Install dependencies
npm install

# Initialize the database
npm run db:push

# Start development server
npm run dev
```

The app will be available at `http://localhost:5173`.

## Environment Variables

Create a `.env` file in the `okr-app/` directory:

```env
# Database location (default: ./data/okr.db)
DATABASE_PATH=./data/okr.db

# Admin user — this username gets admin privileges on login
ADMIN_USERNAME=youruser

# Fitbit OAuth (optional)
FITBIT_CLIENT_ID=your_client_id
FITBIT_CLIENT_SECRET=your_client_secret
PUBLIC_BASE_URL=http://localhost:5173
```

## Production Deployment

### Docker (Recommended)

```bash
cd okr-app

# Build and run with Docker Compose
docker compose up -d

# Or build manually
docker build -t okr-tracker .
docker run -d -p 3000:3000 -v okr-data:/app/data okr-tracker
```

The app will be available at `http://localhost:3000`.

#### Docker Compose Configuration

The included `docker-compose.yml` supports:

```yaml
environment:
  - NODE_ENV=production
  - DATABASE_PATH=/app/data/okr.db
  - ADMIN_USERNAME=youruser
  # Fitbit OAuth (optional)
  - FITBIT_CLIENT_ID=your_client_id
  - FITBIT_CLIENT_SECRET=your_client_secret
  - PUBLIC_BASE_URL=https://okr.example.com
```

### Manual Deployment

```bash
cd okr-app

# Build for production
npm run build

# Set environment variables
export NODE_ENV=production
export DATABASE_PATH=/path/to/okr.db

# Run
node build
```

## Admin Dashboard

Set the `ADMIN_USERNAME` environment variable to the username that should have admin privileges:

```env
ADMIN_USERNAME=youruser
```

When that user logs in, they are automatically granted admin status.

### Admin Features

- **User Management** — view, disable/enable, and delete user accounts
- **Query Execution Logs** — filter by user, success/failure, date range; see execution times and errors
- **Statistics** — total users, query executions (24h/7d), error rates, average execution times

### Security

- All admin endpoints require `isAdmin: true`
- Cannot disable/delete your own account
- Disabling a user invalidates all their sessions
- Query code is sandboxed with QuickJS (WASM)
- Rate limiting: 30 queries/minute per user
- Code size limit: 100KB max

## Database Management

### Commands

```bash
# Push schema changes to database (for development)
npm run db:push

# Generate SQL migration files
npm run db:generate

# Run migrations
npm run db:migrate

# Open Drizzle Studio (database browser)
npm run db:studio
```

### Database Location

- **Development**: `okr-app/data/okr.db`
- **Docker**: `/app/data/okr.db` (mounted as `okr-data` volume)
- **Custom**: Set via `DATABASE_PATH` environment variable

### Reset Database

To start fresh, stop the app and delete the database files:

```bash
# Stop the app first!
rm data/okr.db data/okr.db-wal data/okr.db-shm

# Recreate schema
npm run db:push
```

The `-wal` and `-shm` files are SQLite WAL (Write-Ahead Logging) files. Always delete all three together.

### Backup and Restore

Use the Settings page in the app to:
- **Download Backup**: Exports all your data as JSON
- **Restore Backup**: Import a previously exported JSON file

For automated backups and Nextcloud sync, see the [Maintenance Playbook](MAINTENANCE.md).

## Development

```bash
# Development server
npm run dev

# Type check
npm run check

# Build
npm run build

# Preview production build
npm run preview
```

## Project Structure

```
okr-app/
├── src/
│   ├── lib/
│   │   ├── components/     # Svelte components
│   │   ├── db/
│   │   │   ├── schema.ts   # Database schema (Drizzle)
│   │   │   └── client.ts   # Database connection
│   │   └── server/         # Server-side utilities
│   └── routes/
│       ├── api/            # API endpoints
│       ├── daily/          # Daily planning page
│       ├── weekly/         # Weekly planning page
│       ├── objectives/     # OKR management
│       ├── queries/        # Custom queries
│       └── settings/       # User settings
├── docs/                   # Documentation
├── drizzle/                # Migration files
├── static/                 # Static assets (icons, manifest)
├── Dockerfile
├── docker-compose.yml
└── drizzle.config.ts
```
