import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";
import { internal } from "./_generated/api";

const http = httpRouter();

// ── Rate limiting (token bucket, 60 req/min per API key) ───────
const rateBuckets = new Map<string, { tokens: number; lastRefill: number }>();
const RATE_MAX = 60;
const RATE_REFILL_MS = 1000; // 1 token per second

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  let bucket = rateBuckets.get(key);
  if (!bucket) {
    bucket = { tokens: RATE_MAX - 1, lastRefill: now };
    rateBuckets.set(key, bucket);
    return true;
  }
  const elapsed = now - bucket.lastRefill;
  const refill = Math.floor(elapsed / RATE_REFILL_MS);
  if (refill > 0) {
    bucket.tokens = Math.min(RATE_MAX, bucket.tokens + refill);
    bucket.lastRefill = now;
  }
  if (bucket.tokens <= 0) return false;
  bucket.tokens--;
  return true;
}

// ── Brute-force protection (5 failures → 60s lockout per IP) ──
const authFailures = new Map<string, { failures: number; lockedUntil: number }>();
const BRUTE_MAX = 5;
const BRUTE_LOCKOUT_MS = 60_000;

function checkBruteForce(ip: string): string | null {
  const now = Date.now();
  const rec = authFailures.get(ip);
  if (rec && now < rec.lockedUntil) {
    const secs = Math.ceil((rec.lockedUntil - now) / 1000);
    return `Too many failed attempts. Try again in ${secs} seconds.`;
  }
  return null;
}

function recordAuthFailure(ip: string): void {
  const now = Date.now();
  const rec = authFailures.get(ip) ?? { failures: 0, lockedUntil: 0 };
  rec.failures++;
  if (rec.failures >= BRUTE_MAX) rec.lockedUntil = now + BRUTE_LOCKOUT_MS;
  authFailures.set(ip, rec);
}

function clearAuthFailure(ip: string): void {
  authFailures.delete(ip);
}

// Allowed origins for the non-preflight CORS header.
// Add additional domains here if the frontend is served from multiple hosts.
const ALLOWED_ORIGINS = new Set([
  "https://kugi.app",
  "https://www.kugi.app",
]);

const CORS_METHODS = "GET, POST, PATCH, DELETE, OPTIONS";
const CORS_HEADERS = "Authorization, Content-Type";

// OPTIONS preflights keep Access-Control-Allow-Origin: * so browsers can probe.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": CORS_METHODS,
  "Access-Control-Allow-Headers": CORS_HEADERS,
};

async function audit(ctx: any, action: string, resourceType: string, resourceId?: string, details?: string): Promise<void> {
  try {
    await ctx.runMutation(internal.auditLog.log, { action, resourceType, resourceId, details });
  } catch {}
}

function resolveOrigin(req: Request): string {
  const origin = req.headers.get("origin") ?? "";
  return ALLOWED_ORIGINS.has(origin) ? origin : [...ALLOWED_ORIGINS][0];
}

function json(data: unknown, status = 200, req?: Request) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": req ? resolveOrigin(req) : [...ALLOWED_ORIGINS][0],
      "Access-Control-Allow-Methods": CORS_METHODS,
      "Access-Control-Allow-Headers": CORS_HEADERS,
      "Vary": "Origin",
    },
  });
}

// Constant-time string comparison to prevent timing-oracle attacks on the API key.
function constantTimeEqual(a: string, b: string): boolean {
  const aLen = a.length;
  const bLen = b.length;
  // Always iterate max(aLen, bLen) iterations — no early exit.
  let diff = aLen ^ bLen;
  const len = Math.max(aLen, bLen);
  for (let i = 0; i < len; i++) {
    const ac = i < aLen ? a.charCodeAt(i) : 0;
    const bc = i < bLen ? b.charCodeAt(i) : 0;
    diff |= ac ^ bc;
  }
  return diff === 0;
}

// Returns null on success, or a Response to send immediately on failure.
async function authenticate(ctx: any, req: Request): Promise<Response | null> {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";

  // Check brute-force lockout first (before touching DB)
  const lockMsg = checkBruteForce(ip);
  if (lockMsg) return json({ error: lockMsg }, 401, req);

  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) {
    recordAuthFailure(ip);
    return json({ error: "Unauthorized" }, 401, req);
  }
  const token = auth.slice(7);
  const storedKey = await ctx.runQuery(api.settings.getApiKey, {});
  const ok = storedKey !== null && constantTimeEqual(storedKey, token);
  if (!ok) {
    recordAuthFailure(ip);
    return json({ error: "Unauthorized" }, 401, req);
  }
  clearAuthFailure(ip);

  // Rate limit by API key
  if (!checkRateLimit(token)) {
    return json({ error: "Rate limit exceeded" }, 429, req);
  }

  return null;
}

// Normalize a raw Convex block for API consumers:
// - exposes `id` (not `_id`)
// - strips internal scheduling fields
function normalizeTask(t: any) {
  if (!t) return t;
  const { _id, _creationTime, telegramJobId, telegramJobIds, ...rest } = t;
  return { id: _id, ...rest };
}

// Validate YYYY-MM-DD — format AND calendar range.
function isValidDate(s: any): boolean {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, mo, d] = s.split("-").map(Number);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return false;
  // Verify the date actually exists (catches Feb 30, Apr 31, etc.)
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

// Validate HH:MM — 24-hour clock range.
function isValidTime(s: any): boolean {
  if (typeof s !== "string" || !/^\d{2}:\d{2}$/.test(s)) return false;
  const [h, m] = s.split(":").map(Number);
  return h >= 0 && h <= 23 && m >= 0 && m <= 59;
}

// Validate blockReminders: array of {atTime: "HH:MM", message?}, max 6 entries
function validateBlockReminders(v: any): string | null {
  if (!Array.isArray(v)) return "blockReminders must be an array";
  if (v.length > 6) return "blockReminders max length is 6";
  for (let i = 0; i < v.length; i++) {
    const r = v[i];
    if (typeof r !== "object" || r === null) return `blockReminders[${i}] must be an object`;
    if (!isValidTime(r.atTime)) return `blockReminders[${i}].atTime must be a valid HH:MM string (e.g. "09:00")`;
    if (r.message !== undefined) {
      if (typeof r.message !== "string") return `blockReminders[${i}].message must be a string`;
      if (r.message.length > MAX_REMINDER_MSG) return `blockReminders[${i}].message must be ${MAX_REMINDER_MSG} characters or fewer`;
    }
  }
  return null;
}

