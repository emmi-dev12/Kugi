# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Web frontend (`web/`)
```bash
cd web
npm install        # first time
npm run dev        # dev server
npm run build      # production build
npm run lint       # ESLint
npm run preview    # preview production build locally
```

### Convex backend (`app/convex/`)
```bash
cd app
npm install        # first time
npx convex dev --once   # deploy functions to the DEV deployment (artful-gnat-488)
```

**Never use `npx convex deploy`** — that targets the prod deployment (`elated-frog-591`) and the live app does not connect to it. Always use `npx convex dev --once` to push backend changes.

The `.env.local` required for Convex deployment is at `.claude/worktrees/stupefied-curran-04bc85/app/.env.local` — copy it to `app/.env.local` before running any Convex CLI commands.

### After deploying JS changes
Bump `CACHE_NAME` in `web/public/sw.js` (e.g. `v3` → `v4`) whenever frontend JS changes ship. PWA installs serve stale files until the service worker cache is invalidated.

---

## Architecture

Two independent packages in the repo:

| Path | Purpose |
|------|---------|
| `app/convex/` | Convex backend — schema, queries/mutations, HTTP API, push/cron |
| `web/src/` | React 19 + Vite PWA — static build, deployed on Render |
| `app/src/` | Legacy Electron wrapper (not the primary app) |

The frontend is a **static site with no server**. Users supply their own Convex deployment URL at `/setup`; it's stored in localStorage. All data lives in their Convex project.

### Convex backend (`app/convex/`)

| File | Contents |
|------|---------|
| `schema.ts` | Three tables: `blocks`, `settings`, `pushSubscriptions` |
| `blocks.ts` | Queries and mutations for blocks |
| `settings.ts` | API key, categories, Telegram, push, GCal integration settings |
| `http.ts` | REST HTTP API for AI agent access (`.convex.site` endpoint) |
| `push.ts` / `pushActions.ts` | Push notification delivery via web-push |
| `telegram.ts` | Telegram reminder sender — `sendReminder` internalAction |
| `calendarSyncActions.ts` | Google Calendar sync via Composio SDK |
| `crons.ts` | Scheduled jobs: push check every 1 min, GCal sync every 10 min |

**Convex IDs**: documents have `_id`, not `id`. `web/src/hooks/useDB.js` maps `_id → id` for the frontend.

**HTTP API base URL**: `https://<deployment>.convex.site` — note `.convex.site`, not `.convex.cloud`.

### blocks table schema (full)
```
title, emoji, category, date (YYYY-MM-DD), start_time (HH:MM), end_time,
notes, completed, localId, notify_before (minutes, null=off, undefined=global default),
notify_message (string, optional — sent verbatim to push + Telegram, overrides global template),
end_date, telegramJobId, recurrence (hourly|daily|monthly|yearly),
recurrenceGroupId, googleEventId
```
Index: `by_date`

### settings table keys
| Key | Value |
|-----|-------|
| `apiKey` | Bearer token for HTTP API |
| `customCategories` | JSON object of custom categories |
| `reminders` | JSON array of push reminder rules `{ id, offsetMinutes, atTime?, message? }` |
| `timezone` | IANA timezone string |
| `telegramBotToken` | Telegram bot token |
| `telegramChatId` | Telegram chat/user ID |
| `telegramOffsetMinutes` | Minutes before event to send Telegram reminder |
| `telegramTemplate` | Message template with `{emoji}` `{title}` `{time}` `{date}` `{notes}` `{category}` variables |
| `composioApiKey` | Composio API key for Google Calendar |
| `integration_googleCalendar` | `"true"` / `"false"` |
| `pushEnabled` | `"true"` / `"false"` |
| `vapidPublicKey` / `vapidPrivateKey` | VAPID keys for web push |
| `firedPushKeys` | JSON — dedup log for fired push notifications |

### HTTP API endpoints (all at `.convex.site`, Bearer auth)
```
GET    /api/docs                     — full API reference (no auth)
GET    /api/stats                    — usage stats
GET    /api/tasks                    — list blocks (?date=, ?from=&to=, ?search=, ?completed=)
POST   /api/tasks                    — create block (notify_message field supported)
GET    /api/tasks/:id
PATCH  /api/tasks/:id
DELETE /api/tasks/:id                — ?mode=this|future|all &futureDays=N for recurring
POST   /api/tasks/:id/complete       — toggle complete
POST   /api/tasks/bulk               — bulk create
POST   /api/tasks/bulk-complete      — { ids?, search?, completed? }
POST   /api/tasks/bulk-delete        — { ids?, search? } — search selects all matching
POST   /api/tasks/bulk-update        — { ids, fields: { category?, emoji?, completed? } }
GET    /api/categories
POST   /api/categories
DELETE /api/categories/:name
GET    /api/settings                 — read all settings (telegram, push.reminders, gcal)
PATCH  /api/settings                 — update any subset of settings
GET    /api/info                     — deprecated, use /api/docs
```

### Web frontend (`web/src/`)

