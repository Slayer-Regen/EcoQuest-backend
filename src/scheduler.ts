import cron from 'node-cron';
import { query } from './db';
import { logger } from './utils/logger';
import { summaryQueue } from './worker';

export function initializeScheduler() {
    // Schedule weekly summary generation for all users
    // Runs every Sunday at 11 PM (23:00)
    cron.schedule('0 23 * * 0', async () => {
        try {
            logger.info('Starting scheduled weekly summary generation');

            // Get all active users
            const users = await query('SELECT id, email FROM users');

            logger.info(`Queuing weekly summaries for ${users.rows.length} users`);

            // Queue summary generation for each user
            for (const user of users.rows) {
                await summaryQueue.add('generate', { userId: user.id });
            }

            logger.info(`Successfully queued ${users.rows.length} weekly summary jobs`);
        } catch (error) {
            logger.error('Error in scheduled weekly summary generation:', error);
        }
    });

    logger.info('📅 Scheduler initialized: Weekly summaries will run every Sunday at 11 PM');
}
