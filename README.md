<div align="center">

<img src="web/public/icons/icon-512.png" width="96" height="96" alt="Kugi icon" />

# kugi

**Bento-box calendar & task tracker — your data, your backend, AI-ready.**

[![Live](https://img.shields.io/badge/web-kugi.onrender.com-4f7cff?style=flat-square)](https://kugi.onrender.com)
[![Mac](https://img.shields.io/badge/mac-download-8b5cf6?style=flat-square)](#releases)
[![License](https://img.shields.io/badge/license-MIT-10b981?style=flat-square)](LICENSE)

</div>

---

## What is it

Kugi is a personal planner built around the **bento grid** metaphor — blocks of time you drag, schedule, and complete across a week or day view. It runs as a **PWA** in the browser and as a native **Mac app**. Your data lives in your own [Convex](https://convex.dev) deployment, not on anyone else's server.

It also exposes a **REST API** so your AI agents can read and create tasks programmatically.

---

## Features

- **Week view** — 7-column bento grid, drag blocks between days
- **Day view** — timeline (hour-by-hour) or bento grid, toggle between them
- **Mini calendar** sidebar with category filter
- **Real-time sync** — Convex keeps every client up to date instantly
- **PWA** — installable from the browser, works offline
- **Mac app** — native window, lives in your dock
- **AI agent API** — `GET /api/tasks` and `POST /api/tasks` with bearer auth
- **Keyboard shortcuts** — `n` new block, `w` week, `d` day, `t` timeline, `b` bento

---

## Stack

| Layer | Tech |
|---|---|
| UI | React 19 + Vite + CSS Modules |
| Backend | [Convex](https://convex.dev) (real-time, self-hostable) |
| Web deploy | Render (static site) |
| Mac app | Electron 32 |
| PWA | Service Worker + Web App Manifest |

---

## Getting started

### 1 — Deploy your Convex backend

```bash
cd app
npm install
npx convex dev
```

Follow the prompts to link your [Convex account](https://convex.dev). Copy the deployment URL — you'll need it next.

### 2 — Use the web app

Visit **[kugi.onrender.com](https://kugi.onrender.com)** (or your own deploy — see below).

On first visit, paste your Convex deployment URL:

```
https://your-project.convex.cloud
```

Done. Your calendar loads.

### 3 — Use the Mac app

Download the latest `.dmg` from [Releases](../../releases), open it, drag Kugi to Applications.

On first launch, paste your Convex URL — same one from step 1. From then on it opens straight to your calendar.

---

## Self-host the web app

The web app is a static Vite build. Deploy anywhere.

**Render:**
| Field | Value |
|---|---|
| Root Directory | `web` |
| Build Command | `npm install && npm run build` |
| Publish Directory | `dist` |

**Vercel / Netlify / Cloudflare Pages:** same settings, zero config.

No environment variables required — users supply their own Convex URL at setup time.

---

## AI agent API

Once you have Kugi running, grab your API key from the sidebar (Settings → API Key). Use it to talk to your Convex HTTP endpoint:

### List tasks

```bash
curl https://your-project.convex.site/api/tasks \
  -H "Authorization: Bearer kugi_your_key_here"
```

Filter by date:

```bash
curl "https://your-project.convex.site/api/tasks?date=2025-05-07" \
  -H "Authorization: Bearer kugi_your_key_here"
```

### Create a task

```bash
curl -X POST https://your-project.convex.site/api/tasks \
  -H "Authorization: Bearer kugi_your_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Review PRs",
    "date": "2025-05-07",
    "emoji": "🔍",
    "category": "Work",
    "start_time": "10:00",
    "end_time": "11:00"
  }'
```

### Update a task

```bash
curl -X PATCH https://your-project.convex.site/api/tasks \
  -H "Authorization: Bearer kugi_your_key_here" \
  -H "Content-Type: application/json" \
  -d '{ "id": "<task_id>", "completed": true }'
```

### Delete a task

```bash
curl -X DELETE "https://your-project.convex.site/api/tasks?id=<task_id>" \
  -H "Authorization: Bearer kugi_your_key_here"
```

### Task schema

```ts
{
  title:      string          // required
  date:       string          // required — "YYYY-MM-DD"
  emoji?:     string          // default "💼"
  category?:  string          // "Work" | "Personal" | "Health" | "Deep Work"
                              // "Social" | "Admin" | "Creative" | "Other"
  start_time?: string         // "HH:MM"
  end_time?:   string         // "HH:MM"
  notes?:      string
  completed?:  boolean        // default false
}
```

---

## Build the Mac app

```bash
cd app
npm run build:arm64    # Apple Silicon
npm run build:x64      # Intel
npm run build:all      # Both
```

Outputs a `.dmg` to `app/dist/`.

### Release via GitHub Actions

Tag a commit — CI builds both architectures and publishes to GitHub Releases automatically:

```bash
git tag v1.0.0
git push origin v1.0.0
```

Or trigger manually from the **Actions** tab with any version tag.

---

## Project structure

```
kugi/
├── app/                  Mac app (Electron)
│   ├── convex/           Convex backend functions + HTTP API
│   │   ├── schema.ts
│   │   ├── blocks.ts
│   │   ├── settings.ts
│   │   └── http.ts
│   └── src/
│       └── main.js       Electron main process
│
└── web/                  Web app + PWA (React + Vite)
    └── src/
        ├── pages/        Landing, Setup, AppPage
        ├── components/   WeekView, DayView, BlockModal, BlockCard …
        ├── hooks/
        │   └── useDB.js  Convex data layer
        └── utils/
```

---

## License

MIT — do whatever you want with it.

---

<div align="center">
  Built with <a href="https://convex.dev">Convex</a> · Deployed on <a href="https://render.com">Render</a>
</div>
