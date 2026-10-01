import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/prisma';
import { env } from '../config';
import { AppError } from '../utils/errors';
import { asyncHandler } from '../utils/response';

const TOKEN_EXPIRY_MAP: Record<string, string> = {
  '15m': '15m',
  '30m': '30m',
  '1h': '1h',
  '1d': '1d',
};

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateTokens(userId: string, role: string) {
  const accessToken = jwt.sign(
    { id: userId, role },
    env.jwt.secret,
    { expiresIn: env.jwt.accessExpiry as jwt.SignOptions['expiresIn'] }
  );
  const refreshToken = jwt.sign(
    { id: userId, role, type: 'refresh' },
    env.jwt.refreshSecret,
    { expiresIn: env.jwt.refreshExpiry as jwt.SignOptions['expiresIn'] }
  );
  return { accessToken, refreshToken };
}

export function verifyAccessToken(token: string) {
  return jwt.verify(token, env.jwt.secret) as { id: string; role: string };
}

export async function registerStudent(data: {
  name: string;
  email: string;
  studentId: string;
  department?: string;
  academicYear?: string;
  password: string;
}) {
  const { name, email, studentId, department, academicYear, password } = data;

  // Check for existing email
  const existingEmail = await prisma.user.findUnique({ where: { email } });
  if (existingEmail) {
    throw new AppError('Email already in use', 409, 'EMAIL_EXISTS');
  }

  // Check for existing student ID
  const existingStudentId = await prisma.user.findUnique({ where: { studentId } });
  if (existingStudentId) {
    throw new AppError('Student ID already registered', 409, 'STUDENT_ID_EXISTS');
  }

  const passwordHash = await hashPassword(password);

  const user = await prisma.user.create({
    data: {
      name,
      email,
      studentId,
      department,
      academicYear,
      passwordHash,
      role: 'STUDENT',
    },
    select: {
      id: true,
      name: true,
      email: true,
      studentId: true,
      department: true,
      academicYear: true,
      role: true,
      accountStatus: true,
      createdAt: true,
    },
  });

  return user;
}

export async function loginStudent(data: { email: string; password: string }) {
  const { email, password } = data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
  }

  if (user.accountStatus !== 'ACTIVE') {
    throw new AppError('Account is not active', 403, 'ACCOUNT_INACTIVE');
  }

  const validPassword = await verifyPassword(password, user.passwordHash);
  if (!validPassword) {
    throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
  }

  const tokens = generateTokens(user.id, user.role);

  // Store refresh token hash in database (optional - for token revocation)
  // Skip for simplicity in hackathon scope

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      studentId: user.studentId,
      department: user.department,
      academicYear: user.academicYear,
      role: user.role,
      accountStatus: user.accountStatus,
    },
    ...tokens,
  };
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      studentId: true,
      department: true,
      academicYear: true,
      role: true,
      accountStatus: true,
      createdAt: true,
    },
  });

  if (!user) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }

  return user;
}

export async function updateProfile(userId: string, data: { name?: string; department?: string; academicYear?: string }) {
  const user = await prisma.user.update({
    where: { id: userId },
    data,
    select: {
      id: true,
      name: true,
      email: true,
      studentId: true,
      department: true,
      academicYear: true,
      role: true,
      accountStatus: true,
      updatedAt: true,
    },
  });

  return user;
}

export async function changePassword(userId: string, data: { currentPassword: string; newPassword: string }) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }

  const validPassword = await verifyPassword(data.currentPassword, user.passwordHash);
  if (!validPassword) {
    throw new AppError('Current password is incorrect', 400, 'INVALID_CURRENT_PASSWORD');
  }

  const passwordHash = await hashPassword(data.newPassword);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
  });

  return { message: 'Password updated successfully' };
}

export async function getAllStudents(query: {
  page: number;
  limit: number;
  search?: string;
  department?: string;
  academicYear?: string;
  status?: string;
  sortBy: string;
  sortOrder: string;
}) {
  const { page, limit, search, department, academicYear, status, sortBy, sortOrder } = query;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = { role: 'STUDENT' };

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' as const } },
      { email: { contains: search, mode: 'insensitive' as const } },
      { studentId: { contains: search, mode: 'insensitive' as const } },
    ];
  }

  if (department) {
    where.department = { equals: department, mode: 'insensitive' as const };
  }

  if (academicYear) {
    where.academicYear = academicYear;
  }

  if (status) {
    where.accountStatus = status;
  }

  const [students, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      select: {
        id: true,
        name: true,
        email: true,
        studentId: true,
        department: true,
        academicYear: true,
        role: true,
        accountStatus: true,
        createdAt: true,
      },
    }),
    prisma.user.count({ where }),
  ]);

  return { students, pagination: { page, limit, total } };
}

export async function getStudentById(studentId: string) {
  const student = await prisma.user.findUnique({
    where: { id: studentId },
    select: {
      id: true,
      name: true,
      email: true,
      studentId: true,
      department: true,
      academicYear: true,
      role: true,
      accountStatus: true,
      createdAt: true,
    },
  });

  if (!student) {
    throw new AppError('Student not found', 404, 'STUDENT_NOT_FOUND');
  }

  if (student.role !== 'STUDENT') {
    throw new AppError('User is not a student', 400, 'NOT_A_STUDENT');
  }

  return student;
}

export async function updateStudentStatus(studentId: string, accountStatus: string) {
  const student = await prisma.user.update({
    where: { id: studentId },
    data: { accountStatus },
    select: {
      id: true,
      name: true,
      email: true,
      studentId: true,
      accountStatus: true,
      updatedAt: true,
    },
  });

  return student;
}
