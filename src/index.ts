import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import dotenv from 'dotenv';
import passport from 'passport';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { notFoundHandler } from './middleware/notFoundHandler';
import { configurePassport } from './config/passport';

// Import routes
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import activityRoutes from './routes/activity.routes';
import dashboardRoutes from './routes/dashboard.routes';
import pointsRoutes from './routes/points.routes';
import partnerRoutes from './routes/partner.routes';
import webhookRoutes from './routes/webhook.routes';
import leaderboardRoutes from './routes/leaderboard.routes';
import analyticsRoutes from './routes/analytics.routes';
import summariesRoutes from './routes/summaries.routes';
import exportRoutes from './routes/export.routes';
// import { initializeScheduler } from './scheduler'; // Disabled until node-cron is fixed

dotenv.config();

const app: Application = express();
// Middleware
app.use(helmet());
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
}));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined', { stream: { write: (message) => logger.info(message.trim()) } }));

// Initialize Passport
configurePassport();
app.use(passport.initialize());

// Health check
app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/activities', activityRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/points', pointsRoutes);
app.use('/api/partners', partnerRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/summaries', summariesRoutes);
app.use('/api/export', exportRoutes);

// Error handlers (must be last)
app.use(notFoundHandler);
app.use(errorHandler);

import { CarbonCalculator } from './services/carbonCalculator';

// Start server
const PORT = process.env.PORT || 3000;

const startServer = async () => {
    try {
        // Initialize services
        await CarbonCalculator.initialize();

        // Initialize scheduler for background jobs
        // TODO: Fix node-cron module resolution issue
        // initializeScheduler();

        app.listen(PORT, () => {
            logger.info(`🚀 Server running on port ${PORT}`, { service: 'carbon-footprint-api' });
            logger.info(`📊 Environment: ${process.env.NODE_ENV || 'development'}`, { service: 'carbon-footprint-api' });
            logger.info(`🌐 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`, { service: 'carbon-footprint-api' });
        });
    } catch (error) {
        logger.error('Failed to start server:', error);
        process.exit(1);
    }
};

startServer();

// Graceful shutdown
process.on('SIGTERM', () => {
    logger.info('SIGTERM signal received: closing HTTP server');
    process.exit(0);
});

process.on('SIGINT', () => {
    logger.info('SIGINT signal received: closing HTTP server');
    process.exit(0);
});

export default app;
