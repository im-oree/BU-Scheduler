import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Plus, UserPlus } from 'lucide-react';
import { Badge, Button, Card, Input, Tabs } from '../../components/ui';
import { PageFrame } from '../../components/shared';
import { formatDateTime } from '../../lib/format';
import {
  getAnnouncements,
  getChatMessages,
  getGroup,
  getMembers,
  scheduleEvents,
} from '../../data/mockData';

export function GroupDetailPage() {
  const { groupId } = useParams();
  const group = getGroup(groupId);
  const members = getMembers(group.id);
  const announcements = getAnnouncements(group.id);
  const [tab, setTab] = useState('schedule');

  return (
    <PageFrame
      eyebrow="Group detail"
      title={group.title}
      description={`${group.courseCode} · Level ${group.level} · ${group.memberCount} members`}
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
                <Badge
                  tone={
                    event.accent === 'green'
                      ? 'success'
                      : event.accent === 'amber'
                        ? 'warning'
                        : 'info'
                  }
                >
                  {event.subjectCode}
                </Badge>
                <h3>{event.title}</h3>
                <p>{event.groupName}</p>
              </div>
              <div className="timeline-card__right">
                <span>{formatDateTime(event.startAt)}</span>
                <span>{event.location}</span>
                <span>{event.organizer}</span>
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
            {getChatMessages(group.id).map((message) => (
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