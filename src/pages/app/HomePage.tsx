import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Bell,
  CalendarDays,
  ChevronRight,
  Clock,
  Users,
  Inbox,
  ArrowRight,
  AlertCircle,
  RefreshCw,
  Loader2,
  Sparkles,
  BellRing,
  UserCircle,
  BookOpen,
  Zap,
} from 'lucide-react';
import { Badge, Button, Card } from '../../components/ui';
import { PageFrame, StatGrid } from '../../components/shared';
import { useAuthStore } from '../../store/useAuthStore';
import {
  fetchNotifications,
  fetchUserGroups,
  fetchUserTimetableEntries,
  fetchCurrentUserProfile,
} from '../../lib/studenthubData';
import { useCallback, useMemo } from 'react';
import type { CSSProperties, ReactNode } from 'react';

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

interface TimetableEntry {
  id?: string;
  courseName?: string;
  courseCode?: string;
  groupName?: string;
  startTime?: string;
  endTime?: string;
  day?: string;
  venue?: string;
}

interface GroupEntry {
  id: string;
  title: string;
  courseCode: string;
  memberCount: number;
  nextClass?: string;
}

interface NotificationEntry {
  id: string;
  title: string;
  detail: string;
  time: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// Formatters
// ═══════════════════════════════════════════════════════════════════════════

function formatTimeOnly(time?: string): string {
  if (!time) return '—';
  const match = time.match(/^(\d{1,2}):(\d{2})$/);
  if (match) {
    const d = new Date(2000, 0, 1, +match[1], +match[2]);
    if (!Number.isNaN(d.getTime()))
      return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  const iso = new Date(time);
  if (!Number.isNaN(iso.getTime()))
    return iso.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return time;
}

function formatNextClassLabel(startTime?: string, day?: string): string {
  if (!startTime) return 'None';
  const match = startTime.match(/^(\d{1,2}):(\d{2})$/);
  if (match) {
    const t = formatTimeOnly(startTime);
    return day ? `${day.slice(0, 3)} ${t}` : t;
  }
  const d = new Date(startTime);
  if (!Number.isNaN(d.getTime()))
    return d.toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' });
  return startTime;
}

function getRelativeTime(timeStr: string): string {
  if (!timeStr) return '';
  const now = new Date();
  const date = new Date(timeStr);
  if (Number.isNaN(date.getTime())) return timeStr;
  const mins = Math.floor((now.getTime() - date.getTime()) / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

// ═══════════════════════════════════════════════════════════════════════════
// Inline style helpers (keeps JSX clean)
// ═══════════════════════════════════════════════════════════════════════════

const styles = {
  /* ── Hero Card ─────────────────────────────────────────────────── */
  heroWrapper: {
    display: 'grid',
    gap: 20,
  } as CSSProperties,

  heroTop: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 16,
  } as CSSProperties,

  heroIcon: {
    display: 'grid',
    placeItems: 'center',
    width: 48,
    height: 48,
    borderRadius: 'var(--radius-lg)',
    background: 'var(--primary-soft)',
    color: 'var(--primary)',
    flexShrink: 0,
  } as CSSProperties,

  heroMeta: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '6px 16px',
    fontSize: '0.85rem',
    color: 'var(--text-secondary)',
    marginTop: 8,
  } as CSSProperties,

  heroDot: {
    width: 3,
    height: 3,
    borderRadius: '50%',
    background: 'var(--border)',
    flexShrink: 0,
  } as CSSProperties,

  heroActions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 10,
    paddingTop: 4,
  } as CSSProperties,

  /* ── Section Heading ───────────────────────────────────────────── */
  sectionHead: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  } as CSSProperties,

