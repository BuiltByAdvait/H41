import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import {
  registerSchema,
  loginSchema,
  updateProfileSchema,
  changePasswordSchema,
  adminStudentsSchema,
  adminStudentIdSchema,
  adminStudentStatusSchema,
} from '../validations/schemas';
import { successResponse, paginatedResponse } from '../utils/response';
import {
  registerStudent,
  loginStudent,
  getMe as getCurrentUser,
  updateProfile as updateStudentProfile,
  changePassword as changeStudentPassword,
  getAllStudents,
  getStudentById as getStudentByIdService,
  updateStudentStatus as updateStudentStatusService,
} from '../services/auth';

export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { body } = registerSchema.parse({ body: req.body });
    const result = await registerStudent(body);
    res.status(201).json(successResponse(result, 'Registration successful'));
  } catch (err) {
    next(err);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { body } = loginSchema.parse({ body: req.body });
    const result = await loginStudent(body);
    res.status(200).json(successResponse(result, 'Login successful'));
  } catch (err) {
    next(err);
  }
};

export const logout = async (_req: Request, res: Response, _next: NextFunction) => {
  res.status(200).json(successResponse(null, 'Logged out successfully'));
};

export const getMe = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await getCurrentUser(req.user!.id);
    res.status(200).json(successResponse(user));
  } catch (err) {
    next(err);
  }
};

export const updateProfile = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { body } = updateProfileSchema.parse({ body: req.body });
    const user = await updateStudentProfile(req.user!.id, body);
    res.status(200).json(successResponse(user, 'Profile updated successfully'));
  } catch (err) {
    next(err);
  }
};

export const changePassword = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { body } = changePasswordSchema.parse({ body: req.body });
    const result = await changeStudentPassword(req.user!.id, body);
    res.status(200).json(successResponse(null, result.message));
  } catch (err) {
    next(err);
  }
};

export const getStudents = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { query } = adminStudentsSchema.parse({ query: req.query });
    const result = await getAllStudents(query);
    res.status(200).json(paginatedResponse(result.students, result.pagination));
  } catch (err) {
    next(err);
  }
};

export const getStudentById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { params } = adminStudentIdSchema.parse({ params: req.params });
    const student = await getStudentByIdService(params.studentId);
    res.status(200).json(successResponse(student));
  } catch (err) {
    next(err);
  }
};

export const updateStudentStatus = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { params, body } = adminStudentStatusSchema.parse({
      params: req.params,
      body: req.body,
    });
    const student = await updateStudentStatusService(params.studentId, body.accountStatus);
    res.status(200).json(successResponse(student, 'Student status updated successfully'));
  } catch (err) {
    next(err);
  }
};
