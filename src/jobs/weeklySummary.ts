import { query } from '../db';
import { logger } from '../utils/logger';

export interface WeeklySummary {
    userId: string;
    weekStart: Date;
    weekEnd: Date;
    totalCo2Kg: number;
    totalPoints: number;
    activityCount: number;
    previousWeekCo2?: number;
    trend?: 'up' | 'down' | 'same';
}

export async function generateWeeklySummary(userId: string): Promise<WeeklySummary> {
    try {
        // Calculate current week boundaries (Sunday to Saturday)
        const now = new Date();
        const dayOfWeek = now.getDay();
        const weekEnd = new Date(now);
        weekEnd.setDate(now.getDate() - dayOfWeek); // Last Sunday
        weekEnd.setHours(23, 59, 59, 999);

        const weekStart = new Date(weekEnd);
        weekStart.setDate(weekEnd.getDate() - 6); // Previous Monday
        weekStart.setHours(0, 0, 0, 0);

        logger.info(`Generating weekly summary for user ${userId}`, {
            weekStart: weekStart.toISOString(),
            weekEnd: weekEnd.toISOString(),
        });

        // Get current week's stats
        const currentWeekStats = await query(
            `SELECT 
                COALESCE(SUM(co2_kg), 0) as total_co2,
                COUNT(*) as activity_count
            FROM activities
            WHERE user_id = $1
                AND activity_date >= $2
                AND activity_date <= $3`,
            [userId, weekStart, weekEnd]
        );

        // Get current week's points
        const currentWeekPoints = await query(
            `SELECT COALESCE(SUM(delta), 0) as total_points
            FROM points_ledger
            WHERE user_id = $1
                AND created_at >= $2
                AND created_at <= $3`,
            [userId, weekStart, weekEnd]
        );

        // Get previous week's CO2 for trend
        const prevWeekStart = new Date(weekStart);
        prevWeekStart.setDate(weekStart.getDate() - 7);
        const prevWeekEnd = new Date(weekEnd);
        prevWeekEnd.setDate(weekEnd.getDate() - 7);

        const prevWeekStats = await query(
            `SELECT COALESCE(SUM(co2_kg), 0) as total_co2
            FROM activities
            WHERE user_id = $1
                AND activity_date >= $2
                AND activity_date <= $3`,
            [userId, prevWeekStart, prevWeekEnd]
        );

        const totalCo2Kg = parseFloat(currentWeekStats.rows[0].total_co2);
        const totalPoints = parseInt(currentWeekPoints.rows[0].total_points);
        const activityCount = parseInt(currentWeekStats.rows[0].activity_count);
        const previousWeekCo2 = parseFloat(prevWeekStats.rows[0].total_co2);

        // Calculate trend
        let trend: 'up' | 'down' | 'same' = 'same';
        if (totalCo2Kg > previousWeekCo2) trend = 'up';
        else if (totalCo2Kg < previousWeekCo2) trend = 'down';

        // Save to database
        await query(
            `INSERT INTO weekly_summaries 
                (user_id, week_start, week_end, total_co2_kg, total_points, activity_count)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (user_id, week_start) 
            DO UPDATE SET 
                total_co2_kg = $4,
                total_points = $5,
                activity_count = $6,
                updated_at = NOW()`,
            [userId, weekStart, weekEnd, totalCo2Kg, totalPoints, activityCount]
        );

        logger.info(`Weekly summary generated for user ${userId}`, {
            totalCo2Kg,
            totalPoints,
            activityCount,
            trend,
        });

        return {
            userId,
            weekStart,
            weekEnd,
            totalCo2Kg,
            totalPoints,
            activityCount,
            previousWeekCo2,
            trend,
        };
    } catch (error) {
        logger.error(`Error generating weekly summary for user ${userId}:`, error);
        throw error;
    }
}
