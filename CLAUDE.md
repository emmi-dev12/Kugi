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

The `.env.local` required for Convex deployment must contain `CONVEX_DEPLOY_KEY`. Get the key from **[dashboard.convex.dev](https://dashboard.convex.dev)** → deployment `artful-gnat-488` → Settings → Deploy Keys, then create `app/.env.local`:
```
CONVEX_DEPLOY_KEY=your-deploy-key-here
```

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
| `schema.ts` | Four tables: `blocks`, `settings`, `pushSubscriptions`, `auditLog` |
| `auditLog.ts` | Internal mutation `log` — writes to the `auditLog` table |
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
end_date, telegramJobId (legacy single job, kept for cancel compat), telegramJobIds (string[], up to 4 scheduled jobs),
recurrence (hourly|daily|monthly|yearly), recurrenceGroupId, googleEventId
```
Indexes: `by_date`, `by_recurrence_group` (on `recurrenceGroupId`)

### settings table keys
| Key | Value |
|-----|-------|
| `apiKey` | Bearer token for HTTP API |
| `customCategories` | JSON object of custom categories |
| `reminders` | JSON array of push reminder rules `{ id, offsetMinutes, atTime?, message? }` |
| `timezone` | IANA timezone string |
| `telegramBotToken` | Telegram bot token |
| `telegramChatId` | Telegram chat/user ID |
| `telegramOffsetMinutes` | Legacy single offset (minutes); used as fallback when `telegramReminderOffsets` not set |
| `telegramReminderOffsets` | JSON array of up to 4 offset values in minutes — drives multi-reminder scheduling |
| `telegramTemplate` | Message template with `{emoji}` `{title}` `{time}` `{date}` `{notes}` `{category}` variables |
| `webhookUrl` | URL POSTed (JSON) whenever a Telegram reminder fires — for AI agent integration |
| `composioApiKey` | Composio API key for Google Calendar |
| `integration_googleCalendar` | `"true"` / `"false"` |
| `pushEnabled` | `"true"` / `"false"` |
| `vapidPublicKey` / `vapidPrivateKey` | VAPID keys for web push |
| `firedPushKeys` | JSON — dedup log for fired push notifications |
| `telegramWebhookSecret` | Random hex string — verified in `X-Telegram-Bot-Api-Secret-Token` header on incoming callback queries |

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

### Telegram webhook endpoints (no Bearer auth — verified by secret header)
```
POST   /telegram/webhook             — receives Telegram callback_query events (button taps)
POST   /telegram/register-webhook    — requires Bearer auth; calls Telegram setWebhook + stores secret
```

### Web frontend (`web/src/`)

```
pages/
  Landing.jsx / .module.css   — public landing page (also at /landing when logged in)
  Setup.jsx                   — first-run Convex URL entry
  AppPage.jsx                 — root: state, nav, keyboard shortcuts, undo/redo

components/UI/
  BlockModal.jsx              — create/edit form (includes notify_message field)
  CommandPalette.jsx          — Cmd+K search with multi-select bulk delete/complete;
                                empty-query starter panel (command list + shortcut cheatsheet), fuzzy title match
  QuickAdd.jsx                — NLP quick-add bar (chrono-node), 'q' shortcut
  PlanMyDay.jsx               — "Plan my day" focus overlay ('p' / desktop header button / mobile header sunrise button): day load, unscheduled list, carry-over from yesterday
  Celebration.jsx            — confetti + handwritten "all done", fired when the last open block of a day completes (reduced-motion aware)
  WelcomeCard.jsx            — quick-action panel (Quick add / New block / Command palette); shown at the top of the day view, mobile only
  DeleteRecurringModal.jsx    — 3-mode delete for recurring series
  SettingsModal.jsx           — tabs: General, Notifications, Categories, Integrations, Developer
                                Integrations tab: GCal sync with orphan confirmation dialog
  CategoryManager.jsx
  BlockCard.jsx               — block card; inline title edit (dbl-click / long-press) via onUpdate prop
  BlockDetailsSheet.jsx
  KugiMark.jsx               — unified logo+icon: handwritten lowercase "kugi" on a sage→slate tile (sizes sm/md/lg). Used in app header, Landing, Setup. Replaces the old geometric KugiLogo.
```

**Branding:** the name is lowercase **kugi** everywhere (incl. `manifest.json`, `index.html` title/apple-title). The logo *is* the wordmark — `KugiMark` (sage→slate rounded tile, Caveat script). `web/public/favicon.svg` and the PNG home-screen icons (`web/public/icons/icon-16/32/180/192/512.png`) all render the handwritten kugi on the sage→slate tile. To regenerate the PNGs: render the tile with the Caveat font at each size (the icons were produced via headless Chromium with the Caveat TTF embedded as base64 — there's no SVG rasterizer/system Caveat font in the build env, so a plain `convert favicon.svg` won't reproduce the script face).

**Key hooks (`web/src/hooks/useDB.js`):**
- `useBlocks()` — exposes: `blocks`, `createBlock`, `updateBlock`, `deleteBlock`, `toggleComplete`, `bulkCreate`, `bulkDelete`, `bulkComplete`, `createRecurring`, `deleteRecurring`
- `useIntegrations()` — exposes: `getSyncDiff`, `deleteGcalEvents`, `fetchFromGoogle`, `pushToGoogle`, `triggerGcalSync`
- `useCategories()`, `useTelegram()`, `usePushEnabled()`, `useApiKey()`

**Key utils:**
- `dates.js` — all date helpers; always imports `getTZ()` dynamically (never hardcode timezone). Timeline math: `timeToMins`, `minsToPx` (64px/hour), `minsToTime` (drag-to-reschedule)
- `parseQuickAdd.js` — chrono-node NLP parser for the QuickAdd bar
- `categories.js` — `CATEGORIES` constant + `getColor`, `getCatEmoji`, `hexRgb`

### Routing (`web/src/App.jsx`)
- No Convex URL stored → `PreSetupApp`: `/` = Landing, `/setup` = Setup, `/landing` = Landing
- Convex URL stored → `MainApp`: `/app` = AppPage, `/landing` = Landing (always accessible), `*` → `/app`

### CSS conventions
- CSS Modules everywhere (`.module.css` per component)
- Design tokens live in `web/src/styles/globals.css` `:root` (imported once in `main.jsx`, so tokens resolve in every module). Core: `--bg`, `--surface`, `--surface2/3/4`, `--border`, `--border2`, `--text`, `--text-muted`, `--text-dim`, `--accent`. Added in the UI/UX upgrade: spacing scale `--s1`…`--s6`, elevation `--elev-1/2/3`, functional `--success`/`--danger`/`--info`, motion `--ease-out` + `--dur-fast`/`--dur`/`--dur-slow`, and `--font-script` (Caveat — handwritten "kugi" wordmark only, never body text)
- Mobile breakpoint: `768px` in both CSS `@media` and JS `window.matchMedia`
- Portals (`createPortal`) used for: BlockCard action sheet, BlockDetailsSheet, BlockModal overlay
- Safe area insets (`env(safe-area-inset-top/bottom)`) used throughout for Dynamic Island/notch

### Key features & their implementation locations
| Feature | Where |
|---------|-------|
| Recurring blocks | `blocks.ts:createRecurring`, `deleteRecurring`; `BlockModal` Repeat dropdown; `DeleteRecurringModal` |
| Per-block custom notification message | `notify_message` field in schema + BlockModal; used in `telegram.ts` + `pushActions.ts` |
| Telegram reminders | `telegram.ts:sendReminder` (internalAction); scheduled via `ctx.scheduler.runAt` in `blocks.ts`; up to 4 jobs per block stored in `telegramJobIds`; timezone-correct using `localToUTC` in `blocks.ts`; template in `telegramTemplate` setting; fires `webhookUrl` POST on each reminder. Messages include inline keyboard buttons (✅ Done, ⏰ +30m, ⏰ +1h, 📅 Tomorrow); callback_data format is `{action}:{blockId}` where action ∈ `d`, `s30`, `s60`, `tom`. Handled by `POST /telegram/webhook` in `http.ts`. Register via Settings → Integrations → Telegram → "Enable interactive buttons" |
| Push notifications | `pushActions.ts:checkAndNotify` (cron every 1 min); rules in `reminders` setting |
| GCal sync with orphan confirmation | `calendarSyncActions.ts`: `getSyncDiff`, `fetchFromGoogle({deleteKugiIds})`, `pushToGoogle`, `deleteGcalEvents`; UI in `SettingsModal` |
| Multi-select bulk delete in search | `CommandPalette.jsx` — checkboxes + Select All + bulk toolbar |
| Drag-to-reschedule / resize | `DayView.jsx` timeline `TimelineBody`: pointer drag moves a timed block, bottom `resizeHandle` resizes; 15-min snap; commits via `onUpdateBlock` (= `handleUpdate` in AppPage) so undo/redo + toasts work |
| Inline title edit | `BlockCard.jsx` `onUpdate` prop; double-click (desktop) / long-press (mobile) → commits `{ title }` through `handleUpdate` |
| Plan my day | `PlanMyDay.jsx`; opened by `'p'`, the desktop header Plan button (`.planBtn` in `headerRight`), or the mobile header sunrise button (`.mobilePlanBtn`). Note: `headerRight` is `display:none` on mobile, so any new header action needs a separate mobile entry point. Carry-over moves yesterday's unfinished by updating `date` |
| Completion celebration | `Celebration.jsx`; triggered in `AppPage.handleToggle` when a day's last open block completes; `triggerCelebration()` falls back to a toast under `prefers-reduced-motion` |
| First-run welcome / quick-actions | `WelcomeCard.jsx`; rendered at the top of `AppPage.jsx`'s main only when `view === 'day' && isMobile` — day view, mobile only, not conditional on block count |
| AI agent API | `http.ts` — all endpoints; agent should always `GET /api/docs` first |
| NLP quick-add | `QuickAdd.jsx` + `parseQuickAdd.js` (chrono-node); keyboard shortcut `q` |
| Command palette | `CommandPalette.jsx`; `>` prefix for commands, plain text for search; empty-query starter panel + fuzzy title match |
| Landing page | `Landing.jsx` — Linear-style dark design, interactive week/day preview, AI Agent section with copyable prompt, and a "Built for flow" bento card (`.bentoFlow`, full-width row 4) showcasing the signature interactions. Brand copy is lowercase **kugi** (repo URLs keep capital `Kugi`) |
| Language / i18n (English + German) | `i18n/index.js` (i18next + react-i18next init, mounted via `I18nextProvider` in `App.jsx` above both pre-setup and main app branches), `i18n/locales/en.json` + `de.json`, `utils/language.js` (`getEffectiveLanguage`/`getLangPreference`/`setLangPreference`/`getLocale` — mirrors `utils/timezone.js`'s localStorage pattern; no stored `kugiLanguage` key = auto-detect from `navigator.language`), `hooks/useLanguage.js`. Settings → General has the Language selector (Auto/English/Deutsch), wired through `AppPage.jsx` the same way as the Timezone selector. `Landing.jsx`'s nav bar also has a compact EN/DE toggle (`.langSwitch`/`.langBtn` in `Landing.module.css`) using the same `useLanguage()` hook — visible pre-signup since the public marketing page has no Settings modal. All user-facing strings across `web/src` use `useTranslation()`'s `t()`; native `Intl`/`toLocaleDateString` calls use `getLocale()` instead of a hardcoded `'en-US'` |

---

## Known pitfalls

- **WeekView always renders 7 columns** — never conditional inline `gridTemplateColumns`; use the `.scrollInner` wrapper with `min-width: 630px` + `overflow-x: auto` so headers and grid scroll together.
- **`useQuery` + `useState` pattern** — `useQuery` returns `undefined` while loading. Never derive UI state purely from `useQuery`; use `useState` for immediate display and `useEffect` to sync when Convex data arrives.
- **Controlled emoji input bug** — don't set `value={emoji}` on an emoji input. Use a separate `draft` state for the input and the current emoji only as `placeholder`; otherwise typing appends and `Intl.Segmenter` picks the old emoji.
- **GitHub web merge editor** — can silently drop CSS property values (e.g. `grid-template-columns`) when resolving conflicts. Verify CSS-heavy files after any web-UI merge.
- **Convex HTTP endpoint** — always `.convex.site`, never `.convex.cloud`.
- **PRs are squash-merged** — the repo squashes each PR into one new commit on `main` (new hash). After your PR merges, do NOT keep committing on the same branch and open another PR from it: git sees the branch's original commits and main's squash as divergent histories touching the same lines → phantom conflicts. Instead start fresh from `main`, or drop the already-merged commits with `git rebase --onto origin/main <last-merged-commit> <branch>` before pushing the next change.
- **No CI / Render auto-deploy** — there are no GitHub Actions or required checks on this repo; merging to `main` is the gate, and Render auto-deploys `main`. Verify changes locally (`npm run build`, `npm run lint`, and headless-Chromium screenshots for visual work) — nothing runs them for you.
- **Lint has a pre-existing baseline** — `npm run lint` (in `web/`) reports ~30 errors on a clean checkout (unused imports, `set-state-in-effect`, etc.). Don't try to clear them all; just make sure your change doesn't add new ones. `npm run build` must stay green.
- **Chromium can't fetch web fonts in the build env** — the Caveat handwritten font (`--font-script`, loaded via Google Fonts `@import` in `globals.css`) does not load in headless Chromium here, so local screenshots show a serif/cursive fallback. It renders correctly on real devices. The PNG app icons embed Caveat as base64 so they bake the script face in (see Branding note above).
- **`fetchFromGoogle` now takes `deleteKugiIds?`** — when called from the GCal sync UI, pass the user-selected IDs; omit for legacy auto-delete behaviour.
- **Telegram template variables** — `{time}` expands to `" starts at HH:MM"` or `" is coming up"` (not the raw time). `{notes}` expands to `"\n\n<notes>"` or `""`. Don't treat them as raw substitutions.
- **bulk-delete/bulk-complete accept `search`** — the HTTP API accepts either `ids` array or `search` string (selects all matching blocks). Never need two calls. When using `search`, the caller must also pass `?confirm=true` as a query parameter or the API returns 400 with the count of affected tasks.
- **HTTP API rate limit** — 60 requests/minute per API key (token bucket). Returns 429 on excess. Brute-force protection locks an IP for 60 s after 5 failed auth attempts.
- **CORS origin** — non-OPTIONS responses set `Access-Control-Allow-Origin: https://kugi.app`. To add another origin, update `ALLOWED_ORIGINS` in `http.ts`. OPTIONS preflights keep `*`.
- **Audit log** — every HTTP API write (create/update/delete/bulk/settings) is logged to the `auditLog` table via `internal.auditLog.log`. Failures are swallowed (try/catch) so they never break the main operation.
- **Recurring block cap** — `createRecurring` throws if the generated occurrence count exceeds 365. Daily recurrence would produce 730 entries which exceeds the cap — use a custom date range instead.
- **Telegram timezone bug (fixed)** — `new Date('YYYY-MM-DDTHH:MM')` parses as UTC on the Convex server, not local time. Always use `localToUTC(date, time, tz)` (defined in `blocks.ts`) which does iterative `Intl.DateTimeFormat` correction. Never use bare `new Date(dateStr + 'T' + timeStr)` for scheduling.
- **Multi-reminder job IDs** — blocks store `telegramJobIds: string[]` (new) alongside legacy `telegramJobId`. Always cancel both in `cancelTelegramJobs()`. Don't assume a block only has one scheduled reminder.
- **Webhook payload** — `telegram.ts` POSTs `{ event, blockId, title, emoji, date, start_time, end_time, category, notes, notify_message, fired_at }` to `webhookUrl` on every reminder fire. The `try/catch` swallows webhook errors so a bad URL never breaks Telegram delivery.
- **sw.js cache name** — currently `kugi-v24`. Always bump on any frontend JS/CSS change or users with the PWA installed will see stale UI.
- **Mobile header is two rows** — on `≤768px` the `.header` wraps: row 1 = `KugiMark` + `.mobilePlanBtn` + `.mobileSettingsBtn`, row 2 = full-width date navigator (`‹ date › Today`), using `flex-wrap` + `height: auto` (not the desktop fixed height). The desktop `headerRight` cluster (view toggle, Plan, Search, New Block, gear) is `display:none` on mobile — its actions live in the bottom nav or dedicated `.mobile*` buttons instead. The nav label has `.navLabelFull` (desktop) / `.navLabelShort` (mobile compact, from `navLabelShort` in AppPage) — keep both spans when editing it.
- **`useDB.js` friendlyError** — all `alert()` calls in `useDB.js` use `friendlyError(e)` which hides stack traces and long server messages. Don't use raw `e.message` in alerts.
- **`useApiKey` effect** — only calls `ensureApiKey` when `apiKey === null` (query resolved, no key yet). Don't change the dep array back to `[]`.
