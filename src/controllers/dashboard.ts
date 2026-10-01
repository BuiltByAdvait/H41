import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { successResponse } from '../utils/response';
import { getDashboardStats, getRegistrationTrends } from '../services/dashboard';

export const getDashboardStatsController = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (req.user!.role !== 'ADMIN') {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Admin access required' } });
      return;
    }

    const stats = await getDashboardStats();
    res.status(200).json(successResponse(stats));
  } catch (err) {
    next(err);
  }
};

export const getRegistrationTrendsController = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (req.user!.role !== 'ADMIN') {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Admin access required' } });
      return;
    }

    const trends = await getRegistrationTrends();
    res.status(200).json(successResponse(trends));
  } catch (err) {
    next(err);
  }
};