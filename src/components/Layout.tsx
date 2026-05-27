import type { LucideIcon } from 'lucide-react';
import {
  Bell,
  CalendarDays,
  ChevronDown,
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
  Clock,
  Sparkles,
  UserCircle
} from 'lucide-react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { useAuthStore } from '../store/useAuthStore';
import { groups as mockGroups } from '../data/mockData';
import { useEffect, useRef, useCallback } from 'react';

/* ═══════════════════════════════════════════════════════════════
   NAV CONFIG
   ═══════════════════════════════════════════════════════════════ */

const navItems: { to: string; label: string; icon: LucideIcon }[] = [
  { to: '/home', label: 'Home', icon: Home },
  { to: '/timetable', label: 'Timetable', icon: CalendarDays },
  { to: '/groups', label: 'Groups', icon: Grid2x2 },
  { to: '/chat', label: 'Messages', icon: MessageCircle },
  { to: '/notifications', label: 'Notifications', icon: Bell },
  { to: '/settings', label: 'Settings', icon: Settings2 },
];

const mobileTabs: { to: string; label: string; icon: LucideIcon; isAction?: boolean }[] = [
  { to: '/home', label: 'Home', icon: Home },
  { to: '/timetable', label: 'Schedule', icon: CalendarDays },
  { to: '/groups/grp_100/events/new', label: 'New', icon: PlusCircle, isAction: true },
  { to: '/groups', label: 'Groups', icon: Grid2x2 },
  { to: '/settings', label: 'More', icon: Settings2 },
];

/* ═══════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════ */

function resolveShellTitle(pathname: string): { title: string; subtitle: string } {
  if (pathname.startsWith('/groups/') && pathname.endsWith('/members')) {
    return { title: 'Members', subtitle: 'Group management' };
  }
  if (pathname.startsWith('/groups/') && pathname.endsWith('/chat')) {
    return { title: 'Group Chat', subtitle: 'Real-time messaging' };
  }
  if (pathname.startsWith('/groups/') && pathname.endsWith('/events/new')) {
    return { title: 'Add Class', subtitle: 'Schedule a new session' };
  }
  if (pathname.startsWith('/groups/') && pathname.endsWith('/import')) {
    return { title: 'Bulk Import', subtitle: 'Import members from file' };
  }
  if (pathname.startsWith('/groups/')) {
    return { title: 'Group Details', subtitle: 'Overview and settings' };
  }

  const map: Record<string, { title: string; subtitle: string }> = {
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

  return map[pathname] ?? { title: 'BU Scheduler', subtitle: 'Timetable workspace' };
}

function getInitials(name?: string): string {
  if (!name) return 'BU';
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

/* ═══════════════════════════════════════════════════════════════
   SIDEBAR NAV LINK
   ═══════════════════════════════════════════════════════════════ */

function SidebarNavLink({
  to,
  label,
  icon: Icon,
  onClick,
}: {
  to: string;
  label: string;
  icon: LucideIcon;
  onClick?: () => void;
}) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) =>
        isActive ? 'nav-link nav-link--active' : 'nav-link'
      }
    >
      <Icon size={18} strokeWidth={2} />
      <span>{label}</span>
    </NavLink>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MOBILE BOTTOM TAB
   ═══════════════════════════════════════════════════════════════ */

function MobileTab({
  to,
  label,
  icon: Icon,
  isAction,
}: {
  to: string;
  label: string;
  icon: LucideIcon;
  isAction?: boolean;
}) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => {
        if (isAction) return 'bottom-nav__item bottom-nav__item--action';
        return isActive
          ? 'bottom-nav__item bottom-nav__item--active'
          : 'bottom-nav__item';
      }}
    >
      <Icon size={isAction ? 22 : 20} strokeWidth={isAction ? 2.4 : 2} />
      <span>{label}</span>
    </NavLink>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SIDEBAR OVERLAY (mobile)
   ═══════════════════════════════════════════════════════════════ */

function SidebarOverlay({ visible, onClick }: { visible: boolean; onClick: () => void }) {
  if (!visible) return null;

  return (
    <div
      className="sidebar-overlay"
      onClick={onClick}
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 29,
        background: 'rgba(2, 6, 23, 0.6)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        animation: 'fade-in 0.2s ease both',
      }}
    />
  );
}

