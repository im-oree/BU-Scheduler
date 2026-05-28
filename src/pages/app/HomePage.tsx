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
  Crown,
  MapPin,
  User,
  Radio,
  CheckCircle2,
  Timer,
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
  instructor?: string;
  building?: string;
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

type ClassStatus = 'upcoming' | 'ongoing' | 'justEnded' | 'none';

interface NextClassInfo {
  entry: TimetableEntry;
  status: ClassStatus;
  minutesUntilStart: number;
  minutesUntilEnd: number;
  progressPercent: number; // 0-100, only meaningful when ongoing
  remainingLabel: string;
}

// ═══════════════════════════════════════════════════════════════
// Day / time logic
// ═══════════════════════════════════════════════════════════════

const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];
const DAY_ORDER: Record<string, number> = Object.fromEntries(
  DAY_NAMES.map((d, i) => [d, i]),
);

function parseMinutes(time?: string): number {
  if (!time) return 0;
  const match = time.match(/^(\d{1,2}):(\d{2})/);
  if (match) return parseInt(match[1]) * 60 + parseInt(match[2]);
  return 0;
}

function findNextClassInfo(
  entries: TimetableEntry[],
): NextClassInfo | null {
  if (!entries.length) return null;

  const now = new Date();
  const todayIdx = now.getDay();
  const currentMins = now.getHours() * 60 + now.getMinutes();

  const candidates = entries
    .filter((e) => e.day && e.startTime)
    .map((e) => {
      const entryDayIdx = DAY_ORDER[e.day!] ?? -1;
      if (entryDayIdx === -1) return null;

      const startMins = parseMinutes(e.startTime);
      const endMins = parseMinutes(e.endTime) || startMins + 60;
      const isToday = entryDayIdx === todayIdx;

      // Check if currently ongoing
      if (isToday && currentMins >= startMins && currentMins < endMins) {
        const elapsed = currentMins - startMins;
        const duration = endMins - startMins;
        const remaining = endMins - currentMins;
        return {
          entry: e,
          status: 'ongoing' as ClassStatus,
          minutesUntilStart: 0,
          minutesUntilEnd: remaining,
          progressPercent: Math.round((elapsed / duration) * 100),
          remainingLabel: formatRemaining(remaining),
          sortKey: -99999, // ongoing always first
        };
      }

      // Check if just ended (within last 15 minutes)
      if (isToday && currentMins >= endMins && currentMins - endMins <= 15) {
        return {
          entry: e,
          status: 'justEnded' as ClassStatus,
          minutesUntilStart: -(currentMins - startMins),
          minutesUntilEnd: -(currentMins - endMins),
          progressPercent: 100,
          remainingLabel: `Ended ${currentMins - endMins}m ago`,
          sortKey: -50000 + (currentMins - endMins),
        };
      }

      // Future class
      let daysUntil = entryDayIdx - todayIdx;
      if (daysUntil < 0) daysUntil += 7;
      if (daysUntil === 0 && endMins <= currentMins) daysUntil = 7;

      const minutesUntilStart =
        daysUntil * 24 * 60 + startMins - currentMins;

      return {
        entry: e,
        status: 'upcoming' as ClassStatus,
        minutesUntilStart,
        minutesUntilEnd: minutesUntilStart + (endMins - startMins),
        progressPercent: 0,
        remainingLabel: formatCountdown(minutesUntilStart),
        sortKey: minutesUntilStart,
      };
    })
    .filter(Boolean) as (NextClassInfo & { sortKey: number })[];

  if (!candidates.length) return null;
  candidates.sort((a, b) => a.sortKey - b.sortKey);

  const { sortKey: _, ...best } = candidates[0];
  return best;
}

