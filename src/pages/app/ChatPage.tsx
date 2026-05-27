import { useParams } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import { Button, Card, Input } from '../../components/ui';
import { PageFrame } from '../../components/shared';
import { getChatMessages, getGroup } from '../../data/mockData';

export function ChatPage() {
  const { groupId } = useParams();
  const group = getGroup(groupId);
  const messages = getChatMessages(group.id);

  return (
    <PageFrame
      eyebrow="Messages"
      title={`${group.title} chat`}
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