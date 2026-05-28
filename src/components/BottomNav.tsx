import type { LucideIcon } from 'lucide-react';
import {
  Home,
  CalendarDays,
  Grid2x2,
  Bell,
  UserCircle,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useCallback } from 'react';

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
// Config — 4 tabs, no center action button
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
    to: '/notifications',
    label: 'Alerts',
    icon: Bell,
  },
  {
    to: '/profile',
    label: 'Profile',
    icon: UserCircle,
  },
];

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
    if ('vibrate' in navigator) {
      navigator.vibrate(8);
    }
  }, []);

  return (
    <NavLink
      to={to}
      end={exactMatch}
      aria-label={badge && badge > 0 ? `${label}, ${badge} unread` : label}
      onClick={handleClick}
      className={({ isActive }) =>
        isActive
          ? 'bottom-nav__item bottom-nav__item--active'
          : 'bottom-nav__item'
      }
    >
      <span>
        <Icon size={20} strokeWidth={2} aria-hidden="true" />
        {badge !== undefined && badge > 0 && (
          <span
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: -3,
              right: -8,
              minWidth: 16,
              height: 16,
              padding: '0 4px',
              borderRadius: 'var(--radius-full)',
              background: 'var(--danger)',
              color: '#fff',
              fontSize: '0.58rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid var(--bg)',
              lineHeight: 1,
              animation: 'scale-in var(--duration) var(--ease-spring) both',
            }}
          >
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </span>
      <span>{label}</span>
    </NavLink>
  );
}

// ---------------------------------------------------------------------------
// Bottom Nav
// ---------------------------------------------------------------------------

export function BottomNav() {
  return (
    <nav
      className="bottom-nav mobile-only"
      aria-label="Mobile navigation"
      role="navigation"
    >
      {MOBILE_TABS.map((tab) => (
        <MobileTabItem key={tab.to} {...tab} />
      ))}
    </nav>
  );
}

export default BottomNav;