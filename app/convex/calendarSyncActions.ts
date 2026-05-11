"use node";

import { action, internalAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { v } from "convex/values";
import { ComposioToolSet } from "composio-core";

const ENTITY_ID = "boop-default";
const CALENDAR_ID = "primary";

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

async function getEnabledAndApiKey(ctx: any): Promise<string> {
  const enabledRaw = await ctx.runQuery(internal.settings.getSettingValue, {
    key: "integration_googleCalendar",
  });
  if (enabledRaw === "false") {
    throw new Error(
      "Google Calendar sync is disabled. Enable it in Settings → Integrations.",
    );
  }
  const apiKey = await ctx.runQuery(internal.settings.getSettingValue, {
    key: "composioApiKey",
  });
  if (!apiKey) {
    throw new Error(
      "No Composio API key saved. Add one in Settings → Integrations.",
    );
  }
  return apiKey;
}

// Public action: pulls GCal events → Kugi blocks.
// - New events (no block with matching googleEventId) → create block
// - Deleted events (block has googleEventId not in GCal list) → delete block
export const fetchFromGoogle = action({
  args: {},
  handler: async (ctx) => {
    const composioApiKey = await getEnabledAndApiKey(ctx);
    const toolset = new ComposioToolSet({ apiKey: composioApiKey });
    const { min, max } = dateWindow(1, 14);

    const result = await toolset.executeAction({
      action: "GOOGLECALENDAR_EVENTS_LIST",
      params: {
        calendarId: CALENDAR_ID,
        timeMin: `${isoDateTime(min, "00:00")}Z`,
        timeMax: `${isoDateTime(max, "23:59")}Z`,
        maxResults: 200,
        singleEvents: true,
        orderBy: "startTime",
      },
      entityId: ENTITY_ID,
    });

    const events: any[] = (result as any)?.data?.items ?? [];
    const gcalIds = new Set(events.map((e: any) => e.id).filter(Boolean));

    const allBlocks: any[] = await ctx.runQuery(api.blocks.list);

    // Existing googleEventIds already in Kugi
    const existingGcalIds = new Set(
      allBlocks.map((b: any) => b.googleEventId).filter(Boolean),
    );

    // Create new blocks for events not already in Kugi
    for (const ev of events) {
      if (!ev.id || existingGcalIds.has(ev.id)) continue;
      const rawDate: string = ev.start?.dateTime ?? ev.start?.date ?? "";
      if (!rawDate) continue;
      const date = rawDate.slice(0, 10);
      const title: string = ev.summary ?? "(No title)";
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
        googleEventId: ev.id,
      });
    }

    // Delete blocks whose GCal event was removed
    const blocksFromGcal = allBlocks.filter((b: any) => b.googleEventId);
    for (const block of blocksFromGcal) {
      if (!gcalIds.has(block.googleEventId)) {
        await ctx.runMutation(api.blocks.remove, { id: block._id });
      }
    }
  },
});

// Public action: pushes native Kugi blocks → GCal.
// Only blocks that: not completed, no googleEventId, date >= today, have start+end time.
// After creating the GCal event, patches the block with googleEventId so it won't be pushed again.
export const pushToGoogle = action({
  args: {},
  handler: async (ctx) => {
    const composioApiKey = await getEnabledAndApiKey(ctx);
    const toolset = new ComposioToolSet({ apiKey: composioApiKey });
    const today = new Date().toISOString().slice(0, 10);

    const allBlocks: any[] = await ctx.runQuery(api.blocks.list);
    const toPush = allBlocks.filter(
      (b: any) =>
        !b.completed &&
        !b.googleEventId &&
        b.date >= today &&
        b.start_time &&
        b.end_time,
    );

    for (const block of toPush) {
      const res = await toolset.executeAction({
        action: "GOOGLECALENDAR_CREATE_EVENT",
        params: {
          calendarId: CALENDAR_ID,
          summary: `${block.emoji ? block.emoji + " " : ""}${block.title}`,
          ...(block.notes ? { description: block.notes } : {}),
          start_datetime: isoDateTime(block.date, block.start_time),
          end_datetime: isoDateTime(block.date, block.end_time),
        },
        entityId: ENTITY_ID,
      });
      const createdId = (res as any)?.data?.id;
      if (createdId) {
        await ctx.runMutation(api.blocks.update, {
          id: block._id,
          googleEventId: createdId,
        });
      }
    }
  },
});

