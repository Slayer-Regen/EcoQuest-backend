import { query } from '../db';
import { logger } from '../utils/logger';
import { PointsService } from './pointsService';

// Streak milestone rewards
const STREAK_MILESTONES = {
    7: 50,
    30: 250,
    100: 1000,
    365: 5000,
};

export class StreakService {
    /**
     * Update user's login streak and award milestone points
     */
    static async updateStreak(userId: string): Promise<{
        currentStreak: number;
        milestoneReached?: number;
        pointsAwarded?: number;
    }> {
        try {
            // Get user's current streak data
            const userResult = await query(
                'SELECT current_streak, longest_streak, last_login_date, total_streak_points FROM users WHERE id = $1',
                [userId]
            );

            if (userResult.rows.length === 0) {
                throw new Error('User not found');
            }

            const user = userResult.rows[0];
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const lastLogin = user.last_login_date ? new Date(user.last_login_date) : null;
            if (lastLogin) {
                lastLogin.setHours(0, 0, 0, 0);
            }

            let currentStreak = user.current_streak || 0;
            let longestStreak = user.longest_streak || 0;
            let milestoneReached: number | undefined;
            let pointsAwarded: number | undefined;

            // Check if user already logged in today
            if (lastLogin && lastLogin.getTime() === today.getTime()) {
                logger.info(`User ${userId} already logged in today, streak unchanged`);
                return { currentStreak };
            }

            // Check if streak should continue or reset
            if (lastLogin) {
                const daysDiff = Math.floor((today.getTime() - lastLogin.getTime()) / (1000 * 60 * 60 * 24));

                if (daysDiff === 1) {
                    // Consecutive day - increment streak
                    currentStreak += 1;
                } else if (daysDiff > 1) {
                    // Streak broken - reset
                    logger.info(`User ${userId} streak broken after ${currentStreak} days`);
                    currentStreak = 1;
                }
            } else {
                // First login
                currentStreak = 1;
            }

            // Update longest streak
            if (currentStreak > longestStreak) {
                longestStreak = currentStreak;
            }

            // Check for milestone achievements
            for (const [milestone, points] of Object.entries(STREAK_MILESTONES)) {
                const milestoneNum = parseInt(milestone);
                if (currentStreak === milestoneNum) {
                    milestoneReached = milestoneNum;
                    pointsAwarded = points;

                    // Award points
                    await PointsService.addPoints(
                        userId,
                        points,
                        `${milestoneNum}-day streak milestone`
                    );

                    logger.info(`User ${userId} reached ${milestoneNum}-day streak milestone, awarded ${points} points`);
                    break;
                }
            }

            // Update user's streak data
            await query(
                `UPDATE users 
                SET current_streak = $1, 
                    longest_streak = $2, 
                    last_login_date = $3,
                    total_streak_points = total_streak_points + $4
                WHERE id = $5`,
                [currentStreak, longestStreak, today, pointsAwarded || 0, userId]
            );

            logger.info(`Updated streak for user ${userId}: ${currentStreak} days`);

            return {
                currentStreak,
                milestoneReached,
                pointsAwarded,
            };
        } catch (error) {
            logger.error(`Error updating streak for user ${userId}:`, error);
            throw error;
        }
    }

    /**
     * Get user's streak information
     */
    static async getStreakInfo(userId: string) {
        try {
            const result = await query(
                'SELECT current_streak, longest_streak, last_login_date, total_streak_points FROM users WHERE id = $1',
                [userId]
            );

            if (result.rows.length === 0) {
                return null;
            }

            const user = result.rows[0];
            return {
                currentStreak: user.current_streak || 0,
                longestStreak: user.longest_streak || 0,
                lastLoginDate: user.last_login_date,
                totalStreakPoints: user.total_streak_points || 0,
                nextMilestone: this.getNextMilestone(user.current_streak || 0),
            };
        } catch (error) {
            logger.error(`Error getting streak info for user ${userId}:`, error);
            throw error;
        }
    }

    /**
     * Get the next streak milestone
     */
    private static getNextMilestone(currentStreak: number): { days: number; points: number } | null {
        const milestones = Object.entries(STREAK_MILESTONES)
            .map(([days, points]) => ({ days: parseInt(days), points }))
            .sort((a, b) => a.days - b.days);

        for (const milestone of milestones) {
            if (currentStreak < milestone.days) {
                return milestone;
            }
        }

        return null; // User has reached all milestones
    }
}
