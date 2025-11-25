import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { query } from '../db';
import { logger } from '../utils/logger';
import { CarbonCalculator } from '../services/carbonCalculator';
import { PointsService } from '../services/pointsService';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Create a new activity
router.post('/', async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ success: false, error: { message: 'Unauthorized' } });

        const { type, date, details } = req.body;

        if (!type || !date || !details) {
            return res.status(400).json({ success: false, error: { message: 'Missing required fields' } });
        }

        // Calculate carbon footprint
        let co2Kg = 0;

        switch (type) {
            case 'commute':
                co2Kg = await CarbonCalculator.calculateCommute(
                    details.mode,
                    parseFloat(details.distance),
                    parseInt(details.passengers || '1')
                );
                break;
            case 'electricity':
                co2Kg = await CarbonCalculator.calculateElectricity(
                    parseFloat(details.kwh),
                    details.countryCode
                );
                break;
            case 'flight':
                co2Kg = await CarbonCalculator.calculateFlight(
                    parseFloat(details.distance),
                    details.class
                );
                break;
            case 'food':
                co2Kg = await CarbonCalculator.calculateFood(
                    details.type,
                    parseFloat(details.weight)
                );
                break;
            default:
                return res.status(400).json({ success: false, error: { message: 'Invalid activity type' } });
        }

        // Insert into database
        const result = await query(
            `INSERT INTO activities (user_id, type, activity_date, payload, co2_kg)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
            [userId, type, date, details, co2Kg]
        );

        const activity = result.rows[0];
        logger.info('Activity created', { userId, type, co2Kg });

        // Award points
        try {
            await PointsService.awardPointsForActivity(userId, activity.id, type, details, co2Kg);
        } catch (err) {
            logger.error('Failed to award points:', err);
            // Don't fail the request if points fail
        }

        res.status(201).json({
            success: true,
            data: activity,
        });
    } catch (error) {
        logger.error('Error creating activity:', error);
        res.status(500).json({ success: false, error: { message: 'Failed to create activity' } });
    }
});

// Get all activities for the user
router.get('/', async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const offset = (page - 1) * limit;

        const result = await query(
            `SELECT * FROM activities 
       WHERE user_id = $1 
       ORDER BY activity_date DESC 
       LIMIT $2 OFFSET $3`,
            [userId, limit, offset]
        );

        const countResult = await query(
            'SELECT COUNT(*) FROM activities WHERE user_id = $1',
            [userId]
        );

        res.json({
            success: true,
            data: result.rows,
            pagination: {
                page,
                limit,
                total: parseInt(countResult.rows[0].count),
            },
        });
    } catch (error) {
        logger.error('Error fetching activities:', error);
        res.status(500).json({ success: false, error: { message: 'Failed to fetch activities' } });
    }
});

// Delete an activity
router.delete('/:id', async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const activityId = req.params.id;

        const result = await query(
            'DELETE FROM activities WHERE id = $1 AND user_id = $2 RETURNING id',
            [activityId, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: { message: 'Activity not found' } });
        }

        logger.info('Activity deleted', { userId, activityId });

        res.json({ success: true, message: 'Activity deleted successfully' });
    } catch (error) {
        logger.error('Error deleting activity:', error);
        res.status(500).json({ success: false, error: { message: 'Failed to delete activity' } });
    }
});

export default router;
