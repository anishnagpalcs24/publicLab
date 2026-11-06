import { processExpiredSubscriptions } from "../services/subscription.service.js";

let workerTimer = null;
let isJobRunning = false;

/**
 * Executes a single safe run of the subscription expiry processing job.
 * Handles concurrency, catches errors, and logs results in non-test mode.
 */
export async function runSubscriptionExpiryJob() {
    if (isJobRunning) {
        return null;
    }
    isJobRunning = true;
    try {
        const summary = await processExpiredSubscriptions();
        if (summary.checked > 0 && process.env.NODE_ENV !== "test") {
            console.log(
                `[SUBSCRIPTION EXPIRY WORKER] Processed ${summary.checked} expired subscriptions: ${summary.cancelled} cancelled, ${summary.pastDue} past_due, ${summary.failed} failed.`
            );
        }
        return summary;
    } catch (err) {
        console.error("[SUBSCRIPTION EXPIRY WORKER] Fatal error during run:", err.message);
        throw err;
    } finally {
        isJobRunning = false;
    }
}

/**
 * Starts the periodic background worker for subscription expiry.
 * Runs once asynchronously and then periodically at intervalMs.
 */
export function startSubscriptionExpiryWorker({ intervalMs = 3600000 } = {}) {
    if (workerTimer) {
        return;
    }

    // In automated testing, the worker is invoked on-demand by test suites
    if (process.env.NODE_ENV === "test") {
        return;
    }

    // Execute once asynchronously on server boot
    runSubscriptionExpiryJob().catch((err) => {
        console.warn("[SUBSCRIPTION EXPIRY WORKER] Initial run warning:", err.message);
    });

    // Schedule recurring job
    workerTimer = setInterval(() => {
        runSubscriptionExpiryJob().catch((err) => {
            console.warn("[SUBSCRIPTION EXPIRY WORKER] Recurring run warning:", err.message);
        });
    }, intervalMs);

    // Prevent this interval timer from holding the Node process open on exit
    if (workerTimer.unref) {
        workerTimer.unref();
    }
}

/**
 * Stops the scheduled subscription expiry worker.
 */
export function stopSubscriptionExpiryWorker() {
    if (workerTimer) {
        clearInterval(workerTimer);
        workerTimer = null;
    }
}

