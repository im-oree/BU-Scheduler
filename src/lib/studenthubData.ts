import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
  where,
  type DocumentData,
  type Timestamp,
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
};

function db() {
  getFirebaseApp();
  return getFirestore();
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

function toDateString(value: unknown) {
  if (!value) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  const candidate = value as { toDate?: () => Date; seconds?: number; nanoseconds?: number };
  if (typeof candidate.toDate === 'function') {
    return candidate.toDate().toISOString();
  }
  if (typeof candidate.seconds === 'number') {
    return new Date(candidate.seconds * 1000).toISOString();
  }
  return '';
}

function getAccentFromGroup(group: Record<string, unknown>): StudentHubGroup['accent'] {
  const level = String(group.level ?? '').toLowerCase();
  if (level.startsWith('1') || level.includes('fresh')) return 'green';
  if (level.startsWith('2') || level.startsWith('3')) return 'amber';
  return 'navy';
}

function toGroupCard(docId: string, data: Record<string, unknown>, nextClass = ''): StudentHubGroup {
  const title = asText(data.groupName ?? data.name ?? data.title, docId);
  const members = asArray(data.members);
  return {
    id: docId,
    title,
    courseCode: asText(data.courseCode, 'Course'),
    level: asText(data.level, '—'),
    memberCount: asNumber(data.memberCount, members.length),
    lastActivity: asText(data.updatedAt ?? data.lastActivity, 'Recently'),
    nextClass: nextClass || asText(data.nextClass, 'No upcoming class'),
    description: asText(data.description, 'Course group'),
    accent: getAccentFromGroup(data),
  };
}

function mapProfile(data: Record<string, unknown>): StudentHubProfile {
  return {
    name: asText(data.fullName ?? data.displayName ?? data.nickname, 'StudentHub user'),
    email: asText(data.email, ''),
    phone: asText(data.phoneNumber ?? data.phone, ''),
    timezone: asText(data.timezone ?? data.preferences?.timezone, 'Africa/Lagos'),
    bio: asText(data.bio ?? data.aiSharedContext ?? data.preferences?.bio, 'Managing cohort schedules and class updates.'),
  };
}

function mapTimetableEntry(docId: string, data: Record<string, unknown>): StudentHubTimetableEntry {
  return {
    id: docId,
    userId: asText(data.userId, ''),
    groupId: asText(data.groupId, ''),
    courseCode: asText(data.courseCode, '—'),
    courseName: asText(data.courseName ?? data.className, 'Untitled class'),
    dayIndex: asNumber(data.dayIndex, 0),
    day: asText(data.day, '—'),
    startTime: asText(data.startTime, ''),
    endTime: asText(data.endTime, ''),
    venue: asText(data.venue ?? data.location, 'TBA'),
    instructor: asText(data.instructor, 'TBA'),
    groupName: asText(data.groupName ?? data.groupTitle ?? data.group, ''),
  };
}

function sortByDateAsc<T extends { startTime: string; dayIndex?: number }>(items: T[]) {
  return [...items].sort((left, right) => {
    const leftTime = Date.parse(left.startTime || '') || 0;
    const rightTime = Date.parse(right.startTime || '') || 0;
    if (leftTime !== rightTime) return leftTime - rightTime;
    return (left.dayIndex ?? 0) - (right.dayIndex ?? 0);
  });
}

async function fetchCollectionDocs(path: string, q?: ReturnType<typeof query>) {
  const ref = collection(db(), path);
  const snapshot = await getDocs(q ?? ref);
  return snapshot.docs.map((item) => ({ id: item.id, data: item.data() as Record<string, unknown> }));
}

export async function fetchCurrentUserProfile(userId: string) {
  const snapshot = await getDoc(doc(db(), 'users', userId));
  if (!snapshot.exists()) {
    return null;
  }
  return mapProfile(snapshot.data() as Record<string, unknown>);
}

export async function fetchUserGroups(userId: string) {
  const primaryQuery = query(
    collection(db(), 'courseGroups'),
    where('members', 'array-contains', userId),
  );

  const [primaryGroups, fallbackGroups] = await Promise.all([
    fetchCollectionDocs('courseGroups', primaryQuery),
    fetchCollectionDocs('groups', query(collection(db(), 'groups'), where('members', 'array-contains', userId))),
  ]);

  const groupDocs = [...primaryGroups, ...fallbackGroups];
  const enriched = await Promise.all(groupDocs.map(async ({ id, data }) => {
    const nextClass = await fetchNextGroupClass(id);
    return toGroupCard(id, data, nextClass);
  }));

  return enriched;
}

export async function fetchGroupById(groupId: string) {
  const courseGroup = await getDoc(doc(db(), 'courseGroups', groupId));
  if (courseGroup.exists()) {
    return toGroupCard(courseGroup.id, courseGroup.data() as Record<string, unknown>, await fetchNextGroupClass(groupId));
  }

  const group = await getDoc(doc(db(), 'groups', groupId));
  if (group.exists()) {
    return toGroupCard(group.id, group.data() as Record<string, unknown>, await fetchNextGroupClass(groupId));
  }

  return null;
}

export async function fetchGroupMembers(groupId: string): Promise<StudentHubMember[]> {
  const group = await getDoc(doc(db(), 'courseGroups', groupId));
  const groupData = group.exists() ? (group.data() as Record<string, unknown>) : null;
  const memberIds = asArray<string>(groupData?.members);
  const groupReps = new Set(asArray<string>(groupData?.groupReps ?? groupData?.levelGroupReps));
  const courseReps = new Set(asArray<string>(groupData?.courseReps ?? groupData?.levelCourseReps));

  if (memberIds.length === 0) {
    return [];
  }

  const memberDocs = await Promise.all(
    memberIds.map(async (memberId) => {
      const user = await getDoc(doc(db(), 'users', memberId));
      return user.exists() ? { id: user.id, data: user.data() as Record<string, unknown> } : null;
    }),
  );

  return memberDocs
    .filter((item): item is { id: string; data: Record<string, unknown> } => Boolean(item))
    .map(({ id, data }) => ({
      id,
      name: asText(data.fullName ?? data.displayName ?? data.nickname ?? data.email, id),
      role: courseReps.has(id)
        ? 'Course Rep'
        : groupReps.has(id)
          ? 'Group Rep'
          : 'Member',
      joinedAt: asText(toDateString(data.createdAt).slice(0, 10) || data.joinedAt, 'Recently'),
    }));
}

export async function fetchGroupAnnouncements(groupId: string): Promise<StudentHubAnnouncement[]> {
  const snapshot = await getDocs(
    query(
      collection(db(), 'courseGroups', groupId, 'notifications'),
      orderBy('createdAt', 'desc'),
      limit(20),
    ),
  );

  return snapshot.docs.map((item) => {
    const data = item.data() as Record<string, unknown>;
    return {
      id: item.id,
      title: asText(data.title, 'Announcement'),
      body: asText(data.body ?? data.detail, ''),
      date: asText(toDateString(data.createdAt).slice(0, 10) || data.date, ''),
      author: asText(data.author ?? data.displayName ?? data.userName, 'StudentHub'),
    };
  });
}

export async function fetchGroupChatMessages(groupId: string): Promise<StudentHubChatMessage[]> {
  const chatDocs = await getDocs(query(collection(db(), 'chats'), where('groupId', '==', groupId), limit(1)));
  const chatDoc = chatDocs.docs[0];
  if (!chatDoc) return [];

  const messagesSnapshot = await getDocs(
    query(
      collection(db(), 'chats', chatDoc.id, 'messages'),
      orderBy('createdAt', 'asc'),
      limit(100),
    ),
  );

  return messagesSnapshot.docs.map((item) => {
    const data = item.data() as Record<string, unknown>;
    return {
      id: item.id,
      author: asText(data.author ?? data.displayName ?? data.userName, 'StudentHub'),
      role: asText(data.role ?? data.userRole, 'Member'),
      time: asText(toDateString(data.createdAt).slice(11, 16) || data.time, '—'),
      text: asText(data.text ?? data.message, ''),
    };
  });
}

export async function fetchNotifications(userId: string): Promise<StudentHubNotification[]> {
  const [recipientDocs, userDocs] = await Promise.all([
    getDocs(query(collection(db(), 'notifications'), where('recipientId', '==', userId), limit(50))),
    getDocs(query(collection(db(), 'notifications'), where('userId', '==', userId), limit(50))),
  ]);

  const notifications = [...recipientDocs.docs, ...userDocs.docs];
  return notifications.map((item) => {
    const data = item.data() as Record<string, unknown>;
    return {
      id: item.id,
      title: asText(data.title, 'Notification'),
      detail: asText(data.body ?? data.detail, ''),
      time: asText(toDateString(data.createdAt).slice(0, 16) || toDateString(data.timestamp).slice(0, 16) || data.time, 'Recently'),
      tone: (asText(data.tone, 'info') as StudentHubNotification['tone']) || 'info',
    };
  });
}

export async function fetchUserTimetableEntries(userId: string) {
  const flatEntries = await getDocs(
    query(
      collection(db(), 'timetable'),
      where('userId', '==', userId),
      orderBy('dayIndex', 'asc'),
    ),
  );

  if (flatEntries.docs.length > 0) {
    return sortByDateAsc(flatEntries.docs.map((item) => mapTimetableEntry(item.id, item.data() as Record<string, unknown>)));
  }

  const docSnapshot = await getDoc(doc(db(), 'timetables', userId));
  if (!docSnapshot.exists()) {
    return [];
  }

  const data = docSnapshot.data() as Record<string, unknown>;
  const entries: StudentHubTimetableEntry[] = [];

  Object.entries(data).forEach(([dayName, value], dayIndex) => {
    if (!Array.isArray(value)) return;
    value.forEach((item, index) => {
      const row = item as Record<string, unknown>;
      entries.push({
        id: `${dayName}-${index}`,
        userId,
        courseCode: asText(row.courseCode, '—'),
        courseName: asText(row.courseName ?? row.className, 'Untitled class'),
        dayIndex,
        day: dayName,
        startTime: asText(row.startTime, ''),
        endTime: asText(row.endTime, ''),
        venue: asText(row.venue ?? row.location, 'TBA'),
        instructor: asText(row.instructor, 'TBA'),
        groupName: asText(row.groupName ?? row.group, ''),
      });
    });
  });

  return sortByDateAsc(entries);
}

export async function fetchGroupTimetableEntries(groupId: string) {
  const snapshot = await getDocs(
    query(
      collection(db(), 'groupTimetables'),
      where('groupId', '==', groupId),
      orderBy('startTime', 'asc'),
      limit(100),
    ),
  );

  return snapshot.docs.map((item) => {
    const data = item.data() as Record<string, unknown>;
    return {
      id: item.id,
      courseCode: asText(data.courseCode, '—'),
      courseName: asText(data.className ?? data.courseName, 'Untitled class'),
      dayIndex: asNumber(data.dayIndex, 0),
      day: asText(data.dayOfWeek ?? data.day, '—'),
      startTime: asText(data.startTime, ''),
      endTime: asText(data.endTime, ''),
      venue: asText(data.venue ?? data.location ?? data.building, 'TBA'),
      instructor: asText(data.instructor, 'TBA'),
      groupName: groupId,
    };
  });
}

export async function fetchNextGroupClass(groupId: string) {
  const entries = await fetchGroupTimetableEntries(groupId);
  const next = entries[0];
  if (!next) return 'No upcoming class';
  const startLabel = next.startTime ? new Date(next.startTime).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' }) : next.day;
  return startLabel;
}

export function toCalendarLabel(entry: StudentHubTimetableEntry) {
  if (!entry.startTime) return `${entry.day}`;
  const date = new Date(entry.startTime);
  return date.toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' });
}
