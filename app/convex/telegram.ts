"use node";

import { internalAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { v } from "convex/values";

export const sendReminder = internalAction({
  args: {
    blockId: v.id("blocks"),
    offsetMessage: v.union(v.string(), v.null()),  // per-reminder custom message (null = not set)
  },
  handler: async (ctx, { blockId, offsetMessage }) => {
    const block = await ctx.runQuery(api.blocks.getById, { id: blockId });
    if (!block || block.completed) return;

    const botToken = await ctx.runQuery(internal.settings.getSettingValue, { key: "telegramBotToken" });
    const chatId = await ctx.runQuery(internal.settings.getSettingValue, { key: "telegramChatId" });
    if (!botToken || !chatId) return;

    // Strip all HTML tags and decode entities from user-supplied verbatim text so
    // it is not rendered as HTML by Telegram's parse_mode:HTML.
    const stripHtml = (s: string) =>
      s.replace(/<[^>]*>/g, "")
       .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
       .replace(/&amp;/g, "&").replace(/&quot;/g, '"')
       .replace(/&#x27;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));

    let text: string;
    // Priority: per-reminder message > block-level notify_message > global template
    if (offsetMessage) {
      text = stripHtml(offsetMessage);
    } else if (block.notify_message) {
      text = stripHtml(block.notify_message);
    } else {
      const templateRaw = await ctx.runQuery(internal.settings.getSettingValue, { key: "telegramTemplate" });
      const DEFAULT_TEMPLATE = "⏰ Reminder: {emoji}<b>{title}</b>{time}{notes}";
      const template = templateRaw || DEFAULT_TEMPLATE;
      const esc = (s: string) =>
        s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const vars: Record<string, string> = {
        emoji: block.emoji ? `${block.emoji} ` : "",
        title: esc(block.title ?? ""),
        time: block.start_time ? ` starts at ${block.start_time}` : " is coming up",
        date: block.date ?? "",
        notes: block.notes ? `\n\n${esc(block.notes)}` : "",
        category: esc(block.category ?? ""),
      };
      text = template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? "");
    }

    try {
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
      });
    } catch (e: any) {
      // Redact token from error messages before any potential propagation
      const msg = (e?.message ?? String(e)).replace(new RegExp(botToken, "g"), "[REDACTED]");
      throw new Error(msg);
    }

    // Fire webhook if configured
    const webhookUrl = await ctx.runQuery(internal.settings.getSettingValue, { key: "webhookUrl" });
    if (webhookUrl) {
      // Defense-in-depth: block known cloud-metadata and private hostnames at call time,
      // in case DNS rebinding occurs after the URL was validated at write time.
      const BLOCKED_HOSTS = new Set([
        "169.254.169.254",
        "metadata.google.internal",
        "metadata.internal",
        "169.254.169.254.nip.io",
      ]);
      let skip = false;
      try {
        const h = new URL(webhookUrl).hostname.toLowerCase();
        if (BLOCKED_HOSTS.has(h)) {
          skip = true;
        } else {
          // Check raw IPv4 private ranges
          const v4 = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
          if (v4) {
            const [, a, b] = v4.map(Number);
            if (a === 169 && b === 254) skip = true;
            else if (a === 10) skip = true;
            else if (a === 172 && b >= 16 && b <= 31) skip = true;
            else if (a === 192 && b === 168) skip = true;
          }
        }
      } catch { skip = true; }
      if (skip) {
        console.warn("Webhook blocked: hostname resolves to a private/metadata address", webhookUrl);
      } else {
      try {
        await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event: "reminder",
            blockId,
            title: block.title,
            emoji: block.emoji ?? null,
            date: block.date,
            start_time: block.start_time ?? null,
            end_time: block.end_time ?? null,
            category: block.category,
            notes: block.notes ?? null,
            notify_message: offsetMessage || block.notify_message || null,
            fired_at: new Date().toISOString(),
          }),
        });
      } catch {}
      } // end !skip
    }
  },
});
