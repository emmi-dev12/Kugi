import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

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
    return await ctx.db.insert("blocks", args);
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
    await ctx.db.patch(id, fields);
  },
});

export const remove = mutation({
  args: { id: v.id("blocks") },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
  },
});

export const toggleComplete = mutation({
  args: { id: v.id("blocks") },
  handler: async (ctx, { id }) => {
    const block = await ctx.db.get(id);
    if (!block) return;
    await ctx.db.patch(id, { completed: !block.completed });
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
