import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { query } from '../db';
import { logger } from '../utils/logger';
import { PointsService } from '../services/pointsService';

const router = Router();

router.use(authenticate);

// Get points balance and history
router.get('/', async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ success: false, error: { message: 'Unauthorized' } });

        const balance = await PointsService.getBalance(userId);

        const historyResult = await query(
            `SELECT * FROM points_ledger 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT 50`,
            [userId]
        );

        res.json({
            success: true,
            data: {
                balance,
                history: historyResult.rows,
            },
        });
    } catch (error) {
        logger.error('Error fetching points:', error);
        res.status(500).json({ success: false, error: { message: 'Failed to fetch points' } });
    }
});

// Redeem points
router.post('/redeem', async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ success: false, error: { message: 'Unauthorized' } });

        const { rewardId, cost, name } = req.body;

        if (!rewardId || !cost || !name) {
            return res.status(400).json({ success: false, error: { message: 'Missing required fields' } });
        }

        await PointsService.redeemReward(userId, rewardId, cost, name);

        res.json({
            success: true,
            message: 'Reward redeemed successfully',
        });
    } catch (error: any) {
        logger.error('Error redeeming reward:', error);
        if (error.message === 'Insufficient points') {
            return res.status(400).json({ success: false, error: { message: 'Insufficient points' } });
        }
        res.status(500).json({ success: false, error: { message: 'Failed to redeem reward' } });
    }
});

// Get redemption history
router.get('/history', async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ success: false, error: { message: 'Unauthorized' } });

        const historyResult = await query(
            `SELECT 
                r.id,
                r.reward_id,
                r.points_spent,
                r.status,
                r.created_at,
                rw.name as reward_name,
                rw.description as reward_description
            FROM redemptions r
            LEFT JOIN rewards rw ON r.reward_id = rw.id
            WHERE r.user_id = $1
            ORDER BY r.created_at DESC
            LIMIT 50`,
            [userId]
        );

        res.json({
            success: true,
            data: historyResult.rows.map((row: any) => ({
                id: row.id,
                rewardId: row.reward_id,
                rewardName: row.reward_name,
                rewardDescription: row.reward_description,
                pointsSpent: parseInt(row.points_spent),
                status: row.status,
                redeemedAt: row.created_at,
            })),
        });
    } catch (error) {
        logger.error('Error fetching redemption history:', error);
        res.status(500).json({ success: false, error: { message: 'Failed to fetch redemption history' } });
    }
});

export default router;