// Validate telegramReminderOffsets: array of numbers (minutes, 0–10080), max 4
function validateOffsets(v: any): string | null {
  if (!Array.isArray(v)) return "must be an array";
  if (v.length > 4) return "max 4 entries allowed";
  for (let i = 0; i < v.length; i++) {
    if (typeof v[i] !== "number" || !Number.isFinite(v[i])) return `[${i}] must be a finite number`;
    if (v[i] < 0 || v[i] > 10080) return `[${i}] must be between 0 and 10080 minutes`;
  }
  return null;
}

// Mask a secret value: show only that it is set, not the actual value
function mask(v: string | null | undefined): string | null {
  return v ? "***" : null;
}

// Validate a webhook URL: must be HTTPS and not a private/loopback/metadata address.
function validateWebhookUrl(url: string): string | null {
  let parsed: URL;
  try { parsed = new URL(url); } catch { return "must be a valid URL"; }
  if (parsed.protocol !== "https:") return "must use HTTPS";
  const h = parsed.hostname.toLowerCase();

  // Loopback and local hostnames
  if (h === "localhost" || h === "0.0.0.0" || h.endsWith(".local") || h.endsWith(".localhost")) {
    return "loopback/local addresses are not allowed";
  }

  // Strip IPv6 brackets for range checks
  const bare = h.startsWith("[") && h.endsWith("]") ? h.slice(1, -1) : h;

  // IPv6 loopback (::1) and unspecified (::/128)
  if (bare === "::1" || bare === "::" || bare === "0:0:0:0:0:0:0:1") {
    return "loopback addresses are not allowed";
  }

  // Check private/reserved IPv4 ranges
  const v4 = bare.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [, a, b, c, d] = v4.map(Number);
    if (a > 255 || b > 255 || c > 255 || d > 255) return "invalid IP address";
    if (a === 127) return "loopback addresses are not allowed";
    if (a === 10) return "private IP ranges are not allowed";
    if (a === 172 && b >= 16 && b <= 31) return "private IP ranges are not allowed";
    if (a === 192 && b === 168) return "private IP ranges are not allowed";
    if (a === 169 && b === 254) return "link-local/cloud-metadata addresses are not allowed";
    if (a === 100 && b >= 64 && b <= 127) return "shared address space (RFC 6598) not allowed";
    if (a === 0) return "invalid IP address";
  }

  return null;
}

// Hard limits applied at the HTTP API layer.
const MAX_BULK = 500;          // max items in any single bulk operation
const MAX_TITLE = 500;         // chars
const MAX_NOTES = 50_000;      // chars (~10 pages)
const MAX_EMOJI = 10;          // grapheme clusters
const MAX_NOTIFY_MSG = 1_000;  // chars
const MAX_REMINDER_MSG = 1_000; // chars

// ── OPTIONS preflight ──────────────────────────────────────────
const PREFLIGHT_PATHS = [
  { path: "/api/tasks", type: "path" },
  { path: "/api/tasks/", type: "prefix" },
  { path: "/api/docs", type: "path" },
  { path: "/api/info", type: "path" },
  { path: "/api/stats", type: "path" },
  { path: "/api/settings", type: "path" },
  { path: "/api/categories", type: "path" },
  { path: "/api/categories/", type: "prefix" },
];

for (const { path, type } of PREFLIGHT_PATHS) {
  http.route({
    ...(type === "path" ? { path } : { pathPrefix: path }),
    method: "OPTIONS",
    handler: httpAction(async () => new Response(null, { status: 204, headers: CORS })),
  } as any);
}

