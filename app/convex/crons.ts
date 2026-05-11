import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "check and send push notifications",
  { minutes: 1 },
  internal.pushActions.checkAndNotify,
);

// Pull changes from Google Calendar every 10 minutes
crons.interval(
  "sync google calendar",
  { minutes: 10 },
  internal.calendarSyncActions.cronSync,
);

// Push upcoming blocks to Notion every 10 minutes
crons.interval(
  "sync notion",
  { minutes: 10 },
  internal.notionSyncActions.cronNotionSync,
);

export default crons;
