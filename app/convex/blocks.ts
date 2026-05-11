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
