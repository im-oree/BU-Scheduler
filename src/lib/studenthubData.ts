import {
  collection,
  arrayUnion,
  increment,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  serverTimestamp,
  orderBy,
  setDoc,
  updateDoc,
  query,
  where,
  addDoc,
} from 'firebase/firestore';
import { getFirebaseApp } from './firebase';

export type StudentHubGroup = {
  id: string;
  title: string;
  courseCode: string;
  level: string;
  memberCount: number;
  lastActivity: string;
  nextClass: string;
  description: string;
  accent: 'green' | 'amber' | 'navy';
};

export type StudentHubMember = {
  id: string;
  name: string;
  role: 'Member' | 'Group Rep' | 'Course Rep';
  joinedAt: string;
};

export type StudentHubAnnouncement = {
  id: string;
  title: string;
  body: string;
  date: string;
  author: string;
};

export type StudentHubChatMessage = {
  id: string;
  author: string;
  role: string;
  time: string;
  text: string;
  userId?: string;
  userAvatar?: string;
  edited?: boolean;
  deleted?: boolean;
  reactions?: Record<string, string[]>;
  userRole?: GroupChatRoleFlags;
};

export type StudentHubNotification = {
  id: string;
  title: string;
  detail: string;
  time: string;
  tone: 'success' | 'warning' | 'danger' | 'info';
};

export type StudentHubTimetableEntry = {
  id: string;
  userId?: string;
  groupId?: string;
  courseCode: string;
  courseName: string;
  dayIndex: number;
  day: string;
  startTime: string;
  endTime: string;
  venue: string;
  instructor: string;
  groupName: string;
};

export type StudentHubProfile = {
  name: string;
  email: string;
  phone: string;
  timezone: string;
  bio: string;
  role?: string;
  courseAdmins?: string[];
  levelCourseReps?: Array<{ courseCode?: string; studyLevel?: string; assignedAt?: number }>;
  levelGroupReps?: Array<{ courseCode?: string; studyLevel?: string; groupLetter?: string; assignedAt?: number }>;
  groupReps?: string[];
  courseReps?: string[];
  course?: string;
  level?: string;
  studyLevel?: string;
  groupMemberships?: Array<{ groupId: string; joinedAt: string; status: string }>;
};

export type GroupRoleFlags = {
  isAdmin: boolean;
  isCourseAdmin: boolean;
  isCourseRep: boolean;
  isGroupRep: boolean;
  isMember: boolean;
};

export type GroupChatRoleFlags = {
  isGroupRep: boolean;
  isCourseRep: boolean;
  isCourseAdmin: boolean;
  isAdmin: boolean;
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function db() {
  const app = getFirebaseApp();
  return getFirestore(app);
}

function asText(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function asNumber(value: unknown, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function normalizeDayIndex(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) return parsed;

    const dayName = value.trim().toLowerCase();
    if (dayName === 'monday') return 0;
    if (dayName === 'tuesday') return 1;
    if (dayName === 'wednesday') return 2;
    if (dayName === 'thursday') return 3;
    if (dayName === 'friday') return 4;
    if (dayName === 'saturday') return 5;
    if (dayName === 'sunday') return 6;
  }
  return fallback;
}

function getDayNameFromIndex(dayIndex: number): string {
  switch (dayIndex) {
    case 0:
      return 'Monday';
    case 1:
      return 'Tuesday';
    case 2:
      return 'Wednesday';
    case 3:
      return 'Thursday';
    case 4:
      return 'Friday';
    case 5:
      return 'Saturday';
    case 6:
      return 'Sunday';
    default:
      return '—';
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function toDateString(value: unknown): string {
  if (!value) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  const candidate = value as { toDate?: () => Date; seconds?: number };
  if (typeof candidate.toDate === 'function') return candidate.toDate().toISOString();
  if (typeof candidate.seconds === 'number') return new Date(candidate.seconds * 1000).toISOString();
  return '';
}

/**
 * Parse an HH:MM time string (e.g. "09:30") into total minutes since midnight.
 * Falls back to 0 so comparisons stay stable when the field is missing or malformed.
 * Does NOT attempt Date.parse on these strings — StudentHub stores day-of-week
 * plus HH:MM, not ISO timestamps, so Date.parse is unreliable here.
 */
function parseHHMMtoMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const match = timeStr.match(/^(\d{1,2}):(\d{2})/);
  if (match) return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
  return 0;
}

/**
 * Sort timetable entries by dayIndex first, then by HH:MM start time.
 * ISO timestamp fallback is intentionally removed — StudentHub group timetable
 * entries use day-of-week strings and HH:MM times, not full timestamps.
 */
function sortByDateAsc<T extends { startTime: string; dayIndex?: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const dayDiff = (a.dayIndex ?? 0) - (b.dayIndex ?? 0);
    if (dayDiff !== 0) return dayDiff;
    return parseHHMMtoMinutes(a.startTime) - parseHHMMtoMinutes(b.startTime);
  });
}

