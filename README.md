# Orbit

**Track goals. Connect your data. Query your life — with the help of AI.**

Orbit is a self-hosted personal productivity framework that connects your yearly ambitions to today's to-do list. Define objectives, measure key results, pull in data from services like Fitbit, and write JavaScript queries to analyze it all — or ask AI to write them for you.

Your data. Your rules. Runs on a Raspberry Pi.

---

## What Makes Orbit Different

Most productivity tools give you a checklist. Orbit gives you a **programmable system**.

**Plan at every level.** Set yearly objectives, break them into monthly key results, plan weekly initiatives, and track daily tasks with a built-in time tracker. Everything rolls up — completing today's work moves the needle on this year's goals.

**Query anything.** Write JavaScript against your own life data — tasks, metrics, sleep patterns, activity levels, objective scores — in a sandboxed code editor with full autocomplete. Render results as markdown, tables, or interactive charts. Use queries to power dashboard widgets and automatically score key results.

**Let AI write the code.** Don't know where to start? Describe what you want to see in plain English, and the AI assistant generates the query for you. Supports Claude, GPT, Gemini, local models via Ollama, and any OpenRouter provider.

**Own your data.** SQLite on your own hardware. No cloud accounts, no subscriptions, no telemetry. Export everything as JSON anytime.

---

## Features

### Multi-Level Planning

| Level | What you track |
|-------|---------------|
| **Yearly** | High-level objectives with weighted key results |
| **Monthly** | Focused objectives that ladder up to yearly goals |
| **Weekly** | Initiatives and task batches |
| **Daily** | Tasks with time tracking, custom metrics, and daily review |

Objectives are scored automatically based on their key results. Key results can be measured three ways: manual sliders, checklists, or **custom JavaScript queries** that compute progress from your actual data.

### Custom Metrics

Define what you track each day. Three types:

- **Input** — numbers, times, text, or booleans you log manually (e.g., mood, caffeine, focus hours)
- **Computed** — formulas derived from other metrics (e.g., sleep efficiency = time asleep / time in bed)
- **External** — data pulled automatically from plugins like Fitbit (sleep, steps, heart rate, readiness)

Metrics are versioned — change your tracking template anytime without losing historical data.

### Query Builder

A full code editor (Monaco) where you analyze your data with JavaScript. The query API gives you access to:

- Daily records with all metrics
- Tasks with tags, time logs, and attributes
- Objectives and key results with scores
- Helper functions for aggregation, time parsing, and formatting

Render results as markdown, data tables, or interactive Plotly charts (bar, line, pie, multi-series). Save queries and reuse them as dashboard widgets or key result scorers.

All code runs in a **sandboxed QuickJS environment** (WebAssembly) — isolated from the server, memory-limited, and time-capped.

### AI-Powered Code Generation

An AI chat panel sits alongside the query editor. Describe what you want to analyze — *"show my sleep trends this month"*, *"which tags take the most time?"*, *"plot task completion rate by day of week"* — and the assistant generates working query code.

Copy the generated code to the editor with one click, run it, and iterate.

Bring your own API key. Supports:
- **Anthropic** (Claude)
- **OpenAI** (GPT)
- **Google** (Gemini)
- **OpenRouter** (hundreds of models)
- **Ollama** (fully local, no API key needed)

### Personalized Dashboard

Build your own dashboard with custom widget cards. Each widget runs a saved query and displays the result inline — charts, tables, or formatted text. See your data the way you want at a glance.

### Plugins & Integrations

Connect external data sources. Currently supported:

- **Fitbit** — sleep duration, bed/wake times, steps, resting heart rate, cardio load, readiness score. Syncs automatically every hour via OAuth2.

The plugin system is extensible — the [Plugin Development Guide](okr-app/docs/PLUGINS.md) covers everything needed to add a new integration. It also doubles as an AI coding skill — point Claude Code or Cursor at it and ask for a new plugin.

### Multi-User & Friends

Run a single instance for your household. Each person gets a private workspace. Add friends to view each other's dashboards — see progress without exposing task details. Great for accountability partners or families sharing a home server.

### Admin Tools

User management, query execution logs, security monitoring, and system configuration — all from the browser.

---

## Quick Start (Development)

```bash
cd okr-app
npm install
npm run db:push
npm run dev
```

Opens on `http://localhost:5173`.

---

## Deployment

Orbit runs on modest hardware. A Raspberry Pi 4 with 2GB RAM is plenty.

| Guide | What it covers |
|-------|---------------|
| [Setup Guide](okr-app/docs/SETUP.md) | Raspberry Pi deployment with Docker, Caddy, HTTPS, DNS, backups |
| [Maintenance Playbook](okr-app/docs/MAINTENANCE.md) | Reverse proxy configs, monitoring, troubleshooting |
| [Query API Reference](okr-app/docs/QUERY_API_REFERENCE.md) | Complete JavaScript query sandbox API |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | SvelteKit 5 with Svelte 5 runes |
| Database | SQLite + Drizzle ORM |
| Query Sandbox | QuickJS (WebAssembly) |
| AI Providers | Anthropic, OpenAI, Gemini, OpenRouter, Ollama |
| Charts | Plotly.js |
| Code Editor | Monaco Editor |
| Auth | Session cookies + bcrypt |
| Deployment | Docker, systemd, or bare Node.js |

---

## License

GPL-3.0
