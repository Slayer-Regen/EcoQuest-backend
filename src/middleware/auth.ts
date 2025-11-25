import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';

export interface AuthRequest extends Request {
    user?: {
        id: string;
        email: string;
    };
}

export const authenticate = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                error: { message: 'No token provided' },
            });
        }

        const token = authHeader.substring(7);
        const secret = process.env.JWT_SECRET;

        if (!secret) {
            logger.error('JWT_SECRET not configured');
            return res.status(500).json({
                success: false,
                error: { message: 'Server configuration error' },
            });
        }

        const decoded = jwt.verify(token, secret) as { id: string; email: string };
        req.user = decoded;
        next();
    } catch (error: any) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                error: { message: 'Token expired' },
            });
        }

        return res.status(401).json({
            success: false,
            error: { message: 'Invalid token' },
        });
    }
};
