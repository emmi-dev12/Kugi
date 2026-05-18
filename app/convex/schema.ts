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
    telegramJobIds: v.optional(v.array(v.string())),
    sendblueJobIds: v.optional(v.array(v.string())),
    recurrence: v.optional(v.union(v.literal("hourly"), v.literal("daily"), v.literal("monthly"), v.literal("yearly"))),
    recurrenceGroupId: v.optional(v.string()),
    googleEventId: v.optional(v.string()),
    notify_message: v.optional(v.string()),
    blockReminderOffsets: v.optional(v.array(v.number())), // legacy — kept for compat
    blockReminders: v.optional(v.array(v.object({
      atTime: v.string(),           // HH:MM — exact local time to fire on the block's date
      message: v.optional(v.string()),
    }))),
  }).index("by_date", ["date"])
    .index("by_recurrence_group", ["recurrenceGroupId"]),

  settings: defineTable({
    key: v.string(),
    value: v.string(),
  }).index("by_key", ["key"]),

  pushSubscriptions: defineTable({
    subscription: v.string(), // JSON of PushSubscription
    userAgent: v.optional(v.string()),
  }),

  auditLog: defineTable({
    action: v.string(),
    resourceType: v.string(),
    resourceId: v.optional(v.string()),
    timestamp: v.number(),
    details: v.optional(v.string()),
  }).index("by_timestamp", ["timestamp"]),
});
