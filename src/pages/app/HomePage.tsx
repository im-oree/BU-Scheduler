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
  Megaphone,
  AlertTriangle,
  Crown,
} from 'lucide-react';
import { Badge, Button, Card } from '../../components/ui';
import { PageFrame, StatGrid } from '../../components/shared';
import { useAuthStore } from '../../store/useAuthStore';
import {
  fetchUserGroups,
  fetchUserTimetableEntries,
  fetchCurrentUserProfile,
} from '../../lib/studenthubData';
import {
  collection,
  getDocs,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query as firestoreQuery,
} from 'firebase/firestore';
import { getFirebaseApp } from '../../lib/firebase';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

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

interface GroupNotification {
  id: string;
  title: string;
  content: string;
  priority: string;
  type: string;
  timestamp: number;
  groupId: string;
  groupName: string;
  senderName: string;
  readBy?: string[];
}

// ═══════════════════════════════════════════════════════════════
// Next-class logic
// ═══════════════════════════════════════════════════════════════

const DAY_ORDER: Record<string, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

/**
 * Given all timetable entries, return the single next upcoming
 * class based on the current day + time.
 *
 * Logic:
 *  1. Prefer a class that is happening today and hasn't ended yet.
 *  2. If nothing left today, find the nearest future day.
 *  3. If nothing in the rest of this week, wrap to next week.
 */
function findNextClass(
  entries: TimetableEntry[],
): TimetableEntry | undefined {
  if (!entries.length) return undefined;

  const now = new Date();
  const todayIdx = now.getDay(); // 0 = Sunday
  const currentMins = now.getHours() * 60 + now.getMinutes();

  function parseMinutes(time?: string): number {
    if (!time) return 0;
    // Handle "HH:MM" format
    const match = time.match(/^(\d{1,2}):(\d{2})/);
    if (match) return parseInt(match[1]) * 60 + parseInt(match[2]);
    return 0;
  }

  // Score each entry: how many minutes from now until it starts
  // (wrapping around the week if needed)
  const scored = entries
    .filter((e) => e.day && e.startTime)
    .map((e) => {
      const entryDayIdx = DAY_ORDER[e.day!] ?? -1;
      if (entryDayIdx === -1) return null;

      const startMins = parseMinutes(e.startTime);
      const endMins = parseMinutes(e.endTime) || startMins + 60;

      // Days until this entry's day (0 = today, 1 = tomorrow, etc.)
      let daysUntil = entryDayIdx - todayIdx;
      if (daysUntil < 0) daysUntil += 7; // wrap to next week

      // If it's today but already ended, push to next week
      if (daysUntil === 0 && endMins <= currentMins) {
        daysUntil = 7;
      }

      const minutesUntil =
        daysUntil * 24 * 60 + startMins - currentMins;

      return { entry: e, minutesUntil };
    })
    .filter(Boolean) as { entry: TimetableEntry; minutesUntil: number }[];

  if (!scored.length) return undefined;

  // Sort by soonest
  scored.sort((a, b) => a.minutesUntil - b.minutesUntil);

  return scored[0].entry;
}

// ═══════════════════════════════════════════════════════════════
// Formatters
// ═══════════════════════════════════════════════════════════════

function formatTimeOnly(time?: string): string {
  if (!time) return '—';
  const match = time.match(/^(\d{1,2}):(\d{2})$/);
  if (match) {
    const d = new Date(2000, 0, 1, +match[1], +match[2]);
    if (!Number.isNaN(d.getTime()))
      return d.toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit',
      });
  }
  const iso = new Date(time);
  if (!Number.isNaN(iso.getTime()))
    return iso.toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
    });
  return time;
}

function formatNextClassLabel(
  startTime?: string,
  day?: string,
): string {
  if (!startTime) return 'None';
  const match = startTime.match(/^(\d{1,2}):(\d{2})$/);
  if (match) {
    const t = formatTimeOnly(startTime);
    return day ? `${day.slice(0, 3)} ${t}` : t;
  }
  const d = new Date(startTime);
  if (!Number.isNaN(d.getTime()))
    return d.toLocaleString([], {
      weekday: 'short',
      hour: 'numeric',
      minute: '2-digit',
    });
  return startTime;
}

