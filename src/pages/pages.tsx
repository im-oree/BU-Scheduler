import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  Bell,
  CalendarDays,
  CalendarRange,
  ChevronRight,
  Clock3,
  Copy,
  Download,
  Filter,
  Grid2x2,
  Info,
  Link2,
  Lock,
  MessageCircle,
  Plus,
  Search,
  Share2,
  Sparkles,
  Trash2,
  Upload,
  UserPlus,
  Users,
  XCircle,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Modal,
  Select,
  SkeletonBlock,
  Tabs,
  Textarea,
} from '../components/ui';
import {
  authorizeStudentHubPopup,
  buildStudentHubAuthUrl,
  clearStudentHubAuthRequest,
  getStudentHubAuthRequest,
  normalizeReturnTo,
  prepareStudentHubAuthRequest,
} from '../lib/auth';
import { fetchGroups, fetchHealth, type GroupSummary } from '../lib/api';
import { formatDateLabel, formatDateTime, formatRelativeLabel } from '../lib/format';
import {
  announcementsByGroup,
  chatByGroup,
  groups,
  getAnnouncements,
  getChatMessages,
  getGroup,
  getMembers,
  invitePreview,
  membersByGroup,
  notifications,
  productFeatures,
  profileSummary,
  quickActions,
  scheduleEvents,
  stats,
} from '../data/mockData';
import { useAppStore } from '../store/useAppStore';
import { useAuthStore } from '../store/useAuthStore';

function PageFrame({
  eyebrow,
  title,
  description,
  action,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="page">
      <div className="page__header">
        <div>
          {eyebrow ? <p className="eyebrow eyebrow--subtle">{eyebrow}</p> : null}
          <h1 className="page__title">{title}</h1>
          {description ? <p className="page__description">{description}</p> : null}
        </div>
        {action ? <div className="page__action">{action}</div> : null}
      </div>
      {children}
    </div>
  );
}

function StatGrid({ items }: { items: Array<{ label: string; value: string }> }) {
  return (
    <div className="stat-grid">
      {items.map((item) => (
        <Card key={item.label} className="stat-card">
          <span className="stat-card__label">{item.label}</span>
          <strong className="stat-card__value">{item.value}</strong>
        </Card>
      ))}
    </div>
  );
}

function AvatarStack({ count = 3 }: { count?: number }) {
  return (
    <div className="avatar-stack" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="avatar avatar--tiny">
          {String.fromCharCode(65 + index)}
        </div>
      ))}
    </div>
  );
}

function GroupCardView({ group }: { group: (typeof groups)[number] }) {
  return (
    <Card className="group-card">
      <div className="group-card__top">
        <div>
          <Badge tone={group.accent === 'green' ? 'success' : group.accent === 'amber' ? 'warning' : 'info'}>
            {group.courseCode}
          </Badge>
          <h3>{group.title}</h3>
          <p>{group.description}</p>
        </div>
        <AvatarStack />
      </div>
      <div className="group-card__meta">
        <span>{group.memberCount} members</span>
        <span>{group.nextClass}</span>
      </div>
      <div className="group-card__footer">
        <span className="muted">Updated {group.lastActivity}</span>
        <Link to={`/groups/${group.id}`} className="inline-link">
          Open group <ChevronRight size={16} />
        </Link>
      </div>
    </Card>
  );
}

function ToneBadge({ tone }: { tone: 'success' | 'warning' | 'danger' | 'info' }) {
  const label = tone === 'success' ? 'Green' : tone === 'warning' ? 'Amber' : tone === 'danger' ? 'Red' : 'Blue';
  return <Badge tone={tone}>{label}</Badge>;
}

export function SplashPage() {
  return <Navigate to="/login" replace />;
}

