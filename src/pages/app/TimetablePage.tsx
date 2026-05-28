import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  BookOpen,
  CheckCircle2,
  Circle,
  Loader2,
  AlertCircle,
  RefreshCw,
  ArrowRight,
  Timer,
  Coffee,
  GraduationCap,
  List,
  Sun,
  Radio,
  User,
  Grid3X3,
} from 'lucide-react';
import { Badge, Button, Card, Tabs } from '../../components/ui';
import { PageFrame } from '../../components/shared';
import { useAuthStore } from '../../store/useAuthStore';
import { fetchUserTimetableEntries } from '../../lib/studenthubData';
import { useAppStore } from '../../store/useAppStore';
import type { CSSProperties } from 'react';

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

interface TimetableEntry {
  id: string;
  courseCode: string;
  courseName: string;
  groupName?: string;
  day: string;
  dayIndex: number;
  startTime: string;
  endTime: string;
  venue: string;
  instructor?: string;
  building?: string;
  className?: string;
  dayOfWeek?: string;
}

type ClassStatus = 'completed' | 'in-progress' | 'upcoming' | 'next';

interface EnrichedEntry extends TimetableEntry {
  status: ClassStatus;
  progress: number;
  startMinutes: number;
  endMinutes: number;
  durationMinutes: number;
  timeUntilStart: number;
  displayCode: string;
  displayName: string;
}

// ═══════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════

const WEEK_DAYS = [
  { short: 'Mon', full: 'Monday', index: 0 },
  { short: 'Tue', full: 'Tuesday', index: 1 },
  { short: 'Wed', full: 'Wednesday', index: 2 },
  { short: 'Thu', full: 'Thursday', index: 3 },
  { short: 'Fri', full: 'Friday', index: 4 },
  { short: 'Sat', full: 'Saturday', index: 5 },
  { short: 'Sun', full: 'Sunday', index: 6 },
] as const;

// Maps any day name variant to our standard index
const DAY_NAME_MAP: Record<string, number> = {};
WEEK_DAYS.forEach((d) => {
  DAY_NAME_MAP[d.full] = d.index;
  DAY_NAME_MAP[d.full.toLowerCase()] = d.index;
  DAY_NAME_MAP[d.short] = d.index;
  DAY_NAME_MAP[d.short.toLowerCase()] = d.index;
});

function jsDayToIndex(jsDay: number): number {
  return jsDay === 0 ? 6 : jsDay - 1;
}

// ═══════════════════════════════════════════════════════════════
// Time Helpers
// ═══════════════════════════════════════════════════════════════

function parseTimeToMinutes(time: string): number {
  if (!time) return Infinity;
  const m = time.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return Infinity;
  return +m[1] * 60 + +m[2];
}

function formatTimeOnly(time?: string): string {
  if (!time) return '—';
  const m = time.match(/^(\d{1,2}):(\d{2})$/);
  if (m) {
    const d = new Date(2000, 0, 1, +m[1], +m[2]);
    if (!Number.isNaN(d.getTime()))
      return d.toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit',
      });
  }
  return time;
}

function formatDuration(minutes: number): string {
  if (!minutes || minutes <= 0) return '—';
  if (minutes < 60) return `${minutes}min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatTimeUntil(minutes: number): string {
  if (minutes <= 0) return 'Now';
  if (minutes < 60) return `in ${minutes}min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `in ${h}h ${m}m` : `in ${h}h`;
}

