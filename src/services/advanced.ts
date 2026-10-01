import { prisma } from '../config/prisma';
import { AppError } from '../utils/errors';

export async function checkInAttendee(eventId: string, confirmationCode: string, adminId: string) {
  const registration = await prisma.registration.findUnique({
    where: { confirmationCode },
    include: { student: { select: { id: true, name: true, email: true, studentId: true } }, attendance: true },
  });

  if (!registration) throw new AppError('Entry pass was not recognized', 404, 'PASS_NOT_FOUND');
  if (registration.eventId !== eventId) throw new AppError('Entry pass belongs to another event', 400, 'WRONG_EVENT');
  if (registration.status === 'CANCELLED') throw new AppError('This registration was cancelled', 400, 'REGISTRATION_CANCELLED');
  if (registration.attendance) throw new AppError('This pass has already been checked in', 409, 'ALREADY_CHECKED_IN');

  try {
    return await prisma.$transaction(async (tx) => {
      const attendance = await tx.attendance.create({
        data: { registrationId: registration.id, eventId, checkedInById: adminId },
      });
      const updated = await tx.registration.update({
        where: { id: registration.id },
        data: { status: 'ATTENDED' },
      });
      return { attendance, registration: { ...updated, student: registration.student } };
    });
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      throw new AppError('This pass has already been checked in', 409, 'ALREADY_CHECKED_IN');
    }
    throw error;
  }
}

export async function getCertificate(registrationId: string, studentId: string) {
  const registration = await prisma.registration.findUnique({
    where: { id: registrationId },
    include: {
      student: { select: { id: true, name: true, studentId: true } },
      event: { select: { id: true, title: true, startTime: true, endTime: true, venue: true, organizer: true } },
      attendance: true,
    },
  });

  if (!registration || registration.studentId !== studentId) {
    throw new AppError('Registration not found', 404, 'REGISTRATION_NOT_FOUND');
  }
  if (registration.status !== 'ATTENDED' || !registration.attendance) {
    throw new AppError('Certificate is available after event attendance is recorded', 409, 'CERTIFICATE_NOT_READY');
  }

  return {
    recipientName: registration.student.name,
    studentId: registration.student.studentId,
    eventTitle: registration.event.title,
    eventStart: registration.event.startTime,
    eventEnd: registration.event.endTime,
    venue: registration.event.venue,
    organizer: registration.event.organizer,
    confirmationCode: registration.confirmationCode,
    attendanceRecordedAt: registration.attendance.checkedInAt,
  };
}

export async function submitFeedback(registrationId: string, studentId: string, rating: number, comment?: string) {
  const registration = await prisma.registration.findUnique({ where: { id: registrationId } });
  if (!registration || registration.studentId !== studentId) {
    throw new AppError('Registration not found', 404, 'REGISTRATION_NOT_FOUND');
  }
  if (registration.status !== 'ATTENDED') {
    throw new AppError('Feedback is available after attendance is recorded', 409, 'ATTENDANCE_REQUIRED');
  }

  try {
    return await prisma.feedback.create({
      data: {
        rating,
        comment: comment || null,
        studentId,
        eventId: registration.eventId,
        registrationId,
      },
    });
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      throw new AppError('Feedback has already been submitted for this event', 409, 'FEEDBACK_EXISTS');
    }
    throw error;
  }
}

export async function getEventFeedback(eventId: string) {
  const [feedback, aggregate] = await Promise.all([
    prisma.feedback.findMany({
      where: { eventId },
      orderBy: { submittedAt: 'desc' },
      include: { student: { select: { name: true, studentId: true } } },
    }),
    prisma.feedback.aggregate({ where: { eventId }, _avg: { rating: true }, _count: { _all: true } }),
  ]);
  return { feedback, averageRating: aggregate._avg.rating, total: aggregate._count._all };
}