export function LoginPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const authStatus = useAuthStore((state) => state.status);
  const authSession = useAuthStore((state) => state.session);
  const authError = useAuthStore((state) => state.error);
  const signIn = useAuthStore((state) => state.signIn);
  const [email, setEmail] = useState('student@university.edu');
  const [password, setPassword] = useState('password123');
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const returnTo = normalizeReturnTo(searchParams.get('returnTo') ?? authSession?.returnTo ?? '/home');

  useEffect(() => {
    if (authStatus === 'authenticated') {
      navigate(returnTo, { replace: true });
    }
  }, [authStatus, navigate, returnTo]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocalError(null);
    setSubmitting(true);

    try {
      await signIn(email.trim(), password);
      navigate(returnTo, { replace: true });
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : 'Unable to sign in');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStudentHubSignup() {
    setLocalError(null);

    try {
      const request = await prepareStudentHubAuthRequest({
        flow: 'signup',
        email: email.trim() || 'student@university.edu',
        displayName: email.includes('@') ? email.split('@')[0] : 'Student Hub User',
        returnTo,
      });
      const popupUrl = buildStudentHubAuthUrl(request);
      const popup = window.open(popupUrl, 'studenthub-signup', 'width=560,height=760');

      if (!popup) {
        navigate(popupUrl, { replace: false });
      }
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : 'Unable to start StudentHub sign-up');
    }
  }

  if (authStatus === 'loading') {
    return (
      <div className="loading-screen" aria-live="polite" aria-busy="true">
        <div className="spinner" />
        <p>Checking your session…</p>
      </div>
    );
  }

  return (
    <div className="auth-layout auth-layout--centered auth-layout--login">
      <Card className="auth-card auth-card--login">
        <div className="auth-card__brand">
          <div className="brand-link__mark brand-link__mark--small">B</div>
          <div>
            <p className="eyebrow eyebrow--subtle">BU Scheduler</p>
            <h1>Sign in</h1>
          </div>
        </div>
        <p className="muted">Sign in to manage your timetable and groups.</p>
        <form className="auth-form" onSubmit={handleSubmit}>
          <Input label="Email or username" type="text" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} />
          <Input label="Password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
          <div className="stack stack--small">
            <Button variant="primary" size="lg" className="button--full-width" type="submit" disabled={submitting} leadingIcon={<ArrowRight size={18} />}>
              {submitting ? 'Signing in…' : 'Sign in'}
            </Button>
            <Button variant="secondary" size="lg" className="button--full-width" type="button" onClick={handleStudentHubSignup} leadingIcon={<Sparkles size={18} />}>
              Create account with StudentHub
            </Button>
          </div>
        </form>
        <div className="auth-card__list">
          <div>
            <strong>Your StudentHub identity powers BU Scheduler</strong>
            <span>Use the same account across devices without creating a separate profile.</span>
          </div>
          <div>
            <strong>Protected session</strong>
            <span>No access tokens are placed in the URL.</span>
          </div>
        </div>
        {(localError || authError) ? <p className="form-error">{localError ?? authError}</p> : null}
      </Card>
    </div>
  );
}

export function AuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const completeStudentHubCallback = useAuthStore((state) => state.completeStudentHubCallback);
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Completing sign-in...');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');

    if (!code || !state) {
      setStatus('error');
      setError('Invalid callback request. Please retry sign-in.');
      return;
    }

    const callbackCode = code;
    const callbackState = state;

    let cancelled = false;

    async function finishCallback() {
      try {
        const session = await completeStudentHubCallback(callbackCode, callbackState);
        const destination = normalizeReturnTo(session.returnTo ?? '/home');

        if (cancelled) {
          return;
        }

        setStatus('success');
        setMessage('Sign-in complete. You can return to BU Scheduler now.');

        if (window.opener && !window.opener.closed) {
          try {
            window.opener.location.replace(destination);
            window.opener.postMessage({ type: 'bu-scheduler:auth-complete', destination }, window.location.origin);
          } catch {
            window.opener.postMessage({ type: 'bu-scheduler:auth-complete', destination }, window.location.origin);
          }

          window.setTimeout(() => {
            window.close();
          }, 400);
          return;
        }

        window.location.replace(destination);
      } catch (callbackError) {
        if (cancelled) {
          return;
        }

        setStatus('error');
        setError(callbackError instanceof Error ? callbackError.message : 'Unable to complete sign-in');
        clearStudentHubAuthRequest(callbackState);
      }
    }

    finishCallback();

    return () => {
      cancelled = true;
    };
  }, [completeStudentHubCallback, navigate, searchParams]);

  return (
    <div className="loading-screen loading-screen--auth" aria-live="polite" aria-busy={status === 'loading'}>
      <div className="spinner" />
      <p>{status === 'error' ? error : message}</p>
      {status === 'error' ? (
        <Button variant="secondary" size="md" onClick={() => navigate('/login')}>
          Back to login
        </Button>
      ) : null}
    </div>
  );
}

