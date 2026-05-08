# Kugi — Claude Context Document

## What is Kugi?

Kugi is a **personal block calendar PWA** (Progressive Web App). Users schedule time blocks (tasks/events) across a week or day view, mark them complete, and optionally have an AI agent (Base44 Superagent, etc.) manage tasks via HTTP API.

- **Frontend**: React 19 + Vite, CSS Modules, deployed as a static site on **Render** (https://kugi.onrender.com or similar)
- **Backend**: **Convex** real-time database. Each user self-hosts their own Convex project and enters the URL at `/setup`. HTTP actions are at `<convexUrl>.convex.site` (NOT `.convex.cloud`).
- **Repo**: `/Users/mh/Desktop/Kugi`
- **Web source**: `/Users/mh/Desktop/Kugi/web/src`

---

## Key Architecture

### Data model (Convex)
- Documents use `_id` (not `id`). `useDB.js` normalizes: `blocks = raw.map(b => ({ ...b, id: b._id }))`.
- Block fields: `title`, `emoji`, `category`, `date` (YYYY-MM-DD string), `start_time`, `end_time`, `notes`, `completed`.

### HTTP API (for AI agents)
- Base URL: `https://<your-project>.convex.site`
- Auth: `Authorization: Bearer <apiKey>`
- `GET /api/tasks` — list all blocks
- `POST /api/tasks` — create block (`{ title, emoji, category, date, start_time, end_time, notes }`)
- `PATCH /api/tasks/:id` — update block
- `DELETE /api/tasks/:id` — delete block
- `POST /api/tasks/:id/complete` — toggle complete

### Important utils
- `web/src/utils/categories.js` — CATEGORIES constant + `getColor`, `getCatEmoji`, `hexRgb`. Now reads localStorage custom categories too.
- `web/src/utils/dates.js` — all date helpers; imports `getTZ()` dynamically (no hardcoded timezone).
- `web/src/utils/timezone.js` — reads/writes `kugiTimezone` from localStorage, falls back to browser TZ.
- `web/src/hooks/useDB.js` — Convex queries/mutations, `_id` → `id` normalization.
- `web/src/hooks/useCategories.js` — merges default CATEGORIES + localStorage `kugiCustomCategories`.
- `web/src/hooks/useNotifications.js` — push notification scheduling.

---

## App Structure

```
AppPage.jsx           — root: state, nav, sidebar, bottom nav, keyboard shortcuts
  WeekView            — 7-column week grid
  DayView             — bento (card grid) or timeline layout; layout toggle
    BlockCard         — individual block; mobile: tap → action sheet; desktop: hover buttons
  CompletedView       — all completed blocks grouped by date, undo button
  CalendarView        — full-page month calendar, dots per day, navigate to day on tap
  BlockModal          — create/edit block form
  BlockDetailsSheet   — read-only portal: shows all block info + actions
  CategoryManager     — list/add/remove categories in sidebar
```

### Views
| Key | View |
|-----|------|
| `w` | Week |
| `d` | Day |
| `f` | Finished (Completed) |
| `n` | New block |

### Mobile
- Bottom nav: Week | Day | + (new block) | Finished | Cal
- Header gear icon → settings bottom sheet
- Sidebar is hidden; settings sheet contains sidebar content minus mini-calendar
- Safe area: `env(safe-area-inset-top/bottom)` used throughout for Dynamic Island / notch

---

## Features Built (full history)

1. **Timezone** — user-selectable, persisted in localStorage, applied dynamically everywhere
2. **Convex `_id` fix** — mutations were silently failing; normalized in useDB.js
3. **Mobile action sheet** — tap a block → sheet with View details / Edit / Mark complete / Delete / Cancel
4. **Desktop hover buttons** — ℹ / ✓ / ✎ / ✕ on card hover
5. **Week view scroll sync** — headers and grid wrapped in `scrollInner` so they scroll together horizontally
6. **Bento view** — default layout for DayView; toggle between Bento and Timeline; visible on mobile too
7. **Completed tab** ("Finished") — all completed blocks, grouped by date, undo support; keyboard `f`
8. **Calendar tab** — full-page month calendar as separate nav item
9. **PWA icon** — purple gradient with 4 white rounded squares; generated in pure Node.js PNG encoder with 8× SSAA
10. **Copy button** — next to API key in sidebar (⎘ icon, flashes ✓)
11. **Block details sheet** — read-only portal showing all block fields; accessible from mobile action sheet and desktop ℹ button
12. **Custom categories** — add/remove categories beyond the 8 defaults; name + emoji + color picker; persisted in `localStorage`; appear in BlockModal dropdown and sidebar filter

---

## Deployment

- Git push to `main` triggers Render auto-deploy
- Service worker cache version must be bumped (`web/public/sw.js`, `CACHE_NAME`) when deploying JS changes, otherwise PWA installs serve stale files
- Current cache version: check `web/public/sw.js` — bump `vN` → `vN+1` when needed

---

## CSS conventions

- CSS Modules everywhere (`.module.css` per component)
- Global vars in `web/src/index.css`: `--bg`, `--surface`, `--surface2`, `--surface3`, `--border`, `--border2`, `--text`, `--text-muted`, `--text-dim`
- Mobile breakpoint: `768px` (both CSS `@media` and JS `window.matchMedia`)
- Portals (`createPortal`) used for: BlockCard action sheet, BlockDetailsSheet, BlockModal overlay

---

## Common pitfalls

- Convex documents: always `_id`, never `id`. useDB.js adds `id` alias.
- Convex HTTP endpoint: `.convex.site` not `.convex.cloud`
- SW cache: after any JS change, bump `CACHE_NAME` in `web/public/sw.js` or users get stale app
- `npm run build` needs `node_modules` installed in `web/` — run `npm install` there first if missing
- The worktree for Claude sessions is at `.claude/worktrees/<name>`; changes must be committed to `main` for deployment
- **GitHub web merge editor silently drops CSS property values** — when resolving conflicts via GitHub's web UI, `grid-template-columns` and similar shorthand values were stripped from `.headers` and `.grid` in WeekView.module.css, causing blocks to stack vertically instead of a 7-column grid. Always verify CSS-heavy files after a web-UI merge. Fix: restore `grid-template-columns: repeat(7,1fr)` to both rules.
- **WeekView always renders 7 days** — never use a "3-day mobile view" with conditional inline `gridTemplateColumns`. Instead, wrap `.headers` + `.grid` in `.scrollInner` and use `min-width: 630px` + `overflow-x: auto` at the `.scrollInner` level so both scroll together horizontally on narrow screens.
