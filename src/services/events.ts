import { prisma } from '../config/prisma';
import { AppError } from '../utils/errors';
import { z } from 'zod';

export async function createEvent(data: {
  title: string;
  description: string;
  category?: string;
  venue?: string;
  startTime: string;
  endTime: string;
  registrationDeadline: string;
  capacity?: number;
  eligibility?: string;
  imageUrl?: string;
  organizer?: string;
}, creatorId: string) {
  const { title, description, category, venue, startTime, endTime, registrationDeadline, capacity, eligibility, imageUrl, organizer } = data;

  // Validate times
  const start = new Date(startTime);
  const end = new Date(endTime);
  const deadline = new Date(registrationDeadline);

  if (end <= start) {
    throw new AppError('End time must be after start time', 400, 'INVALID_TIME');
  }

  if (deadline > start) {
    throw new AppError('Registration deadline must be before or at event start time', 400, 'INVALID_DEADLINE');
  }

  // Check if organizer is valid if provided
  if (organizer) {
    const orgUser = await prisma.user.findUnique({ where: { id: organizer } });
    if (!orgUser) {
      throw new AppError('Organizer not found', 404, 'ORGANIZER_NOT_FOUND');
    }
    if (orgUser.role !== 'ADMIN' && orgUser.role !== 'STUDENT') {
      throw new AppError('Organizer must be an admin or student', 400, 'INVALID_ORGANIZER');
    }
  }

  const event = await prisma.event.create({
    data: {
      title,
      slug: title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
      description,
      category,
      venue,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      registrationDeadline: deadline.toISOString(),
      capacity,
      eligibility,
      imageUrl: imageUrl || null,
      organizer: organizer || null,
      creatorId,
      status: 'DRAFT',
    },
  });

  return event;
}

export async function getEventById(eventId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      creator: {
        select: { id: true, name: true, email: true }
      },
      registrations: {
        select: { id: true, status: true, registeredAt: true }
      }
    }
  });

  if (!event) {
    throw new AppError('Event not found', 404, 'EVENT_NOT_FOUND');
  }

  return event;
}

export async function getEvents(query: {
  page: number;
  limit: number;
  search?: string;
  category?: string;
  status?: string;
  department?: string;
  sortBy: string;
  sortOrder: string;
}) {
  const { page, limit, search, category, status, department, sortBy, sortOrder } = query;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {
    status: { not: 'DRAFT' }, // Only show published and above events to public
  };

  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' as const } },
      { description: { contains: search, mode: 'insensitive' as const } },
      { venue: { contains: search, mode: 'insensitive' as const } },
    ];
  }

  if (category) {
    where.category = { equals: category, mode: 'insensitive' as const };
  }

  if (status) {
    where.status = status as any;
  }

  // Department filtering for students (would need to check student department vs event eligibility or category)
  // Simplified for now - would need more complex logic based on eligibility field

  const [events, total] = await Promise.all([
    prisma.event.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      include: {
        creator: { select: { id: true, name: true } },
      },
    }),
    prisma.event.count({ where }),
  ]);

  return { events, pagination: { page, limit, total } };
}

export async function getAdminEvents(query: {
  page: number;
  limit: number;
  search?: string;
  status?: string;
  sortBy: string;
  sortOrder: string;
}) {
  const { page, limit, search, status, sortBy, sortOrder } = query;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};

  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' as const } },
      { description: { contains: search, mode: 'insensitive' as const } },
      { venue: { contains: search, mode: 'insensitive' as const } },
    ];
  }

  if (status) {
    where.status = status as any;
  }

  const [events, total] = await Promise.all([
    prisma.event.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      include: {
        creator: { select: { id: true, name: true } },
        registrations: { select: { id: true, status: true } },
      },
    }),
    prisma.event.count({ where }),
  ]);

  return { events, pagination: { page, limit, total } };
}