function formatRemaining(mins: number): string {
  if (mins < 1) return 'Ending now';
  if (mins < 60) return `${mins}m remaining`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m remaining` : `${h}h remaining`;
}

function formatCountdown(mins: number): string {
  if (mins < 1) return 'Starting now';
  if (mins < 60) return `Starts in ${mins}m`;
  if (mins < 24 * 60) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `Starts in ${h}h ${m}m` : `Starts in ${h}h`;
  }
  const days = Math.floor(mins / (24 * 60));
  if (days === 1) return 'Starts tomorrow';
  return `Starts in ${days} days`;
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
  return time;
}

function formatNextClassLabel(info: NextClassInfo | null): string {
  if (!info) return 'None';
  const t = formatTimeOnly(info.entry.startTime);
  const day = info.entry.day?.slice(0, 3) ?? '';
  if (info.status === 'ongoing') return `Now · ${t}`;
  return day ? `${day} ${t}` : t;
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

// For group cards: find the next class for a specific group
function findGroupNextClass(
  allEntries: TimetableEntry[],
  groupId: string,
): string {
  const groupEntries = allEntries.filter(
    (e) =>
      e.groupName === groupId ||
      e.id?.includes(groupId) ||
      e.courseCode === groupId,
  );
  const info = findNextClassInfo(groupEntries);
  if (!info) return 'No upcoming class';
  const t = formatTimeOnly(info.entry.startTime);
  const day = info.entry.day?.slice(0, 3) ?? '';
  if (info.status === 'ongoing') return `🔴 Now · ${info.entry.courseName}`;
  if (info.status === 'justEnded') return `Just ended`;
  return `${day} ${t}`;
}

// ═══════════════════════════════════════════════════════════════
// Status config
// ═══════════════════════════════════════════════════════════════

function getStatusConfig(status: ClassStatus) {
  switch (status) {
    case 'ongoing':
      return {
        label: 'In Progress',
        color: 'var(--primary, #3B82F6)',
        bg: 'var(--primary-soft, rgba(59,130,246,0.12))',
        barColor: '#3B82F6',
        badgeTone: 'info' as const,
        icon: <Radio size={14} />,
        accentGradient:
          'linear-gradient(90deg, #3B82F6, #8B5CF6)',
        pulse: true,
      };
    case 'justEnded':
      return {
        label: 'Just Ended',
        color: 'var(--text-tertiary, #6B7280)',
        bg: 'var(--muted-alpha-10, rgba(107,114,128,0.1))',
        barColor: '#6B7280',
        badgeTone: 'neutral' as const,
        icon: <CheckCircle2 size={14} />,
        accentGradient: 'var(--border)',
        pulse: false,
      };
    case 'upcoming':
    default:
      return {
        label: 'Upcoming',
        color: 'var(--success, #2ECC71)',
        bg: 'var(--success-soft, rgba(46,204,113,0.12))',
        barColor: '#2ECC71',
        badgeTone: 'success' as const,
        icon: <Timer size={14} />,
        accentGradient:
          'linear-gradient(90deg, #2ECC71, #27AE60)',
        pulse: false,
      };
  }
}

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
// Styles
// ═══════════════════════════════════════════════════════════════

const S = {
  sectionHead: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    minWidth: 0,
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
    transition: 'all 0.15s ease',
    textDecoration: 'none',
    color: 'inherit',
    minWidth: 0,
    overflow: 'hidden',
  } as CSSProperties,

  qaIcon: (bg: string, fg: string): CSSProperties => ({
    display: 'grid',
    placeItems: 'center',
    width: 40,
    height: 40,
    borderRadius: 'var(--radius)',
    background: bg,
    color: fg,
    flexShrink: 0,
  }),

  groupCard: {
    display: 'grid',
    gap: 14,
    padding: 16,
    minWidth: 0,
    overflow: 'hidden',
  } as CSSProperties,

  groupTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
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

  empty: {
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

  skelRow: (gap = 12): CSSProperties => ({ display: 'grid', gap }),

  stagger: (i: number): CSSProperties => ({
    animationDelay: `${0.04 + i * 0.04}s`,
  }),

  dot: {
    width: 3,
    height: 3,
    borderRadius: '50%',
    background: 'var(--border)',
    flexShrink: 0,
  } as CSSProperties,
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
// Live group notifications hook
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
    const unsubs: (() => void)[] = [];
    const map = new Map<string, GroupNotification>();

    function broadcast() {
      const sorted = Array.from(map.values()).sort(
        (a, b) => b.timestamp - a.timestamp,
      );
      if (mounted) setNotifs(sorted);
    }

    async function setup() {
      try {
        const snap = await getDocs(collection(db, 'courseGroups'));
        const groups: { id: string; name: string }[] = [];

        snap.docs.forEach((d) => {
          const data = d.data();
          if ((data.members || []).some((m: any) => m.userId === userId)) {
            groups.push({
              id: d.id,
              name: data.groupName || data.courseCode || d.id,
            });
          }
        });

        if (!mounted || !groups.length) {
          if (mounted) setLoading(false);
          return;
        }

        groups.forEach((g) => {
          const q = firestoreQuery(
            collection(db, 'courseGroups', g.id, 'notifications'),
            orderBy('createdAt', 'desc'),
            limit(10),
          );

          unsubs.push(
            onSnapshot(
              q,
              (s) => {
                if (!mounted) return;
                for (const k of map.keys())
                  if (k.startsWith(`${g.id}_`)) map.delete(k);

                s.docs.forEach((d) => {
                  const data = d.data() as Record<string, unknown>;
                  let ts = 0;
                  const raw = data.createdAt ?? data.timestamp;
                  if (typeof raw === 'number') ts = raw;
                  else if (raw && typeof (raw as any).toMillis === 'function')
                    ts = (raw as any).toMillis();
                  else if (raw && typeof (raw as any).seconds === 'number')
                    ts = (raw as any).seconds * 1000;

                  if ((data.expiresAt as number) && (data.expiresAt as number) < Date.now()) return;

                  map.set(`${g.id}_${d.id}`, {
                    id: d.id,
                    title: String(data.title ?? 'Group Update'),
                    content: String(data.content ?? data.message ?? data.body ?? ''),
                    priority: String(data.priority ?? 'low'),
                    type: String(data.type ?? 'update'),
                    timestamp: ts,
                    groupId: g.id,
                    groupName: g.name,
                    senderName: String(data.createdByName ?? data.senderName ?? 'Course Rep'),
                    readBy: (data.readBy as string[]) || [],
                  });
                });
                broadcast();
              },
              (err) => console.warn(`[Home] notif error (${g.id}):`, err),
            ),
          );
        });

        if (mounted) setLoading(false);
      } catch (err) {
        console.error('[Home] notif setup error:', err);
        if (mounted) setLoading(false);
      }
    }

    setup();
    return () => {
      mounted = false;
      unsubs.forEach((u) => { try { u(); } catch {} });
    };
  }, [userId, db]);

  return { notifs, loading };
}

// ═══════════════════════════════════════════════════════════════
// useCurrentTime — re-renders every 30s for live progress
// ═══════════════════════════════════════════════════════════════

function useCurrentTime(intervalMs = 30_000) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
}

// ═══════════════════════════════════════════════════════════════
// Sub-components
// ═══════════════════════════════════════════════════════════════

/* ── Hero Card ─────────────────────────────────────────────── */

function HeroCard({
  classInfo,
  groupCount,
}: {
  classInfo: NextClassInfo | null;
  groupCount: number;
}) {
  const entry = classInfo?.entry;
  const status = classInfo?.status ?? 'none';
  const hasClass = Boolean(entry?.courseName);
  const cfg = getStatusConfig(status === 'none' ? 'upcoming' : status);

  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      {/* Accent stripe — animated for ongoing */}
      <div
        className={status === 'ongoing' ? 'hero-accent--pulse' : ''}
        style={{
          height: 4,
          background: hasClass ? cfg.accentGradient : 'var(--border)',
          transition: 'background 0.6s ease',
        }}
      />

      <div style={{ padding: 'clamp(16px, 4vw, 24px)', display: 'grid', gap: 18 }}>
        {/* ── Top row ──────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
          {/* Icon */}
          <div
            className={status === 'ongoing' ? 'hero-icon--pulse' : ''}
            style={{
              display: 'grid',
              placeItems: 'center',
              width: 48,
              height: 48,
              borderRadius: 'var(--radius-lg)',
              background: hasClass ? cfg.bg : 'var(--primary-soft)',
              color: hasClass ? cfg.color : 'var(--primary)',
              flexShrink: 0,
              transition: 'all 0.4s ease',
            }}
          >
            {status === 'ongoing' ? (
              <Radio size={22} />
            ) : status === 'justEnded' ? (
              <CheckCircle2 size={22} />
            ) : hasClass ? (
              <BookOpen size={22} />
            ) : (
              <CalendarDays size={22} />
            )}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Status + badge row */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 4,
                flexWrap: 'wrap',
              }}
            >
              <p
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: hasClass ? cfg.color : 'var(--text-tertiary)',
                }}
              >
                {hasClass
                  ? status === 'ongoing'
                    ? 'Now in class'
                    : status === 'justEnded'
                    ? 'Just ended'
                    : 'Next class'
                  : 'No upcoming class'}
              </p>
              {hasClass && (
                <Badge tone={cfg.badgeTone} style={{ fontSize: '0.64rem' }}>
                  {cfg.icon}
                  <span style={{ marginLeft: 4 }}>{cfg.label}</span>
                </Badge>
              )}
            </div>

            {/* Course name */}
            <h2
              style={{
                fontSize: 'clamp(1rem, 3vw, 1.4rem)',
                lineHeight: 1.25,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                opacity: status === 'justEnded' ? 0.5 : 1,
                textDecoration: status === 'justEnded' ? 'line-through' : 'none',
                transition: 'opacity 0.4s ease',
              }}
            >
              {entry?.courseName ?? 'Your schedule is clear'}
            </h2>

            {/* ── Meta row with icons ──────────────── */}
            {hasClass && (
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: '4px 14px',
                  fontSize: '0.8rem',
                  color: 'var(--text-secondary)',
                  marginTop: 8,
                }}
              >
                {/* Day */}
                {entry?.day && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <CalendarDays size={13} style={{ color: cfg.color, flexShrink: 0 }} />
                    {entry.day}
                  </span>
                )}

                {/* Time */}
                {entry?.startTime && (
                  <>
                    <span style={S.dot} />
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Clock size={13} style={{ color: cfg.color, flexShrink: 0 }} />
                      {formatTimeOnly(entry.startTime)} – {formatTimeOnly(entry.endTime)}
                    </span>
                  </>
                )}

                {/* Venue */}
                {entry?.venue && (
                  <>
                    <span style={S.dot} />
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: 140,
                      }}
                    >
                      <MapPin size={13} style={{ color: 'var(--warning)', flexShrink: 0 }} />
                      {entry.venue}
                      {entry.building ? `, ${entry.building}` : ''}
                    </span>
                  </>
                )}

                {/* Course code */}
                {entry?.courseCode && (
                  <>
                    <span style={S.dot} />
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <BookOpen size={13} style={{ color: 'var(--secondary)', flexShrink: 0 }} />
                      {entry.courseCode}
                    </span>
                  </>
                )}

                {/* Instructor / Lecturer */}
                {entry?.instructor && (
                  <>
                    <span style={S.dot} />
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: 160,
                      }}
                    >
                      <User size={13} style={{ color: 'var(--secondary)', flexShrink: 0 }} />
                      {entry.instructor}
                    </span>
                  </>
                )}
              </div>
            )}

            {!hasClass && (
              <p
                style={{
                  color: 'var(--text-secondary)',
                  fontSize: '0.86rem',
                  marginTop: 6,
                  lineHeight: 1.6,
                }}
              >
                Join a group with a published schedule to see your next class
                here.
              </p>
            )}
          </div>
        </div>

        {/* ── Progress bar + countdown ─────────────── */}
        {hasClass && classInfo && (
          <div>
            {/* Progress bar */}
            <div
              style={{
                width: '100%',
                height: 6,
                borderRadius: 3,
                background: 'var(--glass, rgba(255,255,255,0.06))',
                overflow: 'hidden',
              }}
            >
              <div
                className={status === 'ongoing' ? 'progress-bar--animate' : ''}
                style={{
                  width: `${classInfo.progressPercent}%`,
                  height: '100%',
                  borderRadius: 3,
                  background: cfg.barColor,
                  transition: 'width 1s ease',
                  minWidth: classInfo.progressPercent > 0 ? 4 : 0,
                }}
              />
            </div>

            {/* Countdown label */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: 6,
                fontSize: '0.74rem',
              }}
            >
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  color: cfg.color,
                  fontWeight: 600,
                }}
              >
                {cfg.icon}
                {classInfo.remainingLabel}
              </span>
              {status === 'ongoing' && (
                <span style={{ color: 'var(--text-tertiary)' }}>
                  {classInfo.progressPercent}% complete
                </span>
              )}
            </div>
          </div>
        )}

        {/* ── Actions ──────────────────────────────── */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, paddingTop: 4 }}>
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

        {/* ── Status bar ──────────────────────────── */}
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

/* ── Quick Action ──────────────────────────────────────────── */

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
      style={{ ...S.quickAction, ...S.stagger(index) }}
      className="qa-link"
    >
      <div style={S.qaIcon(action.bg, action.fg)}>
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
      <ChevronRight size={16} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
    </Link>
  );
}

/* ── Group Card ────────────────────────────────────────────── */

function GroupCard({
  group,
  allEntries,
  index,
}: {
  group: GroupEntry;
  allEntries: TimetableEntry[];
  index: number;
}) {
  const nextLabel = findGroupNextClass(allEntries, group.id);
  const isOngoing = nextLabel.startsWith('🔴');

  return (
    <Card
      className="group-card"
      style={{ ...S.groupCard, ...S.stagger(index) }}
      role="listitem"
    >
      <div style={S.groupTop}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <Badge tone="info" style={{ marginBottom: 8 }}>
            {group.courseCode}
          </Badge>
          <h3
            style={{
              fontSize: '0.95rem',
              marginBottom: 4,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {group.title}
          </h3>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            {group.memberCount} {group.memberCount === 1 ? 'member' : 'members'}
          </p>
        </div>
        <div
          style={{
            display: 'grid',
            placeItems: 'center',
            width: 42,
            height: 42,
            borderRadius: 'var(--radius)',
            background: 'var(--secondary-soft)',
            color: 'var(--secondary)',
            flexShrink: 0,
          }}
        >
          <Users size={18} />
        </div>
      </div>
      <div style={S.groupFooter}>
        <span
          style={{
            fontSize: '0.8rem',
            color: isOngoing ? 'var(--primary)' : 'var(--text-tertiary)',
            fontWeight: isOngoing ? 600 : 400,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
            minWidth: 0,
          }}
        >
          {nextLabel}
        </span>
        <Link
          to={`/groups/${group.id}`}
          className="inline-link"
          style={{ fontSize: '0.84rem', flexShrink: 0 }}
        >
          Open <ChevronRight size={14} />
        </Link>
      </div>
    </Card>
  );
}

/* ── Empty Groups ──────────────────────────────────────────── */

function EmptyGroups({ isAdmin }: { isAdmin: boolean }) {
  return (
    <div style={S.empty} role="status">
      <div style={S.emptyIcon('var(--secondary-soft)', 'var(--secondary)')}>
        <Users size={24} />
      </div>
      <div>
        <h3 style={{ fontSize: '1rem', marginBottom: 6 }}>No groups yet</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', maxWidth: '36ch', lineHeight: 1.6 }}>
          Join a group to see your schedule, classmates, and shared resources.
        </p>
      </div>
      {isAdmin && (
        <Link to="/groups" style={{ marginTop: 4 }}>
          <Button variant="primary" size="sm" leadingIcon={<Sparkles size={16} />}>
            Browse groups
          </Button>
        </Link>
      )}
    </div>
  );
}

/* ── Live Notification Item ────────────────────────────────── */

function LiveNotifItem({
  notif,
  userId,
  isLast,
}: {
  notif: GroupNotification;
  userId: string;
  isLast: boolean;
}) {
  const ps = getPriorityStyle(notif.priority);
  const unread = !notif.readBy?.includes(userId);

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
        minWidth: 0,
      }}
    >
      <div
        style={{
          display: 'grid',
          placeItems: 'center',
          width: 34,
          height: 34,
          borderRadius: 'var(--radius)',
          background: ps.bg,
          color: ps.fg,
          flexShrink: 0,
          marginTop: 2,
          position: 'relative',
        }}
      >
        {getTypeIcon(notif.type)}
        {unread && (
          <div
            style={{
              position: 'absolute',
              top: -3,
              right: -3,
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: ps.accent,
              border: '2px solid var(--surface, #15182B)',
            }}
          />
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            fontSize: '0.86rem',
            fontWeight: 500,
            marginBottom: 2,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            opacity: unread ? 1 : 0.7,
          }}
        >
          {notif.title}
        </p>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap', fontSize: '0.72rem' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
              padding: '1px 6px',
              borderRadius: 4,
              background: 'var(--secondary-soft, rgba(139,92,246,0.1))',
              color: 'var(--secondary, #8B5CF6)',
              fontWeight: 600,
              maxWidth: 120,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            <Users size={9} />
            {notif.groupName}
          </span>
          <span style={S.dot} />
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: 'var(--text-tertiary)', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            <Crown size={9} style={{ color: 'var(--warning, #F59E0B)', flexShrink: 0 }} />
            {notif.senderName}
          </span>
          <span style={S.dot} />
          <span style={{ color: 'var(--text-tertiary)', flexShrink: 0 }}>
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
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      <div className="skeleton" style={{ height: 4, borderRadius: 0 }} />
      <div style={{ padding: 'clamp(16px, 4vw, 24px)', ...S.skelRow(16) }}>
        <div style={{ display: 'flex', gap: 16 }}>
          <div className="skeleton" style={{ width: 48, height: 48, borderRadius: 'var(--radius-lg)', flexShrink: 0 }} />
          <div style={{ ...S.skelRow(10), flex: 1 }}>
            <div className="skeleton" style={{ width: 80, height: 12 }} />
            <div className="skeleton" style={{ width: '75%', height: 22 }} />
            <div className="skeleton" style={{ width: '50%', height: 14 }} />
          </div>
        </div>
        <div className="skeleton" style={{ width: '100%', height: 6, borderRadius: 3 }} />
        <div style={{ display: 'flex', gap: 10 }}>
          <div className="skeleton" style={{ width: 130, height: 38, borderRadius: 'var(--radius)' }} />
        </div>
      </div>
    </Card>
  );
}

function GroupSkeleton() {
  return (
    <Card style={S.groupCard}>
      <div style={S.groupTop}>
        <div style={{ ...S.skelRow(10), flex: 1 }}>
          <div className="skeleton" style={{ width: 55, height: 18, borderRadius: 'var(--radius-full)' }} />
          <div className="skeleton" style={{ width: '80%', height: 16 }} />
          <div className="skeleton" style={{ width: 70, height: 13 }} />
        </div>
        <div className="skeleton" style={{ width: 42, height: 42, borderRadius: 'var(--radius)', flexShrink: 0 }} />
      </div>
    </Card>
  );
}

function LoadingState() {
  return (
    <PageFrame eyebrow="Dashboard" title="Loading your dashboard…">
      <div className="dashboard-grid">
        <HeroSkeleton />
        <div className="stack">
          <div className="stat-grid">
            {[0, 1, 2, 3].map((i) => (
              <Card key={i} className="stat-card">
                <div className="skeleton" style={{ width: 50, height: 11 }} />
                <div className="skeleton" style={{ width: '70%', height: 24 }} />
              </Card>
            ))}
          </div>
        </div>
      </div>
      <section className="section-block">
        <div className="group-grid">
          {[0, 1, 2].map((i) => <GroupSkeleton key={i} />)}
        </div>
      </section>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '24px 0', color: 'var(--text-tertiary)', fontSize: '0.84rem' }}>
        <Loader2 size={16} className="spin" />
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
    timetableError && { label: 'Timetable', msg: timetableError.message },
  ].filter(Boolean) as { label: string; msg: string }[];

  return (
    <PageFrame eyebrow="Dashboard" title="Something went wrong">
      <Card style={{ display: 'grid', gap: 20, maxWidth: 600 }} role="alert">
        <div style={{ display: 'flex', gap: 14 }}>
          <div style={S.emptyIcon('var(--error-soft)', 'var(--error)')}>
            <AlertCircle size={24} />
          </div>
          <div>
            <h3>Connection problem</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: 4 }}>
              Check your connection and try again.
            </p>
          </div>
        </div>
        {errors.length > 0 && (
          <div style={{ padding: '10px 14px', borderRadius: 'var(--radius)', background: 'var(--muted-alpha-10)', fontSize: '0.8rem', display: 'grid', gap: 4 }}>
            {errors.map((e) => (
              <p key={e.label} style={{ color: 'var(--text-secondary)' }}>
                <strong>{e.label}:</strong> {e.msg}
              </p>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: 10 }}>
          <Button variant="primary" size="sm" leadingIcon={<RefreshCw size={15} />} onClick={onRetry}>
            Try again
          </Button>
          <Button variant="ghost" size="sm" onClick={() => window.location.reload()}>
            Reload
          </Button>
        </div>
      </Card>
    </PageFrame>
  );
}

// ═══════════════════════════════════════════════════════════════
// CSS
// ═══════════════════════════════════════════════════════════════

const CSS = `
  *, *::before, *::after { box-sizing: border-box; }

  .dashboard-grid {
    display: grid; gap: 16px; grid-template-columns: 1fr; min-width: 0;
  }
  @media (min-width: 900px) {
    .dashboard-grid { grid-template-columns: 1fr 1fr; gap: 20px; }
  }

  .stat-grid {
    display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; min-width: 0;
  }
  @media (min-width: 900px) {
    .stat-grid { grid-template-columns: repeat(4, 1fr); }
  }

  .group-grid {
    display: grid; grid-template-columns: 1fr; gap: 14px; min-width: 0;
  }
  @media (min-width: 600px) {
    .group-grid { grid-template-columns: repeat(2, 1fr); }
  }
  @media (min-width: 1024px) {
    .group-grid { grid-template-columns: repeat(3, 1fr); }
  }

  .home-bottom {
    display: grid; gap: 16px; grid-template-columns: 1fr; min-width: 0;
  }
  @media (min-width: 768px) {
    .home-bottom { grid-template-columns: 1fr 1fr; gap: 20px; }
  }

  .section-block { display: grid; gap: 14px; min-width: 0; }
  .stack { display: grid; gap: 14px; min-width: 0; }
  .group-card { min-width: 0; overflow: hidden; word-break: break-word; }

  .qa-link:hover {
    border-color: var(--glass-border-hover) !important;
    background: var(--glass-strong) !important;
    transform: translateY(-1px);
  }
  .qa-link:active { transform: scale(0.98); }

  /* ── Hero pulse animation for ongoing class ── */
  @keyframes accentPulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.6; }
  }
  .hero-accent--pulse {
    animation: accentPulse 2s ease-in-out infinite;
  }

  @keyframes iconPulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(59,130,246,0.3); }
    50% { box-shadow: 0 0 0 8px rgba(59,130,246,0); }
  }
  .hero-icon--pulse {
    animation: iconPulse 2s ease-in-out infinite;
  }

  /* ── Progress bar subtle glow ── */
  @keyframes progressGlow {
    0%, 100% { filter: brightness(1); }
    50% { filter: brightness(1.3); }
  }
  .progress-bar--animate {
    animation: progressGlow 3s ease-in-out infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  .spin { animation: spin 700ms linear infinite; }
`;

// ═══════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════

export function HomePage() {
  const userId = useAuthStore((s) => s.session?.user.uid);

  // Re-render every 30s for live progress updates
  useCurrentTime(30_000);

  const profileQ = useQuery({
    queryKey: ['profile', userId],
    queryFn: () => (userId ? fetchCurrentUserProfile(userId) : null),
    enabled: Boolean(userId),
    staleTime: 60_000,
  });

  const groupsQ = useQuery({
    queryKey: ['home-groups', userId],
    queryFn: () => (userId ? fetchUserGroups(userId) : []),
    enabled: Boolean(userId),
    staleTime: 60_000,
    retry: 2,
  });

  const timetableQ = useQuery({
    queryKey: ['home-timetable', userId],
    queryFn: () => (userId ? fetchUserTimetableEntries(userId) : []),
    enabled: Boolean(userId),
    staleTime: 60_000,
    retry: 2,
  });

  const { notifs: liveNotifs, loading: notifsLoading } =
    useGroupNotifications(userId);

  const loading = groupsQ.isLoading || timetableQ.isLoading;
  const errored = groupsQ.isError || timetableQ.isError;

  const groups: GroupEntry[] = useMemo(() => groupsQ.data ?? [], [groupsQ.data]);
  const allEntries: TimetableEntry[] = useMemo(() => timetableQ.data ?? [], [timetableQ.data]);

  // Next class with full status info
  const classInfo = useMemo(() => findNextClassInfo(allEntries), [allEntries]);

  const stats = useMemo(
    () => [
      { label: 'Next class', value: formatNextClassLabel(classInfo), icon: Clock },
      { label: 'Groups', value: `${groups.length}`, icon: Users },
      { label: 'Updates', value: `${liveNotifs.length}`, icon: Bell },
      { label: 'Classes', value: `${allEntries.length}`, icon: BookOpen },
    ],
    [classInfo, groups.length, liveNotifs.length, allEntries.length],
  );

  const retry = useCallback(() => {
    groupsQ.refetch();
    timetableQ.refetch();
  }, [groupsQ, timetableQ]);

  if (loading) return <><style>{CSS}</style><LoadingState /></>;
  if (errored)
    return (
      <>
        <style>{CSS}</style>
        <ErrorState
          groupsError={groupsQ.error instanceof Error ? groupsQ.error : null}
          timetableError={timetableQ.error instanceof Error ? timetableQ.error : null}
          onRetry={retry}
        />
      </>
    );

  const visibleNotifs = liveNotifs.slice(0, 5);

  return (
    <>
      <style>{CSS}</style>

      <div style={{ maxWidth: '100%', overflowX: 'hidden' }}>
        <PageFrame
          id="home-page-frame"
          eyebrow="Dashboard"
          title="Welcome back"
          description="Here's what's happening with your classes and groups today."
        >
          {/* Hero + Stats */}
          <div className="dashboard-grid">
            <HeroCard classInfo={classInfo} groupCount={groups.length} />
            <div className="stack">
              <StatGrid items={stats} />
            </div>
          </div>

          {/* Groups */}
          <section className="section-block" aria-labelledby="home-groups">
            <div style={S.sectionHead}>
              <h2 id="home-groups" style={{ fontSize: '1.1rem' }}>
                Your groups
              </h2>
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
                    (profileQ.data as any)?.isAdmin === true,
                )}
              />
            ) : (
              <div className="group-grid" role="list">
                {groups.slice(0, 3).map((g, i) => (
                  <GroupCard
                    key={g.id}
                    group={g}
                    allEntries={allEntries}
                    index={i}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Quick Actions + Notifications */}
          <div className="home-bottom">
            <section aria-labelledby="home-actions">
              <Card style={{ padding: 'clamp(14px, 3vw, 20px)' }}>
                <div style={{ ...S.sectionHead, marginBottom: 16 }}>
                  <h2
                    id="home-actions"
                    style={{ fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: 8 }}
                  >
                    <Zap size={18} style={{ color: 'var(--warning)', flexShrink: 0 }} />
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

            <section aria-labelledby="home-notifs">
              <Card style={{ padding: 'clamp(14px, 3vw, 20px)' }}>
                <div style={{ ...S.sectionHead, marginBottom: 12 }}>
                  <h2
                    id="home-notifs"
                    style={{ fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: 8 }}
                  >
                    <Bell size={18} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                    Group updates
                    {liveNotifs.length > 0 && (
                      <Badge tone="info" style={{ marginLeft: 4, fontSize: '0.68rem' }}>
                        {liveNotifs.length}
                      </Badge>
                    )}
                  </h2>
                  {liveNotifs.length > 5 && (
                    <Link to="/notifications">
                      <Button variant="ghost" size="sm">See all</Button>
                    </Link>
                  )}
                </div>

                {notifsLoading ? (
                  <div style={{ display: 'grid', gap: 12 }}>
                    {[0, 1, 2].map((i) => (
                      <div key={i} style={{ display: 'flex', gap: 10, padding: '10px 0', borderBottom: i < 2 ? '1px solid var(--divider)' : 'none' }}>
                        <div className="skeleton" style={{ width: 34, height: 34, borderRadius: 'var(--radius)', flexShrink: 0 }} />
                        <div style={{ flex: 1, display: 'grid', gap: 6 }}>
                          <div className="skeleton" style={{ width: '70%', height: 13 }} />
                          <div className="skeleton" style={{ width: '50%', height: 10 }} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : visibleNotifs.length === 0 ? (
                  <div style={{ ...S.empty, padding: '28px 16px' }} role="status">
                    <div style={S.emptyIcon('var(--muted-alpha-10)', 'var(--text-tertiary)')}>
                      <Inbox size={22} />
                    </div>
                    <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)' }}>
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
      </div>
    </>
  );
}