export function StudentHubAuthPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const state = searchParams.get('state');
  const flow = searchParams.get('flow') === 'login' ? 'login' : 'signup';
  const returnTo = normalizeReturnTo(searchParams.get('returnTo'));
  const pendingRequest = state ? getStudentHubAuthRequest(state) : null;
  const [email, setEmail] = useState(pendingRequest?.email ?? 'student@university.edu');
  const [password, setPassword] = useState('password123');
  const [displayName, setDisplayName] = useState(pendingRequest?.displayName ?? 'Student Hub User');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (pendingRequest) {
      setEmail(pendingRequest.email);
      setDisplayName(pendingRequest.displayName);
    }
  }, [pendingRequest]);

  async function handleContinue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    if (!state || !pendingRequest) {
      setError('This StudentHub sign-in session expired. Return to BU Scheduler and try again.');
      setLoading(false);
      return;
    }

    try {
      const authorizeResponse = await authorizeStudentHubPopup({
        ...pendingRequest,
        email: email.trim(),
        displayName: displayName.trim() || email.trim().split('@')[0] || 'Student Hub User',
      });

      window.location.assign(`/auth/callback?code=${encodeURIComponent(authorizeResponse.code)}&state=${encodeURIComponent(authorizeResponse.state)}`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to continue with StudentHub');
      setLoading(false);
    }
  }

  if (!state) {
    return (
      <div className="auth-layout auth-layout--centered">
        <Card className="auth-card auth-card--login">
          <p className="eyebrow eyebrow--subtle">StudentHub</p>
          <h1>Invalid sign-in session</h1>
          <p className="muted">Return to BU Scheduler and open StudentHub sign-up again.</p>
          <Button variant="primary" onClick={() => navigate('/login')}>
            Back to login
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="auth-layout auth-layout--centered auth-layout--popup">
      <Card className="auth-card auth-card--login auth-card--popup">
        <p className="eyebrow eyebrow--subtle">StudentHub official auth</p>
        <h1>{flow === 'signup' ? 'Create your StudentHub account' : 'Sign in to StudentHub'}</h1>
        <p className="muted">Complete this step, then you will be returned to BU Scheduler already authenticated.</p>
        <form className="auth-form" onSubmit={handleContinue}>
          <Input label="StudentHub email or username" type="text" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} />
          <Input label="Password" type="password" autoComplete={flow === 'signup' ? 'new-password' : 'current-password'} value={password} onChange={(event) => setPassword(event.target.value)} />
          <Input label="Display name" type="text" autoComplete="name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
          <Button variant="primary" size="lg" className="button--full-width" type="submit" disabled={loading} leadingIcon={<ArrowRight size={18} />}>
            {loading ? 'Continuing…' : 'Continue to BU Scheduler'}
          </Button>
        </form>
        <p className="form-note">Return to BU Scheduler after StudentHub verifies your identity.</p>
        {error ? <p className="form-error">{error}</p> : null}
      </Card>
      <div className="auth-popup__footer">
        <span>Callback will return to</span>
        <strong>{returnTo}</strong>
      </div>
    </div>
  );
  return (
    <div className="auth-layout auth-layout--centered">
      <Card className="auth-card auth-card--login">
        <p className="eyebrow eyebrow--subtle">Authentication</p>
        <h1>Sign in to BU Scheduler</h1>
        <p className="muted">The demo shell routes into StudentHub-style sign in and then lands on the app routes.</p>
        <Button variant="primary" size="lg" className="button--full-width" leadingIcon={<ArrowRight size={18} />}>
          Sign in with StudentHub
        </Button>
        <div className="auth-card__list">
          <div>
            <strong>Single sign-on</strong>
            <span>Keep StudentHub as the canonical identity source.</span>
          </div>
          <div>
            <strong>Fast redirect</strong>
            <span>Return to /home or /groups after successful login.</span>
          </div>
        </div>
      </Card>
    </div>
  );
}

