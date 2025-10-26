import { Queue, Worker } from "bullmq";
import { logger } from "../utils/logger";
import { JobProcessor } from "../jobs/job.processor";

// Build BullMQ (Redis) connection from REDIS_URL if provided; otherwise fall back to host/port.
// This supports managed providers like Upstash (rediss:// with TLS).
function getConnection() {
  try {
    if (process.env.REDIS_URL) {
      const u = new URL(process.env.REDIS_URL);
      return {
        host: u.hostname,
        port: parseInt(u.port || "6379", 10),
        username: u.username || undefined,
        password: u.password || undefined,
        // Enable TLS for rediss:// URLs
        ...(u.protocol === "rediss:" ? { tls: {} } : {}),
      } as any;
    } else {
      return {
        host: process.env.REDIS_HOST || "127.0.0.1",
        port: parseInt(process.env.REDIS_PORT || "6379", 10),
      } as any;
    }
  } catch (e) {
    logger.error("Invalid REDIS_URL. Falling back to localhost:6379", e);
    return {
      host: process.env.REDIS_HOST || "127.0.0.1",
      port: parseInt(process.env.REDIS_PORT || "6379", 10),
    } as any;
  }
}

// Lazy queue creation - only create when actually accessed and REDIS_URL is set
let scrapingQueue: Queue | null = null;
let moderationQueue: Queue | null = null;
let publishingQueue: Queue | null = null;

export function getScrapingQueue(): Queue {
  if (!scrapingQueue) {
    scrapingQueue = new Queue("scraping", { connection: getConnection() });
  }
  return scrapingQueue;
}

export function getModerationQueue(): Queue {
  if (!moderationQueue) {
    moderationQueue = new Queue("moderation", { connection: getConnection() });
  }
  return moderationQueue;
}

export function getPublishingQueue(): Queue {
  if (!publishingQueue) {
    publishingQueue = new Queue("publishing", { connection: getConnection() });
  }
  return publishingQueue;
}

// Lazy job processor - only create when workers are actually created
let jobProcessor: JobProcessor | null = null;

function getJobProcessor(): JobProcessor {
  if (!jobProcessor) {
    jobProcessor = new JobProcessor();
  }
  return jobProcessor;
}

// Create workers
export const createWorkers = () => {
  const connection = getConnection();
  const processor = getJobProcessor();
  
  // Scraping worker (ENABLED - only metadata processing)
  const scrapingWorker = new Worker(
    "scraping",
    async (job) => {
      logger.info(`Processing scraping job: ${job.id}`);
      return await processor.processScrapingJob(job);
    },
    { connection }
  );

  // Removed AI rewriting and plagiarism workers

  // Moderation worker (DISABLED - converted to metadata-only)
  const moderationWorker = new Worker(
    "moderation",
    async (job) => {
      logger.info(`Processing moderation job (DISABLED): ${job.id}`);
      return await processor.processModerationJob(job);
    },
    { connection }
  );

  // Publishing worker (ENABLED - no AI dependency)
  const publishingWorker = new Worker(
    "publishing",
    async (job) => {
      logger.info(`Processing publishing job: ${job.id}`);
      return await processor.processPublishingJob(job);
    },
    { connection }
  );

  // Worker event listeners
  [
    scrapingWorker,
    moderationWorker,
    publishingWorker,
  ].forEach((worker) => {
    worker.on("completed", (job) => {
      logger.info(`Job ${job.id} completed successfully`);
    });

    worker.on("failed", (job, err) => {
      logger.error(`Job ${job?.id} failed:`, err);
    });
  });

  return {
    scrapingWorker,
    moderationWorker,
    publishingWorker,
  };
};

// Job scheduling functions
export const scheduleScrapingJob = async (sourceId?: string) => {
  try {
    const job = await getScrapingQueue().add(
      "scrape-all",
      { sourceId },
      {
        repeat: {
          every: 5 * 60 * 1000, // Every 5 minutes
        },
        removeOnComplete: 10,
        removeOnFail: 5,
      }
    );

    logger.info(`Scheduled scraping job: ${job.id}`);
    return job;
  } catch (error) {
    logger.error("Error scheduling scraping job:", error);
    throw error;
  }
};

// Removed addAIRewritingJob and addPlagiarismJob APIs

export const addModerationJob = async (articleId: string) => {
  // MODERATION DISABLED: This will now only approve all content
  try {
    const job = await getModerationQueue().add(
      "moderate-content",
      { articleId },
      {
        removeOnComplete: 10,
        removeOnFail: 5,
      }
    );

    logger.info(
      `Added moderation job (DISABLED): ${job.id} for article: ${articleId}`
    );
    return job;
  } catch (error) {
    logger.error("Error adding moderation job:", error);
    throw error;
  }
};

export const addPublishingJob = async (articleId: string) => {
  try {
    const job = await getPublishingQueue().add(
      "publish-article",
      { articleId },
      {
        removeOnComplete: 10,
        removeOnFail: 5,
      }
    );

    logger.info(
      `Added publishing job: ${job.id} for article: ${articleId}`
    );
    return job;
  } catch (error) {
    logger.error("Error adding publishing job:", error);
    throw error;
  }
};

export const createBullMQ = () => {
  return {
    scrapingQueue: getScrapingQueue(),
    moderationQueue: getModerationQueue(),
    publishingQueue: getPublishingQueue(),
    createWorkers,
    scheduleScrapingJob,
    addModerationJob,
    addPublishingJob,
  };
};
