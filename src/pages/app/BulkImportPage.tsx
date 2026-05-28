import { useQuery } from '@tanstack/react-query';
import { Download, Upload } from 'lucide-react';
import { Button, Card } from '../../components/ui';
import { PageFrame } from '../../components/shared';
import { formatDateLabel } from '../../lib/format';
import { useAuthStore } from '../../store/useAuthStore';
import { fetchUserTimetableEntries, fetchGroupMembers, fetchCurrentUserProfile } from '../../lib/studenthubData';
import { useParams } from 'react-router-dom';

export function BulkImportPage() {
  const userId = useAuthStore((state) => state.session?.user.uid);
  const { groupId } = useParams();

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
  });

  const isGroupRep = (membersQuery.data ?? []).some((m) => m.id === userId && m.role === 'Group Rep');
  const isCourseRep = (membersQuery.data ?? []).some((m) => m.id === userId && m.role === 'Course Rep') || ((profileQuery.data?.courseReps ?? []).length > 0);
  const isCourseAdmin = (profileQuery.data?.courseAdmins ?? []).length > 0;
  const canImport = groupId ? (isCourseAdmin || isCourseRep || isGroupRep) : isCourseAdmin;
  const timetableQuery = useQuery({
    queryKey: ['timetable', userId],
    queryFn: async () => (userId ? fetchUserTimetableEntries(userId) : []),
    enabled: Boolean(userId),
    staleTime: 60_000,
  });

  const scheduleEvents = timetableQuery.data ?? [];

  return (
    <PageFrame
      eyebrow="Bulk import"
      title="Upload, preview, and confirm"
      description="CSV and ICS imports are split into a validation step and a confirmation step so errors are visible before the job starts."
      action={
        canImport ? (
          <Button variant="primary" leadingIcon={<Upload size={18} />}>
            Upload file
          </Button>
        ) : (
          <Button variant="ghost" disabled>
            Upload (insufficient permissions)
          </Button>
        )
      }
    >
      <div className="section-block section-block--split">
        <Card className="drop-zone">
          <Upload size={28} />
          <h2>Drop CSV or ICS file here</h2>
          <p className="muted">
            title, subject_code, start, end, timezone, recurrence, location
          </p>
          <Button variant="secondary">Browse files</Button>
        </Card>

        <Card>
          <div className="section-block__head">
            <div>
              <p className="eyebrow eyebrow--subtle">Preview</p>
              <h2>Parsed rows</h2>
            </div>
          </div>
          <div className="preview-table">
            {scheduleEvents.map((event) => (
              <div key={event.id} className="preview-table__row">
                <strong>{event.courseName}</strong>
                <span>{formatDateLabel(event.startTime)}</span>
                <span>{event.venue}</span>
              </div>
            ))}
          </div>
          <div className="form-actions">
            <Button
              variant="ghost"
              leadingIcon={<Download size={18} />}
              disabled={!canImport}
            >
              Download errors
            </Button>
            <div className="form-actions__right">
              <Button variant="ghost">Back</Button>
              <Button variant="primary" disabled={!canImport}>Confirm import</Button>
            </div>
          </div>
        </Card>
      </div>
    </PageFrame>
  );
}