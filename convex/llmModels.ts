import { query, internalQuery } from "./_generated/server";

export const listEnabledModels = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("llmModels").filter((q) => q.eq(q.field("enabled"), true)).collect();
  },
});

export const listEnabledModelsInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("llmModels")
      .filter((q) => q.eq(q.field("enabled"), true))
      .collect();
  },
});
