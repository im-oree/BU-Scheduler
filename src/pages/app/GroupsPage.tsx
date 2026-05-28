// src/pages/groups/GroupsPage.tsx
// BU Scheduler — aligned to Student Hub data layer (Option C)
// React Query (stable) + onSnapshot (real-time) + studenthubData functions

import { useEffect, useMemo, useRef, useState } from 'react';
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
  ChevronRight,
  Crown,
  Loader2,
  Plus,
  Search,
  UserPlus,
  Users,
  X,
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
 * Mirrors Student Hub's join flow parsing.
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

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function GroupCardSkeleton() {
  return (
    <div
      style={{
        height: 120,
        borderRadius: 12,
        backgroundColor: 'var(--color-surface)',
        animation: 'pulse 1.5s ease-in-out infinite',
      }}
    />
  );
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
  const [searchFocused, setSearchFocused] = useState(false);

  // Group detail modal state
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  // Real-time patches on top of React Query cache
  const [liveGroups, setLiveGroups] = useState<StudentHubGroup[] | null>(null);

  const userId = useAuthStore((s) => s.session?.user.uid);

  // ─── React Query: stable fetches ────────────────────────────────────────────

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
  const selectedMembers: StudentHubMember[] =
    selectedMembersQuery.data ?? [];
  const selectedGroupPreviewMembers = selectedMembers.slice(0, 4);

  // Permissions — mirrors Student Hub canCreateGroup check
  const canCreateGroup = Boolean(
    profileQuery.data?.role === 'admin' ||
      (profileQuery.data?.courseAdmins ?? []).length > 0 ||
      (profileQuery.data?.courseReps ?? []).length > 0 ||
      (profileQuery.data?.levelCourseReps ?? []).length > 0,
  );

  // ─── Real-time: courseGroups collection ────────────────────────────────────
  // Mirrors Student Hub's onSnapshot on courseGroups
  // Updates allGroups live without waiting for React Query staleTime

  useEffect(() => {
    const q = firestoreQuery(
      collection(db, 'courseGroups'),
      limit(500),
    );

    const unsub = onSnapshot(
      q,
      async (snap) => {
        // Map raw Firestore docs → StudentHubGroup shape using the same
        // field names that studenthubData.ts reads
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
        // Keep React Query cache warm so navigating away + back is instant
        queryClient.setQueryData(['groups-all'], mapped);

        // Re-derive joined groups from live data using userId
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
      setJoinError(
        'Please enter a valid group ID or invite link.',
      );
      return;
    }
    if (!userId || !profileQuery.data) return;

    setJoinBusy(true);
    setJoinError(null);
    try {
      const result = await joinGroup(groupId, profileQuery.data, userId);
      // Refresh both queries — onSnapshot will also update live state
      await Promise.all([
        joinedGroupsQuery.refetch(),
        allGroupsQuery.refetch(),
      ]);
      handleCloseJoinModal();
      if (result.alreadyJoined) {
        // Already a member — go straight to group
        navigate(`/groups/${groupId}`);
      } else {
        navigate(`/groups/${groupId}`);
      }
    } catch (err) {
      setJoinError(
        err instanceof Error ? err.message : 'Failed to join group.',
      );
    } finally {
      setJoinBusy(false);
    }
  }

  async function handleJoinCard(groupId: string) {
    if (!userId || !profileQuery.data) return;
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
        <div
          className="section-block"
          style={{ display: 'grid', gap: 12 }}
        >
          {[1, 2, 3].map((i) => (
            <GroupCardSkeleton key={i} />
          ))}
        </div>
      </PageFrame>
    );
  }

  // ─── Error state ───────────────────────────────────────────────────────────

  if (joinedGroupsQuery.isError || allGroupsQuery.isError) {
    return (
      <PageFrame
        eyebrow="Groups"
        title="Your groups and course cohorts"
        description="Browse available course groups, join one, or jump into your joined groups."
      >
        <div className="error-state" role="alert">
          <AlertCircle className="error-state__icon" aria-hidden="true" />
          <p className="error-state__message">
            We couldn't load groups. Please check your connection and try
            again.
          </p>
          <Button
            variant="secondary"
            onClick={() => {
              void joinedGroupsQuery.refetch();
              void allGroupsQuery.refetch();
            }}
          >
            Retry
          </Button>
        </div>
      </PageFrame>
    );
  }

  // ─── No groups joined — browse view ────────────────────────────────────────
  // Mirrors Student Hub's "no groups" browse/join screen

  if (joinedGroups.length === 0) {
    return (
      <PageFrame
        eyebrow="Groups"
        title="Find your course group"
        description="Join a group to access the timetable, chat, and updates."
        action={
          <Button
            variant="secondary"
            leadingIcon={<UserPlus size={18} />}
            onClick={() => setJoinModalOpen(true)}
          >
            Join by ID
          </Button>
        }
      >
        {/* Search bar */}
        <Card>
          <div
            className="search-bar"
            style={{
              border: searchFocused
                ? '1.5px solid var(--color-accent)'
                : undefined,
            }}
          >
            <Input
              label="Search"
              placeholder="Search by course code or group name…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
            />
          </div>
          <p className="muted" style={{ marginTop: 6, fontSize: 12 }}>
            {allGroups.length} group
            {allGroups.length !== 1 ? 's' : ''} available
          </p>
        </Card>

        {/* Group browse list */}
        {allGroups.length === 0 ? (
          <EmptyState
            title="No groups found"
            description="No public groups are available right now. Check back later."
            icon={<BookOpen size={20} />}
          />
        ) : (
          <div
            className="group-grid group-grid--dense"
            style={{ display: 'grid', gap: 10 }}
          >
            {allGroups
              .filter(
                (g) =>
                  !searchTerm ||
                  g.title
                    .toLowerCase()
                    .includes(searchTerm.toLowerCase()) ||
                  g.courseCode
                    .toLowerCase()
                    .includes(searchTerm.toLowerCase()),
              )
              .map((g) => (
                <Card
                  key={g.id}
                  className="group-card group-card--compact"
                >
                  <div className="group-card__top">
                    <div style={{ minWidth: 0 }}>
                      <Badge tone="info">{g.courseCode}</Badge>
                      <h3>{g.title}</h3>
                      <p className="muted">{g.description}</p>
                    </div>
                    <div className="group-card__icon" aria-hidden="true">
                      <Users size={18} />
                    </div>
                  </div>
                  <div className="group-card__meta">
                    <span>{g.memberCount} members</span>
                    <span>{g.nextClass}</span>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      gap: 8,
                      marginTop: 8,
                      flexWrap: 'wrap',
                    }}
                  >
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedGroupId(g.id)}
                    >
                      Preview
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => void handleJoinCard(g.id)}
                    >
                      Join group
                    </Button>
                  </div>
                </Card>
              ))}
          </div>
        )}

        {/* Join by ID modal */}
        <Modal
          open={joinModalOpen}
          title="Join a group"
          description="Enter a group ID or paste an invite link to join."
          onClose={handleCloseJoinModal}
          footer={
            <div className="modal-actions">
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
      eyebrow="Groups"
      title="Your groups and course cohorts"
      description="Browse every available course group, join one, or jump into your joined groups."
      action={
        <div className="toolbar-actions">
          <Button
            variant="secondary"
            leadingIcon={<UserPlus size={18} />}
            onClick={() => setJoinModalOpen(true)}
          >
            Join group
          </Button>
          {canCreateGroup && (
            <Button
              variant="primary"
              leadingIcon={<Plus size={18} />}
              onClick={handleCreateGroup}
            >
              Create group
            </Button>
          )}
        </div>
      }
    >
      {/* Search + filter bar */}
      <Card>
        <div className="search-bar">
          <Input
            label="Search"
            placeholder="Search by course code or group name"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <Select
            label="Filter"
            value={filter}
            onChange={(e) => handleFilterChange(e.target.value)}
          >
            <option value="joined">
              Joined ({joinedGroups.length})
            </option>
            <option value="all">Browse all ({allGroups.length})</option>
          </Select>
        </div>

        <Tabs
          tabs={[
            {
              id: 'joined',
              label: `Joined (${joinedGroups.length})`,
            },
            {
              id: 'all',
              label: `Browse (${allGroups.length})`,
            },
          ]}
          activeId={filter}
          onChange={handleFilterChange}
        />
      </Card>

      {/* Groups list or empty state */}
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
                leadingIcon={<Plus size={18} />}
                onClick={handleCreateGroup}
              >
                Create a group
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="group-grid group-grid--dense">
          {filteredGroups.map((group) => {
            const isJoined = joinedGroups.some((g) => g.id === group.id);
            return (
              <Card
                key={group.id}
                className="group-card group-card--compact"
              >
                <div className="group-card__top">
                  <div style={{ minWidth: 0 }}>
                    <Badge tone="info">{group.courseCode}</Badge>
                    <h3>{group.title}</h3>
                    <p className="muted">{group.description}</p>
                  </div>
                  <div
                    className="group-card__icon"
                    aria-hidden="true"
                  >
                    <Users size={18} />
                  </div>
                </div>

                <div className="group-card__meta">
                  <span>{group.memberCount} members</span>
                  <span>{group.nextClass}</span>
                </div>

                <div
                  style={{
                    display: 'flex',
                    gap: 8,
                    alignItems: 'center',
                    flexWrap: 'wrap',
                  }}
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedGroupId(group.id)}
                  >
                    View members
                  </Button>

                  {isJoined ? (
                    <Button
                      variant="primary"
                      size="sm"
                      leadingIcon={<ChevronRight size={14} />}
                      onClick={() => navigate(`/groups/${group.id}`)}
                    >
                      Open group
                    </Button>
                  ) : (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => void handleJoinCard(group.id)}
                    >
                      Join group
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Group detail preview modal */}
      <Modal
        open={Boolean(selectedGroupId)}
        title={selectedGroup?.title ?? 'Group details'}
        description={
          selectedGroup
            ? `${selectedGroup.courseCode} · ${selectedGroup.memberCount} members`
            : undefined
        }
        onClose={() => setSelectedGroupId(null)}
        footer={
          selectedGroup ? (
            <div className="modal-actions">
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
          <div style={{ display: 'grid', gap: 14 }}>
            <Card>
              <div className="group-card__meta">
                <span>{selectedGroup.memberCount} members</span>
                <span>{selectedGroup.nextClass}</span>
              </div>
              <p className="muted" style={{ marginTop: 8 }}>
                {selectedGroup.description}
              </p>
            </Card>

            <div>
              <p className="eyebrow eyebrow--subtle">Preview members</p>
              <div
                className="member-table member-table--dense"
                style={{ marginTop: 10 }}
              >
                {selectedMembersQuery.isLoading ? (
                  <p className="muted">Loading members…</p>
                ) : selectedGroupPreviewMembers.length === 0 ? (
                  <p className="muted">
                    No member data available for this group yet.
                  </p>
                ) : (
                  selectedGroupPreviewMembers.map((member) => (
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
                  ))
                )}
              </div>
            </div>

            {/* Join from modal */}
            {!joinedGroups.some((g) => g.id === selectedGroup.id) && (
              <Button
                variant="primary"
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
          <div className="modal-actions">
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
    </PageFrame>
  );
}

export default GroupsPage;