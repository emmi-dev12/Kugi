"use node";

import { action, internalAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { v } from "convex/values";
import { ComposioToolSet } from "composio-core";

const ENTITY_ID = "boop-default";
const CALENDAR_ID = "primary";
const GCAL_BASE = "https://www.googleapis.com/calendar/v3";

async function getAccessToken(composioApiKey: string): Promise<string> {
  const toolset = new ComposioToolSet({ apiKey: composioApiKey });
  const entity = await (toolset as any).client.getEntity(ENTITY_ID);
  const conn = await entity.getConnection({ app: "googlecalendar" });
  const token = conn?.connectionParams?.access_token ?? conn?.data?.access_token;
  if (!token) throw new Error("Google Calendar is not connected in your Composio account. Visit composio.dev, connect Google Calendar, then try again.");
  return token;
}

async function gcalGet(token: string, path: string, params: Record<string, string> = {}) {
  const url = new URL(`${GCAL_BASE}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Google Calendar API error ${res.status}: ${await res.text()}`);
  return res.json();
}

async function gcalPost(token: string, path: string, body: unknown) {
  const res = await fetch(`${GCAL_BASE}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Google Calendar API error ${res.status}: ${await res.text()}`);
  return res.json();
}

function isoDateTime(date: string, time: string): string {
  return `${date}T${time}:00`;
}

function dateWindow(pastDays: number, futureDays: number) {
  const today = new Date();
  const from = new Date(today);
  from.setDate(from.getDate() - pastDays);
  const to = new Date(today);
  to.setDate(to.getDate() + futureDays);
  return {
    min: from.toISOString().slice(0, 10),
    max: to.toISOString().slice(0, 10),
  };
}

// Internal sync worker — called by triggerSync and the cron job.
// outbound=true pushes upcoming Kugi blocks to Google Calendar.
// Inbound pull (GCal events → Kugi blocks) always runs.
export const syncCalendar = internalAction({
  args: { composioApiKey: v.string(), outbound: v.optional(v.boolean()) },
  handler: async (ctx, { composioApiKey, outbound = false }) => {
    const token = await getAccessToken(composioApiKey);
    const { min, max } = dateWindow(1, 14);

    // ── Inbound: GCal events → Kugi blocks ───────────────────────
    const result = await gcalGet(token, `/calendars/${CALENDAR_ID}/events`, {
      timeMin: `${isoDateTime(min, "00:00")}Z`,
      timeMax: `${isoDateTime(max, "23:59")}Z`,
      maxResults: "200",
      singleEvents: "true",
      orderBy: "startTime",
    });

    const events: any[] = result?.items ?? [];
    const allBlocks: any[] = await ctx.runQuery(api.blocks.list);
    const blockKeys = new Set(allBlocks.map((b: any) => `${b.date}||${b.title}`));

    for (const ev of events) {
      const rawDate: string = ev.start?.dateTime ?? ev.start?.date ?? "";
      if (!rawDate) continue;
      const date = rawDate.slice(0, 10);
      const title: string = ev.summary ?? "(No title)";
      if (blockKeys.has(`${date}||${title}`)) continue;
      const startTime = ev.start?.dateTime ? ev.start.dateTime.slice(11, 16) : "09:00";
      const endTime = ev.end?.dateTime ? ev.end.dateTime.slice(11, 16) : "10:00";
      await ctx.runMutation(api.blocks.create, {
        title,
        category: "Other",
        date,
        start_time: startTime,
        end_time: endTime,
        ...(ev.description ? { notes: ev.description } : {}),
        completed: false,
      });
    }

    if (!outbound) return;

    // ── Outbound: upcoming Kugi blocks → GCal events ─────────────
    const today = new Date().toISOString().slice(0, 10);
    const outBlocks = allBlocks.filter(
      (b: any) => !b.completed && b.date >= today && b.start_time && b.end_time,
    );
    for (const block of outBlocks) {
      await gcalPost(token, `/calendars/${CALENDAR_ID}/events`, {
        summary: `${block.emoji ? block.emoji + " " : ""}${block.title}`,
        ...(block.notes ? { description: block.notes } : {}),
        start: { dateTime: isoDateTime(block.date, block.start_time) },
        end: { dateTime: isoDateTime(block.date, block.end_time) },
      });
    }
  },
});

// Public action called from the "Sync now" button in Settings.
export const triggerSync = action({
  args: {},
  handler: async (ctx) => {
    const apiKey = await ctx.runQuery(internal.settings.getSettingValue, {
      key: "composioApiKey",
    });
    if (!apiKey) {
      throw new Error(
        "No Composio API key saved. Add one in Settings → Integrations.",
      );
    }
    await ctx.runAction(internal.calendarSyncActions.syncCalendar, {
      composioApiKey: apiKey,
      outbound: true,
    });
  },
});

// Internal action invoked by the cron — inbound-only to avoid duplicates.
export const cronSync = internalAction({
  args: {},
  handler: async (ctx) => {
    const apiKey = await ctx.runQuery(internal.settings.getSettingValue, {
      key: "composioApiKey",
    });
    if (!apiKey) return;
    try {
      await ctx.runAction(internal.calendarSyncActions.syncCalendar, {
        composioApiKey: apiKey,
        outbound: false,
      });
    } catch {
      // Don't crash the cron if Composio is unreachable or not connected
    }
  },
});
