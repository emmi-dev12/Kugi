"use node";

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import webpush from "web-push";

// Convert a local "YYYY-MM-DD HH:MM" to a UTC Date using the given IANA timezone.
// Uses iterative correction via Intl — no external library needed.
function localToUTC(dateStr: string, timeStr: string, tz: string): Date {
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
  return new Date(utcMs);
}

// ── Generate VAPID keys on first use ───────────────────────────

export const ensureVapidKeys = internalAction({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.runQuery(internal.push.getVapidPublicKey, {});
    if (existing) return existing;
    const keys = webpush.generateVAPIDKeys();
    await ctx.runMutation(internal.settings.upsertSetting, { key: "vapidPublicKey", value: keys.publicKey });
    await ctx.runMutation(internal.settings.upsertSetting, { key: "vapidPrivateKey", value: keys.privateKey });
    return keys.publicKey;
  },
});

// ── Cron: check blocks and fire push notifications ─────────────

export const checkAndNotify = internalAction({
  args: {},
  handler: async (ctx) => {
    const subscriptions = await ctx.runQuery(internal.push.getSubscriptions, {});
    if (!subscriptions.length) return;

    const vapidKeys = await ctx.runQuery(internal.push.getVapidKeys, {});
    if (!vapidKeys) return;

    const remindersJson = await ctx.runQuery(internal.settings.getSettingValue, { key: "reminders" });
    const reminders: any[] = remindersJson ? JSON.parse(remindersJson) : [];
    if (!reminders.length) return;

    const timezone = (await ctx.runQuery(internal.settings.getSettingValue, { key: "timezone" })) || "UTC";
    const blocks = await ctx.runQuery(internal.push.getUpcomingBlocks, {});

    const firedJson = await ctx.runQuery(internal.settings.getSettingValue, { key: "firedPushKeys" });
    const fired: Record<string, number> = firedJson ? JSON.parse(firedJson) : {};

    const now = new Date();
    const toFire: { block: any; reminder: any; autoLabel: string; fireKey: string }[] = [];

    for (const block of blocks) {
      for (const reminder of reminders) {
        const fireKey = `${block._id}-${reminder.id}`;
        if (fired[fireKey]) continue;

        let shouldFire = false;
        let autoLabel = "";

        if (reminder.offsetMinutes >= 1440) {
          const daysBack = Math.floor(reminder.offsetMinutes / 1440);
          const atTime = reminder.atTime || "09:00";
          const [bY, bM, bD] = block.date.split("-").map(Number);
          const targetDateStr = new Date(Date.UTC(bY, bM - 1, bD - daysBack)).toISOString().slice(0, 10);
          const target = localToUTC(targetDateStr, atTime, timezone);
          const diffMins = (target.getTime() - now.getTime()) / 60_000;
          shouldFire = diffMins >= -1 && diffMins < 1;
          autoLabel = daysBack === 1 ? "Tomorrow" : `In ${daysBack} days`;
        } else if (block.start_time) {
          const target = localToUTC(block.date, block.start_time, timezone);
          const diffMins = (target.getTime() - now.getTime()) / 60_000;
          const off = reminder.offsetMinutes;
          shouldFire = diffMins > 0 && diffMins <= off + 1 && diffMins > off - 1;
          const left = Math.round(diffMins);
          autoLabel = left <= 1 ? "Starting now" : `in ${left} min`;
        }

        if (shouldFire) {
          toFire.push({ block, reminder, autoLabel, fireKey });
          fired[fireKey] = now.getTime();
        }
      }
    }

    if (!toFire.length) return;

    webpush.setVapidDetails("mailto:kugi@app.local", vapidKeys.publicKey, vapidKeys.privateKey);

    for (const { block, reminder, autoLabel, fireKey } of toFire) {
      const timeStr = block.start_time
        ? ` · ${block.start_time}${block.end_time ? "–" + block.end_time : ""}`
        : "";
      const body = block.notify_message || reminder.message || `${autoLabel}${timeStr}`;
      const payload = JSON.stringify({
        title: `${block.emoji || "📅"} ${block.title}`,
        body,
        tag: fireKey,
      });

      for (const sub of subscriptions) {
        try {
          await webpush.sendNotification(JSON.parse(sub.subscription), payload);
        } catch (e: any) {
          if (e.statusCode === 410 || e.statusCode === 404) {
            await ctx.runMutation(internal.push.removeSubscription, { id: sub._id });
          }
        }
      }
    }

    // Persist fired keys, pruning entries older than 7 days.
    // Also cap total entries to prevent unbounded blob growth.
    const MAX_FIRED_KEYS = 5_000;
    const cutoff = now.getTime() - 7 * 24 * 60 * 60 * 1000;
    let entries = Object.entries(fired).filter(([, t]) => t > cutoff);
    if (entries.length > MAX_FIRED_KEYS) {
      // Evict oldest entries first
      entries.sort(([, a], [, b]) => b - a);
      entries = entries.slice(0, MAX_FIRED_KEYS);
    }
    const cleaned = Object.fromEntries(entries);
    await ctx.runMutation(internal.settings.upsertSetting, {
      key: "firedPushKeys",
      value: JSON.stringify(cleaned),
    });
  },
});
