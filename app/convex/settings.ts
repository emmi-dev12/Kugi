import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { v } from "convex/values";

function generateKey(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let s = "kugi_";
  for (let i = 0; i < 40; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export const getApiKey = query({
  args: {},
  handler: async (ctx) => {
    const row = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "apiKey"))
      .first();
    return row?.value ?? null;
  },
});

export const ensureApiKey = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "apiKey"))
      .first();
    if (existing) return existing.value;
    const key = generateKey();
    await ctx.db.insert("settings", { key: "apiKey", value: key });
    return key;
  },
});

export const getCustomCategories = query({
  args: {},
  handler: async (ctx) => {
    const row = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "customCategories"))
      .first();
    if (!row) return {};
    try { return JSON.parse(row.value); } catch { return {}; }
  },
});

export const setCustomCategories = mutation({
  args: { value: v.string() },
  handler: async (ctx, { value }) => {
    const existing = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "customCategories"))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { value });
    } else {
      await ctx.db.insert("settings", { key: "customCategories", value });
    }
  },
});

export const rotateApiKey = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "apiKey"))
      .first();
    const key = generateKey();
    if (existing) {
      await ctx.db.patch(existing._id, { value: key });
    } else {
      await ctx.db.insert("settings", { key: "apiKey", value: key });
    }
    return key;
  },
});

// ── Internal helpers used by push.ts ──────────────────────────

export const upsertSetting = internalMutation({
  args: { key: v.string(), value: v.string() },
  handler: async (ctx, { key, value }) => {
    const existing = await ctx.db
      .query("settings").withIndex("by_key", q => q.eq("key", key)).first();
    if (existing) await ctx.db.patch(existing._id, { value });
    else await ctx.db.insert("settings", { key, value });
  },
});

export const getSettingValue = internalQuery({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    const row = await ctx.db
      .query("settings").withIndex("by_key", q => q.eq("key", key)).first();
    return row?.value ?? null;
  },
});

// ── Reminders + timezone (synced from client) ──────────────────

export const getReminders = query({
  args: {},
  handler: async (ctx) => {
    const row = await ctx.db
      .query("settings").withIndex("by_key", q => q.eq("key", "reminders")).first();
    if (!row) return null;
    try { return JSON.parse(row.value); } catch { return null; }
  },
});

export const setReminders = mutation({
  args: { value: v.string() },
  handler: async (ctx, { value }) => {
    const existing = await ctx.db
      .query("settings").withIndex("by_key", q => q.eq("key", "reminders")).first();
    if (existing) await ctx.db.patch(existing._id, { value });
    else await ctx.db.insert("settings", { key: "reminders", value });
  },
});

export const setTimezone = mutation({
  args: { value: v.string() },
  handler: async (ctx, { value }) => {
    const existing = await ctx.db
      .query("settings").withIndex("by_key", q => q.eq("key", "timezone")).first();
    if (existing) await ctx.db.patch(existing._id, { value });
    else await ctx.db.insert("settings", { key: "timezone", value });
  },
});

// ── Composio API key (Google Calendar integration) ─────────────

export const getComposioApiKey = query({
  args: {},
  handler: async (ctx) => {
    const row = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "composioApiKey"))
      .first();
    return row?.value || null;
  },
});

export const setComposioApiKey = mutation({
  args: { value: v.string() },
  handler: async (ctx, { value }) => {
    const existing = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "composioApiKey"))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { value });
    } else if (value) {
      await ctx.db.insert("settings", { key: "composioApiKey", value });
    }
  },
});

// ── Per-integration enable/disable toggles ─────────────────────

export const getIntegrationEnabled = query({
  args: { integration: v.string() },
  handler: async (ctx, { integration }) => {
    const key = `integration_${integration}`;
    const row = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", key))
      .first();
    // Default true so existing users don't lose Google Calendar
    if (!row) return true;
    return row.value !== "false";
  },
});

export const getTelegramConfig = query({
  args: {},
  handler: async (ctx) => {
    const botTokenRow = await ctx.db.query("settings").withIndex("by_key", q => q.eq("key", "telegramBotToken")).first();
    const chatIdRow = await ctx.db.query("settings").withIndex("by_key", q => q.eq("key", "telegramChatId")).first();
    const offsetRow = await ctx.db.query("settings").withIndex("by_key", q => q.eq("key", "telegramOffsetMinutes")).first();
    const offsetMinutes = offsetRow ? (parseInt(offsetRow.value) || 15) : 15;
    return { botToken: botTokenRow?.value ?? null, chatId: chatIdRow?.value ?? null, offsetMinutes };
  },
});

export const setTelegramConfig = mutation({
  args: { botToken: v.string(), chatId: v.string(), offsetMinutes: v.number() },
  handler: async (ctx, { botToken, chatId, offsetMinutes }) => {
    for (const [key, value] of [["telegramBotToken", botToken], ["telegramChatId", chatId], ["telegramOffsetMinutes", String(offsetMinutes)]] as const) {
      const existing = await ctx.db.query("settings").withIndex("by_key", q => q.eq("key", key)).first();
      if (existing) await ctx.db.patch(existing._id, { value });
      else await ctx.db.insert("settings", { key, value });
    }
  },
});

export const setIntegrationEnabled = mutation({
  args: { integration: v.string(), enabled: v.boolean() },
  handler: async (ctx, { integration, enabled }) => {
    const key = `integration_${integration}`;
    const value = enabled ? "true" : "false";
    const existing = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", key))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { value });
    } else {
      await ctx.db.insert("settings", { key, value });
    }
  },
});
