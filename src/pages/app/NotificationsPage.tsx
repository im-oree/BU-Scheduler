// src/pages/notifications/NotificationsPage.tsx
// BU Scheduler — All Group Notifications Combined
// Fetches from courseGroups/{groupId}/notifications subcollections

import { useEffect, useMemo, useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query as firestoreQuery,
} from 'firebase/firestore';
import {
  Bell,
  BellOff,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Trash2,
  Users,
  XCircle,
  AlertTriangle,
  Crown,
  Clock,
  Info,
  Megaphone,
  Zap,
  AlertCircle,
} from 'lucide-react';

import { Badge, Button, Card, EmptyState, Input, Select } from '../../components/ui';
import { PageFrame } from '../../components/shared';
import { useAuthStore } from '../../store/useAuthStore';
import { getFirebaseApp } from '../../lib/firebase';

// ─── Types ────────────────────────────────────────────────────

interface GroupNotification {
  id: string;
  title: string;
  content: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  type: 'announcement' | 'reminder' | 'alert' | 'update';
  timestamp: number;
  read: boolean;
  // Group context
  groupId: string;
  groupName: string;
  // Sender context
  senderName: string;
  senderId: string;
  // Optional
  readBy?: string[];
  expiresAt?: number;
}

type FilterType = 'all' | 'unread' | 'urgent' | 'important' | 'info';

// ─── Helpers ──────────────────────────────────────────────────

function timeAgo(timestamp: number): string {
  if (!timestamp) return '';
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 5) return 'Just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return new Date(timestamp).toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
  });
}

function getFullTimestamp(ts: number): string {
  if (!ts) return '';
  return new Date(ts).toLocaleString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getPriorityStyle(priority: string) {
  switch (priority) {
    case 'urgent':
      return {
        bg: 'var(--error-soft, rgba(231,76,60,0.12))',
        fg: 'var(--error, #E74C3C)',
        label: 'Urgent',
        icon: '🚨',
      };
    case 'high':
      return {
        bg: 'var(--warning-soft, rgba(245,158,11,0.12))',
        fg: 'var(--warning, #F59E0B)',
        label: 'Important',
        icon: '⚡',
      };
    case 'medium':
      return {
        bg: 'var(--primary-soft, rgba(59,130,246,0.12))',
        fg: 'var(--primary, #3B82F6)',
        label: 'Info',
        icon: '📢',
      };
    default:
      return {
        bg: 'var(--success-soft, rgba(46,204,113,0.12))',
        fg: 'var(--success, #2ECC71)',
        label: 'Update',
        icon: '📌',
      };
  }
}

function getTypeIcon(type: string) {
  switch (type) {
    case 'announcement':
      return <Megaphone size={18} />;
    case 'reminder':
      return <Clock size={18} />;
    case 'alert':
      return <AlertCircle size={18} />;
    case 'update':
      return <Zap size={18} />;
    default:
      return <Bell size={18} />;
  }
}

// ─── Notification Card ────────────────────────────────────────

function NotificationCard({
  notification,
  userId,
  onDismiss,
  onDelete,
}: {
  notification: GroupNotification;
  userId: string;
  onDismiss: (id: string, groupId: string) => void;
  onDelete: (id: string, groupId: string) => void;
}) {
  const style = getPriorityStyle(notification.priority);
  const isUnread = !notification.read;

  return (
    <Card
      style={{
        position: 'relative',
        overflow: 'hidden',
        padding: 0,
      }}
    >
      {/* Left accent bar */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 3,
          backgroundColor: style.fg,
        }}
      />

      {/* Unread dot */}
      {isUnread && (
        <div
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: style.fg,
          }}
        />
      )}

      <div
        style={{
          display: 'flex',
          gap: 14,
          padding: '16px 18px 16px 20px',
          alignItems: 'flex-start',
        }}
      >
        {/* Icon */}
        <div
          style={{
            display: 'grid',
            placeItems: 'center',
            width: 44,
            height: 44,
            borderRadius: 12,
            flexShrink: 0,
            marginTop: 2,
            background: style.bg,
            color: style.fg,
            fontSize: 22,
          }}
        >
          {style.icon}
        </div>

        {/* Body */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Title + priority badge */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 4,
              flexWrap: 'wrap',
            }}
          >
            <strong
              style={{
                fontSize: '0.9rem',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                opacity: isUnread ? 1 : 0.7,
              }}
            >
              {notification.title}
            </strong>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '2px 8px',
                borderRadius: 6,
                fontSize: '0.68rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                background: style.bg,
                color: style.fg,
              }}
            >
              {style.label}
            </span>
          </div>

          {/* Content */}
          {notification.content && (
            <p
              className="muted"
              style={{
                fontSize: '0.84rem',
                lineHeight: 1.55,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical' as const,
                overflow: 'hidden',
                marginBottom: 10,
                opacity: isUnread ? 1 : 0.6,
              }}
            >
              {notification.content}
            </p>
          )}

          {/* ── Meta row: group + sender + time ─── */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              flexWrap: 'wrap',
              fontSize: '0.76rem',
            }}
          >
            {/* Group pill */}
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '3px 8px',
                borderRadius: 6,
                background: 'var(--secondary-soft, rgba(139,92,246,0.1))',
                color: 'var(--secondary, #8B5CF6)',
                fontWeight: 600,
              }}
            >
              <Users size={11} />
              {notification.groupName}
            </span>

            {/* Dot */}
            <span
              style={{
                width: 3,
                height: 3,
                borderRadius: '50%',
                background: 'var(--border)',
                flexShrink: 0,
              }}
            />

            {/* Sender */}
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                color: 'var(--text-secondary)',
                fontWeight: 500,
              }}
            >
              <Crown
                size={11}
                style={{ color: 'var(--warning, #F59E0B)' }}
              />
              {notification.senderName || 'Course Rep'}
            </span>

            {/* Dot */}
            <span
              style={{
                width: 3,
                height: 3,
                borderRadius: '50%',
                background: 'var(--border)',
                flexShrink: 0,
              }}
            />

            {/* Timestamp */}
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                color: 'var(--text-tertiary)',
              }}
              title={getFullTimestamp(notification.timestamp)}
            >
              <Clock size={11} />
              {timeAgo(notification.timestamp)}
            </span>
          </div>
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
            onClick={() =>
              onDismiss(notification.id, notification.groupId)
            }
            title="Dismiss"
          >
            <CheckCircle2 size={14} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              onDelete(notification.id, notification.groupId)
            }
            title="Delete permanently"
            style={{ color: 'var(--color-danger)' }}
          >
            <Trash2 size={14} />
          </Button>
        </div>
      </div>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════