// ── GET /api/docs ──────────────────────────────────────────────
// Full self-documenting reference — no auth required
http.route({
  path: "/api/docs",
  method: "GET",
  handler: httpAction(async () => {
    const now = new Date();
    return json({
      // ── AGENT: READ THIS FIRST ─────────────────────────────────
      agent_quickstart: {
        step1: "GET /api/stats — orient yourself (today's count, overdue, upcoming)",
        step2: "GET /api/tasks?date=YYYY-MM-DD — inspect a specific day",
        step3: "Search before creating: GET /api/tasks?search=keyword to avoid duplicates",
        step4: "For reminders: PATCH /api/settings with { telegram: { webhookUrl: 'https://your-endpoint' } } to receive real-time POSTs instead of polling",
        step5: "For per-block reminders: include blockReminders:[{atTime:'08:45',message:'Start packing!'},{atTime:'08:55',message:'Almost time!'}] when creating/updating a task. atTime is HH:MM local time on the block's date.",
        rule_confirm_destructive: "ALWAYS confirm with the user before bulk-delete, bulk-complete, or deleting recurring series",
        rule_ids: "Task IDs come from the 'id' field in responses. Use them for PATCH/DELETE/complete.",
        rule_dates: "All dates are YYYY-MM-DD. All times are HH:MM (24h). Timezone is set by the user in Settings.",
      },

      name: "Kugi Block Calendar API",
      version: "2.1",
      base_url: "https://<deployment>.convex.site",
      current_date: now.toISOString().slice(0, 10),
      current_time_utc: now.toISOString(),

      authentication: {
        type: "Bearer token",
        header: "Authorization: Bearer <token>",
        how_to_get: "Settings → Developer tab in the Kugi app",
        error_401: "Invalid or missing token",
      },

      // ── TASK SCHEMA ────────────────────────────────────────────
      task_schema: {
        id: "string — use this for all PATCH/DELETE/complete calls",
        title: "string (required on create)",
        date: "string YYYY-MM-DD (required on create)",
        end_date: "string YYYY-MM-DD (optional) — makes block span multiple days",
        emoji: "string (optional)",
        category: "string (optional, default: 'Work') — see GET /api/categories",
        start_time: "string HH:MM (optional) — required for reminders to fire",
        end_time: "string HH:MM (optional)",
        notes: "string (optional)",
        completed: "boolean (default: false)",
        notify_before: "number|null (optional) — push notification offset in minutes. null = off.",
        notify_message: "string (optional) — custom text sent verbatim via Telegram + push, overriding the global template",
        blockReminders: "{ atTime: string (HH:MM), message?: string }[] (optional, max 6) — per-block Telegram reminder schedule. Each entry fires at an exact local time on the block's date. message is sent verbatim if set, otherwise falls back to block notify_message, then global template. Examples: [] = silence this block; [{atTime:'08:45'}] = one reminder at 08:45, default message; [{atTime:'07:00',message:'Start packing!'},{atTime:'08:30',message:'Almost time!'},{atTime:'08:55',message:'Go go go!'}] = three reminders with custom text. undefined/omitted = use global setting.",
        recurrence: "'hourly'|'daily'|'monthly'|'yearly' (optional, write-only on POST) — auto-generates all future occurrences",
        recurrenceGroupId: "string (read-only) — shared ID for a recurring series",
      },

      // ── REMINDERS EXPLAINED ────────────────────────────────────
      reminders_explained: {
        telegram_global: "Global Telegram reminder schedule lives in Settings (GET/PATCH /api/settings). Applied to all blocks that don't have blockReminders set.",
        telegram_per_block: "Set blockReminders on a task to override the global schedule for that block. [] = silence this block. [{atTime:'08:55',message:'Go!'},{atTime:'08:30'}] = two reminders at exact local times, first with custom text, second uses default template.",
        push_global: "Push notification rules live in Settings as push.reminders array. Applied to blocks by offset from start_time.",
        notify_message: "Set notify_message on a task to override the Telegram message template for that specific reminder. Sent verbatim.",
        webhook: "Set telegram.webhookUrl in Settings to receive a POST every time a Telegram reminder fires — no polling needed.",
        timezone: "All scheduling is in the user's IANA timezone (stored in Settings as 'timezone'). Always set start_time when you need reminders.",
      },

      // ── ENDPOINTS ─────────────────────────────────────────────
      endpoints: [
        {
          method: "GET", path: "/api/docs", auth: false,
          description: "This documentation. Call at the start of every session.",
        },
        {
          method: "GET", path: "/api/stats", auth: true,
          description: "Usage counts. Good for orientation.",
          response: "{ today, todayCompleted, thisWeek, thisWeekCompleted, overdue, total, totalCompleted, upcoming7Days }",
        },
        {
          method: "GET", path: "/api/tasks", auth: true,
          description: "List tasks. At least one filter recommended on large calendars.",
          query_params: {
            date: "YYYY-MM-DD — single day",
            from: "YYYY-MM-DD — range start (pair with 'to')",
            to: "YYYY-MM-DD — range end",
            search: "free text — searches title, notes, category, emoji",
            completed: "'true' | 'false'",
          },
          response: "Array of task objects",
        },
        {
          method: "GET", path: "/api/tasks/:id", auth: true,
          description: "Fetch a single task by ID.",
          response: "Task object or 404",
        },
        {
          method: "POST", path: "/api/tasks", auth: true,
          description: "Create a task. Include blockReminders to set per-block reminders with optional custom messages. If recurrence is set, creates all future occurrences.",
          required: ["title", "date"],
          optional: ["emoji", "category", "start_time", "end_time", "notes", "completed", "end_date", "notify_before", "notify_message", "blockReminders", "recurrence"],
          response: "Task object (201), or { created: number } if recurrence was set",
          example: { title: "Flight to NYC", date: "2026-05-15", start_time: "14:00", emoji: "✈️", category: "Travel", blockReminders: [{ atTime: "12:00", message: "Start packing!" }, { atTime: "13:30", message: "Head to the airport." }, { atTime: "13:55", message: "Last call — go!" }] },
        },
        {
          method: "PATCH", path: "/api/tasks/:id", auth: true,
          description: "Partially update a task. Only send fields to change. Rescheduled reminders fire automatically.",
          patchable_fields: ["title", "emoji", "category", "date", "start_time", "end_time", "notes", "completed", "notify_before", "end_date", "notify_message", "blockReminders"],
          note_offsets: "To silence Telegram for this block: PATCH with blockReminders: []. To revert to global setting: omit blockReminders or send null. To update: send the full new blockReminders array with atTime strings.",
          response: "Updated task object",
        },
        {
          method: "DELETE", path: "/api/tasks/:id", auth: true,
          description: "Delete a task.",
          query_params: {
            mode: "'this' (default) | 'future' | 'all' — for recurring series",
            futureDays: "number — with mode=future, limits how many days forward to delete",
          },
          response: "{ ok: true }",
        },
        {
          method: "POST", path: "/api/tasks/:id/complete", auth: true,
          description: "Toggle completion. Cancels pending reminders when completing.",
          response: "Updated task object",
        },
        {
          method: "POST", path: "/api/tasks/bulk", auth: true,
          description: "Create many tasks at once.",
          body: "{ blocks: [ ...task fields... ] }",
          response: "{ created: number }",
        },
        {
          method: "POST", path: "/api/tasks/bulk-complete", auth: true,
          description: "Mark many tasks complete/incomplete. Use 'search' OR 'ids', not both.",
          body: "{ ids?: string[], search?: string, completed?: boolean (default true) }",
          warning: "With 'search', matches ALL blocks across ALL dates. Confirm with user first.",
          response: "{ updated: number }",
        },
        {
          method: "POST", path: "/api/tasks/bulk-delete", auth: true,
          description: "Delete many tasks.",
          body: "{ ids?: string[], search?: string }",
          warning: "With 'search', deletes ALL matching blocks across ALL dates. Irreversible. Confirm with user first.",
          response: "{ deleted: number }",
        },
        {
          method: "POST", path: "/api/tasks/bulk-update", auth: true,
          description: "Patch one field across many tasks.",
          body: "{ ids: string[], fields: { category?, emoji?, completed? } }",
          response: "{ updated: number }",
        },
        {
          method: "GET", path: "/api/categories", auth: true,
          description: "List all categories (8 built-in + custom).",
          response: "{ categories: [{ name, emoji, color, default }] }",
        },
        {
          method: "POST", path: "/api/categories", auth: true,
          description: "Add a custom category.",
          body: "{ name: string (max 50 chars), emoji: string, color: string (hex #rrggbb, e.g. '#4f7cff') }",
          response: "{ ok: true, name }",
        },
        {
          method: "DELETE", path: "/api/categories/:name", auth: true,
          description: "Remove a custom category by name (URL-encode spaces).",
          response: "{ ok: true }",
        },
        {
          method: "GET", path: "/api/settings", auth: true,
          description: "Read configurable settings. Sensitive fields (botToken, chatId, composioApiKey) are write-only and returned as '***' when set.",
          response: "{ telegram: { botToken: '***'|null, chatId: '***'|null, offsetMinutes, reminderOffsets, webhookUrl, messageTemplate, templateVariables }, push: { enabled, reminders }, googleCalendar: { enabled, composioApiKey: '***'|null } }",
        },
        {
          method: "PATCH", path: "/api/settings", auth: true,
          description: "Update any subset of settings. Returns updated settings (sensitive fields masked as '***').",
          body_schema: {
            "telegram.botToken": "string — write-only, not readable back",
            "telegram.chatId": "string — write-only, not readable back",
            "telegram.offsetMinutes": "number — legacy single offset, used as fallback",
            "telegram.reminderOffsets": "number[] (max 4, each 0–10080 minutes) — global default reminder schedule, e.g. [5,15,60]",
            "telegram.webhookUrl": "string — must be HTTPS, loopback addresses rejected. POSTed on every reminder fire.",
            "telegram.messageTemplate": "string — template with {emoji} {title} {time} {date} {notes} {category}",
            "push.enabled": "boolean",
            "push.reminders": "array of { id: string, offsetMinutes: number, atTime?: HH:MM, message?: string }",
            "googleCalendar.enabled": "boolean",
            "googleCalendar.composioApiKey": "string — write-only, not readable back",
          },
          examples: {
            set_webhook: { telegram: { webhookUrl: "https://your-agent.example.com/kugi-webhook" } },
            set_global_reminders: { telegram: { reminderOffsets: [5, 15, 60] } },
            set_template: { telegram: { messageTemplate: "🔔 {emoji}{title}{time}" } },
            set_push_reminders: { push: { reminders: [{ id: "r1", offsetMinutes: 15 }, { id: "r2", offsetMinutes: 60, message: "1 hour to go!" }] } },
          },
        },
      ],

      // ── WEBHOOK ────────────────────────────────────────────────
      webhook: {
        how_to_enable: "PATCH /api/settings with { \"telegram\": { \"webhookUrl\": \"https://your-endpoint\" } }",
        trigger: "Fires once per scheduled reminder. If blockReminders has 3 entries, your endpoint receives 3 POSTs per event. notify_message in the payload is the per-reminder message (if set), otherwise the block-level message, otherwise null.",
        payload: {
          event: "reminder",
          blockId: "<task id>",
          title: "Leave for airport",
          emoji: "✈️",
          date: "2026-05-14",
          start_time: "17:45",
          end_time: null,
          category: "Travel",
          notes: "Terminal 2",
          notify_message: null,
          fired_at: "2026-05-14T15:45:00.000Z",
        },
        idempotency: "fired_at is the UTC ISO timestamp of when the reminder fired. Use blockId + fired_at as a dedup key if needed.",
        errors: "Webhook errors are silently swallowed — Telegram delivery is never blocked by a failing webhook.",
      },

      // ── COMMON MISTAKES ────────────────────────────────────────
      common_mistakes: [
        "Reminders only fire if start_time is set on the block. A block with only a date gets no Telegram/push reminders.",
        "blockReminders overrides the global setting entirely for that block. Set [] to silence all Telegram reminders, omit the field to inherit global setting. Each entry uses atTime (HH:MM local time on the block's date), not an offset.",
        "bulk-complete and bulk-delete with 'search' match ALL dates. Always confirm scope with the user.",
        "Use 'id' field from responses (not '_id') for all operations.",
        "Date format is YYYY-MM-DD. Time format is HH:MM (24h). Wrong formats are rejected with 400.",
        "recurrence is write-only on POST. You cannot change a block's recurrence via PATCH — delete and recreate the series.",
      ],
    });
  }),
});

