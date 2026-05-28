// src/pages/chat/ChatPage.tsx
// BU Scheduler — Full Chat Page
// React Query + onSnapshot + studenthubData + Role-based features

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query as firestoreQuery,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import {
  AlertTriangle,
  ChevronDown,
  ChevronLeft,
  Crown,
  MessageSquare,
  MoreVertical,
  Power,
  Send,
  Shield,
  Trash2,
  Users,
} from 'lucide-react';

import { useAuthStore } from '../../store/useAuthStore';
import {
  fetchCurrentUserProfile,
  fetchGroupById,
  fetchGroupChatMessages,
  fetchGroupDocument,
  fetchUserGroups,
  getGroupRoleFlags,
  sendGroupChatMessage,
  type StudentHubChatMessage,
  type StudentHubGroup,
} from '../../lib/studenthubData';
import { getFirebaseApp } from '../../lib/firebase';

// ─── Theme tokens ─────────────────────────────────────────────────────────────

const t = {
  bg: 'var(--color-bg, #0D0F1C)',
  surface: 'var(--color-surface, #15182B)',
  elevated: 'var(--color-elevated, #1E2138)',
  border: 'var(--color-border, #23263D)',
  text: 'var(--color-text, #FFFFFF)',
  textSub: 'var(--color-text-sub, #B3B6C6)',
  textMuted: 'var(--color-text-muted, #6B6F85)',
  textDim: 'var(--color-text-dim, #454862)',
  primary: 'var(--color-primary, #2ECC71)',
  primarySoft: 'var(--color-primary-soft, rgba(46,204,113,0.12))',
  primaryHover: 'var(--color-primary-hover, #27AE60)',
  warning: 'var(--color-warning, #F59E0B)',
  warningSoft: 'var(--color-warning-soft, rgba(245,158,11,0.12))',
  danger: 'var(--color-danger, #E74C3C)',
  blue: 'var(--color-blue, #3B82F6)',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function initials(name: string): string {
  return (name || '?')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function formatMessageTime(raw: string): string {
  if (!raw) return '';
  if (/^\d{1,2}:\d{2}$/.test(raw)) return raw;
  if (raw.length > 10) {
    const d = new Date(raw);
    if (!isNaN(d.getTime())) {
      return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    }
    return raw.slice(11, 16) || raw;
  }
  return raw;
}

function formatDateDivider(raw: string): string {
  if (!raw) return '';
  const d = new Date(raw);
  if (isNaN(d.getTime())) return '';
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
}

function getMessageDate(msg: StudentHubChatMessage): string {
  if (!msg.time || msg.time.length <= 10) return '';
  const d = new Date(msg.time);
  if (!isNaN(d.getTime())) return d.toDateString();
  return '';
}

// ─── CSS ──────────────────────────────────────────────────────────────────────

const CSS = `
  .chat-page {
    display: flex;
    flex-direction: column;
    height: 100vh;
    height: 100dvh;
    background: ${t.bg};
    overflow: hidden;
  }

  .chat-header {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 16px;
    background: ${t.surface};
    border-bottom: 1px solid ${t.border};
    z-index: 10;
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
  }

  .chat-header__back {
    display: grid;
    place-items: center;
    width: 36px;
    height: 36px;
    border-radius: 10px;
    border: none;
    background: ${t.elevated};
    color: ${t.textSub};
    cursor: pointer;
    flex-shrink: 0;
    transition: all 0.15s ease;
  }
  .chat-header__back:active { transform: scale(0.92); }

  .chat-header__info {
    flex: 1;
    min-width: 0;
    cursor: pointer;
  }
  .chat-header__info:active { opacity: 0.7; }

  .chat-header__title {
    font-size: 0.92rem;
    font-weight: 600;
    color: ${t.text};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .chat-header__sub {
    font-size: 0.72rem;
    color: ${t.textMuted};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-top: 1px;
  }

  .chat-header__actions {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }

  .chat-header__btn {
    display: grid;
    place-items: center;
    width: 36px;
    height: 36px;
    border-radius: 10px;
    border: none;
    background: ${t.elevated};
    color: ${t.textSub};
    cursor: pointer;
    transition: all 0.15s ease;
  }
  .chat-header__btn:active { transform: scale(0.92); }

  .chat-switcher-overlay {
    position: fixed;
    inset: 0;
    z-index: 50;
    background: rgba(0,0,0,0.5);
  }

  .chat-switcher {
    position: fixed;
    top: 56px;
    left: 12px;
    right: 12px;
    z-index: 51;
    max-width: 420px;
    margin: 0 auto;
    border-radius: 16px;
    background: ${t.surface};
    border: 1px solid ${t.border};
    box-shadow: 0 20px 60px rgba(0,0,0,0.5);
    overflow: hidden;
    animation: chatSlideDown 0.15s ease;
  }
  @keyframes chatSlideDown {
    from { opacity: 0; transform: translateY(-8px) scale(0.97); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }

  .chat-switcher__header {
    padding: 14px 16px 8px;
    font-size: 0.68rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: ${t.textMuted};
  }

  .chat-switcher__list {
    max-height: 320px;
    overflow-y: auto;
    padding: 0 8px 8px;
  }

  .chat-switcher__item {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 10px 12px;
    border-radius: 12px;
    border: none;
    background: transparent;
    color: ${t.text};
    cursor: pointer;
    transition: all 0.12s ease;
    text-align: left;
  }
  .chat-switcher__item:active { transform: scale(0.98); }
  .chat-switcher__item--active {
    background: ${t.primarySoft};
    border: 1px solid rgba(46,204,113,0.2);
  }

  .chat-switcher__avatar {
    display: grid;
    place-items: center;
    width: 38px;
    height: 38px;
    border-radius: 10px;
    color: white;
    font-size: 0.78rem;
    font-weight: 700;
    flex-shrink: 0;
  }

  .chat-messages {
    flex: 1;
    overflow-y: auto;
    padding: 12px 16px 8px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    scroll-behavior: smooth;
    overscroll-behavior: contain;
  }

  .chat-date-divider {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 0 6px;
  }
  .chat-date-divider__line {
    flex: 1;
    height: 1px;
    background: ${t.border};
  }
  .chat-date-divider__label {
    font-size: 0.68rem;
    font-weight: 600;
    color: ${t.textDim};
    text-transform: uppercase;
    letter-spacing: 0.06em;
    flex-shrink: 0;
  }

  .chat-bubble-row {
    display: flex;
    gap: 8px;
    max-width: 82%;
    position: relative;
  }
  .chat-bubble-row--own {
    align-self: flex-end;
    flex-direction: row-reverse;
  }
  .chat-bubble-row--other {
    align-self: flex-start;
  }

  .chat-avatar {
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    border-radius: 10px;
    color: white;
    font-size: 0.62rem;
    font-weight: 700;
    flex-shrink: 0;
    align-self: flex-end;
  }

  .chat-bubble {
    padding: 10px 14px;
    border-radius: 18px;
    max-width: 100%;
    word-break: break-word;
    position: relative;
  }
  .chat-bubble--own {
    background: ${t.primarySoft};
    border: 1px solid rgba(46,204,113,0.15);
    border-bottom-right-radius: 6px;
  }
  .chat-bubble--other {
    background: ${t.elevated};
    border: 1px solid ${t.border};
    border-bottom-left-radius: 6px;
  }
  .chat-bubble--rep {
    background: ${t.warningSoft};
    border: 1px solid rgba(245,158,11,0.15);
    border-bottom-left-radius: 6px;
  }

  .chat-bubble__author {
    display: flex;
    align-items: center;
    gap: 5px;
    margin-bottom: 3px;
  }

  .chat-bubble__name {
    font-size: 0.72rem;
    font-weight: 700;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .chat-bubble__badge {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-size: 0.58rem;
    font-weight: 700;
    padding: 1px 6px;
    border-radius: 6px;
    flex-shrink: 0;
  }

  .chat-bubble__text {
    font-size: 0.85rem;
    line-height: 1.55;
    color: ${t.text};
  }

  .chat-bubble__meta {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 6px;
    margin-top: 4px;
  }

  .chat-bubble__time {
    font-size: 0.62rem;
    color: ${t.textDim};
  }

  .chat-bubble__delete {
    display: grid;
    place-items: center;
    width: 18px;
    height: 18px;
    border-radius: 6px;
    border: none;
    background: transparent;
    color: ${t.textDim};
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.15s ease;
    padding: 0;
  }
  .chat-bubble-row:hover .chat-bubble__delete,
  .chat-bubble__delete:focus { opacity: 1; }
  .chat-bubble__delete:active { transform: scale(0.85); color: ${t.danger}; }

  .chat-composer {
    flex-shrink: 0;
    display: flex;
    align-items: flex-end;
    gap: 8px;
    padding: 10px 16px 14px;
    border-top: 1px solid ${t.border};
    background: ${t.surface};
  }

  .chat-composer__input {
    flex: 1;
    min-height: 42px;
    max-height: 120px;
    padding: 10px 16px;
    border-radius: 22px;
    border: 1.5px solid ${t.border};
    background: ${t.elevated};
    color: ${t.text};
    font-size: 0.88rem;
    outline: none;
    resize: none;
    font-family: inherit;
    line-height: 1.4;
    transition: border-color 0.15s ease;
  }
  .chat-composer__input:focus {
    border-color: ${t.primary};
  }
  .chat-composer__input::placeholder {
    color: ${t.textMuted};
  }

  .chat-composer__send {
    display: grid;
    place-items: center;
    width: 42px;
    height: 42px;
    border-radius: 50%;
    border: none;
    background: ${t.primary};
    color: white;
    cursor: pointer;
    flex-shrink: 0;
    transition: all 0.15s ease;
  }
  .chat-composer__send:disabled {
    opacity: 0.35;
    cursor: default;
  }
  .chat-composer__send:not(:disabled):active {
    transform: scale(0.9);
    background: ${t.primaryHover};
  }

  .chat-spinner {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255,255,255,0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: chatSpin 0.6s linear infinite;
  }
  .chat-spinner--sm {
    width: 10px;
    height: 10px;
    border-width: 1.5px;
  }

  .chat-disabled-banner {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    background: ${t.warningSoft};
    border-top: 1px solid rgba(245,158,11,0.15);
  }
  .chat-disabled-banner p {
    font-size: 0.78rem;
    font-weight: 500;
    color: ${t.warning};
  }

  .chat-empty {
    flex: 1;
    display: grid;
    place-items: center;
    text-align: center;
    padding: 40px 24px;
  }
  .chat-empty__icon {
    display: grid;
    place-items: center;
    width: 64px;
    height: 64px;
    border-radius: 20px;
    background: ${t.primarySoft};
    color: ${t.primary};
    margin-bottom: 16px;
  }
  .chat-empty__title {
    font-size: 0.95rem;
    font-weight: 600;
    color: ${t.text};
    margin-bottom: 6px;
  }
  .chat-empty__sub {
    font-size: 0.82rem;
    color: ${t.textSub};
    line-height: 1.5;
    max-width: 240px;
  }

  .chat-loading {
    flex: 1;
    display: grid;
    place-items: center;
    gap: 12px;
  }

  .chat-more-overlay {
    position: fixed;
    inset: 0;
    z-index: 50;
  }
  .chat-more-menu {
    position: fixed;
    top: 52px;
    right: 12px;
    z-index: 51;
    min-width: 200px;
    border-radius: 14px;
    background: ${t.surface};
    border: 1px solid ${t.border};
    box-shadow: 0 16px 48px rgba(0,0,0,0.5);
    padding: 6px;
    animation: chatSlideDown 0.12s ease;
  }
  .chat-more-menu__item {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 10px 12px;
    border-radius: 10px;
    border: none;
    background: transparent;
    color: ${t.text};
    font-size: 0.84rem;
    font-weight: 500;
    cursor: pointer;
    text-align: left;
    transition: background 0.1s ease;
  }
  .chat-more-menu__item:active { background: ${t.elevated}; }
  .chat-more-menu__item--danger { color: ${t.danger}; }

  @keyframes chatSpin {
    to { transform: rotate(360deg); }
  }
`;

// ─── Component ────────────────────────────────────────────────────────────────

export function ChatPage() {
  const { groupId: paramGroupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.session?.user.uid);
  const db = getFirestore(getFirebaseApp());

  // Active group — will be set to first group if no param
  const [activeGroupId, setActiveGroupId] = useState<string>(
    paramGroupId ?? '',
  );
  const [hasAutoSelected, setHasAutoSelected] = useState(false);

  // UI state
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [chatEnabled, setChatEnabled] = useState(true);

  // Real-time messages
  const [liveMessages, setLiveMessages] = useState<
    StudentHubChatMessage[] | null
  >(null);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // ─── React Query ────────────────────────────────────────────────────────

  const profileQuery = useQuery({
    queryKey: ['profile', userId],
    queryFn: () => (userId ? fetchCurrentUserProfile(userId) : null),
    enabled: Boolean(userId),
    staleTime: 60_000,
  });

  const userGroupsQuery = useQuery({
    queryKey: ['user-groups', userId],
    queryFn: () => (userId ? fetchUserGroups(userId) : []),
    enabled: Boolean(userId),
    staleTime: 60_000,
  });

  const groupQuery = useQuery({
    queryKey: ['group', activeGroupId],
    queryFn: () =>
      activeGroupId ? fetchGroupById(activeGroupId) : null,
    enabled: Boolean(activeGroupId),
    staleTime: 60_000,
  });

  const rawGroupQuery = useQuery({
    queryKey: ['group-raw', activeGroupId],
    queryFn: () =>
      activeGroupId ? fetchGroupDocument(activeGroupId) : null,
    enabled: Boolean(activeGroupId),
    staleTime: 60_000,
  });

  const chatQuery = useQuery({
    queryKey: ['group-chat', activeGroupId],
    queryFn: () =>
      activeGroupId ? fetchGroupChatMessages(activeGroupId) : [],
    enabled: Boolean(activeGroupId),
    staleTime: 30_000,
  });

  // ─── Derived ────────────────────────────────────────────────────────────

  const group = groupQuery.data;
  const rawGroup = rawGroupQuery.data;
  const userGroups: StudentHubGroup[] = userGroupsQuery.data ?? [];
  const messages: StudentHubChatMessage[] =
    liveMessages ?? chatQuery.data ?? [];

  const roleFlags = useMemo(
    () =>
      getGroupRoleFlags(
        userId ?? '',
        profileQuery.data ?? null,
        activeGroupId,
        rawGroup ?? null,
      ),
    [userId, profileQuery.data, activeGroupId, rawGroup],
  );

  const isRep =
    roleFlags.isGroupRep ||
    roleFlags.isCourseRep ||
    roleFlags.isCourseAdmin ||
    roleFlags.isAdmin;

  const groupReps = useMemo<Set<string>>(() => {
    if (!rawGroup) return new Set();
    const reps = Array.isArray(rawGroup.groupReps)
      ? (rawGroup.groupReps as string[])
      : [];
    return new Set(reps);
  }, [rawGroup]);

  const memberCount = rawGroup
    ? typeof rawGroup.memberCount === 'number'
      ? rawGroup.memberCount
      : Array.isArray(rawGroup.members)
      ? (rawGroup.members as unknown[]).length
      : 0
    : 0;

  // ─── Auto-select first group ────────────────────────────────────────────
  // If no groupId param and user has groups, open the first one by default

  useEffect(() => {
    if (paramGroupId) {
      setActiveGroupId(paramGroupId);
      setHasAutoSelected(true);
      return;
    }

    if (!hasAutoSelected && userGroups.length > 0 && !activeGroupId) {
      const firstId = userGroups[0].id;
      setActiveGroupId(firstId);
      setHasAutoSelected(true);
      window.history.replaceState(null, '', `/chat/${firstId}`);
    }
  }, [paramGroupId, userGroups, activeGroupId, hasAutoSelected]);

  // ─── Sync chatEnabled ──────────────────────────────────────────────────

  useEffect(() => {
    if (rawGroup) {
      setChatEnabled(Boolean(rawGroup.chatEnabled ?? true));
    }
  }, [rawGroup]);

  // ─── Real-time: messages ────────────────────────────────────────────────

  useEffect(() => {
    if (!activeGroupId) return;

    const q = firestoreQuery(
      collection(db, 'groupChats', activeGroupId, 'messages'),
      orderBy('createdAt', 'asc'),
      limit(200),
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const msgs: StudentHubChatMessage[] = snap.docs.map((d) => {
          const data = d.data() as Record<string, unknown>;
          const rawTime = String(data.createdAt ?? data.timestamp ?? '');
          return {
            id: d.id,
            author: String(
              data.author ?? data.userName ?? data.senderName ?? 'Member',
            ),
            role: String(data.role ?? 'Member'),
            time: rawTime,
            text: String(data.text ?? data.message ?? ''),
            userId: String(data.userId ?? ''),
            userAvatar: String(data.userAvatar ?? ''),
            edited: Boolean(data.edited),
            deleted: Boolean(data.deleted),
          };
        });

        setLiveMessages(msgs);
        queryClient.setQueryData(['group-chat', activeGroupId], msgs);
      },
      (err) => console.warn('[BUScheduler] chat listener:', err),
    );

    return unsub;
  }, [activeGroupId, db, queryClient]);

  // ─── Real-time: group doc ──────────────────────────────────────────────

  useEffect(() => {
    if (!activeGroupId) return;

    const unsub = onSnapshot(
      doc(db, 'courseGroups', activeGroupId),
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data() as Record<string, unknown>;
        setChatEnabled(Boolean(data.chatEnabled ?? true));
        queryClient.setQueryData(['group-raw', activeGroupId], {
          id: snap.id,
          ...data,
        });
      },
      (err) => console.warn('[BUScheduler] group doc listener:', err),
    );

    return unsub;
  }, [activeGroupId, db, queryClient]);

  // ─── Auto-scroll ────────────────────────────────────────────────────────

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length]);

  // ─── Actions ────────────────────────────────────────────────────────────

  async function handleSend() {
    if (!messageText.trim() || !userId || !profileQuery.data || !activeGroupId)
      return;
    setSending(true);
    try {
      await sendGroupChatMessage({
        groupId: activeGroupId,
        userId,
        profile: profileQuery.data,
        text: messageText.trim(),
      });
      setMessageText('');
      if (inputRef.current) inputRef.current.style.height = 'auto';
    } catch (err) {
      console.error('[BUScheduler] send message:', err);
    } finally {
      setSending(false);
    }
  }

  async function handleDelete(messageId: string) {
    if (!activeGroupId) return;
    if (!window.confirm('Delete this message?')) return;
    setDeletingId(messageId);
    try {
      await deleteDoc(
        doc(db, 'groupChats', activeGroupId, 'messages', messageId),
      );
    } catch (err) {
      console.error('[BUScheduler] delete message:', err);
    } finally {
      setDeletingId(null);
    }
  }

  async function handleClearAll() {
    if (!activeGroupId) return;
    if (!window.confirm('Delete ALL messages? This cannot be undone.')) return;
    setMoreMenuOpen(false);
    try {
      let count = 0;
      while (true) {
        const snap = await getDocs(
          firestoreQuery(
            collection(db, 'groupChats', activeGroupId, 'messages'),
            limit(100),
          ),
        );
        if (snap.empty) break;
        await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
        count += snap.size;
        if (snap.size < 100) break;
      }
      setLiveMessages([]);
      window.alert(`${count} message(s) deleted.`);
    } catch (err) {
      console.error('[BUScheduler] clear chat:', err);
    }
  }

  async function handleToggleChat() {
    if (!activeGroupId) return;
    const next = !chatEnabled;
    setChatEnabled(next);
    setMoreMenuOpen(false);
    try {
      await updateDoc(doc(db, 'courseGroups', activeGroupId), {
        chatEnabled: next,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error('[BUScheduler] toggle chat:', err);
      setChatEnabled(!next);
    }
  }

  function switchGroup(gid: string) {
    setActiveGroupId(gid);
    setSwitcherOpen(false);
    setLiveMessages(null);
    window.history.replaceState(null, '', `/chat/${gid}`);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setMessageText(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  // ─── Loading ────────────────────────────────────────────────────────────

  if (userGroupsQuery.isLoading) {
    return (
      <>
        <style>{CSS}</style>
        <div className="chat-page">
          <div className="chat-header">
            <button className="chat-header__back" onClick={() => navigate(-1)}>
              <ChevronLeft size={18} />
            </button>
            <div className="chat-header__info">
              <div className="skeleton" style={{ width: 120, height: 14 }} />
              <div className="skeleton" style={{ width: 80, height: 10, marginTop: 4 }} />
            </div>
          </div>
          <div className="chat-loading">
            <div
              style={{
                width: 40,
                height: 40,
                border: `3px solid ${t.border}`,
                borderTopColor: t.primary,
                borderRadius: '50%',
                animation: 'chatSpin 0.7s linear infinite',
              }}
            />
            <p style={{ fontSize: '0.84rem', color: t.textMuted }}>
              Loading messages…
            </p>
          </div>
        </div>
      </>
    );
  }

  // ─── No groups at all ──────────────────────────────────────────────────

  if (userGroups.length === 0) {
    return (
      <>
        <style>{CSS}</style>
        <div className="chat-page">
          <div className="chat-header">
            <button className="chat-header__back" onClick={() => navigate(-1)}>
              <ChevronLeft size={18} />
            </button>
            <div className="chat-header__info">
              <div className="chat-header__title">Messages</div>
              <div className="chat-header__sub">Join a group to start chatting</div>
            </div>
          </div>
          <div className="chat-empty">
            <div className="chat-empty__icon">
              <Users size={28} />
            </div>
            <div className="chat-empty__title">No groups yet</div>
            <div className="chat-empty__sub">
              Join a group first, then come back here to chat with your classmates.
            </div>
          </div>
        </div>
      </>
    );
  }

  // ─── Waiting for group data to load ────────────────────────────────────

  if (activeGroupId && (groupQuery.isLoading || chatQuery.isLoading)) {
    return (
      <>
        <style>{CSS}</style>
        <div className="chat-page">
          <div className="chat-header">
            <button className="chat-header__back" onClick={() => navigate(-1)}>
              <ChevronLeft size={18} />
            </button>
            <div className="chat-header__info">
              <div className="skeleton" style={{ width: 140, height: 14 }} />
              <div className="skeleton" style={{ width: 90, height: 10, marginTop: 4 }} />
            </div>
          </div>
          <div className="chat-loading">
            <div
              style={{
                width: 40,
                height: 40,
                border: `3px solid ${t.border}`,
                borderTopColor: t.primary,
                borderRadius: '50%',
                animation: 'chatSpin 0.7s linear infinite',
              }}
            />
            <p style={{ fontSize: '0.84rem', color: t.textMuted }}>
              Loading chat…
            </p>
          </div>
        </div>
      </>
    );
  }

  // ─── Render ─────────────────────────────────────────────────────────────

  let lastDateKey = '';

  return (
    <>
      <style>{CSS}</style>
      <div className="chat-page">
        {/* ── Header ───────────────────────────────────────────────── */}
        <div className="chat-header">
          <button className="chat-header__back" onClick={() => navigate(-1)}>
            <ChevronLeft size={18} />
          </button>

          <div className="chat-header__info" onClick={() => setSwitcherOpen(true)}>
            <div className="chat-header__title">
              {group?.title ?? 'Chat'}
              <ChevronDown
                size={13}
                style={{
                  color: t.textMuted,
                  transform: switcherOpen ? 'rotate(180deg)' : 'none',
                  transition: 'transform 0.2s',
                }}
              />
            </div>
            <div className="chat-header__sub">
              {group?.courseCode ?? ''} · {memberCount} member
              {memberCount !== 1 ? 's' : ''}
              {isRep && " · You're a rep"}
            </div>
          </div>

          <div className="chat-header__actions">
            {isRep && (
              <button
                className="chat-header__btn"
                onClick={() => setMoreMenuOpen(!moreMenuOpen)}
                title="Chat options"
              >
                <MoreVertical size={17} />
              </button>
            )}
          </div>
        </div>

        {/* ── Group Switcher ───────────────────────────────────────── */}
        {switcherOpen && (
          <>
            <div
              className="chat-switcher-overlay"
              onClick={() => setSwitcherOpen(false)}
            />
            <div className="chat-switcher">
              <div className="chat-switcher__header">Switch group chat</div>
              <div className="chat-switcher__list">
                {userGroups.map((g) => (
                  <button
                    key={g.id}
                    className={`chat-switcher__item ${
                      g.id === activeGroupId ? 'chat-switcher__item--active' : ''
                    }`}
                    onClick={() => switchGroup(g.id)}
                  >
                    <div
                      className="chat-switcher__avatar"
                      style={{
                        background: g.id === activeGroupId ? t.primary : t.textDim,
                      }}
                    >
                      {initials(g.title)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p
                        style={{
                          fontSize: '0.86rem',
                          fontWeight: g.id === activeGroupId ? 600 : 400,
                          color: g.id === activeGroupId ? t.primary : t.text,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {g.title}
                      </p>
                      <p style={{ fontSize: '0.72rem', color: t.textMuted, marginTop: 1 }}>
                        {g.courseCode} · {g.memberCount} members
                      </p>
                    </div>
                    {g.id === activeGroupId && (
                      <div
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: t.primary,
                          flexShrink: 0,
                        }}
                      />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ── More Menu ────────────────────────────────────────────── */}
        {moreMenuOpen && (
          <>
            <div className="chat-more-overlay" onClick={() => setMoreMenuOpen(false)} />
            <div className="chat-more-menu">
              <button className="chat-more-menu__item" onClick={() => void handleToggleChat()}>
                <Power size={16} style={{ color: chatEnabled ? t.primary : t.danger }} />
                {chatEnabled ? 'Disable chat' : 'Enable chat'}
              </button>
              <button
                className="chat-more-menu__item chat-more-menu__item--danger"
                onClick={() => void handleClearAll()}
              >
                <Trash2 size={16} />
                Clear all messages
              </button>
              <button
                className="chat-more-menu__item"
                onClick={() => {
                  setMoreMenuOpen(false);
                  navigate(`/groups/${activeGroupId}/manage`);
                }}
              >
                <Shield size={16} style={{ color: t.blue }} />
                Manage group
              </button>
            </div>
          </>
        )}

        {/* ── Messages ─────────────────────────────────────────────── */}
        <div className="chat-messages">
          {messages.length === 0 ? (
            <div className="chat-empty">
              <div className="chat-empty__icon">
                <MessageSquare size={28} />
              </div>
              <div className="chat-empty__title">No messages yet</div>
              <div className="chat-empty__sub">
                Be the first to start the conversation!
              </div>
            </div>
          ) : (
            messages.map((msg) => {
              const isOwn = msg.userId === userId;
              const isMsgFromRep =
                groupReps.has(msg.userId ?? '') ||
                msg.userRole?.isGroupRep ||
                msg.userRole?.isCourseRep;
              const canDelete = isOwn || isRep;

              const dateKey = getMessageDate(msg);
              let showDivider = false;
              if (dateKey && dateKey !== lastDateKey) {
                showDivider = true;
                lastDateKey = dateKey;
              }

              return (
                <div key={msg.id}>
                  {showDivider && (
                    <div className="chat-date-divider">
                      <div className="chat-date-divider__line" />
                      <span className="chat-date-divider__label">
                        {formatDateDivider(msg.time)}
                      </span>
                      <div className="chat-date-divider__line" />
                    </div>
                  )}

                  <div
                    className={`chat-bubble-row ${
                      isOwn ? 'chat-bubble-row--own' : 'chat-bubble-row--other'
                    }`}
                  >
                    {!isOwn && (
                      <div
                        className="chat-avatar"
                        style={{ background: isMsgFromRep ? t.warning : t.textDim }}
                      >
                        {initials(msg.author)}
                      </div>
                    )}

                    <div
                      className={`chat-bubble ${
                        isOwn
                          ? 'chat-bubble--own'
                          : isMsgFromRep
                          ? 'chat-bubble--rep'
                          : 'chat-bubble--other'
                      }`}
                    >
                      {!isOwn && (
                        <div className="chat-bubble__author">
                          <span
                            className="chat-bubble__name"
                            style={{ color: isMsgFromRep ? t.warning : t.textSub }}
                          >
                            {msg.author}
                          </span>
                          {isMsgFromRep && (
                            <span
                              className="chat-bubble__badge"
                              style={{ background: t.warningSoft, color: t.warning }}
                            >
                              <Crown size={8} />
                              Rep
                            </span>
                          )}
                        </div>
                      )}

                      <div className="chat-bubble__text">{msg.text}</div>

                      <div className="chat-bubble__meta">
                        <span className="chat-bubble__time">
                          {formatMessageTime(msg.time)}
                        </span>
                        {canDelete && (
                          <button
                            className="chat-bubble__delete"
                            onClick={() => void handleDelete(msg.id)}
                            disabled={deletingId === msg.id}
                            title="Delete message"
                          >
                            {deletingId === msg.id ? (
                              <div className="chat-spinner chat-spinner--sm" />
                            ) : (
                              <Trash2 size={10} />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={chatEndRef} />
        </div>

        {/* ── Chat disabled banner ─────────────────────────────────── */}
        {!chatEnabled && !isRep && (
          <div className="chat-disabled-banner">
            <AlertTriangle size={16} style={{ color: t.warning, flexShrink: 0 }} />
            <p>Chat has been disabled by the group rep.</p>
          </div>
        )}

        {/* ── Composer ─────────────────────────────────────────────── */}
        {(chatEnabled || isRep) && (
          <div className="chat-composer">
            <textarea
              ref={inputRef}
              className="chat-composer__input"
              placeholder={
                chatEnabled ? 'Type a message…' : 'Chat is off (rep override)'
              }
              value={messageText}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              rows={1}
            />
            <button
              className="chat-composer__send"
              disabled={!messageText.trim() || sending}
              onClick={() => void handleSend()}
            >
              {sending ? <div className="chat-spinner" /> : <Send size={18} />}
            </button>
          </div>
        )}
      </div>
    </>
  );
}

export default ChatPage;