import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import {
  createEventSchema,
  updateEventSchema,
  eventQuerySchema,
  eventIdSchema,
  adminEventsSchema,
  adminParticipantsSchema,
} from '../validations/schemas';
import { successResponse } from '../utils/response';
import {
  createEvent,
  getEventById,
  getEvents,
  updateEvent,
  publishEvent,
  closeRegistration,
  openRegistration,
  cancelEvent,
  getEventRegistrations,
  getAdminEvents,
} from '../services/events';

export const createEventController = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { body } = createEventSchema.parse({ body: req.body });
    const event = await createEvent(body, req.user!.id);
    res.status(201).json(successResponse(event, 'Event created successfully'));
  } catch (err) {
    next(err);
  }
};

export const getEventByIdController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { params } = eventIdSchema.parse({ params: req.params });
    const event = await getEventById(params.eventId);
    res.status(200).json(successResponse(event));
  } catch (err) {
    next(err);
  }
};

export const getEventsController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { query } = eventQuerySchema.parse({ query: req.query });
    const result = await getEvents(query);
    res.status(200).json(successResponse(result));
  } catch (err) {
    next(err);
  }
};

export const updateEventController = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { body, params } = updateEventSchema.parse({ body: req.body, params: req.params });
    const event = await updateEvent(params.eventId, body);
    res.status(200).json(successResponse(event, 'Event updated successfully'));
  } catch (err) {
    next(err);
  }
};

export const publishEventController = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { params } = eventIdSchema.parse({ params: req.params });
    const event = await publishEvent(params.eventId);
    res.status(200).json(successResponse(event, 'Event published successfully'));
  } catch (err) {
    next(err);
  }
};

export const closeRegistrationController = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { params } = eventIdSchema.parse({ params: req.params });
    const event = await closeRegistration(params.eventId);
    res.status(200).json(successResponse(event, 'Registration closed successfully'));
  } catch (err) {
    next(err);
  }
};

export const openRegistrationController = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { params } = eventIdSchema.parse({ params: req.params });
    const event = await openRegistration(params.eventId);
    res.status(200).json(successResponse(event, 'Registration opened successfully'));
  } catch (err) {
    next(err);
  }
};

export const cancelEventController = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { params } = eventIdSchema.parse({ params: req.params });
    const event = await cancelEvent(params.eventId);
    res.status(200).json(successResponse(event, 'Event cancelled successfully'));
  } catch (err) {
    next(err);
  }
};

export const getEventRegistrationsController = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { params, query } = adminParticipantsSchema.parse({ params: req.params, query: req.query });
    const result = await getEventRegistrations(params.eventId, query);
    res.status(200).json(successResponse(result));
  } catch (err) {
    next(err);
  }
};

export const getAdminEventsController = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { query } = adminEventsSchema.parse({ query: req.query });
    const result = await getAdminEvents(query);
    res.status(200).json(successResponse(result));
  } catch (err) {
    next(err);
  }
};