export function HomePage() {
  const healthQuery = useQuery({ queryKey: ['health'], queryFn: ({ signal }) => fetchHealth(signal), staleTime: 30_000 });
  const groupsQuery = useQuery({ queryKey: ['groups'], queryFn: ({ signal }) => fetchGroups(signal), staleTime: 30_000 });

  const activeGroups = groupsQuery.data && groupsQuery.data.length > 0 ? groupsQuery.data : groups;

  return (
    <PageFrame
      eyebrow="Dashboard"
      title="Your next class and active groups"
      description="A compact overview that surfaces the next action, the latest activity, and the quick entry points you need most."
      action={<Button variant="secondary" leadingIcon={<CalendarDays size={18} />}>Open timetable</Button>}
    >
      <div className="dashboard-grid">
        <Card className="hero-card">
          <div>
            <p className="eyebrow eyebrow--subtle">Your next class</p>
            <h2>Problem Solving Tutorial</h2>
            <p className="muted">Today 10:00 AM - 11:00 AM · Room 2 · CS 100 Level - Group B</p>
          </div>
          <div className="hero-card__actions">
            <Button variant="primary" leadingIcon={<Bell size={18} />}>Set reminder</Button>
            <Button variant="ghost" leadingIcon={<Link2 size={18} />}>Join link</Button>
          </div>
          <div className="hero-card__status">
            <Badge tone="success">On track</Badge>
            <span>{healthQuery.data?.service ?? 'API'} {healthQuery.data?.ok ? 'online' : 'offline'}</span>
          </div>
        </Card>

        <div className="stack stack--compact">
          <StatGrid items={stats} />
        </div>
      </div>

      <section className="section-block">
        <div className="section-block__head">
          <div>
            <p className="eyebrow eyebrow--subtle">Recent groups</p>
            <h2>Groups you can jump into quickly</h2>
          </div>
          <Button variant="ghost" size="sm">View all</Button>
        </div>
        <div className="group-grid">
          {activeGroups.slice(0, 3).map((group) => (
            <Card key={group.id} className="group-card group-card--compact">
              <div className="group-card__top">
                <div>
                  <Badge tone="info">{group.courseCode}</Badge>
                  <h3>{group.title}</h3>
                  <p>{group.memberCount} members</p>
                </div>
                <div className="group-card__icon">
                  <Grid2x2 size={20} />
                </div>
              </div>
              <div className="group-card__footer">
                <span className="muted">{group.nextClass}</span>
                <Link to={`/groups/${group.id}`} className="inline-link">
                  Open <ChevronRight size={16} />
                </Link>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section className="section-block section-block--split">
        <Card>
          <div className="section-block__head">
            <div>
              <p className="eyebrow eyebrow--subtle">Quick actions</p>
              <h2>Most common tasks</h2>
            </div>
          </div>
          <div className="quick-action-list">
            {quickActions.map((action) => (
              <Link key={action.title} to={action.href} className="quick-action-list__item">
                <div>
                  <strong>{action.title}</strong>
                  <p>{action.description}</p>
                </div>
                <ChevronRight size={18} />
              </Link>
            ))}
          </div>
        </Card>

        <Card>
          <div className="section-block__head">
            <div>
              <p className="eyebrow eyebrow--subtle">Announcements</p>
              <h2>Recent course-rep updates</h2>
            </div>
          </div>
          <div className="announcement-list">
            {announcementsByGroup.grp_100.map((item) => (
              <article key={item.id} className="announcement-list__item">
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.body}</p>
                </div>
                <span className="muted">{item.date}</span>
              </article>
            ))}
          </div>
        </Card>
      </section>
    </PageFrame>
  );
}

export function GroupsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [joinModalOpen, setJoinModalOpen] = useState(searchParams.get('mode') === 'join');
  const [filter, setFilter] = useState<'joined' | 'all' | 'created'>('joined');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredGroups = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return groups.filter((group) => {
      if (!query) {
        return true;
      }

      return group.title.toLowerCase().includes(query) || group.courseCode.toLowerCase().includes(query);
    });
  }, [searchTerm]);

  return (
    <PageFrame
      eyebrow="Groups"
      title="Your groups and course cohorts"
      description="Search by course code or group name, then jump straight to group detail, members, or schedule."
      action={
        <div className="toolbar-actions">
          <Button variant="secondary" leadingIcon={<UserPlus size={18} />} onClick={() => setJoinModalOpen(true)}>
            Join group
          </Button>
          <Button variant="primary" leadingIcon={<Plus size={18} />}>
            Create group
          </Button>
        </div>
      }
    >
      <Card>
        <div className="search-bar">
          <Input label="Search" placeholder="Search by course code or group name" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} />
          <Select label="Filter" value={filter} onChange={(event) => setFilter(event.target.value as 'joined' | 'all' | 'created')}>
            <option value="joined">Joined</option>
            <option value="all">All</option>
            <option value="created">My created groups</option>
          </Select>
        </div>
        <Tabs
          tabs={[
            { id: 'joined', label: 'Joined' },
            { id: 'all', label: 'All' },
            { id: 'created', label: 'My created groups' },
          ]}
          activeId={filter}
          onChange={(value) => setFilter(value as typeof filter)}
        />
      </Card>

      <div className="group-grid group-grid--dense">
        {filteredGroups.map((group) => (
          <GroupCardView key={group.id} group={group} />
        ))}
      </div>

      <Modal
        open={joinModalOpen}
        title="Join a group"
        description="Enter an invite code or paste a link to join a group quickly."
        onClose={() => {
          setJoinModalOpen(false);
          setSearchParams({});
        }}
        footer={
          <div className="modal-actions">
            <Button variant="ghost" onClick={() => setJoinModalOpen(false)}>Cancel</Button>
            <Button variant="primary">Join group</Button>
          </div>
        }
      >
        <Input label="Invite code or link" placeholder="CS100-B" />
      </Modal>
    </PageFrame>
  );
}

