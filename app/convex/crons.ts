import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "check and send push notifications",
  { minutes: 1 },
  internal.pushActions.checkAndNotify,
);

export default crons;