// ── GET /api/info (deprecated) ─────────────────────────────────
http.route({
  path: "/api/info",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    { const authErr = await authenticate(ctx, req); if (authErr) return authErr; }
    return json({ deprecated: true, message: "Use GET /api/docs instead (no auth required)" });
  }),
});

// ── GET /api/stats ─────────────────────────────────────────────
http.route({
  path: "/api/stats",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    { const authErr = await authenticate(ctx, req); if (authErr) return authErr; }
    const stats = await ctx.runQuery(api.blocks.getStats, {});
    return json(stats);
  }),
});

// ── GET /api/tasks ─────────────────────────────────────────────
http.route({
  path: "/api/tasks",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    { const authErr = await authenticate(ctx, req); if (authErr) return authErr; }
    const url = new URL(req.url);
    const date = url.searchParams.get("date");
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const search = url.searchParams.get("search")?.toLowerCase();
    const completedFilter = url.searchParams.get("completed");

    if (date && !isValidDate(date)) return json({ error: "date must be YYYY-MM-DD" }, 400);
    if (from && !isValidDate(from)) return json({ error: "from must be YYYY-MM-DD" }, 400);
    if (to && !isValidDate(to)) return json({ error: "to must be YYYY-MM-DD" }, 400);

    let tasks: any[] = date
      ? await ctx.runQuery(api.blocks.listByDate, { date })
      : await ctx.runQuery(api.blocks.list, {});

    if (from || to) {
      tasks = tasks.filter(t => {
        if (from && t.date < from) return false;
        if (to && t.date > to) return false;
        return true;
      });
    }
    if (search) {
      tasks = tasks.filter(t =>
        t.title?.toLowerCase().includes(search) ||
        t.notes?.toLowerCase().includes(search) ||
        t.category?.toLowerCase().includes(search) ||
        t.emoji?.includes(search)
      );
    }
    if (completedFilter !== null) {
      const want = completedFilter === "true";
      tasks = tasks.filter(t => t.completed === want);
    }
    return json(tasks.map(normalizeTask));
  }),
});

// ── POST /api/tasks ────────────────────────────────────────────
http.route({
  path: "/api/tasks",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    { const authErr = await authenticate(ctx, req); if (authErr) return authErr; }
    let body: any;
    try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
    if (!body?.title?.trim()) return json({ error: "'title' is required" }, 400);
    if (!body?.date) return json({ error: "'date' is required (YYYY-MM-DD)" }, 400);
    if (!isValidDate(body.date)) return json({ error: "date must be a valid YYYY-MM-DD" }, 400);
    if (body.end_date && !isValidDate(body.end_date)) return json({ error: "end_date must be a valid YYYY-MM-DD" }, 400);
    if (body.start_time && !isValidTime(body.start_time)) return json({ error: "start_time must be HH:MM (00:00–23:59)" }, 400);
    if (body.end_time && !isValidTime(body.end_time)) return json({ error: "end_time must be HH:MM (00:00–23:59)" }, 400);
    if (typeof body.title === "string" && body.title.trim().length > MAX_TITLE) return json({ error: `title must be ${MAX_TITLE} characters or fewer` }, 400);
    if (typeof body.notes === "string" && body.notes.length > MAX_NOTES) return json({ error: `notes must be ${MAX_NOTES} characters or fewer` }, 400);
    if (typeof body.emoji === "string" && [...new Intl.Segmenter().segment(body.emoji)].length > MAX_EMOJI) return json({ error: `emoji must be ${MAX_EMOJI} grapheme clusters or fewer` }, 400);
    if (typeof body.notify_message === "string" && body.notify_message.length > MAX_NOTIFY_MSG) return json({ error: `notify_message must be ${MAX_NOTIFY_MSG} characters or fewer` }, 400);
    if (body.blockReminders !== undefined) {
      const err = validateBlockReminders(body.blockReminders);
      if (err) return json({ error: err }, 400);
    }

    const commonFields = {
      title: String(body.title).trim(),
      emoji: body.emoji ?? undefined,
      category: body.category ?? "Work",
      date: body.date,
      start_time: body.start_time ?? undefined,
      end_time: body.end_time ?? undefined,
      notes: body.notes ?? undefined,
      completed: body.completed ?? false,
      end_date: body.end_date ?? undefined,
      notify_before: body.notify_before ?? undefined,
      notify_message: body.notify_message ?? undefined,
      blockReminders: Array.isArray(body.blockReminders) ? body.blockReminders : undefined,
    };

    if (body.recurrence) {
      const valid = ["hourly", "daily", "monthly", "yearly"];
      if (!valid.includes(body.recurrence)) {
        return json({ error: `recurrence must be one of: ${valid.join(", ")}` }, 400);
      }
      const count = await ctx.runMutation(api.blocks.createRecurring, {
        ...commonFields,
        recurrence: body.recurrence,
      });
      await audit(ctx, "create_recurring", "task", undefined, `recurrence:${body.recurrence} count:${count}`);
      return json({ created: count }, 201);
    }

    const id = await ctx.runMutation(api.blocks.create, commonFields);
    await audit(ctx, "create", "task", String(id));
    const task = await ctx.runQuery(api.blocks.getById, { id });
    return json(normalizeTask(task), 201);
  }),
});