function getCurrentMinutes(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

function getTodayIndex(): number {
  return jsDayToIndex(new Date().getDay());
}

// ═══════════════════════════════════════════════════════════════
// Normalize entries — handles field name variations
// from different groups / data sources
// ═══════════════════════════════════════════════════════════════

function normalizeEntry(raw: any): TimetableEntry {
  // Day — could be `day`, `dayOfWeek`, or already correct
  const rawDay =
    raw.day || raw.dayOfWeek || 'Monday';

  // Normalize day string to our standard full name
  const dayStr = String(rawDay).trim();
  const dayIdx = DAY_NAME_MAP[dayStr] ?? DAY_NAME_MAP[dayStr.toLowerCase()] ?? 0;
  const normalizedDay = WEEK_DAYS[dayIdx].full;

  return {
    id: raw.id || `${raw.courseCode}-${raw.startTime}-${dayIdx}`,
    courseCode: raw.courseCode || raw.className || raw.groupName || '',
    courseName:
      raw.courseName || raw.className || raw.courseCode || 'Untitled Class',
    groupName: raw.groupName || '',
    day: normalizedDay,
    dayIndex: raw.dayIndex ?? dayIdx,
    startTime: raw.startTime || '08:00',
    endTime: raw.endTime || '09:00',
    venue: raw.venue || raw.building || '',
    instructor: raw.instructor || '',
    building: raw.building || '',
    className: raw.className || '',
    dayOfWeek: raw.dayOfWeek || normalizedDay,
  };
}

// ═══════════════════════════════════════════════════════════════
// Status & Progress
// ═══════════════════════════════════════════════════════════════

function computeClassStatus(
  startMin: number,
  endMin: number,
  selectedDayIndex: number,
): { status: ClassStatus; progress: number } {
  const todayIndex = getTodayIndex();
  const nowMin = getCurrentMinutes();

  if (selectedDayIndex !== todayIndex) {
    return selectedDayIndex < todayIndex
      ? { status: 'completed', progress: 100 }
      : { status: 'upcoming', progress: 0 };
  }

  if (nowMin >= endMin) return { status: 'completed', progress: 100 };

  if (nowMin >= startMin && nowMin < endMin) {
    const elapsed = nowMin - startMin;
    const duration = endMin - startMin;
    return {
      status: 'in-progress',
      progress: duration > 0 ? Math.round((elapsed / duration) * 100) : 0,
    };
  }

  return { status: 'upcoming', progress: 0 };
}

function enrichEntries(
  entries: TimetableEntry[],
  selectedDayIndex: number,
): EnrichedEntry[] {
  const todayIndex = getTodayIndex();
  const nowMin = getCurrentMinutes();

  const enriched = entries.map((entry) => {
    const startMinutes = parseTimeToMinutes(entry.startTime);
    const endMinutes = parseTimeToMinutes(entry.endTime);
    const durationMinutes =
      endMinutes > startMinutes ? endMinutes - startMinutes : 0;

    const { status, progress } = computeClassStatus(
      startMinutes,
      endMinutes,
      selectedDayIndex,
    );

    let timeUntilStart: number;
    if (selectedDayIndex === todayIndex) {
      timeUntilStart = startMinutes - nowMin;
    } else if (selectedDayIndex > todayIndex) {
      timeUntilStart =
        (selectedDayIndex - todayIndex) * 1440 + (startMinutes - nowMin);
    } else {
      timeUntilStart = -1;
    }

    // Resolve display code — prefer courseCode, fall back to className, groupName
    const displayCode =
      entry.courseCode || entry.className || entry.groupName || '—';
    const displayName =
      entry.courseName || entry.className || entry.courseCode || 'Untitled';

    return {
      ...entry,
      status,
      progress,
      startMinutes,
      endMinutes,
      durationMinutes,
      timeUntilStart,
      displayCode,
      displayName,
    };
  });

  // Sort: in-progress first, then upcoming (mark first as 'next'), then completed
  const order: Record<ClassStatus, number> = {
    'in-progress': 0,
    next: 1,
    upcoming: 2,
    completed: 3,
  };

  enriched.sort((a, b) => {
    const diff = order[a.status] - order[b.status];
    return diff !== 0 ? diff : a.startMinutes - b.startMinutes;
  });

  // Mark the first upcoming entry as 'next'
  const first = enriched.find((e) => e.status === 'upcoming');
  if (first) first.status = 'next';

  return enriched;
}

// ═══════════════════════════════════════════════════════════════
// CSS
// ═══════════════════════════════════════════════════════════════

const TIMETABLE_CSS = `
  /* ── Day Selector ─────────────────────────────────────────── */
  .tt-day-bar {
    display: flex;
    align-items: stretch;
    gap: 4px;
    padding: 6px;
    border-radius: var(--radius-xl, 16px);
    background: var(--bg-muted, rgba(255,255,255,0.03));
    border: 1px solid var(--border);
    overflow-x: auto;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
    min-width: 0;
  }
  .tt-day-bar::-webkit-scrollbar { display: none; }

  .tt-day-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    min-width: 54px;
    flex: 1 1 0%;
    padding: 10px 8px;
    border-radius: var(--radius-lg, 12px);
    border: 1.5px solid transparent;
    background: transparent;
    color: var(--text-secondary);
    cursor: pointer;
    position: relative;
    font-weight: 400;
    transition: all 0.15s ease;
  }
  .tt-day-btn:hover {
    background: var(--bg-card, rgba(255,255,255,0.04));
    color: var(--text-primary);
  }
  .tt-day-btn[data-active="true"] {
    border-color: var(--primary);
    background: var(--bg-card, rgba(255,255,255,0.04));
    color: var(--primary);
    font-weight: 600;
    box-shadow: var(--shadow-sm);
  }
  .tt-day-btn__label {
    font-size: 0.66rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    line-height: 1;
  }
  .tt-day-btn__date {
    font-size: 1.05rem;
    font-weight: 600;
    line-height: 1;
  }
  .tt-day-btn__dot {
    position: absolute;
    bottom: 4px;
    left: 50%;
    transform: translateX(-50%);
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: var(--primary);
  }
  .tt-day-btn__event-dot {
    position: absolute;
    top: 5px;
    right: 5px;
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: var(--primary);
    opacity: 0.5;
  }

  /* ── Class Card ───────────────────────────────────────────── */
  .tt-class-card {
    display: grid;
    gap: 0;
    padding: 0;
    overflow: hidden;
    transition: all 0.15s ease;
    min-width: 0;
  }
  .tt-class-card[data-status="completed"] {
    opacity: 0.5;
  }
  .tt-class-card[data-status="in-progress"] {
    border-color: var(--primary-alpha-25, rgba(59,130,246,0.25));
  }
  .tt-class-card[data-status="next"] {
    border-color: var(--success-alpha-22, rgba(46,204,113,0.22));
  }
  .tt-class-card:hover {
    transform: translateY(-1px);
    box-shadow: var(--shadow-lg);
    opacity: 1 !important;
  }

  .tt-card-inner {
    display: grid;
    gap: 12px;
    padding: 16px;
  }

  .tt-card-top {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    min-width: 0;
  }

  .tt-card-info {
    display: grid;
    gap: 5px;
    flex: 1;
    min-width: 0;
  }

  .tt-card-badges {
    display: flex;
    align-items: center;
    gap: 5px;
    flex-wrap: wrap;
  }

  .tt-card-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 12px;
    font-size: 0.8rem;
    color: var(--text-secondary);
  }

  .tt-meta-item {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 200px;
  }

  .tt-time-col {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 2px;
    flex-shrink: 0;
    text-align: right;
  }

  .tt-time-start {
    font-size: 0.9rem;
    font-weight: 600;
    line-height: 1.2;
    color: var(--text-primary);
  }
  .tt-time-end {
    font-size: 0.74rem;
    color: var(--text-tertiary);
  }
  .tt-time-label {
    font-size: 0.68rem;
    font-weight: 600;
    margin-top: 2px;
  }
  .tt-time-label--live { color: var(--primary); }
  .tt-time-label--next { color: var(--success); }

  /* ── Status Icon ──────────────────────────────────────────── */
  .tt-status-icon {
    display: grid;
    place-items: center;
    width: 38px;
    height: 38px;
    border-radius: var(--radius, 8px);
    flex-shrink: 0;
    transition: all 0.15s ease;
  }
  .tt-status-icon--completed {
    background: var(--success-soft, rgba(46,204,113,0.12));
    color: var(--success, #2ECC71);
  }
  .tt-status-icon--in-progress {
    background: var(--primary-soft, rgba(59,130,246,0.12));
    color: var(--primary, #3B82F6);
  }
  .tt-status-icon--next {
    background: var(--success-soft, rgba(46,204,113,0.12));
    color: var(--success, #2ECC71);
  }
  .tt-status-icon--upcoming {
    background: var(--muted-alpha-10, rgba(107,114,128,0.1));
    color: var(--text-tertiary);
  }

  /* ── Progress Bar ─────────────────────────────────────────── */
  .tt-progress {
    height: 3px;
    background: var(--divider, rgba(255,255,255,0.06));
    overflow: hidden;
    position: relative;
  }
  .tt-progress__fill {
    position: absolute;
    inset: 0;
    transition: width 1s ease;
  }
  .tt-progress__fill--completed { background: var(--success, #2ECC71); }
  .tt-progress__fill--in-progress { background: var(--primary, #3B82F6); }

  /* ── Summary Bar ──────────────────────────────────────────── */
  .tt-summary {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    padding: 10px 14px;
    border-radius: var(--radius-lg, 12px);
    background: var(--bg-muted, rgba(255,255,255,0.03));
    border: 1px solid var(--border);
    font-size: 0.8rem;
    color: var(--text-secondary);
    font-weight: 500;
  }
  .tt-summary__item {
    display: inline-flex;
    align-items: center;
    gap: 5px;
  }
  .tt-summary__item--done { color: var(--success, #2ECC71); }
  .tt-summary__item--live { color: var(--primary, #3B82F6); }

  /* ── Now Indicator ────────────────────────────────────────── */
  .tt-now {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 14px;
    margin: 2px 0;
    border-radius: var(--radius, 8px);
    background: var(--primary-soft, rgba(59,130,246,0.12));
    border: 1px solid var(--primary-alpha-25, rgba(59,130,246,0.25));
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--primary, #3B82F6);
  }
  .tt-now__dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--primary, #3B82F6);
    box-shadow: 0 0 0 3px rgba(59,130,246,0.15);
    animation: pulseDot 2s ease-in-out infinite;
    flex-shrink: 0;
  }

  /* ── Day Navigation ───────────────────────────────────────── */
  .tt-day-nav {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .tt-day-nav__center {
    flex: 1;
    text-align: center;
    min-width: 0;
  }
  .tt-day-nav__title {
    font-size: 1.1rem;
    font-weight: 700;
  }
  .tt-day-nav__today {
    font-size: 0.72rem;
    font-weight: 600;
    color: var(--primary, #3B82F6);
  }

  /* ── Calendar Grid ────────────────────────────────────────── */
  .tt-cal-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 10px;
    min-width: 0;
  }
  @media (max-width: 520px) {
    .tt-cal-grid {
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;
    }
  }

  .tt-cal-day {
    padding: 14px;
    display: grid;
    gap: 8px;
    cursor: pointer;
    transition: all 0.15s ease;
    min-width: 0;
    overflow: hidden;
  }
  .tt-cal-day:hover {
    transform: translateY(-1px);
    box-shadow: var(--shadow-lg);
  }
  .tt-cal-day[data-today="true"] {
    border-color: var(--primary-alpha-25, rgba(59,130,246,0.25));
  }
  .tt-cal-day[data-empty="true"] {
    opacity: 0.55;
  }

  .tt-cal-event {
    display: grid;
    gap: 2px;
    padding: 6px 8px;
    border-radius: 6px;
    background: var(--primary-soft, rgba(59,130,246,0.12));
    font-size: 0.76rem;
    min-width: 0;
    overflow: hidden;
  }
  .tt-cal-event__time {
    font-weight: 600;
    color: var(--primary, #3B82F6);
    font-size: 0.72rem;
  }
  .tt-cal-event__name {
    color: var(--text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 500;
  }
  .tt-cal-event__code {
    color: var(--text-secondary);
    font-size: 0.7rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* ── List View Day Header ─────────────────────────────────── */
  .tt-list-day-head {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 0;
    flex-wrap: wrap;
  }
  .tt-list-day-head h2 {
    font-size: 1.05rem;
    font-weight: 700;
  }
  .tt-list-day-head .muted {
    margin-left: auto;
    font-size: 0.78rem;
  }

  /* ── Empty State ──────────────────────────────────────────── */
  .tt-empty {
    display: grid;
    place-items: center;
    text-align: center;
    padding: 48px 20px;
    gap: 12px;
  }
  .tt-empty__icon {
    display: grid;
    place-items: center;
    width: 52px;
    height: 52px;
    border-radius: var(--radius-lg, 12px);
  }
  .tt-empty__icon--free {
    background: var(--success-soft, rgba(46,204,113,0.12));
    color: var(--success, #2ECC71);
  }
  .tt-empty__icon--none {
    background: var(--muted-alpha-10, rgba(107,114,128,0.1));
    color: var(--text-tertiary);
  }

  /* ── Animations ───────────────────────────────────────────── */
  @keyframes pulseDot {
    0%, 100% { box-shadow: 0 0 0 3px rgba(59,130,246,0.15); }
    50% { box-shadow: 0 0 0 6px rgba(59,130,246,0); }
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* ── Mobile ───────────────────────────────────────────────── */
  @media (max-width: 720px) {
    .tt-day-btn {
      min-width: 44px;
      padding: 8px 6px;
    }
    .tt-day-btn__date { font-size: 0.92rem; }
    .tt-day-btn__label { font-size: 0.6rem; }
    .tt-card-inner { padding: 14px; gap: 10px; }
    .tt-status-icon { width: 34px; height: 34px; }
    .tt-summary { padding: 8px 12px; gap: 8px; font-size: 0.78rem; }
  }

  @media (max-width: 480px) {
    .tt-card-top .tt-status-icon { display: none; }
    .tt-time-col {
      flex-direction: row;
      gap: 6px;
      align-items: center;
    }
    .tt-time-start { font-size: 0.82rem; }
    .tt-card-meta { gap: 3px 8px; font-size: 0.76rem; }
    .tt-meta-item { max-width: 150px; }
    .tt-day-btn { min-width: 38px; padding: 6px 4px; gap: 3px; }
    .tt-day-btn__date { font-size: 0.85rem; }
  }

  @media (hover: none) and (pointer: coarse) {
    .tt-class-card:hover,
    .tt-cal-day:hover { transform: none; }
    .tt-class-card:active { transform: scale(0.98); }
  }
`;

// ═══════════════════════════════════════════════════════════════
// Sub-components
// ═══════════════════════════════════════════════════════════════

function StatusBadge({
  status,
  progress,
}: {
  status: ClassStatus;
  progress: number;
}) {
  switch (status) {
    case 'completed':
      return <Badge tone="success">Done</Badge>;
    case 'in-progress':
      return <Badge tone="warning">{progress}%</Badge>;
    case 'next':
      return <Badge tone="info">Next</Badge>;
    default:
      return <Badge tone="neutral">Upcoming</Badge>;
  }
}

function StatusIcon({ status }: { status: ClassStatus }) {
  return (
    <div className={`tt-status-icon tt-status-icon--${status}`} aria-hidden>
      {status === 'completed' && <CheckCircle2 size={16} />}
      {status === 'in-progress' && <Radio size={16} />}
      {status === 'next' && <ArrowRight size={16} />}
      {status === 'upcoming' && <Circle size={16} />}
    </div>
  );
}

function ProgressBar({
  progress,
  status,
}: {
  progress: number;
  status: ClassStatus;
}) {
  if (status === 'upcoming' || status === 'next') return null;
  const cls =
    status === 'completed'
      ? 'tt-progress__fill--completed'
      : 'tt-progress__fill--in-progress';

  return (
    <div
      className="tt-progress"
      role="progressbar"
      aria-valuenow={progress}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={`tt-progress__fill ${cls}`}
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

function NowIndicator() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="tt-now" role="status" aria-live="polite">
      <div className="tt-now__dot" />
      <span>
        Now —{' '}
        {time.toLocaleTimeString([], {
          hour: 'numeric',
          minute: '2-digit',
        })}
      </span>
    </div>
  );
}

function ClassCard({
  entry,
  index,
}: {
  entry: EnrichedEntry;
  index: number;
}) {
  const isLive = entry.status === 'in-progress';
  const isNext = entry.status === 'next';

  return (
    <Card
      className="tt-class-card"
      data-status={entry.status}
      style={{ animationDelay: `${0.04 + index * 0.04}s` } as CSSProperties}
    >
      <div className="tt-card-inner">
        <div className="tt-card-top">
          <StatusIcon status={entry.status} />

          <div className="tt-card-info">
            <div className="tt-card-badges">
              <Badge tone="info">{entry.displayCode}</Badge>
              <StatusBadge
                status={entry.status}
                progress={entry.progress}
              />
            </div>

            <h3
              style={{
                fontSize: '0.95rem',
                fontWeight: 600,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {entry.displayName}
            </h3>

            <div className="tt-card-meta">
              {entry.venue && (
                <span className="tt-meta-item">
                  <MapPin size={13} style={{ flexShrink: 0 }} />
                  {entry.venue}
                  {entry.building ? `, ${entry.building}` : ''}
                </span>
              )}
              {entry.durationMinutes > 0 && (
                <span className="tt-meta-item">
                  <Clock size={13} style={{ flexShrink: 0 }} />
                  {formatDuration(entry.durationMinutes)}
                </span>
              )}
              {entry.instructor && (
                <span className="tt-meta-item">
                  <GraduationCap size={13} style={{ flexShrink: 0 }} />
                  {entry.instructor}
                </span>
              )}
            </div>
          </div>

          <div className="tt-time-col">
            <span className="tt-time-start">
              {formatTimeOnly(entry.startTime)}
            </span>
            <span className="tt-time-end">
              {formatTimeOnly(entry.endTime)}
            </span>
            {(isLive || isNext) && (
              <span
                className={`tt-time-label ${isLive ? 'tt-time-label--live' : 'tt-time-label--next'}`}
              >
                {isLive
                  ? `${entry.progress}% done`
                  : formatTimeUntil(entry.timeUntilStart)}
              </span>
            )}
          </div>
        </div>
      </div>

      <ProgressBar progress={entry.progress} status={entry.status} />
    </Card>
  );
}

function DaySummary({ entries }: { entries: EnrichedEntry[] }) {
  const completed = entries.filter((e) => e.status === 'completed').length;
  const live = entries.filter((e) => e.status === 'in-progress').length;
  const upcoming = entries.filter(
    (e) => e.status === 'upcoming' || e.status === 'next',
  ).length;
  const totalMin = entries.reduce((s, e) => s + e.durationMinutes, 0);

  return (
    <div className="tt-summary" role="status">
      <span className="tt-summary__item">
        <BookOpen size={13} />
        {entries.length} {entries.length === 1 ? 'class' : 'classes'}
      </span>
      {totalMin > 0 && (
        <span className="tt-summary__item">
          <Clock size={13} />
          {formatDuration(totalMin)}
        </span>
      )}
      {completed > 0 && (
        <span className="tt-summary__item tt-summary__item--done">
          <CheckCircle2 size={13} />
          {completed} done
        </span>
      )}
      {live > 0 && (
        <span className="tt-summary__item tt-summary__item--live">
          <Radio size={13} />
          {live} live
        </span>
      )}
      {upcoming > 0 && (
        <span className="tt-summary__item">
          <Circle size={13} />
          {upcoming} left
        </span>
      )}
    </div>
  );
}

function DaySelector({
  selectedIndex,
  onSelect,
  eventsByDay,
}: {
  selectedIndex: number;
  onSelect: (i: number) => void;
  eventsByDay: Map<string, TimetableEntry[]>;
}) {
  const todayIndex = getTodayIndex();
  const scrollRef = useRef<HTMLDivElement>(null);

  const weekDates = useMemo(() => {
    const now = new Date();
    const jsDay = now.getDay();
    const mondayOffset = jsDay === 0 ? -6 : 1 - jsDay;
    return WEEK_DAYS.map((_, i) => {
      const d = new Date(now);
      d.setDate(now.getDate() + mondayOffset + i);
      return d.getDate();
    });
  }, []);

  useEffect(() => {
    const el = scrollRef.current?.querySelector(
      '[data-active="true"]',
    ) as HTMLElement;
    el?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'center',
    });
  }, [selectedIndex]);

  return (
    <div
      ref={scrollRef}
      className="tt-day-bar"
      role="tablist"
      aria-label="Select day"
    >
      {WEEK_DAYS.map((day, i) => {
        const isActive = selectedIndex === i;
        const isToday = todayIndex === i;
        const count = (eventsByDay.get(day.full) ?? []).length;

        return (
          <button
            key={day.short}
            role="tab"
            className="tt-day-btn"
            aria-selected={isActive}
            data-active={isActive}
            onClick={() => onSelect(i)}
          >
            <span className="tt-day-btn__label">{day.short}</span>
            <span className="tt-day-btn__date">{weekDates[i]}</span>
            {count > 0 && !isActive && (
              <div className="tt-day-btn__event-dot" aria-hidden />
            )}
            {isToday && <div className="tt-day-btn__dot" aria-hidden />}
          </button>
        );
      })}
    </div>
  );
}

function EmptyDayState({ dayName }: { dayName: string }) {
  return (
    <div className="tt-empty" role="status">
      <div className="tt-empty__icon tt-empty__icon--free">
        <Coffee size={24} />
      </div>
      <h3 style={{ fontSize: '1rem' }}>No classes on {dayName}</h3>
      <p
        style={{
          color: 'var(--text-secondary)',
          maxWidth: '34ch',
          fontSize: '0.86rem',
          lineHeight: 1.6,
        }}
      >
        Enjoy your free time! Nothing scheduled for this day.
      </p>
    </div>
  );
}

/* ── Calendar Overview — FIXED course code display ────────── */

function CalendarOverview({
  eventsByDay,
  todayIndex,
  onSelectDay,
}: {
  eventsByDay: Map<string, TimetableEntry[]>;
  todayIndex: number;
  onSelectDay: (i: number) => void;
}) {
  return (
    <div className="tt-cal-grid">
      {WEEK_DAYS.map((day, i) => {
        const events = eventsByDay.get(day.full) ?? [];
        const isToday = todayIndex === i;

        return (
          <Card
            key={day.short}
            className="tt-cal-day"
            data-today={isToday}
            data-empty={events.length === 0}
            onClick={() => onSelectDay(i)}
            role="button"
            tabIndex={0}
            onKeyDown={(e: React.KeyboardEvent) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelectDay(i);
              }
            }}
          >
            {/* Header row */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <strong style={{ fontSize: '0.86rem' }}>{day.short}</strong>
              {isToday && (
                <Badge
                  tone="warning"
                  style={{ fontSize: '0.58rem', padding: '1px 5px' }}
                >
                  Today
                </Badge>
              )}
            </div>

            {events.length === 0 ? (
              <span
                style={{
                  fontSize: '0.76rem',
                  color: 'var(--text-tertiary)',
                }}
              >
                Free day
              </span>
            ) : (
              <>
                <Badge tone="info" style={{ fontSize: '0.68rem' }}>
                  {events.length}{' '}
                  {events.length === 1 ? 'class' : 'classes'}
                </Badge>

                {events.slice(0, 2).map((ev) => {
                  // Use the correct display values
                  const code =
                    ev.courseCode ||
                    ev.className ||
                    ev.groupName ||
                    '—';
                  const name =
                    ev.courseName ||
                    ev.className ||
                    ev.courseCode ||
                    '';

                  return (
                    <div key={ev.id} className="tt-cal-event">
                      <span className="tt-cal-event__time">
                        {formatTimeOnly(ev.startTime)}
                      </span>
                      {name && name !== code && (
                        <span className="tt-cal-event__name">
                          {name}
                        </span>
                      )}
                      <span className="tt-cal-event__code">{code}</span>
                    </div>
                  );
                })}

                {events.length > 2 && (
                  <span
                    style={{
                      fontSize: '0.72rem',
                      color: 'var(--text-tertiary)',
                    }}
                  >
                    +{events.length - 2} more
                  </span>
                )}
              </>
            )}
          </Card>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Skeleton Loaders
// ═══════════════════════════════════════════════════════════════

function DaySelectorSkeleton() {
  return (
    <div className="tt-day-bar" aria-busy="true">
      {Array.from({ length: 7 }).map((_, i) => (
        <div
          key={i}
          className="skeleton"
          style={{
            minWidth: 54,
            flex: '1 1 0%',
            height: 58,
            borderRadius: 'var(--radius-lg, 12px)',
          }}
        />
      ))}
    </div>
  );
}

function CardSkeleton({ index }: { index: number }) {
  return (
    <Card
      className="tt-class-card"
      style={{ animationDelay: `${0.04 + index * 0.04}s` } as CSSProperties}
      aria-busy="true"
    >
      <div className="tt-card-inner">
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div
            className="skeleton"
            style={{ width: 38, height: 38, borderRadius: 'var(--radius)' }}
          />
          <div style={{ flex: 1, display: 'grid', gap: 6 }}>
            <div style={{ display: 'flex', gap: 5 }}>
              <div
                className="skeleton"
                style={{
                  width: 50,
                  height: 18,
                  borderRadius: 'var(--radius-full)',
                }}
              />
              <div
                className="skeleton"
                style={{
                  width: 45,
                  height: 18,
                  borderRadius: 'var(--radius-full)',
                }}
              />
            </div>
            <div className="skeleton" style={{ width: '65%', height: 15 }} />
            <div className="skeleton" style={{ width: '45%', height: 12 }} />
          </div>
          <div style={{ display: 'grid', gap: 3, justifyItems: 'end' }}>
            <div className="skeleton" style={{ width: 50, height: 14 }} />
            <div className="skeleton" style={{ width: 38, height: 11 }} />
          </div>
        </div>
      </div>
      <div className="skeleton" style={{ height: 3, borderRadius: 0 }} />
    </Card>
  );
}

function LoadingState() {
  return (
    <PageFrame eyebrow="Timetable" title="Loading your schedule…">
      <DaySelectorSkeleton />
      <div
        className="skeleton"
        style={{
          width: '100%',
          height: 40,
          borderRadius: 'var(--radius-lg)',
        }}
      />
      <div style={{ display: 'grid', gap: 10 }}>
        {[0, 1, 2, 3].map((i) => (
          <CardSkeleton key={i} index={i} />
        ))}
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          padding: '20px 0',
          color: 'var(--text-tertiary)',
          fontSize: '0.84rem',
        }}
      >
        <Loader2
          size={16}
          style={{ animation: 'spin 700ms linear infinite' }}
        />
        Fetching your schedule…
      </div>
    </PageFrame>
  );
}

function ErrorState({
  error,
  onRetry,
}: {
  error: Error | null;
  onRetry: () => void;
}) {
  return (
    <PageFrame eyebrow="Timetable" title="Something went wrong">
      <Card
        style={{
          display: 'grid',
          gap: 18,
          maxWidth: 600,
        }}
        role="alert"
      >
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <div
            style={{
              display: 'grid',
              placeItems: 'center',
              width: 48,
              height: 48,
              borderRadius: 'var(--radius-lg)',
              background: 'var(--error-soft)',
              color: 'var(--error)',
              flexShrink: 0,
            }}
          >
            <AlertCircle size={22} />
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
              Couldn't load your timetable.
            </p>
            {error && (
              <p
                style={{
                  fontSize: '0.8rem',
                  color: 'var(--text-secondary)',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius)',
                  background: 'var(--muted-alpha-10)',
                }}
              >
                {error.message}
              </p>
            )}
          </div>
        </div>
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
            Reload
          </Button>
        </div>
      </Card>
    </PageFrame>
  );
}

// ═══════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════

export function TimetablePage() {
  const scheduleView = useAppStore((s) => s.scheduleView);
  const setScheduleView = useAppStore((s) => s.setScheduleView);
  const userId = useAuthStore((s) => s.session?.user.uid);

  const [selectedDayIndex, setSelectedDayIndex] = useState(getTodayIndex);

  // Refresh live progress every 30s
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const query = useQuery({
    queryKey: ['timetable', userId],
    queryFn: () =>
      userId ? fetchUserTimetableEntries(userId) : Promise.resolve([]),
    enabled: Boolean(userId),
    staleTime: 60_000,
    retry: 2,
  });

  const retry = useCallback(() => query.refetch(), [query]);

  // ── Normalize raw entries ───────────────────────────────────

  const allEntries: TimetableEntry[] = useMemo(
    () => ((query.data as any[]) ?? []).map(normalizeEntry),
    [query.data],
  );

  // ── Group by day ────────────────────────────────────────────

  const eventsByDay = useMemo(() => {
    const map = new Map<string, TimetableEntry[]>();

    // Initialize all days to ensure consistent ordering
    WEEK_DAYS.forEach((d) => map.set(d.full, []));

    // Sort then bucket
    const sorted = [...allEntries].sort((a, b) =>
      a.dayIndex !== b.dayIndex
        ? a.dayIndex - b.dayIndex
        : parseTimeToMinutes(a.startTime) -
          parseTimeToMinutes(b.startTime),
    );

    for (const e of sorted) {
      const dayKey = e.day; // already normalized by normalizeEntry
      const arr = map.get(dayKey);
      if (arr) arr.push(e);
    }

    return map;
  }, [allEntries]);

  // ── Selected day data ───────────────────────────────────────

  const selectedDay = WEEK_DAYS[selectedDayIndex];
  const todayIndex = getTodayIndex();
  const isToday = selectedDayIndex === todayIndex;

  const dayEntries = useMemo(
    () =>
      enrichEntries(
        eventsByDay.get(selectedDay.full) ?? [],
        selectedDayIndex,
      ),
    [eventsByDay, selectedDay.full, selectedDayIndex],
  );

  const hasLiveClass = dayEntries.some(
    (e) => e.status === 'in-progress',
  );

  const handleDaySelect = useCallback(
    (i: number) => {
      setSelectedDayIndex(i);
      if (scheduleView === 'calendar') setScheduleView('day');
    },
    [scheduleView, setScheduleView],
  );

  const goToToday = useCallback(
    () => setSelectedDayIndex(getTodayIndex()),
    [],
  );

  // ── Guards ──────────────────────────────────────────────────

  if (query.isLoading)
    return (
      <>
        <style>{TIMETABLE_CSS}</style>
        <LoadingState />
      </>
    );

  if (query.isError) {
    return (
      <>
        <style>{TIMETABLE_CSS}</style>
        <ErrorState
          error={
            query.error instanceof Error ? query.error : null
          }
          onRetry={retry}
        />
      </>
    );
  }

  const isEmpty = allEntries.length === 0;

  // ── Render ──────────────────────────────────────────────────

  return (
    <>
      <style>{TIMETABLE_CSS}</style>

      <PageFrame
        eyebrow="Timetable"
        title="Your schedule"
        description="Classes for the week, sorted by time with live progress."
        action={
          !isToday ? (
            <Button
              variant="secondary"
              size="sm"
              leadingIcon={<CalendarDays size={16} />}
              onClick={goToToday}
            >
              Go to today
            </Button>
          ) : undefined
        }
      >
        {/* ── Day Selector ──────────────────────────── */}
        {!isEmpty && (
          <DaySelector
            selectedIndex={selectedDayIndex}
            onSelect={handleDaySelect}
            eventsByDay={eventsByDay}
          />
        )}

        {/* ── View Tabs ─────────────────────────────── */}
        {!isEmpty && (
          <Tabs
            tabs={[
              { id: 'day', label: 'Day' },
              { id: 'list', label: 'All days' },
              { id: 'calendar', label: 'Overview' },
            ]}
            activeId={
              scheduleView === 'week' ? 'day' : scheduleView
            }
            onChange={(v) =>
              setScheduleView(v as 'day' | 'list' | 'calendar')
            }
          />
        )}

        {/* ── Content ───────────────────────────────── */}
        <div role="tabpanel">
          {isEmpty ? (
            <div className="tt-empty" role="status">
              <div className="tt-empty__icon tt-empty__icon--none">
                <BookOpen size={24} />
              </div>
              <h3 style={{ fontSize: '1rem' }}>
                No timetable entries
              </h3>
              <p
                style={{
                  color: 'var(--text-secondary)',
                  maxWidth: '38ch',
                  fontSize: '0.86rem',
                  lineHeight: 1.6,
                }}
              >
                Your schedule will appear here once you join groups
                that have published their timetables.
              </p>
            </div>
          ) : scheduleView === 'calendar' ? (
            <CalendarOverview
              eventsByDay={eventsByDay}
              todayIndex={todayIndex}
              onSelectDay={handleDaySelect}
            />
          ) : scheduleView === 'list' ? (
            <div style={{ display: 'grid', gap: 24 }}>
              {WEEK_DAYS.map((day, idx) => {
                const raw = eventsByDay.get(day.full) ?? [];
                if (raw.length === 0) return null;
                const entries = enrichEntries(raw, idx);

                return (
                  <section
                    key={day.short}
                    style={{ display: 'grid', gap: 10 }}
                  >
                    <div className="tt-list-day-head">
                      <h2>{day.full}</h2>
                      {idx === todayIndex && (
                        <Badge tone="warning">Today</Badge>
                      )}
                      <span className="muted">
                        {entries.length}{' '}
                        {entries.length === 1 ? 'class' : 'classes'}
                      </span>
                    </div>

                    {idx === todayIndex && hasLiveClass && (
                      <NowIndicator />
                    )}

                    {entries.map((e, i) => (
                      <ClassCard key={e.id} entry={e} index={i} />
                    ))}
                  </section>
                );
              })}
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 14 }}>
              {/* Day navigation */}
              <div className="tt-day-nav">
                <button
                  onClick={() =>
                    setSelectedDayIndex(
                      Math.max(0, selectedDayIndex - 1),
                    )
                  }
                  className="icon-button"
                  aria-label="Previous day"
                  disabled={selectedDayIndex === 0}
                  style={{
                    opacity: selectedDayIndex === 0 ? 0.3 : 1,
                  }}
                >
                  <ChevronLeft size={18} />
                </button>

                <div className="tt-day-nav__center">
                  <h2 className="tt-day-nav__title">
                    {selectedDay.full}
                  </h2>
                  {isToday && (
                    <span className="tt-day-nav__today">Today</span>
                  )}
                </div>

                <button
                  onClick={() =>
                    setSelectedDayIndex(
                      Math.min(6, selectedDayIndex + 1),
                    )
                  }
                  className="icon-button"
                  aria-label="Next day"
                  disabled={selectedDayIndex === 6}
                  style={{
                    opacity: selectedDayIndex === 6 ? 0.3 : 1,
                  }}
                >
                  <ChevronRight size={18} />
                </button>
              </div>

              {dayEntries.length === 0 ? (
                <EmptyDayState dayName={selectedDay.full} />
              ) : (
                <>
                  <DaySummary entries={dayEntries} />
                  {isToday && hasLiveClass && <NowIndicator />}

                  <div
                    style={{ display: 'grid', gap: 10 }}
                    role="list"
                  >
                    {dayEntries.map((e, i) => (
                      <div key={e.id} role="listitem">
                        <ClassCard entry={e} index={i} />
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </PageFrame>
    </>
  );
}