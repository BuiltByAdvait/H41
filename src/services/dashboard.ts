import { prisma } from '../config/prisma';
import { AppError } from '../utils/errors';

export async function getDashboardStats() {
  const [
    totalStudents,
    totalEvents,
    upcomingEvents,
    ongoingEvents,
    completedEvents,
    cancelledEvents,
    totalRegistrations,
    confirmedRegistrations,
    waitlistedRegistrations,
    recentRegistrations,
    capacityUtilization,
    departmentParticipation,
  ] = await Promise.all([
    prisma.user.count({ where: { role: 'STUDENT' } }),
    prisma.event.count(),
    prisma.event.count({
      where: { status: 'PUBLISHED' },
    }),
    prisma.event.count({
      where: { status: 'ONGOING' },
    }),
    prisma.event.count({
      where: { status: 'COMPLETED' },
    }),
    prisma.event.count({
      where: { status: 'CANCELLED' },
    }),
    prisma.registration.count(),
    prisma.registration.count({ where: { status: 'CONFIRMED' } }),
    prisma.registration.count({ where: { status: 'WAITLISTED' } }),
    prisma.registration.findMany({
      take: 10,
      orderBy: { registeredAt: 'desc' },
      include: {
        student: { select: { id: true, name: true, email: true } },
        event: { select: { id: true, title: true } },
      },
    }),
    prisma.event.findMany({
      where: { capacity: { not: null } },
      select: {
        id: true,
        title: true,
        capacity: true,
        _count: { select: { registrations: { where: { status: 'CONFIRMED' } } } },
      },
    }),
    // Department-wise participation (privacy-safe: aggregates only)
    prisma.registration.groupBy({
      by: ['studentId'],
      where: { status: 'CONFIRMED' },
      _count: { id: true },
    }),
  ]);

  // Get department participation by joining with users
  const registrations = await prisma.registration.findMany({
    where: { status: 'CONFIRMED' },
    include: { student: { select: { department: true } } },
  });

  const departmentCounts: Record<string, number> = {};
  registrations.forEach((r) => {
    const dept = r.student.department || 'Unknown';
    departmentCounts[dept] = (departmentCounts[dept] || 0) + 1;
  });

  const capacityUtil = capacityUtilization.map((e) => ({
    eventId: e.id,
    title: e.title,
    capacity: e.capacity,
    confirmedRegistrations: e._count.registrations,
    utilizationPercent: e.capacity
      ? Math.round((e._count.registrations / e.capacity) * 100)
      : 0,
  }));

  return {
    totalStudents,
    totalEvents,
    upcomingEvents,
    ongoingEvents,
    completedEvents,
    cancelledEvents,
    totalRegistrations,
    confirmedRegistrations,
    waitlistedRegistrations,
    recentRegistrations,
    capacityUtilization: capacityUtil,
    departmentParticipation: departmentCounts,
  };
}

export async function getRegistrationTrends() {
  // Group registrations by date for trends
  const trends = await prisma.registration.groupBy({
    by: ['registeredAt'],
    where: { status: 'CONFIRMED' },
    _count: { id: true },
  });

  return trends.map((t) => ({
    date: t.registeredAt.toISOString().split('T')[0],
    count: t._count.id,
  }));
}