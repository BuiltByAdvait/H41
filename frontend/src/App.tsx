import { useCallback, useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { data, request, type CertificateData, type EventFeedback, type EventRecord, type Registration, type User } from './api';

type Tab = 'events' | 'registrations' | 'admin';
type ApiList<T> = { data: T[]; meta?: { pagination?: { total: number } } };
type EventPage = { data: { events: EventRecord[]; pagination: { total: number } } };
type EventDraft = {
  title: string; description: string; category: string; venue: string;
  startTime: string; endTime: string; registrationDeadline: string; capacity: string;
};

const emptyDraft: EventDraft = { title: '', description: '', category: '', venue: '', startTime: '', endTime: '', registrationDeadline: '', capacity: '' };
const dateTime = (value?: string) => value ? new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Time not set';
const toLocalInput = (value?: string) => value ? new Date(value).toISOString().slice(0, 16) : '';
const errorText = (error: unknown) => error instanceof Error ? error.message : 'Something went wrong. Please try again.';
const eventPayload = (draft: EventDraft) => ({
  title: draft.title.trim(), description: draft.description.trim(),
  ...(draft.category.trim() ? { category: draft.category.trim() } : {}),
  ...(draft.venue.trim() ? { venue: draft.venue.trim() } : {}),
  startTime: new Date(draft.startTime).toISOString(), endTime: new Date(draft.endTime).toISOString(),
  registrationDeadline: new Date(draft.registrationDeadline).toISOString(),
  ...(draft.capacity ? { capacity: Number(draft.capacity) } : {}),
});

function App() {
  const [user, setUser] = useState<User | null>(() => {
    try { return JSON.parse(localStorage.getItem('cems.user') || 'null') as User | null; } catch { return null; }
  });
  const [token, setToken] = useState(() => localStorage.getItem('cems.accessToken'));
  const [tab, setTab] = useState<Tab>('events');
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [selected, setSelected] = useState<EventRecord | null>(null);
  const [participants, setParticipants] = useState<Registration[] | null>(null);
  const [participantsEvent, setParticipantsEvent] = useState<EventRecord | null>(null);
  const [feedbackView, setFeedbackView] = useState<{ event: EventRecord; feedback: EventFeedback[]; averageRating: number | null; total: number } | null>(null);
  const [certificate, setCertificate] = useState<CertificateData | null>(null);
  const [editing, setEditing] = useState<EventRecord | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [draft, setDraft] = useState<EventDraft>(emptyDraft);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [busy, setBusy] = useState(false);
  const [entryCode, setEntryCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');

  const refreshEvents = useCallback(async () => {
    const path = user?.role === 'ADMIN' ? '/admin/events?limit=100&sortBy=startTime&sortOrder=asc' : '/events?limit=100&sortBy=startTime&sortOrder=asc';
    const result = await request<EventPage>(path);
    setEvents(data(result).events);
  }, [user?.role]);

  const refreshRegistrations = useCallback(async () => {
    if (!user || user.role !== 'STUDENT') return;
    const result = await request<ApiList<Registration>>('/registrations/me?limit=100');
    setRegistrations(data(result));
  }, [user]);

  const loadDashboard = useCallback(async () => {
    setLoading(true); setError('');
    try {
      await refreshEvents();
      if (user?.role === 'STUDENT') await refreshRegistrations();
    } catch (reason) { setError(errorText(reason)); }
    finally { setLoading(false); }
  }, [refreshEvents, refreshRegistrations, user?.role]);

  useEffect(() => {
    const expire = () => { setToken(null); setUser(null); setError('Your session expired. Please sign in again.'); };
    window.addEventListener('cems:session-expired', expire);
    return () => window.removeEventListener('cems:session-expired', expire);
  }, []);

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    request<{ data: User }>('/auth/me').then((result) => {
      const current = data(result); setUser(current); localStorage.setItem('cems.user', JSON.stringify(current));
    }).catch((reason) => { setError(errorText(reason)); setToken(null); setUser(null); })
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => { if (user) void loadDashboard(); }, [user, loadDashboard]);

  const registeredIds = useMemo(() => new Set(registrations.filter((item) => item.status !== 'CANCELLED').map((item) => item.event.id)), [registrations]);
  const filteredEvents = useMemo(() => events.filter((event) => `${event.title} ${event.description} ${event.category || ''} ${event.venue || ''}`.toLowerCase().includes(query.toLowerCase())), [events, query]);

  const authenticate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setError('');
    const form = new FormData(event.currentTarget);
    const body = authMode === 'login'
      ? { email: String(form.get('email')), password: String(form.get('password')) }
      : { name: String(form.get('name')), email: String(form.get('email')), studentId: String(form.get('studentId')), department: String(form.get('department') || ''), academicYear: String(form.get('academicYear') || ''), password: String(form.get('password')) };
    try {
      const result = data(await request<{ data: User | { user: User; accessToken: string } }>('/auth/' + (authMode === 'login' ? 'login' : 'register'), { method: 'POST', body: JSON.stringify(body) }));
      if (authMode === 'register') {
        setNotice('Account created. Sign in with your new credentials.'); setAuthMode('login');
      } else {
        const session = result as { user: User; accessToken: string };
        localStorage.setItem('cems.accessToken', session.accessToken); localStorage.setItem('cems.user', JSON.stringify(session.user));
        setToken(session.accessToken); setUser(session.user); setNotice(`Welcome, ${session.user.name}.`);
      }
    } catch (reason) { setError(errorText(reason)); }
    finally { setBusy(false); }
  };

  const logout = async () => {
    try { if (token) await request('/auth/logout', { method: 'POST' }); } catch { /* Clear the local session even if the server is unavailable. */ }
    localStorage.removeItem('cems.accessToken'); localStorage.removeItem('cems.user');
    setToken(null); setUser(null); setTab('events'); setNotice('You have signed out.');
  };

  const registerForEvent = async (event: EventRecord) => {
    setBusy(true); setError('');
    try {
      const result = data(await request<{ data: Registration }>(`/events/${event.id}/register`, { method: 'POST' }));
      setNotice(`Registration confirmed. Code: ${result.confirmationCode}`);
      await Promise.all([refreshEvents(), refreshRegistrations()]); setSelected(null);
    } catch (reason) { setError(errorText(reason)); }
    finally { setBusy(false); }
  };

  const cancelRegistration = async (registration: Registration) => {
    setBusy(true); setError('');
    try {
      await request(`/registrations/${registration.id}`, { method: 'DELETE' });
      setNotice('Registration cancelled.'); await Promise.all([refreshRegistrations(), refreshEvents()]);
    } catch (reason) { setError(errorText(reason)); }
    finally { setBusy(false); }
  };

  const setEventForm = (event?: EventRecord) => {
    setFormOpen(true);
    setEditing(event || null);
    setDraft(event ? { title: event.title, description: event.description, category: event.category || '', venue: event.venue || '', startTime: toLocalInput(event.startTime), endTime: toLocalInput(event.endTime), registrationDeadline: toLocalInput(event.registrationDeadline), capacity: event.capacity ? String(event.capacity) : '' } : emptyDraft);
    setError('');
  };

  const saveEvent = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const body = eventPayload(draft);
      if (editing) await request(`/admin/events/${editing.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      else await request('/admin/events', { method: 'POST', body: JSON.stringify(body) });
      setNotice(editing ? 'Event changes saved.' : 'Draft event created. Publish it to make it visible to students.');
      setFormOpen(false); setEditing(null); setDraft(emptyDraft); await refreshEvents();
    } catch (reason) { setError(errorText(reason)); }
    finally { setBusy(false); }
  };

  const eventAction = async (event: EventRecord, action: string) => {
    setBusy(true); setError('');
    try {
      await request(`/admin/events/${event.id}/${action}`, { method: 'POST' });
      setNotice(action === 'publish' ? 'Event published.' : action === 'cancel' ? 'Event cancelled.' : action === 'open-registration' ? 'Registration opened.' : 'Registration closed.');
      await refreshEvents();
    } catch (reason) { setError(errorText(reason)); }
    finally { setBusy(false); }
  };

  const showParticipants = async (event: EventRecord) => {
    setBusy(true); setError('');
    try {
      const result = data(await request<{ data: { registrations: Registration[] } }>(`/admin/events/${event.id}/participants?limit=100`));
      setNotice(`${event.title}: ${result.registrations.length} participant${result.registrations.length === 1 ? '' : 's'} loaded.`);
      setParticipantsEvent(event); setParticipants(result.registrations); setEntryCode('');
    } catch (reason) { setError(errorText(reason)); }
    finally { setBusy(false); }
  };

  const showFeedback = async (event: EventRecord) => {
    setBusy(true); setError('');
    try {
      const result = data(await request<{ data: { feedback: EventFeedback[]; averageRating: number | null; total: number } }>(`/admin/events/${event.id}/feedback`));
      setFeedbackView({ event, ...result });
    } catch (reason) { setError(errorText(reason)); }
    finally { setBusy(false); }
  };

  const downloadCertificate = async (registrationId: string) => {
    setBusy(true); setError('');
    try {
      const result = data(await request<{ data: CertificateData }>(`/registrations/${registrationId}/certificate`));
      setCertificate(result);
    } catch (reason) { setError(errorText(reason)); }
    finally { setBusy(false); }
  };

  const submitEventFeedback = async (registrationId: string, event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setError('');
    const form = new FormData(event.currentTarget);
    try {
      await request(`/registrations/${registrationId}/feedback`, { method: 'POST', body: JSON.stringify({ rating: Number(form.get('rating')), comment: String(form.get('comment') || '').trim() || undefined }) });
      setNotice('Feedback submitted. Thank you.'); await refreshRegistrations();
    } catch (reason) { setError(errorText(reason)); }
    finally { setBusy(false); }
  };

  const confirmCheckIn = async (eventId: string, confirmationCode: string) => {
    setBusy(true); setError('');
    try {
      const result = data(await request<{ data: { registration: { student: { name: string } } } }>(`/admin/events/${eventId}/check-in`, { method: 'POST', body: JSON.stringify({ confirmationCode }) }));
      setNotice(`Entry recorded for ${result.registration.student.name}.`);
      setEntryCode('');
      const list = data(await request<{ data: { registrations: Registration[] } }>(`/admin/events/${eventId}/participants?limit=100`));
      setParticipants(list.registrations);
    } catch (reason) { setError(errorText(reason)); }
    finally { setBusy(false); }
  };

  if (loading) return <main className="center-state"><span className="spinner" />Loading Campus Events</main>;

  if (!user) return <main className="auth-shell">
    <section className="auth-aside"><div className="brand-mark">C</div><p className="eyebrow">CAMPUS LIFE, IN ONE PLACE</p><h1>Find your next<br />campus moment.</h1><p>Discover events, reserve your place, and keep your schedule close.</p><div className="auth-footer">Campus Event Management System</div></section>
    <section className="auth-main"><form className="auth-form" onSubmit={authenticate}>
      <div className="small-brand"><span className="brand-mark">C</span><span>CEMS</span></div>
      <p className="eyebrow">{authMode === 'login' ? 'YOUR CAMPUS, CONNECTED' : 'JOIN YOUR CAMPUS COMMUNITY'}</p>
      <h2>{authMode === 'login' ? 'Welcome back' : 'Create student account'}</h2>
      <p className="muted">{authMode === 'login' ? 'Sign in to explore what is happening.' : 'Use your campus student ID to get started.'}</p>
      {authMode === 'register' && <><label>Full name<input name="name" required minLength={2} autoComplete="name" /></label><label>Student ID<input name="studentId" required minLength={3} autoComplete="off" /></label><div className="form-row"><label>Department<input name="department" minLength={2} /></label><label>Academic year<input name="academicYear" placeholder="e.g. Year 2" /></label></div></>}
      <label>Email address<input name="email" type="email" required autoComplete="email" /></label>
      <label>Password<input name="password" type="password" required minLength={authMode === 'register' ? 8 : 1} autoComplete={authMode === 'login' ? 'current-password' : 'new-password'} /></label>
      {error && <div className="alert error">{error}</div>}{notice && <div className="alert success">{notice}</div>}
      <button className="button primary full" disabled={busy}>{busy ? 'Please wait…' : authMode === 'login' ? 'Sign in' : 'Create account'}</button>
      <p className="switch-auth">{authMode === 'login' ? 'New to CEMS?' : 'Already registered?'} <button type="button" className="text-button" onClick={() => { setAuthMode(authMode === 'login' ? 'register' : 'login'); setError(''); }}> {authMode === 'login' ? 'Create an account' : 'Sign in'}</button></p>
    </form></section>
  </main>;

  const visibleRegistrations = registrations;
  const activeRegistrations = registrations.filter((item) => item.status !== 'CANCELLED');
  const adminRegistrationCount = events.reduce((total, event) => total + (event.registrations?.filter((item) => item.status !== 'CANCELLED').length || 0), 0);
  return <div className="app-shell">
    <header className="topbar"><a className="brand" href="#events" onClick={() => setTab('events')}><span className="brand-mark">C</span><span>CEMS <small>Campus Events</small></span></a><nav className="main-nav"><button className={tab === 'events' ? 'active' : ''} onClick={() => setTab('events')}>Discover</button>{user.role === 'STUDENT' && <button className={tab === 'registrations' ? 'active' : ''} onClick={() => { setTab('registrations'); void refreshRegistrations(); }}>My registrations</button>}{user.role === 'ADMIN' && <button className={tab === 'admin' ? 'active' : ''} onClick={() => setTab('admin')}>Manage events</button>}</nav><div className="profile"><span className="avatar">{user.name.slice(0, 1).toUpperCase()}</span><span className="profile-name">{user.name}<small>{user.role === 'ADMIN' ? 'Administrator' : 'Student'}</small></span><button className="button quiet" onClick={() => void logout()}>Sign out</button></div></header>
    <main className="page">
      <div className="welcome-row"><div><p className="eyebrow">{user.role === 'ADMIN' ? 'EVENT OPERATIONS' : 'CAMPUS CALENDAR'}</p><h1>{tab === 'registrations' ? 'My registrations' : tab === 'admin' ? 'Manage events' : 'Discover campus events'}</h1><p className="muted">{tab === 'registrations' ? 'Your confirmed places and event details.' : tab === 'admin' ? 'Create events and manage registration availability.' : 'Find something worth showing up for.'}</p></div>{tab === 'admin' && <button className="button primary" onClick={() => setEventForm()}>＋ Create event</button>}</div>
      {tab !== 'registrations' && <section className="summary-strip" aria-label="Event overview">
        <article><span className="summary-icon green">✦</span><div><small>{user.role === 'ADMIN' ? 'TOTAL EVENTS' : 'EVENTS TO EXPLORE'}</small><strong>{events.length}</strong></div></article>
        <article><span className="summary-icon amber">↗</span><div><small>{user.role === 'ADMIN' ? 'ACTIVE REGISTRATIONS' : 'YOUR REGISTRATIONS'}</small><strong>{user.role === 'ADMIN' ? adminRegistrationCount : activeRegistrations.length}</strong></div></article>
        <article><span className="summary-icon blue">◷</span><div><small>{user.role === 'ADMIN' ? 'REGISTRATION OPEN' : 'ATTENDED'}</small><strong>{user.role === 'ADMIN' ? events.filter((event) => event.status === 'REGISTRATION_OPEN').length : registrations.filter((item) => item.status === 'ATTENDED').length}</strong></div></article>
        <div className="summary-note"><span>●</span> {user.role === 'ADMIN' ? 'Campus activity at a glance' : 'Your campus calendar, all in one place'}</div>
      </section>}
      {notice && <div className="alert success dismissible">{notice}<button aria-label="Dismiss message" onClick={() => setNotice('')}>×</button></div>}
      {error && <div className="alert error dismissible">{error}<button aria-label="Dismiss message" onClick={() => setError('')}>×</button></div>}
      {loading ? <div className="center-state"><span className="spinner" />Loading events…</div> : <>
        {tab === 'events' && <><div className="toolbar"><label className="search-box"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search events, venues, categories" aria-label="Search events" /></label><span className="result-count">{filteredEvents.length} {filteredEvents.length === 1 ? 'event' : 'events'}</span></div>{filteredEvents.length ? <div className="event-grid">{filteredEvents.map((event) => <EventCard key={event.id} event={event} isRegistered={registeredIds.has(event.id)} isAdmin={user.role === 'ADMIN'} onSelect={() => setSelected(event)} />)}</div> : <Empty title="No events found" detail={query ? 'Try another search term.' : 'There are no published events right now.'} />}</>}
        {tab === 'registrations' && <>{visibleRegistrations.length ? <div className="table-wrap"><table><thead><tr><th>Event</th><th>Date & venue</th><th>Entry pass</th><th>Status</th><th></th></tr></thead><tbody>{visibleRegistrations.map((registration) => <tr key={registration.id}><td><strong>{registration.event.title}</strong><small className="cell-sub">Registered {dateTime(registration.registeredAt)}</small></td><td>{dateTime(registration.event.startTime)}<small className="cell-sub">{registration.event.venue || 'Venue to be announced'}</small></td><td><div className="pass-cell"><QRCodeSVG value={JSON.stringify({ eventId: registration.event.id, confirmationCode: registration.confirmationCode })} size={60} level="M"/><code>{registration.confirmationCode}</code></div></td><td><span className={`status ${registration.status.toLowerCase()}`}>{registration.status}</span></td><td className="registration-actions">{registration.status === 'CONFIRMED' && <button className="button outline small" disabled={busy} onClick={() => void cancelRegistration(registration)}>Cancel</button>}{registration.status === 'ATTENDED' && <><button className="button outline small" disabled={busy} onClick={() => void downloadCertificate(registration.id)}>Certificate</button>{registration.feedback ? <small className="cell-sub">Feedback sent</small> : <details className="feedback-details"><summary>Leave feedback</summary><form onSubmit={(event) => void submitEventFeedback(registration.id, event)}><label>Rating<select name="rating" defaultValue="5"><option value="5">5 · Excellent</option><option value="4">4 · Good</option><option value="3">3 · Okay</option><option value="2">2 · Poor</option><option value="1">1 · Very poor</option></select></label><label>Comment<textarea name="comment" maxLength={2000} rows={2} /></label><button className="button primary small" disabled={busy}>Submit feedback</button></form></details>}</>}</td></tr>)}</tbody></table></div> : <Empty title="No registrations yet" detail="Your confirmed events will appear here." action={<button className="button primary" onClick={() => setTab('events')}>Explore events</button>} />}</>}
        {tab === 'admin' && user.role === 'ADMIN' && <AdminEvents events={events} onEdit={setEventForm} onAction={eventAction} onParticipants={showParticipants} onFeedback={showFeedback} busy={busy} onRefresh={() => void loadDashboard()} />}
      </>}
      <footer className="page-footer">Campus Event Management System <span>·</span> {events.length} event{events.length === 1 ? '' : 's'} in view</footer>
    </main>
    {selected && <div className="overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}><section className="dialog" role="dialog" aria-modal="true" aria-labelledby="detail-title"><button className="icon-button close" aria-label="Close" onClick={() => setSelected(null)}>×</button><p className="eyebrow">{selected.category || 'CAMPUS EVENT'}</p><h2 id="detail-title">{selected.title}</h2><p className="muted">{selected.description}</p><dl className="detail-list"><div><dt>When</dt><dd>{dateTime(selected.startTime)} – {dateTime(selected.endTime)}</dd></div><div><dt>Where</dt><dd>{selected.venue || 'Venue to be announced'}</dd></div><div><dt>Registration closes</dt><dd>{dateTime(selected.registrationDeadline)}</dd></div><div><dt>Capacity</dt><dd>{selected.capacity ?? 'No limit specified'}</dd></div><div><dt>Status</dt><dd><span className={`status ${selected.status.toLowerCase()}`}>{selected.status.replaceAll('_', ' ')}</span></dd></div></dl>{selected.eligibility && <p className="eligibility"><strong>Eligibility:</strong> {selected.eligibility}</p>}{user.role === 'STUDENT' && <button className="button primary full" disabled={busy || registeredIds.has(selected.id) || !['PUBLISHED', 'REGISTRATION_OPEN'].includes(selected.status)} onClick={() => void registerForEvent(selected)}>{registeredIds.has(selected.id) ? 'Already registered' : busy ? 'Registering…' : ['PUBLISHED', 'REGISTRATION_OPEN'].includes(selected.status) ? 'Register for event' : 'Registration unavailable'}</button>}{user.role === 'ADMIN' && <button className="button outline full" onClick={() => { setEventForm(selected); setSelected(null); setTab('admin'); }}>Edit event</button>}</section></div>}
    {participants && participantsEvent && <div className="overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setParticipants(null); }}><section className="dialog participant-dialog" role="dialog" aria-modal="true"><button className="icon-button close" aria-label="Close participants" onClick={() => setParticipants(null)}>×</button><p className="eyebrow">EVENT ATTENDEES</p><h2>{participantsEvent.title}</h2>{error && <div className="alert error" role="alert">{error}</div>}<div className="checkin-panel"><div><strong>Scan an entry pass</strong><small>Allow camera access, or enter the confirmation code.</small></div><QrScanner onCode={(raw) => { try { const pass = JSON.parse(raw) as { eventId?: string; confirmationCode?: string }; setEntryCode(pass.eventId === participantsEvent.id ? pass.confirmationCode || '' : ''); if (pass.eventId !== participantsEvent.id) setError('That QR pass is for another event.'); } catch { setEntryCode(raw.trim()); } }} /><form className="checkin-form" onSubmit={(event) => { event.preventDefault(); void confirmCheckIn(participantsEvent.id, entryCode); }}><input aria-label="Confirmation code" value={entryCode} onChange={(event) => setEntryCode(event.target.value)} placeholder="Confirmation code" required minLength={8} /><button className="button primary small" disabled={busy}>Record entry</button></form></div>{participants.length ? <div className="participant-list">{participants.map((registration) => <div className="participant-row" key={registration.id}><span className="avatar">{registration.student?.name.slice(0, 1).toUpperCase() || 'S'}</span><span><strong>{registration.student?.name || 'Student'}</strong><small>{registration.student?.studentId} · {registration.student?.email}{registration.attendance ? ` · Checked in ${dateTime(registration.attendance.checkedInAt)}` : ''}</small></span><span className={`status ${registration.status.toLowerCase()}`}>{registration.attendance ? 'CHECKED IN' : registration.status}</span></div>)}</div> : <Empty title="No participants yet" detail="Students who register will appear here." />}</section></div>}
    {feedbackView && <div className="overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setFeedbackView(null); }}><section className="dialog" role="dialog" aria-modal="true"><button className="icon-button close" aria-label="Close feedback" onClick={() => setFeedbackView(null)}>×</button><p className="eyebrow">EVENT FEEDBACK</p><h2>{feedbackView.event.title}</h2><p className="muted">{feedbackView.total} responses · Average {feedbackView.averageRating?.toFixed(1) ?? '—'} / 5</p>{feedbackView.feedback.length ? <div className="feedback-list">{feedbackView.feedback.map((item) => <article key={item.id}><strong>{item.student.name}</strong><span>{'★'.repeat(item.rating)}{'☆'.repeat(5 - item.rating)}</span><p>{item.comment || 'No written comment.'}</p></article>)}</div> : <Empty title="No feedback yet" detail="Feedback from attendees will appear here." />}</section></div>}
    {certificate && <div className="overlay certificate-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setCertificate(null); }}><section className="certificate-dialog" role="dialog" aria-modal="true"><div className="certificate-sheet"><p className="eyebrow">CAMPUS EVENT MANAGEMENT SYSTEM</p><div className="certificate-rule"/><h2>Certificate of Participation</h2><p>This certificate is presented to</p><h1>{certificate.recipientName}</h1><p>for attending</p><h2>{certificate.eventTitle}</h2><p className="certificate-date">{dateTime(certificate.eventStart)}{certificate.venue ? ` · ${certificate.venue}` : ''}</p><div className="certificate-sign"><span>{certificate.organizer || 'Campus Events'}<small>Event organizer</small></span><span>{dateTime(certificate.attendanceRecordedAt)}<small>Attendance verified</small></span></div><small className="certificate-code">Verified entry · {certificate.confirmationCode}</small></div><div className="certificate-actions"><button className="button outline" onClick={() => setCertificate(null)}>Close</button><button className="button primary" onClick={() => window.print()}>Print / Save PDF</button></div></section></div>}
    {tab === 'admin' && formOpen && <div className="overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) { setFormOpen(false); setEditing(null); } }}><section className="dialog event-dialog" role="dialog" aria-modal="true"><button className="icon-button close" aria-label="Close" onClick={() => { setFormOpen(false); setEditing(null); }}>×</button><p className="eyebrow">EVENT DETAILS</p><h2>{editing ? 'Edit event' : 'Create event'}</h2><EventForm draft={draft} setDraft={setDraft} onSubmit={saveEvent} busy={busy} onCancel={() => { setFormOpen(false); setEditing(null); }} /></section></div>}
  </div>;
}

function QrScanner({ onCode }: { onCode: (value: string) => void }) {
  const regionId = `entry-scanner-${useId().replaceAll(':', '')}`;
  const onCodeRef = useRef(onCode);
  const [active, setActive] = useState(false);
  const [scannerError, setScannerError] = useState('');

  useEffect(() => { onCodeRef.current = onCode; }, [onCode]);

  useEffect(() => {
    if (!active) return;
    let mounted = true;
    let running = false;
    let scanner: import('html5-qrcode').Html5Qrcode | null = null;
    void import('html5-qrcode').then(({ Html5Qrcode }) => {
      if (!mounted) return;
      scanner = new Html5Qrcode(regionId);
      return scanner.start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 220, height: 220 } }, (value) => {
        if (!mounted) return;
        mounted = false;
        onCodeRef.current(value);
        if (running && scanner) { running = false; void scanner.stop().then(() => scanner?.clear()).catch(() => undefined); }
        setActive(false);
      }, () => undefined);
    }).then(() => { running = true; }).catch((error: unknown) => {
      if (mounted) { setScannerError(errorText(error)); setActive(false); }
    });
    return () => {
      mounted = false;
      if (running && scanner) void scanner.stop().then(() => scanner?.clear()).catch(() => undefined);
    };
  }, [active, regionId]);

  return <div className="scanner-wrap"><button type="button" className="button outline small" onClick={() => { setScannerError(''); setActive(!active); }}>{active ? 'Stop camera' : 'Use camera'}</button>{scannerError && <span className="scanner-error">{scannerError}</span>}{active && <div id={regionId} className="qr-reader" />}</div>;
}

function EventCard({ event, isRegistered, isAdmin, onSelect }: { event: EventRecord; isRegistered: boolean; isAdmin: boolean; onSelect: () => void }) {
  const date = new Date(event.startTime);
  const count = event.registrations?.length;
  return <article className="event-card"><div className="event-card-top"><span className="category-label">{event.category || 'CAMPUS EVENT'}</span><span className={`status ${event.status.toLowerCase()}`}>{event.status.replaceAll('_', ' ')}</span></div><h2>{event.title}</h2><p className="event-description">{event.description}</p><div className="event-meta"><span><b>◷</b>{dateTime(event.startTime)}</span><span><b>⌖</b>{event.venue || 'Venue to be announced'}</span></div><div className="event-card-bottom"><span>{event.capacity ? `${count ?? 0} / ${event.capacity} places` : 'Open capacity'}{isRegistered && <em> · Registered</em>}</span><button className="button outline small" onClick={onSelect}>{isAdmin ? 'Manage' : 'Details'}</button></div><time className="date-block" dateTime={event.startTime}><b>{Number.isNaN(date.valueOf()) ? '--' : date.toLocaleDateString([], { day: '2-digit' })}</b><small>{Number.isNaN(date.valueOf()) ? 'TBA' : date.toLocaleDateString([], { month: 'short' }).toUpperCase()}</small></time></article>;
}

function AdminEvents({ events, onEdit, onAction, onParticipants, onFeedback, busy, onRefresh }: { events: EventRecord[]; onEdit: (event: EventRecord) => void; onAction: (event: EventRecord, action: string) => void; onParticipants: (event: EventRecord) => void; onFeedback: (event: EventRecord) => void; busy: boolean; onRefresh: () => void }) {
  const [statusFilter, setStatusFilter] = useState('ALL');
  const filtered = statusFilter === 'ALL' ? events : events.filter((event) => event.status === statusFilter);
  return <><div className="admin-toolbar"><div className="segmented">{['ALL', 'DRAFT', 'PUBLISHED', 'REGISTRATION_OPEN', 'REGISTRATION_CLOSED', 'CANCELLED'].map((status) => <button className={statusFilter === status ? 'selected' : ''} key={status} onClick={() => setStatusFilter(status)}>{status === 'REGISTRATION_OPEN' ? 'OPEN' : status === 'REGISTRATION_CLOSED' ? 'CLOSED' : status}</button>)}</div><button className="button outline small" onClick={onRefresh}>↻ Refresh</button></div>{filtered.length ? <div className="admin-list">{filtered.map((event) => { const count = event.registrations?.filter((registration) => registration.status !== 'CANCELLED').length || 0; return <article className="admin-row" key={event.id}><div className="admin-event-info"><span className={`status ${event.status.toLowerCase()}`}>{event.status.replaceAll('_', ' ')}</span><h3>{event.title}</h3><p>{dateTime(event.startTime)} <span>·</span> {event.venue || 'Venue not set'} <span>·</span> {count} registrations</p></div><div className="admin-actions"><button className="button outline small" onClick={() => onEdit(event)}>Edit</button><button className="button outline small" disabled={busy} onClick={() => onParticipants(event)}>Participants</button><button className="button outline small" disabled={busy} onClick={() => void onFeedback(event)}>Feedback</button>{event.status === 'DRAFT' && <button className="button primary small" disabled={busy} onClick={() => onAction(event, 'publish')}>Publish</button>}{['PUBLISHED', 'REGISTRATION_CLOSED'].includes(event.status) && <button className="button primary small" disabled={busy} onClick={() => onAction(event, 'open-registration')}>Open registration</button>}{event.status === 'REGISTRATION_OPEN' && <button className="button outline small" disabled={busy} onClick={() => onAction(event, 'close-registration')}>Close registration</button>}{event.status !== 'CANCELLED' && <button className="button danger small" disabled={busy} onClick={() => onAction(event, 'cancel')}>Cancel event</button>}</div></article>; })}</div> : <Empty title="No events in this view" detail="Create an event to start building your campus calendar." />}</>;
}

function EventForm({ draft, setDraft, onSubmit, busy, onCancel }: { draft: EventDraft; setDraft: (draft: EventDraft) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; busy: boolean; onCancel: () => void }) {
  const field = (key: keyof EventDraft, value: string) => setDraft({ ...draft, [key]: value });
  return <form className="event-form" onSubmit={onSubmit}><label>Event name<input required minLength={3} value={draft.title} onChange={(event) => field('title', event.target.value)} /></label><label>Description<textarea required minLength={10} rows={3} value={draft.description} onChange={(event) => field('description', event.target.value)} /></label><div className="form-row"><label>Category<input value={draft.category} onChange={(event) => field('category', event.target.value)} /></label><label>Venue<input value={draft.venue} onChange={(event) => field('venue', event.target.value)} /></label></div><div className="form-row"><label>Starts<input type="datetime-local" required value={draft.startTime} onChange={(event) => field('startTime', event.target.value)} /></label><label>Ends<input type="datetime-local" required value={draft.endTime} onChange={(event) => field('endTime', event.target.value)} /></label></div><div className="form-row"><label>Registration deadline<input type="datetime-local" required value={draft.registrationDeadline} onChange={(event) => field('registrationDeadline', event.target.value)} /></label><label>Capacity<input type="number" min="1" step="1" value={draft.capacity} onChange={(event) => field('capacity', event.target.value)} /></label></div><div className="dialog-actions"><button type="button" className="button outline" onClick={onCancel}>Cancel</button><button className="button primary" disabled={busy}>{busy ? 'Saving…' : 'Save event'}</button></div></form>;
}

function Empty({ title, detail, action }: { title: string; detail: string; action?: React.ReactNode }) {
  return <div className="empty-state"><span className="empty-icon">○</span><h2>{title}</h2><p>{detail}</p>{action}</div>;
}

export default App;
