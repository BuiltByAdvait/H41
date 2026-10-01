import { prisma } from '../config/prisma';
import { AppError } from '../utils/errors';
import { randomUUID } from 'crypto';
import { env } from '../config';

export async function registerForEvent(studentId: string, eventId: string) {
  // Verify student exists
  const student = await prisma.user.findUnique({
    where: { id: studentId },
    select: { id: true, role: true, accountStatus: true },
  });

  if (!student) {
    throw new AppError('Student not found', 404, 'STUDENT_NOT_FOUND');
  }

  if (student.role !== 'STUDENT') {
    throw new AppError('Only students can register for events', 403, 'NOT_A_STUDENT');
  }

  if (student.accountStatus !== 'ACTIVE') {
    throw new AppError('Student account is not active', 403, 'ACCOUNT_INACTIVE');
  }

  // Verify event exists and is eligible for registration
  const event = await prisma.event.findUnique({ where: { id: eventId } });

  if (!event) {
    throw new AppError('Event not found', 404, 'EVENT_NOT_FOUND');
  }

  // Check event status
  if (event.status === 'DRAFT' || event.status === 'CANCELLED') {
    throw new AppError('This event is not available for registration', 400, 'EVENT_NOT_AVAILABLE');
  }

  if (event.status !== 'PUBLISHED' && event.status !== 'REGISTRATION_OPEN') {
    throw new AppError('Registration is not open for this event', 400, 'REGISTRATION_NOT_OPEN');
  }

  // Check registration deadline
  const now = new Date();
  const deadline = new Date(event.registrationDeadline);

  if (now > deadline) {
    throw new AppError('Registration deadline has passed', 400, 'DEADLINE_PASSED');
  }

  // Check capacity
  if (event.capacity !== null) {
    const confirmedCount = await prisma.registration.count({
      where: { eventId: event.id, status: 'CONFIRMED' },
    });

    if (confirmedCount >= event.capacity) {
      // Event is full - we could allow waitlisting here
      throw new AppError('Event has reached full capacity', 400, 'EVENT_FULL');
    }
  }

  // Check for duplicate registration (database-level unique constraint)
  try {
    const existingRegistration = await prisma.registration.findUnique({
      where: { studentId_eventId: { studentId, eventId } },
    });

    if (existingRegistration) {
      throw new AppError('Student is already registered for this event', 409, 'DUPLICATE_REGISTRATION');
    }
  } catch (err) {
    if (err instanceof AppError) throw err;
    // Unique constraint violation error
    if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'P2002') {
      throw new AppError('Duplicate registration detected', 409, 'DUPLICATE_REGISTRATION');
    }
    throw err;
  }

  // Generate unique confirmation code
  const confirmationCode = randomUUID().slice(0, 16).replace(/-/g, '').toUpperCase();

  // Create registration in a transaction
  const registration = await prisma.registration.create({
    data: {
      confirmationCode,
      status: 'CONFIRMED',
      studentId,
      eventId,
    },
    include: {
      student: {
        select: { id: true, name: true, email: true, studentId: true, department: true, academicYear: true }
      },
      event: {
        select: { id: true, title: true, startTime: true, venue: true }
      },
    },
  });

  return registration;
}

export async function getMyRegistrations(studentId: string, query: {
  page: number;
  limit: number;
  status?: string;
}) {
  const { page, limit, status } = query;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = { studentId };
  if (status) {
    where.status = status as any;
  }

  const [registrations, total] = await Promise.all([
    prisma.registration.findMany({
      where,
      skip,
      take: limit,
      orderBy: { registeredAt: 'desc' },
      include: {
        event: {
          select: { id: true, title: true, startTime: true, venue: true, status: true },
        },
        attendance: true,
        feedback: true,
      },
    }),
    prisma.registration.count({ where }),
  ]);

  return { registrations, pagination: { page, limit, total } };
}

export async function getRegistrationById(registrationId: string) {
  const registration = await prisma.registration.findUnique({
    where: { id: registrationId },
    include: {
      student: { select: { id: true, name: true, email: true, studentId: true, department: true, academicYear: true } },
      event: { select: { id: true, title: true, startTime: true, venue: true, status: true } },
      attendance: true,
      feedback: true,
    },
  });

  if (!registration) {
    throw new AppError('Registration not found', 404, 'REGISTRATION_NOT_FOUND');
  }

  return registration;
}

export async function cancelRegistration(registrationId: string, studentId: string) {
  const registration = await prisma.registration.findUnique({
    where: { id: registrationId },
    include: { event: true },
  });

  if (!registration) {
    throw new AppError('Registration not found', 404, 'REGISTRATION_NOT_FOUND');
  }

  // Authorization: student can only cancel their own registration
  if (registration.studentId !== studentId) {
    throw new AppError('Not authorized to cancel this registration', 403, 'FORBIDDEN');
  }

  // Check if registration is already cancelled
  if (registration.status === 'CANCELLED') {
    throw new AppError('Registration is already cancelled', 400, 'ALREADY_CANCELLED');
  }

  // Check event policy - event must allow cancellation
  // (e.g., registration deadline not passed)
  const now = new Date();
  const deadline = new Date(registration.event.registrationDeadline);

  if (now > deadline) {
    throw new AppError('Cannot cancel after registration deadline', 400, 'DEADLINE_PASSED');
  }

  // Check if event is cancelled or completed
  if (registration.event.status === 'CANCELLED') {
    throw new AppError('Event is cancelled', 400, 'EVENT_CANCELLED');
  }

  // Update registration to cancelled with timestamp
  const updatedRegistration = await prisma.registration.update({
    where: { id: registrationId },
    data: { status: 'CANCELLED', cancelledAt: new Date().toISOString() },
    include: {
      student: { select: { id: true, name: true, email: true } },
      event: { select: { id: true, title: true } },
    },
  });

  return updatedRegistration;
}