export function GroupDetailPage() {
  const { groupId } = useParams();
  const group = getGroup(groupId);
  const members = getMembers(group.id);
  const announcements = getAnnouncements(group.id);
  const [tab, setTab] = useState('schedule');

  return (
    <PageFrame
      eyebrow="Group detail"
      title={group.title}
      description={`${group.courseCode} · Level ${group.level} · ${group.memberCount} members`}
      action={<Button variant="primary" leadingIcon={<Plus size={18} />}>Add class</Button>}
    >
      <Card className="group-overview">
        <div className="group-overview__summary">
          <div>
            <Badge tone="success">Open group</Badge>
            <p className="muted">Members, timetable, announcements, chat, and settings in one place.</p>
          </div>
          <div className="group-overview__actions">
            <Button variant="secondary">Join</Button>
            <Button variant="ghost">Settings</Button>
          </div>
        </div>
      </Card>

      <Tabs
        tabs={[
          { id: 'schedule', label: 'Schedule' },
          { id: 'members', label: 'Members', badge: String(members.length) },
          { id: 'chat', label: 'Chat' },
          { id: 'announcements', label: 'Announcements', badge: String(announcements.length) },
          { id: 'tools', label: 'Tools' },
        ]}
        activeId={tab}
        onChange={setTab}
      />

      {tab === 'schedule' ? (
        <div className="timeline-list">
          {scheduleEvents.map((event) => (
            <Card key={event.id} className="timeline-card">
              <div className="timeline-card__left">
                <Badge tone={event.accent === 'green' ? 'success' : event.accent === 'amber' ? 'warning' : 'info'}>
                  {event.subjectCode}
                </Badge>
                <h3>{event.title}</h3>
                <p>{event.groupName}</p>
              </div>
              <div className="timeline-card__right">
                <span>{formatDateTime(event.startAt)}</span>
                <span>{event.location}</span>
                <span>{event.organizer}</span>
              </div>
            </Card>
          ))}
        </div>
      ) : null}

      {tab === 'members' ? (
        <Card>
          <div className="table-header">
            <h2>Members</h2>
            <Button variant="secondary" size="sm" leadingIcon={<UserPlus size={16} />}>Invite member</Button>
          </div>
          <div className="member-table">
            {members.map((member) => (
              <div key={member.id} className="member-row">
                <div className="member-row__identity">
                  <div className="avatar avatar--small">{member.name.slice(0, 2).toUpperCase()}</div>
                  <div>
                    <strong>{member.name}</strong>
                    <span>{member.joinedAt}</span>
                  </div>
                </div>
                <Badge tone={member.role === 'Course Rep' ? 'warning' : member.role === 'Group Rep' ? 'success' : 'neutral'}>{member.role}</Badge>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {tab === 'chat' ? (
        <Card className="chat-panel">
          <div className="chat-panel__history">
            {getChatMessages(group.id).map((message) => (
              <article key={message.id} className="chat-message">
                <div className="chat-message__meta">
                  <strong>{message.author}</strong>
                  <span>{message.role}</span>
                  <span>{message.time}</span>
                </div>
                <p>{message.text}</p>
              </article>
            ))}
          </div>
          <div className="chat-panel__composer">
            <Input label="Message" placeholder="Type a message..." />
            <Button variant="primary">Send</Button>
          </div>
        </Card>
      ) : null}

      {tab === 'announcements' ? (
        <div className="announcement-list">
          {announcements.map((announcement) => (
            <Card key={announcement.id}>
              <strong>{announcement.title}</strong>
              <p className="muted">{announcement.body}</p>
              <span className="muted">{announcement.author} · {announcement.date}</span>
            </Card>
          ))}
        </div>
      ) : null}

      {tab === 'tools' ? (
        <Card>
          <div className="tool-list">
            <div className="tool-list__item">
              <strong>Bulk import</strong>
              <span>Upload CSV or ICS files and confirm parsed rows before import.</span>
            </div>
            <div className="tool-list__item">
              <strong>Visibility</strong>
              <span>Toggle between private and public without leaving the page.</span>
            </div>
            <div className="tool-list__item">
              <strong>Danger zone</strong>
              <span>Delete all timetable entries or demote the current rep.</span>
            </div>
          </div>
        </Card>
      ) : null}
    </PageFrame>
  );
}

export function TimetablePage() {
  const scheduleView = useAppStore((state) => state.scheduleView);
  const setScheduleView = useAppStore((state) => state.setScheduleView);

  return (
    <PageFrame
      eyebrow="Timetable"
      title="Merged schedule"
      description="Switch between week, day, list, and calendar views for the current academic week."
      action={<Button variant="primary" leadingIcon={<CalendarRange size={18} />}>Today</Button>}
    >
      <Tabs
        tabs={[
          { id: 'week', label: 'Week' },
          { id: 'day', label: 'Day' },
          { id: 'list', label: 'List' },
          { id: 'calendar', label: 'Calendar' },
        ]}
        activeId={scheduleView}
        onChange={(value) => setScheduleView(value as typeof scheduleView)}
      />
      <div className="schedule-board">
        {scheduleView === 'list' ? (
          <div className="timeline-list">
            {scheduleEvents.map((event) => (
              <Card key={event.id} className="timeline-card">
                <div className="timeline-card__left">
                  <Badge tone={event.accent === 'green' ? 'success' : event.accent === 'amber' ? 'warning' : 'info'}>
                    {event.subjectCode}
                  </Badge>
                  <h3>{event.title}</h3>
                  <p>{event.groupName}</p>
                </div>
                <div className="timeline-card__right">
                  <span>{formatDateTime(event.startAt)}</span>
                  <span>{event.location}</span>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="calendar-grid">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
              <Card key={day} className="calendar-grid__day">
                <strong>{day}</strong>
                <span>8 AM - 6 PM</span>
                <Badge tone="info">2 events</Badge>
              </Card>
            ))}
          </div>
        )}
      </div>
    </PageFrame>
  );
}

export function EventEditorPage() {
  const { groupId, eventId } = useParams();
  const group = getGroup(groupId);

  return (
    <PageFrame
      eyebrow="Event editor"
      title={eventId ? 'Edit event' : `Add class for ${group.title}`}
      description="Use validated fields for start and end time, recurrence, visibility, and attachments."
      action={<Button variant="primary" leadingIcon={<Plus size={18} />}>Save</Button>}
    >
      <Card>
        <div className="form-grid">
          <Input label="Title" required placeholder="Problem Solving Tutorial" />
          <Input label="Subject code" placeholder="COS102" />
          <Textarea label="Description" rows={4} placeholder="Optional notes for the session" />
          <Input label="Start date & time" type="datetime-local" required />
          <Input label="End date & time" type="datetime-local" required />
          <Select label="Timezone" defaultValue="Africa/Lagos">
            <option value="Africa/Lagos">Africa/Lagos</option>
            <option value="UTC">UTC</option>
          </Select>
          <Input label="Location" placeholder="Room 2 or virtual link" />
          <Select label="Recurrence" defaultValue="weekly">
            <option value="none">No repeat</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="custom">Custom</option>
          </Select>
          <Select label="Visibility" defaultValue="group">
            <option value="group">Private (group only)</option>
            <option value="public">Public</option>
          </Select>
        </div>
        <div className="form-actions">
          <Button variant="danger">Delete</Button>
          <div className="form-actions__right">
            <Button variant="ghost">Cancel</Button>
            <Button variant="primary">Save event</Button>
          </div>
        </div>
      </Card>
    </PageFrame>
  );
}

export function BulkImportPage() {
  return (
    <PageFrame
      eyebrow="Bulk import"
      title="Upload, preview, and confirm"
      description="CSV and ICS imports are split into a validation step and a confirmation step so errors are visible before the job starts."
      action={<Button variant="primary" leadingIcon={<Upload size={18} />}>Upload file</Button>}
    >
      <div className="section-block section-block--split">
        <Card className="drop-zone">
          <Upload size={28} />
          <h2>Drop CSV or ICS file here</h2>
          <p className="muted">title, subject_code, start, end, timezone, recurrence, location</p>
          <Button variant="secondary">Browse files</Button>
        </Card>

        <Card>
          <div className="section-block__head">
            <div>
              <p className="eyebrow eyebrow--subtle">Preview</p>
              <h2>Parsed rows</h2>
            </div>
          </div>
          <div className="preview-table">
            {scheduleEvents.map((event) => (
              <div key={event.id} className="preview-table__row">
                <strong>{event.title}</strong>
                <span>{formatDateLabel(event.startAt)}</span>
                <span>{event.location}</span>
              </div>
            ))}
          </div>
          <div className="form-actions">
            <Button variant="ghost" leadingIcon={<Download size={18} />}>Download errors</Button>
            <div className="form-actions__right">
              <Button variant="ghost">Back</Button>
              <Button variant="primary">Confirm import</Button>
            </div>
          </div>
        </Card>
      </div>
    </PageFrame>
  );
}

export function MembersPage() {
  const { groupId } = useParams();
  const group = getGroup(groupId);
  const members = getMembers(group.id);

  return (
    <PageFrame
      eyebrow="Members"
      title={`${group.title} members`}
      description="Use the table view for role management, invites, and member search."
      action={<Button variant="secondary" leadingIcon={<UserPlus size={18} />}>Invite member</Button>}
    >
      <Card>
        <div className="table-header">
          <Input label="Search members" placeholder="Search by name or role" />
          <Select label="Role" defaultValue="all">
            <option value="all">All roles</option>
            <option value="member">Member</option>
            <option value="rep">Group Rep</option>
            <option value="course-rep">Course Rep</option>
          </Select>
        </div>
        <div className="member-table member-table--dense">
          {members.map((member) => (
            <div key={member.id} className="member-row">
              <div className="member-row__identity">
                <div className="avatar avatar--small">{member.name.slice(0, 2).toUpperCase()}</div>
                <div>
                  <strong>{member.name}</strong>
                  <span>Joined {member.joinedAt}</span>
                </div>
              </div>
              <Badge tone={member.role === 'Course Rep' ? 'warning' : member.role === 'Group Rep' ? 'success' : 'neutral'}>{member.role}</Badge>
              <Button variant="ghost" size="sm">Message</Button>
            </div>
          ))}
        </div>
      </Card>
    </PageFrame>
  );
}

export function InvitePage() {
  return (
    <div className="auth-layout auth-layout--centered">
      <Card className="auth-card auth-card--login">
        <p className="eyebrow eyebrow--subtle">Invite flow</p>
        <h1>{invitePreview.title}</h1>
        <p className="muted">{invitePreview.subtitle}</p>
        <div className="invite-card__details">
          <Lock size={18} />
          <span>{invitePreview.note}</span>
        </div>
        <div className="stack stack--large">
          <Button variant="primary" size="lg" leadingIcon={<ArrowRight size={18} />}>Sign in to accept</Button>
          <Button variant="secondary" size="lg" leadingIcon={<Copy size={18} />}>Copy invite code</Button>
        </div>
      </Card>
    </div>
  );
}

export function ChatPage() {
  const { groupId } = useParams();
  const group = getGroup(groupId);
  const messages = getChatMessages(group.id);

  return (
    <PageFrame
      eyebrow="Messages"
      title={`${group.title} chat`}
      description="Member names, timestamps, and message history in a mobile-friendly conversation view."
      action={<Button variant="primary" leadingIcon={<MessageCircle size={18} />}>New message</Button>}
    >
      <Card className="chat-panel chat-panel--full">
        <div className="chat-panel__history">
          {messages.map((message) => (
            <article key={message.id} className="chat-message">
              <div className="chat-message__meta">
                <strong>{message.author}</strong>
                <span>{message.role}</span>
                <span>{message.time}</span>
              </div>
              <p>{message.text}</p>
            </article>
          ))}
        </div>
        <div className="chat-panel__composer">
          <Input label="Message" placeholder="Type a message..." />
          <Button variant="primary">Send</Button>
        </div>
      </Card>
    </PageFrame>
  );
}

export function ProfilePage() {
  const [tab, setTab] = useState('profile');

  return (
    <PageFrame
      eyebrow="Profile"
      title="Account settings"
      description="Edit profile details, notification preferences, and account actions from one place."
      action={<Button variant="danger">Sign out</Button>}
    >
      <Tabs
        tabs={[
          { id: 'profile', label: 'Profile' },
          { id: 'notifications', label: 'Notifications' },
          { id: 'account', label: 'Account' },
          { id: 'help', label: 'Help' },
        ]}
        activeId={tab}
        onChange={setTab}
      />
      <Card>
        {tab === 'profile' ? (
          <div className="form-grid">
            <Input label="Name" defaultValue={profileSummary.name} />
            <Input label="Email" defaultValue={profileSummary.email} readOnly />
            <Input label="Phone" defaultValue={profileSummary.phone} />
            <Select label="Timezone" defaultValue={profileSummary.timezone}>
              <option value="Africa/Lagos">Africa/Lagos</option>
              <option value="UTC">UTC</option>
            </Select>
            <Textarea label="Bio" defaultValue={profileSummary.bio} rows={4} />
          </div>
        ) : null}
        {tab === 'notifications' ? (
          <div className="tool-list">
            <div className="tool-list__item">
              <strong>Enable reminders</strong>
              <span>Choose default reminder timing and delivery channel.</span>
            </div>
            <div className="tool-list__item">
              <strong>Do not disturb</strong>
              <span>Mute alerts between 11 PM and 8 AM.</span>
            </div>
          </div>
        ) : null}
        {tab === 'account' ? (
          <div className="tool-list">
            <div className="tool-list__item">
              <strong>Linked StudentHub account</strong>
              <span>{profileSummary.email}</span>
            </div>
            <div className="tool-list__item">
              <strong>Delete account</strong>
              <span>Destructive action with confirmation.</span>
            </div>
          </div>
        ) : null}
        {tab === 'help' ? (
          <div className="tool-list">
            <div className="tool-list__item">
              <strong>FAQ</strong>
              <span>Read the support docs and app overview.</span>
            </div>
            <div className="tool-list__item">
              <strong>Contact support</strong>
              <span>Send a message for account or scheduling help.</span>
            </div>
          </div>
        ) : null}
      </Card>
    </PageFrame>
  );
}

export function NotificationsPage() {
  return (
    <PageFrame
      eyebrow="Activity"
      title="Notifications and updates"
      description="Recent state changes, reminders, and group activity in a dismissible feed."
      action={<Button variant="secondary" leadingIcon={<Bell size={18} />}>Mark all read</Button>}
    >
      <div className="notification-list">
        {notifications.map((notification) => (
          <Card key={notification.id} className="notification-list__item">
            <div className="notification-list__icon">
              {notification.tone === 'success' ? <CheckMark /> : notification.tone === 'warning' ? <AlertMark /> : notification.tone === 'danger' ? <XCircle size={20} /> : <Info size={20} />}
            </div>
            <div>
              <strong>{notification.title}</strong>
              <p>{notification.detail}</p>
              <span className="muted">{notification.time}</span>
            </div>
          </Card>
        ))}
      </div>
    </PageFrame>
  );
}

function CheckMark() {
  return <span className="status-mark status-mark--success">✓</span>;
}

function AlertMark() {
  return <span className="status-mark status-mark--warning">!</span>;
}

export function NotFoundPage() {
  return (
    <div className="auth-layout auth-layout--centered">
      <Card className="auth-card auth-card--login">
        <p className="eyebrow eyebrow--subtle">404</p>
        <h1>Group not found</h1>
        <p className="muted">This group may have been deleted or you may not have access.</p>
        <div className="stack stack--large">
          <Button variant="primary" size="lg">Go home</Button>
          <Button variant="ghost" size="lg">Browse groups</Button>
        </div>
      </Card>
    </div>
  );
}
