import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";

// Convert local "YYYY-MM-DD HH:MM" to UTC using IANA timezone.
// Iterative Intl correction — same approach as pushActions.ts.
function localToUTC(dateStr: string, timeStr: string, tz: string): number {
  const [year, month, day] = dateStr.split("-").map(Number);
  const [h, m] = timeStr.split(":").map(Number);
  let utcMs = Date.UTC(year, month - 1, day, h, m);
  for (let i = 0; i < 4; i++) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false,
    }).formatToParts(new Date(utcMs));
    const localH = parseInt(parts.find(p => p.type === "hour")!.value) % 24;
    const localM = parseInt(parts.find(p => p.type === "minute")!.value);
    const diffMs = ((h - localH) * 60 + (m - localM)) * 60_000;
    if (Math.abs(diffMs) < 60_000) break;
    utcMs += diffMs;
  }
  return utcMs;
}

// Per-block reminder: fires at an exact local time on the block's date.
type BlockReminder = { atTime: string; message?: string };
// Global reminder: fires relative to the block's start_time.
type GlobalReminder = { offsetMinutes: number; message?: string };

type JobIds = { telegramJobIds: string[]; sendblueJobIds: string[] };

// ── Channel enable checks ─────────────────────────────────────────

async function isTelegramActive(ctx: any): Promise<boolean> {
  const cred = await ctx.db.query("settings").withIndex("by_key", (q: any) => q.eq("key", "telegramBotToken")).first();
  if (!cred?.value) return false;
  const enabled = await ctx.db.query("settings").withIndex("by_key", (q: any) => q.eq("key", "channelEnabled_telegram")).first();
  return enabled?.value !== "false";
}

async function isSendblueActive(ctx: any): Promise<boolean> {
  const cred = await ctx.db.query("settings").withIndex("by_key", (q: any) => q.eq("key", "sendblueApiKey")).first();
  if (!cred?.value) return false;
  const enabled = await ctx.db.query("settings").withIndex("by_key", (q: any) => q.eq("key", "channelEnabled_sendblue")).first();
  return enabled?.value !== "false";
}

// ── Global reminder readers ────────────────────────────────────────

async function getGlobalReminders(ctx: any): Promise<GlobalReminder[]> {
  const row = await ctx.db.query("settings").withIndex("by_key", (q: any) => q.eq("key", "telegramReminderOffsets")).first();
  if (row?.value) {
    try {
      const parsed = JSON.parse(row.value);
      if (Array.isArray(parsed) && parsed.length) {
        return parsed.map((x: any) =>
          typeof x === "number" ? { offsetMinutes: x } : { offsetMinutes: x.offsetMinutes, message: x.message }
        ).filter((x: GlobalReminder) => x.offsetMinutes >= 0);
      }
    } catch {}
  }
  const legacyRow = await ctx.db.query("settings").withIndex("by_key", (q: any) => q.eq("key", "telegramOffsetMinutes")).first();
  const legacy = legacyRow ? (parseInt(legacyRow.value) || 15) : 15;
  return [{ offsetMinutes: legacy }];
}

async function getSendblueGlobalReminders(ctx: any): Promise<GlobalReminder[]> {
  const row = await ctx.db.query("settings").withIndex("by_key", (q: any) => q.eq("key", "sendblueReminderOffsets")).first();
  if (row?.value) {
    try {
      const parsed = JSON.parse(row.value);
      if (Array.isArray(parsed) && parsed.length) {
        return parsed.map((x: any) =>
          typeof x === "number" ? { offsetMinutes: x } : { offsetMinutes: x.offsetMinutes, message: x.message }
        ).filter((x: GlobalReminder) => x.offsetMinutes >= 0);
      }
    } catch {}
  }
  // Fall back to Telegram offsets if SendBlue offsets not explicitly configured
  return getGlobalReminders(ctx);
}

async function getTZ(ctx: any): Promise<string> {
  const row = await ctx.db.query("settings").withIndex("by_key", (q: any) => q.eq("key", "timezone")).first();
  return row?.value || "UTC";
}

