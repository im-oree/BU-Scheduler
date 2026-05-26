import type { ComponentType } from 'react';
import { Suspense, lazy } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/Layout';
import './app.css';

type PageModule = typeof import('./pages/pages');

function lazyNamedPage<Name extends keyof PageModule>(name: Name) {
  return lazy(async () => {
    const module = (await import('./pages/pages')) as PageModule;
    return { default: module[name] as ComponentType };
  });
}

const queryClient = new QueryClient();

const SplashPage = lazyNamedPage('SplashPage');
const LoginPage = lazyNamedPage('LoginPage');
const HomePage = lazyNamedPage('HomePage');
const GroupsPage = lazyNamedPage('GroupsPage');
const GroupDetailPage = lazyNamedPage('GroupDetailPage');
const TimetablePage = lazyNamedPage('TimetablePage');
const EventEditorPage = lazyNamedPage('EventEditorPage');
const BulkImportPage = lazyNamedPage('BulkImportPage');
const MembersPage = lazyNamedPage('MembersPage');
const InvitePage = lazyNamedPage('InvitePage');
const ChatPage = lazyNamedPage('ChatPage');
const ProfilePage = lazyNamedPage('ProfilePage');
const NotificationsPage = lazyNamedPage('NotificationsPage');
const NotFoundPage = lazyNamedPage('NotFoundPage');

function LoadingScreen() {
  return (
    <div className="loading-screen" aria-live="polite" aria-busy="true">
      <div className="spinner" />
      <p>Loading BU Scheduler…</p>
    </div>
  );
}

export default function RootApp() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <Suspense fallback={<LoadingScreen />}>
          <Routes>
            <Route path="/" element={<SplashPage />} />
            <Route path="/auth/login" element={<LoginPage />} />
            <Route path="/invite/:inviteCode" element={<InvitePage />} />
            <Route element={<AppShell />}>
              <Route path="/home" element={<HomePage />} />
              <Route path="/groups" element={<GroupsPage />} />
              <Route path="/groups/:groupId" element={<GroupDetailPage />} />
              <Route path="/groups/:groupId/members" element={<MembersPage />} />
              <Route path="/groups/:groupId/chat" element={<ChatPage />} />
              <Route path="/groups/:groupId/events/new" element={<EventEditorPage />} />
              <Route path="/groups/:groupId/import" element={<BulkImportPage />} />
              <Route path="/events/:eventId/edit" element={<EventEditorPage />} />
              <Route path="/timetable" element={<TimetablePage />} />
              <Route path="/schedule" element={<TimetablePage />} />
              <Route path="/chat" element={<ChatPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/settings" element={<ProfilePage />} />
              <Route path="/notifications" element={<NotificationsPage />} />
              <Route path="/activity" element={<NotificationsPage />} />
              <Route path="/import" element={<BulkImportPage />} />
              <Route path="/" element={<Navigate to="/home" replace />} />
            </Route>
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </Router>
    </QueryClientProvider>
  );
}
