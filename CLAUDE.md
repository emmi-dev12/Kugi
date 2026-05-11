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
| `settings.ts` | API key management, custom categories (stored in `settings` table as key/value) |
| `http.ts` | REST HTTP API for AI agent access (`.convex.site` endpoint) |
| `push.ts` / `pushActions.ts` | Push notification delivery |
| `calendarSyncActions.ts` | Google Calendar sync via Composio |
| `crons.ts` | Scheduled jobs |

**Convex IDs**: documents have `_id`, not `id`. `web/src/hooks/useDB.js` maps `_id → id` for the frontend.

**HTTP API base URL**: `https://<deployment>.convex.site` — note `.convex.site`, not `.convex.cloud`.

### Web frontend (`web/src/`)

```
AppPage.jsx           Root: state, nav, keyboard shortcuts, undo/redo
  WeekView            7-column grid; wrapped in scrollInner for horizontal scroll on mobile
  DayView             Bento (card grid) or Timeline layout; toggle between them
    BlockCard         Individual block; mobile: tap → action sheet; desktop: hover buttons
  CompletedView       Completed blocks grouped by date
  CalendarView        Full-page month calendar
  BlockModal          Create/edit form
  BlockDetailsSheet   Read-only detail portal
  CategoryManager     Add/edit/remove custom categories in sidebar
```

**Key hooks:**
- `useDB.js` — Convex queries/mutations + `_id → id` normalization
- `useCategories.js` — merges 8 default categories + Convex-synced custom ones; `useState` for instant UI, `useEffect` to sync Convex data, localStorage as fallback
- `useNotifications.js` — push notification scheduling

**Key utils:**
- `dates.js` — all date helpers; always imports `getTZ()` dynamically (never hardcode timezone)
- `timezone.js` — reads/writes `kugiTimezone` from localStorage, falls back to browser TZ
- `categories.js` — `CATEGORIES` constant + `getColor`, `getCatEmoji`, `hexRgb`

### CSS conventions
- CSS Modules everywhere (`.module.css` per component)
- Global CSS vars in `web/src/index.css`: `--bg`, `--surface`, `--surface2`, `--surface3`, `--border`, `--border2`, `--text`, `--text-muted`, `--text-dim`
- Mobile breakpoint: `768px` in both CSS `@media` and JS `window.matchMedia`
- Portals (`createPortal`) used for: BlockCard action sheet, BlockDetailsSheet, BlockModal overlay
- Safe area insets (`env(safe-area-inset-top/bottom)`) used throughout for Dynamic Island/notch

---

## Known pitfalls

- **WeekView always renders 7 columns** — never conditional inline `gridTemplateColumns`; use the `.scrollInner` wrapper with `min-width: 630px` + `overflow-x: auto` so headers and grid scroll together.
- **`useQuery` + `useState` pattern** — `useQuery` returns `undefined` while loading. Never derive UI state purely from `useQuery`; use `useState` for immediate display and `useEffect` to sync when Convex data arrives.
- **Controlled emoji input bug** — don't set `value={emoji}` on an emoji input. Use a separate `draft` state for the input and the current emoji only as `placeholder`; otherwise typing appends and `Intl.Segmenter` picks the old emoji.
- **GitHub web merge editor** — can silently drop CSS property values (e.g. `grid-template-columns`) when resolving conflicts. Verify CSS-heavy files after any web-UI merge.
- **Convex HTTP endpoint** — always `.convex.site`, never `.convex.cloud`.
- **Worktree deployment** — changes made in `.claude/worktrees/<name>` must be committed and merged to `main` before they appear in the Render deployment.
