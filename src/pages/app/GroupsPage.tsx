// src/pages/groups/GroupsPage.tsx
// BU Scheduler — aligned to Student Hub data layer (Option C)
// React Query (stable) + onSnapshot (real-time) + studenthubData functions

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  collection,
  getFirestore,
  onSnapshot,
  query as firestoreQuery,
  limit,
} from 'firebase/firestore';
import {
  AlertCircle,
  BookOpen,
  Calendar,
  ChevronRight,
  Plus,
  RefreshCw,
  UserPlus,
  Users,
} from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Modal,
  Select,
  Tabs,
} from '../../components/ui';
import { PageFrame } from '../../components/shared';
import { useAppStore } from '../../store/useAppStore';
import { useAuthStore } from '../../store/useAuthStore';
import {
  fetchAllGroups,
  fetchCurrentUserProfile,
  fetchGroupMembers,
  fetchUserGroups,
  joinGroup,
  type StudentHubGroup,
  type StudentHubMember,
} from '../../lib/studenthubData';
import { getFirebaseApp } from '../../lib/firebase';

// ─── Types ────────────────────────────────────────────────────────────────────

type FilterValue = 'joined' | 'all';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Extracts a bare group ID from either a raw ID string or a full invite URL.
 */
function parseGroupId(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    const segments = url.pathname.split('/').filter(Boolean);
    const groupIndex = segments.findIndex((s) =>
      ['groups', 'join'].includes(s),
    );
    if (groupIndex !== -1 && segments[groupIndex + 1]) {
      return segments[groupIndex + 1];
    }
  } catch {
    return trimmed;
  }
  return null;
}

/**
 * Formats the next class display. Handles:
 *   - "Monday 09:00" style strings
 *   - ISO datetime strings
 *   - "Recently" / null / "No upcoming class" fallbacks
 */
