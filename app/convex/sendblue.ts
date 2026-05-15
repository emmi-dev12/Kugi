"use node";

import { internalAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { v } from "convex/values";

export const sendReminder = internalAction({
  args: {
    blockId: v.id("blocks"),
    offsetMessage: v.union(v.string(), v.null()),
  },
  handler: async (ctx, { blockId, offsetMessage }) => {
    const block = await ctx.runQuery(api.blocks.getById, { id: blockId });
    if (!block || block.completed) return;

    const apiKey = await ctx.runQuery(internal.settings.getSettingValue, { key: "sendblueApiKey" });
    const apiSecret = await ctx.runQuery(internal.settings.getSettingValue, { key: "sendblueApiSecret" });
    const recipient = await ctx.runQuery(internal.settings.getSettingValue, { key: "sendblueRecipient" });
    if (!apiKey || !apiSecret || !recipient) return;

    const channelEnabled = await ctx.runQuery(internal.settings.getSettingValue, { key: "channelEnabled_sendblue" });
    if (channelEnabled === "false") return;

    let content: string;
    if (offsetMessage) {
      content = offsetMessage;
    } else if (block.notify_message) {
      content = block.notify_message;
    } else {
      const templateRaw = await ctx.runQuery(internal.settings.getSettingValue, { key: "sendblueTemplate" });
      const DEFAULT_TEMPLATE = "⏰ {emoji}{title}{time}{notes}";
      const template = templateRaw || DEFAULT_TEMPLATE;
      const vars: Record<string, string> = {
        emoji: block.emoji ? `${block.emoji} ` : "",
        title: block.title ?? "",
        time: block.start_time ? ` starts at ${block.start_time}` : " is coming up",
        date: block.date ?? "",
        notes: block.notes ? `\n\n${block.notes}` : "",
        category: block.category ?? "",
      };
      content = template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? "");
    }

    await fetch("https://api.sendblue.co/api/send-message", {
      method: "POST",
      headers: {
        "sb-api-key-id": apiKey,
        "sb-api-secret-key": apiSecret,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ number: recipient, content }),
    });
  },
});