function timeAgo(timestamp: number): string {
  if (!timestamp) return '';
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 5) return 'Just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

// ═══════════════════════════════════════════════════════════════
// Inline styles
// ═══════════════════════════════════════════════════════════════

const styles = {
  heroWrapper: { display: 'grid', gap: 20 } as CSSProperties,
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
  sectionHead: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  } as CSSProperties,
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
  skeletonRow: (gap = 12): CSSProperties => ({
    display: 'grid',
    gap,
  }),
  stagger: (
    i: number,
    base = 0.04,
    step = 0.04,
  ): CSSProperties => ({
    animationDelay: `${base + i * step}s`,
  }),
} as const;

// ═══════════════════════════════════════════════════════════════
// Quick Actions config
// ═══════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════
// Notification priority helpers
// ═══════════════════════════════════════════════════════════════

function getPriorityStyle(priority: string) {
  switch (priority) {
    case 'urgent':
      return {
        fg: 'var(--error, #E74C3C)',
        bg: 'var(--error-soft, rgba(231,76,60,0.12))',
        label: 'Urgent',
        accent: '#E74C3C',
      };
    case 'high':
      return {
        fg: 'var(--warning, #F59E0B)',
        bg: 'var(--warning-soft, rgba(245,158,11,0.12))',
        label: 'Important',
        accent: '#F59E0B',
      };
    case 'medium':
      return {
        fg: 'var(--primary, #3B82F6)',
        bg: 'var(--primary-soft, rgba(59,130,246,0.12))',
        label: 'Info',
        accent: '#3B82F6',
      };
    default:
      return {
        fg: 'var(--success, #2ECC71)',
        bg: 'var(--success-soft, rgba(46,204,113,0.12))',
        label: 'Update',
        accent: '#2ECC71',
      };
  }
}

function getTypeIcon(type: string) {
  switch (type) {
    case 'announcement':
      return <Megaphone size={16} />;
    case 'reminder':
      return <Clock size={16} />;
    case 'alert':
      return <AlertCircle size={16} />;
    default:
      return <Zap size={16} />;
  }
}

// ═══════════════════════════════════════════════════════════════
// Live group notifications hook
// Mirrors the StudentHub GroupUpdatesWidget pattern exactly:
// 1. Scan courseGroups to find groups the user is in
// 2. Attach onSnapshot to each group's notifications subcollection
// 3. Keep the most-recent 5 across all groups, sorted by timestamp
// ═══════════════════════════════════════════════════════════════

