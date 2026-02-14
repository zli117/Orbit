# OKR Tracker

A self-hosted, open-source goal tracking system that connects your daily tasks to your big-picture objectives. Plan your day, track what matters, query your data, and see how it all rolls up — from today's to-do list to this year's ambitions.

**Built for people who want to own their productivity data.**

## Why OKR Tracker?

Most productivity tools lock you into their workflow. OKR Tracker gives you a structured framework — Objectives and Key Results — while letting you define exactly what you track, how you measure it, and what insights you pull from your data.

- **Your data stays with you.** SQLite database on your own hardware. No cloud accounts, no subscriptions, no tracking.
- **Works on anything.** Runs on a Raspberry Pi, a NAS, or any machine with Node.js. Install as a PWA on your phone for a native app feel.
- **Built for power users.** Write JavaScript queries against your own data. Build custom dashboards. Define computed metrics. Integrate with Fitbit. The system adapts to you, not the other way around.

## Core Features

### Plan Daily, Review Yearly

Track your work at every level — daily tasks with time tracking, weekly initiatives, monthly objectives, and yearly goals. Everything connects: completing today's tasks moves the needle on this month's key results.

### Flexible Key Results

Measure progress your way. Key results can be scored via sliders, checklists, or **custom JavaScript queries** that compute progress from your actual data. Set weights to control how each key result contributes to the overall objective score.

### Custom Metrics

Define your own daily metrics beyond the defaults. Three types:
- **User Input** — numbers, times, text, or booleans you log each day
- **Computed** — formulas that derive values from other metrics
- **External** — pull data from integrations like Fitbit (sleep, steps, activity)

### Query Playground

A full code editor (Monaco) where you write JavaScript to analyze your data. Access your tasks, objectives, metrics, and daily records through a clean API. Render results as markdown, tables, or interactive Plotly charts. Save queries and reuse them across dashboard widgets and key results.

All queries run in a **sandboxed QuickJS environment** (WebAssembly) — safe to run untrusted code without risking your server.

### Dashboard Widgets

Build a personalized dashboard with custom insight cards. Each widget runs a saved query and displays the result inline — charts, tables, or formatted text. See your data the way you want at a glance.

### Friends

Add friends to see their dashboards (read-only). Keep private notes on each friendship. A lightweight social layer for accountability without oversharing.

### Admin Dashboard

User management, query execution logs, security monitoring, and usage statistics. Disable accounts, audit query activity, and track error rates.

## Quick Start

```bash
cd okr-app
npm install
npm run db:push
npm run dev
```

Open `http://localhost:5173`. That's it.

For production with Docker:

```bash
cd okr-app
docker compose up -d
```

See the [Setup Guide](okr-app/docs/SETUP.md) for full configuration options, environment variables, and database management.

## Deployment

OKR Tracker is designed to run on modest hardware. A Raspberry Pi 4 with 2GB RAM is plenty.

| Guide | What it covers |
|-------|---------------|
| [Setup Guide](okr-app/docs/SETUP.md) | Local dev, Docker, manual deployment, environment variables, database management |
| [Raspberry Pi Guide](okr-app/docs/RASPBERRY_PI_SETUP.md) | Step-by-step home server setup with HTTPS (self-signed or DNS challenge) |
| [Maintenance Playbook](okr-app/docs/MAINTENANCE.md) | HTTPS options, reverse proxy configs, backups, Nextcloud sync, monitoring |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | SvelteKit 5 with Svelte 5 runes |
| Database | SQLite + Drizzle ORM |
| Query Sandbox | QuickJS (WebAssembly) |
| Charts | Plotly.js |
| Code Editor | Monaco Editor |
| Auth | Session cookies + bcrypt |
| Deployment | Docker, systemd, or bare Node.js |

## License

GPL 3.0
