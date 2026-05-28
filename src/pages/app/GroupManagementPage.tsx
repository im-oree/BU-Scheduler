// src/pages/groups/GroupManagementPage.tsx
// BU Scheduler — Group Management (Mobile-friendly + redesigned)

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Bell,
  CalendarDays,
  CheckCircle,
  Crown,
  Edit2,
  Lock,
  MessageSquare,
  MoreVertical,
  Plus,
  Power,
  RefreshCw,
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
  type StudentHubAnnouncement,
  type StudentHubChatMessage,
  type StudentHubMember,
  type StudentHubTimetableEntry,
} from '../../lib/studenthubData';
import { getFirebaseApp } from '../../lib/firebase';
import { useAuthStore } from '../../store/useAuthStore';

// ─── Types ────────────────────────────────────────────────────────────────────

type Section = 'timetable' | 'members' | 'chat' | 'announcements' | 'settings';

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

function useIsMobile(breakpoint = 900) {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(`(max-width: ${breakpoint}px)`).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [breakpoint]);

  return isMobile;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = {
  shell: {
    display: 'grid',
    gap: 16,
    minWidth: 0,
  } as CSSProperties,

  layoutDesktop: {
    display: 'grid',
    gridTemplateColumns: '240px 1fr',
    gap: 16,
    alignItems: 'start',
    minWidth: 0,
  } as CSSProperties,

  layoutMobile: {
    display: 'grid',
    gap: 14,
    minWidth: 0,
  } as CSSProperties,

  sidebarCard: {
    padding: 12,
    position: 'sticky',
    top: 76,
    display: 'grid',
    gap: 4,
  } as CSSProperties,

  navItem: (active: boolean) => ({
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 12px',
    borderRadius: 10,
    border: 'none',
    background: active
      ? 'var(--primary-soft, #F2F8E6)'
      : 'transparent',
    color: active
      ? 'var(--tertiary, #5A8A00)'
      : 'var(--text, #1C1C1E)',
    fontWeight: active ? 600 : 500,
    fontSize: '0.88rem',
    cursor: 'pointer',
    textAlign: 'left' as const,
    width: '100%',
    transition: 'background 160ms ease',
  }) as (active: boolean) => CSSProperties,

  navItemLabel: {
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  } as CSSProperties,

  navCount: {
    fontSize: '0.7rem',
    padding: '2px 7px',
    borderRadius: 999,
    background: 'var(--bg-muted, #F1F3F8)',
    color: 'var(--muted, #6B7280)',
    fontWeight: 600,
  } as CSSProperties,

  mobileTabBar: {
    display: 'flex',
    gap: 6,
    overflowX: 'auto',
    padding: '4px 2px',
    scrollbarWidth: 'none',
    WebkitOverflowScrolling: 'touch',
  } as CSSProperties,

  mobileTab: (active: boolean) => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 14px',
    borderRadius: 999,
    border: '1px solid',
    borderColor: active
      ? 'var(--primary, #7CB518)'
      : 'var(--line, #E6E8EC)',
    background: active
      ? 'var(--primary-soft, #F2F8E6)'
      : 'var(--surface, #FFFFFF)',
    color: active
      ? 'var(--tertiary, #5A8A00)'
      : 'var(--muted, #6B7280)',
    fontSize: '0.82rem',
    fontWeight: active ? 600 : 500,
    whiteSpace: 'nowrap' as const,
    cursor: 'pointer',
    flexShrink: 0,
  }) as (active: boolean) => CSSProperties,

  content: {
    display: 'grid',
    gap: 14,
    minWidth: 0,
  } as CSSProperties,

  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    flexWrap: 'wrap',
    marginBottom: 14,
    minWidth: 0,
  } as CSSProperties,

  sectionTitle: {
    display: 'grid',
    gap: 4,
    minWidth: 0,
  } as CSSProperties,

  sectionH2: {
    fontSize: '1.05rem',
    margin: 0,
  } as CSSProperties,

  sectionDesc: {
    fontSize: '0.82rem',
    color: 'var(--muted, #6B7280)',
    margin: 0,
  } as CSSProperties,

  sectionActions: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
  } as CSSProperties,

  classCard: (cancelled: boolean) => ({
    padding: 14,
    opacity: cancelled ? 0.7 : 1,
    display: 'grid',
    gap: 10,
    position: 'relative' as const,
    overflow: 'visible' as const,
  }) as (c: boolean) => CSSProperties,

  classHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
    minWidth: 0,
  } as CSSProperties,

  classTitleWrap: {
    display: 'grid',
    gap: 4,
    minWidth: 0,
    flex: 1,
  } as CSSProperties,

  classTitle: {
    fontSize: '0.95rem',
    margin: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  } as CSSProperties,

  classMeta: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px 14px',
    fontSize: '0.78rem',
    color: 'var(--muted, #6B7280)',
  } as CSSProperties,

  classMetaItem: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
  } as CSSProperties,

  actionMenu: {
    position: 'absolute' as const,
    right: 0,
    top: 38,
    minWidth: 180,
    zIndex: 20,
    padding: 6,
    display: 'grid',
    gap: 2,
    background: 'var(--surface, #FFFFFF)',
    border: '1px solid var(--line, #E6E8EC)',
    borderRadius: 12,
    boxShadow: '0 12px 36px rgba(0,0,0,0.12)',
  } as CSSProperties,

  memberRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '12px',
    borderRadius: 10,
    background: 'var(--bg-muted, #F1F3F8)',
    flexWrap: 'wrap',
    minWidth: 0,
  } as CSSProperties,

  memberIdentity: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
    flex: '1 1 200px',
  } as CSSProperties,

  memberIdentityText: {
    display: 'grid',
    gap: 2,
    minWidth: 0,
    flex: 1,
  } as CSSProperties,

  memberName: {
    fontSize: '0.88rem',
    fontWeight: 600,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  } as CSSProperties,

  memberSub: {
    fontSize: '0.74rem',
    color: 'var(--muted, #6B7280)',
  } as CSSProperties,

  memberActions: {
    display: 'flex',
    gap: 6,
    flexWrap: 'wrap',
  } as CSSProperties,

  searchResults: {
    marginTop: 10,
    maxHeight: 240,
    overflowY: 'auto',
    display: 'grid',
    gap: 6,
  } as CSSProperties,

  selectedCard: {
    marginTop: 12,
    padding: 14,
  } as CSSProperties,

  infoRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    padding: '14px 0',
    borderBottom: '1px solid var(--divider, #ECEEF3)',
    flexWrap: 'wrap',
  } as CSSProperties,

  infoRowLast: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    padding: '14px 0 0',
    flexWrap: 'wrap',
  } as CSSProperties,

  infoLabel: {
    display: 'grid',
    gap: 4,
    minWidth: 0,
    flex: 1,
  } as CSSProperties,

  infoTitle: {
    fontSize: '0.9rem',
    fontWeight: 600,
  } as CSSProperties,

  infoDesc: {
    fontSize: '0.78rem',
    color: 'var(--muted, #6B7280)',
  } as CSSProperties,

  skeleton: {
    height: 76,
    borderRadius: 12,
    background:
      'linear-gradient(90deg, var(--bg-muted, #F1F3F8) 0%, var(--surface-2, #E8EAF0) 50%, var(--bg-muted, #F1F3F8) 100%)',
    backgroundSize: '200% 100%',
    animation: 'skeleton-wave 1.5s ease-in-out infinite',
  } as CSSProperties,

  chatBox: {
    marginTop: 14,
    maxHeight: 460,
    overflowY: 'auto',
    display: 'grid',
    gap: 6,
    padding: 8,
    background: 'var(--bg-muted, #F1F3F8)',
    borderRadius: 12,
  } as CSSProperties,
} as const;

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SectionSkeleton() {
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {[1, 2, 3].map((i) => (
        <div key={i} style={styles.skeleton} aria-hidden />
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
  const isMobile = useIsMobile(900);

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
  const [selectedRepCandidate, setSelectedRepCandidate] =
    useState<StudentHubMember | null>(null);
  const [availableUsers, setAvailableUsers] = useState<
    Array<{ id: string; fullName: string; email: string }>
  >([]);

  // Chat state
  const [chatEnabled, setChatEnabled] = useState(true);
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
              d.data().fullName ?? d.data().displayName ?? 'Unknown',
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
            dayIndex: typeof data.dayIndex === 'number' ? data.dayIndex : 0,
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
            author: String(data.author ?? data.userName ?? 'Member'),
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
          const rawDate = String(data.createdAt ?? data.timestamp ?? '');
          return {
            id: d.id,
            title: String(data.title ?? 'Announcement'),
            body: String(
              data.body ??
                data.detail ??
                data.message ??
                data.content ??
                '',
            ),
            date: rawDate.slice(0, 10),
            author: String(data.author ?? data.userName ?? 'Group Rep'),
          };
        });
        setLiveAnnouncements(items);
        queryClient.setQueryData(['group-announcements', groupId], items);
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

  // ─── Close action menu on outside click ───────────────────────────────────

  useEffect(() => {
    if (!classActionsId) return;
    const handler = () => setClassActionsId(null);
    const timer = setTimeout(
      () => document.addEventListener('click', handler),
      0,
    );
    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handler);
    };
  }, [classActionsId]);

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
        await updateDoc(doc(db, 'groupTimetables', editingClassId), payload);
      } else {
        await addDoc(collection(db, 'groupTimetables'), {
          ...payload,
          createdAt: serverTimestamp(),
          isCancelled: false,
        });
      }

      setClassFormOpen(false);
      setEditingClassId(null);
      setClassFormData(EMPTY_CLASS_FORM);
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

  async function handleCancelClass(classId: string, className: string) {
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

  async function handleRestoreClass(classId: string, className: string) {
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

  async function handleAssignRep(candidate?: StudentHubMember) {
    const target = candidate ?? selectedRepCandidate;
    if (!target || !groupId) return;
    setBusy(true);
    try {
      await updateDoc(doc(db, 'courseGroups', groupId), {
        groupReps: [...new Set([...currentReps, target.id])],
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
      await deleteDoc(doc(db, 'groupChats', groupId, 'messages', messageId));
    } catch (err) {
      console.error('[BUScheduler] delete message:', err);
    } finally {
      setDeletingMessageId(null);
    }
  }

  async function handleClearChat() {
    if (
      !window.confirm('Delete ALL chat messages? This cannot be undone.')
    )
      return;
    if (!groupId) return;

    setBusy(true);
    try {
      let deletedCount = 0;
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
        doc(db, 'courseGroups', groupId, 'notifications', announcementId),
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
        await navigator.share({
          title: `Join ${group?.title ?? groupId}`,
          text,
          url,
        });
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
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Button
                variant="primary"
                size="sm"
                leadingIcon={<RefreshCw size={14} />}
                onClick={() => {
                  void groupQuery.refetch();
                  void rawGroupQuery.refetch();
                }}
              >
                Retry
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => navigate(-1)}
              >
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
              size="sm"
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
    {
      id: 'timetable',
      label: 'Timetable',
      icon: CalendarDays,
      count: timetable.length,
    },
    { id: 'members', label: 'Members', icon: Users, count: members.length },
    {
      id: 'chat',
      label: 'Chat',
      icon: MessageSquare,
      count: chatMessages.length,
    },
    {
      id: 'announcements',
      label: 'Announcements',
      icon: Bell,
      count: announcements.length,
    },
    { id: 'settings', label: 'Settings', icon: Settings2 },
  ];

  // ─── Renderers (DRY) ──────────────────────────────────────────────────────

  function renderSidebar() {
    if (isMobile) {
      return (
        <div style={styles.mobileTabBar} className="scroll-hide">
          {navItems.map(({ id, label, icon: Icon, count }) => (
            <button
              key={id}
              type="button"
              style={styles.mobileTab(section === id)}
              onClick={() => setSection(id)}
            >
              <Icon size={14} />
              <span>{label}</span>
              {count != null && count > 0 && (
                <span
                  style={{
                    fontSize: '0.68rem',
                    padding: '1px 6px',
                    borderRadius: 999,
                    background:
                      section === id
                        ? 'var(--primary, #7CB518)'
                        : 'var(--bg-muted, #F1F3F8)',
                    color:
                      section === id
                        ? '#fff'
                        : 'var(--muted, #6B7280)',
                    fontWeight: 600,
                  }}
                >
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>
      );
    }

    return (
      <Card style={styles.sidebarCard}>
        {navItems.map(({ id, label, icon: Icon, count }) => (
          <button
            key={id}
            type="button"
            style={styles.navItem(section === id)}
            onClick={() => setSection(id)}
          >
            <Icon size={16} />
            <span style={styles.navItemLabel}>{label}</span>
            {count != null && count > 0 && (
              <span style={styles.navCount}>{count}</span>
            )}
          </button>
        ))}
      </Card>
    );
  }

  function renderSectionHeader(
    title: string,
    desc: string,
    actions?: React.ReactNode,
  ) {
    return (
      <div style={styles.sectionHeader}>
        <div style={styles.sectionTitle}>
          <h2 style={styles.sectionH2}>{title}</h2>
          <p style={styles.sectionDesc}>{desc}</p>
        </div>
        {actions && <div style={styles.sectionActions}>{actions}</div>}
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <PageFrame
      eyebrow="Group management"
      title={group.title}
      description={`${group.courseCode} · Level ${group.level} · ${members.length} ${members.length === 1 ? 'member' : 'members'}`}
      action={
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button
            variant="ghost"
            size="sm"
            leadingIcon={<Share2 size={14} />}
            onClick={() => void handleShareInvite()}
          >
            Share
          </Button>
          <Button
            variant="secondary"
            size="sm"
            leadingIcon={<ArrowLeft size={14} />}
            onClick={() => navigate(`/groups/${groupId}`)}
          >
            Back
          </Button>
        </div>
      }
    >
      <style>{`
        .scroll-hide::-webkit-scrollbar { display: none; }
        @keyframes skeleton-wave {
          0%   { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>

      <div style={isMobile ? styles.layoutMobile : styles.layoutDesktop}>
        {/* ── Sidebar / Mobile tabs ───────────────────────────────────── */}
        {renderSidebar()}

        {/* ── Content area ────────────────────────────────────────────── */}
        <div style={styles.content}>
          {/* ══ TIMETABLE ══════════════════════════════════════════════ */}
          {section === 'timetable' && (
            <Card style={{ padding: 18 }}>
              {renderSectionHeader(
                'Timetable',
                `${timetable.length} ${timetable.length === 1 ? 'class' : 'classes'} scheduled.`,
                <>
                  <Button
                    variant="primary"
                    size="sm"
                    leadingIcon={<Plus size={14} />}
                    onClick={openAddClass}
                  >
                    Add class
                  </Button>
                  {timetable.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      leadingIcon={<Trash2 size={14} />}
                      loading={busy}
                      onClick={() => void handleDeleteAllTimetable()}
                    >
                      Delete all
                    </Button>
                  )}
                </>,
              )}

              {timetable.length === 0 ? (
                <EmptyState
                  title="No classes yet"
                  description="Add the first class to the timetable."
                  action={
                    <Button
                      variant="primary"
                      size="sm"
                      leadingIcon={<Plus size={14} />}
                      onClick={openAddClass}
                    >
                      Add first class
                    </Button>
                  }
                />
              ) : (
                <div style={{ display: 'grid', gap: 10 }}>
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
                        style={styles.classCard(isCancelled)}
                      >
                        <div style={styles.classHeader}>
                          <div style={styles.classTitleWrap}>
                            <div
                              style={{
                                display: 'flex',
                                gap: 6,
                                flexWrap: 'wrap',
                              }}
                            >
                              <Badge tone={isCancelled ? 'danger' : 'info'}>
                                {entry.courseCode}
                              </Badge>
                              {isCancelled && (
                                <Badge tone="danger">Cancelled</Badge>
                              )}
                            </div>
                            <h3
                              style={{
                                ...styles.classTitle,
                                textDecoration: isCancelled
                                  ? 'line-through'
                                  : undefined,
                              }}
                            >
                              {entry.courseName}
                            </h3>
                          </div>

                          <div
                            style={{ position: 'relative' }}
                            onClick={(e) => e.stopPropagation()}
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
                              aria-label="Class actions"
                            >
                              <MoreVertical size={14} />
                            </Button>

                            {classActionsId === entry.id && (
                              <div style={styles.actionMenu}>
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
                                    Restore
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
                                    Cancel
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
                                  style={{ color: 'var(--error, #EF4444)' }}
                                >
                                  Delete
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>

                        <div style={styles.classMeta}>
                          <span style={styles.classMetaItem}>
                            <CalendarDays size={12} />
                            {entry.day}
                          </span>
                          <span style={styles.classMetaItem}>
                            ⏰ {fmt(entry.startTime)} – {fmt(entry.endTime)}
                          </span>
                          <span style={styles.classMetaItem}>
                            📍 {entry.venue}
                          </span>
                          <span style={styles.classMetaItem}>
                            👤 {entry.instructor}
                          </span>
                        </div>

                        {isCancelled && cancelledReason && (
                          <p
                            style={{
                              fontSize: 12,
                              color: 'var(--error, #EF4444)',
                              padding: 8,
                              background:
                                'var(--error-soft, #FEE2E2)',
                              borderRadius: 8,
                            }}
                          >
                            <strong>Reason:</strong> {cancelledReason}
                          </p>
                        )}
                      </Card>
                    );
                  })}
                </div>
              )}
            </Card>
          )}

          {/* ══ MEMBERS ════════════════════════════════════════════════ */}
          {section === 'members' && (
            <div style={{ display: 'grid', gap: 14 }}>
              {/* Add member */}
              <Card style={{ padding: 18 }}>
                {renderSectionHeader(
                  'Add member',
                  'Search for users by name or email to add them.',
                )}

                <Input
                  label="Search users"
                  placeholder="Search by name or email…"
                  value={memberSearch}
                  onChange={(e) => {
                    setMemberSearch(e.target.value);
                    setSelectedNewMember(null);
                  }}
                />

                {memberSearch && !selectedNewMember && (
                  <div style={styles.searchResults}>
                    {filteredAvailableUsers.length === 0 ? (
                      <p
                        style={{
                          color: 'var(--muted)',
                          fontSize: '0.86rem',
                          padding: 12,
                        }}
                      >
                        No users found.
                      </p>
                    ) : (
                      filteredAvailableUsers.slice(0, 6).map((u) => (
                        <div
                          key={u.id}
                          style={{
                            ...styles.memberRow,
                            cursor: 'pointer',
                          }}
                          onClick={() => {
                            setSelectedNewMember(u);
                            setMemberSearch('');
                          }}
                        >
                          <div style={styles.memberIdentity}>
                            <div className="avatar avatar--small">
                              {u.fullName.slice(0, 2).toUpperCase()}
                            </div>
                            <div style={styles.memberIdentityText}>
                              <span style={styles.memberName}>
                                {u.fullName}
                              </span>
                              <span style={styles.memberSub}>{u.email}</span>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {selectedNewMember && (
                  <Card style={styles.selectedCard}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                      }}
                    >
                      <div className="avatar avatar--small">
                        {selectedNewMember.fullName
                          .slice(0, 2)
                          .toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <strong style={{ fontSize: '0.9rem' }}>
                          {selectedNewMember.fullName}
                        </strong>
                        <p
                          style={{
                            fontSize: '0.78rem',
                            color: 'var(--muted)',
                          }}
                        >
                          {selectedNewMember.email}
                        </p>
                      </div>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        gap: 8,
                        marginTop: 12,
                        flexWrap: 'wrap',
                      }}
                    >
                      <Button
                        variant="primary"
                        size="sm"
                        leadingIcon={<UserPlus size={14} />}
                        loading={busy}
                        onClick={() => void handleAddMember()}
                      >
                        Add member
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
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
              <Card style={{ padding: 18 }}>
                {renderSectionHeader(
                  `Members (${members.length})`,
                  'All current group members.',
                  <Button
                    variant="ghost"
                    size="sm"
                    leadingIcon={<Share2 size={14} />}
                    onClick={() => void handleShareInvite()}
                  >
                    Share invite
                  </Button>,
                )}

                {members.length === 0 ? (
                  <EmptyState
                    title="No members yet"
                    description="Add members using the search above or share the invite link."
                  />
                ) : (
                  <div style={{ display: 'grid', gap: 8 }}>
                    {members.map((member) => {
                      const isRep = currentReps.includes(member.id);
                      const isYou = member.id === userId;
                      return (
                        <div key={member.id} style={styles.memberRow}>
                          <div style={styles.memberIdentity}>
                            <div className="avatar avatar--small">
                              {member.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div style={styles.memberIdentityText}>
                              <span style={styles.memberName}>
                                {member.name}
                                {isYou && (
                                  <Badge tone="success">You</Badge>
                                )}
                                {isRep && (
                                  <Badge tone="warning">
                                    <Crown
                                      size={10}
                                      style={{ marginRight: 3 }}
                                    />
                                    Rep
                                  </Badge>
                                )}
                              </span>
                              <span style={styles.memberSub}>
                                Joined {member.joinedAt}
                              </span>
                            </div>
                          </div>

                          <div style={styles.memberActions}>
                            {!isRep && (
                              <Button
                                variant="ghost"
                                size="sm"
                                leadingIcon={<Crown size={14} />}
                                onClick={() =>
                                  void handleAssignRep(member)
                                }
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
                                style={{
                                  color: 'var(--error, #EF4444)',
                                }}
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

              {/* Assign rep */}
              {repCandidates.length > 0 && (
                <Card style={{ padding: 18 }}>
                  {renderSectionHeader(
                    'Assign group rep',
                    'Promote an existing member to group rep.',
                  )}

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
                    <div style={styles.searchResults}>
                      {repCandidates.length === 0 ? (
                        <p
                          style={{
                            color: 'var(--muted)',
                            fontSize: '0.86rem',
                            padding: 12,
                          }}
                        >
                          No candidates found.
                        </p>
                      ) : (
                        repCandidates.map((m) => (
                          <div
                            key={m.id}
                            style={{
                              ...styles.memberRow,
                              cursor: 'pointer',
                            }}
                            onClick={() => {
                              setSelectedRepCandidate(m);
                              setRepSearch('');
                            }}
                          >
                            <div style={styles.memberIdentity}>
                              <div className="avatar avatar--small">
                                {m.name.slice(0, 2).toUpperCase()}
                              </div>
                              <div style={styles.memberIdentityText}>
                                <span style={styles.memberName}>
                                  {m.name}
                                </span>
                                <span style={styles.memberSub}>
                                  {m.joinedAt}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {selectedRepCandidate && (
                    <Card style={styles.selectedCard}>
                      <strong style={{ fontSize: '0.9rem' }}>
                        {selectedRepCandidate.name}
                      </strong>
                      <div
                        style={{
                          display: 'flex',
                          gap: 8,
                          marginTop: 12,
                          flexWrap: 'wrap',
                        }}
                      >
                        <Button
                          variant="primary"
                          size="sm"
                          leadingIcon={<Crown size={14} />}
                          loading={busy}
                          onClick={() => void handleAssignRep()}
                        >
                          Assign as rep
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
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

          {/* ══ CHAT ═══════════════════════════════════════════════════ */}
          {section === 'chat' && (
            <Card style={{ padding: 18 }}>
              {renderSectionHeader(
                'Chat management',
                `${chatEnabled ? 'Chat is active.' : 'Chat is disabled.'} ${chatMessages.length} ${chatMessages.length === 1 ? 'message' : 'messages'}.`,
                <>
                  <Button
                    variant={chatEnabled ? 'secondary' : 'primary'}
                    size="sm"
                    leadingIcon={<Power size={14} />}
                    onClick={() => void handleToggleChat()}
                    loading={busy}
                  >
                    {chatEnabled ? 'Disable' : 'Enable'}
                  </Button>
                  {chatMessages.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      leadingIcon={<Trash2 size={14} />}
                      loading={busy}
                      onClick={() => void handleClearChat()}
                      style={{ color: 'var(--error, #EF4444)' }}
                    >
                      Clear all
                    </Button>
                  )}
                </>,
              )}

              <div style={styles.chatBox}>
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
                        style={{
                          position: 'absolute',
                          top: 4,
                          right: 4,
                          color: 'var(--error, #EF4444)',
                        }}
                        aria-label="Delete message"
                      />
                    </div>
                  ))
                )}
                <div ref={chatEndRef} />
              </div>
            </Card>
          )}

          {/* ══ ANNOUNCEMENTS ═════════════════════════════════════════ */}
          {section === 'announcements' && (
            <div style={{ display: 'grid', gap: 14 }}>
              <Card style={{ padding: 18 }}>
                {renderSectionHeader(
                  'Send announcement',
                  'Publish a notification to all group members.',
                )}

                <div style={{ display: 'grid', gap: 12 }}>
                  <Input
                    label="Title (optional)"
                    placeholder="Announcement title"
                    value={announcementTitle}
                    onChange={(e) => setAnnouncementTitle(e.target.value)}
                  />
                  <Textarea
                    label="Message"
                    placeholder="Write your announcement…"
                    value={announcementText}
                    onChange={(e) => setAnnouncementText(e.target.value)}
                    rows={3}
                  />
                  <Button
                    variant="primary"
                    leadingIcon={<Send size={14} />}
                    loading={sendingAnnouncement}
                    disabled={!announcementText.trim()}
                    onClick={() => void handleSendAnnouncement()}
                    fullWidth={isMobile}
                  >
                    Send to all members
                  </Button>
                </div>
              </Card>

              <Card style={{ padding: 18 }}>
                {renderSectionHeader(
                  `Published (${announcements.length})`,
                  'Past announcements sent to this group.',
                )}

                {announcements.length === 0 ? (
                  <EmptyState
                    title="No announcements yet"
                    description="Publish the first announcement above."
                  />
                ) : (
                  <div style={{ display: 'grid', gap: 10 }}>
                    {announcements.map((a) => (
                      <Card
                        key={a.id}
                        style={{
                          padding: 14,
                          position: 'relative',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            gap: 10,
                          }}
                        >
                          <div
                            style={{
                              flex: 1,
                              minWidth: 0,
                              display: 'grid',
                              gap: 4,
                            }}
                          >
                            <strong style={{ fontSize: '0.92rem' }}>
                              {a.title}
                            </strong>
                            <p
                              style={{
                                fontSize: '0.84rem',
                                color: 'var(--muted)',
                                lineHeight: 1.55,
                              }}
                            >
                              {a.body}
                            </p>
                            <span
                              style={{
                                fontSize: '0.74rem',
                                color: 'var(--text-tertiary)',
                              }}
                            >
                              {a.author} · {timeAgo(a.date) || a.date}
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            leadingIcon={<Trash2 size={12} />}
                            onClick={() =>
                              void handleDeleteAnnouncement(a.id)
                            }
                            style={{
                              color: 'var(--error, #EF4444)',
                              flexShrink: 0,
                            }}
                            aria-label="Delete announcement"
                          />
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          )}

          {/* ══ SETTINGS ═══════════════════════════════════════════════ */}
          {section === 'settings' && (
            <div style={{ display: 'grid', gap: 14 }}>
              {/* Info */}
              <Card style={{ padding: 18 }}>
                {renderSectionHeader('Group information', 'Read-only details.')}

                <div>
                  <div style={styles.infoRow}>
                    <div style={styles.infoLabel}>
                      <span style={styles.infoTitle}>Course code</span>
                      <span style={styles.infoDesc}>{group.courseCode}</span>
                    </div>
                    <Badge tone="info">{group.level}</Badge>
                  </div>
                  <div style={styles.infoRow}>
                    <div style={styles.infoLabel}>
                      <span style={styles.infoTitle}>Members</span>
                      <span style={styles.infoDesc}>
                        {members.length} {members.length === 1 ? 'member' : 'members'}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      leadingIcon={<Users size={14} />}
                      onClick={() => setSection('members')}
                    >
                      Manage
                    </Button>
                  </div>
                  <div style={styles.infoRowLast}>
                    <div style={styles.infoLabel}>
                      <span style={styles.infoTitle}>Group reps</span>
                      <span style={styles.infoDesc}>
                        {currentReps.length} {currentReps.length === 1 ? 'rep' : 'reps'}
                      </span>
                    </div>
                    <Badge tone="warning">
                      <Crown size={11} style={{ marginRight: 4 }} />
                      {currentReps.length}
                    </Badge>
                  </div>
                </div>
              </Card>

              {/* Toggles */}
              <Card style={{ padding: 18 }}>
                {renderSectionHeader(
                  'Visibility & chat',
                  'Control public listing and chat behavior.',
                )}

                <div>
                  <div style={styles.infoRow}>
                    <div style={styles.infoLabel}>
                      <span style={styles.infoTitle}>Public listing</span>
                      <span style={styles.infoDesc}>
                        When on, this group appears in the group browser.
                      </span>
                    </div>
                    <Button
                      variant={groupPublic ? 'secondary' : 'primary'}
                      size="sm"
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
                  <div style={styles.infoRowLast}>
                    <div style={styles.infoLabel}>
                      <span style={styles.infoTitle}>Group chat</span>
                      <span style={styles.infoDesc}>
                        Allow members to send messages.
                      </span>
                    </div>
                    <Button
                      variant={chatEnabled ? 'secondary' : 'primary'}
                      size="sm"
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
              <Card style={{ padding: 18 }}>
                {renderSectionHeader(
                  'Security',
                  'Password protection for this group.',
                )}

                <div style={styles.infoRow}>
                  <div style={styles.infoLabel}>
                    <span style={styles.infoTitle}>Password</span>
                    <span style={styles.infoDesc}>
                      {hasPassword
                        ? 'Password is set. Members need it to join.'
                        : 'No password. Anyone can join freely.'}
                    </span>
                  </div>
                  <Badge tone={hasPassword ? 'success' : 'neutral'}>
                    {hasPassword ? (
                      <>
                        <Lock size={11} style={{ marginRight: 4 }} />
                        Protected
                      </>
                    ) : (
                      <>
                        <Unlock size={11} style={{ marginRight: 4 }} />
                        Open
                      </>
                    )}
                  </Badge>
                </div>

                <div
                  style={{
                    display: 'flex',
                    gap: 8,
                    flexWrap: 'wrap',
                    marginTop: 14,
                  }}
                >
                  <Button
                    variant="secondary"
                    size="sm"
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
                        size="sm"
                        leadingIcon={<Shield size={14} />}
                        onClick={() => {
                          setPasswordAction('verify');
                          setPasswordInput('');
                          setPasswordModalOpen(true);
                        }}
                      >
                        Verify
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        leadingIcon={<Unlock size={14} />}
                        onClick={() => void handleRemovePassword()}
                        style={{ color: 'var(--error, #EF4444)' }}
                      >
                        Remove
                      </Button>
                    </>
                  )}
                </div>
              </Card>
            </div>
          )}
        </div>
      </div>

      {/* ══ CLASS FORM MODAL ════════════════════════════════════════════ */}
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
          <div
            style={{
              display: 'flex',
              gap: 8,
              flexWrap: 'wrap',
              width: '100%',
              justifyContent: 'flex-end',
            }}
          >
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
              setClassFormData((f) => ({ ...f, className: e.target.value }))
            }
          />
          <Input
            label="Course code"
            placeholder="e.g. CS101"
            value={classFormData.courseCode}
            onChange={(e) =>
              setClassFormData((f) => ({ ...f, courseCode: e.target.value }))
            }
          />
          <Select
            label="Day of week"
            value={classFormData.dayOfWeek}
            onChange={(e) =>
              setClassFormData((f) => ({ ...f, dayOfWeek: e.target.value }))
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
              gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
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
              setClassFormData((f) => ({ ...f, venue: e.target.value }))
            }
          />
          <Input
            label="Building"
            placeholder="e.g. Science Block"
            value={classFormData.building}
            onChange={(e) =>
              setClassFormData((f) => ({ ...f, building: e.target.value }))
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

      {/* ══ PASSWORD MODAL ═════════════════════════════════════════════ */}
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
          <div
            style={{
              display: 'flex',
              gap: 8,
              flexWrap: 'wrap',
              width: '100%',
              justifyContent: 'flex-end',
            }}
          >
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
            label={passwordAction === 'set' ? 'New password' : 'Password'}
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