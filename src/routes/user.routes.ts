import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { query } from '../db';
import { logger } from '../utils/logger';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get current user profile
router.get('/', async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;

        if (!userId) {
            return res.status(401).json({
                success: false,
                error: { message: 'User not authenticated' },
            });
        }

        // Get user from database
        const result = await query(
            `SELECT id, email, display_name, avatar_url, country_code, 
              grid_emission_factor, created_at 
       FROM users 
       WHERE id = $1`,
            [userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: { message: 'User not found' },
            });
        }

        const user = result.rows[0];

        // Get user statistics
        const stats = await query(
            `SELECT 
        COUNT(*) as total_activities,
        COALESCE(SUM(co2_kg), 0) as total_co2_kg,
        COALESCE(SUM(points), 0) as total_points_earned
       FROM activities 
       WHERE user_id = $1`,
            [userId]
        );

        // Get current points balance
        const pointsBalance = await query(
            `SELECT COALESCE(SUM(delta), 0) as balance
       FROM points_ledger
       WHERE user_id = $1`,
            [userId]
        );

        // Get streak information
        const { StreakService } = await import('../services/streakService');
        const streakInfo = await StreakService.getStreakInfo(userId);

        res.json({
            success: true,
            data: {
                user: {
                    id: user.id,
                    email: user.email,
                    displayName: user.display_name,
                    avatarUrl: user.avatar_url,
                    countryCode: user.country_code,
                    gridEmissionFactor: parseFloat(user.grid_emission_factor),
                    createdAt: user.created_at,
                },
                stats: {
                    totalActivities: parseInt(stats.rows[0].total_activities),
                    totalCo2Kg: parseFloat(stats.rows[0].total_co2_kg),
                    totalPointsEarned: parseInt(stats.rows[0].total_points_earned),
                    currentBalance: parseInt(pointsBalance.rows[0].balance),
                },
                streak: streakInfo,
            },
        });
    } catch (error) {
        logger.error('Error fetching user profile:', error);
        res.status(500).json({
            success: false,
            error: { message: 'Failed to fetch user profile' },
        });
    }
});

// Update user profile
router.patch('/', async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;

        if (!userId) {
            return res.status(401).json({
                success: false,
                error: { message: 'User not authenticated' },
            });
        }

        const { displayName, countryCode, gridEmissionFactor } = req.body;

        // Build update query dynamically
        const updates: string[] = [];
        const values: any[] = [];
        let paramCount = 1;

        if (displayName !== undefined) {
            updates.push(`display_name = $${paramCount++}`);
            values.push(displayName);
        }

        if (countryCode !== undefined) {
            updates.push(`country_code = $${paramCount++}`);
            values.push(countryCode);
        }

        if (gridEmissionFactor !== undefined) {
            updates.push(`grid_emission_factor = $${paramCount++}`);
            values.push(gridEmissionFactor);
        }

        if (updates.length === 0) {
            return res.status(400).json({
                success: false,
                error: { message: 'No fields to update' },
            });
        }

        values.push(userId);

        const result = await query(
            `UPDATE users 
       SET ${updates.join(', ')}, updated_at = NOW()
       WHERE id = $${paramCount}
       RETURNING id, email, display_name, avatar_url, country_code, grid_emission_factor`,
            values
        );

        logger.info('User profile updated', { userId });

        res.json({
            success: true,
            data: {
                user: {
                    id: result.rows[0].id,
                    email: result.rows[0].email,
                    displayName: result.rows[0].display_name,
                    avatarUrl: result.rows[0].avatar_url,
                    countryCode: result.rows[0].country_code,
                    gridEmissionFactor: parseFloat(result.rows[0].grid_emission_factor),
                },
            },
        });
    } catch (error) {
        logger.error('Error updating user profile:', error);
        res.status(500).json({
            success: false,
            error: { message: 'Failed to update user profile' },
        });
    }
});

export default router;
