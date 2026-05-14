import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";

const http = httpRouter();

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

async function authenticate(ctx: any, req: Request): Promise<boolean> {
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return false;
  const token = auth.slice(7);
  const storedKey = await ctx.runQuery(api.settings.getApiKey, {});
  return storedKey !== null && storedKey === token;
}

// Normalize a raw Convex block for API consumers:
// - exposes `id` (not `_id`)
// - strips internal scheduling fields
function normalizeTask(t: any) {
  if (!t) return t;
  const { _id, _creationTime, telegramJobId, telegramJobIds, ...rest } = t;
  return { id: _id, ...rest };
}

// Validate YYYY-MM-DD
function isValidDate(s: any): boolean {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

// Validate HH:MM
function isValidTime(s: any): boolean {
  return typeof s === "string" && /^\d{2}:\d{2}$/.test(s);
}

// Validate blockReminders: array of {offsetMinutes, message?}, max 6 entries
function validateBlockReminders(v: any): string | null {
  if (!Array.isArray(v)) return "blockReminders must be an array";
  if (v.length > 6) return "blockReminders max length is 6";
  for (let i = 0; i < v.length; i++) {
    const r = v[i];
    if (typeof r !== "object" || r === null) return `blockReminders[${i}] must be an object`;
    if (typeof r.offsetMinutes !== "number" || r.offsetMinutes < 0) return `blockReminders[${i}].offsetMinutes must be a non-negative number`;
    if (r.message !== undefined && typeof r.message !== "string") return `blockReminders[${i}].message must be a string`;
  }
  return null;
}

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
        step5: "For per-block reminders: include blockReminders:[{offsetMinutes:15,message:'Start packing!'},{offsetMinutes:5,message:'Almost time!'}] when creating/updating a task",
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
        blockReminders: "{ offsetMinutes: number, message?: string }[] (optional, max 6) — per-block Telegram reminder schedule. Each entry fires one reminder. message is sent verbatim if set, otherwise falls back to block notify_message, then global template. Examples: [] = silence this block; [{offsetMinutes:15}] = one reminder, default message; [{offsetMinutes:60,message:'Start packing!'},{offsetMinutes:15,message:'Almost time!'},{offsetMinutes:5,message:'Go go go!'}] = three reminders with custom text. undefined/omitted = use global setting.",
        recurrence: "'hourly'|'daily'|'monthly'|'yearly' (optional, write-only on POST) — auto-generates all future occurrences",
        recurrenceGroupId: "string (read-only) — shared ID for a recurring series",
      },

      // ── REMINDERS EXPLAINED ────────────────────────────────────
      reminders_explained: {
        telegram_global: "Global Telegram reminder schedule lives in Settings (GET/PATCH /api/settings). Applied to all blocks that don't have blockReminders set.",
        telegram_per_block: "Set blockReminders on a task to override the global schedule for that block. [] = silence this block. [{offsetMinutes:5,message:'Go!'},{offsetMinutes:30}] = two reminders, first with custom text, second uses default template.",
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
          example: { title: "Flight to NYC", date: "2026-05-15", start_time: "14:00", emoji: "✈️", category: "Travel", blockReminders: [{ offsetMinutes: 120, message: "Start packing!" }, { offsetMinutes: 30, message: "Head to the airport." }, { offsetMinutes: 5, message: "Last call — go!" }] },
        },
        {
          method: "PATCH", path: "/api/tasks/:id", auth: true,
          description: "Partially update a task. Only send fields to change. Rescheduled reminders fire automatically.",
          patchable_fields: ["title", "emoji", "category", "date", "start_time", "end_time", "notes", "completed", "notify_before", "end_date", "notify_message", "blockReminders"],
          note_offsets: "To silence Telegram for this block: PATCH with blockReminders: []. To revert to global setting: omit blockReminders or send null. To update messages: send the full new blockReminders array.",
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
          body: "{ name: string, emoji: string, color: string (hex) }",
          response: "{ ok: true, name }",
        },
        {
          method: "DELETE", path: "/api/categories/:name", auth: true,
          description: "Remove a custom category by name (URL-encode spaces).",
          response: "{ ok: true }",
        },
        {
          method: "GET", path: "/api/settings", auth: true,
          description: "Read all configurable settings including Telegram config, webhookUrl, reminderOffsets, push rules.",
          response: "{ telegram: { botToken, chatId, offsetMinutes, reminderOffsets, webhookUrl, messageTemplate, templateVariables }, push: { enabled, reminders }, googleCalendar: { enabled, composioApiKey } }",
        },
        {
          method: "PATCH", path: "/api/settings", auth: true,
          description: "Update any subset of settings. Returns updated settings.",
          body_schema: {
            "telegram.botToken": "string",
            "telegram.chatId": "string",
            "telegram.offsetMinutes": "number — legacy single offset, used as fallback",
            "telegram.reminderOffsets": "number[] (max 4) — global default reminder schedule, e.g. [5,15,60]",
            "telegram.webhookUrl": "string — URL POSTed on every reminder fire. Set this for real-time agent integration.",
            "telegram.messageTemplate": "string — template with {emoji} {title} {time} {date} {notes} {category}",
            "push.enabled": "boolean",
            "push.reminders": "array of { id: string, offsetMinutes: number, atTime?: HH:MM, message?: string }",
            "googleCalendar.enabled": "boolean",
            "googleCalendar.composioApiKey": "string",
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
        "blockReminders overrides the global setting entirely for that block. Set [] to silence all Telegram reminders, omit the field to inherit global setting.",
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
    if (!(await authenticate(ctx, req))) return json({ error: "Unauthorized" }, 401);
    return json({ deprecated: true, message: "Use GET /api/docs instead (no auth required)" });
  }),
});