function useGroupNotifications(userId: string | undefined) {
  const db = getFirestore(getFirebaseApp());
  const [notifs, setNotifs] = useState<GroupNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    let mounted = true;
    const unsubscribers: (() => void)[] = [];
    // Map keyed by `${groupId}_${notifId}` so updates are deduplicated
    const allMap = new Map<string, GroupNotification>();

    function broadcast() {
      const sorted = Array.from(allMap.values()).sort(
        (a, b) => b.timestamp - a.timestamp,
      );
      if (mounted) setNotifs(sorted);
    }

    async function setup() {
      try {
        // Find groups this user belongs to
        const snap = await getDocs(collection(db, 'courseGroups'));
        const userGroups: { id: string; name: string }[] = [];

        snap.docs.forEach((d) => {
          const data = d.data();
          const members: any[] = data.members || [];
          if (members.some((m) => m.userId === userId)) {
            userGroups.push({
              id: d.id,
              name:
                data.groupName ||
                data.courseName ||
                data.courseCode ||
                d.id,
            });
          }
        });

        if (!mounted) return;

        if (userGroups.length === 0) {
          setLoading(false);
          return;
        }

        // Listen to latest 10 notifications from each group
        userGroups.forEach((group) => {
          const q = firestoreQuery(
            collection(db, 'courseGroups', group.id, 'notifications'),
            orderBy('createdAt', 'desc'),
            limit(10),
          );

          const unsub = onSnapshot(
            q,
            (groupSnap) => {
              if (!mounted) return;

              // Remove stale entries for this group
              for (const key of allMap.keys()) {
                if (key.startsWith(`${group.id}_`)) allMap.delete(key);
              }

              groupSnap.docs.forEach((d) => {
                const data = d.data() as Record<string, unknown>;

                // Parse Firestore Timestamp / number / string
                let ts = 0;
                const raw = data.createdAt ?? data.timestamp;
                if (typeof raw === 'number') {
                  ts = raw;
                } else if (raw && typeof (raw as any).toMillis === 'function') {
                  ts = (raw as any).toMillis();
                } else if (raw && typeof (raw as any).seconds === 'number') {
                  ts = (raw as any).seconds * 1000;
                }

                // Skip expired
                const exp = data.expiresAt as number | undefined;
                if (exp && exp < Date.now()) return;

                allMap.set(`${group.id}_${d.id}`, {
                  id: d.id,
                  title: String(data.title ?? 'Group Update'),
                  content: String(
                    data.content ?? data.message ?? data.body ?? '',
                  ),
                  priority: String(data.priority ?? 'low'),
                  type: String(data.type ?? 'update'),
                  timestamp: ts,
                  groupId: group.id,
                  groupName: group.name,
                  senderName: String(
                    data.createdByName ?? data.senderName ?? 'Course Rep',
                  ),
                  readBy: (data.readBy as string[]) || [],
                });
              });

              broadcast();
            },
            (err) =>
              console.warn(
                `[HomePage] notif listener error (${group.id}):`,
                err,
              ),
          );

          unsubscribers.push(unsub);
        });

        if (mounted) setLoading(false);
      } catch (err) {
        console.error('[HomePage] group notifications setup error:', err);
        if (mounted) setLoading(false);
      }
    }

    setup();

    return () => {
      mounted = false;
      unsubscribers.forEach((u) => {
        try {
          u();
        } catch {
          /* ignore */
        }
      });
    };
  }, [userId, db]);

  return { notifs, loading };
}

// ═══════════════════════════════════════════════════════════════
// Sub-components
// ═══════════════════════════════════════════════════════════════

/* ── Hero Card ─────────────────────────────────────────────── */

function HeroCard({
  entry,
  groupCount,
}: {
  entry?: TimetableEntry;
  groupCount: number;
}) {
  const hasClass = Boolean(entry?.courseName);

  const metaParts: ReactNode[] = [];
  if (entry?.day) metaParts.push(entry.day);
  if (entry?.startTime) {
    if (metaParts.length)
      metaParts.push(<span key="d1" style={styles.heroDot} />);
    metaParts.push(
      `${formatTimeOnly(entry.startTime)} – ${formatTimeOnly(entry.endTime)}`,
    );
  }
  if (entry?.venue) {
    if (metaParts.length)
      metaParts.push(<span key="d2" style={styles.heroDot} />);
    metaParts.push(entry.venue);
  }
  if (entry?.courseCode) {
    if (metaParts.length)
      metaParts.push(<span key="d3" style={styles.heroDot} />);
    metaParts.push(entry.courseCode);
  }

  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      <div
        style={{
          height: 4,
          background: hasClass
            ? 'linear-gradient(90deg, var(--primary), var(--secondary))'
            : 'var(--border)',
        }}
      />
      <div style={{ padding: '24px 24px 20px', ...styles.heroWrapper }}>
        <div style={styles.heroTop}>
          <div style={styles.heroIcon}>
            {hasClass ? (
              <BookOpen size={22} />
            ) : (
              <CalendarDays size={22} />
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p
              style={{
                fontSize: '0.74rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: hasClass
                  ? 'var(--primary)'
                  : 'var(--text-tertiary)',
                marginBottom: 4,
              }}
            >
              {hasClass ? 'Next class' : 'No upcoming class'}
            </p>
            <h2
              style={{
                fontSize: 'clamp(1.15rem, 2.5vw, 1.45rem)',
                lineHeight: 1.25,
              }}
            >
              {entry?.courseName ?? 'Your schedule is clear'}
            </h2>
            {hasClass && metaParts.length > 0 && (
              <div style={styles.heroMeta}>{metaParts}</div>
            )}
            {!hasClass && (
              <p
                style={{
                  color: 'var(--text-secondary)',
                  fontSize: '0.88rem',
                  marginTop: 6,
                  lineHeight: 1.6,
                }}
              >
                Join a group with a published schedule to see your
                next class here.
              </p>
            )}
          </div>
        </div>

        <div style={styles.heroActions}>
          <Link to="/timetable">
            <Button
              variant="primary"
              size="sm"
              leadingIcon={<CalendarDays size={16} />}
            >
              View timetable
            </Button>
          </Link>
          {groupCount === 0 && (
            <Link to="/groups">
              <Button
                variant="secondary"
                size="sm"
                leadingIcon={<Sparkles size={16} />}
              >
                Join a group
              </Button>
            </Link>
          )}
        </div>

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
          <span
            style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}
          >
            {groupCount} {groupCount === 1 ? 'group' : 'groups'} joined
          </span>
        </div>
      </div>
    </Card>
  );
}

