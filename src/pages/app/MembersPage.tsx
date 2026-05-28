// src/pages/members/MembersPage.tsx
// BU Scheduler — Members Page
// React Query + onSnapshot + studenthubData + Role features

import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  doc,
  getFirestore,
  onSnapshot,
} from 'firebase/firestore';
import {
  Crown,
  Loader2,
  RefreshCw,
  Search,
  Shield,
  UserPlus,
  Users,
  X,
} from 'lucide-react';

import { Badge, Button, Card, EmptyState, Input, Select } from '../../components/ui';
import { PageFrame } from '../../components/shared';
import { useAuthStore } from '../../store/useAuthStore';
import {
  fetchCurrentUserProfile,
  fetchGroupById,
  fetchGroupDocument,
  fetchGroupMembers,
  getGroupRoleFlags,
  type StudentHubMember,
} from '../../lib/studenthubData';
import { getFirebaseApp } from '../../lib/firebase';

// ─── Types ────────────────────────────────────────────────────────────────────

type RoleFilter = 'all' | 'Member' | 'Group Rep' | 'Course Rep';

// ─── Component ────────────────────────────────────────────────────────────────

export function MembersPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.session?.user.uid);
  const db = getFirestore(getFirebaseApp());

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');

  // Live members via snapshot
  const [liveMembers, setLiveMembers] = useState<StudentHubMember[] | null>(null);

  // ─── React Query ────────────────────────────────────────────────────────

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

  // ─── Derived ────────────────────────────────────────────────────────────

  const group = groupQuery.data;
  const rawGroup = rawGroupQuery.data;
  const members: StudentHubMember[] = liveMembers ?? membersQuery.data ?? [];

  const roleFlags = useMemo(
    () =>
      getGroupRoleFlags(
        userId ?? '',
        profileQuery.data ?? null,
        groupId ?? '',
        rawGroup ?? null,
      ),
    [userId, profileQuery.data, groupId, rawGroup],
  );

  const canManage =
    roleFlags.isAdmin ||
    roleFlags.isCourseAdmin ||
    roleFlags.isCourseRep ||
    roleFlags.isGroupRep;

  const groupReps = useMemo<Set<string>>(() => {
    if (!rawGroup) return new Set();
    const reps = Array.isArray(rawGroup.groupReps)
      ? (rawGroup.groupReps as string[])
      : [];
    return new Set(reps);
  }, [rawGroup]);

  // Role counts
  const roleCounts = useMemo(() => {
    const counts = { all: 0, Member: 0, 'Group Rep': 0, 'Course Rep': 0 };
    members.forEach((m) => {
      counts.all++;
      if (m.role in counts) counts[m.role as keyof typeof counts]++;
    });
    return counts;
  }, [members]);

  // Filtered members
  const filteredMembers = useMemo(() => {
    let list = members;

    if (roleFilter !== 'all') {
      list = list.filter((m) => m.role === roleFilter);
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.role.toLowerCase().includes(q),
      );
    }

    // Sort: Course Reps first, then Group Reps, then Members, then self on top
    return [...list].sort((a, b) => {
      const order = { 'Course Rep': 0, 'Group Rep': 1, Member: 2 };
      const aOrder = order[a.role as keyof typeof order] ?? 3;
      const bOrder = order[b.role as keyof typeof order] ?? 3;
      if (aOrder !== bOrder) return aOrder - bOrder;
      // Self always first within same role
      if (a.id === userId) return -1;
      if (b.id === userId) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [members, roleFilter, searchTerm, userId]);

  // ─── Real-time: group doc (members array) ───────────────────────────────

  useEffect(() => {
    if (!groupId) return;

    const unsub = onSnapshot(
      doc(db, 'courseGroups', groupId),
      async (snap) => {
        if (!snap.exists()) return;
        const data = snap.data() as Record<string, unknown>;

        // Update raw group cache
        queryClient.setQueryData(['group-raw', groupId], {
          id: snap.id,
          ...data,
        });

        // Re-derive members from the raw data
        // We need to call fetchGroupMembers again to get proper mapping
        try {
          const freshMembers = await fetchGroupMembers(groupId);
          setLiveMembers(freshMembers);
          queryClient.setQueryData(['group-members', groupId], freshMembers);
        } catch {
          // Fallback: don't update
        }
      },
      (err) => console.warn('[BUScheduler] members group listener:', err),
    );

    return unsub;
  }, [groupId, db, queryClient]);

  // ─── Guards ─────────────────────────────────────────────────────────────

  if (!groupId) {
    return (
      <PageFrame eyebrow="Members" title="Members">
        <EmptyState
          title="No group selected"
          description="Navigate to a group to view its members."
        />
      </PageFrame>
    );
  }

  if (groupQuery.isLoading || membersQuery.isLoading) {
    return (
      <PageFrame
        eyebrow="Members"
        title="Loading members…"
        description="Fetching group member data."
      >
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
          Loading members…
        </div>
      </PageFrame>
    );
  }

  if (groupQuery.isError || !group) {
    return (
      <PageFrame eyebrow="Members" title="Group not found">
        <EmptyState
          title="Failed to load group"
          description="The group could not be found."
          action={
            <div style={{ display: 'flex', gap: 8 }}>
              <Button
                variant="primary"
                leadingIcon={<RefreshCw size={16} />}
                onClick={() => {
                  void groupQuery.refetch();
                  void membersQuery.refetch();
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

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <PageFrame
      eyebrow="Members"
      title={`${group.title} members`}
      description={`${group.courseCode} · Level ${group.level} · ${members.length} members`}
      action={
        <div style={{ display: 'flex', gap: 8 }}>
          {canManage && (
            <Button
              variant="primary"
              leadingIcon={<UserPlus size={16} />}
              onClick={() => navigate(`/groups/${groupId}/manage`)}
            >
              Manage members
            </Button>
          )}
          <Button
            variant="ghost"
            leadingIcon={<RefreshCw size={16} />}
            onClick={() => void membersQuery.refetch()}
          >
            Refresh
          </Button>
        </div>
      }
    >
      {/* ── Filters ─────────────────────────────────────────────────── */}
      <Card>
        <div
          className="table-header"
          style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}
        >
          <div style={{ flex: 1, minWidth: 200 }}>
            <Input
              label="Search members"
              placeholder="Search by name…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div style={{ minWidth: 140 }}>
            <Select
              label="Role"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as RoleFilter)}
            >
              <option value="all">All roles ({roleCounts.all})</option>
              <option value="Member">Members ({roleCounts.Member})</option>
              <option value="Group Rep">Group Reps ({roleCounts['Group Rep']})</option>
              <option value="Course Rep">Course Reps ({roleCounts['Course Rep']})</option>
            </Select>
          </div>
        </div>

        {/* Summary */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
          <Badge tone="neutral">
            {filteredMembers.length} of {members.length} shown
          </Badge>
          {roleCounts['Course Rep'] > 0 && (
            <Badge tone="warning">
              <Crown size={10} style={{ marginRight: 3 }} />
              {roleCounts['Course Rep']} Course Rep
              {roleCounts['Course Rep'] !== 1 ? 's' : ''}
            </Badge>
          )}
          {roleCounts['Group Rep'] > 0 && (
            <Badge tone="success">
              <Shield size={10} style={{ marginRight: 3 }} />
              {roleCounts['Group Rep']} Group Rep
              {roleCounts['Group Rep'] !== 1 ? 's' : ''}
            </Badge>
          )}
        </div>
      </Card>

      {/* ── Member list ─────────────────────────────────────────────── */}
      {filteredMembers.length === 0 ? (
        <EmptyState
          title={
            searchTerm || roleFilter !== 'all'
              ? 'No members match'
              : 'No members yet'
          }
          description={
            searchTerm || roleFilter !== 'all'
              ? 'Try different search terms or clear the filter.'
              : 'Members will appear here when they join the group.'
          }
          icon={<Users size={20} />}
          action={
            (searchTerm || roleFilter !== 'all') ? (
              <Button
                variant="ghost"
                onClick={() => {
                  setSearchTerm('');
                  setRoleFilter('all');
                }}
              >
                Clear filters
              </Button>
            ) : undefined
          }
        />
      ) : (
        <Card>
          <div className="member-table member-table--dense">
            {filteredMembers.map((member) => {
              const isYou = member.id === userId;
              const isRep =
                member.role === 'Course Rep' || member.role === 'Group Rep';

              return (
                <div
                  key={member.id}
                  className="member-row"
                  style={{
                    borderLeft: isRep
                      ? member.role === 'Course Rep'
                        ? '3px solid var(--warning, #F59E0B)'
                        : '3px solid var(--success, #2ECC71)'
                      : '3px solid transparent',
                    paddingLeft: 14,
                  }}
                >
                  {/* Identity */}
                  <div className="member-row__identity">
                    <div
                      className="avatar avatar--small"
                      style={{
                        background: isRep
                          ? member.role === 'Course Rep'
                            ? 'var(--warning-soft, rgba(245,158,11,0.15))'
                            : 'var(--success-soft, rgba(46,204,113,0.15))'
                          : undefined,
                        color: isRep
                          ? member.role === 'Course Rep'
                            ? 'var(--warning, #F59E0B)'
                            : 'var(--success, #2ECC71)'
                          : undefined,
                        fontWeight: isRep ? 700 : undefined,
                      }}
                    >
                      {member.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <strong>{member.name}</strong>
                        {isYou && (
                          <Badge tone="success" style={{ fontSize: '0.64rem' }}>
                            You
                          </Badge>
                        )}
                      </div>
                      <span>Joined {member.joinedAt}</span>
                    </div>
                  </div>

                  {/* Role badge */}
                  <Badge
                    tone={
                      member.role === 'Course Rep'
                        ? 'warning'
                        : member.role === 'Group Rep'
                        ? 'success'
                        : 'neutral'
                    }
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    {(member.role === 'Course Rep' || member.role === 'Group Rep') && (
                      <Crown size={10} />
                    )}
                    {member.role}
                  </Badge>

                  {/* Action */}
                  {canManage && !isYou && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(`/groups/${groupId}/manage`)}
                    >
                      Manage
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </PageFrame>
  );
}

export default MembersPage;