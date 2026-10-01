import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import {
  registerEventSchema,
  studentRegistrationsSchema,
  registrationIdSchema,
} from '../validations/schemas';
import { successResponse, paginatedResponse } from '../utils/response';
import { registerForEvent, getMyRegistrations, getRegistrationById, cancelRegistration } from '../services/registrations';

export const registerForEventController = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { params } = registerEventSchema.parse({ params: req.params });
    const registration = await registerForEvent(req.user!.id, params.eventId);
    res.status(201).json(successResponse(registration, 'Successfully registered for event'));
  } catch (err) {
    next(err);
  }
};

export const getMyRegistrationsController = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { query } = studentRegistrationsSchema.parse({ query: req.query });
    const result = await getMyRegistrations(req.user!.id, query);
    res.status(200).json(paginatedResponse(result.registrations, result.pagination));
  } catch (err) {
    next(err);
  }
};

export const getRegistrationByIdController = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { params } = registrationIdSchema.parse({ params: req.params });
    const registration = await getRegistrationById(params.registrationId);

    // Authorization: student can only view their own registration
    if (req.user!.role !== 'ADMIN' && registration.studentId !== req.user!.id) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Not authorized to view this registration' } });
      return;
    }

    res.status(200).json(successResponse(registration));
  } catch (err) {
    next(err);
  }
};

export const cancelRegistrationController = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { params } = registrationIdSchema.parse({ params: req.params });
    const registration = await cancelRegistration(params.registrationId, req.user!.id);
    res.status(200).json(successResponse(registration, 'Registration cancelled successfully'));
  } catch (err) {
    next(err);
  }
};