import type { LucideIcon } from 'lucide-react';
import {
  Bell,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Grid2x2,
  Home,
  LogOut,
  Menu,
  MessageCircle,
  PlusCircle,
  Search,
  Settings2,
  X,
  Users,
  Sparkles,
  UserCircle,
} from 'lucide-react';
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '../store/useAppStore';
import { useAuthStore } from '../store/useAuthStore';
import {
  useEffect,
  useRef,
  useCallback,
  useMemo,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { fetchUserGroups } from '../lib/studenthubData';
import { BottomNav } from './BottomNav';
import { Onboarding } from './Onboarding';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
}

interface GroupData {
  id: string;
  title: string;
  courseCode: string;
  memberCount: number;
  nextClass?: string;
}

// ---------------------------------------------------------------------------
// Nav Configuration
// ---------------------------------------------------------------------------

const primaryNavItems: NavItem[] = [
  { to: '/home', label: 'Home', icon: Home },
  { to: '/timetable', label: 'Timetable', icon: CalendarDays },
  { to: '/groups', label: 'Groups', icon: Grid2x2 },
  { to: '/chat', label: 'Messages', icon: MessageCircle },
];

const secondaryNavItems: NavItem[] = [
  { to: '/notifications', label: 'Notifications', icon: Bell },
  { to: '/settings', label: 'Settings', icon: Settings2 },
];

// ---------------------------------------------------------------------------
// Shell Title Resolver
// ---------------------------------------------------------------------------

const ROUTE_TITLES: Record<string, { title: string; subtitle: string }> = {
  '/home': { title: 'Dashboard', subtitle: 'Your overview' },
  '/app': { title: 'Dashboard', subtitle: 'Your overview' },
  '/timetable': { title: 'Timetable', subtitle: 'Weekly schedule' },
  '/schedule': { title: 'Timetable', subtitle: 'Weekly schedule' },
  '/groups': { title: 'Groups', subtitle: 'All your groups' },
  '/chat': { title: 'Messages', subtitle: 'Conversations' },
  '/notifications': { title: 'Notifications', subtitle: 'Recent activity' },
  '/activity': { title: 'Activity', subtitle: 'Recent updates' },
  '/settings': { title: 'Settings', subtitle: 'Preferences' },
  '/profile': { title: 'Account', subtitle: 'Your profile' },
  '/import': { title: 'Import', subtitle: 'Bulk operations' },
};

const GROUP_ROUTE_PATTERNS: {
  test: (path: string) => boolean;
  result: { title: string; subtitle: string };
}[] = [
  {
    test: (p) => p.endsWith('/members'),
    result: { title: 'Members', subtitle: 'Group management' },
  },
  {
    test: (p) => p.endsWith('/chat'),
    result: { title: 'Group Chat', subtitle: 'Real-time messaging' },
  },
  {
    test: (p) => p.endsWith('/events/new'),
    result: { title: 'Add Class', subtitle: 'Schedule a new session' },
  },
  {
    test: (p) => p.endsWith('/import'),
    result: { title: 'Bulk Import', subtitle: 'Import members from file' },
  },
  {
    test: (p) => p.startsWith('/groups/'),
    result: { title: 'Group Details', subtitle: 'Overview and settings' },
  },
];

