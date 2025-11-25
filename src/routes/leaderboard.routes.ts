import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { query } from '../db';
import { logger } from '../utils/logger';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get global leaderboard by lowest emissions
router.get('/global', async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const period = (req.query.period as string) || 'all';
        const limit = parseInt(req.query.limit as string) || 10;

        // Build date filter based on period
        let dateFilter = '';
        if (period === 'week') {
            dateFilter = "AND activity_date >= NOW() - INTERVAL '7 days'";
        } else if (period === 'month') {
            dateFilter = "AND activity_date >= NOW() - INTERVAL '30 days'";
        }

        // Get top users by lowest emissions
        const leaderboard = await query(
            `SELECT 
                u.id,
                u.display_name,
                u.avatar_url,
                COALESCE(SUM(a.co2_kg), 0) as total_co2,
                COUNT(a.id) as activity_count
            FROM users u
            LEFT JOIN activities a ON u.id = a.user_id ${dateFilter}
            GROUP BY u.id, u.display_name, u.avatar_url
            HAVING COUNT(a.id) > 0
            ORDER BY total_co2 ASC
            LIMIT $1`,
            [limit]
        );

        // Get current user's rank
        let userRank = null;
        if (userId) {
            const rankQuery = await query(
                `WITH ranked_users AS (
                    SELECT 
                        u.id,
                        COALESCE(SUM(a.co2_kg), 0) as total_co2,
                        ROW_NUMBER() OVER (ORDER BY COALESCE(SUM(a.co2_kg), 0) ASC) as rank
                    FROM users u
                    LEFT JOIN activities a ON u.id = a.user_id ${dateFilter}
                    GROUP BY u.id
                    HAVING COUNT(a.id) > 0
                )
                SELECT rank, total_co2
                FROM ranked_users
                WHERE id = $1`,
                [userId]
            );

            if (rankQuery.rows.length > 0) {
                userRank = {
                    rank: parseInt(rankQuery.rows[0].rank),
                    totalCo2: parseFloat(rankQuery.rows[0].total_co2),
                };
            }
        }

        res.json({
            success: true,
            data: {
                leaderboard: leaderboard.rows.map((row, index) => ({
                    rank: index + 1,
                    userId: row.id,
                    displayName: row.display_name,
                    avatarUrl: row.avatar_url,
                    totalCo2: parseFloat(row.total_co2),
                    activityCount: parseInt(row.activity_count),
                    isCurrentUser: row.id === userId,
                })),
                userRank,
                period,
            },
        });
    } catch (error) {
        logger.error('Error fetching global leaderboard:', error);
        res.status(500).json({
            success: false,
            error: { message: 'Failed to fetch leaderboard' },
        });
    }
});

// Get leaderboard by points earned
router.get('/points', async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const period = (req.query.period as string) || 'all';
        const limit = parseInt(req.query.limit as string) || 10;

        // Build date filter based on period
        let dateFilter = '';
        if (period === 'week') {
            dateFilter = "AND pl.created_at >= NOW() - INTERVAL '7 days'";
        } else if (period === 'month') {
            dateFilter = "AND pl.created_at >= NOW() - INTERVAL '30 days'";
        }

        // Get top users by points
        const leaderboard = await query(
            `SELECT 
                u.id,
                u.display_name,
                u.avatar_url,
                COALESCE(SUM(pl.delta), 0) as total_points
            FROM users u
            LEFT JOIN points_ledger pl ON u.id = pl.user_id ${dateFilter}
            GROUP BY u.id, u.display_name, u.avatar_url
            HAVING COALESCE(SUM(pl.delta), 0) > 0
            ORDER BY total_points DESC
            LIMIT $1`,
            [limit]
        );

        // Get current user's rank
        let userRank = null;
        if (userId) {
            const rankQuery = await query(
                `WITH ranked_users AS (
                    SELECT 
                        u.id,
                        COALESCE(SUM(pl.delta), 0) as total_points,
                        ROW_NUMBER() OVER (ORDER BY COALESCE(SUM(pl.delta), 0) DESC) as rank
                    FROM users u
                    LEFT JOIN points_ledger pl ON u.id = pl.user_id ${dateFilter}
                    GROUP BY u.id
                    HAVING COALESCE(SUM(pl.delta), 0) > 0
                )
                SELECT rank, total_points
                FROM ranked_users
                WHERE id = $1`,
                [userId]
            );

            if (rankQuery.rows.length > 0) {
                userRank = {
                    rank: parseInt(rankQuery.rows[0].rank),
                    totalPoints: parseInt(rankQuery.rows[0].total_points),
                };
            }
        }

        res.json({
            success: true,
            data: {
                leaderboard: leaderboard.rows.map((row, index) => ({
                    rank: index + 1,
                    userId: row.id,
                    displayName: row.display_name,
                    avatarUrl: row.avatar_url,
                    totalPoints: parseInt(row.total_points),
                    isCurrentUser: row.id === userId,
                })),
                userRank,
                period,
            },
        });
    } catch (error) {
        logger.error('Error fetching points leaderboard:', error);
        res.status(500).json({
            success: false,
            error: { message: 'Failed to fetch leaderboard' },
        });
    }
});

export default router;