  /* ── Quick Action ──────────────────────────────────────────────── */
  quickAction: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    padding: '14px 16px',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--glass-border)',
    background: 'var(--glass)',
    cursor: 'pointer',
    transition: 'all var(--duration) var(--ease)',
    textDecoration: 'none',
    color: 'inherit',
  } as CSSProperties,

  quickActionIcon: (bg: string, fg: string): CSSProperties => ({
    display: 'grid',
    placeItems: 'center',
    width: 40,
    height: 40,
    borderRadius: 'var(--radius)',
    background: bg,
    color: fg,
    flexShrink: 0,
    transition: 'transform var(--duration) var(--ease)',
  }),

  /* ── Notification ──────────────────────────────────────────────── */
  notifItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
    padding: '12px 0',
    borderBottom: '1px solid var(--divider)',
  } as CSSProperties,

  notifIcon: {
    display: 'grid',
    placeItems: 'center',
    width: 34,
    height: 34,
    borderRadius: 'var(--radius)',
    background: 'var(--primary-soft)',
    color: 'var(--primary)',
    flexShrink: 0,
    marginTop: 2,
  } as CSSProperties,

  notifBody: {
    flex: 1,
    minWidth: 0,
  } as CSSProperties,

  notifTitle: {
    fontSize: '0.88rem',
    fontWeight: 500,
    color: 'var(--text-primary)',
    marginBottom: 2,
  } as CSSProperties,

  notifDetail: {
    fontSize: '0.82rem',
    color: 'var(--text-secondary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical' as const,
    lineHeight: 1.5,
  } as CSSProperties,

  notifTime: {
    fontSize: '0.74rem',
    color: 'var(--text-tertiary)',
    whiteSpace: 'nowrap',
    flexShrink: 0,
    marginTop: 2,
  } as CSSProperties,

  /* ── Group Card ────────────────────────────────────────────────── */
  groupCard: {
    display: 'grid',
    gap: 14,
    padding: '20px',
  } as CSSProperties,

  groupTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  } as CSSProperties,

  groupIcon: {
    display: 'grid',
    placeItems: 'center',
    width: 42,
    height: 42,
    borderRadius: 'var(--radius)',
    background: 'var(--secondary-soft)',
    color: 'var(--secondary)',
    flexShrink: 0,
  } as CSSProperties,

  groupFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    paddingTop: 6,
    borderTop: '1px solid var(--divider)',
    flexWrap: 'wrap',
  } as CSSProperties,

  /* ── Empty / Error ─────────────────────────────────────────────── */
  emptyContainer: {
    display: 'grid',
    placeItems: 'center',
    textAlign: 'center',
    padding: '40px 20px',
    gap: 14,
  } as CSSProperties,

  emptyIcon: (bg: string, fg: string): CSSProperties => ({
    display: 'grid',
    placeItems: 'center',
    width: 52,
    height: 52,
    borderRadius: 'var(--radius-lg)',
    background: bg,
    color: fg,
  }),

  /* ── Skeleton ──────────────────────────────────────────────────── */
  skeletonRow: (gap = 12): CSSProperties => ({
    display: 'grid',
    gap,
  }),

  /* ── Layout ────────────────────────────────────────────────────── */
  twoCol: {
    display: 'grid',
    gap: 20,
  } as CSSProperties,

  stagger: (i: number, base = 0.04, step = 0.04): CSSProperties => ({
    animationDelay: `${base + i * step}s`,
  }),
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// Quick Actions Config
// ═══════════════════════════════════════════════════════════════════════════

const QUICK_ACTIONS = [
  {
    title: 'Timetable',
    desc: 'View your merged class schedule',
    href: '/timetable',
    icon: CalendarDays,
    bg: 'var(--primary-soft)',
    fg: 'var(--primary)',
  },
  {
    title: 'Groups',
    desc: 'Browse and manage your groups',
    href: '/groups',
    icon: Users,
    bg: 'var(--secondary-soft)',
    fg: 'var(--secondary)',
  },
  {
    title: 'Notifications',
    desc: 'Check recent updates and alerts',
    href: '/notifications',
    icon: BellRing,
    bg: 'var(--warning-soft)',
    fg: 'var(--warning)',
  },
  {
    title: 'Profile',
    desc: 'Update your account settings',
    href: '/profile',
    icon: UserCircle,
    bg: 'var(--muted-alpha-10)',
    fg: 'var(--text-secondary)',
  },
] as const;

