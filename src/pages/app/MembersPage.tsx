import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { UserPlus } from 'lucide-react';
import { Badge, Button, Card, Input, Select } from '../../components/ui';
import { PageFrame } from '../../components/shared';
import { fetchGroupById, fetchGroupMembers } from '../../lib/studenthubData';

export function MembersPage() {
  const { groupId } = useParams();
  const groupQuery = useQuery({
    queryKey: ['group', groupId],
    queryFn: async () => (groupId ? fetchGroupById(groupId) : null),
    enabled: Boolean(groupId),
    staleTime: 60_000,
  });
  const membersQuery = useQuery({
    queryKey: ['group-members', groupId],
    queryFn: async () => (groupId ? fetchGroupMembers(groupId) : []),
    enabled: Boolean(groupId),
    staleTime: 60_000,
  });

  const group = groupQuery.data;
  const members = membersQuery.data ?? [];

  return (
    <PageFrame
      eyebrow="Members"
      title={`${group?.title ?? 'Group'} members`}
      description="Use the table view for role management, invites, and member search."
      action={
        <Button
          variant="secondary"
          leadingIcon={<UserPlus size={18} />}
        >
          Invite member
        </Button>
      }
    >
      <Card>
        <div className="table-header">
          <Input
            label="Search members"
            placeholder="Search by name or role"
          />
          <Select label="Role" defaultValue="all">
            <option value="all">All roles</option>
            <option value="member">Member</option>
            <option value="rep">Group Rep</option>
            <option value="course-rep">Course Rep</option>
          </Select>
        </div>
        <div className="member-table member-table--dense">
          {members.map((member) => (
            <div key={member.id} className="member-row">
              <div className="member-row__identity">
                <div className="avatar avatar--small">
                  {member.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <strong>{member.name}</strong>
                  <span>Joined {member.joinedAt}</span>
                </div>
              </div>
              <Badge
                tone={
                  member.role === 'Course Rep'
                    ? 'warning'
                    : member.role === 'Group Rep'
                      ? 'success'
                      : 'neutral'
                }
              >
                {member.role}
              </Badge>
              <Button variant="ghost" size="sm">
                Message
              </Button>
            </div>
          ))}
        </div>
      </Card>
    </PageFrame>
  );
}