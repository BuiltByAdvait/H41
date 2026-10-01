import { Router } from 'express';
import { register, login, logout, getMe, updateProfile, changePassword, getStudents, getStudentById, updateStudentStatus } from '../controllers/auth';
import { createEventController, getEventByIdController, getEventsController, updateEventController, publishEventController, closeRegistrationController, openRegistrationController, cancelEventController, getEventRegistrationsController, getAdminEventsController } from '../controllers/events';
import { registerForEventController, getMyRegistrationsController, getRegistrationByIdController, cancelRegistrationController } from '../controllers/registrations';
import { getDashboardStatsController, getRegistrationTrendsController } from '../controllers/dashboard';
import { certificateController, checkInController, eventFeedbackController, feedbackController } from '../controllers/advanced';
import { authenticateToken, requireAdmin, requireStudent } from '../middleware/auth';
import { asyncHandler } from '../utils/response';

const router = Router();

// Public routes
router.post('/auth/register', register);
router.post('/auth/login', login);

// Protected routes
router.post('/auth/logout', authenticateToken, logout);
router.get('/auth/me', authenticateToken, getMe);
router.patch('/students/me', authenticateToken, requireStudent, updateProfile);
router.patch('/students/me/password', authenticateToken, requireStudent, changePassword);

// Student event routes
router.get('/events', getEventsController);
router.get('/events/:eventId', authenticateToken, getEventByIdController);
router.post('/events/:eventId/register', authenticateToken, requireStudent, registerForEventController);
router.get('/registrations/me', authenticateToken, requireStudent, getMyRegistrationsController);
router.get('/registrations/:registrationId', authenticateToken, requireStudent, getRegistrationByIdController);
router.delete('/registrations/:registrationId', authenticateToken, requireStudent, cancelRegistrationController);
router.get('/registrations/:registrationId/certificate', authenticateToken, requireStudent, certificateController);
router.post('/registrations/:registrationId/feedback', authenticateToken, requireStudent, feedbackController);

// Admin routes
router.get('/admin/dashboard', authenticateToken, requireAdmin, getDashboardStatsController);
router.get('/admin/events', authenticateToken, requireAdmin, getAdminEventsController);
router.post('/admin/events', authenticateToken, requireAdmin, createEventController);
router.get('/admin/events/:eventId', authenticateToken, requireAdmin, getEventByIdController);
router.patch('/admin/events/:eventId', authenticateToken, requireAdmin, updateEventController);
router.delete('/admin/events/:eventId', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  res.status(501).json({ success: false, error: { code: 'NOT_IMPLEMENTED', message: 'Event deletion not yet implemented' } });
}));
router.post('/admin/events/:eventId/publish', authenticateToken, requireAdmin, publishEventController);
router.post('/admin/events/:eventId/close-registration', authenticateToken, requireAdmin, closeRegistrationController);
router.post('/admin/events/:eventId/open-registration', authenticateToken, requireAdmin, openRegistrationController);
router.post('/admin/events/:eventId/cancel', authenticateToken, requireAdmin, cancelEventController);
router.get('/admin/events/:eventId/participants', authenticateToken, requireAdmin, getEventRegistrationsController);
router.post('/admin/events/:eventId/check-in', authenticateToken, requireAdmin, checkInController);
router.get('/admin/events/:eventId/feedback', authenticateToken, requireAdmin, eventFeedbackController);
router.get('/admin/registrations', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  res.status(501).json({ success: false, error: { code: 'NOT_IMPLEMENTED', message: 'Admin registration list not yet implemented' } });
}));
router.get('/admin/students', authenticateToken, requireAdmin, getStudents);
router.get('/admin/students/:studentId', authenticateToken, requireAdmin, getStudentById);
router.patch('/admin/students/:studentId/status', authenticateToken, requireAdmin, updateStudentStatus);
router.get('/admin/analytics', authenticateToken, requireAdmin, getRegistrationTrendsController);

// Health check
router.get('/health', asyncHandler(async (_req, res) => {
  res.status(200).json({ success: true, message: 'CEMS API is running', timestamp: new Date().toISOString() });
}));

export default router;
