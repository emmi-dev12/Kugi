import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  blocks: defineTable({
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
  }).index("by_date", ["date"]),

  settings: defineTable({
    key: v.string(),
    value: v.string(),
  }).index("by_key", ["key"]),
});
