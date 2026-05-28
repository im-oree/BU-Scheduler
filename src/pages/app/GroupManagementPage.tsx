// src/pages/groups/GroupManagementPage.tsx
// BU Scheduler — Group Management (Option C: React Query + Student Hub services)
// Full feature parity with Student Hub's GroupManagementPage

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import {
  CalendarDays,
  CheckCircle,
  Crown,
  Lock,
  MessageCircleOff,
  MessageSquare,
  MoreVertical,
  Plus,
  Power,
  RefreshCw,
  Search,
  Send,
  Settings2,
  Share2,
  Shield,
  Trash2,
  Unlock,
  UserMinus,
  UserPlus,
  Users,
  XCircle,
  Bell,
  MapPin,
  Clock,
  Edit2,
  Hash,
  Info,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query as firestoreQuery,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';

import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Modal,
  Select,
  Tabs,
  Textarea,
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
  type StudentHubAnnouncement,
  type StudentHubChatMessage,
  type StudentHubMember,
  type StudentHubTimetableEntry,
  type StudentHubProfile,
} from '../../lib/studenthubData';
import { getFirebaseApp } from '../../lib/firebase';
import { useAuthStore } from '../../store/useAuthStore';

// ─── Types ────────────────────────────────────────────────────────────────────

type Section =
  | 'timetable'
  | 'members'
  | 'chat'
  | 'announcements'
  | 'settings';

interface NavItem {
  id: Section;
  label: string;
  icon: LucideIcon;
  count?: number;
}

