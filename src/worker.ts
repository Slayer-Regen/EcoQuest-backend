import { Queue, Worker } from 'bullmq';
import { createClient } from 'redis';
import dotenv from 'dotenv';
import { logger } from './utils/logger';
import { generateWeeklySummary } from './jobs/weeklySummary';
import { sendWeeklySummaryEmail } from './jobs/emailSummary';

dotenv.config();

const redisConnection = {
    host: process.env.REDIS_HOST || 'redis',
    port: parseInt(process.env.REDIS_PORT || '6379'),
};

// Define queues
export const activityQueue = new Queue('activities', { connection: redisConnection });
export const emailQueue = new Queue('emails', { connection: redisConnection });
export const summaryQueue = new Queue('summaries', { connection: redisConnection });

// Worker processors
const activityWorker = new Worker(
    'activities',
    async (job) => {
        logger.info(`Processing activity job: ${job.id}`, job.data);
        // TODO: Implement activity processing (analytics, notifications)
        return { success: true };
    },
    { connection: redisConnection }
);

const emailWorker = new Worker(
    'emails',
    async (job) => {
        logger.info(`Processing email job: ${job.id}`, job.data);
        const { userId, summary } = job.data;

        try {
            const sent = await sendWeeklySummaryEmail(userId, summary);
            return { success: sent };
        } catch (error) {
            logger.error(`Email job ${job.id} failed:`, error);
            throw error;
        }
    },
    { connection: redisConnection }
);

const summaryWorker = new Worker(
    'summaries',
    async (job) => {
        logger.info(`Processing summary job: ${job.id}`, job.data);
        const { userId } = job.data;

        try {
            const summary = await generateWeeklySummary(userId);

            // Optionally queue email job if emails are enabled
            if (process.env.ENABLE_WEEKLY_EMAILS === 'true') {
                await emailQueue.add('weekly-summary', { userId, summary });
                logger.info(`Queued email for user ${userId}`);
            }

            return { success: true, summary };
        } catch (error) {
            logger.error(`Summary job ${job.id} failed:`, error);
            throw error;
        }
    },
    { connection: redisConnection }
);

// Worker event handlers
[activityWorker, emailWorker, summaryWorker].forEach((worker) => {
    worker.on('completed', (job) => {
        logger.info(`Job ${job.id} completed successfully`);
    });

    worker.on('failed', (job, err) => {
        logger.error(`Job ${job?.id} failed:`, err);
    });
});

logger.info('🔧 Workers initialized and listening for jobs');

// Graceful shutdown
process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, closing workers...');
    await activityWorker.close();
    await emailWorker.close();
    await summaryWorker.close();
    process.exit(0);
});

