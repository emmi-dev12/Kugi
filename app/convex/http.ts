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

// ── OPTIONS preflight ──────────────────────────────────────────
http.route({
  path: "/api/tasks",
  method: "OPTIONS",
  handler: httpAction(async () => new Response(null, { status: 204, headers: CORS })),
});
http.route({
  pathPrefix: "/api/tasks/",
  method: "OPTIONS",
  handler: httpAction(async () => new Response(null, { status: 204, headers: CORS })),
});
http.route({
  path: "/api/info",
  method: "OPTIONS",
  handler: httpAction(async () => new Response(null, { status: 204, headers: CORS })),
});
http.route({
  path: "/api/docs",
  method: "OPTIONS",
  handler: httpAction(async () => new Response(null, { status: 204, headers: CORS })),
});

// ── GET /api/docs ──────────────────────────────────────────────
// Comprehensive self-documenting endpoint — no auth required
http.route({
  path: "/api/docs",
  method: "GET",
  handler: httpAction(async () => {
    return json({
      name: "Kugi Block Calendar API",
      version: "2.0",
      description: "Personal block calendar API. Blocks are time-boxed tasks with optional recurrence and reminders.",
      authentication: {
        type: "Bearer token",
        header: "Authorization: Bearer <token>",
        note: "Get your API token from Settings → Developer in the Kugi app",
      },
      current_date: new Date().toISOString().slice(0, 10),
      block_schema: {
        id: "string — Convex document ID",
        title: "string (required)",
        date: "string (required) — YYYY-MM-DD",
        end_date: "string (optional) — YYYY-MM-DD, makes block span multiple days",
        emoji: "string (optional)",
        category: "string (optional, default: 'Work')",
        start_time: "string (optional) — HH:MM",
        end_time: "string (optional) — HH:MM",
        notes: "string (optional)",
        completed: "boolean (optional, default: false)",
        notify_before: "number (optional) — minutes before start_time to send reminders",
        recurrence: "string (optional) — 'hourly' | 'daily' | 'monthly' | 'yearly'. When set on POST, generates all future occurrences automatically.",
        recurrenceGroupId: "string (optional, read-only) — shared ID linking all blocks in a recurring series",
      },
      endpoints: [
        {
          method: "GET", path: "/api/docs",
          auth: false,
          description: "This documentation. No auth required.",
        },
        {
          method: "GET", path: "/api/info",
          auth: true,
          description: "Schema + today's date. Deprecated in favour of /api/docs.",
        },
        {
          method: "GET", path: "/api/tasks",
          auth: true,
          description: "List blocks.",
          query_params: {
            date: "YYYY-MM-DD — filter to one day",
            from: "YYYY-MM-DD — range start (use with 'to')",
            to: "YYYY-MM-DD — range end (use with 'from')",
            search: "text — full-text search across title, notes, category",
            completed: "true | false — filter by completion status",
          },
        },
        {
          method: "GET", path: "/api/tasks/:id",
          auth: true,
          description: "Get a single block by ID.",
        },
        {
          method: "POST", path: "/api/tasks",
          auth: true,
          description: "Create a block. If 'recurrence' is set, generates all future occurrences and returns { created: number }. Otherwise returns the full block object.",
          required_fields: ["title", "date"],
        },
        {
          method: "PATCH", path: "/api/tasks/:id",
          auth: true,
          description: "Partially update a block. Only send fields to change. Returns full block.",
        },
        {
          method: "DELETE", path: "/api/tasks/:id",
          auth: true,
          description: "Delete a block.",
        },
        {
          method: "POST", path: "/api/tasks/:id/complete",
          auth: true,
          description: "Toggle a block's completion status. Returns full block.",
        },
      ],
      agent_instructions: "Call GET /api/docs at the start of each session to get this reference. Use GET /api/tasks?date=YYYY-MM-DD to check a specific day. Search before creating to avoid duplicates. For recurring events, set the 'recurrence' field on POST — the API will create all future occurrences automatically. Confirm destructive actions with the user.",
    });
  }),
});

// ── GET /api/info ──────────────────────────────────────────────
// Returns schema, available routes, and current date — useful for AI agents
// Deprecated: use /api/docs instead
http.route({
  path: "/api/info",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    if (!(await authenticate(ctx, req))) return json({ error: "Unauthorized" }, 401);
    return json({
      description: "Kugi personal block calendar API. Deprecated — use GET /api/docs for full documentation (no auth required).",
      current_date: new Date().toISOString().slice(0, 10),
      schema: {
        title: "string (required)",
        date: "YYYY-MM-DD (required)",
        emoji: "string (optional)",
        category: "string (optional, default: Work)",
        start_time: "HH:MM (optional)",
        end_time: "HH:MM (optional)",
        notes: "string (optional)",
        completed: "boolean (optional, default: false)",
        end_date: "YYYY-MM-DD (optional, for multi-day blocks)",
        notify_before: "number (optional) — minutes before start_time to send reminders",
        recurrence: "\"hourly\" | \"daily\" | \"monthly\" | \"yearly\" (optional)",
        recurrenceGroupId: "string (optional, auto-set for recurring blocks)",
      },
      endpoints: {
        "GET /api/docs": "Full API documentation — no auth required (preferred)",
        "GET /api/info": "This endpoint — schema and route reference (deprecated)",
        "GET /api/tasks": "List tasks. Query params: ?date=YYYY-MM-DD | ?from=YYYY-MM-DD&to=YYYY-MM-DD | ?search=text | ?completed=true|false",
        "GET /api/tasks/:id": "Get a single task by ID",
        "POST /api/tasks": "Create a task. If recurrence is set, creates all occurrences and returns { created: number }. Otherwise returns full task object.",
        "PATCH /api/tasks/:id": "Update a task (partial). Returns full task object.",
        "DELETE /api/tasks/:id": "Delete a task.",
        "POST /api/tasks/:id/complete": "Toggle task completion. Returns full task object.",
      },
    });
  }),
});

