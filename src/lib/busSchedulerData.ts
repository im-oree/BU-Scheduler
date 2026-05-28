// lib/busSchedulerData.ts
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getFirestore } from 'firebase/firestore';
import { getFirebaseApp } from './firebase';

// ─── Types ────────────────────────────────────────────────────

export type SchedulerUserProfile = {
  uid: string;
  displayName: string;
  nickname?: string;
  email: string;
  bio?: string;
  photoURL?: string;
  level?: number;
  course?: string;
  points?: number;
  rating?: number;
  ratingCount?: number;
  badges?: string[];
  walletNgnBalance?: number;
  threadUsername?: string;
  threadBio?: string;
  threadBannerUrl?: string;
  joinDate?: Date;
  // Role arrays — same shape as StudentHub
  courseAdmins?: string[];
  courseReps?: string[];
  levelCourseReps?: string[];
  groupReps?: string[];
};

// ─── Fetch ────────────────────────────────────────────────────

export async function fetchSchedulerUserProfile(
  uid: string,
): Promise<SchedulerUserProfile | null> {
  const db = getFirestore(getFirebaseApp());
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return null;

  const d = snap.data();

  return {
    uid,
    displayName: d.displayName || d.name || d.fullName || 'User',
    nickname: d.nickname || '',
    email: d.email || '',
    bio: d.bio || '',
    photoURL: d.photoURL || '',
    level: d.level,
    course: d.course,
    points: d.points || 0,
    rating: d.averageRating || 0,
    ratingCount: d.ratingCount || 0,
    badges: d.badges || [],
    walletNgnBalance: Number(d.walletNgnBalance || 0),
    threadUsername: d.threadUsername || '',
    threadBio: d.threadBio || '',
    threadBannerUrl: d.threadBannerUrl || d.bannerUrl || '',
    joinDate: d.joinDate?.toDate?.(),
    courseAdmins: d.courseAdmins || [],
    courseReps: d.courseReps || [],
    levelCourseReps: d.levelCourseReps || [],
    groupReps: d.groupReps || [],
  };
}

// ─── Save ─────────────────────────────────────────────────────

export async function saveSchedulerUserProfile(
  uid: string,
  patch: Partial<Pick<SchedulerUserProfile, 'nickname' | 'bio'>>,
): Promise<void> {
  const db = getFirestore(getFirebaseApp());
  await setDoc(doc(db, 'users', uid), patch, { merge: true });
}