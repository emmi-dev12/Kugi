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
    end_date: v.optional(v.string()),
    telegramJobId: v.optional(v.id("_scheduled_functions")),
    recurrence: v.optional(v.union(v.literal("hourly"), v.literal("daily"), v.literal("monthly"), v.literal("yearly"))),
    recurrenceGroupId: v.optional(v.string()),
    googleEventId: v.optional(v.string()),
  }).index("by_date", ["date"]),

  settings: defineTable({
    key: v.string(),
    value: v.string(),
  }).index("by_key", ["key"]),

  pushSubscriptions: defineTable({
    subscription: v.string(), // JSON of PushSubscription
    userAgent: v.optional(v.string()),
  }),
});
