import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

export const log = internalMutation({
  args: {
    action: v.string(),
    resourceType: v.string(),
    resourceId: v.optional(v.string()),
    details: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("auditLog", { ...args, timestamp: Date.now() });
  },
});
