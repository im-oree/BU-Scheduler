import { Crown, Shield, Sparkles } from 'lucide-react';
import type { StudentHubChatMessage } from '../../lib/studenthubData';

function getRoleMeta(message: StudentHubChatMessage) {
  if (message.userRole?.isAdmin) {
    return {
      label: 'Admin',
      icon: Shield,
      tone: 'danger' as const,
      background: 'rgba(147, 51, 234, 0.14)',
      border: 'rgba(147, 51, 234, 0.28)',
      text: 'var(--text)',
    };
  }

  if (message.userRole?.isCourseAdmin || message.role === 'Course Admin') {
    return {
      label: 'Course Admin',
      icon: Shield,
      tone: 'info' as const,
      background: 'rgba(59, 130, 246, 0.14)',
      border: 'rgba(59, 130, 246, 0.28)',
      text: 'var(--text)',
    };
  }

  if (message.userRole?.isGroupRep || message.role === 'Group Rep') {
    return {
      label: 'Group Rep',
      icon: Crown,
      tone: 'warning' as const,
      background: 'linear-gradient(135deg, rgba(250, 204, 21, 0.22), rgba(245, 158, 11, 0.10))',
      border: 'rgba(245, 158, 11, 0.40)',
      text: '#1f2937',
    };
  }

  if (message.userRole?.isCourseRep || message.role === 'Course Rep') {
    return {
      label: 'Course Rep',
      icon: Sparkles,
      tone: 'success' as const,
      background: 'rgba(34, 197, 94, 0.12)',
      border: 'rgba(34, 197, 94, 0.25)',
      text: 'var(--text)',
    };
  }

  return null;
}

export function GroupChatMessageItem({ message }: { message: StudentHubChatMessage }) {
  const role = getRoleMeta(message);
  const RoleIcon = role?.icon;

  return (
    <article
      className={role ? 'chat-message chat-message--role' : 'chat-message'}
      style={
        role
          ? {
              background: role.background,
              borderColor: role.border,
              color: role.text,
            }
          : undefined
      }
    >
      <div className="chat-message__meta">
        <strong>
          {message.author}
          {role && RoleIcon ? (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                marginLeft: 8,
                fontSize: '0.74rem',
                fontWeight: 700,
                color: role.text,
              }}
            >
              <RoleIcon size={14} />
              {role.label}
            </span>
          ) : null}
        </strong>
        <span>{message.role}</span>
        <span>{message.time}</span>
      </div>
      <p>{message.text}</p>
    </article>
  );
}
