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
  LayoutGrid,
  List,
  Sun,
  Bell,
} from 'lucide-react';
import { Badge, Button, Card, Tabs } from '../../components/ui';
import { PageFrame } from '../../components/shared';
import { useAuthStore } from '../../store/useAuthStore';
import { fetchUserTimetableEntries } from '../../lib/studenthubData';
import { useAppStore } from '../../store/useAppStore';
import type { CSSProperties, ReactNode } from 'react';

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

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
}

type ClassStatus = 'completed' | 'in-progress' | 'upcoming' | 'next';

interface EnrichedEntry extends TimetableEntry {
  status: ClassStatus;
  progress: number;
  startMinutes: number;
  endMinutes: number;
  durationMinutes: number;
  timeUntilStart: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════════

const WEEK_DAYS = [
  { short: 'Mon', full: 'Monday', index: 0 },
  { short: 'Tue', full: 'Tuesday', index: 1 },
  { short: 'Wed', full: 'Wednesday', index: 2 },
  { short: 'Thu', full: 'Thursday', index: 3 },
  { short: 'Fri', full: 'Friday', index: 4 },
  { short: 'Sat', full: 'Saturday', index: 5 },
  { short: 'Sun', full: 'Sunday', index: 6 },
] as const;

function jsDayToIndex(jsDay: number): number {
  return jsDay === 0 ? 6 : jsDay - 1;
}

// ═══════════════════════════════════════════════════════════════════════════
// Time Helpers
// ═══════════════════════════════════════════════════════════════════════════

function parseTimeToMinutes(time: string): number {
  const m = time.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return Infinity;
  return +m[1] * 60 + +m[2];
}

function formatTimeOnly(time?: string): string {
  if (!time) return '—';
  const m = time.match(/^(\d{1,2}):(\d{2})$/);
  if (m) {
    const d = new Date(2000, 0, 1, +m[1], +m[2]);
    if (!Number.isNaN(d.getTime()))
      return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  const iso = new Date(time);
  if (!Number.isNaN(iso.getTime()))
    return iso.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return time;
}

function formatDuration(minutes: number): string {
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

// ═══════════════════════════════════════════════════════════════════════════
// Status & Progress
// ═══════════════════════════════════════════════════════════════════════════

function computeClassStatus(
  entry: TimetableEntry,
  selectedDayIndex: number,
): { status: ClassStatus; progress: number } {
  const todayIndex = getTodayIndex();
  const startMin = parseTimeToMinutes(entry.startTime);
  const endMin = parseTimeToMinutes(entry.endTime);
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
    const { status, progress } = computeClassStatus(entry, selectedDayIndex);
    const startMinutes = parseTimeToMinutes(entry.startTime);
    const endMinutes = parseTimeToMinutes(entry.endTime);
    const durationMinutes = endMinutes - startMinutes;

    let timeUntilStart: number;
    if (selectedDayIndex === todayIndex) {
      timeUntilStart = startMinutes - nowMin;
    } else if (selectedDayIndex > todayIndex) {
      timeUntilStart =
        (selectedDayIndex - todayIndex) * 1440 + (startMinutes - nowMin);
    } else {
      timeUntilStart = -1;
    }

    return {
      ...entry,
      status,
      progress,
      startMinutes,
      endMinutes,
      durationMinutes,
      timeUntilStart,
    };
  });

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

  const first = enriched.find((e) => e.status === 'upcoming');
  if (first) first.status = 'next';

  return enriched;
}

// ═══════════════════════════════════════════════════════════════════════════
// Responsive CSS (injected once)
// ═══════════════════════════════════════════════════════════════════════════

const TIMETABLE_CSS = `
  /* ── Day Selector ─────────────────────────────────────────── */
  .tt-day-bar {
    display: flex;
    align-items: stretch;
    gap: 4px;
    padding: 6px;
    border-radius: var(--radius-xl);
    background: var(--bg-muted);
    border: 1px solid var(--border);
    overflow-x: auto;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
  }
  .tt-day-bar::-webkit-scrollbar { display: none; }

  .tt-day-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    min-width: 54px;
    padding: 10px 14px;
    border-radius: var(--radius-lg);
    border: 1.5px solid transparent;
    background: transparent;
    color: var(--text-secondary);
    cursor: pointer;
    position: relative;
    font-weight: 400;
    flex-shrink: 0;
    transition: all var(--duration) var(--ease);
  }
  .tt-day-btn:hover {
    background: var(--bg-card);
    color: var(--text-primary);
  }
  .tt-day-btn[data-active="true"] {
    border-color: var(--primary);
    background: var(--bg-card);
    color: var(--primary);
    font-weight: 600;
    box-shadow: var(--shadow-sm);
  }
  .tt-day-btn__label {
    font-size: 0.68rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    line-height: 1;
  }
  .tt-day-btn__date {
    font-size: 1.1rem;
    font-weight: 600;
    line-height: 1;
  }
  .tt-day-btn__dot {
    position: absolute;
    bottom: 5px;
    left: 50%;
    transform: translateX(-50%);
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: var(--primary);
  }
  .tt-day-btn__event-dot {
    position: absolute;
    top: 6px;
    right: 6px;
    width: 6px;
    height: 6px;
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
    transition: all var(--duration) var(--ease);
  }
  .tt-class-card[data-status="completed"] {
    opacity: 0.55;
  }
  .tt-class-card[data-status="in-progress"] {
    border-color: var(--primary-alpha-25);
  }
  .tt-class-card[data-status="next"] {
    border-color: var(--success-alpha-22);
  }
  .tt-class-card:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-lg);
    opacity: 1 !important;
  }

  .tt-card-inner {
    display: grid;
    gap: 14px;
    padding: 20px;
  }

  .tt-card-top {
    display: flex;
    gap: 14px;
    align-items: flex-start;
  }

  .tt-card-info {
    display: grid;
    gap: 6px;
    flex: 1;
    min-width: 0;
  }

  .tt-card-badges {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }

  .tt-card-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 14px;
    font-size: 0.82rem;
    color: var(--text-secondary);
  }

  .tt-meta-item {
    display: inline-flex;
    align-items: center;
    gap: 5px;
  }

  .tt-time-col {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 3px;
    flex-shrink: 0;
    text-align: right;
  }

  .tt-time-start {
    font-size: 0.92rem;
    font-weight: 600;
    line-height: 1.2;
    color: var(--text-primary);
  }

  .tt-time-end {
    font-size: 0.76rem;
    color: var(--text-tertiary);
  }

  .tt-time-label {
    font-size: 0.7rem;
    font-weight: 600;
    margin-top: 2px;
  }

  .tt-time-label--live { color: var(--primary); }
  .tt-time-label--next { color: var(--success); }

  /* ── Status Icon ──────────────────────────────────────────── */
  .tt-status-icon {
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    border-radius: var(--radius);
    flex-shrink: 0;
    transition: all var(--duration) var(--ease);
  }
  .tt-status-icon--completed {
    background: var(--success-soft);
    color: var(--success);
  }
  .tt-status-icon--in-progress {
    background: var(--primary-soft);
    color: var(--primary);
  }
  .tt-status-icon--next {
    background: var(--success-soft);
    color: var(--success);
  }
  .tt-status-icon--upcoming {
    background: var(--muted-alpha-10);
    color: var(--text-tertiary);
  }

  /* ── Progress Bar ─────────────────────────────────────────── */
  .tt-progress {
    height: 3px;
    background: var(--divider);
    overflow: hidden;
    position: relative;
  }
  .tt-progress__fill {
    position: absolute;
    inset: 0;
    transition: width 1s var(--ease-smooth);
  }
  .tt-progress__fill--completed {
    background: var(--success);
  }
  .tt-progress__fill--in-progress {
    background: var(--primary);
  }

  /* ── Summary Bar ──────────────────────────────────────────── */
  .tt-summary {
    display: flex;
    gap: 14px;
    flex-wrap: wrap;
    padding: 12px 16px;
    border-radius: var(--radius-lg);
    background: var(--bg-muted);
    border: 1px solid var(--border);
    font-size: 0.82rem;
    color: var(--text-secondary);
    font-weight: 500;
  }
  .tt-summary__item {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .tt-summary__item--done { color: var(--success); }
  .tt-summary__item--live { color: var(--primary); }

  /* ── Now Indicator ────────────────────────────────────────── */
  .tt-now {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 14px;
    margin: 4px 0;
    border-radius: var(--radius);
    background: var(--primary-soft);
    border: 1px solid var(--primary-alpha-25);
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--primary);
    animation: fade-in-up var(--duration-slow) var(--ease) both;
  }
  .tt-now__dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--primary);
    box-shadow: 0 0 0 3px var(--primary-alpha-12);
    animation: pulse-dot 2s ease-in-out infinite;
    flex-shrink: 0;
  }

  /* ── Day Navigation ───────────────────────────────────────── */
  .tt-day-nav {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .tt-day-nav__center {
    flex: 1;
    text-align: center;
  }
  .tt-day-nav__title {
    font-size: 1.15rem;
    font-weight: 700;
  }
  .tt-day-nav__today {
    font-size: 0.74rem;
    font-weight: 600;
    color: var(--primary);
  }

  /* ── Calendar Grid ────────────────────────────────────────── */
  .tt-cal-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 12px;
  }

  .tt-cal-day {
    padding: 16px;
    display: grid;
    gap: 10px;
    cursor: pointer;
    transition: all var(--duration) var(--ease);
  }
  .tt-cal-day:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-lg);
    border-color: var(--glass-border-hover);
  }
  .tt-cal-day[data-today="true"] {
    border-color: var(--primary-alpha-25);
  }
  .tt-cal-day[data-empty="true"] {
    opacity: 0.6;
  }

  .tt-cal-event {
    display: grid;
    gap: 3px;
    padding: 8px 10px;
    border-radius: var(--radius-sm);
    background: var(--primary-soft);
    font-size: 0.78rem;
  }
  .tt-cal-event__time {
    font-weight: 600;
    color: var(--primary);
  }
  .tt-cal-event__code {
    color: var(--text-primary);
  }

  /* ── List View Day Header ─────────────────────────────────── */
  .tt-list-day-head {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 4px 0;
  }
  .tt-list-day-head h2 {
    font-size: 1.1rem;
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
    padding: 48px 24px;
    gap: 14px;
  }
  .tt-empty__icon {
    display: grid;
    place-items: center;
    width: 52px;
    height: 52px;
    border-radius: var(--radius-lg);
  }
  .tt-empty__icon--free {
    background: var(--success-soft);
    color: var(--success);
  }
  .tt-empty__icon--none {
    background: var(--muted-alpha-10);
    color: var(--text-tertiary);
  }

  /* ── Mobile tweaks ────────────────────────────────────────── */
  @media (max-width: 720px) {
    .tt-day-btn {
      min-width: 46px;
      padding: 8px 10px;
    }
    .tt-day-btn__date { font-size: 0.95rem; }
    .tt-day-btn__label { font-size: 0.62rem; }

    .tt-card-inner { padding: 16px; gap: 12px; }

    .tt-card-top {
      flex-direction: column;
      gap: 10px;
    }
    .tt-card-top .tt-status-icon { display: none; }
    .tt-time-col {
      flex-direction: row;
      gap: 8px;
      align-items: center;
    }
    .tt-time-start { font-size: 0.84rem; }

    .tt-summary { padding: 10px 14px; gap: 10px; }

    .tt-cal-grid {
      grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      gap: 8px;
    }
    .tt-cal-day { padding: 12px; }
  }

  @media (max-width: 420px) {
    .tt-card-meta { gap: 4px 10px; font-size: 0.78rem; }
    .tt-day-btn { min-width: 40px; padding: 6px 8px; gap: 3px; }
    .tt-day-btn__date { font-size: 0.88rem; }
  }

  /* ── Hover-capable ────────────────────────────────────────── */
  @media (hover: none) and (pointer: coarse) {
    .tt-class-card:hover,
    .tt-cal-day:hover {
      transform: none;
    }
    .tt-class-card:active {
      transform: scale(0.98);
      transition-duration: var(--duration-instant);
    }
  }
`;

// ═══════════════════════════════════════════════════════════════════════════
// Sub-components
// ═══════════════════════════════════════════════════════════════════════════

function StatusBadge({ status, progress }: { status: ClassStatus; progress: number }) {
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
  const cls = `tt-status-icon tt-status-icon--${status}`;
  return (
    <div className={cls} aria-hidden>
      {status === 'completed' && <CheckCircle2 size={18} />}
      {status === 'in-progress' && (
        <Timer size={18} style={{ animation: 'pulse-dot 2s ease-in-out infinite' }} />
      )}
      {status === 'next' && <ArrowRight size={18} />}
      {status === 'upcoming' && <Circle size={18} />}
    </div>
  );
}

function ProgressBar({ progress, status }: { progress: number; status: ClassStatus }) {
  if (status === 'upcoming' || status === 'next') return null;
  const cls = status === 'completed' ? 'tt-progress__fill--completed' : 'tt-progress__fill--in-progress';

  return (
    <div
      className="tt-progress"
      role="progressbar"
      aria-valuenow={progress}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Class progress: ${progress}%`}
    >
      <div className={`tt-progress__fill ${cls}`} style={{ width: `${progress}%` }} />
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
      <span>Now — {time.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
    </div>
  );
}

function ClassCard({ entry, index }: { entry: EnrichedEntry; index: number }) {
  const isLive = entry.status === 'in-progress';
  const isNext = entry.status === 'next';

  return (
    <Card
      className="tt-class-card"
      data-status={entry.status}
      style={{ animationDelay: `${0.04 + index * 0.04}s` } as CSSProperties}
      aria-label={`${entry.courseName}, ${formatTimeOnly(entry.startTime)} to ${formatTimeOnly(entry.endTime)}, ${entry.status}`}
    >
      <div className="tt-card-inner">
        <div className="tt-card-top">
          <StatusIcon status={entry.status} />

          <div className="tt-card-info">
            <div className="tt-card-badges">
              <Badge tone="info">{entry.courseCode || entry.groupName || 'Unknown'}</Badge>
              <StatusBadge status={entry.status} progress={entry.progress} />
            </div>

            <h3 style={{ fontSize: '0.98rem', fontWeight: 600 }}>
              {entry.courseName}
            </h3>

            <div className="tt-card-meta">
              <span className="tt-meta-item">
                <MapPin size={14} aria-hidden />
                {entry.venue || 'TBA'}
              </span>
              <span className="tt-meta-item">
                <Clock size={14} aria-hidden />
                {formatDuration(entry.durationMinutes)}
              </span>
              {entry.instructor && (
                <span className="tt-meta-item">
                  <GraduationCap size={14} aria-hidden />
                  {entry.instructor}
                </span>
              )}
            </div>
          </div>

          <div className="tt-time-col">
            <span className="tt-time-start">{formatTimeOnly(entry.startTime)}</span>
            <span className="tt-time-end">{formatTimeOnly(entry.endTime)}</span>
            {(isLive || isNext) && (
              <span className={`tt-time-label ${isLive ? 'tt-time-label--live' : 'tt-time-label--next'}`}>
                {isLive ? `${entry.progress}% elapsed` : formatTimeUntil(entry.timeUntilStart)}
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
  const upcoming = entries.filter((e) => e.status === 'upcoming' || e.status === 'next').length;
  const totalMin = entries.reduce((s, e) => s + e.durationMinutes, 0);

  return (
    <div className="tt-summary" role="status" aria-label="Day summary">
      <span className="tt-summary__item">
        <BookOpen size={14} />
        {entries.length} {entries.length === 1 ? 'class' : 'classes'}
      </span>
      <span className="tt-summary__item">
        <Clock size={14} />
        {formatDuration(totalMin)}
      </span>
      {completed > 0 && (
        <span className="tt-summary__item tt-summary__item--done">
          <CheckCircle2 size={14} />
          {completed} done
        </span>
      )}
      {live > 0 && (
        <span className="tt-summary__item tt-summary__item--live">
          <Timer size={14} />
          {live} live
        </span>
      )}
      {upcoming > 0 && (
        <span className="tt-summary__item">
          <Circle size={14} />
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
    const el = scrollRef.current?.querySelector('[data-active="true"]') as HTMLElement;
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [selectedIndex]);

  return (
    <div ref={scrollRef} className="tt-day-bar" role="tablist" aria-label="Select day">
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
            aria-label={`${day.full}${isToday ? ' (today)' : ''}, ${count} classes`}
            onClick={() => onSelect(i)}
          >
            <span className="tt-day-btn__label">{day.short}</span>
            <span className="tt-day-btn__date">{weekDates[i]}</span>
            {count > 0 && !isActive && <div className="tt-day-btn__event-dot" aria-hidden />}
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
      <p style={{ color: 'var(--text-secondary)', maxWidth: '34ch', fontSize: '0.88rem', lineHeight: 1.6 }}>
        Enjoy your free time! Nothing scheduled for this day.
      </p>
    </div>
  );
}

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
            aria-label={`${day.full}, ${events.length} classes`}
            onKeyDown={(e: React.KeyboardEvent) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelectDay(i);
              }
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: '0.88rem' }}>{day.short}</strong>
              {isToday && (
                <Badge tone="warning" style={{ fontSize: '0.6rem', padding: '1px 6px' }}>Today</Badge>
              )}
            </div>

            {events.length === 0 ? (
              <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>Free day</span>
            ) : (
              <>
                <Badge tone="info">
                  {events.length} {events.length === 1 ? 'class' : 'classes'}
                </Badge>
                {events.slice(0, 2).map((ev) => (
                  <div key={ev.id} className="tt-cal-event">
                    <span className="tt-cal-event__time">{formatTimeOnly(ev.startTime)}</span>
                    <span className="tt-cal-event__code">{ev.courseCode}</span>
                  </div>
                ))}
                {events.length > 2 && (
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-tertiary)' }}>
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

// ═══════════════════════════════════════════════════════════════════════════
// Skeleton Loaders
// ═══════════════════════════════════════════════════════════════════════════

function DaySelectorSkeleton() {
  return (
    <div className="tt-day-bar" aria-busy="true">
      {Array.from({ length: 7 }).map((_, i) => (
        <div
          key={i}
          className="skeleton"
          style={{ minWidth: 54, height: 62, borderRadius: 'var(--radius-lg)', flexShrink: 0 }}
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
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <div className="skeleton" style={{ width: 40, height: 40, borderRadius: 'var(--radius)' }} />
          <div style={{ flex: 1, display: 'grid', gap: 8 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              <div className="skeleton" style={{ width: 55, height: 18, borderRadius: 'var(--radius-full)' }} />
              <div className="skeleton" style={{ width: 50, height: 18, borderRadius: 'var(--radius-full)' }} />
            </div>
            <div className="skeleton" style={{ width: '70%', height: 16 }} />
            <div className="skeleton" style={{ width: '50%', height: 13 }} />
          </div>
          <div style={{ display: 'grid', gap: 4, justifyItems: 'end' }}>
            <div className="skeleton" style={{ width: 55, height: 15 }} />
            <div className="skeleton" style={{ width: 40, height: 12 }} />
          </div>
        </div>
      </div>
      <div className="skeleton" style={{ height: 3, borderRadius: 0 }} />
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Full-page States
// ═══════════════════════════════════════════════════════════════════════════

function LoadingState() {
  return (
    <PageFrame eyebrow="Timetable" title="Loading your schedule…">
      <DaySelectorSkeleton />
      <div className="skeleton" style={{ width: '100%', height: 42, borderRadius: 'var(--radius-lg)' }} />
      <div style={{ display: 'grid', gap: 10 }}>
        {[0, 1, 2, 3].map((i) => <CardSkeleton key={i} index={i} />)}
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
        role="status"
        aria-live="polite"
      >
        <Loader2 size={16} style={{ animation: 'spin 700ms linear infinite' }} />
        Fetching your schedule…
      </div>
    </PageFrame>
  );
}

function ErrorState({ error, onRetry }: { error: Error | null; onRetry: () => void }) {
  return (
    <PageFrame eyebrow="Timetable" title="Something went wrong">
      <Card
        style={{
          display: 'grid',
          gap: 18,
          borderColor: 'var(--error-alpha-20)',
          background: 'var(--error-alpha-10)',
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
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6 }}>
              Couldn't load your timetable. Check your connection and try again.
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
// Main Component
// ═══════════════════════════════════════════════════════════════════════════

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
    queryFn: () => (userId ? fetchUserTimetableEntries(userId) : Promise.resolve([])),
    enabled: Boolean(userId),
    staleTime: 60_000,
    retry: 2,
    retryDelay: (a: number) => Math.min(1000 * 2 ** a, 8000),
  });

  const retry = useCallback(() => query.refetch(), [query]);

  // ── Derived ─────────────────────────────────────────────────────────────

  const allEntries = (query.data ?? []) as TimetableEntry[];

  const eventsByDay = useMemo(() => {
    const sorted = [...allEntries].sort((a, b) =>
      a.dayIndex !== b.dayIndex
        ? a.dayIndex - b.dayIndex
        : parseTimeToMinutes(a.startTime) - parseTimeToMinutes(b.startTime),
    );
    const map = new Map<string, TimetableEntry[]>();
    for (const e of sorted) {
      if (!map.has(e.day)) map.set(e.day, []);
      map.get(e.day)!.push(e);
    }
    return map;
  }, [allEntries]);

  const selectedDay = WEEK_DAYS[selectedDayIndex];
  const todayIndex = getTodayIndex();
  const isToday = selectedDayIndex === todayIndex;

  const dayEntries = useMemo(
    () => enrichEntries(eventsByDay.get(selectedDay.full) ?? [], selectedDayIndex),
    [eventsByDay, selectedDay.full, selectedDayIndex],
  );

  const hasLiveClass = dayEntries.some((e) => e.status === 'in-progress');

  const handleDaySelect = useCallback(
    (i: number) => {
      setSelectedDayIndex(i);
      if (scheduleView === 'calendar') setScheduleView('day');
    },
    [scheduleView, setScheduleView],
  );

  const goToToday = useCallback(() => setSelectedDayIndex(getTodayIndex()), []);

  // ── Guards ──────────────────────────────────────────────────────────────

  if (query.isLoading) return <><style>{TIMETABLE_CSS}</style><LoadingState /></>;

  if (query.isError) {
    return (
      <>
        <style>{TIMETABLE_CSS}</style>
        <ErrorState error={query.error instanceof Error ? query.error : null} onRetry={retry} />
      </>
    );
  }

  const isEmpty = allEntries.length === 0;

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <>
      <style>{TIMETABLE_CSS}</style>

      <PageFrame
        eyebrow="Timetable"
        title="Your schedule"
        description="Classes for the week, sorted by time with live progress."
        action={
          !isToday ? (
            <Button variant="secondary" size="sm" leadingIcon={<CalendarDays size={16} />} onClick={goToToday}>
              Go to today
            </Button>
          ) : undefined
        }
      >
        {/* ── Day Selector ──────────────────────────────────────── */}
        {!isEmpty && (
          <DaySelector
            selectedIndex={selectedDayIndex}
            onSelect={handleDaySelect}
            eventsByDay={eventsByDay}
          />
        )}

        {/* ── View Tabs ─────────────────────────────────────────── */}
        {!isEmpty && (
          <Tabs
            tabs={[
              { id: 'day', label: 'Day' },
              { id: 'list', label: 'All days' },
              { id: 'calendar', label: 'Overview' },
            ]}
            activeId={scheduleView === 'week' ? 'day' : scheduleView}
            onChange={(v) => setScheduleView(v as 'day' | 'list' | 'calendar')}
          />
        )}

        {/* ── Content ───────────────────────────────────────────── */}
        <div role="tabpanel" aria-label={`${selectedDay.full} schedule`}>
          {isEmpty ? (
            /* ── Empty timetable ──────────────────────────────── */
            <div className="tt-empty" role="status">
              <div className="tt-empty__icon tt-empty__icon--none">
                <BookOpen size={24} />
              </div>
              <h3 style={{ fontSize: '1rem' }}>No timetable entries</h3>
              <p style={{ color: 'var(--text-secondary)', maxWidth: '38ch', fontSize: '0.88rem', lineHeight: 1.6 }}>
                Your schedule will appear here once you join groups that have published their timetables.
              </p>
            </div>
          ) : scheduleView === 'calendar' ? (
            /* ── Calendar View ────────────────────────────────── */
            <CalendarOverview
              eventsByDay={eventsByDay}
              todayIndex={todayIndex}
              onSelectDay={handleDaySelect}
            />
          ) : scheduleView === 'list' ? (
            /* ── List View (all days) ─────────────────────────── */
            <div style={{ display: 'grid', gap: 24 }}>
              {WEEK_DAYS.map((day, idx) => {
                const raw = eventsByDay.get(day.full) ?? [];
                if (raw.length === 0) return null;
                const entries = enrichEntries(raw, idx);

                return (
                  <section key={day.short} style={{ display: 'grid', gap: 10 }} aria-label={`${day.full} classes`}>
                    <div className="tt-list-day-head">
                      <h2>{day.full}</h2>
                      {idx === todayIndex && <Badge tone="warning">Today</Badge>}
                      <span className="muted">
                        {entries.length} {entries.length === 1 ? 'class' : 'classes'}
                      </span>
                    </div>

                    {idx === todayIndex && hasLiveClass && <NowIndicator />}

                    {entries.map((e, i) => (
                      <ClassCard key={e.id} entry={e} index={i} />
                    ))}
                  </section>
                );
              })}
            </div>
          ) : (
            /* ── Day View ─────────────────────────────────────── */
            <div style={{ display: 'grid', gap: 14 }}>
              {/* Day navigation */}
              <div className="tt-day-nav">
                <button
                  onClick={() => setSelectedDayIndex(Math.max(0, selectedDayIndex - 1))}
                  className="icon-button"
                  aria-label="Previous day"
                  disabled={selectedDayIndex === 0}
                  style={{ opacity: selectedDayIndex === 0 ? 0.3 : 1 }}
                >
                  <ChevronLeft size={18} />
                </button>

                <div className="tt-day-nav__center">
                  <h2 className="tt-day-nav__title">{selectedDay.full}</h2>
                  {isToday && <span className="tt-day-nav__today">Today</span>}
                </div>

                <button
                  onClick={() => setSelectedDayIndex(Math.min(6, selectedDayIndex + 1))}
                  className="icon-button"
                  aria-label="Next day"
                  disabled={selectedDayIndex === 6}
                  style={{ opacity: selectedDayIndex === 6 ? 0.3 : 1 }}
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

                  <div style={{ display: 'grid', gap: 10 }} role="list" aria-label={`${selectedDay.full} classes`}>
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