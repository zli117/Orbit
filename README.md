# <img width="357" height="65" alt="image" src="https://github.com/user-attachments/assets/600bbdb9-fe40-40ba-93e7-f805bd42a481" />

**A self-hosted personal OKR system with built-in time tracking, data integrations such as Fitbit, and a programmable analytics engine — write JavaScript or let AI write it for you.**

<img width="3816" height="4879" alt="Screenshot 2026-03-01 at 17-23-27 Week 9 2026 - RUOK" src="https://github.com/user-attachments/assets/1a8a5b2f-a207-43f9-88a3-3063cdb48e46" />

---

## What Makes RUOK Different

Most productivity tools give you a checklist. RUOK gives you a **programmable system**.

**Plan at every level.** Set yearly objectives, break them into monthly key results, plan weekly initiatives, and track daily tasks with a built-in time tracker. Everything rolls up — completing today's work moves the needle on this year's goals.

**Query anything.** Write JavaScript against your own life data — tasks, metrics, sleep patterns, activity levels, objective scores — in a sandboxed code editor. Render results as markdown, tables, or interactive charts. Use queries to power dashboard widgets and automatically score key results.

**Let AI write the code.** Don't know where to start? Describe what you want to see in plain English, and the AI assistant generates the query for you. Supports Claude, GPT, Gemini, local models via Ollama, and any OpenRouter provider.

**Own your data.** SQLite on your own hardware. No cloud accounts, no subscriptions, no telemetry. Export everything as JSON anytime.

---

## Features

### Multi-Level Planning

Set yearly objectives, break them into monthly key results, plan weekly initiatives, and track daily tasks with a built-in time tracker. Everything rolls up — objectives are scored automatically based on their key results, measured by manual sliders, checklists, or custom JavaScript queries that compute progress from your actual data.

<table>
  <tr>
    <td align="center">
      <img width="3816" height="4452" alt="Screenshot 2026-03-01 at 17-25-53 Objectives 2026 - RUOK" src="https://github.com/user-attachments/assets/02c3c181-e5ee-4ee6-850f-5c8a95744bd7" />
      <br />
      <em>Yearly Objectives</em>
    </td>
    <td align="center">
      <img width="3816" height="3782" alt="Screenshot 2026-03-01 at 17-26-06 Objectives 2026 - March - RUOK" src="https://github.com/user-attachments/assets/209ccaca-a02f-415b-a167-84434e0685c9" />
      <br />
      <em>Monthly Key Results</em>
    </td>
  </tr>
  <tr>
    <td align="center">
      <img width="3816" height="2397" alt="Screenshot 2026-03-01 at 17-25-40 Week 9 2026 - RUOK" src="https://github.com/user-attachments/assets/494bda71-bbee-42ea-bd1e-26875188060a" />
      <br />
      <em>Weekly Initiatives</em>
    </td>
    <td align="center">
      <img width="3816" height="3948" alt="Screenshot 2026-03-01 at 17-25-21 Sunday March 1 2026 - RUOK" src="https://github.com/user-attachments/assets/4744ab74-0f98-4980-a827-074250221685" />
      <br />
      <em>Daily Tasks</em>
    </td>
  </tr>
</table>

<!-- Screenshot: goal hierarchy view showing yearly → monthly → weekly → daily -->

### AI-Powered Analysis

Query your own life data — daily records, tasks, time logs, objective scores, and more — in a sandboxed JavaScript editor with full autocomplete and interactive Plotly charts. Don't want to write code? Describe what you want in plain English and let AI write it for you. Save queries as dashboard widgets or use them to automatically score your key results.

#### Generate Custom Dashboard Widgets

https://github.com/user-attachments/assets/0142013b-b30e-488c-927f-c6c756422215

#### Generate Queries for Key Result Scoring

https://github.com/user-attachments/assets/e8b3c8d3-9a5d-4d8e-af24-3959245d5766

#### Play Around a Query in Query Builder

https://github.com/user-attachments/assets/fca63f13-ec25-4e0d-9d1b-2b355aeaaafc

### Built in Time Tracker

Track time spent on any task, compare estimates against actuals, and query it all later in the analytics engine.

https://github.com/user-attachments/assets/7f465df5-3733-42e2-b7c5-2fb0c9b35b2d

### Custom Metrics

Define what you track each day — numbers, times, booleans, or text you log manually, computed formulas derived from other metrics, and external data pulled automatically from plugins like Fitbit. Metrics are versioned, so you can change your tracking template anytime without losing historical data.
<img width="3815" height="3153" alt="Screenshot 2026-03-01 at 20-53-01 Metrics Template - Settings - RUOK" src="https://github.com/user-attachments/assets/3e45534d-c331-44ba-93ec-8a528b0d54e2" />

### Plugins & Integrations

Connect external data sources via an extensible plugin system. Currently supported: Fitbit (sleep duration, bed/wake times, steps, resting heart rate, cardio load, readiness score), syncing automatically every hour via OAuth2. The [Plugin Development Guide](okr-app/docs/PLUGINS.md) covers everything needed to add a new integration — it also doubles as an AI coding skill for Claude Code or Cursor.

<img width="3816" height="1944" alt="Screenshot 2026-03-01 at 17-30-20 Plugin Settings - RUOK" src="https://github.com/user-attachments/assets/1d2d888e-cdbb-4109-be81-cf2f3223c78e" />

### Multi-User & Friends

Run a single instance for your family and friends. Each person gets a private workspace. Add friends to view each other's dashboards — see progress without exposing task details. Great for accountability partners or families sharing a home server.

<img width="3816" height="1944" alt="Screenshot 2026-03-01 at 17-27-07 Friends RUOK" src="https://github.com/user-attachments/assets/73566450-5b82-41de-800d-556c2640e576" />

### Admin Tools

User management, query execution logs, security monitoring, and system configuration — all from the browser.

<img width="3816" height="1944" alt="Screenshot 2026-03-01 at 17-29-31 Admin Dashboard RUOK" src="https://github.com/user-attachments/assets/eea5abef-a498-4728-a58f-f491ac4046ff" />

<img width="3816" height="2690" alt="Screenshot 2026-03-01 at 17-29-22 Admin Dashboard RUOK" src="https://github.com/user-attachments/assets/65af6004-7087-4fc6-b484-f2b646d2a499" />

### Desktop + Mobile

RUOK is a progressive web app — install it on your phone's home screen for a native-like experience, or use it in any desktop browser. One codebase, no app store, always in sync.

<img width="1857" height="1209" alt="image" src="https://github.com/user-attachments/assets/d10401c2-a194-4168-a181-0d4f7fd3ddac" />


---

## Quick Start (Development)

```bash
cd okr-app
export ADMIN_USERNAME=admin  # You still need to create this user
export DATA_DIR=data
npm install
npm run db:push
npm run dev
```

Opens on `http://localhost:5180/`.

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_PATH` | `/app/data/okr.db` | Path to SQLite database inside the container |
| `ADMIN_USERNAME` | *(none)* | Username that gets admin privileges on login |

Note that you still need to create the admin user.

---

## Deployment

RUOK runs on modest hardware. A Raspberry Pi 4 with 2GB RAM is plenty.

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

AGPL-3.0