// ── Telegram scheduling ────────────────────────────────────────────

async function scheduleTelegramPerBlock(
  ctx: any, blockId: any, date: string, reminders: BlockReminder[], tz: string,
): Promise<string[]> {
  const now = Date.now();
  const ids: string[] = [];
  for (const r of reminders) {
    const fireMs = localToUTC(date, r.atTime, tz);
    if (fireMs > now) {
      const jobId = await ctx.scheduler.runAt(fireMs, internal.telegram.sendReminder, { blockId, offsetMessage: r.message ?? null });
      ids.push(String(jobId));
    }
  }
  return ids;
}

async function scheduleTelegramGlobal(
  ctx: any, blockId: any, date: string, startTime: string, tz: string,
): Promise<string[]> {
  const reminders = await getGlobalReminders(ctx);
  const now = Date.now();
  const eventMs = localToUTC(date, startTime, tz);
  const ids: string[] = [];
  for (const r of reminders) {
    const fireMs = eventMs - r.offsetMinutes * 60_000;
    if (fireMs > now) {
      const jobId = await ctx.scheduler.runAt(fireMs, internal.telegram.sendReminder, { blockId, offsetMessage: r.message ?? null });
      ids.push(String(jobId));
    }
  }
  return ids;
}

async function scheduleTelegramJobs(
  ctx: any, blockId: any, date: string, startTime: string | undefined, blockReminders: BlockReminder[] | undefined, tz: string,
): Promise<string[]> {
  if (blockReminders !== undefined) {
    return blockReminders.length > 0 ? scheduleTelegramPerBlock(ctx, blockId, date, blockReminders, tz) : [];
  }
  if (startTime) return scheduleTelegramGlobal(ctx, blockId, date, startTime, tz);
  return [];
}

// ── SendBlue scheduling ────────────────────────────────────────────

async function scheduleSendbluePerBlock(
  ctx: any, blockId: any, date: string, reminders: BlockReminder[], tz: string,
): Promise<string[]> {
  const now = Date.now();
  const ids: string[] = [];
  for (const r of reminders) {
    const fireMs = localToUTC(date, r.atTime, tz);
    if (fireMs > now) {
      const jobId = await ctx.scheduler.runAt(fireMs, internal.sendblue.sendReminder, { blockId, offsetMessage: r.message ?? null });
      ids.push(String(jobId));
    }
  }
  return ids;
}

async function scheduleSendblueGlobal(
  ctx: any, blockId: any, date: string, startTime: string, tz: string,
): Promise<string[]> {
  const reminders = await getSendblueGlobalReminders(ctx);
  const now = Date.now();
  const eventMs = localToUTC(date, startTime, tz);
  const ids: string[] = [];
  for (const r of reminders) {
    const fireMs = eventMs - r.offsetMinutes * 60_000;
    if (fireMs > now) {
      const jobId = await ctx.scheduler.runAt(fireMs, internal.sendblue.sendReminder, { blockId, offsetMessage: r.message ?? null });
      ids.push(String(jobId));
    }
  }
  return ids;
}

async function scheduleSendblueJobs(
  ctx: any, blockId: any, date: string, startTime: string | undefined, blockReminders: BlockReminder[] | undefined, tz: string,
): Promise<string[]> {
  if (blockReminders !== undefined) {
    return blockReminders.length > 0 ? scheduleSendbluePerBlock(ctx, blockId, date, blockReminders, tz) : [];
  }
  if (startTime) return scheduleSendblueGlobal(ctx, blockId, date, startTime, tz);
  return [];
}

// ── Unified scheduler ──────────────────────────────────────────────

async function scheduleReminders(
  ctx: any,
  blockId: any,
  date: string,
  startTime: string | undefined,
  blockReminders: BlockReminder[] | undefined,
  tz: string,
): Promise<JobIds> {
  const [telegramOn, sendblueOn] = [await isTelegramActive(ctx), await isSendblueActive(ctx)];
  const telegramJobIds = telegramOn ? await scheduleTelegramJobs(ctx, blockId, date, startTime, blockReminders, tz) : [];
  const sendblueJobIds = sendblueOn ? await scheduleSendblueJobs(ctx, blockId, date, startTime, blockReminders, tz) : [];
  return { telegramJobIds, sendblueJobIds };
}