function getAccentFromGroup(data: Record<string, unknown>): StudentHubGroup['accent'] {
  // FIX: prefer studyLevel (canonical field) before falling back to level.
  const level = String(data.studyLevel ?? data.level ?? '').toLowerCase();
  if (level.startsWith('1') || level.includes('fresh')) return 'green';
  if (level.startsWith('2') || level.startsWith('3')) return 'amber';
  return 'navy';
}

function toGroupCard(docId: string, data: Record<string, unknown>, nextClass = ''): StudentHubGroup {
  const members = asArray(data.members);
  return {
    id: docId,
    title: asText(data.groupName ?? data.name ?? data.title, docId),
    courseCode: asText(data.courseCode, 'Course'),
    // FIX: read studyLevel first — that is the canonical field in courseGroups docs.
    level: asText(data.studyLevel ?? data.level, '—'),
    memberCount: asNumber(data.memberCount, members.length),
    lastActivity: asText(data.updatedAt ?? data.lastActivity, 'Recently'),
    nextClass: nextClass || asText(data.nextClass, 'No upcoming class'),
    description: asText(data.description, 'Course group'),
    accent: getAccentFromGroup(data),
  };
}

function mapProfile(data: Record<string, unknown>): StudentHubProfile {
  const preferences = (data.preferences ?? {}) as Record<string, unknown>;
  return {
    name: asText(data.fullName ?? data.displayName ?? data.nickname, 'StudentHub user'),
    email: asText(data.email, ''),
    phone: asText(data.phoneNumber ?? data.phone, ''),
    timezone: asText(data.timezone ?? preferences.timezone, 'Africa/Lagos'),
    bio: asText(
      data.bio ?? data.aiSharedContext ?? preferences.bio,
      'Managing cohort schedules and class updates.',
    ),
  };
}

function mapTimetableEntry(docId: string, data: Record<string, unknown>): StudentHubTimetableEntry {
  const dayIndex = normalizeDayIndex(data.dayIndex ?? data.dayIndexOfWeek ?? data.day);
  const day = asText(data.dayOfWeek ?? data.day, getDayNameFromIndex(dayIndex));

  return {
    id: docId,
    userId: asText(data.userId, ''),
    groupId: asText(data.groupId, ''),
    courseCode: asText(data.courseCode, '—'),
    courseName: asText(data.courseName ?? data.className, 'Untitled class'),
    dayIndex,
    day,
    startTime: asText(data.startTime, ''),
    endTime: asText(data.endTime, ''),
    venue: asText(data.venue ?? data.location ?? data.building, 'TBA'),
    instructor: asText(data.instructor, 'TBA'),
    groupName: asText(data.groupName ?? data.groupTitle ?? data.group, ''),
  };
}

function mapStructuredTimetableItem(
  docId: string,
  item: unknown,
  dayName: string,
  userId?: string,
  groupId?: string,
): StudentHubTimetableEntry | null {
  if (!isPlainObject(item)) return null;

  const dayIndex = normalizeDayIndex(item.dayIndex ?? item.dayIndexOfWeek ?? dayName, 0);
  const day = asText(item.dayOfWeek ?? item.day ?? dayName, getDayNameFromIndex(dayIndex));
  const itemId = asText(item.id, `${docId}-${dayName}-${item.startTime ?? item.endTime ?? 'entry'}`);

  return {
    id: itemId,
    userId: asText(item.userId ?? userId, ''),
    groupId: asText(item.groupId ?? groupId, ''),
    courseCode: asText(item.courseCode, '—'),
    courseName: asText(item.courseName ?? item.className ?? item.title, 'Untitled class'),
    dayIndex,
    day,
    startTime: asText(item.startTime, ''),
    endTime: asText(item.endTime, ''),
    venue: asText(item.venue ?? item.location ?? item.building, 'TBA'),
    instructor: asText(item.instructor, 'TBA'),
    groupName: asText(item.groupName ?? item.groupTitle ?? item.group ?? groupId ?? docId, ''),
  };
}

