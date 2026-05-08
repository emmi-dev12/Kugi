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

// ── GET /api/info ──────────────────────────────────────────────
// Returns schema, available routes, and current date — useful for AI agents
http.route({
  path: "/api/info",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    if (!(await authenticate(ctx, req))) return json({ error: "Unauthorized" }, 401);
    return json({
      description: "Kugi personal block calendar API",
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
      },
      endpoints: {
        "GET /api/info": "This endpoint — schema and route reference",
        "GET /api/tasks": "List tasks. Query params: ?date=YYYY-MM-DD | ?from=YYYY-MM-DD&to=YYYY-MM-DD | ?search=text | ?completed=true|false",
        "GET /api/tasks/:id": "Get a single task by ID",
        "POST /api/tasks": "Create a task. Returns full task object.",
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
// Body: { title, date, emoji?, category?, start_time?, end_time?, notes?, completed?, end_date? }
// Returns: full task object
http.route({
  path: "/api/tasks",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    if (!(await authenticate(ctx, req))) return json({ error: "Unauthorized" }, 401);
    let body: any;
    try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
    if (!body?.title || !body?.date) return json({ error: "title and date are required" }, 400);
    const id = await ctx.runMutation(api.blocks.create, {
      title: body.title,
      emoji: body.emoji ?? undefined,
      category: body.category ?? "Work",
      date: body.date,
      start_time: body.start_time ?? undefined,
      end_time: body.end_time ?? undefined,
      notes: body.notes ?? undefined,
      completed: body.completed ?? false,
      end_date: body.end_date ?? undefined,
    });
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
    await ctx.runMutation(api.blocks.update, { id: id as any, ...body });
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