// ── GET /api/tasks/:id ─────────────────────────────────────────
http.route({
  pathPrefix: "/api/tasks/",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    { const authErr = await authenticate(ctx, req); if (authErr) return authErr; }
    const segments = new URL(req.url).pathname.split("/").filter(Boolean);
    const id = segments[2];
    if (!id) return json({ error: "id required" }, 400);
    if (segments[3] === "complete") return json({ error: "Use POST for /complete" }, 405);
    const task = await ctx.runQuery(api.blocks.getById, { id: id as any });
    if (!task) return json({ error: "Not found" }, 404);
    return json(normalizeTask(task));
  }),
});

// ── PATCH /api/tasks/:id ───────────────────────────────────────
const PATCHABLE = new Set(["title","emoji","category","date","start_time","end_time","notes","completed","notify_before","end_date","notify_message","blockReminders"]);

http.route({
  pathPrefix: "/api/tasks/",
  method: "PATCH",
  handler: httpAction(async (ctx, req) => {
    { const authErr = await authenticate(ctx, req); if (authErr) return authErr; }
    const segments = new URL(req.url).pathname.split("/").filter(Boolean);
    const id = segments[2];
    if (!id) return json({ error: "id required" }, 400);
    let body: any;
    try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }

    // Validate
    if (body.date && !isValidDate(body.date)) return json({ error: "date must be a valid YYYY-MM-DD" }, 400);
    if (body.end_date && !isValidDate(body.end_date)) return json({ error: "end_date must be a valid YYYY-MM-DD" }, 400);
    if (body.start_time && !isValidTime(body.start_time)) return json({ error: "start_time must be HH:MM (00:00–23:59)" }, 400);
    if (body.end_time && !isValidTime(body.end_time)) return json({ error: "end_time must be HH:MM (00:00–23:59)" }, 400);
    if (typeof body.title === "string" && body.title.trim().length > MAX_TITLE) return json({ error: `title must be ${MAX_TITLE} characters or fewer` }, 400);
    if (typeof body.notes === "string" && body.notes.length > MAX_NOTES) return json({ error: `notes must be ${MAX_NOTES} characters or fewer` }, 400);
    if (typeof body.notify_message === "string" && body.notify_message.length > MAX_NOTIFY_MSG) return json({ error: `notify_message must be ${MAX_NOTIFY_MSG} characters or fewer` }, 400);
    if (body.blockReminders !== undefined && body.blockReminders !== null) {
      const err = validateBlockReminders(body.blockReminders);
      if (err) return json({ error: err }, 400);
    }

    // Whitelist fields
    const fields: any = {};
    for (const key of Object.keys(body)) {
      if (PATCHABLE.has(key)) fields[key] = body[key];
    }
    // null blockReminders means "revert to global setting" — send undefined
    if (fields.blockReminders === null) fields.blockReminders = undefined;

    if (Object.keys(fields).length === 0) return json({ error: "No patchable fields provided. Allowed: " + [...PATCHABLE].join(", ") }, 400);

    const existing = await ctx.runQuery(api.blocks.getById, { id: id as any });
    if (!existing) return json({ error: "Not found" }, 404);

    await ctx.runMutation(api.blocks.update, { id: id as any, ...fields });
    await audit(ctx, "update", "task", id);
    const updated = await ctx.runQuery(api.blocks.getById, { id: id as any });
    return json(normalizeTask(updated));
  }),
});

// ── DELETE /api/tasks/:id ──────────────────────────────────────
http.route({
  pathPrefix: "/api/tasks/",
  method: "DELETE",
  handler: httpAction(async (ctx, req) => {
    { const authErr = await authenticate(ctx, req); if (authErr) return authErr; }
    const url = new URL(req.url);
    const segments = url.pathname.split("/").filter(Boolean);
    const id = segments[2];
    if (!id) return json({ error: "id required" }, 400);
    const mode = url.searchParams.get("mode") ?? "this";
    if (!["this", "future", "all"].includes(mode)) return json({ error: "mode must be 'this', 'future', or 'all'" }, 400);

    const existing = await ctx.runQuery(api.blocks.getById, { id: id as any });
    if (!existing) return json({ error: "Not found" }, 404);

    if (mode !== "this") {
      let futureDays: number | undefined;
      if (url.searchParams.has("futureDays")) {
        futureDays = parseInt(url.searchParams.get("futureDays")!);
        if (!Number.isInteger(futureDays) || futureDays < 1 || futureDays > 3650) {
          return json({ error: "futureDays must be an integer between 1 and 3650" }, 400);
        }
      }
      await ctx.runMutation(api.blocks.deleteRecurring, { id: id as any, mode: mode as "future" | "all", futureDays });
      await audit(ctx, `delete_recurring_${mode}`, "task", id);
    } else {
      await ctx.runMutation(api.blocks.remove, { id: id as any });
      await audit(ctx, "delete", "task", id);
    }
    return json({ ok: true });
  }),
});

// ── POST /api/tasks/:id/complete ───────────────────────────────
http.route({
  pathPrefix: "/api/tasks/",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    { const authErr = await authenticate(ctx, req); if (authErr) return authErr; }
    const segments = new URL(req.url).pathname.split("/").filter(Boolean);
    const id = segments[2];
    const action = segments[3];
    if (!id) return json({ error: "id required" }, 400);
    if (action !== "complete") return json({ error: "Unknown action. Only POST /api/tasks/:id/complete is supported." }, 400);

    const existing = await ctx.runQuery(api.blocks.getById, { id: id as any });
    if (!existing) return json({ error: "Not found" }, 404);

    await ctx.runMutation(api.blocks.toggleComplete, { id: id as any });
    await audit(ctx, "toggle_complete", "task", id);
    const task = await ctx.runQuery(api.blocks.getById, { id: id as any });
    return json(normalizeTask(task));
  }),
});

