import { randomUUID } from 'node:crypto';

export type AppPermission = 'profile' | 'events' | 'schedule' | 'transactions' | 'notifications' | 'wallet';
export type PermissionScope = 'read' | 'write' | 'delete';

export type UserAppAuthorization = {
  appId: string;
  appName: string;
  authorizedAt: string;
  permissions: AppPermission[];
};

export type UserRecord = {
  uid: string;
  email: string;
  password: string;
  displayName: string;
  phone?: string;
  photoURL?: string;
  matNumber?: string;
  department?: string;
  level?: number;
  authorizedApps: UserAppAuthorization[];
  permissions: Record<AppPermission, PermissionScope>;
  metadata: {
    lastLogin: string;
    loginCount: number;
    preferences: {
      theme: 'light' | 'dark';
      notifications: boolean;
    };
  };
};

export type RegisteredApp = {
  appId: string;
  appName: string;
  apiKeyHash: string;
  createdAt: string;
  isActive: boolean;
};

export type DataPermission = {
  id: string;
  firebaseUid: string;
  appId: string;
  dataType: AppPermission;
  grantedAt: string;
  expiresAt?: string;
  scope: PermissionScope;
  restrictions: {
    fields?: string[];
    excludeFields?: string[];
  };
};

export type DataAccessLog = {
  id: string;
  firebaseUid: string;
  appId: string;
  dataType: AppPermission;
  action: 'read' | 'write' | 'delete';
  accessedAt: string;
  ipAddress?: string;
  userAgent?: string;
  endpoint?: string;
  statusCode?: number;
};

export type DataSnapshot = {
  snapshotId: string;
  firebaseUid: string;
  appId: string;
  dataTypes: AppPermission[];
  data: Record<string, unknown>;
  status: 'processing' | 'completed';
  size: number;
  createdAt: string;
  completedAt?: string;
};

export type ShareTokenRecord = {
  token: string;
  firebaseUid: string;
  dataType: AppPermission;
  createdAt: string;
  expiresAt: string;
  accessCount: number;
  maxAccess: number;
};

export type SharedDataType = AppPermission;

export type SharedDataPayload = {
  profile: Record<string, unknown>;
  events: Array<Record<string, unknown>>;
  schedule: Array<Record<string, unknown>>;
  transactions: Array<Record<string, unknown>>;
  notifications: Array<Record<string, unknown>>;
  wallet: Record<string, unknown>;
};

export type AuthTokenPayload = {
  uid: string;
  email: string;
  displayName: string;
  sourceApp: string;
  authorizedApps: UserAppAuthorization[];
};

const now = () => new Date().toISOString();
const token = (prefix: string) => `${prefix}_${randomUUID().replace(/-/g, '').slice(0, 24)}`;

const demoSharedData: Record<string, SharedDataPayload> = {
  user_001: {
    profile: {
      uid: 'user_001',
      email: 'student@university.edu',
      displayName: 'John Doe',
      matNumber: '2023/12345',
      department: 'Computer Science',
      level: 200,
      photoURL: 'https://example.com/avatar.jpg',
    },
    events: [
      {
        id: 'evt_001',
        title: 'Algorithms Exam',
        startTime: '2026-06-15T10:00:00Z',
        endTime: '2026-06-15T12:00:00Z',
        location: 'Lecture Hall A',
        status: 'confirmed',
      },
    ],
    schedule: [
      {
        id: 'sch_001',
        courseCode: 'CSC301',
        courseName: 'Algorithms',
        dayOfWeek: 1,
        startTime: '10:00',
        endTime: '11:30',
        location: 'Lab B206',
      },
    ],
    transactions: [
      {
        id: 'txn_001',
        type: 'purchase',
        amount: 50000,
        description: 'Books purchase',
        status: 'completed',
        createdAt: '2026-05-26T14:45:00Z',
      },
    ],
    notifications: [
      {
        id: 'ntf_001',
        title: 'Exam reminder',
        body: 'Algorithms Exam is tomorrow at 10:00 AM.',
        read: false,
        priority: 'high',
      },
    ],
    wallet: {
      balance: 125000,
      currency: 'NGN',
    },
  },
};

const users = new Map<string, UserRecord>([
  [
    'user_001',
    {
      uid: 'user_001',
      email: 'student@university.edu',
      password: 'password123',
      displayName: 'John Doe',
      phone: '+2348012345678',
      matNumber: '2023/12345',
      department: 'Computer Science',
      level: 200,
      authorizedApps: [],
      permissions: {
        profile: 'read',
        events: 'read',
        schedule: 'read',
        transactions: 'read',
        notifications: 'read',
        wallet: 'read',
      },
      metadata: {
        lastLogin: now(),
        loginCount: 127,
        preferences: {
          theme: 'dark',
          notifications: true,
        },
      },
    },
  ],
]);