export async function updateEvent(eventId: string, data: {
  title?: string;
  description?: string;
  category?: string;
  venue?: string;
  startTime?: string;
  endTime?: string;
  registrationDeadline?: string;
  capacity?: number;
  eligibility?: string;
  imageUrl?: string;
  organizer?: string;
}) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) {
    throw new AppError('Event not found', 404, 'EVENT_NOT_FOUND');
  }

  // Prevent updates to published events in certain fields (optional business rule)
  // Allow updates but with validation

  const updateData: Record<string, unknown> = {};

  if (data.title !== undefined) updateData.title = data.title;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.category !== undefined) updateData.category = data.category;
  if (data.venue !== undefined) updateData.venue = data.venue;
  if (data.startTime !== undefined) {
    updateData.startTime = new Date(data.startTime).toISOString();
  }
  if (data.endTime !== undefined) {
    updateData.endTime = new Date(data.endTime).toISOString();
  }
  if (data.registrationDeadline !== undefined) {
    updateData.registrationDeadline = new Date(data.registrationDeadline).toISOString();
  }
  if (data.capacity !== undefined) updateData.capacity = data.capacity;
  if (data.eligibility !== undefined) updateData.eligibility = data.eligibility;
  if (data.imageUrl !== undefined) updateData.imageUrl = data.imageUrl || null;
  if (data.organizer !== undefined) updateData.organizer = data.organizer;

  // Validate time relationships if both start and end times are provided
  if (updateData.startTime && updateData.endTime) {
    const start = new Date(updateData.startTime as string);
    const end = new Date(updateData.endTime as string);
    if (end <= start) {
      throw new AppError('End time must be after start time', 400, 'INVALID_TIME');
    }
  }

  // Validate registration deadline if provided with start time
  if (updateData.registrationDeadline) {
    const deadline = new Date(updateData.registrationDeadline as string);
    const startTime = updateData.startTime ? new Date(updateData.startTime as string) : event.startTime;
    if (deadline > startTime) {
      throw new AppError('Registration deadline must be before or at event start time', 400, 'INVALID_DEADLINE');
    }
  }

  const updatedEvent = await prisma.event.update({
    where: { id: eventId },
    data: updateData,
  });

  return updatedEvent;
}

export async function publishEvent(eventId: string) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) {
    throw new AppError('Event not found', 404, 'EVENT_NOT_FOUND');
  }

  if (event.status !== 'DRAFT') {
    throw new AppError('Only draft events can be published', 400, 'INVALID_STATUS');
  }

  const updatedEvent = await prisma.event.update({
    where: { id: eventId },
    data: { status: 'PUBLISHED' },
  });

  return updatedEvent;
}

export async function closeRegistration(eventId: string) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) {
    throw new AppError('Event not found', 404, 'EVENT_NOT_FOUND');
  }

  if (event.status !== 'REGISTRATION_OPEN') {
    throw new AppError('Registration can only be closed while it is open', 400, 'INVALID_STATUS');
  }

  const updatedEvent = await prisma.event.update({
    where: { id: eventId },
    data: { status: 'REGISTRATION_CLOSED' },
  });

  return updatedEvent;
}

export async function openRegistration(eventId: string) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) {
    throw new AppError('Event not found', 404, 'EVENT_NOT_FOUND');
  }

  if (event.status !== 'PUBLISHED' && event.status !== 'REGISTRATION_CLOSED') {
    throw new AppError('Registration can only be opened for published or closed events', 400, 'INVALID_STATUS');
  }

  // Check if auto-closed due to deadline or capacity
  const now = new Date();
  const deadline = new Date(event.registrationDeadline);
  if (now > deadline) {
    throw new AppError('Registration deadline has passed', 400, 'DEADLINE_PASSED');
  }

  if (event.capacity !== null) {
    const confirmedCount = await prisma.registration.count({
      where: { eventId: event.id, status: 'CONFIRMED' },
    });
    if (confirmedCount >= event.capacity) {
      throw new AppError('Event is at full capacity', 400, 'EVENT_FULL');
    }
  }

  const updatedEvent = await prisma.event.update({
    where: { id: eventId },
    data: { status: 'REGISTRATION_OPEN' },
  });

  return updatedEvent;
}

export async function cancelEvent(eventId: string) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) {
    throw new AppError('Event not found', 404, 'EVENT_NOT_FOUND');
  }

  const updatedEvent = await prisma.event.update({
    where: { id: eventId },
    data: { status: 'CANCELLED' },
  });

  return updatedEvent;
}

export async function getEventRegistrations(eventId: string, query: {
  page: number;
  limit: number;
  status?: string;
  search?: string;
  sortBy: string;
  sortOrder: string;
}) {
  const { page, limit, status, search, sortBy, sortOrder } = query;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = { eventId };

  if (status) {
    where.status = status as any;
  }

  if (search) {
    where.OR = [
      { student: { name: { contains: search, mode: 'insensitive' as const } } },
      { student: { email: { contains: search, mode: 'insensitive' as const } } },
      { student: { studentId: { contains: search, mode: 'insensitive' as const } } },
    ];
  }

  const [registrations, total] = await Promise.all([
    prisma.registration.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      include: {
        student: {
          select: { id: true, name: true, email: true, studentId: true, department: true, academicYear: true }
        },
        attendance: true,
      },
    }),
    prisma.registration.count({ where }),
  ]);

  return { registrations, pagination: { page, limit, total } };
}
