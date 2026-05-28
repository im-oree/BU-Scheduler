// src/pages/notifications/NotificationsPage.tsx
// BU Scheduler — Notifications Page
// React Query + onSnapshot + studenthubData + dismiss/mark-read

import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  collection,
  deleteDoc,
  doc,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query as firestoreQuery,
  where,
} from 'firebase/firestore';
import {
  AlertTriangle,
  Bell,
  BellOff,
  CheckCircle2,
  ChevronRight,
  Filter,
  Info,
  Loader2,
  RefreshCw,
  Search,
  Trash2,
  XCircle,
} from 'lucide-react';

import { Badge, Button, Card, EmptyState, Input, Select } from '../../components/ui';
import { PageFrame, CheckMark, AlertMark } from '../../components/shared';
import { useAuthStore } from '../../store/useAuthStore';
import {
  fetchNotifications,
  type StudentHubNotification,
} from '../../lib/studenthubData';
import { getFirebaseApp } from '../../lib/firebase';

// ─── Types ────────────────────────────────────────────────────────────────────

type FilterTone = 'all' | 'success' | 'warning' | 'danger' | 'info';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getRelativeTime(timeStr: string): string {
  if (!timeStr) return '';
  const d = new Date(timeStr);
  if (isNaN(d.getTime())) return timeStr;
  const mins = Math.floor((Date.now() - d.getTime()) / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function toneIcon(tone: string) {
  switch (tone) {
    case 'success':
      return <CheckMark />;
    case 'warning':
      return <AlertMark />;
    case 'danger':
      return <XCircle size={20} />;
    default:
      return <Info size={20} />;
  }
}

function toneBadge(tone: string): 'success' | 'warning' | 'danger' | 'info' {
  if (tone === 'success') return 'success';
  if (tone === 'warning') return 'warning';
  if (tone === 'danger') return 'danger';
  return 'info';
}

// ─── Component ────────────────────────────────────────────────────────────────

export function NotificationsPage() {
  const userId = useAuthStore((s) => s.session?.user.uid);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const db = getFirestore(getFirebaseApp());

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [toneFilter, setToneFilter] = useState<FilterTone>('all');

  // Dismissed (session-local)
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  // Live notifications
  const [liveNotifs, setLiveNotifs] = useState<StudentHubNotification[] | null>(
    null,
  );

  // ─── React Query ────────────────────────────────────────────────────────

  const notifsQuery = useQuery({
    queryKey: ['notifications', userId],
    queryFn: () => (userId ? fetchNotifications(userId) : []),
    enabled: Boolean(userId),
    staleTime: 30_000,
  });

  // ─── Real-time: user notifications ──────────────────────────────────────

  useEffect(() => {
    if (!userId) return;

    // Listen to notifications where recipientId or userId matches
    const q = firestoreQuery(
      collection(db, 'notifications'),
      where('recipientId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(100),
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const items: StudentHubNotification[] = snap.docs.map((d) => {
          const data = d.data() as Record<string, unknown>;
          const time =
            String(data.createdAt ?? data.timestamp ?? '').slice(0, 16) ||
            String(data.time ?? 'Recently');
          return {
            id: d.id,
            title: String(data.title ?? 'Notification'),
            detail: String(data.body ?? data.detail ?? ''),
            time,
            tone: (String(data.tone ?? 'info') as StudentHubNotification['tone']) || 'info',
          };
        });
        setLiveNotifs(items);
        queryClient.setQueryData(['notifications', userId], items);
      },
      (err) => console.warn('[BUScheduler] notifications listener:', err),
    );

    return unsub;
  }, [userId, db, queryClient]);

  // ─── Derived ────────────────────────────────────────────────────────────

  const allNotifs: StudentHubNotification[] =
    liveNotifs ?? notifsQuery.data ?? [];

  const filteredNotifs = useMemo(() => {
    let list = allNotifs.filter((n) => !dismissedIds.has(n.id));

    if (toneFilter !== 'all') {
      list = list.filter((n) => n.tone === toneFilter);
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          n.detail.toLowerCase().includes(q),
      );
    }

    return list;
  }, [allNotifs, dismissedIds, toneFilter, searchTerm]);

  const toneCounts = useMemo(() => {
    const counts = { all: 0, success: 0, warning: 0, danger: 0, info: 0 };
    allNotifs
      .filter((n) => !dismissedIds.has(n.id))
      .forEach((n) => {
        counts.all++;
        if (n.tone in counts) counts[n.tone as keyof typeof counts]++;
      });
    return counts;
  }, [allNotifs, dismissedIds]);

  // ─── Actions ────────────────────────────────────────────────────────────

  function handleDismiss(id: string) {
    setDismissedIds((prev) => new Set([...prev, id]));
  }

  function handleDismissAll() {
    if (!window.confirm('Dismiss all notifications?')) return;
    const ids = new Set(filteredNotifs.map((n) => n.id));
    setDismissedIds((prev) => new Set([...prev, ...ids]));
  }

  async function handleDeleteNotification(id: string) {
    if (!window.confirm('Permanently delete this notification?')) return;
    try {
      await deleteDoc(doc(db, 'notifications', id));
      handleDismiss(id);
    } catch (err) {
      console.error('[BUScheduler] delete notification:', err);
    }
  }

  // ─── Loading ────────────────────────────────────────────────────────────

  if (notifsQuery.isLoading && !liveNotifs) {
    return (
      <PageFrame eyebrow="Activity" title="Notifications and updates">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            padding: '60px 0',
            color: 'var(--text-tertiary)',
            fontSize: '0.84rem',
          }}
        >
          <Loader2 size={16} style={{ animation: 'spin 700ms linear infinite' }} />
          Loading notifications…
        </div>
      </PageFrame>
    );
  }

  // ─── Error ──────────────────────────────────────────────────────────────

  if (notifsQuery.isError) {
    return (
      <PageFrame eyebrow="Activity" title="Notifications and updates">
        <EmptyState
          title="Failed to load notifications"
          description="Please check your connection and try again."
          action={
            <Button
              variant="primary"
              leadingIcon={<RefreshCw size={16} />}
              onClick={() => void notifsQuery.refetch()}
            >
              Retry
            </Button>
          }
        />
      </PageFrame>
    );
  }

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <PageFrame
      eyebrow="Activity"
      title="Notifications and updates"
      description="Recent state changes, reminders, and group activity."
      action={
        <div style={{ display: 'flex', gap: 8 }}>
          {filteredNotifs.length > 0 && (
            <Button
              variant="secondary"
              leadingIcon={<CheckCircle2 size={16} />}
              onClick={handleDismissAll}
            >
              Dismiss all
            </Button>
          )}
          <Button
            variant="ghost"
            leadingIcon={<RefreshCw size={16} />}
            onClick={() => void notifsQuery.refetch()}
          >
            Refresh
          </Button>
        </div>
      }
    >
      {/* ── Filters ─────────────────────────────────────────────────── */}
      <Card>
        <div className="search-bar" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <Input
              label="Search"
              placeholder="Search notifications…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div style={{ minWidth: 140 }}>
            <Select
              label="Filter by type"
              value={toneFilter}
              onChange={(e) => setToneFilter(e.target.value as FilterTone)}
            >
              <option value="all">All ({toneCounts.all})</option>
              <option value="info">Info ({toneCounts.info})</option>
              <option value="success">Success ({toneCounts.success})</option>
              <option value="warning">Warning ({toneCounts.warning})</option>
              <option value="danger">Urgent ({toneCounts.danger})</option>
            </Select>
          </div>
        </div>

        {/* Summary badges */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
          <Badge tone="neutral">
            {filteredNotifs.length} notification
            {filteredNotifs.length !== 1 ? 's' : ''}
          </Badge>
          {dismissedIds.size > 0 && (
            <Badge tone="success">
              {dismissedIds.size} dismissed
            </Badge>
          )}
        </div>
      </Card>

      {/* ── Notification list ───────────────────────────────────────── */}
      {filteredNotifs.length === 0 ? (
        <EmptyState
          title={
            searchTerm || toneFilter !== 'all'
              ? 'No notifications match'
              : "You're all caught up!"
          }
          description={
            searchTerm || toneFilter !== 'all'
              ? 'Try different search terms or clear the filter.'
              : 'New notifications will appear here as they come in.'
          }
          icon={<BellOff size={20} />}
          action={
            (searchTerm || toneFilter !== 'all') ? (
              <Button
                variant="ghost"
                onClick={() => {
                  setSearchTerm('');
                  setToneFilter('all');
                }}
              >
                Clear filters
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="notification-list" style={{ display: 'grid', gap: 8 }}>
          {filteredNotifs.map((notification) => (
            <Card
              key={notification.id}
              className="notification-list__item"
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 14,
                padding: '16px 18px',
                position: 'relative',
              }}
            >
              {/* Icon */}
              <div
                style={{
                  display: 'grid',
                  placeItems: 'center',
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  flexShrink: 0,
                  marginTop: 2,
                  background:
                    notification.tone === 'success'
                      ? 'var(--success-soft, rgba(46,204,113,0.12))'
                      : notification.tone === 'warning'
                      ? 'var(--warning-soft, rgba(245,158,11,0.12))'
                      : notification.tone === 'danger'
                      ? 'var(--error-soft, rgba(231,76,60,0.12))'
                      : 'var(--primary-soft, rgba(59,130,246,0.12))',
                  color:
                    notification.tone === 'success'
                      ? 'var(--success, #2ECC71)'
                      : notification.tone === 'warning'
                      ? 'var(--warning, #F59E0B)'
                      : notification.tone === 'danger'
                      ? 'var(--error, #E74C3C)'
                      : 'var(--primary, #3B82F6)',
                }}
              >
                {toneIcon(notification.tone)}
              </div>

              {/* Body */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 4,
                  }}
                >
                  <strong
                    style={{
                      fontSize: '0.88rem',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {notification.title}
                  </strong>
                  <Badge tone={toneBadge(notification.tone)} style={{ flexShrink: 0 }}>
                    {notification.tone}
                  </Badge>
                </div>
                <p
                  className="muted"
                  style={{
                    fontSize: '0.82rem',
                    lineHeight: 1.5,
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical' as const,
                    overflow: 'hidden',
                  }}
                >
                  {notification.detail}
                </p>
                <span
                  className="muted"
                  style={{ fontSize: '0.74rem', marginTop: 6, display: 'block' }}
                >
                  {getRelativeTime(notification.time)}
                </span>
              </div>

              {/* Actions */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  flexShrink: 0,
                  marginTop: 2,
                }}
              >
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDismiss(notification.id)}
                  title="Dismiss"
                >
                  <CheckCircle2 size={14} />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void handleDeleteNotification(notification.id)}
                  title="Delete permanently"
                  style={{ color: 'var(--color-danger)' }}
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </PageFrame>
  );
}

export default NotificationsPage;