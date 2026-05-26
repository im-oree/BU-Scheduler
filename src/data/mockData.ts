export type GroupCard = {
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

export type MemberCard = {
  id: string;
  name: string;
  role: 'Member' | 'Group Rep' | 'Course Rep';
  joinedAt: string;
};

export type ScheduleEvent = {
  id: string;
  title: string;
  subjectCode: string;
  startAt: string;
  endAt: string;
  location: string;
  groupName: string;
  organizer: string;
  accent: 'green' | 'amber' | 'navy';
};

export type AnnouncementItem = {
  id: string;
  title: string;
  body: string;
  date: string;
  author: string;
};

export type ChatMessage = {
  id: string;
  author: string;
  role: string;
  time: string;
  text: string;
};

export type NotificationItem = {
  id: string;
  title: string;
  detail: string;
  time: string;
  tone: 'success' | 'warning' | 'danger' | 'info';
};

export type FeatureTile = {
  title: string;
  description: string;
};

export const productFeatures: FeatureTile[] = [
  { title: 'Timetable', description: 'View, filter, and manage classes across every group from one merged schedule.' },
  { title: 'Group Chat', description: 'Coordinate classes and announcements with a focused chat flow that works on mobile.' },
  { title: 'Reminders', description: 'Send reminders before class starts with support for several notification channels.' },
  { title: 'Bulk Import', description: 'Upload CSV or ICS files, validate rows, and confirm changes in a two-step flow.' },
];

export const quickActions = [
  { title: 'Create group', description: 'Start a new course group', href: '/groups?mode=create' },
  { title: 'Join group', description: 'Enter an invite code or link', href: '/invite/CS100-B' },
  { title: 'Bulk import', description: 'Upload a CSV or ICS file', href: '/import' },
];

export const groups: GroupCard[] = [
  {
    id: 'grp_100',
    title: 'CS 100 Level - Group B',
    courseCode: 'COS102',
    level: '100',
    memberCount: 48,
    lastActivity: '10 minutes ago',
    nextClass: 'Today 10:00 AM',
    description: 'Weekly programming tutorials and rep announcements for the core cohort.',
    accent: 'green',
  },
  {
    id: 'grp_210',
    title: 'Software Engineering Cohort',
    courseCode: 'CSC214',
    level: '200',
    memberCount: 62,
    lastActivity: '1 hour ago',
    nextClass: 'Tomorrow 2:00 PM',
    description: 'Team project planning, sprint reviews, and shared course reminders.',
    accent: 'amber',
  },
  {
    id: 'grp_310',
    title: 'Faculty Admin Panel',
    courseCode: 'ENGR300',
    level: '300',
    memberCount: 18,
    lastActivity: 'Today 8:15 AM',
    nextClass: 'Wed 9:30 AM',
    description: 'Administrative cohort for calendar management and delegated scheduling.',
    accent: 'navy',
  },
];

export const stats = [
  { label: 'Up next', value: '10:00 AM' },
  { label: 'Groups', value: '3 active' },
  { label: 'Unread messages', value: '5' },
  { label: 'Reminders queued', value: '8' },
];

export const scheduleEvents: ScheduleEvent[] = [
  {
    id: 'evt_001',
    title: 'Problem Solving Tutorial',
    subjectCode: 'COS102',
    startAt: '2026-05-26T10:00:00Z',
    endAt: '2026-05-26T11:00:00Z',
    location: 'Room 2',
    groupName: 'CS 100 Level - Group B',
    organizer: 'Amina Yusuf',
    accent: 'green',
  },
  {
    id: 'evt_002',
    title: 'Sprint Planning',
    subjectCode: 'CSC214',
    startAt: '2026-05-27T14:00:00Z',
    endAt: '2026-05-27T15:15:00Z',
    location: 'Room 4',
    groupName: 'Software Engineering Cohort',
    organizer: 'Tunde Bello',
    accent: 'amber',
  },
  {
    id: 'evt_003',
    title: 'Shared Timetable Review',
    subjectCode: 'ENGR300',
    startAt: '2026-05-28T09:30:00Z',
    endAt: '2026-05-28T10:30:00Z',
    location: 'Virtual link',
    groupName: 'Faculty Admin Panel',
    organizer: 'Chiamaka Obi',
    accent: 'navy',
  },
];

export const membersByGroup: Record<string, MemberCard[]> = {
  grp_100: [
    { id: 'm1', name: 'Amina Yusuf', role: 'Group Rep', joinedAt: '2026-01-12' },
    { id: 'm2', name: 'Ibrahim Musa', role: 'Course Rep', joinedAt: '2026-01-14' },
    { id: 'm3', name: 'Grace Nnamdi', role: 'Member', joinedAt: '2026-01-18' },
    { id: 'm4', name: 'Tobi Ade', role: 'Member', joinedAt: '2026-02-01' },
  ],
  grp_210: [
    { id: 'm5', name: 'Tunde Bello', role: 'Group Rep', joinedAt: '2026-01-10' },
    { id: 'm6', name: 'Adaeze Okafor', role: 'Member', joinedAt: '2026-01-15' },
    { id: 'm7', name: 'Chinedu Eze', role: 'Member', joinedAt: '2026-01-20' },
  ],
  grp_310: [
    { id: 'm8', name: 'Chiamaka Obi', role: 'Course Rep', joinedAt: '2026-01-08' },
    { id: 'm9', name: 'Daniel Bello', role: 'Member', joinedAt: '2026-01-19' },
  ],
};

export const announcementsByGroup: Record<string, AnnouncementItem[]> = {
  grp_100: [
    {
      id: 'a1',
      title: 'Tutorial moved to Room 2',
      body: 'The class scheduled for today has been moved to Room 2. Please arrive 10 minutes early.',
      date: '2026-05-26',
      author: 'Amina Yusuf',
    },
    {
      id: 'a2',
      title: 'Assignment reminder',
      body: 'Submit the COS102 exercise sheet before Friday 5 PM.',
      date: '2026-05-24',
      author: 'Ibrahim Musa',
    },
  ],
  grp_210: [
    {
      id: 'a3',
      title: 'Sprint review checklist',
      body: 'Bring your demo notes and update the shared board before the review session.',
      date: '2026-05-25',
      author: 'Tunde Bello',
    },
  ],
};

export const chatByGroup: Record<string, ChatMessage[]> = {
  grp_100: [
    { id: 'c1', author: 'Amina Yusuf', role: 'Group Rep', time: '09:02', text: 'Tutorial still starts at 10. Please confirm attendance.' },
    { id: 'c2', author: 'Grace Nnamdi', role: 'Member', time: '09:05', text: 'Confirmed. I am on my way to campus now.' },
    { id: 'c3', author: 'Ibrahim Musa', role: 'Course Rep', time: '09:07', text: 'I posted the reminder on the announcements tab as well.' },
  ],
  grp_210: [
    { id: 'c4', author: 'Tunde Bello', role: 'Group Rep', time: '08:15', text: 'Please review the sprint goals before our 2 PM meeting.' },
    { id: 'c5', author: 'Adaeze Okafor', role: 'Member', time: '08:21', text: 'Will do. I will upload the updated mockups this morning.' },
  ],
};

export const notifications: NotificationItem[] = [
  { id: 'n1', title: 'Promoted to Group Rep', detail: 'You are now a group rep in CS 100 Level - Group B.', time: '5 minutes ago', tone: 'success' },
  { id: 'n2', title: 'New class added', detail: 'Problem Solving is scheduled for today at 10:00 AM.', time: '12 minutes ago', tone: 'info' },
  { id: 'n3', title: 'Reminder due soon', detail: 'Health Principles starts in 10 minutes.', time: '20 minutes ago', tone: 'warning' },
  { id: 'n4', title: 'Join request denied', detail: 'One invite code has expired and can no longer be used.', time: '1 hour ago', tone: 'danger' },
];

export const invitePreview = {
  title: 'CS 100 Level - Group B',
  subtitle: 'Invite code CS100-B',
  note: 'Link expires in 7 days or after 20 uses.',
};

export const profileSummary = {
  name: 'Amina Yusuf',
  email: 'amina.yusuf@studenthub.edu',
  phone: '+234 801 234 5678',
  timezone: 'Africa/Lagos',
  bio: 'Managing cohort schedules, reminders, and class updates for the current session.',
};

export function getGroup(groupId: string | undefined) {
  return groups.find((group) => group.id === groupId) ?? groups[0];
}

export function getMembers(groupId: string | undefined) {
  return membersByGroup[groupId ?? ''] ?? membersByGroup.grp_100;
}

export function getAnnouncements(groupId: string | undefined) {
  return announcementsByGroup[groupId ?? ''] ?? announcementsByGroup.grp_100;
}

export function getChatMessages(groupId: string | undefined) {
  return chatByGroup[groupId ?? ''] ?? chatByGroup.grp_100;
}