// ═══════════════════════════════════════════════════════════════════════════
// Sub-components
// ═══════════════════════════════════════════════════════════════════════════

/* ── Hero Card ─────────────────────────────────────────────────────────── */

function HeroCard({ entry, groupCount }: { entry?: TimetableEntry; groupCount: number }) {
  const hasClass = Boolean(entry?.courseName);

  const metaParts: ReactNode[] = [];
  if (entry?.day) metaParts.push(entry.day);
  if (entry?.startTime) {
    if (metaParts.length) metaParts.push(<span key="d1" style={styles.heroDot} />);
    metaParts.push(
      `${formatTimeOnly(entry.startTime)} – ${formatTimeOnly(entry.endTime)}`
    );
  }
  if (entry?.venue) {
    if (metaParts.length) metaParts.push(<span key="d2" style={styles.heroDot} />);
    metaParts.push(entry.venue);
  }
  if (entry?.courseCode) {
    if (metaParts.length) metaParts.push(<span key="d3" style={styles.heroDot} />);
    metaParts.push(entry.courseCode);
  }

  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      {/* Accent stripe */}
      <div
        style={{
          height: 4,
          background: hasClass
            ? 'linear-gradient(90deg, var(--primary), var(--secondary))'
            : 'var(--border)',
          borderRadius: '0',
        }}
      />

      <div style={{ padding: '24px 24px 20px', ...styles.heroWrapper }}>
        {/* Top row */}
        <div style={styles.heroTop}>
          <div style={styles.heroIcon}>
            {hasClass ? <BookOpen size={22} /> : <CalendarDays size={22} />}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p
              style={{
                fontSize: '0.74rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: hasClass ? 'var(--primary)' : 'var(--text-tertiary)',
                marginBottom: 4,
              }}
            >
              {hasClass ? 'Next class' : 'No upcoming class'}
            </p>
            <h2 style={{ fontSize: 'clamp(1.15rem, 2.5vw, 1.45rem)', lineHeight: 1.25 }}>
              {entry?.courseName ?? 'Your schedule is clear'}
            </h2>

            {hasClass && metaParts.length > 0 && (
              <div style={styles.heroMeta}>{metaParts}</div>
            )}

            {!hasClass && (
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginTop: 6, lineHeight: 1.6 }}>
                Join a group with a published schedule to see your next class here.
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div style={styles.heroActions}>
          <Link to="/timetable">
            <Button variant="primary" size="sm" leadingIcon={<CalendarDays size={16} />}>
              View timetable
            </Button>
          </Link>
          {groupCount === 0 && (
            <Link to="/groups">
              <Button variant="secondary" size="sm" leadingIcon={<Sparkles size={16} />}>
                Join a group
              </Button>
            </Link>
          )}
        </div>

        {/* Status bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            flexWrap: 'wrap',
            paddingTop: 12,
            borderTop: '1px solid var(--divider)',
          }}
        >
          <Badge tone={groupCount > 0 ? 'success' : 'neutral'}>
            {groupCount > 0 ? 'Active' : 'No groups'}
          </Badge>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
            {groupCount} {groupCount === 1 ? 'group' : 'groups'} joined
          </span>
        </div>
      </div>
    </Card>
  );
}

/* ── Quick Action Item ─────────────────────────────────────────────────── */

function QuickActionLink({
  action,
  index,
}: {
  action: (typeof QUICK_ACTIONS)[number];
  index: number;
}) {
  const Icon = action.icon;
  return (
    <Link
      to={action.href}
      style={{ ...styles.quickAction, ...styles.stagger(index) }}
      className="quick-action-list__item"
      aria-label={`${action.title}: ${action.desc}`}
    >
      <div style={styles.quickActionIcon(action.bg, action.fg)}>
        <Icon size={18} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <strong style={{ fontSize: '0.9rem', display: 'block', marginBottom: 2 }}>
          {action.title}
        </strong>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
          {action.desc}
        </p>
      </div>
      <ChevronRight
        size={16}
        style={{ color: 'var(--text-tertiary)', flexShrink: 0 }}
        aria-hidden
      />
    </Link>
  );
}

/* ── Notification Item ─────────────────────────────────────────────────── */

function NotifItem({ item, isLast }: { item: NotificationEntry; isLast: boolean }) {
  return (
    <article
      style={{ ...styles.notifItem, ...(isLast ? { borderBottom: 'none', paddingBottom: 0 } : {}) }}
      aria-label={`${item.title}: ${item.detail}`}
    >
      <div style={styles.notifIcon}>
        <Bell size={15} />
      </div>
      <div style={styles.notifBody}>
        <p style={styles.notifTitle}>{item.title}</p>
        <p style={styles.notifDetail}>{item.detail}</p>
      </div>
      <time style={styles.notifTime} dateTime={item.time}>
        {getRelativeTime(item.time)}
      </time>
    </article>
  );
}

/* ── Group Card ────────────────────────────────────────────────────────── */

function GroupCard({ group, index }: { group: GroupEntry; index: number }) {
  return (
    <Card
      className="group-card group-card--compact"
      style={{ ...styles.groupCard, ...styles.stagger(index, 0.05, 0.05) }}
      role="listitem"
    >
      <div style={styles.groupTop}>
        <div style={{ minWidth: 0 }}>
          <Badge tone="info" style={{ marginBottom: 8 }}>
            {group.courseCode}
          </Badge>
          <h3 style={{ fontSize: '0.95rem', marginBottom: 4 }}>{group.title}</h3>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            {group.memberCount} {group.memberCount === 1 ? 'member' : 'members'}
          </p>
        </div>
        <div style={styles.groupIcon} aria-hidden>
          <Users size={18} />
        </div>
      </div>

      <div style={styles.groupFooter}>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
          {group.nextClass || 'No upcoming class'}
        </span>
        <Link
          to={`/groups/${group.id}`}
          className="inline-link"
          aria-label={`Open ${group.title}`}
          style={{ fontSize: '0.84rem' }}
        >
          Open <ChevronRight size={14} aria-hidden />
        </Link>
      </div>
    </Card>
  );
}

/* ── Empty States ──────────────────────────────────────────────────────── */

function EmptyGroups({ isAdmin }: { isAdmin: boolean }) {
  return (
    <div style={styles.emptyContainer} role="status">
      <div style={styles.emptyIcon('var(--secondary-soft)', 'var(--secondary)')}>
        <Users size={24} />
      </div>
      <div>
        <h3 style={{ fontSize: '1rem', marginBottom: 6 }}>No groups yet</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', maxWidth: '36ch', lineHeight: 1.6 }}>
          Join a group to see your schedule, classmates, and shared resources.
        </p>
      </div>
      {isAdmin ? (
        <Link to="/groups" style={{ marginTop: 4 }}>
          <Button variant="primary" size="sm" leadingIcon={<Sparkles size={16} />}>
            Browse groups
          </Button>
        </Link>
      ) : null}
    </div>
  );
}

function EmptyNotifications() {
  return (
    <div style={{ ...styles.emptyContainer, padding: '28px 16px' }} role="status">
      <div style={styles.emptyIcon('var(--muted-alpha-10)', 'var(--text-tertiary)')}>
        <Inbox size={22} />
      </div>
      <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)' }}>
        You're all caught up!
      </p>
    </div>
  );
}

/* ── Skeletons ─────────────────────────────────────────────────────────── */

function HeroSkeleton() {
  return (
    <Card aria-busy="true" aria-label="Loading next class" style={{ padding: 0, overflow: 'hidden' }}>
      <div className="skeleton" style={{ height: 4, borderRadius: 0 }} />
      <div style={{ padding: 24, ...styles.skeletonRow(16) }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          <div className="skeleton" style={{ width: 48, height: 48, borderRadius: 'var(--radius-lg)', flexShrink: 0 }} />
          <div style={{ ...styles.skeletonRow(10), flex: 1 }}>
            <div className="skeleton" style={{ width: 80, height: 12 }} />
            <div className="skeleton" style={{ width: '75%', height: 22 }} />
            <div className="skeleton" style={{ width: '50%', height: 14 }} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div className="skeleton" style={{ width: 130, height: 38, borderRadius: 'var(--radius)' }} />
          <div className="skeleton" style={{ width: 100, height: 38, borderRadius: 'var(--radius)' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 12, borderTop: '1px solid var(--divider)' }}>
          <div className="skeleton" style={{ width: 60, height: 20, borderRadius: 'var(--radius-full)' }} />
          <div className="skeleton" style={{ width: 90, height: 14 }} />
        </div>
      </div>
    </Card>
  );
}

function StatsSkeleton() {
  return (
    <div className="stat-grid" aria-busy="true" aria-label="Loading statistics">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i} className="stat-card">
          <div className="skeleton" style={{ width: 50, height: 11 }} />
          <div className="skeleton" style={{ width: '70%', height: 24 }} />
        </Card>
      ))}
    </div>
  );
}

