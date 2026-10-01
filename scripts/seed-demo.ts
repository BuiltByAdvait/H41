import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient, EventStatus, RegistrationStatus } from '@prisma/client';

const prisma = new PrismaClient();
const confirmation = 'seed-cems-demo-data';

if (process.env.NODE_ENV === 'production') {
  throw new Error('Refusing to seed demo data when NODE_ENV=production.');
}
if (process.env.CEMS_DEMO_SEED_CONFIRM !== confirmation) {
  throw new Error(`Set CEMS_DEMO_SEED_CONFIRM=${confirmation} to explicitly enable demo data.`);
}

const adminPassword = process.env.CEMS_DEMO_ADMIN_PASSWORD;
const studentPassword = process.env.CEMS_DEMO_STUDENT_PASSWORD;
if (!adminPassword || adminPassword.length < 12 || !studentPassword || studentPassword.length < 12) {
  throw new Error('Set CEMS_DEMO_ADMIN_PASSWORD and CEMS_DEMO_STUDENT_PASSWORD (12+ characters each).');
}

const plusDays = (days: number, hour = 10) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, 0, 0, 0);
  return date;
};

async function main(adminPasswordValue: string, studentPasswordValue: string) {
  const [adminHash, studentHash] = await Promise.all([
    bcrypt.hash(adminPasswordValue, 12),
    bcrypt.hash(studentPasswordValue, 12),
  ]);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@cems.demo' },
    update: {},
    create: {
      name: 'CEMS Demo Administrator', email: 'admin@cems.demo', studentId: 'CEMS-DEMO-ADMIN',
      department: 'Student Affairs', academicYear: 'Staff', passwordHash: adminHash, role: 'ADMIN',
    },
  });
  if (admin.role !== 'ADMIN') {
    throw new Error('The reserved demo admin email already belongs to a non-admin account; no role was changed.');
  }

  const students = await Promise.all(Array.from({ length: 5 }, (_, index) => {
    const number = String(index + 1).padStart(2, '0');
    return prisma.user.upsert({
      where: { email: `student${number}@cems.demo` },
      update: {},
      create: {
        name: ['Mira Shah', 'Arjun Mehta', 'Isha Patel', 'Rohan Das', 'Anaya Rao'][index],
        email: `student${number}@cems.demo`, studentId: `CEMS-DEMO-${number}`,
        department: ['Computer Science', 'Design', 'Electronics', 'Business', 'Computer Science'][index],
        academicYear: `Year ${index % 3 + 1}`, passwordHash: studentHash, role: 'STUDENT',
      },
    });
  }));
  if (students.some((student) => student.role !== 'STUDENT')) {
    throw new Error('A reserved demo student email belongs to a non-student account; no role was changed.');
  }

  const upcomingStart = plusDays(14);
  const completedStart = plusDays(-18);
  const records = [
    {
      slug: 'cems-demo-innovation-summit', title: 'Campus Innovation Summit', category: 'Technology',
      description: 'A day of student-built ideas, practical workshops, and conversations with local founders.',
      venue: 'Innovation Hall', startTime: upcomingStart, endTime: new Date(upcomingStart.getTime() + 4 * 60 * 60 * 1000),
      registrationDeadline: plusDays(11), capacity: 120, status: EventStatus.REGISTRATION_OPEN,
    },
    {
      slug: 'cems-demo-design-jam', title: 'Design for Good Jam', category: 'Workshop',
      description: 'Collaborate in teams to prototype a thoughtful solution to a campus-life challenge.',
      venue: 'Design Studio, Block B', startTime: plusDays(21, 13), endTime: plusDays(21, 17),
      registrationDeadline: plusDays(18), capacity: 60, status: EventStatus.PUBLISHED,
    },
    {
      slug: 'cems-demo-cultural-evening', title: 'One Campus Cultural Evening', category: 'Culture',
      description: 'Music, dance, and performances celebrating the many communities that make up campus.',
      venue: 'Open-Air Amphitheatre', startTime: plusDays(35, 18), endTime: plusDays(35, 21),
      registrationDeadline: plusDays(32), capacity: 250, status: EventStatus.REGISTRATION_OPEN,
    },
    {
      slug: 'cems-demo-community-build', title: 'Community Build Day', category: 'Community',
      description: 'Students came together for a hands-on day of volunteering and neighborhood projects.',
      venue: 'North Campus Lawn', startTime: completedStart, endTime: new Date(completedStart.getTime() + 3 * 60 * 60 * 1000),
      registrationDeadline: plusDays(-21), capacity: 80, status: EventStatus.COMPLETED,
    },
  ];

  const events = await Promise.all(records.map((event) => prisma.event.upsert({
    where: { slug: event.slug }, update: {}, create: { ...event, creatorId: admin.id, organizer: 'Campus Student Council' },
  })));

  for (const [eventIndex, event] of events.entries()) {
    const people = eventIndex === 3 ? students.slice(0, 4) : students.slice(0, eventIndex === 0 ? 3 : 2);
    for (const [personIndex, student] of people.entries()) {
      const attended = eventIndex === 3;
      const registration = await prisma.registration.upsert({
        where: { studentId_eventId: { studentId: student.id, eventId: event.id } },
        update: {},
        create: {
          studentId: student.id, eventId: event.id,
          confirmationCode: `DEMO-${eventIndex + 1}-${String(personIndex + 1).padStart(3, '0')}`,
          status: attended ? RegistrationStatus.ATTENDED : RegistrationStatus.CONFIRMED,
        },
      });

      if (attended) {
        await prisma.attendance.upsert({
          where: { registrationId: registration.id }, update: {},
          create: { registrationId: registration.id, eventId: event.id, checkedInById: admin.id },
        });
        await prisma.feedback.upsert({
          where: { registrationId: registration.id }, update: {},
          create: {
            registrationId: registration.id, studentId: student.id, eventId: event.id,
            rating: 4 + personIndex % 2,
            comment: ['Loved working with the volunteer team.', 'A meaningful way to meet people across campus.', 'Well organized and genuinely fun.', 'Would happily join another one.'][personIndex],
          },
        });
      }
    }
  }

  console.log('Demo records are ready (4 events, 5 students, registrations, attendance and feedback).');
  console.log('Admin login: admin@cems.demo');
  console.log('Student login: student01@cems.demo');
  console.log('Passwords are the values supplied through the two CEMS_DEMO_*_PASSWORD variables.');
}

main(adminPassword, studentPassword).catch((error: unknown) => {
  console.error('Demo seed failed:', error instanceof Error ? error.message : 'Unknown error');
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});
