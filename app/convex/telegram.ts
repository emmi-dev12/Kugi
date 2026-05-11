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

    const emoji = block.emoji ? `${block.emoji} ` : "";
    const time = block.start_time ?? "";
    const text = `⏰ Reminder: ${emoji}<b>${block.title}</b>${time ? ` starts at ${time}` : " is coming up"}${block.notes ? `\n\n${block.notes}` : ""}`;

    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
    });
  },
});
