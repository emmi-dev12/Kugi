"use node";

import { action, internalAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { v } from "convex/values";
import { ComposioToolSet } from "composio-core";

const ENTITY_ID = "boop-default";

// Internal sync worker
export const syncNotion = internalAction({
  args: { composioApiKey: v.string() },
  handler: async (ctx, { composioApiKey }) => {
    const toolset = new ComposioToolSet({ apiKey: composioApiKey });

    // ── Find the "Kugi" database in Notion ────────────────────────
    const searchResult = await toolset.executeAction({
      action: "NOTION_SEARCH",
      params: { query: "Kugi", filter: { value: "database", property: "object" } },
      entityId: ENTITY_ID,
    });

    const results: any[] = (searchResult as any)?.data?.results ?? [];
    const db = results.find(
      (r: any) =>
        r.object === "database" &&
        (r.title?.[0]?.plain_text ?? "").toLowerCase().includes("kugi"),
    );

    if (!db) {
      throw new Error(
        "No 'Kugi' database found in Notion. Create a database named 'Kugi' in Notion, then sync again.",
      );
    }

    const databaseId: string = db.id;

    // Store the database ID for reference
    await ctx.runMutation(internal.settings.upsertSetting, {
      key: "notionDatabaseId",
      value: databaseId,
    });

    // ── Get already-synced block IDs ──────────────────────────────
    const syncedRaw = await ctx.runQuery(internal.settings.getSettingValue, {
      key: "notionSyncedIds",
    });
    const syncedIds: string[] = syncedRaw ? JSON.parse(syncedRaw) : [];
    const syncedSet = new Set(syncedIds);

    // ── Push upcoming incomplete blocks with a time ───────────────
    const allBlocks: any[] = await ctx.runQuery(api.blocks.list);
    const today = new Date().toISOString().slice(0, 10);
    const toSync = allBlocks.filter(
      (b: any) => !b.completed && b.date >= today && b.start_time && !syncedSet.has(b._id),
    );

    const newlySynced: string[] = [];

    for (const block of toSync) {
      try {
        await toolset.executeAction({
          action: "NOTION_CREATE_DATABASE_PAGE",
          params: {
            database_id: databaseId,
            properties: {
              title: {
                title: [{ text: { content: `${block.emoji ? block.emoji + " " : ""}${block.title}` } }],
              },
            },
          },
          entityId: ENTITY_ID,
        });
        newlySynced.push(block._id);
      } catch {
        // Continue syncing other blocks even if one fails
      }
    }

    // Persist the updated synced IDs list
    if (newlySynced.length > 0) {
      const updated = [...syncedIds, ...newlySynced];
      await ctx.runMutation(internal.settings.upsertSetting, {
        key: "notionSyncedIds",
        value: JSON.stringify(updated),
      });
    }

    return { synced: newlySynced.length };
  },
});

// Public action called from the "Sync now" button in Settings.
export const triggerNotionSync = action({
  args: {},
  handler: async (ctx) => {
    const apiKey = await ctx.runQuery(internal.settings.getSettingValue, {
      key: "composioApiKey",
    });
    if (!apiKey) {
      throw new Error(
        "No Composio API key saved. Add one in Settings → Integrations.",
      );
    }
    await ctx.runAction(internal.notionSyncActions.syncNotion, {
      composioApiKey: apiKey,
    });
  },
});

// Internal action invoked by the cron — silent on missing key.
export const cronNotionSync = internalAction({
  args: {},
  handler: async (ctx) => {
    const apiKey = await ctx.runQuery(internal.settings.getSettingValue, {
      key: "composioApiKey",
    });
    if (!apiKey) return;

    // Check if Notion integration is enabled
    const enabledRaw = await ctx.runQuery(internal.settings.getSettingValue, {
      key: "integration_notion",
    });
    if (enabledRaw === "false") return;

    try {
      await ctx.runAction(internal.notionSyncActions.syncNotion, {
        composioApiKey: apiKey,
      });
    } catch {
      // Don't crash the cron if Composio/Notion is unreachable
    }
  },
});
