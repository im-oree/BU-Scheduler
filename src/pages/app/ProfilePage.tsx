import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import {
  Button,
  Card,
  Badge,
  Input,
  Select,
  Tabs,
  Textarea,
} from '../../components/ui';
import { PageFrame } from '../../components/shared';
import { useAuthStore } from '../../store/useAuthStore';
import { fetchCurrentUserProfile } from '../../lib/studenthubData';

export function ProfilePage() {
  const [tab, setTab] = useState('profile');
  const userId = useAuthStore((state) => state.session?.user.uid);
  const profileQuery = useQuery({
    queryKey: ['profile', userId],
    queryFn: async () => (userId ? fetchCurrentUserProfile(userId) : null),
    enabled: Boolean(userId),
    staleTime: 60_000,
  });

  const profile = profileQuery.data;

  return (
    <PageFrame
      eyebrow="Profile"
      title="Account settings"
      description="Edit profile details, notification preferences, and account actions from one place."
      action={<Button variant="danger">Sign out</Button>}
    >
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
        {tab === 'profile' && (
          <div className="form-grid">
            <Input label="Name" defaultValue={profile?.name ?? ''} />
            <Input
              label="Email"
              defaultValue={profile?.email ?? ''}
              readOnly
            />
            <Input label="Phone" defaultValue={profile?.phone ?? ''} />
            <Select
              label="Timezone"
              defaultValue={profile?.timezone ?? 'Africa/Lagos'}
            >
              <option value="Africa/Lagos">Africa/Lagos</option>
              <option value="UTC">UTC</option>
            </Select>
            <Textarea
              label="Bio"
              defaultValue={profile?.bio ?? ''}
              rows={4}
            />
            <div style={{ gridColumn: '1/-1' }}>
              <h3 style={{ margin: '8px 0' }}>Roles & Permissions</h3>
              {profile ? (
                <div style={{ display: 'grid', gap: 10 }}>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {profile.courseAdmins?.length > 0 && (
                      <Badge tone="danger">Course Admin</Badge>
                    )}
                    {profile.courseReps?.length > 0 && (
                      <Badge tone="info">Course Rep</Badge>
                    )}
                    {profile.levelCourseReps?.length > 0 && (
                      <Badge tone="warning">Level Course Rep</Badge>
                    )}
                    {profile.groupReps?.length > 0 && (
                      <Badge tone="success">Group Rep</Badge>
                    )}
                    {!(profile.courseAdmins?.length || profile.courseReps?.length || profile.levelCourseReps?.length || profile.groupReps?.length) && (
                      <span className="muted">No special roles</span>
                    )}
                  </div>

                  <div style={{ display: 'grid', gap: 6 }}>
                    {profile.courseAdmins?.length > 0 && (
                      <div>
                        <strong>Course Admin — Can:</strong>
                        <div className="muted">Manage all groups, edit course settings, and perform admin actions.</div>
                      </div>
                    )}

                    {profile.courseReps?.length > 0 && (
                      <div>
                        <strong>Course Rep — Can:</strong>
                        <div className="muted">Create and manage groups for the course; cannot manage other courses.</div>
                      </div>
                    )}

                    {profile.levelCourseReps?.length > 0 && (
                      <div>
                        <strong>Level Course Rep — Can:</strong>
                        <div className="muted">Create groups limited to their level; cannot modify other levels.</div>
                      </div>
                    )}

                    {profile.groupReps?.length > 0 && (
                      <div>
                        <strong>Group Rep — Can:</strong>
                        <div className="muted">Invite and manage members within their groups; cannot create global groups.</div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="muted">Loading roles…</div>
              )}
            </div>
          </div>
        )}
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
        {tab === 'account' && (
          <div className="tool-list">
            <div className="tool-list__item">
              <strong>Linked StudentHub account</strong>
              <span>{profile?.email ?? ''}</span>
            </div>
            <div className="tool-list__item">
              <strong>Delete account</strong>
              <span>Destructive action with confirmation.</span>
            </div>
          </div>
        )}
        {tab === 'help' && (
          <div className="tool-list">
            <div className="tool-list__item">
              <strong>FAQ</strong>
              <span>Read the support docs and app overview.</span>
            </div>
            <div className="tool-list__item">
              <strong>Contact support</strong>
              <span>Send a message for account or scheduling help.</span>
            </div>
          </div>
        )}
      </Card>
    </PageFrame>
  );
}