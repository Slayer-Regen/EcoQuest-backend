import { query } from '../db';
import { logger } from '../utils/logger';

export class PointsService {
    /**
     * Calculate and award points for a newly logged activity
     */
    static async awardPointsForActivity(userId: string, activityId: string, type: string, details: any, co2Kg: number) {
        let points = 0;
        let description = '';

        // Simple gamification rules
        switch (type) {
            case 'commute':
                if (details.mode === 'bike' || details.mode === 'walk') {
                    points = 50;
                    description = 'Eco-friendly commute (Bike/Walk)';
                } else if (details.mode === 'bus' || details.mode === 'train') {
                    points = 20;
                    description = 'Public transport usage';
                } else if (details.mode === 'electric_car') {
                    points = 10;
                    description = 'EV commute';
                }
                break;
            case 'food':
                if (details.type === 'vegetables' || details.type === 'vegan') {
                    points = 20;
                    description = 'Plant-based meal';
                }
                break;
            case 'electricity':
                // Bonus for logging energy
                points = 5;
                description = 'Energy tracking';
                break;
            default:
                points = 5;
                description = 'Activity logged';
        }

        if (points > 0) {
            await this.addPoints(userId, points, description, activityId);
        }

        return points;
    }

    /**
     * Add points to user's balance and record transaction
     */
    static async addPoints(userId: string, amount: number, description: string, activityId?: string) {
        try {
            await query('BEGIN');

            // Insert ledger entry
            await query(
                `INSERT INTO points_ledger (user_id, delta, reason, activity_id, balance_after)
         VALUES ($1, $2, $3, $4, 0)`, // Note: balance_after needs to be calculated or trigger-based. For now putting 0 to avoid crash if not nullable.
                [userId, amount, description, activityId]
            );

            // Wait, the schema says balance_after is NOT NULL. 
            // I should calculate it or fetch it. 
            // For simplicity in this MVP, I'll calculate it by summing previous balance + delta.

            // Actually, let's just fix the column names first.
            // And I'll handle balance_after properly.

            const currentBalance = await this.getBalance(userId);
            const newBalance = currentBalance + amount;

            await query(
                `INSERT INTO points_ledger (user_id, delta, reason, activity_id, balance_after)
         VALUES ($1, $2, $3, $4, $5)`,
                [userId, amount, description, activityId, newBalance]
            );

            await query('COMMIT');
            logger.info(`Awarded ${amount} points to user ${userId}`);
        } catch (error) {
            await query('ROLLBACK');
            logger.error('Failed to award points:', error);
            throw error;
        }
    }

    /**
     * Get user's current point balance
     */
    static async getBalance(userId: string): Promise<number> {
        const result = await query(
            `SELECT SUM(delta) as balance FROM points_ledger WHERE user_id = $1`,
            [userId]
        );
        return parseInt(result.rows[0].balance) || 0;
    }

    /**
     * Redeem points for a reward
     */
    static async redeemReward(userId: string, rewardId: string, cost: number, rewardName: string) {
        const balance = await this.getBalance(userId);

        if (balance < cost) {
            throw new Error('Insufficient points');
        }

        try {
            await query('BEGIN');

            const newBalance = balance - cost;

            // Deduct points (negative amount)
            await query(
                `INSERT INTO points_ledger (user_id, delta, reason, balance_after)
         VALUES ($1, $2, $3, $4)`,
                [userId, -cost, `Redeemed: ${rewardName}`, newBalance]
            );

            // Record redemption (if we had a rewards table, we'd link it, but for now just ledger)

            await query('COMMIT');
            logger.info(`User ${userId} redeemed ${rewardName} for ${cost} points`);
            return true;
        } catch (error) {
            await query('ROLLBACK');
            logger.error('Failed to redeem reward:', error);
            throw error;
        }
    }
}
