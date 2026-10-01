import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';

export const apiLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests, please try again later.',
});

export const authLimiter = rateLimit({
  windowMs: 900000, // 15 minutes
  max: 5, // 5 attempts
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many authentication attempts, please try again later.',
});

export const registerLimiter = rateLimit({
  windowMs: 3600000, // 1 hour
  max: 10, // 10 registrations per hour
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many registration attempts, please try again later.',
});

export const passwordResetLimiter = rateLimit({
  windowMs: 3600000, // 1 hour
  max: 3, // 3 attempts per hour
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many password reset attempts, please try again later.',
});

export const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  maxAge: 86400,
};