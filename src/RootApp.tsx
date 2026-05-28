import type { ComponentType } from 'react';
import { Suspense, lazy, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter as Router, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { AppShell } from './components/Layout';
import { LoadingScreen } from './components/LoadingScreen';
import { normalizeReturnTo } from './lib/auth';
import { useAuthStore } from './store/useAuthStore';
import './app.css';

type PageModule = typeof import('./pages');

function lazyNamedPage<Name extends keyof PageModule>(name: Name) {
  return lazy(async () => {
    const module = (await import('./pages')) as PageModule;
    return { default: module[name] as ComponentType };
  });
}

const queryClient = new QueryClient();

const LoginPage = lazyNamedPage('LoginPage');
const AuthCallbackPage = lazyNamedPage('AuthCallbackPage');
const StudentHubAuthPage = lazyNamedPage('StudentHubAuthPage');
const HomePage = lazyNamedPage('HomePage');
const GroupsPage = lazyNamedPage('GroupsPage');
const GroupCreatePage = lazyNamedPage('GroupCreatePage');
const GroupDetailPage = lazyNamedPage('GroupDetailPage');
const GroupManagementPage = lazyNamedPage('GroupManagementPage');
const TimetablePage = lazyNamedPage('TimetablePage');
const EventEditorPage = lazyNamedPage('EventEditorPage');
const AnnouncementEditorPage = lazyNamedPage('AnnouncementEditorPage');
const BulkImportPage = lazyNamedPage('BulkImportPage');
const MembersPage = lazyNamedPage('MembersPage');
const InvitePage = lazyNamedPage('InvitePage');
const ChatPage = lazyNamedPage('ChatPage');
const ProfilePage = lazyNamedPage('ProfilePage');
const NotificationsPage = lazyNamedPage('NotificationsPage');
const NotFoundPage = lazyNamedPage('NotFoundPage');
const HelpPage = lazyNamedPage('ProfilePage');
const SignOutPage = lazyNamedPage('SignOutPage');



function AuthBootstrap() {
  const bootstrap = useAuthStore((state) => state.bootstrap);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === 'bu-scheduler.session') {
        bootstrap();
      }
    };

    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [bootstrap]);

  return null;
}

function AuthRouteGate() {
  const status = useAuthStore((state) => state.status);
  const session = useAuthStore((state) => state.session);
  const location = useLocation();

  if (status === 'loading') {
    return <LoadingScreen />;
  }

  if (status !== 'authenticated') {
    return <Navigate to={`/login?returnTo=${encodeURIComponent(location.pathname + location.search + location.hash)}`} replace />;
  }

  const returnTo = normalizeReturnTo(session?.returnTo ?? '/home');
  if (location.pathname === '/' || location.pathname === '/login' || location.pathname === '/auth/login') {
    return <Navigate to={returnTo} replace />;
  }

  return <Outlet />;
}

function PublicLandingRedirect() {
  const status = useAuthStore((state) => state.status);
  const session = useAuthStore((state) => state.session);

  if (status === 'loading') {
    return <LoadingScreen />;
  }

  if (status === 'authenticated') {
    return <Navigate to={normalizeReturnTo(session?.returnTo ?? '/home')} replace />;
  }

  return <Navigate to="/login" replace />;
}

function LegacyFirebaseLoginRedirect() {
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const redirectTo = params.get('redirect_to') ?? params.get('redirectTo');

    if (redirectTo) {
      window.location.replace(redirectTo);
      return;
    }

    window.location.replace('/login');
  }, [location.search]);

  return <LoadingScreen />;
}

export default function RootApp() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <AuthBootstrap />
        <Suspense fallback={<LoadingScreen />}>
          <Routes>
            <Route path="/" element={<PublicLandingRedirect />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/auth/login" element={<LoginPage />} />
            <Route path="/auth/firebase-login" element={<LegacyFirebaseLoginRedirect />} />
            <Route path="/auth/callback" element={<AuthCallbackPage />} />
            <Route path="/auth/studenthub" element={<StudentHubAuthPage />} />
            <Route path="/invite/:inviteCode" element={<InvitePage />} />
            <Route element={<AuthRouteGate />}>
              <Route element={<AppShell />}>
                <Route path="/app" element={<Navigate to="/home" replace />} />
                <Route path="/home" element={<HomePage />} />
                <Route path="/groups" element={<GroupsPage />} />
                <Route path="/groups/new" element={<GroupCreatePage />} />
                <Route path="/groups/:groupId" element={<GroupDetailPage />} />
                <Route path="/groups/:groupId/manage" element={<GroupManagementPage />} />
                <Route path="/groups/:groupId/members" element={<MembersPage />} />
                <Route path="/groups/:groupId/chat" element={<ChatPage />} />
                <Route path="/groups/:groupId/events/new" element={<EventEditorPage />} />
                <Route path="/groups/:groupId/announcements/new" element={<AnnouncementEditorPage />} />
                <Route path="/groups/:groupId/import" element={<BulkImportPage />} />
                <Route path="/events/:eventId/edit" element={<EventEditorPage />} />
                <Route path="/timetable" element={<TimetablePage />} />
                <Route path="/schedule" element={<TimetablePage />} />
                <Route path="/chat" element={<ChatPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/settings" element={<ProfilePage />} />
                <Route path="/help" element={<HelpPage />} />
                <Route path="/sign-out" element={<SignOutPage />} />
                <Route path="/notifications" element={<NotificationsPage />} />
                <Route path="/activity" element={<NotificationsPage />} />
                <Route path="/import" element={<BulkImportPage />} />
                <Route path="/" element={<Navigate to="/home" replace />} />
              </Route>
            </Route>
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </Router>
    </QueryClientProvider>
  );
}