interface ClassFormData {
  className: string;
  courseCode: string;
  startTime: string;
  endTime: string;
  dayOfWeek: string;
  venue: string;
  building: string;
  instructor: string;
  isRecurring: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

const DAY_INDEX: Record<string, number> = Object.fromEntries(
  DAYS.map((d, i) => [d, i]),
);

const EMPTY_CLASS_FORM: ClassFormData = {
  className: '',
  courseCode: '',
  startTime: '',
  endTime: '',
  dayOfWeek: 'Monday',
  venue: '',
  building: '',
  instructor: '',
  isRecurring: true,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(time: string): string {
  if (!time) return '—';
  const [h, m] = time.split(':');
  const hr = parseInt(h, 10);
  if (isNaN(hr)) return time;
  return `${hr % 12 || 12}:${m} ${hr >= 12 ? 'PM' : 'AM'}`;
}

function timeAgo(isoOrNumber: string | number): string {
  if (!isoOrNumber) return '';
  const ts =
    typeof isoOrNumber === 'number'
      ? isoOrNumber
      : new Date(isoOrNumber).getTime();
  if (isNaN(ts)) return '';
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ─── Skeletons ────────────────────────────────────────────────────────────────

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

// ─── Component ────────────────────────────────────────────────────────────────

export function GroupManagementPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.session?.user.uid);
  const db = getFirestore(getFirebaseApp());
  const chatEndRef = useRef<HTMLDivElement>(null);

  // ─── UI state ─────────────────────────────────────────────────────────────

  const [section, setSection] = useState<Section>('timetable');
  const [busy, setBusy] = useState(false);

  // Timetable state
  const [classFormOpen, setClassFormOpen] = useState(false);
  const [classFormData, setClassFormData] =
    useState<ClassFormData>(EMPTY_CLASS_FORM);
  const [editingClassId, setEditingClassId] = useState<string | null>(null);
  const [classFormLoading, setClassFormLoading] = useState(false);
  const [classActionsId, setClassActionsId] = useState<string | null>(null);
  const [deletingClassId, setDeletingClassId] = useState<string | null>(null);

  // Members state
  const [memberSearch, setMemberSearch] = useState('');
  const [selectedNewMember, setSelectedNewMember] = useState<{
    id: string;
    fullName: string;
    email: string;
  } | null>(null);
  const [repSearch, setRepSearch] = useState('');
  const [selectedRepCandidate, setSelectedRepCandidate] = useState<
    StudentHubMember | null
  >(null);
  const [availableUsers, setAvailableUsers] = useState<
    Array<{ id: string; fullName: string; email: string }>
  >([]);

  // Chat state
  const [chatEnabled, setChatEnabled] = useState(true);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(
    null,
  );

  // Settings state
  const [groupPublic, setGroupPublic] = useState(true);

  // Announcements state
  const [announcementText, setAnnouncementText] = useState('');
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [sendingAnnouncement, setSendingAnnouncement] = useState(false);

  // Password state
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [passwordAction, setPasswordAction] = useState<
    'set' | 'verify' | 'remove'
  >('set');

  // Real-time overrides
  const [liveMessages, setLiveMessages] =
    useState<StudentHubChatMessage[] | null>(null);
  const [liveTimetable, setLiveTimetable] =
    useState<StudentHubTimetableEntry[] | null>(null);
  const [liveAnnouncements, setLiveAnnouncements] =
    useState<StudentHubAnnouncement[] | null>(null);

  // ─── React Query ──────────────────────────────────────────────────────────

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

  const timetableQuery = useQuery({
    queryKey: ['group-timetable', groupId],
    queryFn: () => (groupId ? fetchGroupTimetableEntries(groupId) : []),
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

  // ─── Derived data ────────────────────────────────────────────────────────

  const group = groupQuery.data;
  const rawGroup = rawGroupQuery.data;
  const members: StudentHubMember[] = membersQuery.data ?? [];
  const timetable: StudentHubTimetableEntry[] =
    liveTimetable ?? timetableQuery.data ?? [];
  const announcements: StudentHubAnnouncement[] =
    liveAnnouncements ?? announcementsQuery.data ?? [];
  const chatMessages: StudentHubChatMessage[] =
    liveMessages ?? chatQuery.data ?? [];

  // ─── Role flags ──────────────────────────────────────────────────────────

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

  const canAccess =
    roleFlags.isAdmin ||
    roleFlags.isCourseAdmin ||
    roleFlags.isCourseRep ||
    roleFlags.isGroupRep;

  // ─── Derived: member data for rep assignment ──────────────────────────────

  const currentReps: string[] = useMemo(() => {
    if (!rawGroup) return [];
    return Array.isArray(rawGroup.groupReps)
      ? (rawGroup.groupReps as string[])
      : [];
  }, [rawGroup]);

  const repCandidates = useMemo(
    () =>
      members.filter((m) => {
        const matchesSearch =
          !repSearch ||
          m.name.toLowerCase().includes(repSearch.toLowerCase());
        const notAlreadyRep = !currentReps.includes(m.id);
        return matchesSearch && notAlreadyRep;
      }),
    [members, repSearch, currentReps],
  );

  const filteredAvailableUsers = useMemo(
    () =>
      availableUsers.filter(
        (u) =>
          u.fullName.toLowerCase().includes(memberSearch.toLowerCase()) ||
          u.email.toLowerCase().includes(memberSearch.toLowerCase()),
      ),
    [availableUsers, memberSearch],
  );

  const hasPassword = Boolean(rawGroup?.groupPassword);

  // ─── Sync toggle states when rawGroup loads ──────────────────────────────

  useEffect(() => {
    if (rawGroup) {
      setChatEnabled(Boolean(rawGroup.chatEnabled ?? true));
      setGroupPublic(Boolean(rawGroup.isPublic ?? true));
    }
  }, [rawGroup]);

  // ─── Load available users for member search ──────────────────────────────

  useEffect(() => {
    if (!canAccess) return;

    async function loadUsers() {
      try {
        const snap = await getDocs(
          firestoreQuery(collection(db, 'users'), limit(500)),
        );
        setAvailableUsers(
          snap.docs.map((d) => ({
            id: d.id,
            fullName: String(
              d.data().fullName ??
                d.data().displayName ??
                'Unknown',
            ),
            email: String(d.data().email ?? ''),
          })),
        );
      } catch (err) {
        console.error('[BUScheduler] load users:', err);
      }
    }

    void loadUsers();
  }, [canAccess, db]);

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
            venue: String(
              data.venue ?? data.location ?? data.building ?? 'TBA',
            ),
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
        queryClient.setQueryData(['group-timetable', groupId], entries);
      },
      (err) => console.warn('[BUScheduler] timetable listener:', err),
    );
    return unsub;
  }, [groupId, db, queryClient]);

  // ─── Real-time: chat ──────────────────────────────────────────────────────

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
              data.author ?? data.userName ?? 'Member',
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
      (err) => console.warn('[BUScheduler] chat listener:', err),
    );
    return unsub;
  }, [groupId, db, queryClient]);

  // ─── Real-time: announcements ────────────────────────────────────────────

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
            data.createdAt ?? data.timestamp ?? '',
          );
          return {
            id: d.id,
            title: String(data.title ?? 'Announcement'),
            body: String(
              data.body ?? data.detail ?? data.message ?? data.content ?? '',
            ),
            date: rawDate.slice(0, 10),
            author: String(
              data.author ?? data.userName ?? 'Group Rep',
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
        console.warn('[BUScheduler] announcements listener:', err),
    );
    return unsub;
  }, [groupId, db, queryClient]);

  // ─── Auto-scroll chat ─────────────────────────────────────────────────────

  useEffect(() => {
    if (section === 'chat' && chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages.length, section]);

  // ═══════════════════════════════════════════════════════════════════════════
  // ACTIONS: TIMETABLE
  // ═══════════════════════════════════════════════════════════════════════════

  function openAddClass() {
    setEditingClassId(null);
    setClassFormData(EMPTY_CLASS_FORM);
    setClassFormOpen(true);
  }

  function openEditClass(entry: StudentHubTimetableEntry) {
    setEditingClassId(entry.id);
    setClassFormData({
      className: entry.courseName,
      courseCode: entry.courseCode,
      startTime: entry.startTime,
      endTime: entry.endTime,
      dayOfWeek: entry.day,
      venue: entry.venue,
      building: '',
      instructor: entry.instructor,
      isRecurring: true,
    });
    setClassFormOpen(true);
    setClassActionsId(null);
  }

  async function handleSaveClass() {
    if (!groupId || !userId) return;
    setClassFormLoading(true);
    try {
      const payload = {
        groupId,
        courseCode: classFormData.courseCode || group?.courseCode || '',
        courseName: group?.title || '',
        className: classFormData.className,
        startTime: classFormData.startTime,
        endTime: classFormData.endTime,
        dayOfWeek: classFormData.dayOfWeek,
        dayIndex: DAY_INDEX[classFormData.dayOfWeek] ?? 0,
        venue: classFormData.venue,
        building: classFormData.building,
        instructor: classFormData.instructor,
        isRecurring: classFormData.isRecurring,
        createdBy: userId,
        updatedAt: serverTimestamp(),
      };

      if (editingClassId) {
        // Update existing class
        await updateDoc(
          doc(db, 'groupTimetables', editingClassId),
          payload,
        );
      } else {
        // Create new class
        await addDoc(collection(db, 'groupTimetables'), {
          ...payload,
          createdAt: serverTimestamp(),
          isCancelled: false,
        });
      }

      setClassFormOpen(false);
      setEditingClassId(null);
      setClassFormData(EMPTY_CLASS_FORM);
      // onSnapshot auto-updates liveTimetable
    } catch (err) {
      console.error('[BUScheduler] save class:', err);
    } finally {
      setClassFormLoading(false);
    }
  }

  async function handleDeleteClass(classId: string) {
    if (!window.confirm('Delete this class permanently?')) return;
    setDeletingClassId(classId);
    try {
      await deleteDoc(doc(db, 'groupTimetables', classId));
      setClassActionsId(null);
    } catch (err) {
      console.error('[BUScheduler] delete class:', err);
    } finally {
      setDeletingClassId(null);
    }
  }

  async function handleCancelClass(
    classId: string,
    className: string,
  ) {
    const reason = window.prompt(
      `Why is "${className}" being cancelled?`,
      'No reason provided',
    );
    if (reason === null) return;

    try {
      await updateDoc(doc(db, 'groupTimetables', classId), {
        isCancelled: true,
        cancelledReason: reason,
        cancelledBy: userId,
        cancelledAt: serverTimestamp(),
      });

      // Send notification to group
      if (groupId) {
        await addDoc(
          collection(db, 'courseGroups', groupId, 'notifications'),
          {
            title: `Class Cancelled: ${className}`,
            body: `⚠️ "${className}" has been cancelled. Reason: ${reason}`,
            content: reason,
            type: 'warning',
            priority: 'high',
            author: profileQuery.data?.name ?? 'Group Rep',
            authorId: userId,
            createdAt: new Date().toISOString(),
            timestamp: serverTimestamp(),
          },
        );
      }

      setClassActionsId(null);
    } catch (err) {
      console.error('[BUScheduler] cancel class:', err);
    }
  }

  async function handleRestoreClass(
    classId: string,
    className: string,
  ) {
    if (!window.confirm(`Restore "${className}"? Members will be notified.`))
      return;

    try {
      await updateDoc(doc(db, 'groupTimetables', classId), {
        isCancelled: false,
        cancelledReason: null,
        cancelledBy: null,
        cancelledAt: null,
        restoredBy: userId,
        restoredAt: serverTimestamp(),
      });

      if (groupId) {
        await addDoc(
          collection(db, 'courseGroups', groupId, 'notifications'),
          {
            title: `Class Restored: ${className}`,
            body: `✅ "${className}" has been restored.`,
            type: 'success',
            priority: 'high',
            author: profileQuery.data?.name ?? 'Group Rep',
            authorId: userId,
            createdAt: new Date().toISOString(),
            timestamp: serverTimestamp(),
          },
        );
      }

      setClassActionsId(null);
    } catch (err) {
      console.error('[BUScheduler] restore class:', err);
    }
  }

  async function handleDeleteAllTimetable() {
    if (
      !window.confirm(
        'Delete ALL classes from the timetable? This cannot be undone.',
      )
    )
      return;
    if (!groupId) return;

    setBusy(true);
    try {
      const snap = await getDocs(
        firestoreQuery(
          collection(db, 'groupTimetables'),
          where('groupId', '==', groupId),
        ),
      );
      const deletions = snap.docs.map((d) => deleteDoc(d.ref));
      await Promise.all(deletions);
      setLiveTimetable([]);
    } catch (err) {
      console.error('[BUScheduler] delete all timetable:', err);
    } finally {
      setBusy(false);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ACTIONS: MEMBERS
  // ═══════════════════════════════════════════════════════════════════════════

  async function handleAddMember() {
    if (!selectedNewMember || !groupId || !rawGroup) return;
    setBusy(true);
    try {
      const currentMembers = Array.isArray(rawGroup.members)
        ? (rawGroup.members as Array<Record<string, unknown>>)
        : [];

      // Check if already a member
      if (
        currentMembers.some(
          (m) => String(m.userId ?? '') === selectedNewMember.id,
        )
      ) {
        window.alert('This user is already a member of the group.');
        setBusy(false);
        return;
      }

      const newMember = {
        userId: selectedNewMember.id,
        userName: selectedNewMember.fullName,
        userEmail: selectedNewMember.email,
        joinedAt: new Date().toISOString(),
        status: 'active',
      };

      const { arrayUnion, increment } = await import('firebase/firestore');
      await updateDoc(doc(db, 'courseGroups', groupId), {
        members: arrayUnion(newMember),
        memberCount: increment(1),
        updatedAt: serverTimestamp(),
      });

      setSelectedNewMember(null);
      setMemberSearch('');
      await Promise.all([rawGroupQuery.refetch(), membersQuery.refetch()]);
    } catch (err) {
      console.error('[BUScheduler] add member:', err);
    } finally {
      setBusy(false);
    }
  }

  async function handleRemoveMember(memberId: string) {
    if (!groupId || !rawGroup) return;
    if (!window.confirm('Remove this member from the group?')) return;

    const currentMembers = Array.isArray(rawGroup.members)
      ? (rawGroup.members as Array<Record<string, unknown>>)
      : [];

    const nextMembers = currentMembers.filter(
      (m) => String(m.userId ?? '') !== memberId,
    );

    // Also remove from reps if they're a rep
    const nextReps = currentReps.filter((id) => id !== memberId);

    setBusy(true);
    try {
      await updateDoc(doc(db, 'courseGroups', groupId), {
        members: nextMembers,
        memberCount: nextMembers.length,
        groupReps: nextReps,
        updatedAt: serverTimestamp(),
      });
      await Promise.all([rawGroupQuery.refetch(), membersQuery.refetch()]);
    } catch (err) {
      console.error('[BUScheduler] remove member:', err);
    } finally {
      setBusy(false);
    }
  }

  async function handleAssignRep() {
    if (!selectedRepCandidate || !groupId) return;
    setBusy(true);
    try {
      await updateDoc(doc(db, 'courseGroups', groupId), {
        groupReps: [
          ...new Set([...currentReps, selectedRepCandidate.id]),
        ],
        updatedAt: serverTimestamp(),
      });
      setSelectedRepCandidate(null);
      setRepSearch('');
      await rawGroupQuery.refetch();
    } catch (err) {
      console.error('[BUScheduler] assign rep:', err);
    } finally {
      setBusy(false);
    }
  }

  async function handleRemoveRep(memberId: string) {
    if (currentReps.length <= 1) {
      window.alert('Cannot remove the last group rep.');
      return;
    }
    if (!window.confirm('Remove this member as group rep?')) return;
    if (!groupId) return;

    setBusy(true);
    try {
      await updateDoc(doc(db, 'courseGroups', groupId), {
        groupReps: currentReps.filter((id) => id !== memberId),
        updatedAt: serverTimestamp(),
      });
      await rawGroupQuery.refetch();
    } catch (err) {
      console.error('[BUScheduler] remove rep:', err);
    } finally {
      setBusy(false);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ACTIONS: CHAT
  // ═══════════════════════════════════════════════════════════════════════════

  async function handleToggleChat() {
    const next = !chatEnabled;
    setChatEnabled(next);
    await updateGroupField({ chatEnabled: next });
  }

  async function handleDeleteMessage(messageId: string) {
    if (!groupId) return;
    if (!window.confirm('Delete this message?')) return;
    setDeletingMessageId(messageId);
    try {
      await deleteDoc(
        doc(db, 'groupChats', groupId, 'messages', messageId),
      );
    } catch (err) {
      console.error('[BUScheduler] delete message:', err);
    } finally {
      setDeletingMessageId(null);
    }
  }

  async function handleClearChat() {
    if (
      !window.confirm(
        'Delete ALL chat messages? This cannot be undone.',
      )
    )
      return;
    if (!groupId) return;

    setBusy(true);
    try {
      let deletedCount = 0;
      // Delete in batches of 100
      while (true) {
        const snap = await getDocs(
          firestoreQuery(
            collection(db, 'groupChats', groupId, 'messages'),
            limit(100),
          ),
        );
        if (snap.empty) break;
        const batch = snap.docs.map((d) => deleteDoc(d.ref));
        await Promise.all(batch);
        deletedCount += snap.size;
        if (snap.size < 100) break;
      }
      setLiveMessages([]);
      window.alert(`${deletedCount} message(s) deleted.`);
    } catch (err) {
      console.error('[BUScheduler] clear chat:', err);
    } finally {
      setBusy(false);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ACTIONS: ANNOUNCEMENTS
  // ═══════════════════════════════════════════════════════════════════════════

  async function handleSendAnnouncement() {
    if (!announcementText.trim() || !groupId || !userId) return;
    setSendingAnnouncement(true);
    try {
      await addDoc(
        collection(db, 'courseGroups', groupId, 'notifications'),
        {
          title: announcementTitle.trim() || 'Group Notification',
          body: announcementText.trim(),
          content: announcementText.trim(),
          message: announcementText.trim(),
          type: 'info',
          priority: 'medium',
          author: profileQuery.data?.name ?? 'Group Rep',
          authorId: userId,
          createdAt: new Date().toISOString(),
          timestamp: serverTimestamp(),
        },
      );
      setAnnouncementTitle('');
      setAnnouncementText('');
    } catch (err) {
      console.error('[BUScheduler] send announcement:', err);
    } finally {
      setSendingAnnouncement(false);
    }
  }

  async function handleDeleteAnnouncement(announcementId: string) {
    if (!window.confirm('Delete this announcement?')) return;
    if (!groupId) return;
    try {
      await deleteDoc(
        doc(
          db,
          'courseGroups',
          groupId,
          'notifications',
          announcementId,
        ),
      );
    } catch (err) {
      console.error('[BUScheduler] delete announcement:', err);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ACTIONS: SETTINGS / PASSWORD / SHARE
  // ═══════════════════════════════════════════════════════════════════════════

  async function updateGroupField(patch: Record<string, unknown>) {
    if (!groupId) return;
    setBusy(true);
    try {
      await updateDoc(doc(db, 'courseGroups', groupId), {
        ...patch,
        updatedAt: serverTimestamp(),
      });
      await Promise.all([rawGroupQuery.refetch(), groupQuery.refetch()]);
    } finally {
      setBusy(false);
    }
  }

  async function handleSetPassword() {
    if (!passwordInput.trim()) return;
    if (passwordAction === 'set') {
      if (passwordInput !== passwordConfirm) {
        window.alert('Passwords do not match.');
        return;
      }
      setBusy(true);
      try {
        // In production you'd hash this — storing plain for simplicity
        // matching Student Hub's hashPassword pattern
        await updateGroupField({ groupPassword: passwordInput.trim() });
        setPasswordModalOpen(false);
        setPasswordInput('');
        setPasswordConfirm('');
        window.alert('Password saved.');
      } finally {
        setBusy(false);
      }
    } else if (passwordAction === 'verify') {
      const stored = String(rawGroup?.groupPassword ?? '');
      if (passwordInput === stored) {
        window.alert('✓ Password is correct.');
      } else {
        window.alert('✗ Incorrect password.');
      }
      setPasswordModalOpen(false);
      setPasswordInput('');
    }
  }

  async function handleRemovePassword() {
    if (!window.confirm('Remove password? Anyone can join freely.')) return;
    await updateGroupField({ groupPassword: '' });
    window.alert('Password removed.');
  }

  async function handleShareInvite() {
    if (!groupId) return;
    const url = `${window.location.origin}/join?groupId=${encodeURIComponent(groupId)}${userId ? `&invitedBy=${encodeURIComponent(userId)}` : ''}`;
    const text = `Join ${group?.title ?? groupId}: ${url}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: `Join ${group?.title ?? groupId}`, text, url });
        return;
      }
    } catch {
      /* fallback */
    }
    try {
      await navigator.clipboard.writeText(text);
      window.alert('Invite link copied!');
    } catch {
      window.alert('Could not copy invite link.');
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

  if (
    groupQuery.isLoading ||
    rawGroupQuery.isLoading ||
    membersQuery.isLoading
  ) {
    return (
      <PageFrame
        eyebrow="Group management"
        title="Loading group…"
        description="Preparing management tools."
      >
        <SectionSkeleton />
      </PageFrame>
    );
  }

  if (groupQuery.isError || !group) {
    return (
      <PageFrame
        eyebrow="Group management"
        title="Group not found"
        description="This group could not be loaded."
      >
        <EmptyState
          title="Failed to load group"
          description={
            groupQuery.isError
              ? 'Error fetching the group. Please try again.'
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

  if (!canAccess) {
    return (
      <PageFrame
        eyebrow="Group management"
        title={group.title}
        description="You do not have permission to manage this group."
      >
        <EmptyState
          title="Access denied"
          description="Only admins, course admins, course reps, and group reps can manage this group."
          icon={<Shield size={20} />}
          action={
            <Button
              variant="secondary"
              onClick={() => navigate(`/groups/${groupId}`)}
            >
              Back to group
            </Button>
          }
        />
      </PageFrame>
    );
  }

  // ─── Nav items ────────────────────────────────────────────────────────────

  const navItems: NavItem[] = [
    { id: 'timetable', label: 'Timetable', icon: CalendarDays, count: timetable.length },
    { id: 'members', label: 'Members', icon: Users, count: members.length },
    { id: 'chat', label: 'Chat', icon: MessageSquare, count: chatMessages.length },
    { id: 'announcements', label: 'Announcements', icon: Bell, count: announcements.length },
    { id: 'settings', label: 'Settings', icon: Settings2 },
  ];

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <PageFrame
      eyebrow="Group management"
      title={group.title}
      description={`${group.courseCode} · Level ${group.level} · ${members.length} members`}
      action={
        <div style={{ display: 'flex', gap: 8 }}>
          <Button
            variant="ghost"
            leadingIcon={<Share2 size={16} />}
            onClick={() => void handleShareInvite()}
          >
            Share invite
          </Button>
          <Button
            variant="secondary"
            onClick={() => navigate(`/groups/${groupId}`)}
          >
            Back to group
          </Button>
        </div>
      }
    >
      <div
        className="section-block"
        style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 16 }}
      >
        {/* ── Sidebar nav ──────────────────────────────────────────────── */}
        <Card>
          <div style={{ display: 'grid', gap: 8 }}>
            {navItems.map(({ id, label, icon: Icon, count }) => (
              <Button
                key={id}
                variant={section === id ? 'primary' : 'ghost'}
                leadingIcon={<Icon size={16} />}
                onClick={() => setSection(id)}
                fullWidth
              >
                {label}
                {count != null && count > 0 && (
                  <Badge tone="neutral" style={{ marginLeft: 'auto' }}>
                    {count}
                  </Badge>
                )}
              </Button>
            ))}
          </div>
        </Card>

        {/* ── Content area ─────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gap: 16 }}>
          {/* ══ TIMETABLE ═════════════════════════════════════════════════ */}
          {section === 'timetable' && (
            <Card>
              <div className="table-header">
                <div>
                  <h2>Timetable</h2>
                  <p className="muted">
                    {timetable.length} class
                    {timetable.length !== 1 ? 'es' : ''} scheduled.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button
                    variant="primary"
                    leadingIcon={<Plus size={16} />}
                    onClick={openAddClass}
                  >
                    Add class
                  </Button>
                  {timetable.length > 0 && (
                    <Button
                      variant="ghost"
                      leadingIcon={<Trash2 size={16} />}
                      loading={busy}
                      onClick={() => void handleDeleteAllTimetable()}
                    >
                      Delete all
                    </Button>
                  )}
                </div>
              </div>

              {timetable.length === 0 ? (
                <EmptyState
                  title="No classes yet"
                  description="Add the first class to the timetable."
                  action={
                    <Button
                      variant="primary"
                      leadingIcon={<Plus size={16} />}
                      onClick={openAddClass}
                    >
                      Add first class
                    </Button>
                  }
                />
              ) : (
                <div className="timeline-list">
                  {timetable.map((entry) => {
                    const isCancelled = Boolean(
                      (entry as Record<string, unknown>).isCancelled,
                    );
                    const cancelledReason = String(
                      (entry as Record<string, unknown>).cancelledReason ?? '',
                    );

                    return (
                      <Card
                        key={entry.id}
                        className="timeline-card"
                        style={{
                          opacity: isCancelled ? 0.6 : 1,
                          position: 'relative',
                        }}
                      >
                        <div className="timeline-card__left">
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <Badge tone={isCancelled ? 'danger' : 'info'}>
                              {entry.courseCode}
                            </Badge>
                            {isCancelled && (
                              <Badge tone="danger">Cancelled</Badge>
                            )}
                          </div>
                          <h3
                            style={{
                              textDecoration: isCancelled
                                ? 'line-through'
                                : undefined,
                            }}
                          >
                            {entry.courseName}
                          </h3>
                          <p>{entry.day}</p>
                          {isCancelled && cancelledReason && (
                            <p
                              className="muted"
                              style={{ fontSize: 12, marginTop: 4 }}
                            >
                              Reason: {cancelledReason}
                            </p>
                          )}
                        </div>
                        <div className="timeline-card__right">
                          <span>
                            {fmt(entry.startTime)} – {fmt(entry.endTime)}
                          </span>
                          <span>{entry.venue}</span>
                          <span>{entry.instructor}</span>
                        </div>

                        {/* Actions menu */}
                        <div
                          style={{
                            position: 'absolute',
                            top: 8,
                            right: 8,
                          }}
                        >
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setClassActionsId(
                                classActionsId === entry.id
                                  ? null
                                  : entry.id,
                              )
                            }
                          >
                            <MoreVertical size={14} />
                          </Button>

                          {classActionsId === entry.id && (
                            <Card
                              style={{
                                position: 'absolute',
                                right: 0,
                                top: 32,
                                minWidth: 180,
                                zIndex: 10,
                                padding: 4,
                              }}
                            >
                              <Button
                                variant="ghost"
                                size="sm"
                                fullWidth
                                leadingIcon={<Edit2 size={14} />}
                                onClick={() => openEditClass(entry)}
                              >
                                Edit class
                              </Button>

                              {isCancelled ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  fullWidth
                                  leadingIcon={<CheckCircle size={14} />}
                                  onClick={() =>
                                    void handleRestoreClass(
                                      entry.id,
                                      entry.courseName,
                                    )
                                  }
                                >
                                  Restore class
                                </Button>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  fullWidth
                                  leadingIcon={<XCircle size={14} />}
                                  onClick={() =>
                                    void handleCancelClass(
                                      entry.id,
                                      entry.courseName,
                                    )
                                  }
                                >
                                  Cancel class
                                </Button>
                              )}

                              <Button
                                variant="ghost"
                                size="sm"
                                fullWidth
                                leadingIcon={<Trash2 size={14} />}
                                loading={deletingClassId === entry.id}
                                onClick={() =>
                                  void handleDeleteClass(entry.id)
                                }
                                style={{ color: 'var(--color-danger)' }}
                              >
                                Delete class
                              </Button>
                            </Card>
                          )}
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </Card>
          )}

          {/* ══ MEMBERS ═══════════════════════════════════════════════════ */}
          {section === 'members' && (
            <div style={{ display: 'grid', gap: 16 }}>
              {/* Add member by search */}
              <Card>
                <div className="table-header">
                  <div>
                    <h2>Add member</h2>
                    <p className="muted">
                      Search for users by name or email to add them.
                    </p>
                  </div>
                </div>

                <div style={{ position: 'relative' }}>
                  <Input
                    label="Search users"
                    placeholder="Search by name or email…"
                    value={memberSearch}
                    onChange={(e) => {
                      setMemberSearch(e.target.value);
                      setSelectedNewMember(null);
                    }}
                  />
                </div>

                {memberSearch && !selectedNewMember && (
                  <div
                    className="member-table member-table--dense"
                    style={{ marginTop: 8, maxHeight: 200, overflowY: 'auto' }}
                  >
                    {filteredAvailableUsers.length === 0 ? (
                      <p className="muted" style={{ padding: 12 }}>
                        No users found.
                      </p>
                    ) : (
                      filteredAvailableUsers.slice(0, 6).map((u) => (
                        <div
                          key={u.id}
                          className="member-row"
                          style={{ cursor: 'pointer' }}
                          onClick={() => {
                            setSelectedNewMember(u);
                            setMemberSearch('');
                          }}
                        >
                          <div className="member-row__identity">
                            <div className="avatar avatar--small">
                              {u.fullName.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <strong>{u.fullName}</strong>
                              <span>{u.email}</span>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {selectedNewMember && (
                  <Card style={{ marginTop: 8, padding: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div className="avatar avatar--small">
                        {selectedNewMember.fullName
                          .slice(0, 2)
                          .toUpperCase()}
                      </div>
                      <div style={{ flex: 1 }}>
                        <strong>{selectedNewMember.fullName}</strong>
                        <p className="muted">{selectedNewMember.email}</p>
                      </div>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        gap: 8,
                        marginTop: 10,
                      }}
                    >
                      <Button
                        variant="primary"
                        leadingIcon={<UserPlus size={14} />}
                        loading={busy}
                        onClick={() => void handleAddMember()}
                      >
                        Add member
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setSelectedNewMember(null);
                          setMemberSearch('');
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </Card>
                )}
              </Card>

              {/* Member list */}
              <Card>
                <div className="table-header">
                  <h2>
                    Members{' '}
                    <span className="muted">({members.length})</span>
                  </h2>
                  <Button
                    variant="ghost"
                    leadingIcon={<Share2 size={14} />}
                    onClick={() => void handleShareInvite()}
                    size="sm"
                  >
                    Share invite
                  </Button>
                </div>

                {members.length === 0 ? (
                  <EmptyState
                    title="No members yet"
                    description="Add members using the search above or share the invite link."
                  />
                ) : (
                  <div className="member-table">
                    {members.map((member) => {
                      const isRep = currentReps.includes(member.id);
                      const isYou = member.id === userId;
                      return (
                        <div key={member.id} className="member-row">
                          <div className="member-row__identity">
                            <div className="avatar avatar--small">
                              {member.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <strong>
                                {member.name}
                                {isYou && (
                                  <Badge
                                    tone="success"
                                    style={{ marginLeft: 6 }}
                                  >
                                    You
                                  </Badge>
                                )}
                              </strong>
                              <span>Joined {member.joinedAt}</span>
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

                          <div
                            style={{
                              display: 'flex',
                              gap: 6,
                              flexWrap: 'wrap',
                            }}
                          >
                            {!isRep && (
                              <Button
                                variant="ghost"
                                size="sm"
                                leadingIcon={<Crown size={14} />}
                                onClick={() => {
                                  setSelectedRepCandidate(member);
                                  void handleAssignRep();
                                }}
                                disabled={busy}
                              >
                                Make rep
                              </Button>
                            )}
                            {isRep && currentReps.length > 1 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                leadingIcon={<XCircle size={14} />}
                                onClick={() =>
                                  void handleRemoveRep(member.id)
                                }
                                disabled={busy}
                              >
                                Remove rep
                              </Button>
                            )}
                            {!isYou && (
                              <Button
                                variant="ghost"
                                size="sm"
                                leadingIcon={<UserMinus size={14} />}
                                onClick={() =>
                                  void handleRemoveMember(member.id)
                                }
                                disabled={busy}
                                style={{ color: 'var(--color-danger)' }}
                              >
                                Remove
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>

              {/* Assign rep section */}
              {repCandidates.length > 0 && (
                <Card>
                  <div className="table-header">
                    <div>
                      <h2>
                        <Crown
                          size={16}
                          style={{
                            display: 'inline',
                            marginRight: 6,
                            verticalAlign: 'middle',
                          }}
                        />
                        Assign group rep
                      </h2>
                      <p className="muted">
                        Promote an existing member to group rep.
                      </p>
                    </div>
                  </div>

                  <Input
                    label="Search members"
                    placeholder="Search existing members…"
                    value={repSearch}
                    onChange={(e) => {
                      setRepSearch(e.target.value);
                      setSelectedRepCandidate(null);
                    }}
                  />

                  {repSearch && !selectedRepCandidate && (
                    <div
                      className="member-table member-table--dense"
                      style={{ marginTop: 8, maxHeight: 200, overflowY: 'auto' }}
                    >
                      {repCandidates.length === 0 ? (
                        <p className="muted" style={{ padding: 12 }}>
                          No candidates found.
                        </p>
                      ) : (
                        repCandidates.map((m) => (
                          <div
                            key={m.id}
                            className="member-row"
                            style={{ cursor: 'pointer' }}
                            onClick={() => {
                              setSelectedRepCandidate(m);
                              setRepSearch('');
                            }}
                          >
                            <div className="member-row__identity">
                              <div className="avatar avatar--small">
                                {m.name.slice(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <strong>{m.name}</strong>
                                <span>{m.joinedAt}</span>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {selectedRepCandidate && (
                    <Card style={{ marginTop: 8, padding: 12 }}>
                      <strong>{selectedRepCandidate.name}</strong>
                      <div
                        style={{
                          display: 'flex',
                          gap: 8,
                          marginTop: 8,
                        }}
                      >
                        <Button
                          variant="primary"
                          leadingIcon={<Crown size={14} />}
                          loading={busy}
                          onClick={() => void handleAssignRep()}
                        >
                          Assign as rep
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => {
                            setSelectedRepCandidate(null);
                            setRepSearch('');
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </Card>
                  )}
                </Card>
              )}
            </div>
          )}

          {/* ══ CHAT ══════════════════════════════════════════════════════ */}
          {section === 'chat' && (
            <Card>
              <div className="table-header">
                <div>
                  <h2>Chat management</h2>
                  <p className="muted">
                    {chatEnabled ? 'Chat is active.' : 'Chat is disabled.'}
                    {' '}{chatMessages.length} message
                    {chatMessages.length !== 1 ? 's' : ''}.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button
                    variant={chatEnabled ? 'secondary' : 'primary'}
                    leadingIcon={<Power size={16} />}
                    onClick={() => void handleToggleChat()}
                    loading={busy}
                  >
                    {chatEnabled ? 'Disable chat' : 'Enable chat'}
                  </Button>
                  {chatMessages.length > 0 && (
                    <Button
                      variant="ghost"
                      leadingIcon={<Trash2 size={16} />}
                      loading={busy}
                      onClick={() => void handleClearChat()}
                      style={{ color: 'var(--color-danger)' }}
                    >
                      Clear all
                    </Button>
                  )}
                </div>
              </div>

              {/* Messages */}
              <div
                className="chat-panel__history"
                style={{
                  marginTop: 16,
                  maxHeight: 400,
                  overflowY: 'auto',
                  display: 'grid',
                  gap: 4,
                }}
              >
                {chatMessages.length === 0 ? (
                  <EmptyState
                    title="No messages yet"
                    description="Messages will appear here."
                  />
                ) : (
                  chatMessages.map((message) => (
                    <div
                      key={message.id}
                      style={{ position: 'relative' }}
                    >
                      <GroupChatMessageItem message={message} />
                      <Button
                        variant="ghost"
                        size="sm"
                        leadingIcon={<Trash2 size={12} />}
                        loading={deletingMessageId === message.id}
                        onClick={() =>
                          void handleDeleteMessage(message.id)
                        }
                        style={{ position: 'absolute', top: 4, right: 4 }}
                      />
                    </div>
                  ))
                )}
                <div ref={chatEndRef} />
              </div>
            </Card>
          )}

          {/* ══ ANNOUNCEMENTS ═════════════════════════════════════════════ */}
          {section === 'announcements' && (
            <div style={{ display: 'grid', gap: 16 }}>
              {/* Compose announcement */}
              <Card>
                <div className="table-header">
                  <div>
                    <h2>Send announcement</h2>
                    <p className="muted">
                      Publish a notification to all group members.
                    </p>
                  </div>
                </div>

                <div style={{ display: 'grid', gap: 10 }}>
                  <Input
                    label="Title (optional)"
                    placeholder="Announcement title"
                    value={announcementTitle}
                    onChange={(e) =>
                      setAnnouncementTitle(e.target.value)
                    }
                  />
                  <Textarea
                    label="Message"
                    placeholder="Write your announcement…"
                    value={announcementText}
                    onChange={(e) =>
                      setAnnouncementText(e.target.value)
                    }
                    rows={3}
                  />
                  <Button
                    variant="primary"
                    leadingIcon={<Send size={16} />}
                    loading={sendingAnnouncement}
                    disabled={!announcementText.trim()}
                    onClick={() => void handleSendAnnouncement()}
                  >
                    Send to all members
                  </Button>
                </div>
              </Card>

              {/* Announcement list */}
              <Card>
                <div className="table-header">
                  <h2>
                    Published{' '}
                    <span className="muted">
                      ({announcements.length})
                    </span>
                  </h2>
                </div>

                {announcements.length === 0 ? (
                  <EmptyState
                    title="No announcements yet"
                    description="Publish the first announcement above."
                  />
                ) : (
                  <div className="announcement-list">
                    {announcements.map((a) => (
                      <Card
                        key={a.id}
                        style={{ position: 'relative' }}
                      >
                        <strong>{a.title}</strong>
                        <p className="muted">{a.body}</p>
                        <span className="muted">
                          {a.author} ·{' '}
                          {timeAgo(a.date) || a.date}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          leadingIcon={<Trash2 size={12} />}
                          onClick={() =>
                            void handleDeleteAnnouncement(a.id)
                          }
                          style={{
                            position: 'absolute',
                            top: 8,
                            right: 8,
                            color: 'var(--color-danger)',
                          }}
                        />
                      </Card>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          )}

          {/* ══ SETTINGS ══════════════════════════════════════════════════ */}
          {section === 'settings' && (
            <div style={{ display: 'grid', gap: 16 }}>
              {/* Group info */}
              <Card>
                <div className="table-header">
                  <h2>Group information</h2>
                </div>
                <div className="member-table">
                  <div className="member-row">
                    <div>
                      <strong>Course code</strong>
                      <p className="muted">{group.courseCode}</p>
                    </div>
                    <Badge tone="info">{group.level}</Badge>
                  </div>
                  <div className="member-row">
                    <div>
                      <strong>Members</strong>
                      <p className="muted">
                        {members.length} member
                        {members.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      leadingIcon={<Users size={16} />}
                      onClick={() => setSection('members')}
                    >
                      Manage
                    </Button>
                  </div>
                  <div className="member-row">
                    <div>
                      <strong>Group reps</strong>
                      <p className="muted">
                        {currentReps.length} rep
                        {currentReps.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <Badge tone="warning">
                      <Crown
                        size={12}
                        style={{ marginRight: 4 }}
                      />
                      {currentReps.length}
                    </Badge>
                  </div>
                </div>
              </Card>

              {/* Toggles */}
              <Card>
                <div className="table-header">
                  <h2>Visibility & chat</h2>
                </div>
                <div className="member-table">
                  <div className="member-row">
                    <div>
                      <strong>Public listing</strong>
                      <p className="muted">
                        When on, this group appears in the group
                        browser.
                      </p>
                    </div>
                    <Button
                      variant={groupPublic ? 'secondary' : 'primary'}
                      loading={busy}
                      onClick={async () => {
                        const next = !groupPublic;
                        setGroupPublic(next);
                        await updateGroupField({ isPublic: next });
                      }}
                    >
                      {groupPublic ? 'Turn off' : 'Turn on'}
                    </Button>
                  </div>
                  <div className="member-row">
                    <div>
                      <strong>Group chat</strong>
                      <p className="muted">
                        Allow members to send messages.
                      </p>
                    </div>
                    <Button
                      variant={chatEnabled ? 'secondary' : 'primary'}
                      loading={busy}
                      onClick={async () => {
                        const next = !chatEnabled;
                        setChatEnabled(next);
                        await updateGroupField({ chatEnabled: next });
                      }}
                    >
                      {chatEnabled ? 'Disable' : 'Enable'}
                    </Button>
                  </div>
                </div>
              </Card>

              {/* Security */}
              <Card>
                <div className="table-header">
                  <div>
                    <h2>
                      <Shield
                        size={16}
                        style={{
                          display: 'inline',
                          marginRight: 6,
                          verticalAlign: 'middle',
                        }}
                      />
                      Security
                    </h2>
                    <p className="muted">
                      Password protection for this group.
                    </p>
                  </div>
                </div>

                <div className="member-table">
                  <div className="member-row">
                    <div>
                      <strong>Password</strong>
                      <p className="muted">
                        {hasPassword
                          ? 'Password is set. Members need it to join.'
                          : 'No password. Anyone can join freely.'}
                      </p>
                    </div>
                    <Badge tone={hasPassword ? 'success' : 'neutral'}>
                      {hasPassword ? (
                        <>
                          <Lock size={12} style={{ marginRight: 4 }} />
                          Protected
                        </>
                      ) : (
                        <>
                          <Unlock size={12} style={{ marginRight: 4 }} />
                          Open
                        </>
                      )}
                    </Badge>
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    gap: 8,
                    flexWrap: 'wrap',
                    marginTop: 12,
                  }}
                >
                  <Button
                    variant="secondary"
                    leadingIcon={<Lock size={14} />}
                    onClick={() => {
                      setPasswordAction('set');
                      setPasswordInput('');
                      setPasswordConfirm('');
                      setPasswordModalOpen(true);
                    }}
                  >
                    {hasPassword ? 'Change password' : 'Set password'}
                  </Button>
                  {hasPassword && (
                    <>
                      <Button
                        variant="ghost"
                        leadingIcon={<Shield size={14} />}
                        onClick={() => {
                          setPasswordAction('verify');
                          setPasswordInput('');
                          setPasswordModalOpen(true);
                        }}
                      >
                        Verify password
                      </Button>
                      <Button
                        variant="ghost"
                        leadingIcon={<Unlock size={14} />}
                        onClick={() => void handleRemovePassword()}
                        style={{ color: 'var(--color-danger)' }}
                      >
                        Remove password
                      </Button>
                    </>
                  )}
                </div>
              </Card>
            </div>
          )}
        </div>
      </div>

      {/* ══ CLASS FORM MODAL ══════════════════════════════════════════════ */}
      <Modal
        open={classFormOpen}
        title={editingClassId ? 'Edit class' : 'Add class'}
        description="Fill in the class details below."
        onClose={() => {
          setClassFormOpen(false);
          setEditingClassId(null);
          setClassFormData(EMPTY_CLASS_FORM);
        }}
        footer={
          <div className="modal-actions">
            <Button
              variant="ghost"
              onClick={() => {
                setClassFormOpen(false);
                setEditingClassId(null);
                setClassFormData(EMPTY_CLASS_FORM);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={classFormLoading}
              disabled={
                !classFormData.className.trim() ||
                !classFormData.startTime ||
                !classFormData.endTime
              }
              onClick={() => void handleSaveClass()}
            >
              {editingClassId ? 'Save changes' : 'Add class'}
            </Button>
          </div>
        }
      >
        <div style={{ display: 'grid', gap: 12 }}>
          <Input
            label="Class name *"
            placeholder="e.g. Introduction to Programming"
            value={classFormData.className}
            onChange={(e) =>
              setClassFormData((f) => ({
                ...f,
                className: e.target.value,
              }))
            }
          />
          <Input
            label="Course code"
            placeholder="e.g. CS101"
            value={classFormData.courseCode}
            onChange={(e) =>
              setClassFormData((f) => ({
                ...f,
                courseCode: e.target.value,
              }))
            }
          />
          <Select
            label="Day of week"
            value={classFormData.dayOfWeek}
            onChange={(e) =>
              setClassFormData((f) => ({
                ...f,
                dayOfWeek: e.target.value,
              }))
            }
          >
            {DAYS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </Select>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 12,
            }}
          >
            <Input
              label="Start time *"
              type="time"
              value={classFormData.startTime}
              onChange={(e) =>
                setClassFormData((f) => ({
                  ...f,
                  startTime: e.target.value,
                }))
              }
            />
            <Input
              label="End time *"
              type="time"
              value={classFormData.endTime}
              onChange={(e) =>
                setClassFormData((f) => ({
                  ...f,
                  endTime: e.target.value,
                }))
              }
            />
          </div>
          <Input
            label="Venue"
            placeholder="e.g. Room 204, Block A"
            value={classFormData.venue}
            onChange={(e) =>
              setClassFormData((f) => ({
                ...f,
                venue: e.target.value,
              }))
            }
          />
          <Input
            label="Building"
            placeholder="e.g. Science Block"
            value={classFormData.building}
            onChange={(e) =>
              setClassFormData((f) => ({
                ...f,
                building: e.target.value,
              }))
            }
          />
          <Input
            label="Instructor"
            placeholder="e.g. Dr. Smith"
            value={classFormData.instructor}
            onChange={(e) =>
              setClassFormData((f) => ({
                ...f,
                instructor: e.target.value,
              }))
            }
          />
        </div>
      </Modal>

      {/* ══ PASSWORD MODAL ════════════════════════════════════════════════ */}
      <Modal
        open={passwordModalOpen}
        title={
          passwordAction === 'set'
            ? hasPassword
              ? 'Change password'
              : 'Set password'
            : 'Verify password'
        }
        description={
          passwordAction === 'set'
            ? 'Members will need this password to join the group.'
            : 'Enter the current password to verify it.'
        }
        onClose={() => {
          setPasswordModalOpen(false);
          setPasswordInput('');
          setPasswordConfirm('');
        }}
        footer={
          <div className="modal-actions">
            <Button
              variant="ghost"
              onClick={() => {
                setPasswordModalOpen(false);
                setPasswordInput('');
                setPasswordConfirm('');
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={busy}
              disabled={!passwordInput.trim()}
              onClick={() => void handleSetPassword()}
            >
              {passwordAction === 'set' ? 'Save password' : 'Verify'}
            </Button>
          </div>
        }
      >
        <div style={{ display: 'grid', gap: 12 }}>
          <Input
            label={
              passwordAction === 'set' ? 'New password' : 'Password'
            }
            type="password"
            placeholder="Enter password"
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
          />
          {passwordAction === 'set' && (
            <Input
              label="Confirm password"
              type="password"
              placeholder="Re-enter password"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
            />
          )}
        </div>
      </Modal>
    </PageFrame>
  );
}

export default GroupManagementPage;