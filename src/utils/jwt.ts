import jwt from 'jsonwebtoken';
import { logger } from './logger';

interface TokenPayload {
    id: string;
    email: string;
}

interface RefreshTokenPayload extends TokenPayload {
    type: 'refresh';
}

export const generateAccessToken = (payload: TokenPayload): string => {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error('JWT_SECRET is not defined');
    }

    return jwt.sign(payload, secret, {
        expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    });
};

export const generateRefreshToken = (payload: TokenPayload): string => {
    const secret = process.env.REFRESH_TOKEN_SECRET;
    if (!secret) {
        throw new Error('REFRESH_TOKEN_SECRET is not defined');
    }

    const refreshPayload: RefreshTokenPayload = {
        ...payload,
        type: 'refresh',
    };

    return jwt.sign(refreshPayload, secret, {
        expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
    });
};

export const verifyAccessToken = (token: string): TokenPayload => {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error('JWT_SECRET is not defined');
    }

    try {
        return jwt.verify(token, secret) as TokenPayload;
    } catch (error) {
        logger.error('Access token verification failed:', error);
        throw error;
    }
};

export const verifyRefreshToken = (token: string): TokenPayload => {
    const secret = process.env.REFRESH_TOKEN_SECRET;
    if (!secret) {
        throw new Error('REFRESH_TOKEN_SECRET is not defined');
    }

    try {
        const payload = jwt.verify(token, secret) as RefreshTokenPayload;
        if (payload.type !== 'refresh') {
            throw new Error('Invalid token type');
        }
        return { id: payload.id, email: payload.email };
    } catch (error) {
        logger.error('Refresh token verification failed:', error);
        throw error;
    }
};

export const generateTokenPair = (payload: TokenPayload) => {
    return {
        accessToken: generateAccessToken(payload),
        refreshToken: generateRefreshToken(payload),
    };
};
