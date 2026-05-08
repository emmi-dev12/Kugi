import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

// ── Subscriptions ──────────────────────────────────────────────

export const saveSubscription = mutation({
  args: { subscription: v.string(), userAgent: v.optional(v.string()) },
  handler: async (ctx, { subscription, userAgent }) => {
    const parsed = JSON.parse(subscription);
    const all = await ctx.db.query("pushSubscriptions").collect();
    const existing = all.find(s => {
      try { return JSON.parse(s.subscription).endpoint === parsed.endpoint; } catch { return false; }
    });
    if (existing) {
      await ctx.db.patch(existing._id, { subscription, userAgent });
      return existing._id;
    }
    return await ctx.db.insert("pushSubscriptions", { subscription, userAgent });
  },
});

export const removeSubscription = internalMutation({
  args: { id: v.id("pushSubscriptions") },
  handler: async (ctx, { id }) => { await ctx.db.delete(id); },
});

export const deleteMySubscription = mutation({
  args: { endpoint: v.string() },
  handler: async (ctx, { endpoint }) => {
    const all = await ctx.db.query("pushSubscriptions").collect();
    const sub = all.find(s => {
      try { return JSON.parse(s.subscription).endpoint === endpoint; } catch { return false; }
    });
    if (sub) await ctx.db.delete(sub._id);
  },
});

export const getSubscriptions = internalQuery({
  args: {},
  handler: async (ctx) => ctx.db.query("pushSubscriptions").collect(),
});

export const hasSubscription = query({
  args: { endpoint: v.string() },
  handler: async (ctx, { endpoint }) => {
    const all = await ctx.db.query("pushSubscriptions").collect();
    return all.some(s => {
      try { return JSON.parse(s.subscription).endpoint === endpoint; } catch { return false; }
    });
  },
});

// ── VAPID ──────────────────────────────────────────────────────

export const getVapidPublicKey = query({
  args: {},
  handler: async (ctx) => {
    const row = await ctx.db
      .query("settings").withIndex("by_key", q => q.eq("key", "vapidPublicKey")).first();
    return row?.value ?? null;
  },
});

export const getVapidKeys = internalQuery({
  args: {},
  handler: async (ctx) => {
    const pub = await ctx.db.query("settings").withIndex("by_key", q => q.eq("key", "vapidPublicKey")).first();
    const priv = await ctx.db.query("settings").withIndex("by_key", q => q.eq("key", "vapidPrivateKey")).first();
    if (!pub?.value || !priv?.value) return null;
    return { publicKey: pub.value, privateKey: priv.value };
  },
});

// Schedules key generation as an action (mutations can't use Node.js crypto)
export const initVapidKeys = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db
      .query("settings").withIndex("by_key", q => q.eq("key", "vapidPublicKey")).first();
    if (existing) return; // already generated
    await ctx.scheduler.runAfter(0, internal.pushActions.ensureVapidKeys, {});
  },
});

// ── Upcoming blocks (for cron) ─────────────────────────────────

export const getUpcomingBlocks = internalQuery({
  args: {},
  handler: async (ctx) => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const ahead = new Date(now);
    ahead.setDate(ahead.getDate() + 7);
    const aheadStr = ahead.toISOString().slice(0, 10);
    const all = await ctx.db.query("blocks").collect();
    return all.filter(b => !b.completed && b.date >= todayStr && b.date <= aheadStr);
  },
});