// ── GET /api/categories ────────────────────────────────────────
const DEFAULT_CATEGORIES = [
  { name: "Work", emoji: "💼", color: "#4f7cff", default: true },
  { name: "Personal", emoji: "🏠", color: "#10b981", default: true },
  { name: "Health", emoji: "❤️", color: "#ef4444", default: true },
  { name: "Learning", emoji: "📚", color: "#f59e0b", default: true },
  { name: "Creative", emoji: "🎨", color: "#8b5cf6", default: true },
  { name: "Social", emoji: "👥", color: "#ec4899", default: true },
  { name: "Finance", emoji: "💰", color: "#06b6d4", default: true },
  { name: "Other", emoji: "📌", color: "#6b7280", default: true },
];

http.route({
  path: "/api/categories",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    { const authErr = await authenticate(ctx, req); if (authErr) return authErr; }
    const custom = await ctx.runQuery(api.settings.getCustomCategories, {});
    const customList = Object.entries(custom as Record<string, any>).map(([name, v]) => ({
      name, emoji: v.emoji, color: v.color, default: false,
    }));
    return json({ categories: [...DEFAULT_CATEGORIES, ...customList] });
  }),
});

// ── POST /api/categories ───────────────────────────────────────
http.route({
  path: "/api/categories",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    { const authErr = await authenticate(ctx, req); if (authErr) return authErr; }
    let body: any;
    try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
    if (!body?.name?.trim()) return json({ error: "name required" }, 400);
    if (body.name.trim().length > 50) return json({ error: "name must be 50 characters or fewer" }, 400);
    if (!body?.emoji) return json({ error: "emoji required" }, 400);
    if (!body?.color) return json({ error: "color required (hex string, e.g. '#4f7cff')" }, 400);
    if (!/^#[0-9a-fA-F]{6}$/.test(body.color)) return json({ error: "color must be a valid hex color (e.g. '#4f7cff')" }, 400);
    await ctx.runMutation(api.settings.addCategory, { name: body.name.trim(), emoji: body.emoji, color: body.color });
    await audit(ctx, "create", "category", body.name.trim());
    return json({ ok: true, name: body.name.trim() }, 201);
  }),
});

// ── DELETE /api/categories/:name ───────────────────────────────
http.route({
  pathPrefix: "/api/categories/",
  method: "DELETE",
  handler: httpAction(async (ctx, req) => {
    { const authErr = await authenticate(ctx, req); if (authErr) return authErr; }
    const segments = new URL(req.url).pathname.split("/").filter(Boolean);
    const name = decodeURIComponent(segments[2] ?? "");
    if (!name) return json({ error: "name required in path" }, 400);
    await ctx.runMutation(api.settings.removeCategory, { name });
    await audit(ctx, "delete", "category", name);
    return json({ ok: true });
  }),
});

// ── POST /api/tasks/bulk ───────────────────────────────────────
http.route({
  path: "/api/tasks/bulk",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    { const authErr = await authenticate(ctx, req); if (authErr) return authErr; }
    let body: any;
    try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
    if (!Array.isArray(body?.blocks)) return json({ error: "body.blocks must be an array" }, 400);
    if (body.blocks.length === 0) return json({ created: 0 });
    if (body.blocks.length > MAX_BULK) return json({ error: `bulk create is limited to ${MAX_BULK} items per request` }, 400);
    for (let i = 0; i < body.blocks.length; i++) {
      const b = body.blocks[i];
      if (!b?.title?.trim()) return json({ error: `blocks[${i}].title is required` }, 400);
      if (!b?.date || !isValidDate(b.date)) return json({ error: `blocks[${i}].date must be a valid YYYY-MM-DD` }, 400);
      if (b.start_time && !isValidTime(b.start_time)) return json({ error: `blocks[${i}].start_time must be HH:MM (00:00–23:59)` }, 400);
      if (typeof b.title === "string" && b.title.trim().length > MAX_TITLE) return json({ error: `blocks[${i}].title must be ${MAX_TITLE} characters or fewer` }, 400);
      if (typeof b.notes === "string" && b.notes.length > MAX_NOTES) return json({ error: `blocks[${i}].notes must be ${MAX_NOTES} characters or fewer` }, 400);
    }
    const ids = await ctx.runMutation(api.blocks.bulkCreate, { blocks: body.blocks });
    await audit(ctx, "bulk_create", "task", undefined, `count:${ids.length}`);
    return json({ created: ids.length }, 201);
  }),
});

// ── POST /api/tasks/bulk-complete ─────────────────────────────
http.route({
  path: "/api/tasks/bulk-complete",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    { const authErr = await authenticate(ctx, req); if (authErr) return authErr; }
    const url = new URL(req.url);
    let body: any;
    try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
    if (!body?.ids && !body?.search) return json({ error: "Provide either 'ids' array or 'search' string" }, 400);
    if (Array.isArray(body?.ids) && body.ids.length > MAX_BULK) return json({ error: `ids array is limited to ${MAX_BULK} items` }, 400);

    let ids: string[] = body?.ids ?? [];
    if (body?.search) {
      const all: any[] = await ctx.runQuery(api.blocks.list);
      const q = (body.search as string).toLowerCase();
      ids = all.filter(b =>
        b.title?.toLowerCase().includes(q) ||
        b.notes?.toLowerCase().includes(q) ||
        b.category?.toLowerCase().includes(q) ||
        b.emoji?.includes(q)
      ).map(b => b._id);
      if (url.searchParams.get("confirm") !== "true") {
        return json({ error: `Destructive operation requires confirm=true query parameter. This will affect ${ids.length} matching tasks across all dates.` }, 400);
      }
    }
    if (ids.length === 0) return json({ updated: 0 });
    const count = await ctx.runMutation(api.blocks.bulkComplete, { ids, completed: body.completed ?? true });
    await audit(ctx, "bulk_complete", "task", undefined, `count:${count}`);
    return json({ updated: count });
  }),
});