const registeredApps = new Map<string, RegisteredApp>([
  [
    'studenthub',
    {
      appId: 'studenthub',
      appName: 'StudentHub',
      apiKeyHash: 'demo-hash-studenthub',
      createdAt: now(),
      isActive: true,
    },
  ],
  [
    'storehub',
    {
      appId: 'storehub',
      appName: 'StoreHub',
      apiKeyHash: 'demo-hash-storehub',
      createdAt: now(),
      isActive: true,
    },
  ],
  [
    'timetable',
    {
      appId: 'timetable',
      appName: 'Timetable Generator',
      apiKeyHash: 'demo-hash-timetable',
      createdAt: now(),
      isActive: true,
    },
  ],
]);

const dataPermissions: DataPermission[] = [];
const accessLogs: DataAccessLog[] = [];
const dataSnapshots: DataSnapshot[] = [];
const shareTokens = new Map<string, ShareTokenRecord>();

function ensureUser(uid: string) {
  const existing = users.get(uid);
  if (existing) {
    return existing;
  }

  const created: UserRecord = {
    uid,
    email: `${uid}@studenthub.local`,
    password: 'password123',
    displayName: 'Student User',
    authorizedApps: [],
    permissions: {
      profile: 'read',
      events: 'read',
      schedule: 'read',
      transactions: 'read',
      notifications: 'read',
      wallet: 'read',
    },
    metadata: {
      lastLogin: now(),
      loginCount: 1,
      preferences: {
        theme: 'light',
        notifications: true,
      },
    },
  };

  users.set(uid, created);
  return created;
}

function isKnownDataType(value: string): value is SharedDataType {
  return ['profile', 'events', 'schedule', 'transactions', 'notifications', 'wallet'].includes(value);
}

function buildTokenPayload(user: UserRecord, sourceApp: string): AuthTokenPayload {
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    sourceApp,
    authorizedApps: user.authorizedApps,
  };
}

function grantAppAccess(user: UserRecord, appId: string, appName: string, permissions: AppPermission[]) {
  const grantedAt = now();
  const existing = user.authorizedApps.find((entry) => entry.appId === appId);

  if (existing) {
    existing.appName = appName;
    existing.authorizedAt = grantedAt;
    existing.permissions = permissions;
  } else {
    user.authorizedApps.push({ appId, appName, authorizedAt: grantedAt, permissions });
  }

  permissions.forEach((dataType) => {
    const found = dataPermissions.find(
      (permission) => permission.firebaseUid === user.uid && permission.appId === appId && permission.dataType === dataType,
    );

    if (found) {
      found.scope = 'read';
      found.grantedAt = grantedAt;
      found.expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
      return;
    }

    dataPermissions.push({
      id: token('perm'),
      firebaseUid: user.uid,
      appId,
      dataType,
      grantedAt,
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      scope: 'read',
      restrictions: {
        fields: dataType === 'profile' ? ['email', 'displayName', 'matNumber', 'department', 'level'] : undefined,
        excludeFields: ['password'],
      },
    });
  });

  return user.authorizedApps.find((entry) => entry.appId === appId) as UserAppAuthorization;
}

function revokeAppAccess(user: UserRecord, appId: string) {
  user.authorizedApps = user.authorizedApps.filter((entry) => entry.appId !== appId);
  for (let index = dataPermissions.length - 1; index >= 0; index -= 1) {
    if (dataPermissions[index].firebaseUid === user.uid && dataPermissions[index].appId === appId) {
      dataPermissions.splice(index, 1);
    }
  }
}

function userHasPermission(user: UserRecord, appId: string, dataType: SharedDataType) {
  if (!user.authorizedApps.some((entry) => entry.appId === appId)) {
    return false;
  }

  const permission = dataPermissions.find(
    (entry) => entry.firebaseUid === user.uid && entry.appId === appId && entry.dataType === dataType,
  );

  if (!permission) {
    return true;
  }

  if (permission.expiresAt && new Date(permission.expiresAt).getTime() < Date.now()) {
    return false;
  }

  return permission.scope === 'read';
}

function getSharedData(user: UserRecord, dataType: SharedDataType) {
  const payload = demoSharedData[user.uid] ?? demoSharedData.user_001;
  return payload[dataType];
}

function logAccess(entry: Omit<DataAccessLog, 'id' | 'accessedAt'> & { accessedAt?: string }) {
  accessLogs.unshift({
    id: token('log'),
    accessedAt: entry.accessedAt ?? now(),
    ...entry,
  });
}

