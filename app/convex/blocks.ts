import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";

function reminderTimestamp(date: string, startTime: string, offsetMinutes: number): number {
  const dt = new Date(`${date}T${startTime}:00`);
  return dt.getTime() - offsetMinutes * 60 * 1000;
}

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
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("blocks", args);
    if (args.start_time && args.date) {
      const offsetRow = await ctx.db.query("settings").withIndex("by_key", q => q.eq("key", "telegramOffsetMinutes")).first();
      const offsetMinutes = offsetRow ? (parseInt(offsetRow.value) || 15) : 15;
      const ts = reminderTimestamp(args.date, args.start_time, offsetMinutes);
      if (ts > Date.now()) {
        const jobId = await ctx.scheduler.runAt(ts, internal.telegram.sendReminder, { blockId: id });
        await ctx.db.patch(id, { telegramJobId: jobId });
      }
    }
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
  },
  handler: async (ctx, { id, ...fields }) => {
    const block = await ctx.db.get(id);
    if (block?.telegramJobId) {
      await ctx.scheduler.cancel(block.telegramJobId as any);
    }
    await ctx.db.patch(id, fields);
    const updated = await ctx.db.get(id);
    if (updated?.start_time && updated?.date) {
      const offsetRow = await ctx.db.query("settings").withIndex("by_key", q => q.eq("key", "telegramOffsetMinutes")).first();
      const offsetMinutes = offsetRow ? (parseInt(offsetRow.value) || 15) : 15;
      const ts = reminderTimestamp(updated.date, updated.start_time, offsetMinutes);
      if (ts > Date.now()) {
        const jobId = await ctx.scheduler.runAt(ts, internal.telegram.sendReminder, { blockId: id });
        await ctx.db.patch(id, { telegramJobId: jobId });
      } else {
        await ctx.db.patch(id, { telegramJobId: undefined });
      }
    } else {
      await ctx.db.patch(id, { telegramJobId: undefined });
    }
  },
});

export const remove = mutation({
  args: { id: v.id("blocks") },
  handler: async (ctx, { id }) => {
    const block = await ctx.db.get(id);
    if (block?.telegramJobId) {
      await ctx.scheduler.cancel(block.telegramJobId as any);
    }
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
    if (nowCompleted && block.telegramJobId) {
      await ctx.scheduler.cancel(block.telegramJobId as any);
      await ctx.db.patch(id, { telegramJobId: undefined });
    } else if (!nowCompleted && block.start_time && block.date) {
      const offsetRow = await ctx.db.query("settings").withIndex("by_key", q => q.eq("key", "telegramOffsetMinutes")).first();
      const offsetMinutes = offsetRow ? (parseInt(offsetRow.value) || 15) : 15;
      const ts = reminderTimestamp(block.date, block.start_time, offsetMinutes);
      if (ts > Date.now()) {
        const jobId = await ctx.scheduler.runAt(ts, internal.telegram.sendReminder, { blockId: id });
        await ctx.db.patch(id, { telegramJobId: jobId });
      }
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
    recurrence: v.union(v.literal("hourly"), v.literal("daily"), v.literal("monthly"), v.literal("yearly")),
  },
  handler: async (ctx, args) => {
    const recurrenceGroupId = `rg_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const { recurrence, ...blockFields } = args;

    // Generate all dates for this recurrence
    const dates: string[] = [];
    if (recurrence === "hourly") {
      // Same time every day for 30 days
      for (let i = 0; i < 30; i++) {
        dates.push(addDays(args.date, i));
      }
    } else if (recurrence === "daily") {
      // Same time every day for 2 years (730 days)
      for (let i = 0; i < 730; i++) {
        dates.push(addDays(args.date, i));
      }
    } else if (recurrence === "monthly") {
      // Same day of month for 5 years (60 months)
      for (let i = 0; i < 60; i++) {
        dates.push(addMonths(args.date, i));
      }
    } else if (recurrence === "yearly") {
      // Same date for 10 years
      for (let i = 0; i < 10; i++) {
        dates.push(addYears(args.date, i));
      }
    }

    const offsetRow = await ctx.db.query("settings").withIndex("by_key", q => q.eq("key", "telegramOffsetMinutes")).first();
    const offsetMinutes = args.notify_before ?? (offsetRow ? (parseInt(offsetRow.value) || 15) : 15);

    for (const date of dates) {
      const id = await ctx.db.insert("blocks", {
        ...blockFields,
        date,
        recurrence,
        recurrenceGroupId,
      });
      if (args.start_time) {
        const ts = reminderTimestamp(date, args.start_time, offsetMinutes);
        if (ts > Date.now()) {
          const jobId = await ctx.scheduler.runAt(ts, internal.telegram.sendReminder, { blockId: id });
          await ctx.db.patch(id, { telegramJobId: jobId });
        }
      }
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
      if (block.telegramJobId) await ctx.scheduler.cancel(block.telegramJobId as any);
      await ctx.db.delete(id);
      return;
    }

    if (!recurrenceGroupId) {
      // No group, just delete this block
      if (block.telegramJobId) await ctx.scheduler.cancel(block.telegramJobId as any);
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
      // "all" — delete all from today forward
      toDelete = allInGroup.filter(b => b.date >= today);
    }

    for (const b of toDelete) {
      if (b.telegramJobId) await ctx.scheduler.cancel(b.telegramJobId as any);
      await ctx.db.delete(b._id);
    }
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