// ── GET /api/stats ─────────────────────────────────────────────
http.route({
  path: "/api/stats",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    if (!(await authenticate(ctx, req))) return json({ error: "Unauthorized" }, 401);
    const stats = await ctx.runQuery(api.blocks.getStats, {});
    return json(stats);
  }),
});

// ── GET /api/tasks ─────────────────────────────────────────────
http.route({
  path: "/api/tasks",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    if (!(await authenticate(ctx, req))) return json({ error: "Unauthorized" }, 401);
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
    if (!(await authenticate(ctx, req))) return json({ error: "Unauthorized" }, 401);
    let body: any;
    try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
    if (!body?.title?.trim()) return json({ error: "'title' is required" }, 400);
    if (!body?.date) return json({ error: "'date' is required (YYYY-MM-DD)" }, 400);
    if (!isValidDate(body.date)) return json({ error: "date must be YYYY-MM-DD" }, 400);
    if (body.end_date && !isValidDate(body.end_date)) return json({ error: "end_date must be YYYY-MM-DD" }, 400);
    if (body.start_time && !isValidTime(body.start_time)) return json({ error: "start_time must be HH:MM" }, 400);
    if (body.end_time && !isValidTime(body.end_time)) return json({ error: "end_time must be HH:MM" }, 400);
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
      return json({ created: count }, 201);
    }

    const id = await ctx.runMutation(api.blocks.create, commonFields);
    const task = await ctx.runQuery(api.blocks.getById, { id });
    return json(normalizeTask(task), 201);
  }),
});

// ── GET /api/tasks/:id ─────────────────────────────────────────
http.route({
  pathPrefix: "/api/tasks/",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    if (!(await authenticate(ctx, req))) return json({ error: "Unauthorized" }, 401);
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
    if (!(await authenticate(ctx, req))) return json({ error: "Unauthorized" }, 401);
    const segments = new URL(req.url).pathname.split("/").filter(Boolean);
    const id = segments[2];
    if (!id) return json({ error: "id required" }, 400);
    let body: any;
    try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }

    // Validate
    if (body.date && !isValidDate(body.date)) return json({ error: "date must be YYYY-MM-DD" }, 400);
    if (body.end_date && !isValidDate(body.end_date)) return json({ error: "end_date must be YYYY-MM-DD" }, 400);
    if (body.start_time && !isValidTime(body.start_time)) return json({ error: "start_time must be HH:MM" }, 400);
    if (body.end_time && !isValidTime(body.end_time)) return json({ error: "end_time must be HH:MM" }, 400);
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
    const updated = await ctx.runQuery(api.blocks.getById, { id: id as any });
    return json(normalizeTask(updated));
  }),
});

