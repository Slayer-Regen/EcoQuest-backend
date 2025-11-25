import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { query } from '../db';
import { logger } from '../utils/logger';

interface GoogleProfile {
    id: string;
    emails?: { value: string; verified: boolean }[];
    displayName: string;
    photos?: { value: string }[];
}

export const configurePassport = () => {
    const googleClientId = process.env.GOOGLE_CLIENT_ID;
    const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const googleCallbackUrl = process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/auth/google/callback';

    if (!googleClientId || !googleClientSecret) {
        logger.warn('Google OAuth credentials not configured. OAuth will not work.');
        return;
    }

    passport.use(
        new GoogleStrategy(
            {
                clientID: googleClientId,
                clientSecret: googleClientSecret,
                callbackURL: googleCallbackUrl,
            },
            async (accessToken, refreshToken, profile: GoogleProfile, done) => {
                try {
                    const email = profile.emails?.[0]?.value;
                    if (!email) {
                        return done(new Error('No email found in Google profile'), undefined);
                    }

                    const displayName = profile.displayName;
                    const avatarUrl = profile.photos?.[0]?.value;
                    const oauthId = profile.id;

                    // Check if user exists
                    const existingUser = await query(
                        'SELECT * FROM users WHERE oauth_provider = $1 AND oauth_id = $2',
                        ['google', oauthId]
                    );

                    if (existingUser.rows.length > 0) {
                        // User exists, update last login info if needed
                        const user = existingUser.rows[0];
                        logger.info('Existing user logged in', { userId: user.id, email });
                        return done(null, user);
                    }

                    // Create new user
                    const newUser = await query(
                        `INSERT INTO users (email, display_name, oauth_provider, oauth_id, avatar_url)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
                        [email, displayName, 'google', oauthId, avatarUrl]
                    );

                    logger.info('New user created', { userId: newUser.rows[0].id, email });
                    return done(null, newUser.rows[0]);
                } catch (error) {
                    logger.error('Error in Google OAuth callback:', error);
                    return done(error as Error, undefined);
                }
            }
        )
    );

    // Serialize user for session (not used with JWT, but required by Passport)
    passport.serializeUser((user: any, done) => {
        done(null, user.id);
    });

    passport.deserializeUser(async (id: string, done) => {
        try {
            const result = await query('SELECT * FROM users WHERE id = $1', [id]);
            done(null, result.rows[0]);
        } catch (error) {
            done(error, null);
        }
    });
};