function GroupSkeleton() {
  return (
    <Card aria-busy="true" style={styles.groupCard}>
      <div style={styles.groupTop}>
        <div style={{ ...styles.skeletonRow(10), flex: 1 }}>
          <div className="skeleton" style={{ width: 55, height: 18, borderRadius: 'var(--radius-full)' }} />
          <div className="skeleton" style={{ width: '80%', height: 16 }} />
          <div className="skeleton" style={{ width: 70, height: 13 }} />
        </div>
        <div className="skeleton" style={{ width: 42, height: 42, borderRadius: 'var(--radius)', flexShrink: 0 }} />
      </div>
      <div style={{ ...styles.groupFooter }}>
        <div className="skeleton" style={{ width: 100, height: 13 }} />
        <div className="skeleton" style={{ width: 48, height: 13 }} />
      </div>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Full-page States
// ═══════════════════════════════════════════════════════════════════════════

function LoadingState() {
  return (
    <PageFrame
      eyebrow="Dashboard"
      title="Loading your dashboard…"
    >
      <div className="dashboard-grid">
        <HeroSkeleton />
        <div className="stack">
          <StatsSkeleton />
        </div>
      </div>

      <section className="section-block" aria-busy="true">
        <div style={styles.sectionHead}>
          <div className="skeleton" style={{ width: 200, height: 22 }} />
        </div>
        <div className="group-grid">
          {[0, 1, 2].map((i) => <GroupSkeleton key={i} />)}
        </div>
      </section>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          padding: '24px 0 8px',
          color: 'var(--text-tertiary)',
          fontSize: '0.84rem',
        }}
        role="status"
        aria-live="polite"
      >
        <Loader2 size={16} style={{ animation: 'spin 700ms linear infinite' }} />
        Fetching your data…
      </div>
    </PageFrame>
  );
}