// ── POST /api/tasks/bulk-delete ───────────────────────────────
http.route({
  path: "/api/tasks/bulk-delete",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    { const authErr = await authenticate(ctx, req); if (authErr) return authErr; }
    const url = new URL(req.url);
    let body: any;
    try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
    if (!body?.ids && !body?.search) return json({ error: "Provide either 'ids' array or 'search' string" }, 400);
    if (Array.isArray(body?.ids) && body.ids.length > MAX_BULK) return json({ error: `ids array is limited to ${MAX_BULK} items` }, 400);

    let ids: string[] = body?.ids ?? [];
    if (body?.search) {
      const all: any[] = await ctx.runQuery(api.blocks.list);
      const q = (body.search as string).toLowerCase();
      ids = all.filter(b =>
        b.title?.toLowerCase().includes(q) ||
        b.notes?.toLowerCase().includes(q) ||
        b.category?.toLowerCase().includes(q) ||
        b.emoji?.includes(q)
      ).map(b => b._id);
      if (url.searchParams.get("confirm") !== "true") {
        return json({ error: `Destructive operation requires confirm=true query parameter. This will affect ${ids.length} matching tasks across all dates.` }, 400);
      }
    }
    if (ids.length === 0) return json({ deleted: 0 });
    const count = await ctx.runMutation(api.blocks.bulkDelete, { ids });
    await audit(ctx, "bulk_delete", "task", undefined, `count:${count}`);
    return json({ deleted: count });
  }),
});

// ── POST /api/tasks/bulk-update ───────────────────────────────
http.route({
  path: "/api/tasks/bulk-update",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    { const authErr = await authenticate(ctx, req); if (authErr) return authErr; }
    let body: any;
    try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
    if (!Array.isArray(body?.ids) || body.ids.length === 0) return json({ error: "body.ids must be a non-empty array" }, 400);
    if (body.ids.length > MAX_BULK) return json({ error: `ids array is limited to ${MAX_BULK} items` }, 400);
    if (!body?.fields || typeof body.fields !== "object" || Array.isArray(body.fields)) return json({ error: "body.fields object required" }, 400);
    const BULK_UPDATE_FIELDS = new Set(["category", "completed", "emoji"]);
    const unknownFields = Object.keys(body.fields).filter(k => !BULK_UPDATE_FIELDS.has(k));
    if (unknownFields.length > 0) return json({ error: `Unknown fields: ${unknownFields.join(", ")}. Allowed: ${[...BULK_UPDATE_FIELDS].join(", ")}` }, 400);
    if (typeof body.fields.category === "string" && body.fields.category.length > 100) return json({ error: "category must be 100 characters or fewer" }, 400);
    const count = await ctx.runMutation(api.blocks.bulkUpdate, { ids: body.ids, fields: body.fields });
    await audit(ctx, "bulk_update", "task", undefined, `count:${count}`);
    return json({ updated: count });
  }),
});

// ── GET /api/settings ─────────────────────────────────────────
http.route({
  path: "/api/settings",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    { const authErr = await authenticate(ctx, req); if (authErr) return authErr; }
    const telegram = await ctx.runQuery(api.settings.getTelegramConfig, {});
    const telegramTemplate = await ctx.runQuery(api.settings.getTelegramTemplate, {});
    const pushEnabled = await ctx.runQuery(api.settings.getPushEnabled, {});
    const gcalEnabled = await ctx.runQuery(api.settings.getIntegrationEnabled, { integration: "googleCalendar" });
    const composioApiKey = await ctx.runQuery(api.settings.getComposioApiKey, {});
    const remindersJson = await ctx.runQuery(api.settings.getReminders, {});
    return json({
      telegram: {
        botToken: mask(telegram.botToken),
        chatId: mask(telegram.chatId),
        offsetMinutes: telegram.offsetMinutes,
        reminderOffsets: telegram.reminderOffsets ?? null,
        webhookUrl: telegram.webhookUrl ?? null,
        messageTemplate: telegramTemplate ?? "⏰ Reminder: {emoji}<b>{title}</b>{time}{notes}",
        templateVariables: ["{emoji}", "{title}", "{time}", "{date}", "{notes}", "{category}"],
        note: "reminderOffsets overrides offsetMinutes when set. null reminderOffsets = fall back to [offsetMinutes]. botToken and chatId are write-only and returned as '***'.",
      },
      push: {
        enabled: pushEnabled,
        reminders: remindersJson ?? [],
      },
      googleCalendar: {
        enabled: gcalEnabled,
        composioApiKey: mask(composioApiKey),
      },
    });
  }),
});

// ── PATCH /api/settings ────────────────────────────────────────
http.route({
  path: "/api/settings",
  method: "PATCH",
  handler: httpAction(async (ctx, req) => {
    { const authErr = await authenticate(ctx, req); if (authErr) return authErr; }
    let body: any;
    try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }

    if (body?.telegram) {
      if (body.telegram.reminderOffsets !== undefined) {
        const err = validateOffsets(body.telegram.reminderOffsets);
        if (err) return json({ error: `telegram.reminderOffsets: ${err}` }, 400);
      }
      if (body.telegram.webhookUrl !== undefined && body.telegram.webhookUrl !== null && body.telegram.webhookUrl !== "") {
        const urlErr = validateWebhookUrl(body.telegram.webhookUrl);
        if (urlErr) return json({ error: `telegram.webhookUrl: ${urlErr}` }, 400);
      }
      const current = await ctx.runQuery(api.settings.getTelegramConfig, {});
      const resolvedWebhookUrl = body.telegram.webhookUrl === undefined
        ? (current.webhookUrl ?? undefined)
        : (body.telegram.webhookUrl === null || body.telegram.webhookUrl === "" ? undefined : body.telegram.webhookUrl);
      await ctx.runMutation(api.settings.setTelegramConfig, {
        botToken: body.telegram.botToken ?? current.botToken ?? "",
        chatId: body.telegram.chatId ?? current.chatId ?? "",
        offsetMinutes: body.telegram.offsetMinutes ?? current.offsetMinutes ?? 15,
        reminderOffsets: body.telegram.reminderOffsets !== undefined ? body.telegram.reminderOffsets : (current.reminderOffsets ?? undefined),
        webhookUrl: resolvedWebhookUrl,
      });
      if (body.telegram.messageTemplate !== undefined) {
        await ctx.runMutation(api.settings.setTelegramTemplate, { template: body.telegram.messageTemplate });
      }
    }

    if (body?.push?.enabled !== undefined) {
      await ctx.runMutation(api.settings.setPushEnabled, { enabled: !!body.push.enabled });
    }

    if (body?.push?.reminders !== undefined) {
      if (!Array.isArray(body.push.reminders)) return json({ error: "push.reminders must be an array" }, 400);
      await ctx.runMutation(api.settings.setReminders, { value: JSON.stringify(body.push.reminders) });
    }

    if (body?.googleCalendar?.enabled !== undefined) {
      await ctx.runMutation(api.settings.setIntegrationEnabled, {
        integration: "googleCalendar",
        enabled: !!body.googleCalendar.enabled,
      });
    }

    if (body?.googleCalendar?.composioApiKey !== undefined) {
      await ctx.runMutation(api.settings.setComposioApiKey, { value: body.googleCalendar.composioApiKey });
    }

    await audit(ctx, "update", "settings", undefined, `keys:${Object.keys(body ?? {}).join(",")}`);
    // Return updated settings so caller can confirm
    const telegram = await ctx.runQuery(api.settings.getTelegramConfig, {});
    const telegramTemplate = await ctx.runQuery(api.settings.getTelegramTemplate, {});
    const pushEnabled = await ctx.runQuery(api.settings.getPushEnabled, {});
    const gcalEnabled = await ctx.runQuery(api.settings.getIntegrationEnabled, { integration: "googleCalendar" });
    const remindersJson = await ctx.runQuery(api.settings.getReminders, {});
    return json({
      ok: true,
      updated: {
        telegram: {
          botToken: mask(telegram.botToken),
          chatId: mask(telegram.chatId),
          offsetMinutes: telegram.offsetMinutes,
          reminderOffsets: telegram.reminderOffsets ?? null,
          webhookUrl: telegram.webhookUrl ?? null,
          messageTemplate: telegramTemplate ?? "⏰ Reminder: {emoji}<b>{title}</b>{time}{notes}",
        },
        push: { enabled: pushEnabled, reminders: remindersJson ?? [] },
        googleCalendar: { enabled: gcalEnabled },
      },
    });
  }),
});

