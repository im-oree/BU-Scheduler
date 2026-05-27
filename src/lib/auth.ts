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
  appJwt?: string;
  accessToken?: string;
  idToken?: string;
  refreshToken?: string;
  tokenType?: string;
  expiresIn?: number;
  expiresAt?: string;
  user: AuthUser;
  authorizedApps?: AuthAppGrant[];
  returnTo?: string;
  provider?: 'studenthub';
  studenthubId?: string;
  scopes?: string[];
};

export type StudentHubAuthFlow = 'login' | 'signup';

export type StudentHubAuthRequest = {
  state: string;
  nonce: string;
  codeVerifier: string;
  codeChallenge: string;
  returnTo: string;
  flow: StudentHubAuthFlow;
  email?: string;
  displayName?: string;
  createdAt: string;
  scopes?: string[];
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

export type OAuthCallbackResponse = {
  success: boolean;
  token?: string;
  appJwt?: string;
  access_token?: string;
  id_token?: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number;
  expiresAt?: string;
  returnTo?: string;
  user: AuthUser;
  authorizedApps?: AuthAppGrant[];
  studenthubId?: string;
  scopes?: string[];
  isFirstLogin?: boolean;
  isNewAccount?: boolean;
};

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/u, '');
}

export const studentHubBaseUrl = trimTrailingSlash(import.meta.env.VITE_STUDENTHUB_API || 'https://studenthub-backend-1w1n.onrender.com');
export const studentHubApiBaseUrl = `${studentHubBaseUrl}/api`;
export const oauthAuthorizeUrl = import.meta.env.VITE_OAUTH_AUTHORIZE_URL || `${studentHubBaseUrl}/oauth/authorize`;
export const oauthTokenUrl = import.meta.env.VITE_OAUTH_TOKEN_URL || `${studentHubBaseUrl}/oauth/token`;
export const oauthUserInfoUrl = import.meta.env.VITE_OAUTH_USERINFO_URL || `${studentHubBaseUrl}/oauth/userinfo`;
export const oauthJwksUrl = import.meta.env.VITE_OAUTH_JWKS_URL || `${studentHubBaseUrl}/oauth/jwks`;
export const oauthDiscoveryUrl = `${studentHubBaseUrl}/.well-known/openid-configuration`;
export const oauthCallbackUrl = `${studentHubApiBaseUrl}/auth/oauth/callback`;
export const oauthLogoutUrl = `${studentHubApiBaseUrl}/auth/logout`;
export const oauthClientId = import.meta.env.VITE_OAUTH_CLIENT_ID || 'bu-scheduler-dev';
export const oauthScopes = ['openid', 'profile', 'email', 'timetable', 'groups', 'notifications'];

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
  const url = /^https?:\/\//u.test(path) ? path : `${apiBaseUrl}${path}`;

  const response = await fetch(url, {
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
  void email;
  void password;
  throw new Error('Local password login is disabled. Use StudentHub sign-in instead.');
}

export async function verifyStoredSession(token: string) {
  return requestJson<{ success: boolean; user: AuthUser; authorizedApps?: AuthAppGrant[] }>(`${studentHubApiBaseUrl}/auth/user-profile`, {
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
  email?: string;
  displayName?: string;
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
    scopes: oauthScopes,
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

export function buildStudentHubAuthorizeUrl(request: StudentHubAuthRequest) {
  const redirectUri = `${window.location.origin}/auth/callback`;
  const params = new URLSearchParams({
    client_id: oauthClientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: request.scopes?.join(' ') || oauthScopes.join(' '),
    state: request.state,
    nonce: request.nonce,
    code_challenge: request.codeChallenge,
    code_challenge_method: 'S256',
  });

  return `${oauthAuthorizeUrl}?${params.toString()}`;
}

export async function exchangeOAuthCallback(code: string, state: string) {
  const request = getStudentHubAuthRequest(state);
  if (!request) {
    throw new Error('Temporary StudentHub session expired. Please try again.');
  }

  const payload = await requestJson<OAuthCallbackResponse>(oauthCallbackUrl, {
    method: 'POST',
    body: JSON.stringify({
      code,
      state,
      code_verifier: request.codeVerifier,
      nonce: request.nonce,
    }),
  });

  clearStudentHubAuthRequest(state);

  const token = payload.appJwt || payload.token || payload.access_token;
  if (!token) {
    throw new Error('StudentHub did not return an app token.');
  }

  const session: AuthSession = {
    token,
    appJwt: payload.appJwt || payload.token || payload.access_token,
    accessToken: payload.access_token,
    idToken: payload.id_token,
    refreshToken: payload.refresh_token,
    tokenType: payload.token_type,
    expiresIn: payload.expires_in,
    expiresAt: payload.expiresAt,
    user: payload.user,
    authorizedApps: payload.authorizedApps ?? [],
    returnTo: payload.returnTo ?? request.returnTo,
    provider: 'studenthub',
    studenthubId: payload.studenthubId,
    scopes: payload.scopes ?? request.scopes,
  };

  saveStoredSession(session);
  return session;
}

export async function logoutStudentHubSession(token: string) {
  try {
    await requestJson<{ success: boolean }>(oauthLogoutUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  } catch {
    // Clear local state even if remote logout fails.
  }
}

export async function authorizeStudentHubPopup(request: StudentHubAuthRequest) {
  void request;
  throw new Error('Popup authorization is deprecated. Use buildStudentHubAuthorizeUrl() and redirect to StudentHub.');
}

export async function exchangeStudentHubAuthCode(code: string, state: string) {
  return exchangeOAuthCallback(code, state);
}
