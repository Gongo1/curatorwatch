import cron from "node-cron";
import { collectData, CollectionResult } from "./collect-data";
import { prisma } from "../lib/db";

// Configuration
const CRON_SCHEDULE = process.env.CRON_SCHEDULE || "0 * * * *"; // Default: every hour at minute 0
const RUN_ON_START = process.env.RUN_ON_START !== "false"; // Default: run immediately on start

function log(message: string) {
  const timestamp = new Date().toISOString();
  console.log(`[SCHEDULER ${timestamp}] ${message}`);
}

function logError(message: string, error?: unknown) {
  const timestamp = new Date().toISOString();
  console.error(`[SCHEDULER ${timestamp}] ERROR: ${message}`, error ?? "");
}

let isRunning = false;
let lastResult: CollectionResult | null = null;
let runCount = 0;

async function runCollection() {
  // Prevent concurrent runs
  if (isRunning) {
    log("Skipping run - previous collection still in progress");
    return;
  }

  isRunning = true;
  runCount++;

  log(`Starting scheduled collection (run #${runCount})...`);

  try {
    const result = await collectData();
    lastResult = result;

    if (result.success) {
      log(
        `Collection #${runCount} completed successfully: ${result.vaultsProcessed} vaults, ${result.snapshotsCreated} snapshots in ${result.duration}ms`
      );
    } else {
      logError(
        `Collection #${runCount} completed with ${result.errors.length} errors`
      );
      result.errors.forEach((err) => logError(`  - ${err}`));
    }
  } catch (error) {
    logError(`Collection #${runCount} failed with exception`, error);
  } finally {
    isRunning = false;
  }
}

async function main() {
  log("=".repeat(60));
  log("Morpho Vault Analytics - Data Collection Scheduler");
  log("=".repeat(60));
  log(`Schedule: ${CRON_SCHEDULE}`);
  log(`Run on start: ${RUN_ON_START}`);
  log(`Process ID: ${process.pid}`);
  log("-".repeat(60));

  // Validate cron expression
  if (!cron.validate(CRON_SCHEDULE)) {
    logError(`Invalid cron expression: ${CRON_SCHEDULE}`);
    process.exit(1);
  }

  // Run immediately on start if configured
  if (RUN_ON_START) {
    log("Running initial collection...");
    await runCollection();
  }

  // Schedule recurring collection
  const task = cron.schedule(CRON_SCHEDULE, async () => {
    await runCollection();
  });

  log(`Scheduler started. Next run at: ${getNextRunTime(CRON_SCHEDULE)}`);
  log("Press Ctrl+C to stop");

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    log(`\nReceived ${signal}. Shutting down gracefully...`);

    task.stop();
    log("Cron job stopped");

    // Wait for any running collection to finish
    if (isRunning) {
      log("Waiting for current collection to complete...");
      while (isRunning) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    await prisma.$disconnect();
    log("Database connection closed");

    log(`Scheduler stopped. Total runs: ${runCount}`);
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  // Keep process alive
  process.stdin.resume();
}

function getNextRunTime(cronExpression: string): string {
  // Parse cron expression to estimate next run
  // This is a simplified version - node-cron doesn't expose next run time directly
  const parts = cronExpression.split(" ");
  const minute = parts[0];
  const hour = parts[1];

  const now = new Date();

  if (minute === "0" && hour === "*") {
    // Every hour at minute 0
    const next = new Date(now);
    next.setMinutes(0, 0, 0);
    if (next <= now) {
      next.setHours(next.getHours() + 1);
    }
    return next.toISOString();
  }

  return "See cron schedule";
}

// Start the scheduler
main().catch((error) => {
  logError("Failed to start scheduler", error);
  process.exit(1);
});
