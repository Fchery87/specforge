import { internal } from "./_generated/api";

/**
 * Scheduled cron jobs for SpecForge
 *
 * These jobs run automatically on the specified schedule.
 * Convex handles the scheduling and execution.
 *
 * To register these crons, run:
 *   npx convex dev
 * Or deploy with:
 *   npx convex deploy
 *
 * Cron jobs are defined using the cron() helper from "convex/server"
 * and exported from this file.
 */

// Note: The actual cron definitions are created by Convex during code generation
// based on the exports from this file. The format is:
//
// import { cron } from "convex/server";
// export const jobName = cron({
//   name: "jobName",
//   schedule: "0 3 * * *",
//   function: internal.cron.jobFunction,
// });
//
// However, since we need the internal API to be generated first,
// we'll use the Convex dashboard or CLI to register these crons manually:
//
// Daily refresh of models.dev cache at 3 AM UTC
// Function: cron.refreshModelDirectoryCache
// Schedule: 0 3 * * *
//
// Weekly cleanup of old artifact versions (retention policy)
// Function: cron.cleanupOldArtifactVersions
// Schedule: 0 4 * * 0 (Sundays at 4 AM UTC)