function resolveShellTitle(pathname: string): {
  title: string;
  subtitle: string;
} {
  if (pathname.startsWith('/groups/') && pathname !== '/groups') {
    for (const pattern of GROUP_ROUTE_PATTERNS) {
      if (pattern.test(pathname)) return pattern.result;
    }
  }

  return (
    ROUTE_TITLES[pathname] ?? {
      title: 'StudentHub',
      subtitle: 'Timetable workspace',
    }
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getInitials(name?: string | null): string {
  if (!name) return 'BU';
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

// ---------------------------------------------------------------------------
// Hook: detect desktop
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
// Sidebar Overlay
// ---------------------------------------------------------------------------

function SidebarOverlay({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (visible) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      onClick={onClose}
      onKeyDown={(e: ReactKeyboardEvent) => {
        if (e.key === 'Escape') onClose();
      }}
      role="button"
      tabIndex={-1}
      aria-label="Close navigation"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 29,
        background: 'rgba(28, 26, 23, 0.55)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        animation: 'fade-in 0.2s var(--ease) both',
        cursor: 'pointer',
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Sidebar Nav Link
// ---------------------------------------------------------------------------

function SidebarNavLink({
  to,
  label,
  icon: Icon,
  badge,
  onClick,
}: NavItem & { onClick?: () => void }) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) =>
        isActive ? 'nav-link nav-link--active' : 'nav-link'
      }
      aria-label={badge ? `${label}, ${badge} new` : label}
    >
      <Icon size={18} strokeWidth={2} aria-hidden="true" />
      <span>{label}</span>
      {badge !== undefined && badge > 0 && (
        <span
          className="badge badge--danger"
          style={{
            marginLeft: 'auto',
            fontSize: '0.66rem',
            padding: '1px 6px',
            minWidth: 18,
            textAlign: 'center',
          }}
        >
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </NavLink>
  );
}

// ---------------------------------------------------------------------------
// Sidebar Group Card
// ---------------------------------------------------------------------------

function SidebarGroupCard({
  group,
  onClose,
}: {
  group: GroupData;
  onClose: () => void;
}) {
  const groupLinks = useMemo(
    () => [
      {
        to: `/groups/${group.id}`,
        label: 'Overview',
        icon: Sparkles,
      },
      {
        to: `/groups/${group.id}/members`,
        label: 'Members',
        icon: Users,
      },
      {
        to: `/groups/${group.id}/chat`,
        label: 'Chat',
        icon: MessageCircle,
      },
    ],
    [group.id],
  );

  return (
    <div className="sidebar__group-card">
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <div
          className="group-card__icon"
          style={{
            width: 38,
            height: 38,
            borderRadius: 'var(--radius)',
          }}
          aria-hidden="true"
        >
          <Grid2x2 size={16} />
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <strong
            style={{
              fontSize: '0.88rem',
              display: 'block',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {group.title}
          </strong>
          <p
            style={{
              fontSize: '0.76rem',
              marginTop: 2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {group.courseCode} · {group.memberCount}{' '}
            {group.memberCount === 1 ? 'member' : 'members'}
          </p>
        </div>
      </div>

      <div className="sidebar__group-links">
        {groupLinks.map((link) => (
          <Link key={link.to} to={link.to} onClick={onClose}>
            <link.icon size={12} aria-hidden="true" />
            {link.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sidebar Recent Groups
// ---------------------------------------------------------------------------

function SidebarRecentGroups({
  groups,
  onClose,
}: {
  groups: GroupData[];
  onClose: () => void;
}) {
  if (groups.length === 0) {
    return (
      <p
        className="muted"
        style={{
          fontSize: '0.8rem',
          padding: '8px 12px',
        }}
      >
        Join a group to see it here.
      </p>
    );
  }

  return (
    <div className="sidebar__recent-groups" style={{ display: 'grid', gap: 4 }}>
      {groups.slice(0, 4).map((group) => (
        <NavLink
          key={group.id}
          to={`/groups/${group.id}`}
          className={({ isActive }) =>
            isActive ? 'chip chip--active' : 'chip'
          }
          onClick={onClose}
          aria-label={`${group.title} — ${group.courseCode}, ${group.memberCount} members`}
        >
          <Grid2x2 size={14} aria-hidden="true" />
          <span>{group.courseCode}</span>
          <span
            className="muted"
            style={{ fontSize: '0.72rem', marginLeft: 'auto' }}
            aria-hidden="true"
          >
            {group.memberCount}
          </span>
        </NavLink>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// User Profile Footer
// ---------------------------------------------------------------------------

function SidebarProfile({
  name,
  email,
  initials,
}: {
  name: string;
  email: string;
  initials: string;
}) {
  return (
    <div className="sidebar__footer">
      <div className="profile-mini">
        <div className="avatar avatar--small" aria-hidden="true">
          {initials}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <strong
            style={{
              display: 'block',
              fontSize: '0.86rem',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {name}
          </strong>
          <p
            style={{
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {email}
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Account Dropdown
// ---------------------------------------------------------------------------

function AccountDropdown({
  name,
  email,
  initials,
  onSignOut,
}: {
  name: string;
  email: string;
  initials: string;
  onSignOut: () => void;
}) {
  const menuRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        menuRef.current.removeAttribute('open');
      }
    };
    document.addEventListener('click', handler, true);
    return () => document.removeEventListener('click', handler, true);
  }, []);

  useEffect(() => {
    const handler = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape' && menuRef.current?.open) {
        menuRef.current.removeAttribute('open');
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const menuItems = useMemo(
    () => [
      { to: '/profile', label: 'Account', icon: UserCircle },
      { to: '/settings', label: 'Settings', icon: Settings2 },
      { to: '/notifications', label: 'Notifications', icon: Bell },
    ],
    [],
  );

  return (
    <details ref={menuRef} className="topbar__menu">
      <summary
        className="icon-button"
        aria-label="Account menu"
        aria-haspopup="true"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          width: 'auto',
          padding: '0 10px',
        }}
      >
        <div
          className="avatar avatar--tiny"
          style={{
            border: 'none',
            background: 'var(--primary-soft, #F2F8E6)',
            color: 'var(--tertiary, #5A8A00)',
          }}
          aria-hidden="true"
        >
          {initials}
        </div>
        <ChevronDown size={14} aria-hidden="true" />
      </summary>

      <div className="topbar__menu-panel" role="menu" aria-label="Account menu">
        <div
          style={{
            padding: '14px 14px 10px',
            borderBottom: '1px solid var(--line)',
            marginBottom: 4,
          }}
        >
          <strong style={{ fontSize: '0.88rem', display: 'block' }}>
            {name}
          </strong>
          <span
            className="muted"
            style={{ fontSize: '0.78rem', display: 'block', marginTop: 2 }}
          >
            {email}
          </span>
        </div>

        {menuItems.map((item) => (
          <Link key={item.to} to={item.to} role="menuitem">
            <item.icon size={16} aria-hidden="true" />
            <span>{item.label}</span>
          </Link>
        ))}

        <div
          style={{
            borderTop: '1px solid var(--line)',
            marginTop: 4,
            paddingTop: 4,
          }}
        >
          <button
            type="button"
            onClick={onSignOut}
            role="menuitem"
            style={{ color: 'var(--danger)' }}
          >
            <LogOut size={16} aria-hidden="true" />
            <span>Sign out</span>
          </button>
        </div>
      </div>
    </details>
  );
}

// ---------------------------------------------------------------------------
// Notification Bell
// ---------------------------------------------------------------------------

function NotificationBell({ count }: { count: number }) {
  const hasNotifications = count > 0;

  return (
    <Link
      to="/notifications"
      className="icon-button"
      aria-label={
        hasNotifications
          ? `Notifications, ${count} unread`
          : 'Notifications, none unread'
      }
      style={{ position: 'relative' }}
    >
      <Bell size={18} aria-hidden="true" />
      {hasNotifications && (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 7,
            right: 7,
            width: 9,
            height: 9,
            borderRadius: '50%',
            background: 'var(--primary, #7CB518)',
            border: '2px solid var(--surface)',
            animation: 'pulse-dot 2.5s ease-in-out infinite',
          }}
        />
      )}
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Search Bar
// ---------------------------------------------------------------------------

function TopbarSearch() {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="topbar__search">
      <Search size={16} aria-hidden="true" />
      <input
        ref={inputRef}
        type="search"
        placeholder="Search timetable, groups, messages…"
        aria-label="Search timetable and groups"
      />
      <kbd
        aria-hidden="true"
        style={{
          padding: '2px 8px',
          borderRadius: 6,
          background: 'var(--bg-muted)',
          border: '1px solid var(--line)',
          fontSize: '0.68rem',
          color: 'var(--muted)',
          fontFamily: 'inherit',
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
      >
        ⌘K
      </kbd>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Focus Trap Hook
// ---------------------------------------------------------------------------

function useFocusTrap(
  containerRef: React.RefObject<HTMLElement | null>,
  active: boolean,
) {
  useEffect(() => {
    if (!active || !containerRef.current) return;

    const container = containerRef.current;
    const focusableSelector =
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      const focusable = Array.from(
        container.querySelectorAll<HTMLElement>(focusableSelector),
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    container.addEventListener('keydown', handleKeyDown);

    const firstFocusable =
      container.querySelector<HTMLElement>(focusableSelector);
    firstFocusable?.focus();

    return () => container.removeEventListener('keydown', handleKeyDown);
  }, [containerRef, active]);
}

// ---------------------------------------------------------------------------
// Escape Key Hook
// ---------------------------------------------------------------------------

function useEscapeKey(callback: () => void, active: boolean) {
  useEffect(() => {
    if (!active) return;

    const handler = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') callback();
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [callback, active]);
}

// ---------------------------------------------------------------------------
// Main AppShell Component
// ---------------------------------------------------------------------------

export function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const isDesktop = useIsDesktop(1181);

  // --- Store ---
  const sidebarOpen = useAppStore((s) => s.sidebarOpen);
  const closeSidebar = useAppStore((s) => s.closeSidebar);
  const selectedGroupId = useAppStore((s) => s.selectedGroupId);

  const session = useAuthStore((s) => s.session);
  const signOut = useAuthStore((s) => s.signOut);
  const userId = session?.user.uid;

  // --- Refs ---
  const sidebarRef = useRef<HTMLElement>(null);

  // --- Data ---
  const groupsQuery = useQuery({
    queryKey: ['sidebar-groups', userId],
    queryFn: async () => (userId ? fetchUserGroups(userId) : []),
    enabled: Boolean(userId),
    staleTime: 60_000,
    retry: 1,
  });

  const sidebarGroups: GroupData[] = useMemo(
    () => groupsQuery.data ?? [],
    [groupsQuery.data],
  );

  const currentGroup = useMemo(
    () =>
      sidebarGroups.find((g) => g.id === selectedGroupId) ??
      sidebarGroups[0] ??
      null,
    [sidebarGroups, selectedGroupId],
  );

  const notificationCount = 3;

  // --- Derived ---
  const { title: shellTitle, subtitle: shellSubtitle } = useMemo(
    () => resolveShellTitle(location.pathname),
    [location.pathname],
  );

  const userName = session?.user.displayName ?? 'Student';
  const userEmail = session?.user.email ?? 'student@bu.edu';
  const initials = useMemo(
    () => getInitials(session?.user.displayName),
    [session?.user.displayName],
  );

  // --- Effects ---

  useEffect(() => {
    if (!selectedGroupId && sidebarGroups[0]) {
      useAppStore.getState().setSelectedGroupId(sidebarGroups[0].id);
    }
  }, [selectedGroupId, sidebarGroups]);

  useEffect(() => {
    closeSidebar();
  }, [location.pathname, closeSidebar]);

  useFocusTrap(sidebarRef, sidebarOpen);

  useEscapeKey(closeSidebar, sidebarOpen);

  // --- Handlers ---

  const handleSignOut = useCallback(() => {
    signOut();
    closeSidebar();
    navigate('/login', { replace: true });
  }, [signOut, closeSidebar, navigate]);

  const handleSidebarClose = useCallback(() => {
    closeSidebar();
  }, [closeSidebar]);

  const newEventLink = currentGroup
    ? `/groups/${currentGroup.id}/events/new`
    : '/groups';

  return (
    <div className="app-shell">
      {/* ═══════════════════════════════════════════════════════
          SIDEBAR OVERLAY (mobile) — only relevant on desktop now,
          since mobile uses BottomNav. Kept for completeness if
          sidebar is ever toggled on smaller screens.
          ═══════════════════════════════════════════════════════ */}
      <SidebarOverlay visible={sidebarOpen} onClose={handleSidebarClose} />

      {/* ═══════════════════════════════════════════════════════
          SIDEBAR (desktop only)
          ═══════════════════════════════════════════════════════ */}
      {isDesktop && (
        <aside
          ref={sidebarRef}
          className={sidebarOpen ? 'sidebar sidebar--open' : 'sidebar'}
          aria-label="Main navigation"
        >
          {/* ── Brand ── */}
          <div className="sidebar__brand">
            <Link
              to="/home"
              className="brand-link"
              onClick={handleSidebarClose}
              aria-label="StudentHub — Go to dashboard"
            >
              <span className="brand-link__mark" aria-hidden="true">
                S
              </span>
              <span>
                <strong>StudentHub</strong>
                <small>Timetable workspace</small>
              </span>
            </Link>
          </div>

          {/* ── Primary Nav ── */}
          <nav className="sidebar__nav" aria-label="Primary navigation">
            <p className="sidebar__label" id="nav-primary-label">
              Navigation
            </p>
            <div role="list" aria-labelledby="nav-primary-label">
              {primaryNavItems.map((item) => (
                <div role="listitem" key={item.to}>
                  <SidebarNavLink
                    {...item}
                    badge={
                      item.to === '/notifications'
                        ? notificationCount
                        : undefined
                    }
                    onClick={handleSidebarClose}
                  />
                </div>
              ))}
            </div>

            <p
              className="sidebar__label"
              id="nav-secondary-label"
              style={{ marginTop: 8 }}
            >
              System
            </p>
            <div role="list" aria-labelledby="nav-secondary-label">
              {secondaryNavItems.map((item) => (
                <div role="listitem" key={item.to}>
                  <SidebarNavLink
                    {...item}
                    badge={
                      item.to === '/notifications'
                        ? notificationCount
                        : undefined
                    }
                    onClick={handleSidebarClose}
                  />
                </div>
              ))}
            </div>
          </nav>

          {/* ── Current Group Context ── */}
          {currentGroup && (
            <div className="sidebar__section">
              <p className="sidebar__label">Current group</p>
              <SidebarGroupCard
                group={currentGroup}
                onClose={handleSidebarClose}
              />
            </div>
          )}

          {/* ── Recent Groups ── */}
          <div className="sidebar__section">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <p className="sidebar__label" style={{ margin: 0 }}>
                Recent groups
              </p>
              {sidebarGroups.length > 4 && (
                <Link
                  to="/groups"
                  onClick={handleSidebarClose}
                  className="inline-link"
                  style={{ fontSize: '0.72rem' }}
                >
                  All
                  <ChevronRight size={12} aria-hidden="true" />
                </Link>
              )}
            </div>
            <SidebarRecentGroups
              groups={sidebarGroups}
              onClose={handleSidebarClose}
            />
          </div>

          {/* ── Profile Footer ── */}
          <SidebarProfile
            name={userName}
            email={userEmail}
            initials={initials}
          />
        </aside>
      )}

      {/* ═══════════════════════════════════════════════════════
          MAIN CONTENT AREA
          ═══════════════════════════════════════════════════════ */}
      <div className="app-shell__content">
        {/* ── Top Bar (desktop only) ── */}
        {isDesktop && (
          <header className="topbar" role="banner">
            <div className="topbar__left">
              {/* Brand + Title */}
              <Link
                to="/home"
                className="topbar__brand"
                aria-label="StudentHub — Go to dashboard"
              >
                <span
                  className="brand-link__mark brand-link__mark--small"
                  aria-hidden="true"
                >
                  S
                </span>
                <span className="topbar__title-group">
                  <strong>{shellTitle}</strong>
                  <small>{shellSubtitle}</small>
                </span>
              </Link>
            </div>

            {/* Search */}
            <TopbarSearch />

            {/* Right actions */}
            <div className="topbar__meta">
              {/* Quick add button */}
              <Link
                to={newEventLink}
                className="button button--primary button--sm topbar__action"
                style={{ gap: 8 }}
                aria-label="Add new class"
              >
                <PlusCircle size={16} aria-hidden="true" />
                <span>Add class</span>
              </Link>

              {/* Notifications */}
              <NotificationBell count={notificationCount} />

              {/* Account dropdown */}
              <AccountDropdown
                name={userName}
                email={userEmail}
                initials={initials}
                onSignOut={handleSignOut}
              />
            </div>
          </header>
        )}

        {/* ── Page Content ── */}
        <main className="app-main" id="main-content">
          <Outlet />
        </main>
      </div>

      {/* ═══════════════════════════════════════════════════════
          BOTTOM NAVIGATION (mobile only — handled inside BottomNav)
          ═══════════════════════════════════════════════════════ */}
      <BottomNav />
      <Onboarding />
    </div>
  );
}