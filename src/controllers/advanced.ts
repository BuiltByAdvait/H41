import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { checkInSchema, feedbackSchema, eventIdSchema, registrationIdSchema } from '../validations/schemas';
import { successResponse } from '../utils/response';
import { checkInAttendee, getCertificate, getEventFeedback, submitFeedback } from '../services/advanced';

export const checkInController = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { params, body } = checkInSchema.parse({ params: req.params, body: req.body });
    const result = await checkInAttendee(params.eventId, body.confirmationCode, req.user!.id);
    res.status(200).json(successResponse(result, 'Attendance recorded'));
  } catch (error) {
    next(error);
  }
};

export const certificateController = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { params } = registrationIdSchema.parse({ params: req.params });
    const certificate = await getCertificate(params.registrationId, req.user!.id);
    res.status(200).json(successResponse(certificate));
  } catch (error) {
    next(error);
  }
};

export const feedbackController = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { params, body } = feedbackSchema.parse({ params: req.params, body: req.body });
    const feedback = await submitFeedback(params.registrationId, req.user!.id, body.rating, body.comment);
    res.status(201).json(successResponse(feedback, 'Feedback submitted'));
  } catch (error) {
    next(error);
  }
};

export const eventFeedbackController = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { params } = eventIdSchema.parse({ params: req.params });
    const feedback = await getEventFeedback(params.eventId);
    res.status(200).json(successResponse(feedback));
  } catch (error) {
    next(error);
  }
};
