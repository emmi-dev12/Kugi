"use node";

import { internalAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { v } from "convex/values";

export const sendReminder = internalAction({
  args: { blockId: v.id("blocks") },
  handler: async (ctx, { blockId }) => {
    const block = await ctx.runQuery(api.blocks.getById, { id: blockId });
    if (!block || block.completed) return;

    const botToken = await ctx.runQuery(internal.settings.getSettingValue, { key: "telegramBotToken" });
    const chatId = await ctx.runQuery(internal.settings.getSettingValue, { key: "telegramChatId" });
    if (!botToken || !chatId) return;

    let text: string;
    if (block.notify_message) {
      text = block.notify_message;
    } else {
      const templateRaw = await ctx.runQuery(internal.settings.getSettingValue, { key: "telegramTemplate" });
      const DEFAULT_TEMPLATE = "⏰ Reminder: {emoji}<b>{title}</b>{time}{notes}";
      const template = templateRaw || DEFAULT_TEMPLATE;
      const vars: Record<string, string> = {
        emoji: block.emoji ? `${block.emoji} ` : "",
        title: block.title ?? "",
        time: block.start_time ? ` starts at ${block.start_time}` : " is coming up",
        date: block.date ?? "",
        notes: block.notes ? `\n\n${block.notes}` : "",
        category: block.category ?? "",
      };
      text = template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? "");
    }

    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
    });

    // Fire webhook if configured
    const webhookUrl = await ctx.runQuery(internal.settings.getSettingValue, { key: "webhookUrl" });
    if (webhookUrl) {
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
            notify_message: block.notify_message ?? null,
            fired_at: new Date().toISOString(),
          }),
        });
      } catch {}
    }
  },
});
