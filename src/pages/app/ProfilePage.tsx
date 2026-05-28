import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import React from 'react';
import {
  Button,
  Card,
  Badge,
  Input,
  Tabs,
  Textarea,
} from '../../components/ui';
import { PageFrame } from '../../components/shared';
import { useAppStore } from '../../store/useAppStore';
import { useAuthStore } from '../../store/useAuthStore';
import {
  fetchSchedulerUserProfile,
  saveSchedulerUserProfile,
} from '../../lib/busSchedulerData';
import type { SchedulerUserProfile } from '../../lib/busSchedulerData';

// ─── Palette (matches BU Scheduler app palette) ───────────────

const c = {
  bg: '#0D0F1C',
  surface: '#15182B',
  surfaceLight: '#1C1F35',
  surfaceHover: '#232640',
  text: '#FFFFFF',
  textSec: '#B3B6C6',
  textMuted: '#6B7280',
  border: '#23263D',
  green: '#2ECC71',
  greenHover: '#27AE60',
  greenMuted: 'rgba(46, 204, 113, 0.12)',
  greenGlow: 'rgba(46, 204, 113, 0.25)',
  amber: '#F59E0B',
  purple: '#8B5CF6',
  blue: '#3B82F6',
  error: '#E74C3C',
} as const;

// ─── Small reusable primitives ────────────────────────────────

const Spinner = ({ size = 20 }: { size?: number }) => (
  <motion.div
    style={{
      width: size,
      height: size,
      borderRadius: '50%',
      border: `2px solid ${c.greenMuted}`,
      borderTopColor: c.green,
    }}
    animate={{ rotate: 360 }}
    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
  />
);

const Avatar = React.memo(
  ({
    photoURL,
    displayName,
    size = 72,
  }: {
    photoURL?: string;
    displayName: string;
    size?: number;
  }) => (
    <div
      className="flex-shrink-0 flex items-center justify-center font-bold text-black overflow-hidden"
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.28,
        background: photoURL
          ? 'transparent'
          : `linear-gradient(135deg, ${c.green}, ${c.greenHover})`,
        fontSize: size * 0.38,
      }}
    >
      {photoURL ? (
        <img
          src={photoURL}
          alt={displayName}
          className="w-full h-full object-cover"
        />
      ) : (
        displayName.charAt(0).toUpperCase()
      )}
    </div>
  ),
);

// ─── Edit Profile Modal ───────────────────────────────────────
// Kept from BU Scheduler's rich modal pattern — bottom-sheet on
// mobile, centred dialog on desktop, matching StudentHub style.

