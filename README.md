<div align="center">

<img src="web/public/icons/icon-512.png" width="96" height="96" alt="Kugi icon" />

# kugi

**Personal block calendar — your data, your backend, AI-ready.**

[![Live](https://img.shields.io/badge/web-kugi.onrender.com-4f7cff?style=flat-square)](https://kugi.onrender.com)
[![License](https://img.shields.io/badge/license-MIT-10b981?style=flat-square)](LICENSE)

</div>

---

## What is it

Kugi is a personal planner built around time **blocks** — schedule, complete, and track them across week and day views. It runs as a **PWA** in the browser. Your data lives in your own [Convex](https://convex.dev) deployment.

It exposes a full **REST API** so AI agents can read, create, update, and search your blocks programmatically.

---

## Features

- **Week view** — 7-column grid, horizontal scroll on mobile
- **Day view** — bento grid or timeline layout, toggle between them
- **Multi-day blocks** — set a start and end date, block spans every day in between
- **Custom categories** — add your own with a name, emoji, and color; synced to Convex
- **Search** — Cmd+K (or `/`) to search across all block titles, notes, and categories
- **Undo / Redo** — Cmd+Z / Cmd+Shift+Z for create, edit, delete, and toggle
- **Light & dark mode** — toggle in the header, persisted across sessions
- **Completed tab** — all finished blocks grouped by date
- **Calendar tab** — full month view, tap a day to jump to it
- **Real-time sync** — Convex keeps every open tab in sync instantly
- **PWA** — installable from the browser, works offline via service worker
- **AI agent API** — full REST API with bearer auth, search, date range, and a schema endpoint

---

## Keyboard shortcuts

| Key | Action |
|---|---|
| `n` | New block |
| `w` | Week view |
| `d` | Day view |
| `f` | Finished (completed) view |
| `t` | Timeline layout (day view) |
| `b` | Bento layout (day view) |
| `/` or `⌘K` | Search |
| `⌘Z` | Undo |
| `⌘⇧Z` | Redo |

---

## Stack

| Layer | Tech |
|---|---|
| UI | React 19 + Vite + CSS Modules |
| Backend | [Convex](https://convex.dev) — real-time database + HTTP actions |
| Web deploy | Render (static site, auto-deploys on push to `main`) |
| PWA | Service Worker + Web App Manifest |

No server to run. The frontend is a static build; Convex is the entire backend.

---

## Getting started

### 1 — Deploy your Convex backend

```bash
cd app
npm install
npx convex dev
```

Follow the prompts to create a free [Convex](https://convex.dev) project. Note your deployment URL — you'll need it next.

### 2 — Open the web app

Visit **[kugi.onrender.com](https://kugi.onrender.com)** (or self-host — see below).

On first visit you'll be asked for your Convex deployment URL:

```
https://your-project.convex.cloud
```

That's it. Your calendar loads and syncs in real time.

---

## Self-host the web app

The web app is a plain Vite static build. Deploy anywhere:

**Render:**
| Field | Value |
|---|---|
| Root Directory | `web` |
| Build Command | `npm install && npm run build` |
| Publish Directory | `dist` |

**Vercel / Netlify / Cloudflare Pages:** same settings, zero config.

No environment variables needed — users supply their own Convex URL at setup time.

---

## AI agent API

Grab your API key from the Settings sidebar (API Key section). Use it against your Convex HTTP endpoint at `https://your-project.convex.site`.

### Discover the schema

```bash
curl https://your-project.convex.site/api/info \
  -H "Authorization: Bearer <key>"
```

Returns today's date, the full block schema, and all available endpoints. **Give this to your AI agent as part of its system prompt** so it can self-orient.

### Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/info` | Schema, route reference, current date |
| `GET` | `/api/tasks` | List all blocks |
| `GET` | `/api/tasks?date=YYYY-MM-DD` | Blocks on a specific date |
| `GET` | `/api/tasks?from=YYYY-MM-DD&to=YYYY-MM-DD` | Blocks in a date range |
| `GET` | `/api/tasks?search=text` | Full-text search (title, notes, category) |
| `GET` | `/api/tasks?completed=false` | Filter by completion status |
| `GET` | `/api/tasks/:id` | Single block by ID |
| `POST` | `/api/tasks` | Create a block → returns full block |
| `PATCH` | `/api/tasks/:id` | Update fields (partial) → returns full block |
| `DELETE` | `/api/tasks/:id` | Delete a block |
| `POST` | `/api/tasks/:id/complete` | Toggle completion → returns full block |

### Block schema

```ts
{
  title:       string   // required
  date:        string   // required — "YYYY-MM-DD"
  end_date?:   string   // "YYYY-MM-DD" — makes it a multi-day block
  emoji?:      string
  category?:   string   // default "Work"
  start_time?: string   // "HH:MM"
  end_time?:   string   // "HH:MM"
  notes?:      string
  completed?:  boolean  // default false
}
```

### Examples

```bash
BASE=https://your-project.convex.site
KEY=kugi_your_key_here

# Create a block
curl -X POST $BASE/api/tasks \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d '{"title":"Deep work","date":"2025-05-08","emoji":"🧠","start_time":"09:00","end_time":"11:00"}'

# Update it
curl -X PATCH $BASE/api/tasks/<id> \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d '{"notes":"Focus on API refactor"}'

# Toggle complete
curl -X POST $BASE/api/tasks/<id>/complete \
  -H "Authorization: Bearer $KEY"

# Search
curl "$BASE/api/tasks?search=deep+work" \
  -H "Authorization: Bearer $KEY"
```

### System prompt for your AI agent

```
You are a scheduling assistant for Kugi. Base URL: https://your-project.convex.site
Auth: Authorization: Bearer <key>

Always call GET /api/info at the start of a session to get today's date and confirm
the schema. Resolve relative dates ("today", "tomorrow") to YYYY-MM-DD before any call.
Use GET /api/tasks?search= before creating to avoid duplicates.
Prefer PATCH for updates — only send fields you want to change.
```

---

## Project structure

```
kugi/
├── app/
│   └── convex/               Convex backend
│       ├── schema.ts         Database schema
│       ├── blocks.ts         Block queries + mutations
│       ├── settings.ts       API key management, custom categories
│       └── http.ts           REST HTTP API
│
└── web/                      React PWA
    └── src/
        ├── pages/
        │   ├── AppPage.jsx   Root — layout, nav, keyboard shortcuts, undo/redo
        │   └── AppPage.module.css
        ├── components/
        │   ├── Calendar/
        │   │   ├── WeekView        7-column week grid
        │   │   ├── DayView         Bento / timeline day view
        │   │   ├── BlockCard       Individual block — tap/hover actions
        │   │   ├── CompletedView   Finished blocks grouped by date
        │   │   └── CalendarView    Full month calendar
        │   └── UI/
        │       ├── BlockModal      Create / edit form
        │       ├── BlockDetailsSheet  Read-only detail panel
        │       ├── CategoryManager    Add / edit / remove categories
        │       └── SearchModal        Cmd+K search
        ├── hooks/
        │   ├── useDB.js          Convex queries + mutations
        │   ├── useCategories.js  Merge default + custom categories
        │   └── useNotifications.js  Push notification scheduling
        └── utils/
            ├── dates.js          Date helpers (timezone-aware)
            ├── timezone.js       Read/write timezone from localStorage
            └── categories.js     Default category list + color helpers
```

---

## License

MIT

---

<div align="center">
  Built with <a href="https://convex.dev">Convex</a> · Deployed on <a href="https://render.com">Render</a>
</div>