export const multiAppAuthStore = {
  users,
  registeredApps,
  dataPermissions,
  accessLogs,
  dataSnapshots,
  shareTokens,
  ensureUser,
  isKnownDataType,
  buildTokenPayload,
  grantAppAccess,
  revokeAppAccess,
  userHasPermission,
  getSharedData,
  logAccess,
  createUser(email: string, password: string, displayName: string) {
    const uid = token('uid');
    const user: UserRecord = {
      uid,
      email,
      password,
      displayName,
      authorizedApps: [],
      permissions: {
        profile: 'read',
        events: 'read',
        schedule: 'read',
        transactions: 'read',
        notifications: 'read',
        wallet: 'read',
      },
      metadata: {
        lastLogin: now(),
        loginCount: 1,
        preferences: {
          theme: 'light',
          notifications: true,
        },
      },
    };

    users.set(uid, user);
    return user;
  },
  createSnapshot(user: UserRecord, appId: string, dataTypes: SharedDataType[]) {
    const data = dataTypes.reduce<Record<string, unknown>>((accumulator, dataType) => {
      accumulator[dataType] = getSharedData(user, dataType);
      return accumulator;
    }, {});

    const serialized = JSON.stringify(data);
    const snapshot: DataSnapshot = {
      snapshotId: token('snap'),
      firebaseUid: user.uid,
      appId,
      dataTypes,
      data,
      status: 'completed',
      size: Buffer.byteLength(serialized),
      createdAt: now(),
      completedAt: now(),
    };

    dataSnapshots.unshift(snapshot);
    return snapshot;
  },
  createShareToken(user: UserRecord, dataType: SharedDataType, expiresInHours: number) {
    const shareToken = token('share');
    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + expiresInHours * 60 * 60 * 1000);
    const record: ShareTokenRecord = {
      token: shareToken,
      firebaseUid: user.uid,
      dataType,
      createdAt: createdAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      accessCount: 0,
      maxAccess: 25,
    };

    shareTokens.set(shareToken, record);
    return record;
  },
  accessShareToken(shareToken: string, dataType: string) {
    const record = shareTokens.get(shareToken);
    if (!record || record.dataType !== dataType) {
      return null;
    }

    if (new Date(record.expiresAt).getTime() < Date.now()) {
      return null;
    }

    if (record.accessCount >= record.maxAccess) {
      return null;
    }

    record.accessCount += 1;
    const user = ensureUser(record.firebaseUid);
    return {
      record,
      data: getSharedData(user, record.dataType),
    };
  },
  toUserAppList(user: UserRecord) {
    return user.authorizedApps;
  },
  listPermissions(user: UserRecord) {
    return dataPermissions.filter((permission) => permission.firebaseUid === user.uid);
  },
  listLogs(user: UserRecord, appId?: string, limit = 50) {
    return accessLogs.filter((log) => log.firebaseUid === user.uid && (!appId || log.appId === appId)).slice(0, limit);
  },
  listRegisteredApps() {
    return Array.from(registeredApps.values());
  },
  registerApp(appId: string, appName: string, apiKeyHash: string) {
    const entry: RegisteredApp = {
      appId,
      appName,
      apiKeyHash,
      createdAt: now(),
      isActive: true,
    };
    registeredApps.set(appId, entry);
    return entry;
  },
  authorizeApp(user: UserRecord, appId: string, appName: string, permissions: AppPermission[]) {
    return grantAppAccess(user, appId, appName, permissions);
  },
  getUser(uid: string) {
    return users.get(uid) ?? null;
  },
  login(email: string, password: string) {
    const found = Array.from(users.values()).find((user) => user.email === email && user.password === password);
    if (!found) {
      return null;
    }

    found.metadata.lastLogin = now();
    found.metadata.loginCount += 1;
    return found;
  },
  signup(email: string, password: string, displayName: string) {
    const existing = Array.from(users.values()).find((user) => user.email === email);
    if (existing) {
      return null;
    }

    return this.createUser(email, password, displayName);
  },
  serializeUser(user: UserRecord) {
    const { password, ...safeUser } = user;
    return safeUser;
  },
  validateSourceApp(appId?: string) {
    if (!appId) {
      return null;
    }

    return registeredApps.get(appId) ?? null;
  },
  isRecognizedApp(appId: string) {
    return registeredApps.has(appId);
  },
  buildAccessResponse(user: UserRecord, dataType: SharedDataType, appId: string) {
    const data = getSharedData(user, dataType);
    logAccess({
      firebaseUid: user.uid,
      appId,
      dataType,
      action: 'read',
      endpoint: `GET /api/shared-data/${dataType}`,
      statusCode: 200,
    });

    return data;
  },
};
