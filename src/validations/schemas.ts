import { z } from 'zod';

export const registerSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Name must be at least 2 characters').max(100),
    email: z.string().email('Invalid email format'),
    studentId: z.string().min(3, 'Student ID must be at least 3 characters').max(20),
    department: z.string().min(2).max(50).optional(),
    academicYear: z.string().min(1).max(20).optional(),
    password: z.string().min(8, 'Password must be at least 8 characters').max(128),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email format'),
    password: z.string().min(1, 'Password is required'),
  }),
});

export const refreshTokenSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1, 'Refresh token is required'),
  }),
});

export const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email format'),
  }),
});

export const resetPasswordSchema = z.object({
  body: z.object({
    token: z.string().min(1, 'Reset token is required'),
    password: z.string().min(8, 'Password must be at least 8 characters').max(128),
  }),
});

export const updateProfileSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(100).optional(),
    department: z.string().max(50).optional(),
    academicYear: z.string().max(20).optional(),
  }),
});

export const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(8, 'Password must be at least 8 characters').max(128),
  }),
});

export const createEventSchema = z.object({
  body: z.object({
    title: z.string().min(3, 'Title must be at least 3 characters').max(200),
    description: z.string().min(10, 'Description must be at least 10 characters'),
    category: z.string().max(50).optional(),
    venue: z.string().max(200).optional(),
    startTime: z.string().datetime('Invalid start time format'),
    endTime: z.string().datetime('Invalid end time format'),
    registrationDeadline: z.string().datetime('Invalid registration deadline format'),
    capacity: z.number().int().positive('Capacity must be a positive integer').optional(),
    eligibility: z.string().max(500).optional(),
    imageUrl: z.string().url('Invalid image URL').optional().or(z.literal('')),
    organizer: z.string().max(100).optional(),
  }).refine((data) => new Date(data.endTime) > new Date(data.startTime), {
    message: 'End time must be after start time',
    path: ['endTime'],
  }).refine((data) => new Date(data.registrationDeadline) <= new Date(data.startTime), {
    message: 'Registration deadline must be before or at event start time',
    path: ['registrationDeadline'],
  }),
});

export const updateEventSchema = z.object({
  body: z.object({
    title: z.string().min(3).max(200).optional(),
    description: z.string().min(10).optional(),
    category: z.string().max(50).optional(),
    venue: z.string().max(200).optional(),
    startTime: z.string().datetime().optional(),
    endTime: z.string().datetime().optional(),
    registrationDeadline: z.string().datetime().optional(),
    capacity: z.number().int().positive().optional(),
    eligibility: z.string().max(500).optional(),
    imageUrl: z.string().url().optional().or(z.literal('')),
    organizer: z.string().max(100).optional(),
  }),
  params: z.object({
    eventId: z.string().uuid('Invalid event ID format'),
  }),
}).refine((data) => {
  if (data.body.startTime && data.body.endTime) {
    return new Date(data.body.endTime) > new Date(data.body.startTime);
  }
  return true;
}, {
  message: 'End time must be after start time',
  path: ['body', 'endTime'],
});

export const eventQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    search: z.string().optional(),
    category: z.string().optional(),
    status: z.string().optional(),
    department: z.string().optional(),
    sortBy: z.enum(['createdAt', 'startTime', 'title']).default('startTime'),
    sortOrder: z.enum(['asc', 'desc']).default('asc'),
  }),
});

export const eventIdSchema = z.object({
  params: z.object({
    eventId: z.string().uuid('Invalid event ID format'),
  }),
});

export const registerEventSchema = z.object({
  params: z.object({
    eventId: z.string().uuid('Invalid event ID format'),
  }),
});

export const studentRegistrationsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    status: z.string().optional(),
  }),
});

export const registrationIdSchema = z.object({
  params: z.object({
    registrationId: z.string().uuid('Invalid registration ID format'),
  }),
});

export const adminEventsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    search: z.string().optional(),
    status: z.string().optional(),
    sortBy: z.enum(['createdAt', 'startTime', 'title']).default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  }),
});

export const adminParticipantsSchema = z.object({
  params: z.object({
    eventId: z.string().uuid('Invalid event ID format'),
  }),
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    status: z.string().optional(),
    search: z.string().optional(),
    sortBy: z.enum(['registeredAt', 'name', 'studentId']).default('registeredAt'),
    sortOrder: z.enum(['asc', 'desc']).default('asc'),
  }),
});

export const adminStudentsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    search: z.string().optional(),
    department: z.string().optional(),
    academicYear: z.string().optional(),
    status: z.string().optional(),
    sortBy: z.enum(['createdAt', 'name', 'studentId']).default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  }),
});

export const adminStudentIdSchema = z.object({
  params: z.object({
    studentId: z.string().uuid('Invalid student ID format'),
  }),
});

export const adminStudentStatusSchema = z.object({
  params: z.object({
    studentId: z.string().uuid('Invalid student ID format'),
  }),
  body: z.object({
    accountStatus: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']),
  }),
});

export const checkInSchema = z.object({
  params: z.object({ eventId: z.string().uuid('Invalid event ID format') }),
  body: z.object({ confirmationCode: z.string().trim().min(8).max(50) }),
});

export const feedbackSchema = z.object({
  params: z.object({ registrationId: z.string().uuid('Invalid registration ID format') }),
  body: z.object({
    rating: z.number().int().min(1).max(5),
    comment: z.string().trim().max(2000).optional(),
  }),
});
