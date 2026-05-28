import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { Send, AlertCircle } from 'lucide-react';
import {
  Button,
  Card,
  Input,
  Textarea,
  EmptyState,
} from '../../components/ui';
import { PageFrame } from '../../components/shared';
import {
  fetchGroupById,
  fetchGroupDocument,
  fetchGroupMembers,
  fetchCurrentUserProfile,
  getGroupRoleFlags,
  createGroupAnnouncement,
} from '../../lib/studenthubData';
import { useAuthStore } from '../../store/useAuthStore';

export function AnnouncementEditorPage() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const userId = useAuthStore((s) => s.session?.user.uid);

  // Form state
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Queries
  const groupQuery = useQuery({
    queryKey: ['group', groupId],
    queryFn: async () => (groupId ? fetchGroupById(groupId) : null),
    enabled: Boolean(groupId),
    staleTime: 60_000,
  });

  const rawGroupQuery = useQuery({
    queryKey: ['group-raw', groupId],
    queryFn: async () => (groupId ? fetchGroupDocument(groupId) : null),
    enabled: Boolean(groupId),
    staleTime: 60_000,
  });

  const profileQuery = useQuery({
    queryKey: ['profile', userId],
    queryFn: async () => (userId ? fetchCurrentUserProfile(userId) : null),
    enabled: Boolean(userId),
    staleTime: 60_000,
  });

  const group = groupQuery.data;
  const rawGroup = rawGroupQuery.data;
  const profile = profileQuery.data;

  // Check permissions
  const roleFlags = useMemo(
    () =>
      getGroupRoleFlags(
        userId ?? '',
        profile ?? null,
        groupId ?? '',
        rawGroup ?? null,
      ),
    [userId, profile, groupId, rawGroup],
  );

  const canPostAnnouncement =
    roleFlags.isAdmin ||
    roleFlags.isCourseAdmin ||
    roleFlags.isCourseRep ||
    roleFlags.isGroupRep;

  // Handlers
  async function handlePublish() {
    if (!title.trim() || !body.trim() || !groupId || !userId || !profile) {
      setError('Please fill in all fields');
      return;
    }

    setSaving(true);
    setError('');

    try {
      await createGroupAnnouncement({
        groupId,
        title: title.trim(),
        body: body.trim(),
        authorName: profile.name,
        authorId: userId,
      });

      // Navigate back to management page
      navigate(`/groups/${groupId}/manage`);
    } catch (err) {
      console.error('[AnnouncementEditor] publish failed:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to publish announcement',
      );
    } finally {
      setSaving(false);
    }
  }

  // Guards
  if (!groupId) {
    return (
      <EmptyState
        title="Missing group"
        description="No group ID was provided."
      />
    );
  }

  const isLoading = groupQuery.isLoading || profileQuery.isLoading;

  if (isLoading) {
    return (
      <PageFrame
        eyebrow="Announcement"
        title="Loading…"
        description="Preparing announcement editor."
      >
        <Card>
          <div style={{ animation: 'pulse 1.5s ease-in-out infinite', height: 200, borderRadius: 12, backgroundColor: 'var(--color-surface)' }} />
        </Card>
      </PageFrame>
    );
  }

  if (groupQuery.isError || !group) {
    return (
      <PageFrame
        eyebrow="Announcement"
        title="Group not found"
        description="This group could not be loaded."
      >
        <EmptyState
          title="Failed to load group"
          description="Please try again or go back."
          action={
            <Button
              variant="secondary"
              onClick={() => navigate(-1)}
            >
              Go back
            </Button>
          }
        />
      </PageFrame>
    );
  }

  if (!canPostAnnouncement) {
    return (
      <PageFrame
        eyebrow="Announcement"
        title={group.title}
        description="You do not have permission to post announcements."
      >
        <EmptyState
          title="Access denied"
          description="Only admins, course admins, course reps, and group reps can post announcements."
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

  return (
    <PageFrame
      eyebrow="Announcement"
      title={`Post announcement in ${group.title}`}
      description="Share updates and information with your group."
      action={
        <Button
          variant="primary"
          leadingIcon={<Send size={18} />}
          onClick={() => void handlePublish()}
          disabled={saving || !title.trim() || !body.trim()}
          loading={saving}
        >
          Publish
        </Button>
      }
    >
      <Card>
        <div className="form-grid">
          <Input
            label="Title"
            required
            placeholder="Important update"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={saving}
          />

          <Textarea
            label="Message"
            required
            rows={8}
            placeholder="Share your announcement, reminders, or updates with the group…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            disabled={saving}
          />

          {error && (
            <div
              style={{
                display: 'flex',
                gap: 8,
                padding: '12px 16px',
                borderRadius: 8,
                backgroundColor: 'rgba(220, 38, 38, 0.1)',
                border: '1px solid rgba(220, 38, 38, 0.3)',
                color: '#dc2626',
                fontSize: '14px',
              }}
            >
              <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="form-actions">
          <div className="form-actions__right">
            <Button
              variant="ghost"
              onClick={() => navigate(`/groups/${groupId}/manage`)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              leadingIcon={<Send size={16} />}
              onClick={() => void handlePublish()}
              disabled={saving || !title.trim() || !body.trim()}
              loading={saving}
            >
              Publish announcement
            </Button>
          </div>
        </div>
      </Card>
    </PageFrame>
  );
}