function ErrorState({
  groupsError,
  timetableError,
  notificationsError,
  onRetry,
}: {
  groupsError?: Error | null;
  timetableError?: Error | null;
  notificationsError?: Error | null;
  onRetry: () => void;
}) {
  const errors = [
    groupsError && { label: 'Groups', msg: groupsError.message },
    timetableError && { label: 'Timetable', msg: timetableError.message },
    notificationsError && { label: 'Notifications', msg: notificationsError.message },
  ].filter(Boolean) as { label: string; msg: string }[];

  return (
    <PageFrame eyebrow="Dashboard" title="Something went wrong">
      <Card
        style={{
          display: 'grid',
          gap: 20,
          borderColor: 'var(--error-alpha-20)',
          background: 'var(--error-alpha-10)',
          maxWidth: 600,
        }}
        role="alert"
      >
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <div style={styles.emptyIcon('var(--error-soft)', 'var(--error)')}>
            <AlertCircle size={24} />
          </div>
          <div style={{ display: 'grid', gap: 6 }}>
            <h3>Connection problem</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6 }}>
              We couldn't load your data. Check your connection and try again.
            </p>
          </div>
        </div>

        {errors.length > 0 && (
          <div style={{
            display: 'grid',
            gap: 4,
            padding: '10px 14px',
            borderRadius: 'var(--radius)',
            background: 'var(--muted-alpha-10)',
            fontSize: '0.8rem',
          }}>
            {errors.map((e) => (
              <p key={e.label} style={{ color: 'var(--text-secondary)' }}>
                <strong style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{e.label}:</strong> {e.msg}
              </p>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <Button variant="primary" size="sm" leadingIcon={<RefreshCw size={15} />} onClick={onRetry}>
            Try again
          </Button>
          <Button variant="ghost" size="sm" onClick={() => window.location.reload()}>
            Reload page
          </Button>
        </div>
      </Card>
    </PageFrame>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// CSS-in-JS for responsive layout (injected once via <style>)
// ═══════════════════════════════════════════════════════════════════════════

const DASHBOARD_CSS = `
  .home-grid {
    display: grid;
    gap: 20px;
  }

  .home-bottom {
    display: grid;
    gap: 20px;
  }

  /* Desktop: two-column bottom section */
  @media (min-width: 768px) {
    .home-bottom {
      grid-template-columns: 1fr 1fr;
    }
  }

  /* Quick action hover */
  .qa-link:hover {
    border-color: var(--glass-border-hover) !important;
    background: var(--glass-strong) !important;
    transform: translateY(-1px);
    box-shadow: var(--shadow-lg);
  }

  .qa-link:hover .qa-icon {
    transform: scale(1.08);
  }

  .qa-link:active {
    transform: scale(0.98);
    transition-duration: var(--duration-instant);
  }

  /* Notification hover */
  .notif-item:hover {
    background: var(--muted-alpha-10);
    border-radius: var(--radius);
    margin-inline: -8px;
    padding-inline: 8px;
  }
`;

// ═══════════════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════════════

export function HomePage() {
  const userId = useAuthStore((s) => s.session?.user.uid);

  const profileQ = useQuery({
    queryKey: ['profile', userId],
    queryFn: () => (userId ? fetchCurrentUserProfile(userId) : Promise.resolve(null)),
    enabled: Boolean(userId),
    staleTime: 60_000,
  });

  // ── Queries ─────────────────────────────────────────────────────────────

  const queryOpts = { retry: 2, retryDelay: (a: number) => Math.min(1000 * 2 ** a, 8000) };

  const groupsQ = useQuery({
    queryKey: ['home-groups', userId],
    queryFn: () => (userId ? fetchUserGroups(userId) : Promise.resolve([])),
    enabled: Boolean(userId),
    staleTime: 60_000,
    ...queryOpts,
  });

  const timetableQ = useQuery({
    queryKey: ['home-timetable', userId],
    queryFn: () => (userId ? fetchUserTimetableEntries(userId) : Promise.resolve([])),
    enabled: Boolean(userId),
    staleTime: 60_000,
    ...queryOpts,
  });

  const notifsQ = useQuery({
    queryKey: ['home-notifications', userId],
    queryFn: () => (userId ? fetchNotifications(userId) : Promise.resolve([])),
    enabled: Boolean(userId),
    staleTime: 30_000,
    ...queryOpts,
  });

  // ── Derived ─────────────────────────────────────────────────────────────

  const loading = groupsQ.isLoading || timetableQ.isLoading || notifsQ.isLoading;
  const errored = groupsQ.isError || timetableQ.isError || notifsQ.isError;

  const groups: GroupEntry[] = useMemo(() => groupsQ.data ?? [], [groupsQ.data]);
  const nextClass: TimetableEntry | undefined = timetableQ.data?.[0];
  const notifs: NotificationEntry[] = useMemo(() => notifsQ.data ?? [], [notifsQ.data]);

  const stats = useMemo(() => [
    { label: 'Up next', value: formatNextClassLabel(nextClass?.startTime, nextClass?.day), icon: Clock },
    { label: 'Groups', value: `${groups.length}`, icon: Users },
    { label: 'Unread', value: `${notifs.length}`, icon: Bell },
    { label: 'Classes', value: `${timetableQ.data?.length ?? 0}`, icon: BookOpen },
  ], [nextClass, groups.length, notifs.length, timetableQ.data?.length]);

  const retry = useCallback(() => {
    groupsQ.refetch();
    timetableQ.refetch();
    notifsQ.refetch();
  }, [groupsQ, timetableQ, notifsQ]);

  // ── Guards ──────────────────────────────────────────────────────────────

  if (loading) return <LoadingState />;

  if (errored) {
    return (
      <ErrorState
        groupsError={groupsQ.error instanceof Error ? groupsQ.error : null}
        timetableError={timetableQ.error instanceof Error ? timetableQ.error : null}
        notificationsError={notifsQ.error instanceof Error ? notifsQ.error : null}
        onRetry={retry}
      />
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────

  const visibleNotifs = notifs.slice(0, 5);

  return (
    <>
      {/* Inject responsive styles */}
      <style>{DASHBOARD_CSS}</style>

      <PageFrame
        eyebrow="Dashboard"
        title="Welcome back"
        description="Here's what's happening with your classes and groups today."
      >
        {/* ── Hero + Stats ───────────────────────────────────────── */}
        <div className="dashboard-grid">
          <HeroCard entry={nextClass} groupCount={groups.length} />
          <div className="stack">
            <StatGrid items={stats} />
          </div>
        </div>

        {/* ── Groups ─────────────────────────────────────────────── */}
        <section className="section-block" aria-labelledby="home-groups">
          <div style={styles.sectionHead}>
            <h2 id="home-groups" style={{ fontSize: '1.1rem' }}>Your groups</h2>
            {groups.length > 3 && (
              <Link to="/groups">
                <Button variant="ghost" size="sm" trailingIcon={<ArrowRight size={14} />}>
                  View all
                </Button>
              </Link>
            )}
          </div>

          {groups.length === 0 ? (
            <EmptyGroups
              isAdmin={Boolean(
                (profileQ.data?.courseAdmins ?? []).length > 0 ||
                (profileQ.data as any)?.isAdmin === true
              )}
            />
          ) : (
            <div className="group-grid" role="list">
              {groups.slice(0, 3).map((g, i) => (
                <GroupCard key={g.id} group={g} index={i} />
              ))}
            </div>
          )}
        </section>

        {/* ── Quick Actions + Notifications ──────────────────────── */}
        <div className="home-bottom">
          {/* Quick Actions */}
          <section aria-labelledby="home-actions">
            <Card style={{ padding: '20px' }}>
              <div style={{ ...styles.sectionHead, marginBottom: 16 }}>
                <h2 id="home-actions" style={{ fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Zap size={18} style={{ color: 'var(--warning)' }} />
                  Quick actions
                </h2>
              </div>
              <nav style={{ display: 'grid', gap: 8 }} aria-label="Quick actions">
                {QUICK_ACTIONS.map((a, i) => (
                  <QuickActionLink key={a.title} action={a} index={i} />
                ))}
              </nav>
            </Card>
          </section>

          {/* Notifications */}
          <section aria-labelledby="home-notifs">
            <Card style={{ padding: '20px' }}>
              <div style={{ ...styles.sectionHead, marginBottom: 12 }}>
                <h2 id="home-notifs" style={{ fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Bell size={18} style={{ color: 'var(--primary)' }} />
                  Notifications
                  {notifs.length > 0 && (
                    <Badge tone="info" style={{ marginLeft: 4, fontSize: '0.68rem' }}>
                      {notifs.length}
                    </Badge>
                  )}
                </h2>
                {notifs.length > 5 && (
                  <Link to="/notifications">
                    <Button variant="ghost" size="sm">See all</Button>
                  </Link>
                )}
              </div>

              {visibleNotifs.length === 0 ? (
                <EmptyNotifications />
              ) : (
                <div role="feed" aria-label="Recent notifications">
                  {visibleNotifs.map((n, i) => (
                    <NotifItem
                      key={n.id}
                      item={n}
                      isLast={i === visibleNotifs.length - 1}
                    />
                  ))}
                </div>
              )}
            </Card>
          </section>
        </div>
      </PageFrame>
    </>
  );
}