export function NotificationsPage() {
  const userId = useAuthStore((s) => s.session?.user.uid);
  const db = getFirestore(getFirebaseApp());

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [groupFilter, setGroupFilter] = useState<string>('all');

  // Dismissed (session-local)
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(
    new Set(),
  );

  // Live notifications
  const [liveNotifs, setLiveNotifs] = useState<
    GroupNotification[] | null
  >(null);
  const [loading, setLoading] = useState(true);
  const [userGroupIds, setUserGroupIds] = useState<
    { id: string; name: string }[]
  >([]);

  // ── Step 1: Find all groups this user belongs to ────────

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    let mounted = true;

    async function findUserGroups() {
      try {
        const groupsSnap = await getDocs(
          collection(db, 'courseGroups'),
        );
        const matched: { id: string; name: string }[] = [];

        groupsSnap.docs.forEach((d) => {
          const data = d.data();
          const members = data.members || [];
          const isMember = members.some(
            (m: any) => m.userId === userId,
          );
          if (isMember) {
            matched.push({
              id: d.id,
              name:
                data.groupName ||
                data.courseName ||
                data.courseCode ||
                d.id,
            });
          }
        });

        if (mounted) {
          setUserGroupIds(matched);
          if (matched.length === 0) {
            setLoading(false);
            setLiveNotifs([]);
          }
        }
      } catch (err) {
        console.error(
          '[NotificationsPage] Error finding user groups:',
          err,
        );
        if (mounted) {
          setLoading(false);
          setLiveNotifs([]);
        }
      }
    }

    findUserGroups();
    return () => {
      mounted = false;
    };
  }, [userId, db]);

  // ── Step 2: Listen to notifications from ALL groups ─────

  useEffect(() => {
    if (!userId || userGroupIds.length === 0) return;

    const unsubscribers: (() => void)[] = [];

    // Store all notifications keyed by `${groupId}_${notifId}`
    const allNotifsMap = new Map<string, GroupNotification>();

    function broadcastUpdate() {
      const sorted = Array.from(allNotifsMap.values()).sort(
        (a, b) => b.timestamp - a.timestamp,
      );
      setLiveNotifs(sorted);
      setLoading(false);
    }

    userGroupIds.forEach((group) => {
      const notifRef = collection(
        db,
        'courseGroups',
        group.id,
        'notifications',
      );
      const q = firestoreQuery(
        notifRef,
        orderBy('createdAt', 'desc'),
        limit(50),
      );

      const unsub = onSnapshot(
        q,
        (snap) => {
          // Clear old entries for this group
          for (const key of allNotifsMap.keys()) {
            if (key.startsWith(`${group.id}_`)) {
              allNotifsMap.delete(key);
            }
          }

          snap.docs.forEach((d) => {
            const data = d.data() as Record<string, unknown>;

            // Extract timestamp — handle Firestore Timestamp, number, or string
            let ts = 0;
            const rawTs = data.createdAt ?? data.timestamp;
            if (typeof rawTs === 'number') {
              ts = rawTs;
            } else if (
              rawTs &&
              typeof (rawTs as any).toMillis === 'function'
            ) {
              ts = (rawTs as any).toMillis();
            } else if (
              rawTs &&
              typeof (rawTs as any).seconds === 'number'
            ) {
              ts = (rawTs as any).seconds * 1000;
            } else if (typeof rawTs === 'string') {
              ts = new Date(rawTs).getTime() || 0;
            }

            // Check expiry
            const expiresAt = data.expiresAt as number | undefined;
            if (expiresAt && expiresAt < Date.now()) return;

            // Determine read status
            const readBy = (data.readBy as string[]) || [];
            const isRead = readBy.includes(userId);

            // Map priority
            let priority: GroupNotification['priority'] = 'low';
            const rawPriority = String(
              data.priority ?? data.level ?? 'low',
            );
            if (
              rawPriority === 'urgent' ||
              rawPriority === 'high' ||
              rawPriority === 'medium' ||
              rawPriority === 'low'
            ) {
              priority =
                rawPriority as GroupNotification['priority'];
            }

            // Map type
            let type: GroupNotification['type'] = 'update';
            const rawType = String(data.type ?? 'update');
            if (
              ['announcement', 'reminder', 'alert', 'update'].includes(
                rawType,
              )
            ) {
              type = rawType as GroupNotification['type'];
            }

            const notif: GroupNotification = {
              id: d.id,
              title: String(data.title ?? 'Group Update'),
              content: String(
                data.content ??
                  data.message ??
                  data.body ??
                  data.detail ??
                  '',
              ),
              priority,
              type,
              timestamp: ts,
              read: isRead,
              groupId: group.id,
              groupName: group.name,
              senderName: String(
                data.createdByName ??
                  data.senderName ??
                  data.authorName ??
                  'Course Rep',
              ),
              senderId: String(
                data.createdBy ?? data.senderId ?? '',
              ),
              readBy,
              expiresAt: expiresAt,
            };

            allNotifsMap.set(`${group.id}_${d.id}`, notif);
          });

          broadcastUpdate();
        },
        (err) =>
          console.warn(
            `[NotificationsPage] listener error for ${group.id}:`,
            err,
          ),
      );

      unsubscribers.push(unsub);
    });

    return () => {
      unsubscribers.forEach((unsub) => {
        try {
          unsub();
        } catch {
          /* ignore */
        }
      });
    };
  }, [userId, userGroupIds, db]);

  // ── Derived data ────────────────────────────────────────

  const allNotifs = liveNotifs ?? [];

  const stats = useMemo(() => {
    const active = allNotifs.filter(
      (n) => !dismissedIds.has(n.id),
    );
    return {
      total: active.length,
      unread: active.filter((n) => !n.read).length,
      urgent: active.filter((n) => n.priority === 'urgent').length,
      important: active.filter((n) => n.priority === 'high')
        .length,
    };
  }, [allNotifs, dismissedIds]);

  const visibleNotifs = useMemo(() => {
    let list = allNotifs.filter(
      (n) => !dismissedIds.has(n.id),
    );

    // Filter by type
    switch (filter) {
      case 'unread':
        list = list.filter((n) => !n.read);
        break;
      case 'urgent':
        list = list.filter((n) => n.priority === 'urgent');
        break;
      case 'important':
        list = list.filter((n) => n.priority === 'high');
        break;
      case 'info':
        list = list.filter(
          (n) =>
            n.priority === 'medium' || n.priority === 'low',
        );
        break;
    }

    // Filter by group
    if (groupFilter !== 'all') {
      list = list.filter((n) => n.groupId === groupFilter);
    }

    // Search
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          n.content.toLowerCase().includes(q) ||
          n.groupName.toLowerCase().includes(q) ||
          n.senderName.toLowerCase().includes(q),
      );
    }

    return list;
  }, [allNotifs, dismissedIds, filter, groupFilter, searchTerm]);

  // Groups that have notifications
  const groupsWithNotifs = useMemo(() => {
    const seen = new Map<string, string>();
    allNotifs.forEach((n) => {
      if (!seen.has(n.groupId)) {
        seen.set(n.groupId, n.groupName);
      }
    });
    return Array.from(seen.entries()).map(([id, name]) => ({
      id,
      name,
    }));
  }, [allNotifs]);

  // ── Actions ─────────────────────────────────────────────

  function handleDismiss(id: string, _groupId: string) {
    setDismissedIds((prev) => new Set([...prev, id]));
  }

  function handleDismissAll() {
    if (!window.confirm('Dismiss all visible notifications?'))
      return;
    const ids = new Set(visibleNotifs.map((n) => n.id));
    setDismissedIds((prev) => new Set([...prev, ...ids]));
  }

  async function handleDelete(id: string, groupId: string) {
    if (
      !window.confirm('Permanently delete this notification?')
    )
      return;
    try {
      await deleteDoc(
        doc(
          db,
          'courseGroups',
          groupId,
          'notifications',
          id,
        ),
      );
      handleDismiss(id, groupId);
    } catch (err) {
      console.error(
        '[NotificationsPage] delete error:',
        err,
      );
    }
  }

  // ── Filter config ───────────────────────────────────────

  const filters: {
    key: FilterType;
    label: string;
    icon: string;
    count: number;
  }[] = [
    {
      key: 'all',
      label: 'All',
      icon: '📬',
      count: stats.total,
    },
    {
      key: 'unread',
      label: 'Unread',
      icon: '🔵',
      count: stats.unread,
    },
    {
      key: 'urgent',
      label: 'Urgent',
      icon: '🚨',
      count: stats.urgent,
    },
    {
      key: 'important',
      label: 'Important',
      icon: '⚡',
      count: stats.important,
    },
  ];

  // ── Loading state ───────────────────────────────────────

  if (loading) {
    return (
      <PageFrame id="notifications-page-frame" eyebrow="Activity" title="Notifications">
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
          <Loader2
            size={16}
            style={{
              animation: 'spin 700ms linear infinite',
            }}
          />
          Loading notifications from all groups…
        </div>
      </PageFrame>
    );
  }

  // ── No groups state ─────────────────────────────────────

  if (userGroupIds.length === 0) {
    return (
      <PageFrame eyebrow="Activity" title="Notifications">
        <EmptyState
          title="No groups joined"
          description="Join a group to start receiving notifications from course reps."
          icon={<Users size={20} />}
        />
      </PageFrame>
    );
  }

  // ── Main render ─────────────────────────────────────────

  return (
    <PageFrame
      eyebrow="Activity"
      title="Notifications"
      description={`Updates from ${userGroupIds.length} group${userGroupIds.length !== 1 ? 's' : ''} · ${stats.unread > 0 ? `${stats.unread} unread` : 'All caught up!'}`}
      action={
        <div style={{ display: 'flex', gap: 8 }}>
          {visibleNotifs.length > 0 && (
            <Button
              variant="secondary"
              leadingIcon={<CheckCircle2 size={16} />}
              onClick={handleDismissAll}
            >
              Dismiss all
            </Button>
          )}
        </div>
      }
    >
      {/* ── Stats row ────────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 8,
          marginBottom: 16,
        }}
      >
        {[
          {
            label: 'Total',
            value: stats.total,
            color: 'var(--text-secondary)',
          },
          {
            label: 'Unread',
            value: stats.unread,
            color: 'var(--primary, #3B82F6)',
          },
          {
            label: 'Urgent',
            value: stats.urgent,
            color: 'var(--error, #E74C3C)',
          },
          {
            label: 'Important',
            value: stats.important,
            color: 'var(--warning, #F59E0B)',
          },
        ].map((stat) => (
          <Card
            key={stat.label}
            style={{ padding: '12px 14px' }}
          >
            <p
              style={{
                fontSize: '1.25rem',
                fontWeight: 700,
                color: stat.color,
                lineHeight: 1,
                marginBottom: 4,
              }}
            >
              {stat.value}
            </p>
            <p
              style={{
                fontSize: '0.7rem',
                color: 'var(--text-tertiary)',
              }}
            >
              {stat.label}
            </p>
          </Card>
        ))}
      </div>

      {/* ── Filter tabs ──────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          gap: 6,
          overflowX: 'auto',
          marginBottom: 16,
          paddingBottom: 4,
        }}
      >
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 14px',
              borderRadius: 12,
              border:
                filter === f.key
                  ? 'none'
                  : '1px solid var(--border)',
              background:
                filter === f.key
                  ? 'var(--primary, #2ECC71)'
                  : 'var(--glass, transparent)',
              color:
                filter === f.key
                  ? '#fff'
                  : 'var(--text-secondary)',
              fontSize: '0.84rem',
              fontWeight: 600,
              whiteSpace: 'nowrap',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <span>{f.icon}</span>
            <span>{f.label}</span>
            {f.count > 0 && (
              <span
                style={{
                  padding: '1px 6px',
                  borderRadius: 6,
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  background:
                    filter === f.key
                      ? 'rgba(255,255,255,0.2)'
                      : 'var(--glass-strong, rgba(0,0,0,0.2))',
                }}
              >
                {f.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Search + Group filter ─────────────────────── */}
      <Card style={{ marginBottom: 16 }}>
        <div
          style={{
            display: 'flex',
            gap: 12,
            flexWrap: 'wrap',
            alignItems: 'flex-end',
          }}
        >
          <div style={{ flex: 1, minWidth: 200 }}>
            <Input
              label="Search"
              placeholder="Search by title, content, group, sender…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {groupsWithNotifs.length > 1 && (
            <div style={{ minWidth: 150 }}>
              <Select
                label="Group"
                value={groupFilter}
                onChange={(e) =>
                  setGroupFilter(e.target.value)
                }
              >
                <option value="all">All groups</option>
                {groupsWithNotifs.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </Select>
            </div>
          )}
        </div>

        {/* Summary badges */}
        <div
          style={{
            display: 'flex',
            gap: 6,
            flexWrap: 'wrap',
            marginTop: 10,
          }}
        >
          <Badge tone="neutral">
            {visibleNotifs.length} showing
          </Badge>
          {groupsWithNotifs.length > 0 && (
            <Badge tone="info">
              {groupsWithNotifs.length} group
              {groupsWithNotifs.length !== 1 ? 's' : ''}
            </Badge>
          )}
          {dismissedIds.size > 0 && (
            <Badge tone="success">
              {dismissedIds.size} dismissed
            </Badge>
          )}
        </div>
      </Card>

      {/* ── Notification list ────────────────────────── */}
      {visibleNotifs.length === 0 ? (
        <EmptyState
          title={
            searchTerm ||
            filter !== 'all' ||
            groupFilter !== 'all'
              ? 'No notifications match'
              : "You're all caught up!"
          }
          description={
            searchTerm ||
            filter !== 'all' ||
            groupFilter !== 'all'
              ? 'Try different search terms or clear the filters.'
              : 'New notifications from your course reps will appear here.'
          }
          icon={<BellOff size={20} />}
          action={
            searchTerm ||
            filter !== 'all' ||
            groupFilter !== 'all' ? (
              <Button
                variant="ghost"
                onClick={() => {
                  setSearchTerm('');
                  setFilter('all');
                  setGroupFilter('all');
                }}
              >
                Clear filters
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {visibleNotifs.map((notification) => (
            <NotificationCard
              key={`${notification.groupId}_${notification.id}`}
              notification={notification}
              userId={userId ?? ''}
              onDismiss={handleDismiss}
              onDelete={handleDelete}
            />
          ))}

          {/* Footer summary */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '20px 0',
              fontSize: '0.82rem',
              color: 'var(--text-tertiary)',
            }}
          >
            <CheckCircle2 size={14} />
            <span>
              Showing {visibleNotifs.length} of{' '}
              {allNotifs.filter(
                (n) => !dismissedIds.has(n.id),
              ).length}{' '}
              notifications
            </span>
          </div>
        </div>
      )}
    </PageFrame>
  );
}

export default NotificationsPage;