/* ── Quick Action Item ─────────────────────────────────────── */

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
        <strong
          style={{
            fontSize: '0.9rem',
            display: 'block',
            marginBottom: 2,
          }}
        >
          {action.title}
        </strong>
        <p
          style={{
            fontSize: '0.8rem',
            color: 'var(--text-secondary)',
            lineHeight: 1.45,
          }}
        >
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

/* ── Group Card ────────────────────────────────────────────── */

function GroupCard({
  group,
  index,
}: {
  group: GroupEntry;
  index: number;
}) {
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
          <h3 style={{ fontSize: '0.95rem', marginBottom: 4 }}>
            {group.title}
          </h3>
          <p
            style={{
              fontSize: '0.82rem',
              color: 'var(--text-secondary)',
            }}
          >
            {group.memberCount}{' '}
            {group.memberCount === 1 ? 'member' : 'members'}
          </p>
        </div>
        <div style={styles.groupIcon} aria-hidden>
          <Users size={18} />
        </div>
      </div>
      <div style={styles.groupFooter}>
        <span
          style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}
        >
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

/* ── Empty States ──────────────────────────────────────────── */

function EmptyGroups({ isAdmin }: { isAdmin: boolean }) {
  return (
    <div style={styles.emptyContainer} role="status">
      <div
        style={styles.emptyIcon(
          'var(--secondary-soft)',
          'var(--secondary)',
        )}
      >
        <Users size={24} />
      </div>
      <div>
        <h3 style={{ fontSize: '1rem', marginBottom: 6 }}>
          No groups yet
        </h3>
        <p
          style={{
            color: 'var(--text-secondary)',
            fontSize: '0.88rem',
            maxWidth: '36ch',
            lineHeight: 1.6,
          }}
        >
          Join a group to see your schedule, classmates, and shared
          resources.
        </p>
      </div>
      {isAdmin && (
        <Link to="/groups" style={{ marginTop: 4 }}>
          <Button
            variant="primary"
            size="sm"
            leadingIcon={<Sparkles size={16} />}
          >
            Browse groups
          </Button>
        </Link>
      )}
    </div>
  );
}

/* ── Live Group Notification Item ──────────────────────────── */

