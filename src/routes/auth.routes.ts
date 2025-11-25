import { Router, Request, Response } from 'express';
import passport from 'passport';
import { generateTokenPair, verifyRefreshToken } from '../utils/jwt';
import { logger } from '../utils/logger';

const router = Router();

// Google OAuth - Initiate
router.get(
    '/google',
    passport.authenticate('google', {
        scope: ['profile', 'email'],
        session: false,
    })
);

// Google OAuth - Callback
router.get(
    '/google/callback',
    passport.authenticate('google', {
        session: false,
        failureRedirect: `${process.env.FRONTEND_URL}/login?error=oauth_failed`,
    }),
    async (req: Request, res: Response) => {
        try {
            const user = req.user as any;

            if (!user) {
                logger.error('No user found after OAuth authentication');
                return res.redirect(`${process.env.FRONTEND_URL}/login?error=no_user`);
            }

            // Update login streak
            try {
                const { StreakService } = await import('../services/streakService');
                const streakResult = await StreakService.updateStreak(user.id);

                if (streakResult.milestoneReached) {
                    logger.info(`User ${user.id} reached ${streakResult.milestoneReached}-day streak milestone!`);
                }
            } catch (streakError) {
                logger.error('Error updating streak:', streakError);
                // Don't fail login if streak update fails
            }

            // Generate JWT tokens
            const tokens = generateTokenPair({
                id: user.id,
                email: user.email,
            });

            logger.info('User authenticated successfully', { userId: user.id });

            // Redirect to frontend with tokens in URL (will be moved to httpOnly cookies in production)
            const redirectUrl = `${process.env.FRONTEND_URL}/oauth/callback?token=${tokens.accessToken}&refreshToken=${tokens.refreshToken}`;
            res.redirect(redirectUrl);
        } catch (error) {
            logger.error('Error in OAuth callback:', error);
            res.redirect(`${process.env.FRONTEND_URL}/login?error=server_error`);
        }
    }
);

// Refresh access token
router.post('/refresh', async (req: Request, res: Response) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(400).json({
                success: false,
                error: { message: 'Refresh token is required' },
            });
        }

        // Verify refresh token
        const payload = verifyRefreshToken(refreshToken);

        // Generate new access token
        const tokens = generateTokenPair(payload);

        logger.info('Token refreshed successfully', { userId: payload.id });

        return res.json({
            success: true,
            data: {
                accessToken: tokens.accessToken,
                refreshToken: tokens.refreshToken,
            },
        });
    } catch (error: any) {
        logger.error('Token refresh failed:', error);

        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                error: { message: 'Refresh token expired' },
            });
        }

        return res.status(401).json({
            success: false,
            error: { message: 'Invalid refresh token' },
        });
    }
});

// Logout (client-side token removal, but we can blacklist tokens in Redis if needed)
router.post('/logout', (_req: Request, res: Response) => {
    // In a more advanced implementation, you would:
    // 1. Add the token to a Redis blacklist
    // 2. Clear httpOnly cookies if using them

    logger.info('User logged out');

    return res.json({
        success: true,
        message: 'Logged out successfully',
    });
});

export default router;
