import { CalendarDays, Grid2x2, Home, Menu, MessageCircle, PlusCircle, Settings2, UserCircle2, Bell } from 'lucide-react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { Button } from './ui';
import { useAppStore } from '../store/useAppStore';

const navItems = [
  { to: '/home', label: 'Home', icon: Home },
  { to: '/timetable', label: 'Timetable', icon: CalendarDays },
  { to: '/groups', label: 'Groups', icon: Grid2x2 },
  { to: '/chat', label: 'Messages', icon: MessageCircle },
  { to: '/profile', label: 'Profile', icon: UserCircle2 },
];

const quickLinks = [
  { to: '/notifications', label: 'Activity', icon: Bell },
  { to: '/settings', label: 'Settings', icon: Settings2 },
];

function AppNavLink({ to, label, icon: Icon }: { to: string; label: string; icon: typeof Home }) {
  return (
    <NavLink to={to} className={({ isActive }) => (isActive ? 'nav-link nav-link--active' : 'nav-link')}>
      <Icon size={18} strokeWidth={2.2} />
      <span>{label}</span>
    </NavLink>
  );
}

export function AppShell() {
  const closeSidebar = useAppStore((state) => state.closeSidebar);
  const sidebarOpen = useAppStore((state) => state.sidebarOpen);
  const toggleSidebar = useAppStore((state) => state.toggleSidebar);

  return (
    <div className="app-shell">
      <aside className={sidebarOpen ? 'sidebar sidebar--open' : 'sidebar'}>
        <div className="sidebar__brand">
          <Link to="/home" className="brand-link" onClick={closeSidebar}>
            <span className="brand-link__mark">B</span>
            <span>
              <strong>BU Scheduler</strong>
              <small>Timetable & group management</small>
            </span>
          </Link>
          <Button variant="ghost" size="sm" className="sidebar__close mobile-only" onClick={closeSidebar}>
            ×
          </Button>
        </div>

        <nav className="sidebar__nav" aria-label="Primary navigation">
          {navItems.map((item) => (
            <AppNavLink key={item.to} {...item} />
          ))}
        </nav>

        <div className="sidebar__section">
          <p className="sidebar__label">Quick links</p>
          <div className="sidebar__quick-links">
            {quickLinks.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? 'chip chip--active' : 'chip')}>
                  <Icon size={16} />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </div>
        </div>

        <div className="sidebar__footer">
          <div className="profile-mini">
            <div className="avatar avatar--small">AY</div>
            <div>
              <strong>Amina Yusuf</strong>
              <p>amina.yusuf@studenthub.edu</p>
            </div>
          </div>
        </div>
      </aside>

      <div className="app-shell__content">
        <header className="topbar">
          <button type="button" className="icon-button mobile-only" aria-label="Open navigation" onClick={toggleSidebar}>
            <Menu size={18} />
          </button>
          <Link to="/home" className="topbar__brand">
            <span className="brand-link__mark brand-link__mark--small">B</span>
            <span>BU Scheduler</span>
          </Link>
          <div className="topbar__meta">
            <span className="pill pill--info">5 unread</span>
            <Button variant="secondary" size="sm" leadingIcon={<PlusCircle size={16} />}>
              Add class
            </Button>
            <div className="avatar avatar--small">AY</div>
          </div>
        </header>

        <main className="app-main">
          <Outlet />
        </main>
      </div>

      <nav className="bottom-nav mobile-only" aria-label="Mobile navigation">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? 'bottom-nav__item bottom-nav__item--active' : 'bottom-nav__item')}>
              <Icon size={18} strokeWidth={2.2} />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
