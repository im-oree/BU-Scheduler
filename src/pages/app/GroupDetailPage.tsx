import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Plus, UserPlus } from 'lucide-react';
import { Badge, Button, Card, Input, Tabs } from '../../components/ui';
import { PageFrame } from '../../components/shared';
import { formatDateTime } from '../../lib/format';
import {
  fetchGroupAnnouncements,
  fetchGroupById,
  fetchGroupChatMessages,
  fetchGroupMembers,
  fetchGroupTimetableEntries,
} from '../../lib/studenthubData';

export function GroupDetailPage() {
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
  const announcementsQuery = useQuery({
    queryKey: ['group-announcements', groupId],
    queryFn: async () => (groupId ? fetchGroupAnnouncements(groupId) : []),
    enabled: Boolean(groupId),
    staleTime: 30_000,
  });
  const chatQuery = useQuery({
    queryKey: ['group-chat', groupId],
    queryFn: async () => (groupId ? fetchGroupChatMessages(groupId) : []),
    enabled: Boolean(groupId),
    staleTime: 30_000,
  });
  const scheduleQuery = useQuery({
    queryKey: ['group-schedule', groupId],
    queryFn: async () => (groupId ? fetchGroupTimetableEntries(groupId) : []),
    enabled: Boolean(groupId),
    staleTime: 60_000,
  });

  const group = groupQuery.data;
  const members = membersQuery.data ?? [];
  const announcements = announcementsQuery.data ?? [];
  const chatMessages = chatQuery.data ?? [];
  const scheduleEvents = scheduleQuery.data ?? [];
  const [tab, setTab] = useState('schedule');

  return (
    <PageFrame
      eyebrow="Group detail"
      title={group?.title ?? 'Group'}
      description={`${group?.courseCode ?? '—'} · Level ${group?.level ?? '—'} · ${members.length} members`}
      action={
        <Button variant="primary" leadingIcon={<Plus size={18} />}>
          Add class
        </Button>
      }
    >
      <Card className="group-overview">
        <div className="group-overview__summary">
          <div>
            <Badge tone="success">Open group</Badge>
            <p className="muted">
              Members, timetable, announcements, chat, and settings in one
              place.
            </p>
          </div>
          <div className="group-overview__actions">
            <Button variant="secondary">Join</Button>
            <Button variant="ghost">Settings</Button>
          </div>
        </div>
      </Card>

      <Tabs
        tabs={[
          { id: 'schedule', label: 'Schedule' },
          { id: 'members', label: 'Members', badge: String(members.length) },
          { id: 'chat', label: 'Chat' },
          {
            id: 'announcements',
            label: 'Announcements',
            badge: String(announcements.length),
          },
          { id: 'tools', label: 'Tools' },
        ]}
        activeId={tab}
        onChange={setTab}
      />

      {tab === 'schedule' && (
        <div className="timeline-list">
          {scheduleEvents.map((event) => (
            <Card key={event.id} className="timeline-card">
              <div className="timeline-card__left">
                <Badge tone="info">{event.courseCode}</Badge>
                <h3>{event.courseName}</h3>
                <p>{event.groupName || event.day}</p>
              </div>
              <div className="timeline-card__right">
                <span>{formatDateTime(event.startTime)}</span>
                <span>{event.venue}</span>
                <span>{event.instructor}</span>
              </div>
            </Card>
          ))}
        </div>
      )}

      {tab === 'members' && (
        <Card>
          <div className="table-header">
            <h2>Members</h2>
            <Button
              variant="secondary"
              size="sm"
              leadingIcon={<UserPlus size={16} />}
            >
              Invite member
            </Button>
          </div>
          <div className="member-table">
            {members.map((member) => (
              <div key={member.id} className="member-row">
                <div className="member-row__identity">
                  <div className="avatar avatar--small">
                    {member.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <strong>{member.name}</strong>
                    <span>{member.joinedAt}</span>
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
              </div>
            ))}
          </div>
        </Card>
      )}

      {tab === 'chat' && (
        <Card className="chat-panel">
          <div className="chat-panel__history">
            {chatMessages.map((message) => (
              <article key={message.id} className="chat-message">
                <div className="chat-message__meta">
                  <strong>{message.author}</strong>
                  <span>{message.role}</span>
                  <span>{message.time}</span>
                </div>
                <p>{message.text}</p>
              </article>
            ))}
          </div>
          <div className="chat-panel__composer">
            <Input label="Message" placeholder="Type a message..." />
            <Button variant="primary">Send</Button>
          </div>
        </Card>
      )}

      {tab === 'announcements' && (
        <div className="announcement-list">
            {announcements.map((announcement) => (
            <Card key={announcement.id}>
              <strong>{announcement.title}</strong>
              <p className="muted">{announcement.body}</p>
              <span className="muted">
                {announcement.author} · {announcement.date}
              </span>
            </Card>
          ))}
        </div>
      )}

      {tab === 'tools' && (
        <Card>
          <div className="tool-list">
            <div className="tool-list__item">
              <strong>Bulk import</strong>
              <span>
                Upload CSV or ICS files and confirm parsed rows before import.
              </span>
            </div>
            <div className="tool-list__item">
              <strong>Visibility</strong>
              <span>
                Toggle between private and public without leaving the page.
              </span>
            </div>
            <div className="tool-list__item">
              <strong>Danger zone</strong>
              <span>
                Delete all timetable entries or demote the current rep.
              </span>
            </div>
          </div>
        </Card>
      )}
    </PageFrame>
  );
}