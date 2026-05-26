import cors from 'cors';
import dotenv from 'dotenv';
import express, { type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { createHash, randomUUID } from 'node:crypto';
import {
  multiAppAuthStore,
  type AppPermission,
  type AuthTokenPayload,
  type PermissionScope,
  type SharedDataType,
} from './multiAppAuthStore';

dotenv.config();

const appName = process.env.APP_NAME ?? 'BU Scheduler API';
const corsOrigin = process.env.CORS_ORIGIN ?? '*';
const jwtSecret = process.env.JWT_SECRET ?? 'dev-only-jwt-secret-change-me';
const jwtExpiry = (process.env.JWT_EXPIRY ?? '7d') as SignOptions['expiresIn'];
const allowedOrigins = corsOrigin
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowAllOrigins = allowedOrigins.includes('*');

const app = express();
app.set('trust proxy', 1);
app.use(helmet());
app.use(express.json({ limit: '2mb' }));
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowAllOrigins || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS blocked for origin: ${origin}`));
    },
  }),
);

app.use((req, res, next) => {
  res.setHeader('X-App-Name', appName);
  next();
});

type GroupRecord = {
  id: string;
  courseCode: string;
  level: string;
  name: string;
  description: string;
  visibility: 'private' | 'public';
  memberCount: number;
  nextClass: string;
  createdAt: string;
  updatedAt: string;
};

type EventRecord = {
  id: string;
  groupId: string;
  title: string;
  subjectCode: string;
  description: string;
  startAt: string;
  endAt: string;
  timezone: string;
  location: string;
  recurrence: string | null;
  visibility: 'group' | 'public';
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

type StudentHubAuthRequest = {
  code: string;
  state: string;
  codeChallenge: string;
  nonce: string;
  returnTo: string;
  email: string;
  displayName: string;
  flow: 'login' | 'signup';
  createdAt: string;
  expiresAt: string;
  consumedAt?: string;
};

const studentHubAuthRequests = new Map<string, StudentHubAuthRequest>();

const groups: GroupRecord[] = [
  {
    id: 'grp_100',
    courseCode: 'COS102',
    level: '100',
    name: 'CS 100 Level - Group B',
    description: 'Core programming cohort with weekly tutorial sessions.',
    visibility: 'public',
    memberCount: 48,
    nextClass: '2026-05-26T10:00:00Z',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'grp_210',
    courseCode: 'CSC214',
    level: '200',
    name: 'Software Engineering Cohort',
    description: 'Software project group with rep-managed timetable changes.',
    visibility: 'private',
    memberCount: 62,
    nextClass: '2026-05-27T14:00:00Z',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const events: EventRecord[] = [
  {
    id: 'evt_001',
    groupId: 'grp_100',
    title: 'Problem Solving Tutorial',
    subjectCode: 'COS102',
    description: 'Weekly tutorial session for group B.',
    startAt: '2026-05-26T10:00:00Z',
    endAt: '2026-05-26T11:00:00Z',
    timezone: 'Africa/Lagos',
    location: 'Room 2',
    recurrence: 'RRULE:FREQ=WEEKLY;BYDAY=MO',
    visibility: 'group',
    createdBy: 'user_001',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

function respondError(res: Response, statusCode: number, message: string) {
  res.status(statusCode).json({ success: false, message });
}

function signToken(payload: AuthTokenPayload) {
  return jwt.sign(payload, jwtSecret, { expiresIn: jwtExpiry });
}

function codeChallengeFromVerifier(codeVerifier: string) {
  return createHash('sha256').update(codeVerifier).digest('base64url');
}

function authorizeRequest(req: Request, res: Response) {
  const header = req.headers.authorization;

  if (!header?.startsWith('Bearer ')) {
    respondError(res, 401, 'Missing bearer token');
    return null;
  }

  try {
    const token = header.slice('Bearer '.length);
    const payload = jwt.verify(token, jwtSecret) as AuthTokenPayload;
    const user = multiAppAuthStore.getUser(payload.uid);

    if (!user) {
      respondError(res, 401, 'User not found');
      return null;
    }

    return { payload, user };
  } catch {
    respondError(res, 401, 'Invalid or expired token');
    return null;
  }
}

function parsePermissions(value: unknown): AppPermission[] {
  if (!Array.isArray(value)) {
    return ['profile', 'events', 'schedule'];
  }

  return value.filter((entry): entry is AppPermission =>
    ['profile', 'events', 'schedule', 'transactions', 'notifications', 'wallet'].includes(String(entry)),
  );
}

function parseScope(value: unknown): PermissionScope {
  return value === 'write' || value === 'delete' ? value : 'read';
}

function pickSharedDataType(value: unknown): SharedDataType | null {
  if (typeof value !== 'string' || !multiAppAuthStore.isKnownDataType(value)) {
    return null;
  }

  return value;
}

function buildAuthResponse(userId: string, sourceApp = 'studenthub') {
  const user = multiAppAuthStore.getUser(userId) ?? multiAppAuthStore.ensureUser(userId);
  return {
    success: true,
    token: signToken(multiAppAuthStore.buildTokenPayload(user, sourceApp)),
    user: multiAppAuthStore.serializeUser(user),
    authorizedApps: multiAppAuthStore.toUserAppList(user),
  };
}

function findUserByEmail(email: string) {
  return Array.from(multiAppAuthStore.users.values()).find((user) => user.email.toLowerCase() === email.toLowerCase()) ?? null;
}

function resolveStudentHubUser(email: string, displayName: string) {
  const existing = findUserByEmail(email);

  if (existing) {
    existing.displayName = displayName || existing.displayName;
    return existing;
  }

  return multiAppAuthStore.createUser(email, 'studenthub-oauth', displayName || 'StudentHub User');
}

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    ok: true,
    service: appName,
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/spec', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      identity: 'StudentHub-linked BU Scheduler',
      roles: ['member', 'group_rep', 'course_rep', 'course_manager', 'admin'],
      endpoints: [
        'GET /api/health',
        'GET /api/spec',
        'POST /api/auth/signup',
        'POST /api/auth/login',
        'POST /api/auth/studenthub/authorize',
        'POST /api/auth/studenthub/exchange',
        'POST /api/auth/firebase-to-jwt',
        'POST /api/auth/authorize-app',
        'GET /api/auth/authorized-apps',
        'POST /api/auth/revoke-app',
        'GET /api/auth/verify',
        'GET /api/shared-data/:dataType',
        'POST /api/shared-data/snapshot',
        'GET /api/shared-data/audit-log',
        'POST /api/shared-data/share-token',
        'GET /api/shared-data/access/:token',
        'GET /api/shared-data/permissions',
        'POST /api/shared-data/permissions/grant',
        'POST /api/shared-data/permissions/revoke',
        'GET /api/groups',
        'POST /api/groups',
        'POST /api/groups/:groupId/events',
        'GET /api/groups/:groupId/events',
      ],
    },
  });
});

app.post('/api/auth/signup', (req: Request, res: Response) => {
  const { email, password, displayName } = req.body as Record<string, string | undefined>;

  if (!email || !password || !displayName) {
    respondError(res, 400, 'email, password, and displayName are required');
    return;
  }

  const user = multiAppAuthStore.signup(email, password, displayName);
  if (!user) {
    respondError(res, 409, 'An account with that email already exists');
    return;
  }

  res.status(201).json({
    ...buildAuthResponse(user.uid),
    message: 'Account created successfully',
  });
});

app.post('/api/auth/login', (req: Request, res: Response) => {
  const { email, password } = req.body as Record<string, string | undefined>;

  if (!email || !password) {
    respondError(res, 400, 'email and password are required');
    return;
  }

  const user = multiAppAuthStore.login(email, password);
  if (!user) {
    respondError(res, 401, 'Invalid credentials');
    return;
  }

  res.json(buildAuthResponse(user.uid));
});

app.post('/api/auth/studenthub/authorize', (req: Request, res: Response) => {
  const { state, codeChallenge, nonce, returnTo, email, displayName, flow } = req.body as Record<string, string | undefined>;

  if (!state || !codeChallenge || !nonce || !email || !displayName) {
    respondError(res, 400, 'state, codeChallenge, nonce, email, and displayName are required');
    return;
  }

  const code = `shc_${randomUUID().replace(/-/g, '')}`;
  const nowIso = new Date().toISOString();
  const requestRecord: StudentHubAuthRequest = {
    code,
    state,
    codeChallenge,
    nonce,
    returnTo: returnTo || '/home',
    email,
    displayName,
    flow: flow === 'signup' ? 'signup' : 'login',
    createdAt: nowIso,
    expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
  };

  studentHubAuthRequests.set(code, requestRecord);

  res.status(201).json({
    success: true,
    code,
    state,
    expiresInSeconds: 300,
    returnTo: requestRecord.returnTo,
    flow: requestRecord.flow,
  });
});

app.post('/api/auth/studenthub/exchange', (req: Request, res: Response) => {
  const { code, state, codeVerifier } = req.body as Record<string, string | undefined>;

  if (!code || !state || !codeVerifier) {
    respondError(res, 400, 'code, state, and codeVerifier are required');
    return;
  }

  const requestRecord = studentHubAuthRequests.get(code);
  if (!requestRecord) {
    respondError(res, 404, 'Authorization code not found');
    return;
  }

  if (requestRecord.consumedAt) {
    respondError(res, 409, 'Authorization code has already been used');
    return;
  }

  if (requestRecord.state !== state) {
    respondError(res, 400, 'State mismatch');
    return;
  }

  if (requestRecord.expiresAt && new Date(requestRecord.expiresAt).getTime() < Date.now()) {
    studentHubAuthRequests.delete(code);
    respondError(res, 410, 'Authorization code expired');
    return;
  }

  if (codeChallengeFromVerifier(codeVerifier) !== requestRecord.codeChallenge) {
    respondError(res, 400, 'PKCE verification failed');
    return;
  }

  requestRecord.consumedAt = new Date().toISOString();
  studentHubAuthRequests.delete(code);

  const user = resolveStudentHubUser(requestRecord.email, requestRecord.displayName);
  user.metadata.lastLogin = new Date().toISOString();
  user.metadata.loginCount += 1;

  res.json({
    ...buildAuthResponse(user.uid),
    returnTo: requestRecord.returnTo,
    nonce: requestRecord.nonce,
    state: requestRecord.state,
  });
});

app.post('/api/auth/firebase-to-jwt', (req: Request, res: Response) => {
  const { firebaseIdToken, firebaseUid, email, displayName } = req.body as Record<string, string | undefined>;

  if (!firebaseIdToken && !firebaseUid) {
    respondError(res, 400, 'firebaseIdToken or firebaseUid is required');
    return;
  }

  const uid = firebaseUid ?? firebaseIdToken ?? 'user_001';
  const user = multiAppAuthStore.getUser(uid) ?? multiAppAuthStore.ensureUser(uid);

  if (email) {
    user.email = email;
  }

  if (displayName) {
    user.displayName = displayName;
  }

  res.json({
    ...buildAuthResponse(user.uid),
    firebaseUid: user.uid,
  });
});

app.post('/api/auth/authorize-app', (req: Request, res: Response) => {
  const auth = authorizeRequest(req, res);
  if (!auth) {
    return;
  }

  const { appId, appName: requestedAppName, permissions } = req.body as Record<string, unknown>;
  if (typeof appId !== 'string' || typeof requestedAppName !== 'string') {
    respondError(res, 400, 'appId and appName are required');
    return;
  }

  const appRecord = multiAppAuthStore.registeredApps.get(appId) ?? multiAppAuthStore.registerApp(appId, requestedAppName, `hash:${randomUUID()}`);
  const grantedPermissions = parsePermissions(permissions);
  const appEntry = multiAppAuthStore.authorizeApp(auth.user, appRecord.appId, appRecord.appName, grantedPermissions);

  res.status(201).json({
    success: true,
    message: `${appEntry.appName} has been authorized`,
    app: appEntry,
  });
});

app.get('/api/auth/authorized-apps', (req: Request, res: Response) => {
  const auth = authorizeRequest(req, res);
  if (!auth) {
    return;
  }

  res.json({
    success: true,
    apps: multiAppAuthStore.toUserAppList(auth.user),
    count: auth.user.authorizedApps.length,
  });
});

app.post('/api/auth/revoke-app', (req: Request, res: Response) => {
  const auth = authorizeRequest(req, res);
  if (!auth) {
    return;
  }

  const { appId } = req.body as Record<string, string | undefined>;
  if (!appId) {
    respondError(res, 400, 'appId is required');
    return;
  }

  multiAppAuthStore.revokeAppAccess(auth.user, appId);
  res.json({ success: true, message: 'App access has been revoked' });
});

app.get('/api/auth/verify', (req: Request, res: Response) => {
  const auth = authorizeRequest(req, res);
  if (!auth) {
    return;
  }

  res.json({
    success: true,
    valid: true,
    user: {
      ...multiAppAuthStore.serializeUser(auth.user),
      authorizedApps: auth.user.authorizedApps,
    },
  });
});

app.get('/api/shared-data/:dataType', (req: Request, res: Response) => {
  const auth = authorizeRequest(req, res);
  if (!auth) {
    return;
  }

  const dataType = pickSharedDataType(req.params.dataType);
  const appId = typeof req.query.appId === 'string' ? req.query.appId : auth.payload.sourceApp;

  if (!dataType) {
    respondError(res, 400, 'Unsupported data type');
    return;
  }

  if (!multiAppAuthStore.isRecognizedApp(appId)) {
    respondError(res, 403, 'App is not registered');
    return;
  }

  if (!multiAppAuthStore.userHasPermission(auth.user, appId, dataType)) {
    respondError(res, 403, 'App is not authorized for that data type');
    return;
  }

  const data = multiAppAuthStore.buildAccessResponse(auth.user, dataType, appId);
  res.json({
    success: true,
    dataType,
    data,
    accessedAt: new Date().toISOString(),
    count: Array.isArray(data) ? data.length : 1,
  });
});

app.post('/api/shared-data/snapshot', (req: Request, res: Response) => {
  const auth = authorizeRequest(req, res);
  if (!auth) {
    return;
  }

  const { dataTypes, appId } = req.body as { dataTypes?: string[]; appId?: string };
  const targetApp = typeof appId === 'string' ? appId : auth.payload.sourceApp;
  const selected = Array.isArray(dataTypes) ? dataTypes.map((entry) => pickSharedDataType(entry)).filter((entry): entry is SharedDataType => Boolean(entry)) : [];

  if (selected.length === 0) {
    respondError(res, 400, 'dataTypes must contain at least one supported data type');
    return;
  }

  const snapshot = multiAppAuthStore.createSnapshot(auth.user, targetApp, selected);
  res.status(201).json({
    success: true,
    snapshot,
  });
});

app.get('/api/shared-data/audit-log', (req: Request, res: Response) => {
  const auth = authorizeRequest(req, res);
  if (!auth) {
    return;
  }

  const appId = typeof req.query.appId === 'string' ? req.query.appId : undefined;
  const limit = typeof req.query.limit === 'string' ? Number.parseInt(req.query.limit, 10) : 50;
  const logs = multiAppAuthStore.listLogs(auth.user, appId, Number.isFinite(limit) ? limit : 50);

  res.json({
    success: true,
    logs,
    count: logs.length,
  });
});

app.post('/api/shared-data/share-token', (req: Request, res: Response) => {
  const auth = authorizeRequest(req, res);
  if (!auth) {
    return;
  }

  const dataType = pickSharedDataType(req.body?.dataType);
  const expiresInHours = typeof req.body?.expiresInHours === 'number' ? req.body.expiresInHours : 24;

  if (!dataType) {
    respondError(res, 400, 'dataType is required');
    return;
  }

  const record = multiAppAuthStore.createShareToken(auth.user, dataType, expiresInHours);
  res.status(201).json({
    success: true,
    token: record.token,
    expiresAt: record.expiresAt,
    shareUrl: `${process.env.FRONTEND_URL ?? 'http://localhost:5173'}/shared/${record.token}?type=${dataType}`,
  });
});

app.get('/api/shared-data/access/:token', (req: Request, res: Response) => {
  const shareToken = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;
  const dataType = pickSharedDataType(typeof req.query.type === 'string' ? req.query.type : shareToken);

  if (!dataType) {
    respondError(res, 400, 'type is required');
    return;
  }

  const result = multiAppAuthStore.accessShareToken(shareToken, dataType);
  if (!result) {
    respondError(res, 404, 'Shared data token is invalid or expired');
    return;
  }

  res.json({
    success: true,
    dataType,
    data: result.data,
    accessedAt: new Date().toISOString(),
  });
});

app.get('/api/shared-data/permissions', (req: Request, res: Response) => {
  const auth = authorizeRequest(req, res);
  if (!auth) {
    return;
  }

  const permissions = multiAppAuthStore.listPermissions(auth.user);
  const groupedByApp = permissions.reduce<Record<string, typeof permissions>>((accumulator, permission) => {
    accumulator[permission.appId] = accumulator[permission.appId] ?? [];
    accumulator[permission.appId].push(permission);
    return accumulator;
  }, {});

  res.json({
    success: true,
    permissions,
    groupedByApp,
    totalPermissions: permissions.length,
  });
});

app.post('/api/shared-data/permissions/grant', (req: Request, res: Response) => {
  const auth = authorizeRequest(req, res);
  if (!auth) {
    return;
  }

  const { appId, dataType, scope } = req.body as Record<string, string | undefined>;
  if (!appId || !dataType || !multiAppAuthStore.isKnownDataType(dataType)) {
    respondError(res, 400, 'appId and dataType are required');
    return;
  }

  const appRecord = multiAppAuthStore.registeredApps.get(appId) ?? multiAppAuthStore.registerApp(appId, appId, `hash:${randomUUID()}`);
  const granted = multiAppAuthStore.authorizeApp(auth.user, appRecord.appId, appRecord.appName, [dataType as AppPermission]);
  const permission = multiAppAuthStore.dataPermissions.find(
    (entry) => entry.firebaseUid === auth.user.uid && entry.appId === appId && entry.dataType === dataType,
  );

  if (permission) {
    permission.scope = parseScope(scope);
  }

  res.status(201).json({
    success: true,
    permission,
    message: `Permission granted for ${dataType}`,
    app: granted,
  });
});

app.post('/api/shared-data/permissions/revoke', (req: Request, res: Response) => {
  const auth = authorizeRequest(req, res);
  if (!auth) {
    return;
  }

  const { appId, dataType } = req.body as Record<string, string | undefined>;
  if (!appId || !dataType) {
    respondError(res, 400, 'appId and dataType are required');
    return;
  }

  const index = multiAppAuthStore.dataPermissions.findIndex(
    (entry) => entry.firebaseUid === auth.user.uid && entry.appId === appId && entry.dataType === dataType,
  );

  if (index >= 0) {
    multiAppAuthStore.dataPermissions.splice(index, 1);
  }

  res.json({ success: true, message: 'Permission revoked' });
});

app.post('/api/auth/link', (req: Request, res: Response) => {
  const { studenthubId, email, name } = req.body as Record<string, string | undefined>;

  if (!studenthubId || !email) {
    respondError(res, 400, 'studenthubId and email are required');
    return;
  }

  res.status(201).json({
    success: true,
    data: {
      studenthubId,
      email,
      name: name ?? null,
      sessionStatus: 'linked',
    },
  });
});

app.get('/api/groups', (_req: Request, res: Response) => {
  res.json({ success: true, data: groups });
});

app.post('/api/groups', (req: Request, res: Response) => {
  const { courseCode, level, name, description, visibility } = req.body as Record<string, string | undefined>;

  if (!courseCode || !level || !name) {
    respondError(res, 400, 'courseCode, level, and name are required');
    return;
  }

  const now = new Date().toISOString();
  const group: GroupRecord = {
    id: `grp_${randomUUID().slice(0, 8)}`,
    courseCode,
    level,
    name,
    description: description ?? '',
    visibility: visibility === 'private' ? 'private' : 'public',
    memberCount: 1,
    nextClass: now,
    createdAt: now,
    updatedAt: now,
  };

  groups.unshift(group);
  res.status(201).json({ success: true, data: group });
});

app.get('/api/groups/:groupId', (req: Request, res: Response) => {
  const group = groups.find((entry) => entry.id === req.params.groupId);

  if (!group) {
    respondError(res, 404, 'Group not found');
    return;
  }

  res.json({
    success: true,
    data: {
      ...group,
      events: events.filter((event) => event.groupId === group.id),
    },
  });
});

app.patch('/api/groups/:groupId', (req: Request, res: Response) => {
  const group = groups.find((entry) => entry.id === req.params.groupId);

  if (!group) {
    respondError(res, 404, 'Group not found');
    return;
  }

  const body = req.body as Record<string, string | undefined>;
  group.courseCode = body.courseCode ?? group.courseCode;
  group.level = body.level ?? group.level;
  group.name = body.name ?? group.name;
  group.description = body.description ?? group.description;
  group.visibility = body.visibility === 'private' ? 'private' : body.visibility === 'public' ? 'public' : group.visibility;
  group.updatedAt = new Date().toISOString();

  res.json({ success: true, data: group });
});

app.delete('/api/groups/:groupId', (req: Request, res: Response) => {
  const index = groups.findIndex((entry) => entry.id === req.params.groupId);

  if (index < 0) {
    respondError(res, 404, 'Group not found');
    return;
  }

  const [deleted] = groups.splice(index, 1);
  res.json({ success: true, data: deleted });
});

app.get('/api/groups/:groupId/events', (req: Request, res: Response) => {
  const group = groups.find((entry) => entry.id === req.params.groupId);

  if (!group) {
    respondError(res, 404, 'Group not found');
    return;
  }

  const groupEvents = events.filter((event) => event.groupId === group.id);
  res.json({ success: true, data: groupEvents });
});

app.post('/api/groups/:groupId/events', (req: Request, res: Response) => {
  const group = groups.find((entry) => entry.id === req.params.groupId);

  if (!group) {
    respondError(res, 404, 'Group not found');
    return;
  }

  const body = req.body as Record<string, string | undefined>;
  const { title, subjectCode, startAt, endAt, timezone, location } = body;

  if (!title || !subjectCode || !startAt || !endAt || !timezone || !location) {
    respondError(res, 400, 'title, subjectCode, startAt, endAt, timezone, and location are required');
    return;
  }

  const startDate = new Date(startAt);
  const endDate = new Date(endAt);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || startDate >= endDate) {
    respondError(res, 400, 'startAt must be before endAt and both must be valid ISO timestamps');
    return;
  }

  const now = new Date().toISOString();
  const event: EventRecord = {
    id: `evt_${randomUUID().slice(0, 8)}`,
    groupId: group.id,
    title,
    subjectCode,
    description: body.description ?? '',
    startAt,
    endAt,
    timezone,
    location,
    recurrence: body.recurrence ?? null,
    visibility: body.visibility === 'public' ? 'public' : 'group',
    createdBy: body.createdBy ?? 'system',
    createdAt: now,
    updatedAt: now,
  };

  events.unshift(event);
  group.nextClass = startAt;
  group.updatedAt = now;

  res.status(201).json({ success: true, data: event });
});

app.get('/api/metrics', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      groups: groups.length,
      events: events.length,
      remindersQueued: 0,
      activeWorkers: 1,
    },
  });
});

app.use((_req: Request, res: Response) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
  res.status(500).json({ success: false, message: error.message || 'Internal server error' });
});

export default app;