function LiveNotifItem({
  notif,
  userId,
  isLast,
}: {
  notif: GroupNotification;
  userId: string;
  isLast: boolean;
}) {
  const style = getPriorityStyle(notif.priority);
  const isUnread = !notif.readBy?.includes(userId);

  return (
    <Link
      to="/notifications"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: '12px 0',
        borderBottom: isLast ? 'none' : '1px solid var(--divider)',
        textDecoration: 'none',
        color: 'inherit',
        cursor: 'pointer',
      }}
      aria-label={`${notif.title} from ${notif.groupName}`}
    >
      {/* Icon */}
      <div
        style={{
          display: 'grid',
          placeItems: 'center',
          width: 34,
          height: 34,
          borderRadius: 'var(--radius)',
          background: style.bg,
          color: style.fg,
          flexShrink: 0,
          marginTop: 2,
          position: 'relative',
        }}
      >
        {getTypeIcon(notif.type)}
        {/* Unread dot */}
        {isUnread && (
          <div
            style={{
              position: 'absolute',
              top: -3,
              right: -3,
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: style.accent,
              border: '2px solid var(--surface, #15182B)',
            }}
          />
        )}
      </div>

      {/* Body */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Title */}
        <p
          style={{
            fontSize: '0.88rem',
            fontWeight: 500,
            color: 'var(--text-primary)',
            marginBottom: 2,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            opacity: isUnread ? 1 : 0.7,
          }}
        >
          {notif.title}
        </p>

        {/* Content preview */}
        {notif.content && (
          <p
            style={{
              fontSize: '0.78rem',
              color: 'var(--text-secondary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              marginBottom: 4,
            }}
          >
            {notif.content}
          </p>
        )}

        {/* Meta: group + sender + time */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            flexWrap: 'wrap',
            fontSize: '0.72rem',
          }}
        >
          {/* Group pill */}
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
              padding: '1px 6px',
              borderRadius: 4,
              background:
                'var(--secondary-soft, rgba(139,92,246,0.1))',
              color: 'var(--secondary, #8B5CF6)',
              fontWeight: 600,
            }}
          >
            <Users size={9} />
            {notif.groupName}
          </span>

          <span
            style={{
              width: 2,
              height: 2,
              borderRadius: '50%',
              background: 'var(--border)',
            }}
          />

          {/* Sender */}
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
              color: 'var(--text-tertiary)',
            }}
          >
            <Crown
              size={9}
              style={{ color: 'var(--warning, #F59E0B)' }}
            />
            {notif.senderName}
          </span>

          <span
            style={{
              width: 2,
              height: 2,
              borderRadius: '50%',
              background: 'var(--border)',
            }}
          />

          {/* Time */}
          <span style={{ color: 'var(--text-tertiary)' }}>
            {timeAgo(notif.timestamp)}
          </span>
        </div>
      </div>
    </Link>
  );
}

/* ── Skeletons ─────────────────────────────────────────────── */

function HeroSkeleton() {
  return (
    <Card
      aria-busy="true"
      aria-label="Loading next class"
      style={{ padding: 0, overflow: 'hidden' }}
    >
      <div className="skeleton" style={{ height: 4, borderRadius: 0 }} />
      <div style={{ padding: 24, ...styles.skeletonRow(16) }}>
        <div
          style={{
            display: 'flex',
            gap: 16,
            alignItems: 'flex-start',
          }}
        >
          <div
            className="skeleton"
            style={{
              width: 48,
              height: 48,
              borderRadius: 'var(--radius-lg)',
              flexShrink: 0,
            }}
          />
          <div style={{ ...styles.skeletonRow(10), flex: 1 }}>
            <div className="skeleton" style={{ width: 80, height: 12 }} />
            <div
              className="skeleton"
              style={{ width: '75%', height: 22 }}
            />
            <div
              className="skeleton"
              style={{ width: '50%', height: 14 }}
            />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div
            className="skeleton"
            style={{
              width: 130,
              height: 38,
              borderRadius: 'var(--radius)',
            }}
          />
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            paddingTop: 12,
            borderTop: '1px solid var(--divider)',
          }}
        >
          <div
            className="skeleton"
            style={{ width: 60, height: 20, borderRadius: 'var(--radius-full)' }}
          />
          <div className="skeleton" style={{ width: 90, height: 14 }} />
        </div>
      </div>
    </Card>
  );
}

