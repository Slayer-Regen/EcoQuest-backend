import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { query } from '../db';
import { logger } from '../utils/logger';
import { Parser } from 'json2csv';

const router = Router();

router.use(authenticate);

// Export activities as CSV
router.get('/activities', async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, error: { message: 'Unauthorized' } });
        }

        // Get all activities for the user
        const result = await query(
            `SELECT 
                activity_type,
                activity_date,
                co2_kg,
                points,
                details,
                created_at
            FROM activities
            WHERE user_id = $1
            ORDER BY activity_date DESC`,
            [userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: { message: 'No activities found' },
            });
        }

        // Format data for CSV
        const csvData = result.rows.map((row: any) => ({
            'Activity Type': row.activity_type,
            'Date': new Date(row.activity_date).toLocaleDateString(),
            'CO2 (kg)': parseFloat(row.co2_kg).toFixed(2),
            'Points': row.points,
            'Details': JSON.stringify(row.details),
            'Logged At': new Date(row.created_at).toLocaleString(),
        }));

        // Convert to CSV
        const parser = new Parser();
        const csv = parser.parse(csvData);

        // Set headers for download
        const filename = `carbon-activities-${new Date().toISOString().split('T')[0]}.csv`;
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(csv);

        logger.info(`User ${userId} exported ${result.rows.length} activities to CSV`);
    } catch (error) {
        logger.error('Error exporting activities:', error);
        res.status(500).json({ success: false, error: { message: 'Failed to export activities' } });
    }
});

// Export summaries as CSV
router.get('/summaries', async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, error: { message: 'Unauthorized' } });
        }

        // Get all summaries for the user
        const result = await query(
            `SELECT 
                week_start,
                week_end,
                total_co2_kg,
                total_points,
                activity_count,
                created_at
            FROM weekly_summaries
            WHERE user_id = $1
            ORDER BY week_start DESC`,
            [userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: { message: 'No summaries found' },
            });
        }

        // Format data for CSV
        const csvData = result.rows.map((row: any) => ({
            'Week Start': new Date(row.week_start).toLocaleDateString(),
            'Week End': new Date(row.week_end).toLocaleDateString(),
            'Total CO2 (kg)': parseFloat(row.total_co2_kg).toFixed(2),
            'Total Points': row.total_points,
            'Activity Count': row.activity_count,
            'Generated At': new Date(row.created_at).toLocaleString(),
        }));

        // Convert to CSV
        const parser = new Parser();
        const csv = parser.parse(csvData);

        // Set headers for download
        const filename = `carbon-summaries-${new Date().toISOString().split('T')[0]}.csv`;
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(csv);

        logger.info(`User ${userId} exported ${result.rows.length} summaries to CSV`);
    } catch (error) {
        logger.error('Error exporting summaries:', error);
        res.status(500).json({ success: false, error: { message: 'Failed to export summaries' } });
    }
});

export default router;