// ── POST /telegram/webhook ─────────────────────────────────────
// Called by Telegram when the user taps an inline keyboard button.
// Verified via the X-Telegram-Bot-Api-Secret-Token header.
http.route({
  path: "/telegram/webhook",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const secret = await ctx.runQuery(internal.settings.getSettingValue, { key: "telegramWebhookSecret" });
    if (!secret) return new Response("Not configured", { status: 503 });
    const incoming = req.headers.get("X-Telegram-Bot-Api-Secret-Token") ?? "";
    // Constant-time comparison to prevent timing oracle
    if (!constantTimeEqual(incoming, secret)) return new Response("Unauthorized", { status: 401 });

    let body: any;
    try { body = await req.json(); } catch { return new Response("Bad JSON", { status: 400 }); }

    const cq = body?.callback_query;
    if (!cq) return new Response("OK", { status: 200 }); // not a callback query

    const callbackQueryId: string = cq.id;
    const data: string = cq.data ?? "";
    const messageId: number | undefined = cq.message?.message_id;
    const chatId: number | undefined = cq.message?.chat?.id;

    const colon = data.indexOf(":");
    if (colon === -1) return new Response("OK", { status: 200 });
    const action = data.slice(0, colon);
    const blockId = data.slice(colon + 1);

    const botToken = await ctx.runQuery(internal.settings.getSettingValue, { key: "telegramBotToken" });
    if (!botToken) return new Response("OK", { status: 200 });

    let alertText = "";
    try {
      if (action === "d") {
        const block = await ctx.runQuery(api.blocks.getById, { id: blockId as any });
        if (block) {
          await ctx.runMutation(api.blocks.toggleComplete, { id: blockId as any });
          alertText = block.completed ? "Marked as undone ↩" : "Done! ✅";
        }
      } else if (action === "s30" || action === "s60") {
        const mins = action === "s30" ? 30 : 60;
        const block = await ctx.runQuery(api.blocks.getById, { id: blockId as any });
        if (block?.start_time) {
          const [hStr, mStr] = block.start_time.split(":");
          const newMins = parseInt(hStr) * 60 + parseInt(mStr) + mins;
          if (newMins < 1440) {
            const newH = Math.floor(newMins / 60);
            const newM = newMins % 60;
            const newTime = `${String(newH).padStart(2, "0")}:${String(newM).padStart(2, "0")}`;
            const updates: any = { id: blockId as any, start_time: newTime };
            if (block.end_time) {
              const [ehStr, emStr] = block.end_time.split(":");
              const newEndMins = parseInt(ehStr) * 60 + parseInt(emStr) + mins;
              if (newEndMins < 1440) {
                updates.end_time = `${String(Math.floor(newEndMins / 60)).padStart(2, "0")}:${String(newEndMins % 60).padStart(2, "0")}`;
              }
            }
            await ctx.runMutation(api.blocks.update, updates);
            alertText = `Snoozed to ${newTime} ⏰`;
          }
        }
      } else if (action === "tom") {
        const block = await ctx.runQuery(api.blocks.getById, { id: blockId as any });
        if (block?.date) {
          const [y, mo, d] = block.date.split("-").map(Number);
          const dt = new Date(Date.UTC(y, mo - 1, d));
          dt.setUTCDate(dt.getUTCDate() + 1);
          const newDate = dt.toISOString().slice(0, 10);
          await ctx.runMutation(api.blocks.update, { id: blockId as any, date: newDate });
          alertText = "Moved to tomorrow 📅";
        }
      }
    } catch {}

    // Answer callback query — required by Telegram (must happen within 10s)
    try {
      await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callback_query_id: callbackQueryId, text: alertText, show_alert: false }),
      });
    } catch {}

    // Remove inline keyboard after action is taken
    if (messageId !== undefined && chatId !== undefined) {
      try {
        await fetch(`https://api.telegram.org/bot${botToken}/editMessageReplyMarkup`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: [] } }),
        });
      } catch {}
    }

    return new Response("OK", { status: 200 });
  }),
});

// ── OPTIONS /telegram/register-webhook ────────────────────────
http.route({
  path: "/telegram/register-webhook",
  method: "OPTIONS",
  handler: httpAction(async () => new Response(null, { status: 204, headers: CORS })),
});

// ── POST /telegram/register-webhook ───────────────────────────
// Registers the Convex site URL as the Telegram bot webhook.
// Requires Bearer auth (API key). Generates and stores the webhook secret.
http.route({
  path: "/telegram/register-webhook",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    { const authErr = await authenticate(ctx, req); if (authErr) return authErr; }

    const botToken = await ctx.runQuery(internal.settings.getSettingValue, { key: "telegramBotToken" });
    if (!botToken) return json({ error: "Telegram bot token not configured" }, 400, req);

    // Generate a fresh webhook secret
    const secret = crypto.randomUUID().replace(/-/g, "");
    await ctx.runMutation(internal.settings.upsertSetting, { key: "telegramWebhookSecret", value: secret });

    const webhookUrl = `${new URL(req.url).origin}/telegram/webhook`;
    let tgRes: any;
    try {
      const res = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: webhookUrl,
          secret_token: secret,
          allowed_updates: ["callback_query"],
          drop_pending_updates: true,
        }),
      });
      tgRes = await res.json();
    } catch (e: any) {
      return json({ error: "Failed to reach Telegram API", detail: String(e?.message ?? e) }, 502, req);
    }

    if (!tgRes?.ok) {
      return json({ error: "Telegram rejected webhook registration", detail: tgRes?.description ?? tgRes }, 400, req);
    }

    return json({ ok: true, webhook_url: webhookUrl }, 200, req);
  }),
});

export default http;