function StatsSkeleton() {
  return (
    <div
      className="stat-grid"
      aria-busy="true"
      aria-label="Loading statistics"
    >
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i} className="stat-card">
          <div className="skeleton" style={{ width: 50, height: 11 }} />
          <div
            className="skeleton"
            style={{ width: '70%', height: 24 }}
          />
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
          <div
            className="skeleton"
            style={{
              width: 55,
              height: 18,
              borderRadius: 'var(--radius-full)',
            }}
          />
          <div
            className="skeleton"
            style={{ width: '80%', height: 16 }}
          />
          <div className="skeleton" style={{ width: 70, height: 13 }} />
        </div>
        <div
          className="skeleton"
          style={{
            width: 42,
            height: 42,
            borderRadius: 'var(--radius)',
            flexShrink: 0,
          }}
        />
      </div>
      <div style={styles.groupFooter}>
        <div className="skeleton" style={{ width: 100, height: 13 }} />
        <div className="skeleton" style={{ width: 48, height: 13 }} />
      </div>
    </Card>
  );
}

/* ── Full-page States ──────────────────────────────────────── */

function LoadingState() {
  return (
    <PageFrame eyebrow="Dashboard" title="Loading your dashboard…">
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
          {[0, 1, 2].map((i) => (
            <GroupSkeleton key={i} />
          ))}
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
        <Loader2
          size={16}
          style={{ animation: 'spin 700ms linear infinite' }}
        />
        Fetching your data…
      </div>
    </PageFrame>
  );
}

