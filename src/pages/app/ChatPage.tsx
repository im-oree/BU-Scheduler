import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import { Button, Card, Input } from '../../components/ui';
import { PageFrame } from '../../components/shared';
import { fetchGroupById, fetchGroupChatMessages } from '../../lib/studenthubData';

export function ChatPage() {
  const { groupId } = useParams();
  const groupQuery = useQuery({
    queryKey: ['group', groupId],
    queryFn: async () => (groupId ? fetchGroupById(groupId) : null),
    enabled: Boolean(groupId),
    staleTime: 60_000,
  });
  const chatQuery = useQuery({
    queryKey: ['group-chat', groupId],
    queryFn: async () => (groupId ? fetchGroupChatMessages(groupId) : []),
    enabled: Boolean(groupId),
    staleTime: 30_000,
  });
  const group = groupQuery.data;
  const messages = chatQuery.data ?? [];

  return (
    <PageFrame
      eyebrow="Messages"
      title={`${group?.title ?? 'Group'} chat`}
      description="Member names, timestamps, and message history in a mobile-friendly conversation view."
      action={
        <Button
          variant="primary"
          leadingIcon={<MessageCircle size={18} />}
        >
          New message
        </Button>
      }
    >
      <Card className="chat-panel chat-panel--full">
        <div className="chat-panel__history">
          {messages.map((message) => (
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
    </PageFrame>
  );
}