// ── DELETE /api/tasks/:id ──────────────────────────────────────
http.route({
  pathPrefix: "/api/tasks/",
  method: "DELETE",
  handler: httpAction(async (ctx, req) => {
    if (!(await authenticate(ctx, req))) return json({ error: "Unauthorized" }, 401);
    const url = new URL(req.url);
    const segments = url.pathname.split("/").filter(Boolean);
    const id = segments[2];
    if (!id) return json({ error: "id required" }, 400);
    const mode = url.searchParams.get("mode") ?? "this";
    if (!["this", "future", "all"].includes(mode)) return json({ error: "mode must be 'this', 'future', or 'all'" }, 400);

    const existing = await ctx.runQuery(api.blocks.getById, { id: id as any });
    if (!existing) return json({ error: "Not found" }, 404);

    if (mode !== "this") {
      const futureDays = url.searchParams.has("futureDays")
        ? parseInt(url.searchParams.get("futureDays")!)
        : undefined;
      await ctx.runMutation(api.blocks.deleteRecurring, { id: id as any, mode: mode as "future" | "all", futureDays });
    } else {
      await ctx.runMutation(api.blocks.remove, { id: id as any });
    }
    return json({ ok: true });
  }),
});

// ── POST /api/tasks/:id/complete ───────────────────────────────
http.route({
  pathPrefix: "/api/tasks/",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    if (!(await authenticate(ctx, req))) return json({ error: "Unauthorized" }, 401);
    const segments = new URL(req.url).pathname.split("/").filter(Boolean);
    const id = segments[2];
    const action = segments[3];
    if (!id) return json({ error: "id required" }, 400);
    if (action !== "complete") return json({ error: "Unknown action. Only POST /api/tasks/:id/complete is supported." }, 400);

    const existing = await ctx.runQuery(api.blocks.getById, { id: id as any });
    if (!existing) return json({ error: "Not found" }, 404);

    await ctx.runMutation(api.blocks.toggleComplete, { id: id as any });
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
    if (!(await authenticate(ctx, req))) return json({ error: "Unauthorized" }, 401);
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
    if (!(await authenticate(ctx, req))) return json({ error: "Unauthorized" }, 401);
    let body: any;
    try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
    if (!body?.name?.trim()) return json({ error: "name required" }, 400);
    if (!body?.emoji) return json({ error: "emoji required" }, 400);
    if (!body?.color) return json({ error: "color required (hex string, e.g. '#4f7cff')" }, 400);
    await ctx.runMutation(api.settings.addCategory, { name: body.name.trim(), emoji: body.emoji, color: body.color });
    return json({ ok: true, name: body.name.trim() }, 201);
  }),
});

// ── DELETE /api/categories/:name ───────────────────────────────
http.route({
  pathPrefix: "/api/categories/",
  method: "DELETE",
  handler: httpAction(async (ctx, req) => {
    if (!(await authenticate(ctx, req))) return json({ error: "Unauthorized" }, 401);
    const segments = new URL(req.url).pathname.split("/").filter(Boolean);
    const name = decodeURIComponent(segments[2] ?? "");
    if (!name) return json({ error: "name required in path" }, 400);
    await ctx.runMutation(api.settings.removeCategory, { name });
    return json({ ok: true });
  }),
});

// ── POST /api/tasks/bulk ───────────────────────────────────────
http.route({
  path: "/api/tasks/bulk",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    if (!(await authenticate(ctx, req))) return json({ error: "Unauthorized" }, 401);
    let body: any;
    try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
    if (!Array.isArray(body?.blocks)) return json({ error: "body.blocks must be an array" }, 400);
    if (body.blocks.length === 0) return json({ created: 0 });
    // Validate each block minimally
    for (let i = 0; i < body.blocks.length; i++) {
      const b = body.blocks[i];
      if (!b?.title?.trim()) return json({ error: `blocks[${i}].title is required` }, 400);
      if (!b?.date || !isValidDate(b.date)) return json({ error: `blocks[${i}].date must be YYYY-MM-DD` }, 400);
      if (b.start_time && !isValidTime(b.start_time)) return json({ error: `blocks[${i}].start_time must be HH:MM` }, 400);
    }
    const ids = await ctx.runMutation(api.blocks.bulkCreate, { blocks: body.blocks });
    return json({ created: ids.length }, 201);
  }),
});

// ── POST /api/tasks/bulk-complete ─────────────────────────────
http.route({
  path: "/api/tasks/bulk-complete",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    if (!(await authenticate(ctx, req))) return json({ error: "Unauthorized" }, 401);
    let body: any;
    try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
    if (!body?.ids && !body?.search) return json({ error: "Provide either 'ids' array or 'search' string" }, 400);

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
    }
    if (ids.length === 0) return json({ updated: 0 });
    const count = await ctx.runMutation(api.blocks.bulkComplete, { ids, completed: body.completed ?? true });
    return json({ updated: count });
  }),
});