const EditModal = React.memo(
  ({
    isOpen,
    onClose,
    profile,
    onSave,
    saving,
  }: {
    isOpen: boolean;
    onClose: () => void;
    profile: SchedulerUserProfile;
    onSave: (data: { nickname: string; bio: string }) => void;
    saving: boolean;
  }) => {
    const [nickname, setNickname] = useState(profile.nickname ?? '');
    const [bio, setBio] = useState(profile.bio ?? '');

    // Reset local state whenever the modal re-opens
    React.useEffect(() => {
      if (isOpen) {
        setNickname(profile.nickname ?? '');
        setBio(profile.bio ?? '');
      }
    }, [isOpen, profile]);

    if (!isOpen) return null;

    return (
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end lg:items-center justify-center"
            style={{
              backgroundColor: 'rgba(0,0,0,0.7)',
              backdropFilter: 'blur(6px)',
            }}
            onClick={onClose}
          >
            <motion.div
              onClick={(e) => e.stopPropagation()}
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="relative w-full lg:max-w-md lg:mx-4 rounded-t-3xl lg:rounded-3xl overflow-hidden"
              style={{ backgroundColor: c.surface, maxHeight: '90vh' }}
            >
              {/* Mobile drag handle */}
              <div className="flex justify-center pt-3 pb-1 lg:hidden">
                <div
                  className="w-10 h-1 rounded-full"
                  style={{ backgroundColor: c.border }}
                />
              </div>

              {/* Header */}
              <div
                className="flex items-center justify-between px-5 py-4 border-b"
                style={{ borderColor: c.border }}
              >
                <h2
                  className="text-base font-bold"
                  style={{ color: c.text }}
                >
                  Edit Profile
                </h2>
                <button
                  onClick={onClose}
                  className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors hover:brightness-125"
                  style={{
                    backgroundColor: c.surfaceLight,
                    color: c.textSec,
                  }}
                >
                  ✕
                </button>
              </div>

              {/* Fields */}
              <div
                className="p-5 space-y-4 overflow-y-auto"
                style={{ maxHeight: 'calc(90vh - 140px)' }}
              >
                {/* Re-using BU Scheduler's shared Input component */}
                <Input
                  label="Display Name"
                  defaultValue={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="Your display name"
                />
                <Textarea
                  label="Bio"
                  defaultValue={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell us about yourself…"
                  rows={4}
                />
              </div>

              {/* Actions */}
              <div
                className="flex gap-3 px-5 py-4 border-t"
                style={{ borderColor: c.border }}
              >
                <Button variant="secondary" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={() => onSave({ nickname, bio })}
                  loading={saving}
                >
                  Save changes
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  },
);

// ─── Role description helper ──────────────────────────────────
// Kept from StudentHub ProfilePage — same roles, same copy.

function RolesSection({ profile }: { profile: SchedulerUserProfile }) {
  const hasAdmin = (profile.courseAdmins?.length ?? 0) > 0;
  const hasCourseRep = (profile.courseReps?.length ?? 0) > 0;
  const hasLevelRep = (profile.levelCourseReps?.length ?? 0) > 0;
  const hasGroupRep = (profile.groupReps?.length ?? 0) > 0;
  const hasAny = hasAdmin || hasCourseRep || hasLevelRep || hasGroupRep;

  return (
    <div style={{ gridColumn: '1/-1' }}>
      <h3 style={{ margin: '8px 0', color: c.text }}>Roles & Permissions</h3>
      <div style={{ display: 'grid', gap: 10 }}>
        {/* Badge row */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {hasAdmin && <Badge tone="danger">Course Admin</Badge>}
          {hasCourseRep && <Badge tone="info">Course Rep</Badge>}
          {hasLevelRep && <Badge tone="warning">Level Course Rep</Badge>}
          {hasGroupRep && <Badge tone="success">Group Rep</Badge>}
          {!hasAny && <span className="muted">No special roles</span>}
        </div>

        {/* Description rows */}
        <div style={{ display: 'grid', gap: 6 }}>
          {hasAdmin && (
            <div>
              <strong style={{ color: c.text }}>Course Admin — Can:</strong>
              <div className="muted">
                Manage all groups, edit course settings, and perform admin
                actions.
              </div>
            </div>
          )}
          {hasCourseRep && (
            <div>
              <strong style={{ color: c.text }}>Course Rep — Can:</strong>
              <div className="muted">
                Create and manage groups for the course; cannot manage other
                courses.
              </div>
            </div>
          )}
          {hasLevelRep && (
            <div>
              <strong style={{ color: c.text }}>
                Level Course Rep — Can:
              </strong>
              <div className="muted">
                Create groups limited to their level; cannot modify other
                levels.
              </div>
            </div>
          )}
          {hasGroupRep && (
            <div>
              <strong style={{ color: c.text }}>Group Rep — Can:</strong>
              <div className="muted">
                Invite and manage members within their groups; cannot create
                global groups.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════

export function ProfilePage() {
  // ── Auth (BU Scheduler pattern) ───────────────────────────
  const userId = useAuthStore((s) => s.session?.user.uid);
  const isAuthenticated = useAuthStore((s) => s.status === 'authenticated');
  const navigate = useNavigate();

  // ── Tab state (StudentHub pattern) ────────────────────────
  const [tab, setTab] = useState('profile');
  const [showEditModal, setShowEditModal] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  const queryClient = useQueryClient();

  // ── Data fetching (StudentHub useQuery pattern) ────────────
  // Single query, proper queryKey, staleTime, enabled guard.
  const profileQuery = useQuery({
    queryKey: ['scheduler-profile', userId],
    queryFn: async () =>
      userId ? fetchSchedulerUserProfile(userId) : null,
    enabled: Boolean(userId),
    staleTime: 60_000,
  });

  const profile = profileQuery.data;

  // ── Save handler ──────────────────────────────────────────
  const handleSaveProfile = useCallback(
    async (data: { nickname: string; bio: string }) => {
      if (!userId) return;
      setSavingProfile(true);
      try {
        await saveSchedulerUserProfile(userId, {
          nickname: data.nickname,
          bio: data.bio,
        });
        // Invalidate so the query re-fetches fresh data automatically
        await queryClient.invalidateQueries({
          queryKey: ['scheduler-profile', userId],
        });
        setShowEditModal(false);
      } catch (err) {
        console.error('[ProfilePage] save error', err);
      } finally {
        setSavingProfile(false);
      }
    },
    [userId, queryClient],
  );

  // ── Render ────────────────────────────────────────────────
  return (
    <PageFrame
      id="profile-page-frame"
      eyebrow="Profile"
      title="Account settings"
      description="Edit profile details, notification preferences, and account actions from one place."
      action={
        <div className="flex items-center gap-2">
          {/* Edit button in the header action slot */}
          <Button
            variant="secondary"
            onClick={() => {
              if (!userId) {
                useAppStore.getState().openAuthModal('edit profile');
                return;
              }
              setShowEditModal(true);
            }}
          >
            Edit Profile
          </Button>
          <Button variant="danger" onClick={() => navigate('/sign-out')}>
            Sign out
          </Button>
        </div>
      }
    >
      {/* ── Tabs (StudentHub pattern) ──────────────────── */}
      <Tabs
        tabs={[
          { id: 'profile', label: 'Profile' },
          { id: 'notifications', label: 'Notifications' },
          { id: 'account', label: 'Account' },
          { id: 'help', label: 'Help' },
        ]}
        activeId={tab}
        onChange={setTab}
      />

      <Card>
        {/* ════════════════════════════════════════════════
            PROFILE TAB
            ════════════════════════════════════════════════ */}
        {tab === 'profile' && (
          <>
            {!isAuthenticated && !profileQuery.isLoading && (
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <span className="muted">
                  Sign in to view and edit your profile.
                </span>
                <Button
                  variant="primary"
                  onClick={() => useAppStore.getState().openAuthModal('view your profile')}
                >
                  Sign in
                </Button>
              </div>
            )}

            {/* Loading skeleton — matches StudentHub loading state */}
            {profileQuery.isLoading && (
              <div className="flex items-center justify-center py-12">
                <div className="flex flex-col items-center gap-3">
                  <Spinner size={32} />
                  <span className="muted text-sm">Loading profile…</span>
                </div>
              </div>
            )}

            {/* Error state */}
            {profileQuery.isError && (
              <div className="flex flex-col items-center gap-3 py-12">
                <span className="muted">Failed to load profile.</span>
                <Button
                  variant="secondary"
                  onClick={() => profileQuery.refetch()}
                >
                  Retry
                </Button>
              </div>
            )}

            {/* Loaded */}
            {profile && !profileQuery.isLoading && (
              <div className="form-grid">
                {/* ── Identity card at the top of the form grid ── */}
                <div
                  style={{ gridColumn: '1/-1' }}
                  className="flex items-start gap-4 pb-4 border-b mb-2"
                >
                  <Avatar
                    photoURL={profile.photoURL}
                    displayName={profile.displayName}
                    size={72}
                  />
                  <div className="flex-1 min-w-0 pt-1">
                    <h2
                      className="text-lg font-bold truncate"
                      style={{ color: c.text }}
                    >
                      {profile.nickname || profile.displayName}
                    </h2>
                    <p
                      className="text-sm truncate mb-2"
                      style={{ color: c.textMuted }}
                    >
                      @
                      {profile.displayName
                        .toLowerCase()
                        .replace(/\s/g, '')}
                    </p>
                    {/* Level pill — from BU Scheduler Profile */}
                    {profile.level && (
                      <span
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold"
                        style={{
                          backgroundColor: c.greenMuted,
                          color: c.green,
                        }}
                      >
                        ✦ {profile.level} Level
                      </span>
                    )}
                  </div>
                </div>

                {/* Standard form fields — StudentHub pattern */}
                <Input
                  label="Display Name"
                  defaultValue={profile.nickname ?? profile.displayName}
                  readOnly
                />
                <Input
                  label="Email"
                  defaultValue={profile.email}
                  readOnly
                />
                {profile.course && (
                  <Input
                    label="Department / Course"
                    defaultValue={profile.course}
                    readOnly
                  />
                )}
                <Textarea
                  label="Bio"
                  defaultValue={profile.bio ?? ''}
                  rows={4}
                  readOnly
                />

                {/* Roles — same as StudentHub, shared component */}
                <RolesSection profile={profile} />
              </div>
            )}
          </>
        )}

        {/* ════════════════════════════════════════════════
            NOTIFICATIONS TAB
            ════════════════════════════════════════════════ */}
        {tab === 'notifications' && (
          <div className="tool-list">
            <div className="tool-list__item">
              <strong>Enable reminders</strong>
              <span>
                Choose default reminder timing and delivery channel.
              </span>
            </div>
            <div className="tool-list__item">
              <strong>Do not disturb</strong>
              <span>Mute alerts between 11 PM and 8 AM.</span>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════
            ACCOUNT TAB
            ════════════════════════════════════════════════ */}
        {tab === 'account' && (
          <div className="tool-list">
            <div className="tool-list__item">
              <strong>Linked account PLACEHOLDER</strong>
              <span>{profile?.email ?? '—'}</span>
            </div>
            <div className="tool-list__item">
              <strong>My groups PLACEHOLDER</strong>
              <span>
                <Button
                  variant="ghost"
                  onClick={() => navigate('/groups')}
                >
                  View my groups →
                </Button>
              </span>
            </div>
            <div className="tool-list__item">
              <strong>Delete account PLACEHOLDER</strong>
              <span>Destructive action with confirmation.</span>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════
            HELP TAB
            ════════════════════════════════════════════════ */}
        {tab === 'help' && (
          <div className="tool-list">
            <div className="tool-list__item">
              <strong>FAQ</strong>
              <span>Read the support docs and app overview.</span>
            </div>
            <div className="tool-list__item">
              <strong>Contact support</strong>
              <span>
                Send a message for account or scheduling help.
              </span>
            </div>
          </div>
        )}
      </Card>

      {/* ── Edit Modal (BU Scheduler rich modal, wired to
              StudentHub-style save → invalidateQueries) ───── */}
      {profile && (
        <EditModal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          profile={profile}
          onSave={handleSaveProfile}
          saving={savingProfile}
        />
      )}
    </PageFrame>
  );
}

export default ProfilePage;