async function cancelScheduledJobs(ctx: any, block: any) {
  if (block.telegramJobIds?.length) {
    for (const jid of block.telegramJobIds) {
      try { await ctx.scheduler.cancel(jid as any); } catch {}
    }
  }
  if (block.telegramJobId) {
    try { await ctx.scheduler.cancel(block.telegramJobId as any); } catch {}
  }
  if (block.sendblueJobIds?.length) {
    for (const jid of block.sendblueJobIds) {
      try { await ctx.scheduler.cancel(jid as any); } catch {}
    }
  }
}

function buildJobPatch({ telegramJobIds, sendblueJobIds }: JobIds): Record<string, any> {
  const patch: Record<string, any> = {};
  if (telegramJobIds.length) patch.telegramJobIds = telegramJobIds;
  if (sendblueJobIds.length) patch.sendblueJobIds = sendblueJobIds;
  return patch;
}

// ── Queries ────────────────────────────────────────────────────────

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("blocks").collect();
  },
});

export const listByDate = query({
  args: { date: v.string() },
  handler: async (ctx, { date }) => {
    return await ctx.db
      .query("blocks")
      .withIndex("by_date", (q) => q.eq("date", date))
      .collect();
  },
});

export const getById = query({
  args: { id: v.id("blocks") },
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id);
  },
});

// ── Mutations ──────────────────────────────────────────────────────

export const create = mutation({
  args: {
    title: v.string(),
    emoji: v.optional(v.string()),
    category: v.string(),
    date: v.string(),
    start_time: v.optional(v.string()),
    end_time: v.optional(v.string()),
    notes: v.optional(v.string()),
    completed: v.boolean(),
    localId: v.optional(v.string()),
    notify_before: v.optional(v.number()),
    end_date: v.optional(v.string()),
    googleEventId: v.optional(v.string()),
    notify_message: v.optional(v.string()),
    blockReminders: v.optional(v.array(v.object({ atTime: v.string(), message: v.optional(v.string()) }))),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("blocks", args);
    const tz = await getTZ(ctx);
    const jobIds = await scheduleReminders(ctx, id, args.date, args.start_time, args.blockReminders, tz);
    const patch = buildJobPatch(jobIds);
    if (Object.keys(patch).length) await ctx.db.patch(id, patch);
    return id;
  },
});

export const update = mutation({
  args: {
    id: v.id("blocks"),
    title: v.optional(v.string()),
    emoji: v.optional(v.string()),
    category: v.optional(v.string()),
    date: v.optional(v.string()),
    start_time: v.optional(v.string()),
    end_time: v.optional(v.string()),
    notes: v.optional(v.string()),
    completed: v.optional(v.boolean()),
    notify_before: v.optional(v.number()),
    end_date: v.optional(v.string()),
    googleEventId: v.optional(v.string()),
    notify_message: v.optional(v.string()),
    blockReminders: v.optional(v.array(v.object({ atTime: v.string(), message: v.optional(v.string()) }))),
  },
  handler: async (ctx, { id, ...fields }) => {
    const block = await ctx.db.get(id);
    if (block) await cancelScheduledJobs(ctx, block);
    await ctx.db.patch(id, { ...fields, telegramJobIds: undefined, telegramJobId: undefined, sendblueJobIds: undefined });
    const updated = await ctx.db.get(id);
    if (updated) {
      const tz = await getTZ(ctx);
      const jobIds = await scheduleReminders(ctx, id, updated.date, updated.start_time, updated.blockReminders, tz);
      const patch = buildJobPatch(jobIds);
      if (Object.keys(patch).length) await ctx.db.patch(id, patch);
    }
  },
});

export const remove = mutation({
  args: { id: v.id("blocks") },
  handler: async (ctx, { id }) => {
    const block = await ctx.db.get(id);
    if (block) await cancelScheduledJobs(ctx, block);
    await ctx.db.delete(id);
  },
});

