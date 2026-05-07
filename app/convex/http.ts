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

// ── GET /api/tasks ─────────────────────────────────────────────
// Optional query params: ?date=YYYY-MM-DD
http.route({
  path: "/api/tasks",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    if (!(await authenticate(ctx, req))) return json({ error: "Unauthorized" }, 401);
    const url = new URL(req.url);
    const date = url.searchParams.get("date");
    const tasks = date
      ? await ctx.runQuery(api.blocks.listByDate, { date })
      : await ctx.runQuery(api.blocks.list, {});
    return json(tasks);
  }),
});

// ── POST /api/tasks ────────────────────────────────────────────
// Body: { title, date, emoji?, category?, start_time?, end_time?, notes?, completed? }
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
    });
    return json({ id }, 201);
  }),
});

// ── PATCH /api/tasks ───────────────────────────────────────────
// Body: { id, ...fields }
http.route({
  path: "/api/tasks",
  method: "PATCH",
  handler: httpAction(async (ctx, req) => {
    if (!(await authenticate(ctx, req))) return json({ error: "Unauthorized" }, 401);
    let body: any;
    try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
    if (!body?.id) return json({ error: "id is required" }, 400);
    const { id, ...fields } = body;
    await ctx.runMutation(api.blocks.update, { id, ...fields });
    return json({ ok: true });
  }),
});

// ── DELETE /api/tasks?id=xxx ───────────────────────────────────
http.route({
  path: "/api/tasks",
  method: "DELETE",
  handler: httpAction(async (ctx, req) => {
    if (!(await authenticate(ctx, req))) return json({ error: "Unauthorized" }, 401);
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return json({ error: "id query param required" }, 400);
    await ctx.runMutation(api.blocks.remove, { id: id as any });
    return json({ ok: true });
  }),
});

export default http;
