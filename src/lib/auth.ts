import { apiBaseUrl } from './api';

export type AuthPermission = 'profile' | 'events' | 'schedule' | 'transactions' | 'notifications' | 'wallet';

export type AuthAppGrant = {
  appId: string;
  appName: string;
  authorizedAt: string;
  permissions: AuthPermission[];
};

export type AuthUser = {
  uid: string;
  email: string;
  displayName: string;
  phone?: string;
  photoURL?: string;
  matNumber?: string;
  department?: string;
  level?: number;
  authorizedApps?: AuthAppGrant[];
  permissions?: Record<AuthPermission, 'read' | 'write' | 'delete'>;
  metadata?: {
    lastLogin: string;
    loginCount: number;
    preferences?: {
      theme: 'light' | 'dark';
      notifications: boolean;
    };
  };
};

export type AuthSession = {
  token: string;
  user: AuthUser;
  authorizedApps?: AuthAppGrant[];
  returnTo?: string;
};

export type StudentHubAuthFlow = 'login' | 'signup';

export type StudentHubAuthRequest = {
  state: string;
  nonce: string;
  codeVerifier: string;
  codeChallenge: string;
  returnTo: string;
  flow: StudentHubAuthFlow;
  email: string;
  displayName: string;
  createdAt: string;
};

export type StudentHubAuthorizeResponse = {
  success: boolean;
  code: string;
  state: string;
  expiresInSeconds: number;
  returnTo: string;
  flow: StudentHubAuthFlow;
};

export type StudentHubExchangeResponse = {
  success: boolean;
  token: string;
  user: AuthUser;
  authorizedApps: AuthAppGrant[];
  returnTo: string;
  nonce: string;
  state: string;
};

const SESSION_STORAGE_KEY = 'bu-scheduler.session';
const PENDING_STORAGE_PREFIX = 'bu-scheduler.studenthub.pending.';

function base64UrlFromBytes(bytes: Uint8Array) {
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/u, '');
}

function randomBase64Url(size = 32) {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return base64UrlFromBytes(bytes);
}

export function normalizeReturnTo(target?: string | null) {
  if (!target) {
    return '/home';
  }

  if (target.startsWith('/') && !target.startsWith('//')) {
    return target;
  }

  try {
    const parsed = new URL(target, window.location.origin);
    if (parsed.origin !== window.location.origin) {
      return '/home';
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}` || '/home';
  } catch {
    return '/home';
  }
}

async function codeChallengeFromVerifier(codeVerifier: string) {
  const encoded = new TextEncoder().encode(codeVerifier);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return base64UrlFromBytes(new Uint8Array(digest));
}

function getPendingStorageKey(state: string) {
  return `${PENDING_STORAGE_PREFIX}${state}`;
}

export function loadStoredSession() {
  const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    return null;
  }
}

export function saveStoredSession(session: AuthSession) {
  window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

export function clearStoredSession() {
  window.localStorage.removeItem(SESSION_STORAGE_KEY);
}

async function requestJson<T>(path: string, init?: RequestInit) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  const payload = (await response.json().catch(() => null)) as { message?: string } | null;
  if (!response.ok) {
    throw new Error(payload?.message || `Request failed with status ${response.status}`);
  }

  return payload as T;
}

export async function signInWithPassword(email: string, password: string) {
  const payload = await requestJson<AuthSession>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

  saveStoredSession({ token: payload.token, user: payload.user, authorizedApps: payload.authorizedApps });
  return payload;
}

export async function verifyStoredSession(token: string) {
  return requestJson<{ success: boolean; valid: boolean; user: AuthUser }>('/auth/verify', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function prepareStudentHubAuthRequest({
  flow,
  email,
  displayName,
  returnTo,
}: {
  flow: StudentHubAuthFlow;
  email: string;
  displayName: string;
  returnTo: string;
}) {
  const state = randomBase64Url(24);
  const nonce = randomBase64Url(24);
  const codeVerifier = randomBase64Url(48);
  const codeChallenge = await codeChallengeFromVerifier(codeVerifier);
  const request: StudentHubAuthRequest = {
    state,
    nonce,
    codeVerifier,
    codeChallenge,
    returnTo: normalizeReturnTo(returnTo),
    flow,
    email,
    displayName,
    createdAt: new Date().toISOString(),
  };

  window.sessionStorage.setItem(getPendingStorageKey(state), JSON.stringify(request));
  return request;
}

export function getStudentHubAuthRequest(state: string) {
  const raw = window.sessionStorage.getItem(getPendingStorageKey(state));
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as StudentHubAuthRequest;
  } catch {
    return null;
  }
}

export function clearStudentHubAuthRequest(state: string) {
  window.sessionStorage.removeItem(getPendingStorageKey(state));
}

export function buildStudentHubAuthUrl(request: StudentHubAuthRequest) {
  const params = new URLSearchParams({
    state: request.state,
    flow: request.flow,
    returnTo: request.returnTo,
  });

  return `/auth/studenthub?${params.toString()}`;
}

export async function authorizeStudentHubPopup(request: StudentHubAuthRequest) {
  return requestJson<StudentHubAuthorizeResponse>('/auth/studenthub/authorize', {
    method: 'POST',
    body: JSON.stringify({
      state: request.state,
      codeChallenge: request.codeChallenge,
      nonce: request.nonce,
      returnTo: request.returnTo,
      email: request.email,
      displayName: request.displayName,
      flow: request.flow,
    }),
  });
}

export async function exchangeStudentHubAuthCode(code: string, state: string) {
  const request = getStudentHubAuthRequest(state);
  if (!request) {
    throw new Error('Temporary StudentHub session expired. Please try again.');
  }

  const payload = await requestJson<StudentHubExchangeResponse>('/auth/studenthub/exchange', {
    method: 'POST',
    body: JSON.stringify({
      code,
      state,
      codeVerifier: request.codeVerifier,
    }),
  });

  clearStudentHubAuthRequest(state);
  saveStoredSession({ token: payload.token, user: payload.user, authorizedApps: payload.authorizedApps, returnTo: payload.returnTo });
  return payload;
}
