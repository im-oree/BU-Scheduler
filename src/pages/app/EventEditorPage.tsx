import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import {
  Button,
  Card,
  Input,
  Select,
  Textarea,
} from '../../components/ui';
import { PageFrame } from '../../components/shared';
import { fetchGroupById, fetchGroupMembers, fetchCurrentUserProfile } from '../../lib/studenthubData';
import { useAuthStore } from '../../store/useAuthStore';
import { useAppStore } from '../../store/useAppStore';

export function EventEditorPage() {
  const { groupId, eventId } = useParams();
  const groupQuery = useQuery({
    queryKey: ['group', groupId],
    queryFn: async () => (groupId ? fetchGroupById(groupId) : null),
    enabled: Boolean(groupId),
    staleTime: 60_000,
  });
  const group = groupQuery.data;

  const userId = useAuthStore((s) => s.session?.user.uid);
  const membersQuery = useQuery({
    queryKey: ['group-members', groupId],
    queryFn: async () => (groupId ? fetchGroupMembers(groupId) : []),
    enabled: Boolean(groupId),
    staleTime: 60_000,
  });

  const profileQuery = useQuery({
    queryKey: ['profile', userId],
    queryFn: async () => (userId ? fetchCurrentUserProfile(userId) : null),
    enabled: Boolean(userId),
    staleTime: 60_000,
  });

  const members = membersQuery.data ?? [];
  const isGroupRep = members.some((m) => m.id === userId && m.role === 'Group Rep');
  const isCourseRep = members.some((m) => m.id === userId && m.role === 'Course Rep') || ((profileQuery.data?.courseReps ?? []).length > 0);
  const isCourseAdmin = (profileQuery.data?.courseAdmins ?? []).length > 0;
  const canManage = Boolean(groupId) ? (isCourseAdmin || isCourseRep || isGroupRep) : isCourseAdmin;

  return (
    <PageFrame
      eyebrow="Event editor"
      title={eventId ? 'Edit event' : `Add class for ${group?.title ?? 'Group'}`}
      description="Use validated fields for start and end time, recurrence, visibility, and attachments."
      action={
        canManage ? (
          <Button
            variant="primary"
            leadingIcon={<Plus size={18} />}
            onClick={() => {
              const status = useAuthStore.getState().status;
              if (status === 'authenticated') {
                // actual save handler lives elsewhere — placeholder
                return;
              }
              useAppStore.getState().openAuthModal('create event');
            }}
          >
            Save
          </Button>
        ) : null
      }
    >
      <Card>
        <div className="form-grid">
          <Input
            label="Title"
            required
            placeholder="Problem Solving Tutorial"
          />
          <Input label="Subject code" placeholder="COS102" />
          <Textarea
            label="Description"
            rows={4}
            placeholder="Optional notes for the session"
          />
          <Input label="Start date & time" type="datetime-local" required />
          <Input label="End date & time" type="datetime-local" required />
          <Select label="Timezone" defaultValue="Africa/Lagos">
            <option value="Africa/Lagos">Africa/Lagos</option>
            <option value="UTC">UTC</option>
          </Select>
          <Input label="Location" placeholder="Room 2 or virtual link" />
          <Select label="Recurrence" defaultValue="weekly">
            <option value="none">No repeat</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="custom">Custom</option>
          </Select>
          <Select label="Visibility" defaultValue="group">
            <option value="group">Private (group only)</option>
            <option value="public">Public</option>
          </Select>
        </div>
        <div className="form-actions">
          {canManage ? <Button variant="danger">Delete</Button> : null}
          <div className="form-actions__right">
            <Button variant="ghost">Cancel</Button>
            {canManage ? (
              <Button
                variant="primary"
                onClick={() => {
                  const status = useAuthStore.getState().status;
                  if (status === 'authenticated') {
                    // placeholder: submit
                    return;
                  }
                  useAppStore.getState().openAuthModal('create event');
                }}
              >
                Save event
              </Button>
            ) : (
              <span className="muted">You do not have permission to add or edit events for this group.</span>
            )}
          </div>
        </div>
      </Card>
    </PageFrame>
  );
}