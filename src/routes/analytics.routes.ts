import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { query } from '../db';
import { logger } from '../utils/logger';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get emissions time-series data
router.get('/emissions', async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const period = (req.query.period as string) || '7d';
        const groupBy = (req.query.groupBy as string) || 'day';

        if (!userId) {
            return res.status(401).json({
                success: false,
                error: { message: 'Unauthorized' },
            });
        }

        // Determine date range
        let days = 7;
        if (period === '30d') days = 30;
        else if (period === '90d') days = 90;

        // Determine grouping format
        let dateFormat = 'YYYY-MM-DD';
        let truncFormat = 'day';
        if (groupBy === 'week') {
            truncFormat = 'week';
            dateFormat = 'YYYY-"W"IW';
        } else if (groupBy === 'month') {
            truncFormat = 'month';
            dateFormat = 'YYYY-MM';
        }

        const result = await query(
            `SELECT 
                TO_CHAR(DATE_TRUNC($1, activity_date), $2) as period,
                COALESCE(SUM(co2_kg), 0) as total_co2,
                COUNT(*) as activity_count
            FROM activities
            WHERE user_id = $3
                AND activity_date >= NOW() - INTERVAL '1 day' * $4
            GROUP BY DATE_TRUNC($1, activity_date)
            ORDER BY DATE_TRUNC($1, activity_date) ASC`,
            [truncFormat, dateFormat, userId, days]
        );

        res.json({
            success: true,
            data: {
                timeSeries: result.rows.map((row) => ({
                    period: row.period,
                    totalCo2: parseFloat(row.total_co2),
                    activityCount: parseInt(row.activity_count),
                })),
                period,
                groupBy,
            },
        });
    } catch (error) {
        logger.error('Error fetching emissions analytics:', error);
        res.status(500).json({
            success: false,
            error: { message: 'Failed to fetch analytics' },
        });
    }
});

// Get emissions breakdown by activity type
router.get('/breakdown', async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const period = (req.query.period as string) || '30d';

        if (!userId) {
            return res.status(401).json({
                success: false,
                error: { message: 'Unauthorized' },
            });
        }

        // Determine date range
        let days = 30;
        if (period === '7d') days = 7;
        else if (period === '90d') days = 90;

        const result = await query(
            `SELECT 
                type,
                COALESCE(SUM(co2_kg), 0) as total_co2,
                COUNT(*) as activity_count
            FROM activities
            WHERE user_id = $1
                AND activity_date >= NOW() - INTERVAL '1 day' * $2
            GROUP BY type
            ORDER BY total_co2 DESC`,
            [userId, days]
        );

        // Calculate total for percentages
        const total = result.rows.reduce((sum, row) => sum + parseFloat(row.total_co2), 0);

        res.json({
            success: true,
            data: {
                breakdown: result.rows.map((row) => ({
                    type: row.type,
                    totalCo2: parseFloat(row.total_co2),
                    activityCount: parseInt(row.activity_count),
                    percentage: total > 0 ? (parseFloat(row.total_co2) / total) * 100 : 0,
                })),
                total,
                period,
            },
        });
    } catch (error) {
        logger.error('Error fetching breakdown analytics:', error);
        res.status(500).json({
            success: false,
            error: { message: 'Failed to fetch analytics' },
        });
    }
});

export default router;