// Internal sync worker — called by triggerSync and the cron job.
// outbound=true pushes upcoming Kugi blocks to Google Calendar.
// Inbound pull (GCal events → Kugi blocks) always runs.
export const syncCalendar = internalAction({
  args: { composioApiKey: v.string(), outbound: v.optional(v.boolean()) },
  handler: async (ctx, { composioApiKey, outbound = false }) => {
    const toolset = new ComposioToolSet({ apiKey: composioApiKey });
    const { min, max } = dateWindow(1, 14);

    // ── Inbound: GCal events → Kugi blocks ───────────────────────
    const result = await toolset.executeAction({
      action: "GOOGLECALENDAR_EVENTS_LIST",
      params: {
        calendarId: CALENDAR_ID,
        timeMin: `${isoDateTime(min, "00:00")}Z`,
        timeMax: `${isoDateTime(max, "23:59")}Z`,
        maxResults: 200,
        singleEvents: true,
        orderBy: "startTime",
      },
      entityId: ENTITY_ID,
    });

    const events: any[] = (result as any)?.data?.items ?? [];
    const gcalIds = new Set(events.map((e: any) => e.id).filter(Boolean));
    const allBlocks: any[] = await ctx.runQuery(api.blocks.list);
    const existingGcalIds = new Set(
      allBlocks.map((b: any) => b.googleEventId).filter(Boolean),
    );

    for (const ev of events) {
      if (!ev.id || existingGcalIds.has(ev.id)) continue;
      const rawDate: string = ev.start?.dateTime ?? ev.start?.date ?? "";
      if (!rawDate) continue;
      const date = rawDate.slice(0, 10);
      const title: string = ev.summary ?? "(No title)";
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
        googleEventId: ev.id,
      });
    }

    // Delete blocks whose GCal event was removed
    const blocksFromGcal = allBlocks.filter((b: any) => b.googleEventId);
    for (const block of blocksFromGcal) {
      if (!gcalIds.has(block.googleEventId)) {
        await ctx.runMutation(api.blocks.remove, { id: block._id });
      }
    }

    if (!outbound) return;

    // ── Outbound: native Kugi blocks → GCal events ─────────────
    const today = new Date().toISOString().slice(0, 10);
    const outBlocks = allBlocks.filter(
      (b: any) =>
        !b.completed &&
        !b.googleEventId &&
        b.date >= today &&
        b.start_time &&
        b.end_time,
    );
    for (const block of outBlocks) {
      const res = await toolset.executeAction({
        action: "GOOGLECALENDAR_CREATE_EVENT",
        params: {
          calendarId: CALENDAR_ID,
          summary: `${block.emoji ? block.emoji + " " : ""}${block.title}`,
          ...(block.notes ? { description: block.notes } : {}),
          start_datetime: isoDateTime(block.date, block.start_time),
          end_datetime: isoDateTime(block.date, block.end_time),
        },
        entityId: ENTITY_ID,
      });
      const createdId = (res as any)?.data?.id;
      if (createdId) {
        await ctx.runMutation(api.blocks.update, {
          id: block._id,
          googleEventId: createdId,
        });
      }
    }
  },
});

// Public action called from the "Sync now" button in Settings.
export const triggerSync = action({
  args: {},
  handler: async (ctx) => {
    const enabledRaw = await ctx.runQuery(internal.settings.getSettingValue, {
      key: "integration_googleCalendar",
    });
    if (enabledRaw === "false") {
      throw new Error(
        "Google Calendar sync is disabled. Enable it in Settings → Integrations.",
      );
    }
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