function formatNextClass(raw?: string): string {
  if (!raw || raw === 'No upcoming class' || raw === 'Recently')
    return 'No upcoming class';

  // ISO datetime
  const iso = new Date(raw);
  if (!Number.isNaN(iso.getTime()) && raw.includes('T')) {
    return iso.toLocaleString([], {
      weekday: 'short',
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  // "Monday 09:00" or "Mon 09:00"
  const match = raw.match(
    /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s+(\d{1,2}):(\d{2})$/i,
  );
  if (match) {
    const day = match[1].slice(0, 3);
    const d = new Date(2000, 0, 1, +match[2], +match[3]);
    if (!Number.isNaN(d.getTime())) {
      const time = d.toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit',
      });
      return `${day} · ${time}`;
    }
  }

  return raw;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = {
  toolbar: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 10,
    alignItems: 'center',
  } as CSSProperties,

  searchBar: {
    display: 'grid',
    gap: 12,
    gridTemplateColumns: '1fr',
  } as CSSProperties,

  searchBarWithFilter: {
    display: 'grid',
    gap: 12,
    gridTemplateColumns: '1fr 200px',
    alignItems: 'end',
  } as CSSProperties,

  tabsWrap: {
    marginTop: 14,
  } as CSSProperties,

  groupGrid: {
    display: 'grid',
    gap: 14,
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
  } as CSSProperties,

  groupCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    padding: 18,
    minWidth: 0,
    overflow: 'hidden',
  } as CSSProperties,

  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    minWidth: 0,
  } as CSSProperties,

  cardHeaderBody: {
    minWidth: 0,
    flex: 1,
    display: 'grid',
    gap: 6,
  } as CSSProperties,

  cardTitle: {
    fontSize: '1rem',
    lineHeight: 1.3,
    margin: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
  } as CSSProperties,

  cardDesc: {
    fontSize: '0.82rem',
    color: 'var(--muted, #6B7280)',
    margin: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
  } as CSSProperties,

  cardIcon: {
    display: 'grid',
    placeItems: 'center',
    width: 40,
    height: 40,
    borderRadius: 10,
    background: 'var(--primary-soft, #F2F8E6)',
    color: 'var(--tertiary, #5A8A00)',
    flexShrink: 0,
  } as CSSProperties,

  metaRow: {
    display: 'flex',
    gap: 12,
    flexWrap: 'wrap',
    paddingTop: 12,
    paddingBottom: 12,
    borderTop: '1px solid var(--divider, #ECEEF3)',
    borderBottom: '1px solid var(--divider, #ECEEF3)',
  } as CSSProperties,

  metaItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: '0.78rem',
    color: 'var(--muted, #6B7280)',
    minWidth: 0,
  } as CSSProperties,

  cardActions: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
    marginTop: 'auto',
  } as CSSProperties,

  searchHint: {
    marginTop: 10,
    fontSize: '0.78rem',
    color: 'var(--muted, #6B7280)',
  } as CSSProperties,

  errorState: {
    display: 'grid',
    placeItems: 'center',
    textAlign: 'center',
    gap: 14,
    padding: '48px 24px',
    background: 'var(--error-soft, #FEE2E2)',
    border: '1px solid var(--error-alpha-20, rgba(239,68,68,0.2))',
    borderRadius: 16,
  } as CSSProperties,

  skeletonCard: {
    height: 200,
    borderRadius: 16,
    background:
      'linear-gradient(90deg, var(--bg-muted, #F1F3F8) 0%, var(--surface-2, #E8EAF0) 50%, var(--bg-muted, #F1F3F8) 100%)',
    backgroundSize: '200% 100%',
    animation: 'skeleton-wave 1.5s ease-in-out infinite',
  } as CSSProperties,

  memberRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    padding: '10px 12px',
    borderRadius: 10,
    background: 'var(--bg-muted, #F1F3F8)',
  } as CSSProperties,

  memberIdentity: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
    flex: 1,
  } as CSSProperties,
} as const;

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function GroupCardSkeleton() {
  return <div style={styles.skeletonCard} aria-hidden="true" />;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function GroupsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const db = getFirestore(getFirebaseApp());

  // Modal state
  const [joinModalOpen, setJoinModalOpen] = useState(
    searchParams.get('mode') === 'join',
  );
  const [joinInput, setJoinInput] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joinBusy, setJoinBusy] = useState(false);

  // Browse/filter state
  const [filter, setFilter] = useState<FilterValue>('joined');
  const [searchTerm, setSearchTerm] = useState('');

  // Group detail modal state
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  // Real-time patches on top of React Query cache
  const [liveGroups, setLiveGroups] = useState<StudentHubGroup[] | null>(null);

  const userId = useAuthStore((s) => s.session?.user.uid);

  // ─── React Query ──────────────────────────────────────────────────────────

  const profileQuery = useQuery({
    queryKey: ['profile', userId],
    queryFn: () => (userId ? fetchCurrentUserProfile(userId) : null),
    enabled: Boolean(userId),
    staleTime: 60_000,
  });

  const joinedGroupsQuery = useQuery({
    queryKey: ['groups-joined', userId],
    queryFn: () => (userId ? fetchUserGroups(userId) : []),
    enabled: Boolean(userId),
    staleTime: 60_000,
  });

  const allGroupsQuery = useQuery({
    queryKey: ['groups-all'],
    queryFn: () => fetchAllGroups(),
    staleTime: 60_000,
  });

  const selectedMembersQuery = useQuery({
    queryKey: ['group-members-browser', selectedGroupId],
    queryFn: () =>
      selectedGroupId ? fetchGroupMembers(selectedGroupId) : [],
    enabled: Boolean(selectedGroupId),
    staleTime: 60_000,
  });

  // ─── Derived data ──────────────────────────────────────────────────────────

  const allGroups: StudentHubGroup[] =
    liveGroups ?? allGroupsQuery.data ?? [];
  const joinedGroups: StudentHubGroup[] = joinedGroupsQuery.data ?? [];
  const selectedGroup =
    allGroups.find((g) => g.id === selectedGroupId) ?? null;
  const selectedMembers: StudentHubMember[] = selectedMembersQuery.data ?? [];
  const selectedGroupPreviewMembers = selectedMembers.slice(0, 4);

  const canCreateGroup = Boolean(
    profileQuery.data?.role === 'admin' ||
      (profileQuery.data?.courseAdmins ?? []).length > 0 ||
      (profileQuery.data?.courseReps ?? []).length > 0 ||
      (profileQuery.data?.levelCourseReps ?? []).length > 0,
  );

  // ─── Real-time: courseGroups collection ────────────────────────────────────

  useEffect(() => {
    const q = firestoreQuery(collection(db, 'courseGroups'), limit(500));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const mapped: StudentHubGroup[] = snap.docs.map((d) => {
          const data = d.data() as Record<string, unknown>;
          const members = Array.isArray(data.members)
            ? (data.members as unknown[])
            : [];
          return {
            id: d.id,
            title: String(
              data.groupName ?? data.name ?? data.title ?? d.id,
            ),
            courseCode: String(data.courseCode ?? 'Course'),
            level: String(data.studyLevel ?? data.level ?? '—'),
            memberCount:
              typeof data.memberCount === 'number'
                ? data.memberCount
                : members.length,
            lastActivity: String(
              data.updatedAt ?? data.lastActivity ?? 'Recently',
            ),
            nextClass: String(data.nextClass ?? 'No upcoming class'),
            description: String(data.description ?? 'Course group'),
            accent: 'green',
          };
        });

        setLiveGroups(mapped);
        queryClient.setQueryData(['groups-all'], mapped);

        if (userId) {
          const mine = snap.docs
            .filter((d) => {
              const data = d.data() as Record<string, unknown>;
              const members = Array.isArray(data.members)
                ? (data.members as Array<Record<string, unknown>>)
                : [];
              const reps = Array.isArray(data.groupReps)
                ? (data.groupReps as string[])
                : [];
              return (
                members.some((m) => m.userId === userId) ||
                reps.includes(userId)
              );
            })
            .map((d) => {
              const data = d.data() as Record<string, unknown>;
              const members = Array.isArray(data.members)
                ? (data.members as unknown[])
                : [];
              return {
                id: d.id,
                title: String(
                  data.groupName ?? data.name ?? data.title ?? d.id,
                ),
                courseCode: String(data.courseCode ?? 'Course'),
                level: String(data.studyLevel ?? data.level ?? '—'),
                memberCount:
                  typeof data.memberCount === 'number'
                    ? data.memberCount
                    : members.length,
                lastActivity: String(
                  data.updatedAt ?? data.lastActivity ?? 'Recently',
                ),
                nextClass: String(data.nextClass ?? 'No upcoming class'),
                description: String(data.description ?? 'Course group'),
                accent: 'green' as const,
              };
            });

          queryClient.setQueryData(['groups-joined', userId], mine);
        }
      },
      (err) => {
        console.warn('[BUScheduler] groups listener:', err);
      },
    );

    return unsub;
  }, [db, userId, queryClient]);

  // ─── Filtered groups ────────────────────────────────────────────────────────

  const filteredGroups = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const source = filter === 'joined' ? joinedGroups : allGroups;
    if (!q) return source;
    return source.filter(
      (g) =>
        g.title.toLowerCase().includes(q) ||
        g.courseCode.toLowerCase().includes(q),
    );
  }, [filter, joinedGroups, allGroups, searchTerm]);

  // ─── Actions ───────────────────────────────────────────────────────────────

  function handleFilterChange(value: string) {
    setFilter(value as FilterValue);
  }

  function handleCloseJoinModal() {
    setJoinModalOpen(false);
    setJoinInput('');
    setJoinError(null);
    setSearchParams({});
  }

  async function handleJoinById() {
    const groupId = parseGroupId(joinInput);
    if (!groupId) {
      setJoinError('Please enter a valid group ID or invite link.');
      return;
    }
    if (!userId || !profileQuery.data) {
      useAppStore.getState().openAuthModal('join group by ID');
      return;
    }

    setJoinBusy(true);
    setJoinError(null);
    try {
      await joinGroup(groupId, profileQuery.data, userId);
      await Promise.all([
        joinedGroupsQuery.refetch(),
        allGroupsQuery.refetch(),
      ]);
      handleCloseJoinModal();
      navigate(`/groups/${groupId}`);
    } catch (err) {
      setJoinError(
        err instanceof Error ? err.message : 'Failed to join group.',
      );
    } finally {
      setJoinBusy(false);
    }
  }

  async function handleJoinCard(groupId: string) {
    if (!userId || !profileQuery.data) {
      useAppStore.getState().openAuthModal('join group');
      return;
    }
    try {
      await joinGroup(groupId, profileQuery.data, userId);
      await Promise.all([
        joinedGroupsQuery.refetch(),
        allGroupsQuery.refetch(),
      ]);
      navigate(`/groups/${groupId}`);
    } catch (err) {
      console.error('[BUScheduler] join group card:', err);
    }
  }

  function handleCreateGroup() {
    const profile = profileQuery.data;
    if (
      profile &&
      (profile.level || profile.studyLevel) &&
      !(profile.courseAdmins ?? []).length
    ) {
      const level = encodeURIComponent(
        profile.studyLevel || profile.level || '',
      );
      navigate(`/groups/new?level=${level}`);
      return;
    }
    navigate('/groups/new');
  }

  // ─── Loading state ─────────────────────────────────────────────────────────

  if (
    joinedGroupsQuery.isLoading ||
    (allGroupsQuery.isLoading && !liveGroups)
  ) {
    return (
      <PageFrame
        eyebrow="Groups"
        title="Your groups and course cohorts"
        description="Browse available course groups, join one, or jump into your joined groups."
      >
        <div style={styles.groupGrid}>
          {[1, 2, 3, 4].map((i) => (
            <GroupCardSkeleton key={i} />
          ))}
        </div>
      </PageFrame>
    );
  }

  // ─── Error state ───────────────────────────────────────────────────────────

  if (joinedGroupsQuery.isError || allGroupsQuery.isError) {
    return (
      <PageFrame eyebrow="Groups" title="Something went wrong">
        <div style={styles.errorState} role="alert">
          <AlertCircle size={32} color="var(--error, #EF4444)" aria-hidden />
          <div>
            <h3 style={{ marginBottom: 6 }}>Couldn't load groups</h3>
            <p style={{ color: 'var(--muted)', fontSize: '0.88rem' }}>
              Check your connection and try again.
            </p>
          </div>
          <Button
            variant="primary"
            size="sm"
            leadingIcon={<RefreshCw size={16} />}
            onClick={() => {
              void joinedGroupsQuery.refetch();
              void allGroupsQuery.refetch();
            }}
          >
            Try again
          </Button>
        </div>
      </PageFrame>
    );
  }

  // ─── Render a single group card (DRY) ──────────────────────────────────────

  function renderGroupCard(g: StudentHubGroup, isJoined: boolean) {
    return (
      <Card key={g.id} style={styles.groupCard}>
        {/* Header */}
        <div style={styles.cardHeader}>
          <div style={styles.cardHeaderBody}>
            <Badge tone="info" style={{ alignSelf: 'flex-start' }}>
              {g.courseCode}
            </Badge>
            <h3 style={styles.cardTitle}>{g.title}</h3>
            <p style={styles.cardDesc}>{g.description}</p>
          </div>
          <div style={styles.cardIcon} aria-hidden="true">
            <Users size={18} />
          </div>
        </div>

        {/* Meta */}
        <div style={styles.metaRow}>
          <span style={styles.metaItem}>
            <Users size={13} aria-hidden />
            {g.memberCount} {g.memberCount === 1 ? 'member' : 'members'}
          </span>
          <span style={styles.metaItem}>
            <Calendar size={13} aria-hidden />
            {formatNextClass(g.nextClass)}
          </span>
        </div>

        {/* Actions */}
        <div style={styles.cardActions}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedGroupId(g.id)}
          >
            {isJoined ? 'Members' : 'Preview'}
          </Button>

          {isJoined ? (
            <Button
              variant="primary"
              size="sm"
              trailingIcon={<ChevronRight size={14} />}
              onClick={() => navigate(`/groups/${g.id}`)}
              style={{ marginLeft: 'auto' }}
            >
              Open
            </Button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              onClick={() => void handleJoinCard(g.id)}
              style={{ marginLeft: 'auto' }}
            >
              Join group
            </Button>
          )}
        </div>
      </Card>
    );
  }

  // ─── No groups joined — browse view ────────────────────────────────────────

  if (joinedGroups.length === 0) {
    const browseList = allGroups.filter(
      (g) =>
        !searchTerm ||
        g.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        g.courseCode.toLowerCase().includes(searchTerm.toLowerCase()),
    );

    return (
      <PageFrame
        id="groups-page-frame"
        eyebrow="Groups"
        title="Find your course group"
        description="Join a group to access the timetable, chat, and updates."
        action={
          <Button
            id="join-by-id-button"
            variant="secondary"
            leadingIcon={<UserPlus size={16} />}
            onClick={() => setJoinModalOpen(true)}
          >
            Join by ID
          </Button>
        }
      >
        {/* Search */}
        <Card style={{ padding: 18 }}>
          <div style={styles.searchBar}>
            <Input
              label="Search groups"
              placeholder="Search by course code or group name…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              leadingIcon={<Users size={16} />}
            />
          </div>
          <p style={styles.searchHint}>
            {allGroups.length} group{allGroups.length !== 1 ? 's' : ''} available
          </p>
        </Card>

        {/* List */}
        {browseList.length === 0 ? (
          <EmptyState
            title={
              searchTerm ? 'No groups match your search' : 'No groups found'
            }
            description={
              searchTerm
                ? 'Try a different course code or name.'
                : 'No public groups are available right now. Check back later.'
            }
            icon={<BookOpen size={20} />}
          />
        ) : (
          <div style={styles.groupGrid}>
            {browseList.map((g) => renderGroupCard(g, false))}
          </div>
        )}

        {/* Join modal */}
        <Modal
          open={joinModalOpen}
          title="Join a group"
          description="Enter a group ID or paste an invite link to join."
          onClose={handleCloseJoinModal}
          footer={
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Button variant="ghost" onClick={handleCloseJoinModal}>
                Cancel
              </Button>
              <Button
                variant="primary"
                loading={joinBusy}
                onClick={() => void handleJoinById()}
              >
                Join group
              </Button>
            </div>
          }
        >
          <Input
            label="Group ID or invite link"
            placeholder="CS100-B or https://…/join/CS100-B"
            value={joinInput}
            onChange={(e) => {
              setJoinInput(e.target.value);
              if (joinError) setJoinError(null);
            }}
            error={joinError ?? undefined}
          />
        </Modal>
      </PageFrame>
    );
  }

  // ─── Main render — user has joined groups ──────────────────────────────────

  return (
    <PageFrame
      id="groups-page-frame"
      title="Your groups and course cohorts"
      description="Browse course groups, join one, or jump into your existing groups."
      action={
        <div style={styles.toolbar}>
          <Button
            id="join-group-button"
            variant="secondary"
            size="sm"
            leadingIcon={<UserPlus size={16} />}
            onClick={() => setJoinModalOpen(true)}
          >
            Join group
          </Button>
          {canCreateGroup && (
            <Button
              variant="primary"
              size="sm"
              leadingIcon={<Plus size={16} />}
              onClick={handleCreateGroup}
            >
              Create group
            </Button>
          )}
        </div>
      }
    >
      {/* Search + filter bar */}
      <Card style={{ padding: 18 }}>
        <div style={styles.searchBarWithFilter} className="search-bar-responsive">
          <Input
            label="Search"
            placeholder="Search by course code or group name"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            leadingIcon={<Users size={16} />}
          />
          <Select
            label="Show"
            value={filter}
            onChange={(e) => handleFilterChange(e.target.value)}
          >
            <option value="joined">Joined ({joinedGroups.length})</option>
            <option value="all">Browse all ({allGroups.length})</option>
          </Select>
        </div>

        <div style={styles.tabsWrap}>
          <Tabs
            tabs={[
              { id: 'joined', label: `Joined (${joinedGroups.length})` },
              { id: 'all', label: `Browse (${allGroups.length})` },
            ]}
            activeId={filter}
            onChange={handleFilterChange}
          />
        </div>
      </Card>

      {/* Groups list / empty */}
      {filteredGroups.length === 0 ? (
        <EmptyState
          title={
            searchTerm
              ? 'No groups match your search'
              : filter === 'joined'
                ? "You haven't joined any groups yet"
                : 'No groups available'
          }
          description={
            searchTerm
              ? 'Try a different course code or group name.'
              : filter === 'joined'
                ? 'Switch to Browse to find a group and join it.'
                : 'No public groups were found in the database.'
          }
          action={
            !searchTerm && canCreateGroup ? (
              <Button
                variant="primary"
                leadingIcon={<Plus size={16} />}
                onClick={handleCreateGroup}
              >
                Create a group
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div style={styles.groupGrid}>
          {filteredGroups.map((g) =>
            renderGroupCard(
              g,
              joinedGroups.some((j) => j.id === g.id),
            ),
          )}
        </div>
      )}

      {/* Group detail preview modal */}
      <Modal
        open={Boolean(selectedGroupId)}
        title={selectedGroup?.title ?? 'Group details'}
        description={
          selectedGroup
            ? `${selectedGroup.courseCode} · ${selectedGroup.memberCount} ${
                selectedGroup.memberCount === 1 ? 'member' : 'members'
              }`
            : undefined
        }
        onClose={() => setSelectedGroupId(null)}
        footer={
          selectedGroup ? (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Button
                variant="ghost"
                onClick={() => setSelectedGroupId(null)}
              >
                Close
              </Button>
              <Button
                variant="primary"
                onClick={() => navigate(`/groups/${selectedGroup.id}`)}
              >
                Open group
              </Button>
            </div>
          ) : null
        }
      >
        {selectedGroup && (
          <div style={{ display: 'grid', gap: 16 }}>
            {/* Summary card */}
            <Card style={{ padding: 16 }}>
              <div
                style={{
                  display: 'flex',
                  gap: 12,
                  flexWrap: 'wrap',
                  marginBottom: 10,
                }}
              >
                <span style={styles.metaItem}>
                  <Users size={13} aria-hidden />
                  {selectedGroup.memberCount}{' '}
                  {selectedGroup.memberCount === 1 ? 'member' : 'members'}
                </span>
                <span style={styles.metaItem}>
                  <Calendar size={13} aria-hidden />
                  {formatNextClass(selectedGroup.nextClass)}
                </span>
              </div>
              <p
                style={{
                  fontSize: '0.88rem',
                  color: 'var(--muted)',
                  lineHeight: 1.6,
                }}
              >
                {selectedGroup.description}
              </p>
            </Card>

            {/* Members preview */}
            <div>
              <p
                className="eyebrow eyebrow--subtle"
                style={{ marginBottom: 10 }}
              >
                Preview members
              </p>
              <div style={{ display: 'grid', gap: 8 }}>
                {selectedMembersQuery.isLoading ? (
                  <p style={{ color: 'var(--muted)', fontSize: '0.88rem' }}>
                    Loading members…
                  </p>
                ) : selectedGroupPreviewMembers.length === 0 ? (
                  <p style={{ color: 'var(--muted)', fontSize: '0.88rem' }}>
                    No member data available for this group yet.
                  </p>
                ) : (
                  selectedGroupPreviewMembers.map((member) => (
                    <div key={member.id} style={styles.memberRow}>
                      <div style={styles.memberIdentity}>
                        <div className="avatar avatar--small">
                          {member.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <strong
                            style={{
                              display: 'block',
                              fontSize: '0.88rem',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {member.name}
                          </strong>
                          <span
                            style={{
                              fontSize: '0.74rem',
                              color: 'var(--muted)',
                            }}
                          >
                            {member.joinedAt}
                          </span>
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
                  ))
                )}
              </div>
            </div>

            {/* Join from modal */}
            {!joinedGroups.some((g) => g.id === selectedGroup.id) && (
              <Button
                variant="primary"
                fullWidth
                onClick={async () => {
                  await handleJoinCard(selectedGroup.id);
                  setSelectedGroupId(null);
                }}
              >
                Join this group
              </Button>
            )}
          </div>
        )}
      </Modal>

      {/* Join by ID modal */}
      <Modal
        open={joinModalOpen}
        title="Join a group"
        description="Enter a group ID or paste an invite link to join."
        onClose={handleCloseJoinModal}
        footer={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button variant="ghost" onClick={handleCloseJoinModal}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={joinBusy}
              onClick={() => void handleJoinById()}
            >
              Join group
            </Button>
          </div>
        }
      >
        <Input
          label="Group ID or invite link"
          placeholder="CS100-B or https://studenthub.io/join/CS100-B"
          value={joinInput}
          onChange={(e) => {
            setJoinInput(e.target.value);
            if (joinError) setJoinError(null);
          }}
          error={joinError ?? undefined}
        />
      </Modal>

      {/* Responsive style helper */}
      <style>{`
        @media (max-width: 600px) {
          .search-bar-responsive {
            grid-template-columns: 1fr !important;
          }
        }
        @keyframes skeleton-wave {
          0%   { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>
    </PageFrame>
  );
}

export default GroupsPage;