function ErrorState({
  groupsError,
  timetableError,
  onRetry,
}: {
  groupsError?: Error | null;
  timetableError?: Error | null;
  onRetry: () => void;
}) {
  const errors = [
    groupsError && { label: 'Groups', msg: groupsError.message },
    timetableError && {
      label: 'Timetable',
      msg: timetableError.message,
    },
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
          <div
            style={styles.emptyIcon(
              'var(--error-soft)',
              'var(--error)',
            )}
          >
            <AlertCircle size={24} />
          </div>
          <div style={{ display: 'grid', gap: 6 }}>
            <h3>Connection problem</h3>
            <p
              style={{
                color: 'var(--text-secondary)',
                fontSize: '0.9rem',
                lineHeight: 1.6,
              }}
            >
              We couldn't load your data. Check your connection and
              try again.
            </p>
          </div>
        </div>
        {errors.length > 0 && (
          <div
            style={{
              display: 'grid',
              gap: 4,
              padding: '10px 14px',
              borderRadius: 'var(--radius)',
              background: 'var(--muted-alpha-10)',
              fontSize: '0.8rem',
            }}
          >
            {errors.map((e) => (
              <p key={e.label} style={{ color: 'var(--text-secondary)' }}>
                <strong
                  style={{
                    color: 'var(--text-primary)',
                    fontWeight: 500,
                  }}
                >
                  {e.label}:
                </strong>{' '}
                {e.msg}
              </p>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: 10 }}>
          <Button
            variant="primary"
            size="sm"
            leadingIcon={<RefreshCw size={15} />}
            onClick={onRetry}
          >
            Try again
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.location.reload()}
          >
            Reload page
          </Button>
        </div>
      </Card>
    </PageFrame>
  );
}

// ═══════════════════════════════════════════════════════════════
// Dashboard CSS
// ═══════════════════════════════════════════════════════════════

const DASHBOARD_CSS = `
  .home-bottom {
    display: grid;
    gap: 20px;
  }
  @media (min-width: 768px) {
    .home-bottom {
      grid-template-columns: 1fr 1fr;
    }
  }
  .quick-action-list__item:hover {
    border-color: var(--glass-border-hover) !important;
    background: var(--glass-strong) !important;
    transform: translateY(-1px);
    box-shadow: var(--shadow-lg);
  }
  .quick-action-list__item:active {
    transform: scale(0.98);
  }
`;

// ═══════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════

export function HomePage() {
  const userId = useAuthStore((s) => s.session?.user.uid);

  // ── Profile ─────────────────────────────────────────────────

  const profileQ = useQuery({
    queryKey: ['profile', userId],
    queryFn: () =>
      userId ? fetchCurrentUserProfile(userId) : Promise.resolve(null),
    enabled: Boolean(userId),
    staleTime: 60_000,
  });

  // ── Groups ───────────────────────────────────────────────────

  const groupsQ = useQuery({
    queryKey: ['home-groups', userId],
    queryFn: () =>
      userId ? fetchUserGroups(userId) : Promise.resolve([]),
    enabled: Boolean(userId),
    staleTime: 60_000,
    retry: 2,
  });

  // ── Timetable ────────────────────────────────────────────────

  const timetableQ = useQuery({
    queryKey: ['home-timetable', userId],
    queryFn: () =>
      userId ? fetchUserTimetableEntries(userId) : Promise.resolve([]),
    enabled: Boolean(userId),
    staleTime: 60_000,
    retry: 2,
  });

  // ── Live group notifications ─────────────────────────────────
  // Uses the same onSnapshot pattern as StudentHub GroupUpdatesWidget

  const { notifs: liveNotifs, loading: notifsLoading } =
    useGroupNotifications(userId);

  // ── Derived ──────────────────────────────────────────────────

  const loading = groupsQ.isLoading || timetableQ.isLoading;
  const errored = groupsQ.isError || timetableQ.isError;

  const groups: GroupEntry[] = useMemo(
    () => groupsQ.data ?? [],
    [groupsQ.data],
  );

  // ── KEY FIX: find next class based on current day + time ────
  const nextClass: TimetableEntry | undefined = useMemo(
    () => findNextClass(timetableQ.data ?? []),
    [timetableQ.data],
  );

  const stats = useMemo(
    () => [
      {
        label: 'Up next',
        value: formatNextClassLabel(
          nextClass?.startTime,
          nextClass?.day,
        ),
        icon: Clock,
      },
      { label: 'Groups', value: `${groups.length}`, icon: Users },
      {
        label: 'Updates',
        value: `${liveNotifs.length}`,
        icon: Bell,
      },
      {
        label: 'Classes',
        value: `${timetableQ.data?.length ?? 0}`,
        icon: BookOpen,
      },
    ],
    [nextClass, groups.length, liveNotifs.length, timetableQ.data?.length],
  );

  const retry = useCallback(() => {
    groupsQ.refetch();
    timetableQ.refetch();
  }, [groupsQ, timetableQ]);

  // ── Guards ───────────────────────────────────────────────────

  if (loading) return <LoadingState />;

  if (errored) {
    return (
      <ErrorState
        groupsError={
          groupsQ.error instanceof Error ? groupsQ.error : null
        }
        timetableError={
          timetableQ.error instanceof Error ? timetableQ.error : null
        }
        onRetry={retry}
      />
    );
  }

  // ── Render ───────────────────────────────────────────────────

  // Show up to 5 most recent from all groups
  const visibleNotifs = liveNotifs.slice(0, 5);

  return (
    <>
      <style>{DASHBOARD_CSS}</style>

      <PageFrame
        eyebrow="Dashboard"
        title="Welcome back"
        description="Here's what's happening with your classes and groups today."
      >
        {/* ── Hero + Stats ─────────────────────────────── */}
        <div className="dashboard-grid">
          <HeroCard entry={nextClass} groupCount={groups.length} />
          <div className="stack">
            <StatGrid items={stats} />
          </div>
        </div>

        {/* ── Groups ───────────────────────────────────── */}
        <section className="section-block" aria-labelledby="home-groups">
          <div style={styles.sectionHead}>
            <h2 id="home-groups" style={{ fontSize: '1.1rem' }}>
              Your groups
            </h2>
            {groups.length > 3 && (
              <Link to="/groups">
                <Button
                  variant="ghost"
                  size="sm"
                  trailingIcon={<ArrowRight size={14} />}
                >
                  View all
                </Button>
              </Link>
            )}
          </div>

          {groups.length === 0 ? (
            <EmptyGroups
              isAdmin={Boolean(
                (profileQ.data?.courseAdmins ?? []).length > 0 ||
                  (profileQ.data as any)?.isAdmin === true,
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

        {/* ── Quick Actions + Group Updates ─────────────── */}
        <div className="home-bottom">
          {/* Quick Actions */}
          <section aria-labelledby="home-actions">
            <Card style={{ padding: '20px' }}>
              <div
                style={{ ...styles.sectionHead, marginBottom: 16 }}
              >
                <h2
                  id="home-actions"
                  style={{
                    fontSize: '1.05rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <Zap
                    size={18}
                    style={{ color: 'var(--warning)' }}
                  />
                  Quick actions
                </h2>
              </div>
              <nav
                style={{ display: 'grid', gap: 8 }}
                aria-label="Quick actions"
              >
                {QUICK_ACTIONS.map((a, i) => (
                  <QuickActionLink key={a.title} action={a} index={i} />
                ))}
              </nav>
            </Card>
          </section>

          {/* ── Group Updates (live from all groups) ───── */}
          <section aria-labelledby="home-notifs">
            <Card style={{ padding: '20px' }}>
              <div
                style={{ ...styles.sectionHead, marginBottom: 12 }}
              >
                <h2
                  id="home-notifs"
                  style={{
                    fontSize: '1.05rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <Bell
                    size={18}
                    style={{ color: 'var(--primary)' }}
                  />
                  Group updates
                  {liveNotifs.length > 0 && (
                    <Badge
                      tone="info"
                      style={{ marginLeft: 4, fontSize: '0.68rem' }}
                    >
                      {liveNotifs.length}
                    </Badge>
                  )}
                </h2>
                {liveNotifs.length > 5 && (
                  <Link to="/notifications">
                    <Button variant="ghost" size="sm">
                      See all
                    </Button>
                  </Link>
                )}
              </div>

              {notifsLoading ? (
                /* Skeleton while listeners are setting up */
                <div style={{ display: 'grid', gap: 12 }}>
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        gap: 10,
                        padding: '10px 0',
                        borderBottom:
                          i < 2
                            ? '1px solid var(--divider)'
                            : 'none',
                      }}
                    >
                      <div
                        className="skeleton"
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 'var(--radius)',
                          flexShrink: 0,
                        }}
                      />
                      <div
                        style={{
                          flex: 1,
                          display: 'grid',
                          gap: 6,
                        }}
                      >
                        <div
                          className="skeleton"
                          style={{ width: '70%', height: 13 }}
                        />
                        <div
                          className="skeleton"
                          style={{ width: '90%', height: 11 }}
                        />
                        <div
                          className="skeleton"
                          style={{ width: '50%', height: 10 }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : visibleNotifs.length === 0 ? (
                <div
                  style={{
                    display: 'grid',
                    placeItems: 'center',
                    textAlign: 'center',
                    padding: '28px 16px',
                    gap: 10,
                  }}
                  role="status"
                >
                  <div
                    style={styles.emptyIcon(
                      'var(--muted-alpha-10)',
                      'var(--text-tertiary)',
                    )}
                  >
                    <Inbox size={22} />
                  </div>
                  <p
                    style={{
                      fontSize: '0.86rem',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    No group updates yet
                  </p>
                </div>
              ) : (
                <div role="feed" aria-label="Group updates">
                  {visibleNotifs.map((n, i) => (
                    <LiveNotifItem
                      key={`${n.groupId}_${n.id}`}
                      notif={n}
                      userId={userId ?? ''}
                      isLast={i === visibleNotifs.length - 1}
                    />
                  ))}

                  {liveNotifs.length > 5 && (
                    <Link
                      to="/notifications"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        padding: '12px 0 2px',
                        fontSize: '0.82rem',
                        color: 'var(--primary)',
                        textDecoration: 'none',
                        fontWeight: 500,
                      }}
                    >
                      View all {liveNotifs.length} updates
                      <ArrowRight size={14} />
                    </Link>
                  )}
                </div>
              )}
            </Card>
          </section>
        </div>
      </PageFrame>
    </>
  );
}