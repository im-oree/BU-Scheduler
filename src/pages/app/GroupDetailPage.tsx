// src/pages/groups/GroupDetailPage.tsx
// BU Scheduler — aligned to Student Hub data layer (Option C)
// React Query (stable) + onSnapshot (real-time) + studenthubData functions

import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import {
  collection,
  doc,
  getFirestore,
  onSnapshot,
  orderBy,
  query as firestoreQuery,
  limit,
  where,
} from 'firebase/firestore';
import {
  Bell,
  CalendarDays,
  LogOut,
  MessageSquare,
  Plus,
  RefreshCw,
  Send,
  Settings2,
  Shield,
  UserPlus,
  Users,
} from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Tabs,
} from '../../components/ui';
import { GroupChatMessageItem, PageFrame } from '../../components/shared';
import {
  fetchCurrentUserProfile,
  fetchGroupAnnouncements,
  fetchGroupById,
  fetchGroupChatMessages,
  fetchGroupDocument,
  fetchGroupMembers,
  fetchGroupTimetableEntries,
  getGroupRoleFlags,
  sendGroupChatMessage,
  toCalendarLabel,
  type StudentHubAnnouncement,
  type StudentHubChatMessage,
  type StudentHubTimetableEntry,
} from '../../lib/studenthubData';
import { getFirebaseApp } from '../../lib/firebase';
import { useAuthStore } from '../../store/useAuthStore';

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SectionSkeleton() {
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          style={{
            height: 72,
            borderRadius: 12,
            backgroundColor: 'var(--color-surface)',
            animation: 'pulse 1.5s ease-in-out infinite',
          }}
        />
      ))}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(isoOrNumber: string | number): string {
  if (!isoOrNumber) return '';
  const ts =
    typeof isoOrNumber === 'number'
      ? isoOrNumber
      : new Date(isoOrNumber).getTime();
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function GroupDetailPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const db = getFirestore(getFirebaseApp());
  const userId = useAuthStore((s) => s.session?.user.uid);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Tab state
  const [tab, setTab] = useState('schedule');

  // Chat state
  const [chatText, setChatText] = useState('');
  const [sendingChat, setSendingChat] = useState(false);

  // Real-time overrides on top of React Query cache
  const [liveMessages, setLiveMessages] =
    useState<StudentHubChatMessage[] | null>(null);
  const [liveTimetable, setLiveTimetable] =
    useState<StudentHubTimetableEntry[] | null>(null);
  const [liveAnnouncements, setLiveAnnouncements] =
    useState<StudentHubAnnouncement[] | null>(null);

  // ─── React Query: stable fetches ────────────────────────────────────────────

  const profileQuery = useQuery({
    queryKey: ['profile', userId],
    queryFn: () => (userId ? fetchCurrentUserProfile(userId) : null),
    enabled: Boolean(userId),
    staleTime: 60_000,
  });

  const groupQuery = useQuery({
    queryKey: ['group', groupId],
    queryFn: () => (groupId ? fetchGroupById(groupId) : null),
    enabled: Boolean(groupId),
    staleTime: 60_000,
  });

  const rawGroupQuery = useQuery({
    queryKey: ['group-raw', groupId],
    queryFn: () => (groupId ? fetchGroupDocument(groupId) : null),
    enabled: Boolean(groupId),
    staleTime: 60_000,
  });

  const membersQuery = useQuery({
    queryKey: ['group-members', groupId],
    queryFn: () => (groupId ? fetchGroupMembers(groupId) : []),
    enabled: Boolean(groupId),
    staleTime: 60_000,
  });

  const announcementsQuery = useQuery({
    queryKey: ['group-announcements', groupId],
    queryFn: () => (groupId ? fetchGroupAnnouncements(groupId) : []),
    enabled: Boolean(groupId),
    staleTime: 30_000,
  });

  const chatQuery = useQuery({
    queryKey: ['group-chat', groupId],
    queryFn: () => (groupId ? fetchGroupChatMessages(groupId) : []),
    enabled: Boolean(groupId),
    staleTime: 30_000,
  });

  const scheduleQuery = useQuery({
    queryKey: ['group-schedule', groupId],
    queryFn: () => (groupId ? fetchGroupTimetableEntries(groupId) : []),
    enabled: Boolean(groupId),
    staleTime: 60_000,
  });

  // ─── Derived data — live overrides take priority ───────────────────────────

  const group = groupQuery.data;
  const rawGroup = rawGroupQuery.data;
  const members = membersQuery.data ?? [];
  const announcements: StudentHubAnnouncement[] =
    liveAnnouncements ?? announcementsQuery.data ?? [];
  const chatMessages: StudentHubChatMessage[] =
    liveMessages ?? chatQuery.data ?? [];
  const scheduleEvents: StudentHubTimetableEntry[] =
    liveTimetable ?? scheduleQuery.data ?? [];

  // ─── Role flags — uses same getGroupRoleFlags as Student Hub ──────────────

  const roleFlags = getGroupRoleFlags(
    userId ?? '',
    profileQuery.data ?? null,
    groupId ?? '',
    rawGroup ?? null,
  );

  const canManage =
    roleFlags.isAdmin ||
    roleFlags.isCourseAdmin ||
    roleFlags.isCourseRep ||
    roleFlags.isGroupRep;

  const isMember = roleFlags.isMember;

  // ─── Real-time: timetable ─────────────────────────────────────────────────

  useEffect(() => {
    if (!groupId) return;
    const q = firestoreQuery(
      collection(db, 'groupTimetables'),
      where('groupId', '==', groupId),
      limit(100),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const entries: StudentHubTimetableEntry[] = snap.docs.map((d) => {
          const data = d.data() as Record<string, unknown>;
          return {
            id: d.id,
            groupId,
            courseCode: String(data.courseCode ?? '—'),
            courseName: String(
              data.className ?? data.courseName ?? 'Untitled class',
            ),
            dayIndex:
              typeof data.dayIndex === 'number' ? data.dayIndex : 0,
            day: String(data.dayOfWeek ?? data.day ?? '—'),
            startTime: String(data.startTime ?? ''),
            endTime: String(data.endTime ?? ''),
            venue: String(data.venue ?? data.location ?? 'TBA'),
            instructor: String(data.instructor ?? 'TBA'),
            groupName: groupId,
          };
        });

        entries.sort((a, b) => {
          const dayDiff = (a.dayIndex ?? 0) - (b.dayIndex ?? 0);
          if (dayDiff !== 0) return dayDiff;
          return (a.startTime ?? '').localeCompare(b.startTime ?? '');
        });

        setLiveTimetable(entries);
        queryClient.setQueryData(['group-schedule', groupId], entries);
      },
      (err) => console.warn('[BUScheduler] detail timetable listener:', err),
    );
    return unsub;
  }, [groupId, db, queryClient]);

  // ─── Real-time: chat messages ─────────────────────────────────────────────

  useEffect(() => {
    if (!groupId) return;
    const q = firestoreQuery(
      collection(db, 'groupChats', groupId, 'messages'),
      orderBy('createdAt', 'asc'),
      limit(100),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const msgs: StudentHubChatMessage[] = snap.docs.map((d) => {
          const data = d.data() as Record<string, unknown>;
          const rawTime = String(data.createdAt ?? '');
          return {
            id: d.id,
            author: String(
              data.author ??
                data.displayName ??
                data.userName ??
                'Member',
            ),
            role: String(data.role ?? 'Member'),
            time: rawTime.length >= 16 ? rawTime.slice(11, 16) : rawTime,
            text: String(data.text ?? data.message ?? ''),
            userId: String(data.userId ?? ''),
            userAvatar: String(data.userAvatar ?? ''),
            edited: Boolean(data.edited),
            deleted: Boolean(data.deleted),
          };
        });
        setLiveMessages(msgs);
        queryClient.setQueryData(['group-chat', groupId], msgs);
      },
      (err) => console.warn('[BUScheduler] detail chat listener:', err),
    );
    return unsub;
  }, [groupId, db, queryClient]);

  // ─── Real-time: announcements ─────────────────────────────────────────────

  useEffect(() => {
    if (!groupId) return;
    const q = firestoreQuery(
      collection(db, 'courseGroups', groupId, 'notifications'),
      orderBy('createdAt', 'desc'),
      limit(20),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const items: StudentHubAnnouncement[] = snap.docs.map((d) => {
          const data = d.data() as Record<string, unknown>;
          const rawDate = String(
            data.createdAt ?? data.timestamp ?? data.date ?? '',
          );
          return {
            id: d.id,
            title: String(data.title ?? data.subject ?? 'Announcement'),
            body: String(
              data.body ??
                data.detail ??
                data.message ??
                data.content ??
                '',
            ),
            date: rawDate.slice(0, 10),
            author: String(
              data.author ??
                data.displayName ??
                data.userName ??
                'Group Rep',
            ),
          };
        });
        setLiveAnnouncements(items);
        queryClient.setQueryData(
          ['group-announcements', groupId],
          items,
        );
      },
      (err) =>
        console.warn('[BUScheduler] detail announcements listener:', err),
    );
    return unsub;
  }, [groupId, db, queryClient]);

  // ─── Auto-scroll chat ─────────────────────────────────────────────────────

  useEffect(() => {
    if (tab === 'chat' && chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages.length, tab]);

  // ─── Actions ──────────────────────────────────────────────────────────────

  async function handleSendMessage() {
    if (
      !groupId ||
      !userId ||
      !chatText.trim() ||
      !profileQuery.data
    )
      return;
    setSendingChat(true);
    try {
      // Uses studenthubData.sendGroupChatMessage — same as Student Hub
      await sendGroupChatMessage({
        groupId,
        userId,
        profile: profileQuery.data,
        text: chatText.trim(),
      });
      setChatText('');
      // onSnapshot listener updates liveMessages automatically
    } catch (err) {
      console.error('[BUScheduler] send message:', err);
    } finally {
      setSendingChat(false);
    }
  }

  async function handleJoinGroup() {
    if (!groupId || !userId || !profileQuery.data) return;
    try {
      const { joinGroup } = await import('../../lib/studenthubData');
      await joinGroup(groupId, profileQuery.data, userId);
      await Promise.all([
        membersQuery.refetch(),
        rawGroupQuery.refetch(),
        groupQuery.refetch(),
      ]);
    } catch (err) {
      console.error('[BUScheduler] join group:', err);
    }
  }

  // ─── Guards ───────────────────────────────────────────────────────────────

  if (!groupId) {
    return (
      <EmptyState
        title="Missing group"
        description="No group ID was provided."
      />
    );
  }

  if (groupQuery.isLoading || rawGroupQuery.isLoading) {
    return (
      <PageFrame
        eyebrow="Group detail"
        title="Loading group…"
        description="Fetching group information."
      >
        <SectionSkeleton />
      </PageFrame>
    );
  }

  if (groupQuery.isError || !group) {
    return (
      <PageFrame
        eyebrow="Group detail"
        title="Group not found"
        description="This group could not be loaded."
      >
        <EmptyState
          title="Failed to load group"
          description={
            groupQuery.isError
              ? 'There was an error fetching this group.'
              : `Group "${groupId}" does not exist.`
          }
          action={
            <div style={{ display: 'flex', gap: 8 }}>
              <Button
                variant="primary"
                leadingIcon={<RefreshCw size={16} />}
                onClick={() => {
                  void groupQuery.refetch();
                  void rawGroupQuery.refetch();
                }}
              >
                Retry
              </Button>
              <Button variant="secondary" onClick={() => navigate(-1)}>
                Go back
              </Button>
            </div>
          }
        />
      </PageFrame>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <PageFrame
      eyebrow="Group detail"
      title={group.title}
      description={`${group.courseCode} · Level ${group.level} · ${members.length} members`}
      action={
        canManage ? (
          <Button
            variant="primary"
            leadingIcon={<Plus size={18} />}
            onClick={() => navigate(`/groups/${groupId}/events/new`)}
          >
            Add class
          </Button>
        ) : null
      }
    >
      {/* ── Group overview card ─────────────────────────────────────────── */}
      <Card className="group-overview">
        <div className="group-overview__summary">
          <div>
            <Badge tone="success">
              {isMember ? 'Joined' : 'Open group'}
            </Badge>
            <p className="muted" style={{ marginTop: 6 }}>
              Members, timetable, announcements, and chat in one place.
            </p>
          </div>

          <div className="group-overview__actions">
            {!isMember ? (
              <Button variant="secondary" onClick={() => void handleJoinGroup()}>
                Join group
              </Button>
            ) : (
              <Button variant="ghost" disabled>
                Joined
              </Button>
            )}

            {canManage && (
              <Button
                variant="ghost"
                leadingIcon={<Settings2 size={16} />}
                onClick={() => navigate(`/groups/${groupId}/manage`)}
              >
                Manage group
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* ── Tabs ──────────────────────────────────────────────────────────── */}
      <Tabs
        tabs={[
          { id: 'schedule', label: 'Schedule' },
          {
            id: 'members',
            label: 'Members',
            badge: String(members.length),
          },
          { id: 'chat', label: 'Chat' },
          {
            id: 'announcements',
            label: 'Announcements',
            badge: String(announcements.length),
          },
        ]}
        activeId={tab}
        onChange={setTab}
      />

      {/* ══ SCHEDULE ════════════════════════════════════════════════════════ */}
      {tab === 'schedule' && (
        <>
          {scheduleQuery.isLoading && !liveTimetable ? (
            <SectionSkeleton />
          ) : scheduleEvents.length === 0 ? (
            <EmptyState
              title="No classes yet"
              description={
                canManage
                  ? 'Add the first class using the button above.'
                  : 'Your group rep will add classes here.'
              }
              icon={<CalendarDays size={20} />}
              action={
                canManage ? (
                  <Button
                    variant="primary"
                    leadingIcon={<Plus size={16} />}
                    onClick={() =>
                      navigate(`/groups/${groupId}/events/new`)
                    }
                  >
                    Add first class
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="timeline-list">
              {scheduleEvents.map((event) => (
                <Card key={event.id} className="timeline-card">
                  <div className="timeline-card__left">
                    <Badge tone="info">{event.courseCode}</Badge>
                    <h3>{event.courseName}</h3>
                    <p>{event.groupName || event.day}</p>
                  </div>
                  <div className="timeline-card__right">
                    <span>{toCalendarLabel(event)}</span>
                    <span>{event.venue}</span>
                    <span>{event.instructor}</span>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* ══ MEMBERS ═════════════════════════════════════════════════════════ */}
      {tab === 'members' && (
        <Card>
          <div className="table-header">
            <h2>Members</h2>
            {canManage && (
              <Button
                variant="secondary"
                size="sm"
                leadingIcon={<UserPlus size={16} />}
                onClick={() => navigate(`/groups/${groupId}/manage`)}
              >
                Invite member
              </Button>
            )}
          </div>

          {membersQuery.isLoading ? (
            <SectionSkeleton />
          ) : members.length === 0 ? (
            <EmptyState
              title="No members yet"
              description="Members will appear once people join this group."
              icon={<Users size={20} />}
            />
          ) : (
            <div className="member-table">
              {members.map((member) => (
                <div key={member.id} className="member-row">
                  <div className="member-row__identity">
                    <div className="avatar avatar--small">
                      {member.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <strong>{member.name}</strong>
                      <span>{member.joinedAt}</span>
                    </div>
                  </div>
                  <Badge
                    tone={
                      member.role === 'Course Rep'
                        ? 'warning'
                        : member.role === 'Group Rep'
                        ? 'success'
                        : 'neutral'
                    }
                  >
                    {member.role}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* ══ ANNOUNCEMENTS ═══════════════════════════════════════════════════ */}
      {tab === 'announcements' && (
        <>
          {announcementsQuery.isLoading && !liveAnnouncements ? (
            <SectionSkeleton />
          ) : announcements.length === 0 ? (
            <EmptyState
              title="No announcements yet"
              description="Announcements from your group rep will appear here."
              icon={<Bell size={20} />}
            />
          ) : (
            <div className="announcement-list">
              {announcements.map((announcement) => (
                <Card key={announcement.id}>
                  <strong>{announcement.title}</strong>
                  <p className="muted">{announcement.body}</p>
                  <span className="muted">
                    {announcement.author} ·{' '}
                    {timeAgo(announcement.date) || announcement.date}
                  </span>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* ══ CHAT ════════════════════════════════════════════════════════════ */}
      {tab === 'chat' && (
        <Card className="chat-panel">
          <div
            className="chat-panel__history"
            style={{ maxHeight: 400, overflowY: 'auto' }}
          >
            {chatQuery.isLoading && !liveMessages ? (
              <SectionSkeleton />
            ) : chatMessages.length === 0 ? (
              <EmptyState
                title="No messages yet"
                description="Be the first to start the conversation."
                icon={<MessageSquare size={20} />}
              />
            ) : (
              chatMessages.map((message) => (
                <GroupChatMessageItem key={message.id} message={message} />
              ))
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Composer — only if member or can manage */}
          {(isMember || canManage) && (
            <div className="chat-panel__composer">
              <Input
                label="Message"
                placeholder="Type a message…"
                value={chatText}
                onChange={(e) => setChatText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void handleSendMessage();
                  }
                }}
              />
              <Button
                variant="primary"
                leadingIcon={<Send size={16} />}
                loading={sendingChat}
                disabled={!chatText.trim()}
                onClick={() => void handleSendMessage()}
              >
                Send
              </Button>
            </div>
          )}

          {/* Non-member prompt */}
          {!isMember && !canManage && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginTop: 12,
                padding: '10px 14px',
                borderRadius: 10,
                backgroundColor: 'var(--color-surface)',
              }}
            >
              <Shield size={16} />
              <p className="muted" style={{ fontSize: 13 }}>
                Join this group to participate in chat.
              </p>
              <Button
                variant="primary"
                size="sm"
                onClick={() => void handleJoinGroup()}
                style={{ marginLeft: 'auto' }}
              >
                Join
              </Button>
            </div>
          )}
        </Card>
      )}
    </PageFrame>
  );
}

export default GroupDetailPage;