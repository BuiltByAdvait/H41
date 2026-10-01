# Campus Event Management System (CEMS)

## Run the application

The API and React frontend run as separate processes. Configure the backend's existing `.env` privately with its database and JWT settings; never put backend secrets in the frontend environment.

```bash
# Terminal 1: install backend dependencies, generate Prisma Client, and start the API
npm install
npx prisma generate
npx tsx src/server.ts

# Terminal 2: configure and start the frontend
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

The API defaults to `http://localhost:3000` and Vite to `http://localhost:5173`. Set `VITE_API_BASE_URL` in `frontend/.env.local` if the API uses another URL. The backend CORS setting `FRONTEND_URL` must allow the frontend origin. A baseline Prisma migration is now included; it creates the full schema and is intended only for a new, empty database. The configured Neon database currently lacks at least the `Event` table, and this migration has deliberately not been applied. For a verified empty development database, set the backend's `DATABASE_URL` to that database (use Neon's direct/unpooled connection for migration), then run `npx prisma migrate deploy` before starting the API. Review the target branch and use an isolated/empty database before deploying it; do not run `prisma db push` against a database with data you need to preserve.

## Implemented frontend flows and API limits

The frontend uses the implemented `/api/v1` contracts for student registration/login, current-user session checks, public event discovery, student event registration and cancellation, admin event creation/editing/lifecycle actions, and per-event participant lists. Event creation requires a start time, end time, and registration deadline; new events are drafts and must be published and opened for registration before students can register. Admins can open registration for published/closed events and close registration for open events.

Advanced event routes are also available: `POST /api/v1/admin/events/:eventId/check-in` records attendance from a registration confirmation code; `GET /api/v1/registrations/:registrationId/certificate` returns certificate data only after check-in; `POST /api/v1/registrations/:registrationId/feedback` accepts one 1–5 rating and optional comment after attendance; and `GET /api/v1/admin/events/:eventId/feedback` returns attendee feedback and the average rating. The student entry pass contains a QR code with the event ID and confirmation code. Admin check-in supports camera scanning or manual code entry. Certificates are rendered in the frontend and can be printed or saved as PDF.

The backend currently returns `501 NOT_IMPLEMENTED` for `DELETE /api/v1/admin/events/:eventId` and `GET /api/v1/admin/registrations`. The admin interface therefore provides event cancellation and attendee lists per event; it does not offer event deletion or a global registrations page. Registration status is assigned by the backend and cannot be edited through a general admin endpoint; QR check-in changes it to `ATTENDED`.

## Admin and demo access

Public signup always creates a `STUDENT` account. There is no admin signup route or pre-created admin account in the migrated database. Admin-only pages and endpoints require a database user whose role is `ADMIN`; the app intentionally does not let a student promote themselves.

For a judge/demo environment, an opt-in, repeatable seed is available. It creates one demo admin, five demo students, four sample events, registrations, and completed-event attendance and feedback. It does not delete or reset records. It uses the demo email addresses `admin@cems.demo` and `student01@cems.demo`; you choose the passwords locally. **Run this only after confirming `.env` points to an isolated test branch, not production.** The migration screenshot showed the production endpoint, so do not seed the database shown there unless you have explicitly decided that is your demo database.

In zsh, from the repository root, enter passwords without displaying them, then run the guarded seed:

```zsh
read -s 'CEMS_DEMO_ADMIN_PASSWORD?Admin demo password (12+ characters): '; echo
read -s 'CEMS_DEMO_STUDENT_PASSWORD?Student demo password (12+ characters): '; echo
export CEMS_DEMO_ADMIN_PASSWORD CEMS_DEMO_STUDENT_PASSWORD
CEMS_DEMO_SEED_CONFIRM=seed-cems-demo-data npm run demo:seed
unset CEMS_DEMO_ADMIN_PASSWORD CEMS_DEMO_STUDENT_PASSWORD
```

The script refuses `NODE_ENV=production`, requires the explicit confirmation variable, and refuses passwords shorter than 12 characters. Existing demo rows are left as-is on repeat runs. Never commit `.env` or use demo credentials for a real deployment.

Admin permissions currently cover event creation/editing, publish/cancel, opening/closing registration, per-event participant lists/counts, QR/manual attendance check-in, and event feedback summaries. Public signup cannot create admins. Event deletion and a global admin registrations endpoint return `501 NOT_IMPLEMENTED`; event cancellation is supported instead.

## Feature coverage

The current app supports event name, date/time, venue, description, capacity, student registration, confirmation codes/QR passes, per-event participant lists and counts, and admin registration close/reopen. QR check-in records attendance; attended students can request a printable certificate and submit one event rating/comment; admins can review feedback and its average. Extra working basics include login/logout, event search, student registration history/cancellation, event edit/publish/cancel, capacity/status display, and responsive layouts.

## 1. Overview
The **Campus Event Management System (CEMS)** is a web-based platform designed to digitize and automate college event planning, student registration, capacity monitoring, and attendance management.

## 2. Core Objectives
- Eliminate manual paperwork and duplicate entries.
- Provide real-time seat availability and automatic registration closures.
- Centralize event discovery, tracking, and communication for campus activities.

## 3. Key User Roles

### Admin
- **Event Management:** Create, edit, publish, or cancel events; define capacity and registration windows.
- **Participant Management:** View and search attendees, export lists (CSV/Excel/PDF), and track attendance via QR verification.
- **Analytics:** Monitor registration trends and capacity utilization.

### Student
- **Discovery:** Search and filter upcoming campus events by category, venue, or department.
- **Registration:** Register with instant confirmation IDs, manage schedules, and cancel before deadlines.
- **Notifications:** Receive status alerts, waitlist updates, and event notifications.

## 4. Core Features
- **Smart Capacity & Closure Control:** Automatically closes registrations when capacity limits or deadlines are met; manages waitlists for full events.
- **Data Integrity:** Enforces unique registrations per student per event to prevent duplicate entries.
- **QR Check-in:** Generates unique QR codes upon registration for entry verification and automated attendance tracking.

## 5. Database Schema Overview

| Entity | Primary Attributes |
| :--- | :--- |
| **Admin** | `admin_id`, `name`, `email`, `password` |
| **Student** | `student_id`, `name`, `email`, `department`, `year`, `contact` |
| **Event** | `event_id`, `event_name`, `date`, `venue`, `category`, `capacity`, `status` |
| **Registration** | `registration_id`, `student_id`, `event_id`, `registration_date`, `status` |
| **Attendance** | `attendance_id`, `registration_id`, `event_id`, `status`, `timestamp` |
| **Notification** | `notification_id`, `student_id`, `event_id`, `message`, `read_status` |

## 6. Event Lifecycle Flow

```text
[Draft] ➔ [Upcoming] ➔ [Registration Open] ➔ [Registration Full / Closed] ➔ [Ongoing] ➔ [Completed]
                                                                                └──> [Cancelled]
```

## 7. Future Enhancements
- Mobile application support (iOS & Android).
- AI-driven event recommendations based on student preferences.
- Automated digital certificates generated upon event completion.
- Payment gateway integration for ticketed/paid events.
