import type { CSSProperties } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Home,
  CalendarDays,
  Grid2x2,
  Bell,
  UserCircle,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useCallback, useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MobileTabConfig {
  to: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
  exactMatch?: boolean;
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const MOBILE_TABS: MobileTabConfig[] = [
  {
    to: '/home',
    label: 'Home',
    icon: Home,
    exactMatch: true,
  },
  {
    to: '/timetable',
    label: 'Schedule',
    icon: CalendarDays,
  },
  {
    to: '/groups',
    label: 'Groups',
    icon: Grid2x2,
  },
  {
    to: '/profile',
    label: 'Profile',
    icon: UserCircle,
  },
];

// ---------------------------------------------------------------------------
// Hook: detect desktop (hide nav at ≥1181px to match your sidebar breakpoint)
// ---------------------------------------------------------------------------

function useIsDesktop(breakpoint = 1181) {
  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(`(min-width: ${breakpoint}px)`).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia(`(min-width: ${breakpoint}px)`);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [breakpoint]);

  return isDesktop;
}

// ---------------------------------------------------------------------------
// Styles (all inline)
// ---------------------------------------------------------------------------

const styles = {
  nav: {
    position: 'fixed',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 40,
    display: 'grid',
    gridTemplateColumns: `repeat(${MOBILE_TABS.length}, minmax(0, 1fr))`,
    alignItems: 'stretch',
    gap: 2,
    width: '100%',
    padding: '8px 8px calc(env(safe-area-inset-bottom, 0px) + 8px)',
    background: 'var(--surface, rgba(255, 255, 255, 0.96))',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    borderTop: '1px solid var(--line, rgba(0, 0, 0, 0.08))',
    boxShadow: '0 -4px 20px rgba(28, 28, 30, 0.06)',
  } as CSSProperties,

  item: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minHeight: 56,
    minWidth: 0,
    padding: '6px 4px',
    borderRadius: 10,
    border: 'none',
    background: 'transparent',
    color: 'var(--muted, #6B7280)',
    fontSize: '0.64rem',
    fontWeight: 500,
    letterSpacing: '0.02em',
    textDecoration: 'none',
    cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
    touchAction: 'manipulation',
    transition: 'color 160ms ease, transform 160ms ease',
    isolation: 'isolate',
  } as CSSProperties,

  itemActive: {
    color: 'var(--tertiary, #5A8A00)',
    fontWeight: 600,
  } as CSSProperties,

  activePill: {
    position: 'absolute',
    inset: 4,
    borderRadius: 10,
    background: 'var(--primary-soft, rgba(124, 181, 24, 0.12))',
    zIndex: -1,
  } as CSSProperties,

  activeDot: {
    position: 'absolute',
    top: 2,
    left: '50%',
    transform: 'translateX(-50%)',
    width: 4,
    height: 4,
    borderRadius: '50%',
    background: 'var(--primary, #7CB518)',
  } as CSSProperties,

  iconWrap: {
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 24,
    height: 24,
    flexShrink: 0,
    lineHeight: 1,
  } as CSSProperties,

  label: {
    fontSize: '0.64rem',
    lineHeight: 1,
    fontWeight: 'inherit',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '100%',
  } as CSSProperties,

  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    minWidth: 16,
    height: 16,
    padding: '0 4px',
    borderRadius: 999,
    background: 'var(--danger, #EF4444)',
    color: '#fff',
    fontSize: '0.58rem',
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '2px solid var(--surface, #FFFFFF)',
    lineHeight: 1,
  } as CSSProperties,
} as const;

// ---------------------------------------------------------------------------
// Tab Item
// ---------------------------------------------------------------------------

function MobileTabItem({
  to,
  label,
  icon: Icon,
  badge,
  exactMatch,
}: MobileTabConfig) {
  const handleClick = useCallback(() => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(8);
    }
  }, []);

  return (
    <NavLink
      to={to}
      end={exactMatch}
      aria-label={badge && badge > 0 ? `${label}, ${badge} unread` : label}
      onClick={handleClick}
      style={({ isActive }) => ({
        ...styles.item,
        ...(isActive ? styles.itemActive : null),
      })}
    >
      {({ isActive }) => (
        <>
          {/* Active background pill */}
          {isActive && <span style={styles.activePill} aria-hidden="true" />}

          {/* Active top dot */}
          {isActive && <span style={styles.activeDot} aria-hidden="true" />}

          {/* Icon */}
          <span style={styles.iconWrap}>
            <Icon size={20} strokeWidth={2} aria-hidden="true" />
            {badge !== undefined && badge > 0 && (
              <span aria-hidden="true" style={styles.badge}>
                {badge > 99 ? '99+' : badge}
              </span>
            )}
          </span>

          {/* Label */}
          <span style={styles.label}>{label}</span>
        </>
      )}
    </NavLink>
  );
}

// ---------------------------------------------------------------------------
// Bottom Nav
// ---------------------------------------------------------------------------

export function BottomNav() {
  const isDesktop = useIsDesktop(1181);

  // Add bottom padding to body so content isn't covered by fixed nav (mobile only)
  useEffect(() => {
    if (isDesktop) {
      document.body.style.paddingBottom = '';
      return;
    }
    document.body.style.paddingBottom =
      'calc(76px + env(safe-area-inset-bottom, 0px))';
    return () => {
      document.body.style.paddingBottom = '';
    };
  }, [isDesktop]);

  if (isDesktop) return null;

  return (
    <nav
      aria-label="Mobile navigation"
      role="navigation"
      style={styles.nav}
    >
      {MOBILE_TABS.map((tab) => (
        <MobileTabItem key={tab.to} {...tab} />
      ))}
    </nav>
  );
}

export default BottomNav;