function extractStructuredTimetableEntries(
  docId: string,
  data: Record<string, unknown>,
  userId?: string,
  groupId?: string,
): StudentHubTimetableEntry[] {
  const entries: StudentHubTimetableEntry[] = [];
  const dayBuckets = new Map<string, unknown[]>();

  const recordBucket = (dayName: string, value: unknown) => {
    if (Array.isArray(value)) dayBuckets.set(dayName, value);
  };

  if (Array.isArray(data.entries)) {
    dayBuckets.set(asText(data.dayOfWeek ?? data.day, 'Mixed'), data.entries);
  }

  if (Array.isArray(data.timetable)) {
    dayBuckets.set(asText(data.dayOfWeek ?? data.day, 'Mixed'), data.timetable);
  }

  if (isPlainObject(data.days)) {
    Object.entries(data.days).forEach(([dayName, value]) => recordBucket(dayName, value));
  }

  if (isPlainObject(data.schedule)) {
    Object.entries(data.schedule).forEach(([dayName, value]) => recordBucket(dayName, value));
  }

  Object.entries(data).forEach(([key, value]) => {
    const normalized = key.trim().toLowerCase();
    const looksLikeDay =
      normalized === 'monday' ||
      normalized === 'tuesday' ||
      normalized === 'wednesday' ||
      normalized === 'thursday' ||
      normalized === 'friday' ||
      normalized === 'saturday' ||
      normalized === 'sunday';

    if (looksLikeDay && Array.isArray(value)) {
      dayBuckets.set(key, value);
    }
  });

  dayBuckets.forEach((bucket, dayName) => {
    bucket.forEach((item, index) => {
      const mapped = mapStructuredTimetableItem(
        `${docId}-${dayName}-${index}`,
        item,
        dayName,
        userId,
        groupId,
      );
      if (mapped) entries.push(mapped);
    });
  });

  return entries;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function fetchCurrentUserProfile(userId: string) {
  // Correct path: users/{firebaseUid} — unchanged, was already right.
  const snapshot = await getDoc(doc(db(), 'users', userId));
  if (!snapshot.exists()) return null;

  const data = snapshot.data() as Record<string, unknown>;
  return {
    ...mapProfile(data),
    role: asText(data.role, ''),
    courseAdmins: asArray<string>(data.courseAdmins),
    levelCourseReps: asArray(data.levelCourseReps),
    levelGroupReps: asArray(data.levelGroupReps),
    groupReps: asArray<string>(data.groupReps),
    courseReps: asArray<string>(data.courseReps),
    course: asText(data.course, ''),
    level: asText(data.level, ''),
    studyLevel: asText(data.studyLevel, ''),
    groupMemberships: asArray(data.groupMemberships).map((entry) => ({
      groupId: asText((entry as Record<string, unknown>).groupId, ''),
      joinedAt: asText((entry as Record<string, unknown>).joinedAt, ''),
      status: asText((entry as Record<string, unknown>).status, 'active'),
    })).filter((entry) => Boolean(entry.groupId)),
  };
}

function getGroupMemberIds(data: Record<string, unknown>): string[] {
  const rawMembers = asArray(data.members) as unknown[];
  return rawMembers
    .map((member) => {
      if (!member) return '';
      if (typeof member === 'string') return member;
      return asText((member as Record<string, unknown>).userId, '');
    })
    .filter(Boolean);
}

export function isUserInGroup(userId: string, data: Record<string, unknown>): boolean {
  return getGroupMemberIds(data).includes(userId);
}

export function getGroupRoleFlags(
  userId: string,
  profile: StudentHubProfile | null,
  groupId: string,
  groupData: Record<string, unknown> | null,
): GroupRoleFlags {
  const courseCode = asText(groupData?.courseCode, '');
  const studyLevel = asText(groupData?.studyLevel ?? groupData?.level, '');
  const groupLetter = asText(groupData?.groupLetter, '');
  const isAdmin = asText(profile?.role, '') === 'admin';
  const isCourseAdmin = Boolean(profile?.courseAdmins?.includes(courseCode));
  const isCourseRep = Boolean(
    profile?.courseReps?.includes(courseCode) ||
      profile?.levelCourseReps?.some((rep) =>
        asText(rep?.courseCode, '') === courseCode && asText(rep?.studyLevel, '') === studyLevel,
      ),
  );
  const isGroupRep = Boolean(
    profile?.groupReps?.includes(groupId) ||
      profile?.levelGroupReps?.some((rep) =>
        asText(rep?.courseCode, '') === courseCode &&
        asText(rep?.studyLevel, '') === studyLevel &&
        asText(rep?.groupLetter, '') === groupLetter,
      ),
  );
  const isMember = Boolean(groupData && isUserInGroup(userId, groupData));

  return {
    isAdmin,
    isCourseAdmin,
    isCourseRep,
    isGroupRep,
    isMember,
  };
}

export async function fetchAllGroups(): Promise<StudentHubGroup[]> {
  const [courseGroupSnap, legacyGroupSnap] = await Promise.all([
    getDocs(query(collection(db(), 'courseGroups'), limit(500))),
    getDocs(query(collection(db(), 'groups'), limit(500))),
  ]);

  const groups = new Map<string, Record<string, unknown>>();
  courseGroupSnap.docs.forEach((docSnap) => {
    groups.set(docSnap.id, docSnap.data() as Record<string, unknown>);
  });
  legacyGroupSnap.docs.forEach((docSnap) => {
    if (!groups.has(docSnap.id)) {
      groups.set(docSnap.id, docSnap.data() as Record<string, unknown>);
    }
  });

  const enriched = await Promise.all(
    [...groups.entries()].map(async ([id, data]) => ({
      ...toGroupCard(id, data, await fetchNextGroupClass(id)),
      // Useful for browser cards and join flow
      memberCount: asNumber(data.memberCount, getGroupMemberIds(data).length),
      description: asText(data.description, 'Course group'),
    })),
  );

  return enriched;
}

export async function fetchGroupDocument(groupId: string): Promise<Record<string, unknown> | null> {
  const courseGroupSnap = await getDoc(doc(db(), 'courseGroups', groupId));
  if (courseGroupSnap.exists()) return courseGroupSnap.data() as Record<string, unknown>;
  const groupSnap = await getDoc(doc(db(), 'groups', groupId));
  if (groupSnap.exists()) return groupSnap.data() as Record<string, unknown>;
  return null;
}

export async function joinGroup(groupId: string, profile: StudentHubProfile, userId: string) {
  const data = await fetchGroupDocument(groupId);
  if (!data) throw new Error('Group not found');

  if (isUserInGroup(userId, data)) {
    return { alreadyJoined: true };
  }

  const member = {
    userId,
    userName: profile.name,
    userEmail: profile.email,
    joinedAt: new Date().toISOString(),
    status: 'active',
  };

  const groupRef = doc(db(), 'courseGroups', groupId);
  const legacyRef = doc(db(), 'groups', groupId);
  const userRef = doc(db(), 'users', userId);

  try {
    await updateDoc(groupRef, {
      members: arrayUnion(member),
      memberCount: increment(1),
      updatedAt: serverTimestamp(),
    });
  } catch {
    await updateDoc(legacyRef, {
      members: arrayUnion(member),
      memberCount: increment(1),
      updatedAt: serverTimestamp(),
    });
  }

  await setDoc(
    userRef,
    {
      groupMemberships: arrayUnion({ groupId, joinedAt: member.joinedAt, status: 'active' }),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  return { alreadyJoined: false };
}

export async function demoteRep(groupId: string, memberId: string) {
  const data = await fetchGroupDocument(groupId);
  if (!data) throw new Error('Group not found');

  const currentReps: string[] = Array.isArray(data.groupReps)
    ? (data.groupReps as string[])
    : [];

  const nextReps = currentReps.filter((id) => id !== memberId);

  const groupRef = doc(db(), 'courseGroups', groupId);
  const legacyRef = doc(db(), 'groups', groupId);

  try {
    await updateDoc(groupRef, {
      groupReps: nextReps,
      updatedAt: serverTimestamp(),
    });
  } catch {
    await updateDoc(legacyRef, {
      groupReps: nextReps,
      updatedAt: serverTimestamp(),
    });
  }

  return { success: true };
}

export async function sendGroupChatMessage(params: {
  groupId: string;
  userId: string;
  profile: StudentHubProfile;
  text: string;
}) {
  const { groupId, userId, profile, text } = params;
  const groupData = await fetchGroupDocument(groupId);
  if (!groupData) throw new Error('Group not found');

  const messageRef = doc(collection(db(), 'groupChats', groupId, 'messages'));
  const roleFlags = getGroupRoleFlags(userId, profile, groupId, groupData);
  const now = new Date().toISOString();

  const payload = {
    groupId,
    userId,
    userName: profile.name,
    userAvatar: '',
    message: text.trim(),
    text: text.trim(),
    timestamp: now,
    createdAt: now,
    userRole: roleFlags,
    edited: false,
    deleted: false,
    reactions: {},
  };

  await setDoc(messageRef, payload);
  await setDoc(
    doc(db(), 'groupChats', groupId),
    {
      groupId,
      groupName: asText(groupData.groupName ?? groupData.title, groupId),
      lastMessage: text.trim(),
      lastMessageTime: now,
      messageCount: increment(1),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  return payload;
}

/**
 * FIX: array-contains on members[] does not work because StudentHub stores
 * members as objects ({ userId, userName, userEmail, joinedAt, status }),
 * not plain string IDs. We fetch a bounded batch and filter client-side
 * by member.userId instead.
 */
export async function fetchUserGroups(userId: string): Promise<StudentHubGroup[]> {
  console.log('[studenthubData] fetchUserGroups userId:', userId);

  try {
    const [courseGroupSnap, groupSnap] = await Promise.all([
      getDocs(query(collection(db(), 'courseGroups'), limit(500))),
      getDocs(query(collection(db(), 'groups'), limit(500))),
    ]);

    const isMember = (data: Record<string, unknown>): boolean => {
      const members = asArray(data.members) as unknown[];
      return members.some((m) => {
        if (!m) return false;
        // Legacy path: plain string IDs
        if (typeof m === 'string') return m === userId;
        // Current path: member objects with userId field
        return (m as Record<string, unknown>).userId === userId;
      });
    };

    const matched: Array<{ id: string; data: Record<string, unknown> }> = [];

    courseGroupSnap.docs.forEach((d) => {
      const data = d.data() as Record<string, unknown>;
      if (isMember(data)) matched.push({ id: d.id, data });
    });

    // Only fall back to legacy 'groups' collection when not already covered
    const courseGroupIds = new Set(matched.map((m) => m.id));
    groupSnap.docs.forEach((d) => {
      if (courseGroupIds.has(d.id)) return; // already included above
      const data = d.data() as Record<string, unknown>;
      if (isMember(data)) matched.push({ id: d.id, data });
    });

    console.log('[studenthubData] matched groups:', matched.length);

    const enriched = await Promise.all(
      matched.map(async ({ id, data }) => {
        const nextClass = await fetchNextGroupClass(id);
        return toGroupCard(id, data, nextClass);
      }),
    );

    return enriched;
  } catch (err) {
    console.error('[studenthubData] fetchUserGroups failed:', err);
    return [];
  }
}

export async function fetchGroupById(groupId: string): Promise<StudentHubGroup | null> {
  // Primary source: courseGroups
  const courseGroupSnap = await getDoc(doc(db(), 'courseGroups', groupId));
  if (courseGroupSnap.exists()) {
    return toGroupCard(
      courseGroupSnap.id,
      courseGroupSnap.data() as Record<string, unknown>,
      await fetchNextGroupClass(groupId),
    );
  }

  // Legacy fallback
  const groupSnap = await getDoc(doc(db(), 'groups', groupId));
  if (groupSnap.exists()) {
    return toGroupCard(
      groupSnap.id,
      groupSnap.data() as Record<string, unknown>,
      await fetchNextGroupClass(groupId),
    );
  }

  return null;
}

/**
 * FIX: members[] holds objects, not strings. Read userId and joinedAt
 * directly from each member object. Role is derived from the group-level
 * rep arrays (groupReps, courseReps), not from the user profile.
 */
export async function fetchGroupMembers(groupId: string): Promise<StudentHubMember[]> {
  const snap = await getDoc(doc(db(), 'courseGroups', groupId));
  if (!snap.exists()) return [];

  const data = snap.data() as Record<string, unknown>;
  const members = asArray(data.members) as unknown[];
  const groupReps = new Set(asArray<string>(data.groupReps ?? data.levelGroupReps));
  const courseReps = new Set(asArray<string>(data.courseReps ?? data.levelCourseReps));

  return members
    .map((m): StudentHubMember | null => {
      if (!m || typeof m === 'string') return null; // skip legacy plain-string entries
      const member = m as Record<string, unknown>;
      const uid = asText(member.userId, '');
      if (!uid) return null;

      // FIX: joinedAt comes from the member object, not from the user profile.
      const rawJoinedAt = toDateString(member.joinedAt);
      const joinedAt = rawJoinedAt ? rawJoinedAt.slice(0, 10) : asText(member.joinedAt as string, 'Recently');

      return {
        id: uid,
        name: asText(
          member.userName ?? member.displayName ?? member.name ?? member.userEmail,
          uid,
        ),
        role: courseReps.has(uid) ? 'Course Rep' : groupReps.has(uid) ? 'Group Rep' : 'Member',
        joinedAt,
      };
    })
    .filter((item): item is StudentHubMember => item !== null);
}

export async function fetchGroupAnnouncements(groupId: string): Promise<StudentHubAnnouncement[]> {
  // Path confirmed correct: courseGroups/{groupId}/notifications
  const snap = await getDocs(
    query(
      collection(db(), 'courseGroups', groupId, 'notifications'),
      orderBy('createdAt', 'desc'),
      limit(20),
    ),
  );

  return snap.docs.map((item) => {
    const data = item.data() as Record<string, unknown>;

    // Announcement payloads sometimes use different fields across data sources
    // (body, detail, message, text, content). Prefer the most descriptive
    // field available and fall back to an empty string.
    const body = (data.body ?? data.detail ?? data.message ?? data.text ?? data.content ?? '') as unknown;
    const bodyStr = typeof body === 'string' ? body : (typeof body === 'object' && body ? JSON.stringify(body) : '');

    const rawDate = toDateString(data.createdAt) || toDateString(data.timestamp) || asText(data.date, '');

    return {
      id: item.id,
      title: asText(data.title ?? data.subject ?? data.headline, 'Announcement'),
      body: asText(bodyStr, ''),
      date: rawDate.slice(0, 10) || asText(data.date, ''),
      author: asText(data.author ?? data.displayName ?? data.userName ?? 'StudentHub', 'StudentHub'),
    };
  });
}

export async function createGroupAnnouncement(params: {
  groupId: string;
  title: string;
  body: string;
  authorName?: string;
  authorId?: string;
}) {
  const { groupId, title, body, authorName = 'StudentHub', authorId = '' } = params;

  const announcementRef = collection(db(), 'courseGroups', groupId, 'notifications');
  const now = new Date().toISOString();

  const payload = {
    title: title.trim(),
    body: body.trim(),
    message: body.trim(),
    content: body.trim(),
    author: authorName,
    authorId,
    createdAt: now,
    timestamp: now,
    updatedAt: now,
  };

  try {
    const docRef = await addDoc(announcementRef, payload);
    return { success: true, id: docRef.id, ...payload };
  } catch (err) {
    console.error('[studenthubData] createGroupAnnouncement failed:', err);
    throw err;
  }
}

/**
 * FIX: correct collection path is groupChats/{groupId}/messages, not
 * a top-level chats collection filtered by groupId. Reading the wrong
 * path returned an empty result even when messages existed.
 */
export async function fetchGroupChatMessages(groupId: string): Promise<StudentHubChatMessage[]> {
  const snap = await getDocs(
    query(
      collection(db(), 'groupChats', groupId, 'messages'),
      orderBy('createdAt', 'asc'),
      limit(100),
    ),
  );

  return snap.docs.map((item) => {
    const data = item.data() as Record<string, unknown>;
    const rawTime = toDateString(data.createdAt);
    const userRoleRaw = isPlainObject(data.userRole) ? (data.userRole as Record<string, unknown>) : null;
    return {
      id: item.id,
      author: asText(
        data.author ?? data.displayName ?? data.userName ?? data.senderName,
        'StudentHub',
      ),
      role: asText(data.role ?? data.userRole ?? data.senderRole, 'Member'),
      // Show HH:MM only — full ISO time slice is enough for chat bubbles
      time: rawTime ? rawTime.slice(11, 16) : asText(data.time as string, '—'),
      text: asText(data.text ?? data.message ?? data.content, ''),
      userId: asText(data.userId, ''),
      userAvatar: asText(data.userAvatar, ''),
      edited: Boolean(data.edited),
      deleted: Boolean(data.deleted),
      reactions: isPlainObject(data.reactions)
        ? Object.fromEntries(
            Object.entries(data.reactions).map(([emoji, value]) => [emoji, asArray<string>(value)]),
          )
        : undefined,
      userRole: userRoleRaw
        ? {
            isGroupRep: Boolean(userRoleRaw.isGroupRep),
            isCourseRep: Boolean(userRoleRaw.isCourseRep ?? userRoleRaw.isLevelCourseRep),
            isCourseAdmin: Boolean(userRoleRaw.isCourseAdmin),
            isAdmin: Boolean(userRoleRaw.isAdmin ?? userRoleRaw.isSystemAdmin),
          }
        : undefined,
    };
  });
}

export async function fetchNotifications(userId: string): Promise<StudentHubNotification[]> {
  const [recipientSnap, userSnap] = await Promise.all([
    getDocs(
      query(collection(db(), 'notifications'), where('recipientId', '==', userId), limit(50)),
    ),
    getDocs(
      query(collection(db(), 'notifications'), where('userId', '==', userId), limit(50)),
    ),
  ]);

  // Deduplicate by document ID in case both queries return the same doc
  const seen = new Set<string>();
  const docs = [...recipientSnap.docs, ...userSnap.docs].filter((d) => {
    if (seen.has(d.id)) return false;
    seen.add(d.id);
    return true;
  });

  return docs.map((item) => {
    const data = item.data() as Record<string, unknown>;
    const time =
      toDateString(data.createdAt).slice(0, 16) ||
      toDateString(data.timestamp).slice(0, 16) ||
      asText(data.time as string, 'Recently');
    return {
      id: item.id,
      title: asText(data.title, 'Notification'),
      detail: asText(data.body ?? data.detail, ''),
      time,
      tone: (asText(data.tone as string, 'info') as StudentHubNotification['tone']) || 'info',
    };
  });
}

export async function fetchUserTimetableEntries(userId: string): Promise<StudentHubTimetableEntry[]> {
  console.log('[studenthubData] fetchUserTimetableEntries userId:', userId);

  const trySource = async (
    label: string,
    loader: () => Promise<StudentHubTimetableEntry[]>,
  ): Promise<StudentHubTimetableEntry[] | null> => {
    try {
      const entries = await loader();
      if (entries.length > 0) {
        console.log(`[studenthubData] ${label} entries:`, entries.length);
        return sortByDateAsc(entries);
      }

      console.log(`[studenthubData] ${label} entries: 0`);
      return null;
    } catch (error) {
      console.error(`[studenthubData] ${label} failed:`, error);
      return null;
    }
  };

  // 1. Primary: flat timetable collection with userId field
  const flatEntries = await trySource('flat timetable', async () => {
    const flatSnap = await getDocs(
      query(collection(db(), 'timetable'), where('userId', '==', userId), limit(500)),
    );

    return flatSnap.docs.map((d) => mapTimetableEntry(d.id, d.data() as Record<string, unknown>));
  });
  if (flatEntries) return flatEntries;

  // 2. Fallback: nested timetables/{userId} doc (legacy shape)
  const nestedEntries = await trySource('nested timetable', async () => {
    const nestedSnap = await getDoc(doc(db(), 'timetables', userId));
    if (!nestedSnap.exists()) return [];

    const data = nestedSnap.data() as Record<string, unknown>;
    return extractStructuredTimetableEntries(nestedSnap.id, data, userId);
  });
  if (nestedEntries) return nestedEntries;

  const [profile, groups] = await Promise.all([
    fetchCurrentUserProfile(userId).catch(() => null),
    fetchUserGroups(userId).catch(() => []),
  ]);

  const level = profile?.studyLevel || profile?.level || profile?.course || '';

  // 3. Level schedule collection (schedule queried by level)
  if (level) {
    const scheduleEntries = await trySource('level schedule', async () => {
      const scheduleSnap = await getDocs(
        query(collection(db(), 'schedule'), where('level', '==', level), limit(500)),
      );

      return scheduleSnap.docs.map((d) => {
        const data = d.data() as Record<string, unknown>;
        return {
          id: d.id,
          userId,
          courseCode: asText(data.courseCode, '—'),
          courseName: asText(data.courseName ?? data.className, 'Untitled class'),
          dayIndex: normalizeDayIndex(data.dayIndex ?? data.dayIndexOfWeek ?? data.day),
          day: asText(data.dayOfWeek ?? data.day, '—'),
          startTime: asText(data.startTime, ''),
          endTime: asText(data.endTime, ''),
          venue: asText(data.venue ?? data.location ?? data.building, 'TBA'),
          instructor: asText(data.instructor, 'TBA'),
          groupName: asText(data.groupName ?? data.groupId ?? level, ''),
        } satisfies StudentHubTimetableEntry;
      });
    });
    if (scheduleEntries) return scheduleEntries;
  }

  // 4. Last resort: derive from the user's group timetables
  console.log('[studenthubData] falling back to groupTimetables');
  if (groups.length === 0) return [];

  const groupEntries = await trySource('group timetable fallback', async () => {
    const snaps = await Promise.all(
      groups.map((g) =>
        getDocs(query(collection(db(), 'groupTimetables'), where('groupId', '==', g.id), limit(500))),
      ),
    );

    const entries: StudentHubTimetableEntry[] = [];
    snaps.forEach((snapshot, idx) => {
      const gid = groups[idx].id;
      snapshot.docs.forEach((d) => {
        const data = d.data() as Record<string, unknown>;
        entries.push({
          id: d.id,
          userId,
          groupId: gid,
          courseCode: asText(data.courseCode, '—'),
          courseName: asText(data.className ?? data.courseName, 'Untitled class'),
          dayIndex: normalizeDayIndex(data.dayIndex ?? data.dayIndexOfWeek ?? data.day),
          day: asText(data.dayOfWeek ?? data.day, '—'),
          startTime: asText(data.startTime, ''),
          endTime: asText(data.endTime, ''),
          venue: asText(data.venue ?? data.location ?? data.building, 'TBA'),
          instructor: asText(data.instructor, 'TBA'),
          groupName: gid,
        });
      });
    });

    return entries;
  });

  return groupEntries ?? [];
}

export async function fetchGroupTimetableEntries(groupId: string): Promise<StudentHubTimetableEntry[]> {
  console.log('[studenthubData] fetchGroupTimetableEntries groupId:', groupId);

  const snap = await getDocs(
    query(collection(db(), 'groupTimetables'), where('groupId', '==', groupId), limit(100)),
  );

  return sortByDateAsc(
    snap.docs.map((d) => {
      const data = d.data() as Record<string, unknown>;
      return {
        id: d.id,
        groupId,
        courseCode: asText(data.courseCode, '—'),
        courseName: asText(data.className ?? data.courseName, 'Untitled class'),
        dayIndex: normalizeDayIndex(data.dayIndex ?? data.dayIndexOfWeek ?? data.day),
        day: asText(data.dayOfWeek ?? data.day, '—'),
        startTime: asText(data.startTime, ''),
        endTime: asText(data.endTime, ''),
        venue: asText(data.venue ?? data.location ?? data.building, 'TBA'),
        instructor: asText(data.instructor, 'TBA'),
        groupName: groupId,
      } satisfies StudentHubTimetableEntry;
    }),
  );
}

/**
 * FIX: format the next-class label from the raw day + HH:MM fields rather than
 * attempting Date.parse on a time-only string (which produces an invalid date
 * in most environments).
 */
export async function fetchNextGroupClass(groupId: string): Promise<string> {
  const entries = await fetchGroupTimetableEntries(groupId);
  const sorted = sortByDateAsc(entries);
  const next = sorted[0];

  if (!next) return 'No upcoming class';

  // If startTime looks like HH:MM, compose a readable label from day + time
  const hhmmMatch = next.startTime?.match(/^(\d{1,2}):(\d{2})/);
  if (hhmmMatch) {
    const day = next.day && next.day !== '—' ? `${next.day} ` : '';
    return `${day}${hhmmMatch[1]}:${hhmmMatch[2]}`;
  }

  // If for some reason it IS a full ISO timestamp, parse it normally
  const ts = Date.parse(next.startTime ?? '');
  if (Number.isFinite(ts)) {
    return new Date(ts).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' });
  }

  return next.day || 'No upcoming class';
}

/**
 * Returns a short human-readable calendar label for a timetable entry.
 * Prefers the day + HH:MM string representation over ISO timestamp parsing.
 */
export function toCalendarLabel(entry: StudentHubTimetableEntry): string {
  if (!entry.startTime) return entry.day || '';

  const hhmmMatch = entry.startTime.match(/^(\d{1,2}):(\d{2})/);
  if (hhmmMatch) {
    const day = entry.day && entry.day !== '—' ? `${entry.day} ` : '';
    return `${day}${hhmmMatch[1]}:${hhmmMatch[2]}`;
  }

  // Full ISO timestamp fallback
  const ts = Date.parse(entry.startTime);
  if (Number.isFinite(ts)) {
    return new Date(ts).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' });
  }

  return entry.day || '';
}