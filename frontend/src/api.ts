const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1').replace(/\/$/, '');

export type User = {
  id: string;
  name: string;
  email: string;
  studentId: string;
  department?: string | null;
  academicYear?: string | null;
  role: 'STUDENT' | 'ADMIN';
  accountStatus?: string;
};

export type EventRecord = {
  id: string;
  title: string;
  description: string;
  category?: string | null;
  venue?: string | null;
  startTime: string;
  endTime: string;
  registrationDeadline: string;
  capacity?: number | null;
  eligibility?: string | null;
  organizer?: string | null;
  imageUrl?: string | null;
  status: string;
  creator?: { id: string; name: string };
  registrations?: Registration[];
};

export type Registration = {
  id: string;
  confirmationCode: string;
  status: string;
  registeredAt: string;
  attendance?: { id: string; status: string; checkedInAt: string } | null;
  feedback?: { id: string; rating: number; comment?: string | null; submittedAt: string } | null;
  event: Pick<EventRecord, 'id' | 'title' | 'startTime' | 'venue' | 'status'>;
  student?: { name: string; email: string; studentId: string; department?: string | null; academicYear?: string | null };
};

export type CertificateData = {
  recipientName: string;
  studentId: string;
  eventTitle: string;
  eventStart: string;
  eventEnd: string;
  venue?: string | null;
  organizer?: string | null;
  confirmationCode: string;
  attendanceRecordedAt: string;
};

export type EventFeedback = {
  id: string;
  rating: number;
  comment?: string | null;
  submittedAt: string;
  student: { name: string; studentId: string };
};

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('cems.accessToken');
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new ApiError(`Cannot reach the CEMS API at ${API_BASE}. Check that the backend is running and its CORS origin includes this frontend.`, 0);
  }

  const payload = response.status === 204 ? null : await response.json().catch(() => null);
  if (response.status === 401 && token) {
    localStorage.removeItem('cems.accessToken');
    localStorage.removeItem('cems.user');
    window.dispatchEvent(new Event('cems:session-expired'));
  }
  if (!response.ok) {
    const message = payload?.error?.message || payload?.message || `Request failed (${response.status})`;
    throw new ApiError(message, response.status);
  }
  return payload as T;
}

export const data = <T,>(payload: { data: T }): T => payload.data;
