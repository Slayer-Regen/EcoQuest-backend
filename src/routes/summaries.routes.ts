import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { query } from '../db';
import { logger } from '../utils/logger';
import { summaryQueue } from '../worker';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get user's weekly summaries
router.get('/', async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;

        if (!userId) {
            return res.status(401).json({
                success: false,
                error: { message: 'Unauthorized' },
            });
        }

        const result = await query(
            `SELECT 
                id,
                week_start,
                week_end,
                total_co2_kg,
                total_points,
                activity_count,
                created_at
            FROM weekly_summaries
            WHERE user_id = $1
            ORDER BY week_start DESC
            LIMIT 20`,
            [userId]
        );

        res.json({
            success: true,
            data: result.rows.map((row) => ({
                id: row.id,
                weekStart: row.week_start,
                weekEnd: row.week_end,
                totalCo2Kg: parseFloat(row.total_co2_kg),
                totalPoints: parseInt(row.total_points),
                activityCount: parseInt(row.activity_count),
                createdAt: row.created_at,
            })),
        });
    } catch (error) {
        logger.error('Error fetching summaries:', error);
        res.status(500).json({
            success: false,
            error: { message: 'Failed to fetch summaries' },
        });
    }
});

// Manually trigger summary generation
router.post('/generate', async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;

        if (!userId) {
            return res.status(401).json({
                success: false,
                error: { message: 'Unauthorized' },
            });
        }

        // Queue the summary generation job
        const job = await summaryQueue.add('generate', { userId });

        logger.info(`Queued manual summary generation for user ${userId}`, {
            jobId: job.id,
        });

        res.json({
            success: true,
            message: 'Summary generation queued',
            data: { jobId: job.id },
        });
    } catch (error) {
        logger.error('Error queuing summary generation:', error);
        res.status(500).json({
            success: false,
            error: { message: 'Failed to queue summary generation' },
        });
    }
});

export default router;
