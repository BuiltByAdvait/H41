import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from '../utils/errors';
import { prisma } from '../config/prisma';
import { env } from '../config';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: 'ADMIN' | 'STUDENT';
  };
}

export async function authenticateToken(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    next(new AppError('Access token required', 401, 'UNAUTHORIZED'));
    return;
  }

  try {
    const decoded = jwt.verify(token, env.jwt.secret) as {
      id: string;
      email: string;
      role: string;
    };

    // Fetch user from database to ensure they still exist and are active
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, email: true, role: true, accountStatus: true },
    });

    if (!user) {
      next(new AppError('User not found', 401, 'UNAUTHORIZED'));
      return;
    }

    if (user.accountStatus !== 'ACTIVE') {
      next(new AppError('Account is not active', 401, 'ACCOUNT_INACTIVE'));
      return;
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
    };

    next();
  } catch (err) {
    if (err instanceof jwt.JsonWebTokenError) {
      next(new AppError('Invalid or expired token', 401, 'INVALID_TOKEN'));
    } else {
      next(new AppError('Token validation failed', 401, 'TOKEN_ERROR'));
    }
  }
}

export function requireRole(
  allowedRoles: ('ADMIN' | 'STUDENT')[]
) {
  return function (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): void {
    if (!req.user) {
      next(new AppError('Authentication required', 401, 'UNAUTHORIZED'));
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      next(new AppError('Insufficient permissions', 403, 'FORBIDDEN'));
      return;
    }

    next();
  };
}

export function requireAdmin(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    next(new AppError('Authentication required', 401, 'UNAUTHORIZED'));
    return;
  }

  if (req.user.role !== 'ADMIN') {
    next(new AppError('Admin access required', 403, 'FORBIDDEN'));
    return;
  }

  next();
}

export function requireStudent(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    next(new AppError('Authentication required', 401, 'UNAUTHORIZED'));
    return;
  }

  if (req.user.role !== 'STUDENT') {
    next(new AppError('Student access required', 403, 'FORBIDDEN'));
    return;
  }

  next();
}
