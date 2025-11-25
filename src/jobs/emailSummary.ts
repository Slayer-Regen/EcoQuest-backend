import nodemailer from 'nodemailer';
import { query } from '../db';
import { logger } from '../utils/logger';
import { WeeklySummary } from './weeklySummary';

// Create reusable transporter
const createTransporter = () => {
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
        logger.warn('Email configuration missing. Emails will not be sent.');
        return null;
    }

    return nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_PORT === '465',
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });
};

export async function sendWeeklySummaryEmail(
    userId: string,
    summary: WeeklySummary
): Promise<boolean> {
    try {
        // Get user details
        const userResult = await query(
            'SELECT email, display_name FROM users WHERE id = $1',
            [userId]
        );

        if (userResult.rows.length === 0) {
            logger.error(`User ${userId} not found for email`);
            return false;
        }

        const user = userResult.rows[0];
        const transporter = createTransporter();

        if (!transporter) {
            logger.info('Email transporter not configured, skipping email');
            return false;
        }

        // Format dates (convert from string if needed)
        const weekStart = typeof summary.weekStart === 'string'
            ? new Date(summary.weekStart)
            : summary.weekStart;
        const weekEnd = typeof summary.weekEnd === 'string'
            ? new Date(summary.weekEnd)
            : summary.weekEnd;

        const weekStartStr = weekStart.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
        });
        const weekEndStr = weekEnd.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });

        // Calculate trend emoji and text
        let trendEmoji = '➡️';
        let trendText = 'stayed the same';
        let trendColor = '#6b7280';

        if (summary.trend === 'down') {
            trendEmoji = '📉';
            trendText = 'decreased';
            trendColor = '#10b981';
        } else if (summary.trend === 'up') {
            trendEmoji = '📈';
            trendText = 'increased';
            trendColor = '#ef4444';
        }

        // HTML email template
        const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Your Weekly Carbon Footprint Summary</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">🌍 Your Weekly Summary</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">${weekStartStr} - ${weekEndStr}</p>
        </div>

        <!-- Content -->
        <div style="background: white; padding: 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <p style="color: #374151; font-size: 16px; margin-top: 0;">Hi ${user.display_name || 'there'},</p>
            <p style="color: #374151; font-size: 16px;">Here's your carbon footprint summary for the week:</p>

            <!-- Stats Grid -->
            <div style="margin: 30px 0;">
                <!-- CO2 Emissions -->
                <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin-bottom: 15px; border-left: 4px solid ${trendColor};">
                    <div style="color: #6b7280; font-size: 14px; margin-bottom: 5px;">Total Emissions</div>
                    <div style="font-size: 32px; font-weight: bold; color: #111827;">${summary.totalCo2Kg.toFixed(2)} kg CO₂</div>
                    <div style="color: ${trendColor}; font-size: 14px; margin-top: 5px;">
                        ${trendEmoji} ${trendText} from last week
                    </div>
                </div>

                <!-- Points Earned -->
                <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; margin-bottom: 15px; border-left: 4px solid #10b981;">
                    <div style="color: #6b7280; font-size: 14px; margin-bottom: 5px;">Points Earned</div>
                    <div style="font-size: 32px; font-weight: bold; color: #10b981;">${summary.totalPoints} pts</div>
                </div>

                <!-- Activities Logged -->
                <div style="background: #eff6ff; padding: 20px; border-radius: 8px; border-left: 4px solid #3b82f6;">
                    <div style="color: #6b7280; font-size: 14px; margin-bottom: 5px;">Activities Logged</div>
                    <div style="font-size: 32px; font-weight: bold; color: #3b82f6;">${summary.activityCount}</div>
                </div>
            </div>

            <!-- CTA Button -->
            <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.FRONTEND_URL}/dashboard" style="display: inline-block; background: #10b981; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
                    View Full Dashboard
                </a>
            </div>

            <p style="color: #6b7280; font-size: 14px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                Keep up the great work! Every small action counts towards a sustainable future. 🌱
            </p>
        </div>

        <!-- Footer -->
        <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
            <p>EcoQuest - Track and reduce your carbon footprint</p>
            <p style="margin-top: 10px;">
                <a href="${process.env.FRONTEND_URL}/settings" style="color: #10b981; text-decoration: none;">Manage email preferences</a>
            </p>
        </div>
    </div>
</body>
</html>
        `;

        // Send email
        const info = await transporter.sendMail({
            from: `"EcoQuest" <${process.env.FROM_EMAIL || process.env.SMTP_USER}>`,
            to: user.email,
            subject: `Your Weekly Carbon Footprint Summary - ${weekStartStr} to ${weekEndStr}`,
            html: htmlContent,
        });

        logger.info(`Weekly summary email sent to ${user.email}`, {
            messageId: info.messageId,
            userId,
        });

        return true;
    } catch (error) {
        logger.error(`Error sending weekly summary email for user ${userId}:`, error);
        return false;
    }
}