/* ═══════════════════════════════════════════════════════════════
   APP SHELL
   ═══════════════════════════════════════════════════════════════ */

export function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();

  const sidebarOpen = useAppStore((s) => s.sidebarOpen);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);
  const closeSidebar = useAppStore((s) => s.closeSidebar);
  const selectedGroupId = useAppStore((s) => s.selectedGroupId);

  const session = useAuthStore((s) => s.session);
  const signOut = useAuthStore((s) => s.signOut);

  const sidebarRef = useRef<HTMLElement>(null);
  const menuRef = useRef<HTMLDetailsElement>(null);

  const currentGroup =
    mockGroups.find((g) => g.id === selectedGroupId) ?? mockGroups[0];

  const { title: shellTitle, subtitle: shellSubtitle } = resolveShellTitle(
    location.pathname,
  );

  const initials = getInitials(session?.user.displayName);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    closeSidebar();
  }, [location.pathname, closeSidebar]);

  // Close dropdown menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        menuRef.current.removeAttribute('open');
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  const handleSignOut = useCallback(() => {
    signOut();
    closeSidebar();
    navigate('/login', { replace: true });
  }, [signOut, closeSidebar, navigate]);

  return (
    <div className="app-shell">
      {/* ─── Sidebar overlay (mobile) ─── */}
      <SidebarOverlay visible={sidebarOpen} onClick={closeSidebar} />

      {/* ─── Sidebar ─── */}
      <aside
        ref={sidebarRef}
        className={sidebarOpen ? 'sidebar sidebar--open' : 'sidebar'}
        aria-label="Main navigation"
      >
        {/* Brand */}
        <div className="sidebar__brand">
          <Link to="/home" className="brand-link" onClick={closeSidebar}>
            <span className="brand-link__mark">B</span>
            <span>
              <strong>BU Scheduler</strong>
              <small>Timetable workspace</small>
            </span>
          </Link>

          {/* Mobile close button inside sidebar */}
          <button
            type="button"
            className="icon-button mobile-only"
            aria-label="Close navigation"
            onClick={closeSidebar}
            style={{ marginLeft: 'auto' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Primary nav */}
        <nav className="sidebar__nav" aria-label="Primary">
          <p className="sidebar__label">Navigation</p>
          {navItems.map((item) => (
            <SidebarNavLink
              key={item.to}
              to={item.to}
              label={item.label}
              icon={item.icon}
              onClick={closeSidebar}
            />
          ))}
        </nav>

        {/* Current group context */}
        <div className="sidebar__section">
          <p className="sidebar__label">Current group</p>
          <div className="sidebar__group-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div className="group-card__icon" style={{ width: 38, height: 38, borderRadius: 12 }}>
                <Grid2x2 size={16} />
              </div>
              <div>
                <strong style={{ fontSize: '0.9rem' }}>{currentGroup.title}</strong>
                <p style={{ fontSize: '0.78rem', marginTop: 2 }}>
                  {currentGroup.courseCode} · {currentGroup.memberCount} members
                </p>
              </div>
            </div>

            <div className="sidebar__group-links">
              <Link to={`/groups/${currentGroup.id}`} onClick={closeSidebar}>
                <Sparkles size={12} /> Overview
              </Link>
              <Link to={`/groups/${currentGroup.id}/members`} onClick={closeSidebar}>
                <Users size={12} /> Members
              </Link>
              <Link to={`/groups/${currentGroup.id}/chat`} onClick={closeSidebar}>
                <MessageCircle size={12} /> Chat
              </Link>
            </div>
          </div>
        </div>

        {/* Recent groups */}
        <div className="sidebar__section">
          <p className="sidebar__label">Recent groups</p>
          <div className="sidebar__recent-groups" style={{ display: 'grid', gap: 4 }}>
            {mockGroups.slice(0, 3).map((group) => (
              <NavLink
                key={group.id}
                to={`/groups/${group.id}`}
                className={({ isActive }) =>
                  isActive ? 'chip chip--active' : 'chip'
                }
                onClick={closeSidebar}
              >
                <Grid2x2 size={14} />
                <span>{group.courseCode}</span>
                <span
                  className="muted"
                  style={{ fontSize: '0.72rem', marginLeft: 'auto' }}
                >
                  {group.memberCount}
                </span>
              </NavLink>
            ))}
          </div>
        </div>

        {/* Footer / profile */}
        <div className="sidebar__footer">
          <div className="profile-mini">
            <div className="avatar avatar--small">{initials}</div>
            <div style={{ minWidth: 0 }}>
              <strong style={{ display: 'block', fontSize: '0.88rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {session?.user.displayName ?? 'Student'}
              </strong>
              <p style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {session?.user.email ?? 'student@bu.edu'}
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* ─── Main content area ─── */}
      <div className="app-shell__content">
        {/* Top bar */}
        <header className="topbar">
          <div className="topbar__left">
            <button
              type="button"
              className="icon-button mobile-only"
              aria-label="Open navigation"
              onClick={toggleSidebar}
            >
              <Menu size={18} />
            </button>

            <Link to="/home" className="topbar__brand">
              <span className="brand-link__mark brand-link__mark--small">B</span>
              <span className="topbar__title-group">
                <strong>{shellTitle}</strong>
                <small>{shellSubtitle}</small>
              </span>
            </Link>
          </div>

          {/* Search */}
          <div className="topbar__search">
            <Search size={16} />
            <input
              type="search"
              placeholder="Search timetable, groups, messages…"
              aria-label="Search timetable and groups"
            />
            <kbd
              style={{
                padding: '2px 8px',
                borderRadius: 6,
                background: 'rgba(148,163,184,0.1)',
                border: '1px solid rgba(148,163,184,0.15)',
                fontSize: '0.68rem',
                color: '#64748b',
                fontFamily: 'inherit',
                whiteSpace: 'nowrap',
              }}
            >
              ⌘K
            </kbd>
          </div>

          {/* Right actions */}
          <div className="topbar__meta">
            {/* Quick add */}
            <Link
              to={`/groups/${currentGroup.id}/events/new`}
              className="button button--primary button--sm topbar__action"
              style={{ gap: 8 }}
            >
              <PlusCircle size={16} />
              <span>Add class</span>
            </Link>

            {/* Notifications */}
            <Link
              to="/notifications"
              className="icon-button"
              aria-label="Notifications"
              style={{ position: 'relative' }}
            >
              <Bell size={18} />
              {/* Notification dot */}
              <span
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: '#16a34a',
                  border: '2px solid var(--bg)',
                  animation: 'pulse-dot 2.5s ease-in-out infinite',
                }}
              />
            </Link>

            {/* Account dropdown */}
            <details ref={menuRef} className="topbar__menu">
              <summary
                className="icon-button"
                aria-label="Account menu"
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
                  style={{ border: 'none', background: 'rgba(22,163,74,0.15)', color: '#86efac' }}
                >
                  {initials}
                </div>
                <ChevronDown size={14} />
              </summary>

              <div className="topbar__menu-panel">
                <div
                  style={{
                    padding: '12px 12px 8px',
                    borderBottom: '1px solid rgba(148,163,184,0.08)',
                    marginBottom: 4,
                  }}
                >
                  <strong style={{ fontSize: '0.88rem', display: 'block' }}>
                    {session?.user.displayName ?? 'Student'}
                  </strong>
                  <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                    {session?.user.email ?? 'student@bu.edu'}
                  </span>
                </div>

                <Link to="/profile">
                  <UserCircle size={16} />
                  <span>Account</span>
                </Link>
                <Link to="/settings">
                  <Settings2 size={16} />
                  <span>Settings</span>
                </Link>
                <Link to="/notifications">
                  <Bell size={16} />
                  <span>Notifications</span>
                </Link>

                <div
                  style={{
                    borderTop: '1px solid rgba(148,163,184,0.08)',
                    marginTop: 4,
                    paddingTop: 4,
                  }}
                >
                  <button type="button" onClick={handleSignOut} style={{ color: '#fca5a5' }}>
                    <LogOut size={16} />
                    <span>Sign out</span>
                  </button>
                </div>
              </div>
            </details>
          </div>
        </header>

        {/* Page content */}
        <main className="app-main">
          <Outlet />
        </main>
      </div>

      {/* ─── Bottom navigation (mobile) ─── */}
      <nav className="bottom-nav mobile-only" aria-label="Mobile navigation">
        {mobileTabs.map((tab) => (
          <MobileTab
            key={tab.to}
            to={tab.to}
            label={tab.label}
            icon={tab.icon}
            isAction={tab.isAction}
          />
        ))}
      </nav>
    </div>
  );
}