// ── GET /api/tasks ─────────────────────────────────────────────
// Query params: ?date= | ?from=&to= | ?search= | ?completed=
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

    let tasks = date
      ? await ctx.runQuery(api.blocks.listByDate, { date })
      : await ctx.runQuery(api.blocks.list, {});

    if (from || to) {
      tasks = tasks.filter((t: any) => {
        const taskDate = t.date;
        if (from && taskDate < from) return false;
        if (to && taskDate > to) return false;
        return true;
      });
    }
    if (search) {
      tasks = tasks.filter((t: any) =>
        t.title?.toLowerCase().includes(search) ||
        t.notes?.toLowerCase().includes(search) ||
        t.category?.toLowerCase().includes(search) ||
        t.emoji?.includes(search)
      );
    }
    if (completedFilter !== null) {
      const want = completedFilter === "true";
      tasks = tasks.filter((t: any) => t.completed === want);
    }
    return json(tasks);
  }),
});

// ── POST /api/tasks ────────────────────────────────────────────
// Body: { title, date, emoji?, category?, start_time?, end_time?, notes?, completed?, end_date?, recurrence?, notify_before? }
// Returns: full task object, or { created: number } if recurrence is set
http.route({
  path: "/api/tasks",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    if (!(await authenticate(ctx, req))) return json({ error: "Unauthorized" }, 401);
    let body: any;
    try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
    if (!body?.title || !body?.date) return json({ error: "title and date are required" }, 400);

    const commonFields = {
      title: body.title,
      emoji: body.emoji ?? undefined,
      category: body.category ?? "Work",
      date: body.date,
      start_time: body.start_time ?? undefined,
      end_time: body.end_time ?? undefined,
      notes: body.notes ?? undefined,
      completed: body.completed ?? false,
      end_date: body.end_date ?? undefined,
      notify_before: body.notify_before ?? undefined,
    };

    if (body.recurrence) {
      const validRecurrences = ["hourly", "daily", "monthly", "yearly"];
      if (!validRecurrences.includes(body.recurrence)) {
        return json({ error: "recurrence must be one of: hourly, daily, monthly, yearly" }, 400);
      }
      const count = await ctx.runMutation(api.blocks.createRecurring, {
        ...commonFields,
        recurrence: body.recurrence,
      });
      return json({ created: count }, 201);
    }

    const id = await ctx.runMutation(api.blocks.create, commonFields);
    const task = await ctx.runQuery(api.blocks.getById, { id });
    return json(task, 201);
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

    // Handle /api/tasks/:id/complete (shouldn't be GET but guard anyway)
    if (segments[3] === "complete") return json({ error: "Use POST for complete" }, 405);

    const task = await ctx.runQuery(api.blocks.getById, { id: id as any });
    if (!task) return json({ error: "Not found" }, 404);
    return json(task);
  }),
});

// ── PATCH /api/tasks/:id ───────────────────────────────────────
// Body: partial block fields. Returns full updated task.
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
    const { recurrence, recurrenceGroupId, ...updateFields } = body;
    await ctx.runMutation(api.blocks.update, { id: id as any, ...updateFields });
    const task = await ctx.runQuery(api.blocks.getById, { id: id as any });
    if (!task) return json({ error: "Not found" }, 404);
    return json(task);
  }),
});

// ── DELETE /api/tasks/:id ──────────────────────────────────────
http.route({
  pathPrefix: "/api/tasks/",
  method: "DELETE",
  handler: httpAction(async (ctx, req) => {
    if (!(await authenticate(ctx, req))) return json({ error: "Unauthorized" }, 401);
    const segments = new URL(req.url).pathname.split("/").filter(Boolean);
    const id = segments[2];
    if (!id) return json({ error: "id required" }, 400);
    await ctx.runMutation(api.blocks.remove, { id: id as any });
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
    if (action !== "complete") return json({ error: "Unknown action. Use POST /api/tasks/:id/complete" }, 400);
    await ctx.runMutation(api.blocks.toggleComplete, { id: id as any });
    const task = await ctx.runQuery(api.blocks.getById, { id: id as any });
    if (!task) return json({ error: "Not found" }, 404);
    return json(task);
  }),
});

export default http;