export const toggleComplete = mutation({
  args: { id: v.id("blocks") },
  handler: async (ctx, { id }) => {
    const block = await ctx.db.get(id);
    if (!block) return;
    const nowCompleted = !block.completed;
    await ctx.db.patch(id, { completed: nowCompleted });
    if (nowCompleted) {
      await cancelScheduledJobs(ctx, block);
      await ctx.db.patch(id, { telegramJobIds: undefined, telegramJobId: undefined, sendblueJobIds: undefined });
    } else if (block.date) {
      const tz = await getTZ(ctx);
      const jobIds = await scheduleReminders(ctx, id, block.date, block.start_time, block.blockReminders, tz);
      const patch = buildJobPatch(jobIds);
      if (Object.keys(patch).length) await ctx.db.patch(id, patch);
    }
  },
});

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function addMonths(dateStr: string, n: number): string {
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + n);
  return d.toISOString().slice(0, 10);
}

function addYears(dateStr: string, n: number): string {
  const d = new Date(dateStr);
  d.setFullYear(d.getFullYear() + n);
  return d.toISOString().slice(0, 10);
}

export const createRecurring = mutation({
  args: {
    title: v.string(),
    emoji: v.optional(v.string()),
    category: v.string(),
    date: v.string(),
    start_time: v.optional(v.string()),
    end_time: v.optional(v.string()),
    notes: v.optional(v.string()),
    completed: v.boolean(),
    localId: v.optional(v.string()),
    notify_before: v.optional(v.number()),
    end_date: v.optional(v.string()),
    notify_message: v.optional(v.string()),
    blockReminders: v.optional(v.array(v.object({ atTime: v.string(), message: v.optional(v.string()) }))),
    recurrence: v.union(v.literal("hourly"), v.literal("daily"), v.literal("monthly"), v.literal("yearly")),
  },
  handler: async (ctx, args) => {
    const recurrenceGroupId = `rg_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const { recurrence, ...blockFields } = args;

    const dates: string[] = [];
    if (recurrence === "hourly") {
      for (let i = 0; i < 30; i++) dates.push(addDays(args.date, i));
    } else if (recurrence === "daily") {
      for (let i = 0; i < 730; i++) dates.push(addDays(args.date, i));
    } else if (recurrence === "monthly") {
      for (let i = 0; i < 60; i++) dates.push(addMonths(args.date, i));
    } else if (recurrence === "yearly") {
      for (let i = 0; i < 10; i++) dates.push(addYears(args.date, i));
    }

    const tz = await getTZ(ctx);

    for (const date of dates) {
      const id = await ctx.db.insert("blocks", { ...blockFields, date, recurrence, recurrenceGroupId });
      const jobIds = await scheduleReminders(ctx, id, date, args.start_time, args.blockReminders, tz);
      const patch = buildJobPatch(jobIds);
      if (Object.keys(patch).length) await ctx.db.patch(id, patch);
    }

    return dates.length;
  },
});

export const deleteRecurring = mutation({
  args: {
    id: v.id("blocks"),
    mode: v.union(v.literal("this"), v.literal("future"), v.literal("all")),
    futureDays: v.optional(v.number()),
  },
  handler: async (ctx, { id, mode, futureDays }) => {
    const block = await ctx.db.get(id);
    if (!block) return;

    const { recurrenceGroupId, date } = block;

    if (mode === "this") {
      await cancelScheduledJobs(ctx, block);
      await ctx.db.delete(id);
      return;
    }

    if (!recurrenceGroupId) {
      await cancelScheduledJobs(ctx, block);
      await ctx.db.delete(id);
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    const allInGroup = await ctx.db.query("blocks")
      .collect()
      .then(blocks => blocks.filter(b => b.recurrenceGroupId === recurrenceGroupId));

    let toDelete: typeof allInGroup;

    if (mode === "future") {
      toDelete = allInGroup.filter(b => {
        if (b.date < date) return false;
        if (futureDays !== undefined) {
          const maxDate = addDays(date, futureDays);
          if (b.date > maxDate) return false;
        }
        return true;
      });
    } else {
      toDelete = allInGroup.filter(b => b.date >= today);
    }

    for (const b of toDelete) {
      await cancelScheduledJobs(ctx, b);
      await ctx.db.delete(b._id);
    }
  },
});

export const bulkComplete = mutation({
  args: { ids: v.array(v.id("blocks")), completed: v.boolean() },
  handler: async (ctx, { ids, completed }) => {
    const tz = await getTZ(ctx);
    let count = 0;
    for (const id of ids) {
      const block = await ctx.db.get(id);
      if (!block) continue;
      await ctx.db.patch(id, { completed });
      if (completed) {
        await cancelScheduledJobs(ctx, block);
        await ctx.db.patch(id, { telegramJobIds: undefined, telegramJobId: undefined, sendblueJobIds: undefined });
      } else if (block.date) {
        const jobIds = await scheduleReminders(ctx, id, block.date, block.start_time, block.blockReminders, tz);
        const patch = buildJobPatch(jobIds);
        if (Object.keys(patch).length) await ctx.db.patch(id, patch);
      }
      count++;
    }
    return count;
  },
});

export const bulkDelete = mutation({
  args: { ids: v.array(v.id("blocks")) },
  handler: async (ctx, { ids }) => {
    let count = 0;
    for (const id of ids) {
      const block = await ctx.db.get(id);
      if (!block) continue;
      await cancelScheduledJobs(ctx, block);
      await ctx.db.delete(id);
      count++;
    }
    return count;
  },
});

export const bulkUpdate = mutation({
  args: {
    ids: v.array(v.id("blocks")),
    fields: v.object({
      category: v.optional(v.string()),
      completed: v.optional(v.boolean()),
      emoji: v.optional(v.string()),
    }),
  },
  handler: async (ctx, { ids, fields }) => {
    let count = 0;
    for (const id of ids) {
      const block = await ctx.db.get(id);
      if (!block) continue;
      await ctx.db.patch(id, fields);
      count++;
    }
    return count;
  },
});

export const getStats = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("blocks").collect();
    const today = new Date().toISOString().slice(0, 10);
    const todayDate = new Date(today);
    const dow = todayDate.getDay();
    const diffToMon = (dow + 6) % 7;
    const mon = new Date(todayDate);
    mon.setDate(todayDate.getDate() - diffToMon);
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    const weekStart = mon.toISOString().slice(0, 10);
    const weekEnd = sun.toISOString().slice(0, 10);
    const next7 = new Date(todayDate);
    next7.setDate(todayDate.getDate() + 7);
    const next7Str = next7.toISOString().slice(0, 10);

    let todayCount = 0, todayCompleted = 0;
    let thisWeek = 0, thisWeekCompleted = 0;
    let overdue = 0, total = 0, totalCompleted = 0, upcoming7Days = 0;

    for (const b of all) {
      total++;
      if (b.completed) totalCompleted++;
      if (b.date === today) {
        todayCount++;
        if (b.completed) todayCompleted++;
      }
      if (b.date >= weekStart && b.date <= weekEnd) {
        thisWeek++;
        if (b.completed) thisWeekCompleted++;
      }
      if (!b.completed && b.date < today) overdue++;
      if (!b.completed && b.date > today && b.date <= next7Str) upcoming7Days++;
    }

    return { today: todayCount, todayCompleted, thisWeek, thisWeekCompleted, overdue, total, totalCompleted, upcoming7Days };
  },
});

export const bulkCreate = mutation({
  args: {
    blocks: v.array(
      v.object({
        title: v.string(),
        emoji: v.optional(v.string()),
        category: v.string(),
        date: v.string(),
        start_time: v.optional(v.string()),
        end_time: v.optional(v.string()),
        notes: v.optional(v.string()),
        completed: v.boolean(),
        localId: v.optional(v.string()),
        notify_before: v.optional(v.number()),
        end_date: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, { blocks }) => {
    const ids = [];
    for (const block of blocks) {
      ids.push(await ctx.db.insert("blocks", block));
    }
    return ids;
  },
});