// ── POST /api/tasks/bulk-delete ───────────────────────────────
http.route({
  path: "/api/tasks/bulk-delete",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    if (!(await authenticate(ctx, req))) return json({ error: "Unauthorized" }, 401);
    let body: any;
    try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
    if (!body?.ids && !body?.search) return json({ error: "Provide either 'ids' array or 'search' string" }, 400);

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
    }
    if (ids.length === 0) return json({ deleted: 0 });
    const count = await ctx.runMutation(api.blocks.bulkDelete, { ids });
    return json({ deleted: count });
  }),
});

// ── POST /api/tasks/bulk-update ───────────────────────────────
http.route({
  path: "/api/tasks/bulk-update",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    if (!(await authenticate(ctx, req))) return json({ error: "Unauthorized" }, 401);
    let body: any;
    try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
    if (!Array.isArray(body?.ids) || body.ids.length === 0) return json({ error: "body.ids must be a non-empty array" }, 400);
    if (!body?.fields || typeof body.fields !== "object") return json({ error: "body.fields object required" }, 400);
    const count = await ctx.runMutation(api.blocks.bulkUpdate, { ids: body.ids, fields: body.fields });
    return json({ updated: count });
  }),
});

// ── GET /api/settings ─────────────────────────────────────────
http.route({
  path: "/api/settings",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    if (!(await authenticate(ctx, req))) return json({ error: "Unauthorized" }, 401);
    const telegram = await ctx.runQuery(api.settings.getTelegramConfig, {});
    const telegramTemplate = await ctx.runQuery(api.settings.getTelegramTemplate, {});
    const pushEnabled = await ctx.runQuery(api.settings.getPushEnabled, {});
    const gcalEnabled = await ctx.runQuery(api.settings.getIntegrationEnabled, { integration: "googleCalendar" });
    const composioApiKey = await ctx.runQuery(api.settings.getComposioApiKey, {});
    const remindersJson = await ctx.runQuery(api.settings.getReminders, {});
    return json({
      telegram: {
        botToken: telegram.botToken,
        chatId: telegram.chatId,
        offsetMinutes: telegram.offsetMinutes,
        reminderOffsets: telegram.reminderOffsets ?? null,
        webhookUrl: telegram.webhookUrl ?? null,
        messageTemplate: telegramTemplate ?? "⏰ Reminder: {emoji}<b>{title}</b>{time}{notes}",
        templateVariables: ["{emoji}", "{title}", "{time}", "{date}", "{notes}", "{category}"],
        note: "reminderOffsets overrides offsetMinutes when set. null reminderOffsets = fall back to [offsetMinutes].",
      },
      push: {
        enabled: pushEnabled,
        reminders: remindersJson ?? [],
      },
      googleCalendar: {
        enabled: gcalEnabled,
        composioApiKey: composioApiKey ?? null,
      },
    });
  }),
});

// ── PATCH /api/settings ────────────────────────────────────────
http.route({
  path: "/api/settings",
  method: "PATCH",
  handler: httpAction(async (ctx, req) => {
    if (!(await authenticate(ctx, req))) return json({ error: "Unauthorized" }, 401);
    let body: any;
    try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }

    if (body?.telegram) {
      if (body.telegram.reminderOffsets !== undefined) {
        const err = validateOffsets(body.telegram.reminderOffsets);
        if (err) return json({ error: `telegram.reminderOffsets: ${err}` }, 400);
      }
      const current = await ctx.runQuery(api.settings.getTelegramConfig, {});
      await ctx.runMutation(api.settings.setTelegramConfig, {
        botToken: body.telegram.botToken ?? current.botToken ?? "",
        chatId: body.telegram.chatId ?? current.chatId ?? "",
        offsetMinutes: body.telegram.offsetMinutes ?? current.offsetMinutes ?? 15,
        reminderOffsets: body.telegram.reminderOffsets !== undefined ? body.telegram.reminderOffsets : (current.reminderOffsets ?? undefined),
        webhookUrl: body.telegram.webhookUrl !== undefined ? body.telegram.webhookUrl : (current.webhookUrl ?? undefined),
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
          botToken: telegram.botToken,
          chatId: telegram.chatId,
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

export default http;