```
pages/
  Landing.jsx / .module.css   — public landing page (also at /landing when logged in)
  Setup.jsx                   — first-run Convex URL entry
  AppPage.jsx                 — root: state, nav, keyboard shortcuts, undo/redo

components/UI/
  BlockModal.jsx              — create/edit form (includes notify_message field)
  CommandPalette.jsx          — Cmd+K search with multi-select bulk delete/complete
  QuickAdd.jsx                — NLP quick-add bar (chrono-node), 'q' shortcut
  DeleteRecurringModal.jsx    — 3-mode delete for recurring series
  SettingsModal.jsx           — tabs: General, Notifications, Categories, Integrations, Developer
                                Integrations tab: GCal sync with orphan confirmation dialog
  CategoryManager.jsx
  BlockCard.jsx
  BlockDetailsSheet.jsx
```

**Key hooks (`web/src/hooks/useDB.js`):**
- `useBlocks()` — exposes: `blocks`, `createBlock`, `updateBlock`, `deleteBlock`, `toggleComplete`, `bulkCreate`, `bulkDelete`, `bulkComplete`, `createRecurring`, `deleteRecurring`
- `useIntegrations()` — exposes: `getSyncDiff`, `deleteGcalEvents`, `fetchFromGoogle`, `pushToGoogle`, `triggerGcalSync`
- `useCategories()`, `useTelegram()`, `usePushEnabled()`, `useApiKey()`

**Key utils:**
- `dates.js` — all date helpers; always imports `getTZ()` dynamically (never hardcode timezone)
- `parseQuickAdd.js` — chrono-node NLP parser for the QuickAdd bar
- `categories.js` — `CATEGORIES` constant + `getColor`, `getCatEmoji`, `hexRgb`

### Routing (`web/src/App.jsx`)
- No Convex URL stored → `PreSetupApp`: `/` = Landing, `/setup` = Setup, `/landing` = Landing
- Convex URL stored → `MainApp`: `/app` = AppPage, `/landing` = Landing (always accessible), `*` → `/app`

### CSS conventions
- CSS Modules everywhere (`.module.css` per component)
- Global CSS vars in `web/src/index.css`: `--bg`, `--surface`, `--surface2`, `--surface3`, `--border`, `--border2`, `--text`, `--text-muted`, `--text-dim`
- Mobile breakpoint: `768px` in both CSS `@media` and JS `window.matchMedia`
- Portals (`createPortal`) used for: BlockCard action sheet, BlockDetailsSheet, BlockModal overlay
- Safe area insets (`env(safe-area-inset-top/bottom)`) used throughout for Dynamic Island/notch

### Key features & their implementation locations
| Feature | Where |
|---------|-------|
| Recurring blocks | `blocks.ts:createRecurring`, `deleteRecurring`; `BlockModal` Repeat dropdown; `DeleteRecurringModal` |
| Per-block custom notification message | `notify_message` field in schema + BlockModal; used in `telegram.ts` + `pushActions.ts` |
| Telegram reminders | `telegram.ts:sendReminder` (internalAction); scheduled via `ctx.scheduler.runAt` in blocks mutations; template in `telegramTemplate` setting |
| Push notifications | `pushActions.ts:checkAndNotify` (cron every 1 min); rules in `reminders` setting |
| GCal sync with orphan confirmation | `calendarSyncActions.ts`: `getSyncDiff`, `fetchFromGoogle({deleteKugiIds})`, `pushToGoogle`, `deleteGcalEvents`; UI in `SettingsModal` |
| Multi-select bulk delete in search | `CommandPalette.jsx` — checkboxes + Select All + bulk toolbar |
| AI agent API | `http.ts` — all endpoints; agent should always `GET /api/docs` first |
| NLP quick-add | `QuickAdd.jsx` + `parseQuickAdd.js` (chrono-node); keyboard shortcut `q` |
| Command palette | `CommandPalette.jsx`; `>` prefix for commands, plain text for search |
| Landing page | `Landing.jsx` — Linear-style dark design, 3D preview, AI Agent section with copyable setup prompt |

---

## Known pitfalls

- **WeekView always renders 7 columns** — never conditional inline `gridTemplateColumns`; use the `.scrollInner` wrapper with `min-width: 630px` + `overflow-x: auto` so headers and grid scroll together.
- **`useQuery` + `useState` pattern** — `useQuery` returns `undefined` while loading. Never derive UI state purely from `useQuery`; use `useState` for immediate display and `useEffect` to sync when Convex data arrives.
- **Controlled emoji input bug** — don't set `value={emoji}` on an emoji input. Use a separate `draft` state for the input and the current emoji only as `placeholder`; otherwise typing appends and `Intl.Segmenter` picks the old emoji.
- **GitHub web merge editor** — can silently drop CSS property values (e.g. `grid-template-columns`) when resolving conflicts. Verify CSS-heavy files after any web-UI merge.
- **Convex HTTP endpoint** — always `.convex.site`, never `.convex.cloud`.
- **Worktree deployment** — changes made in `.claude/worktrees/<name>` must be committed and merged to `main` before they appear in the Render deployment.
- **`fetchFromGoogle` now takes `deleteKugiIds?`** — when called from the GCal sync UI, pass the user-selected IDs; omit for legacy auto-delete behaviour.
- **Telegram template variables** — `{time}` expands to `" starts at HH:MM"` or `" is coming up"` (not the raw time). `{notes}` expands to `"\n\n<notes>"` or `""`. Don't treat them as raw substitutions.
- **bulk-delete/bulk-complete accept `search`** — the HTTP API accepts either `ids` array or `search` string (selects all matching blocks). Never need two calls.
