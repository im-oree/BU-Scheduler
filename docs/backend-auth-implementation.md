# BU Scheduler Backend Authentication Implementation

## Overview

The BU Scheduler backend now implements a complete StudentHub-linked authentication system that enables:
1. **Canonical user identity** - Same StudentHub account across multiple apps without duplication
2. **PKCE-based OAuth2 flow** - Secure code exchange for token generation
3. **Token revocation** - Logout and session management
4. **Audit logging** - Track all authentication and authorization events
5. **Multi-app authorization** - Fine-grained app-level permission grants

## Architecture

### Data Model

#### UserRecord
```typescript
{
  uid: string;                    // Internal unique identifier
  email: string;
  password: string;               // For local auth (hashed in production)
  displayName: string;
  phone?: string;
  photoURL?: string;
  matNumber?: string;
  department?: string;
  level?: number;
  
  // StudentHub identity linking
  studenthubId?: string;          // Canonical StudentHub ID
  identityProvider?: 'local' | 'studenthub';
  linkedAt?: string;              // When StudentHub was linked
  authVersion: number;            // For future auth schema updates
  
  // Authorization
  authorizedApps: UserAppAuthorization[];
  permissions: Record<AppPermission, PermissionScope>;
  
  // Metadata
  metadata: {
    lastLogin: string;
    loginCount: number;
    preferences: {
      theme: 'light' | 'dark';
      notifications: boolean;
    };
  };
}
```

#### AuthTokenPayload
```typescript
{
  uid: string;                    // User ID
  email: string;
  displayName: string;
  sourceApp: string;              // Originating app ID
  authorizedApps: UserAppAuthorization[];
  jti: string;                    // JWT ID for revocation tracking
  iat: number;                    // Issued at timestamp
  // exp and iat added by jwt.sign with expiresIn
}
```

#### AuditLog
```typescript
{
  id: string;
  userId: string;
  action: AuditLogType;
  details: Record<string, unknown>;
  appId?: string;
  timestamp: string;
  ipAddress?: string;
  userAgent?: string;
  status: 'success' | 'failure';
}
```

Audit log action types:
- `account_created` - New local account created
- `account_linked` - StudentHub identity linked to existing account
- `studenthub_login` - Login via StudentHub
- `local_login` - Login via email/password
- `logout` - User logout
- `token_issued` - JWT token generated
- `token_refreshed` - JWT token refreshed
- `token_revoked` - JWT token revoked
- `app_authorized` - App granted permissions
- `app_revoked` - App access revoked
- `data_accessed` - Shared data read by app
- `identity_unlinked` - StudentHub identity unlinked

### Key Internal Maps

1. **studenthubIdMap**: `Map<string, string>` - Maps StudentHub IDs to internal user IDs (ensures canonical identity)
2. **revokedTokens**: `Set<string>` - Tracks revoked JWT IDs
3. **auditLogs**: `AuditLog[]` - Chronological audit trail

## Authentication Flows

### 1. StudentHub OAuth2 Flow (PKCE)

```
Frontend                    Backend                 StudentHub
   |                          |                        |
   |--- POST /authorize ------>|                        |
   |<-- code, state, nonce ----|                        |
   |                          |                        |
   |--- POST /exchange ------->|                        |
   |    (code, codeVerifier)   |                        |
   |<-- JWT, user, apps -------|                        |
   |                          |                        |
```

**Endpoints:**
- `POST /api/auth/studenthub/authorize` - Initiate PKCE flow
- `POST /api/auth/studenthub/exchange` - Exchange code for JWT

**Flow Details:**
1. Frontend creates PKCE code challenge locally
2. Frontend calls `/authorize` with state, challenge, nonce, email, displayName, flow
3. Backend stores auth request and returns code (valid for 5 minutes)
4. Frontend calls `/exchange` with code, state, codeVerifier
5. Backend validates PKCE and resolves user:
   - If `studenthubId` provided, lookup by StudentHub ID (canonical)
   - If not found, lookup by email (linking)
   - If not found, create new account
6. Backend returns JWT token, user profile, authorized apps

**Key Security Features:**
- PKCE prevents authorization code interception
- State parameter prevents CSRF
- Nonce for additional validation
- 5-minute code expiration
- Single-use codes (marked consumed)

### 2. Local Email/Password Flow

```
Frontend                    Backend
   |                          |
   |--- POST /login ---------->|
   |    (email, password)      |
   |<--- JWT, user, apps ------|
   |                          |
```

**Endpoint:**
- `POST /api/auth/login` - Local login
- `POST /api/auth/signup` - Local signup

### 3. Logout and Session Revocation

```
Frontend                    Backend
   |                          |
   |--- POST /logout ---------->|
   |    (Authorization header) |
   |<---- success -------------|
   |                          |
```

**Endpoint:**
- `POST /api/auth/logout` - Revoke the current token

**Behavior:**
1. Extract JWT from Authorization header
2. Add JWT ID (jti) to revoked tokens set
3. Log logout event
4. Return success

## API Endpoints

### Authentication Endpoints

#### POST /api/auth/signup
Create a local account.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "secure-password",
  "displayName": "John Doe"
}
```

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGc...",
  "user": {
    "uid": "uid_abc123",
    "email": "user@example.com",
    "displayName": "John Doe",
    "authorizedApps": []
  },
  "authorizedApps": [],
  "message": "Account created successfully"
}
```

**Status Codes:**
- 201 Created
- 409 Conflict (email already exists)

#### POST /api/auth/login
Login with email and password.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "secure-password"
}
```

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGc...",
  "user": { ... },
  "authorizedApps": []
}
```

**Status Codes:**
- 200 OK
- 401 Unauthorized (invalid credentials)

#### POST /api/auth/studenthub/authorize
Initiate StudentHub OAuth2 PKCE flow.

**Request:**
```json
{
  "state": "base64url_random_24_bytes",
  "codeChallenge": "base64url_sha256_hash",
  "nonce": "base64url_random_24_bytes",
  "returnTo": "/home",
  "email": "user@studenthub.edu",
  "displayName": "Jane Student",
  "flow": "login"
}
```

**Response:**
```json
{
  "success": true,
  "code": "shc_abc123...",
  "state": "base64url_...",
  "expiresInSeconds": 300,
  "returnTo": "/home",
  "flow": "login"
}
```

**Status Codes:**
- 201 Created
- 400 Bad Request (missing fields)

#### POST /api/auth/studenthub/exchange
Exchange authorization code for JWT token.

**Request:**
```json
{
  "code": "shc_abc123...",
  "state": "base64url_...",
  "codeVerifier": "base64url_48_bytes",
  "studenthubId": "studenthub_uid_optional"
}
```

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGc...",
  "user": { ... },
  "authorizedApps": [],
  "returnTo": "/home",
  "nonce": "base64url_...",
  "state": "base64url_...",
  "isNewAccount": false
}
```

**Status Codes:**
- 200 OK
- 400 Bad Request (PKCE failed, state mismatch)
- 404 Not Found (code not found)
- 409 Conflict (code already used)
- 410 Gone (code expired)

#### GET /api/auth/verify
Verify current JWT token validity.

**Request:**
```
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "success": true,
  "valid": true,
  "user": {
    "uid": "uid_...",
    "email": "...",
    "displayName": "...",
    "authorizedApps": [...]
  }
}
```

**Status Codes:**
- 200 OK
- 401 Unauthorized (invalid/expired token)

#### POST /api/auth/logout
Revoke the current JWT token.

**Request:**
```
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

**Status Codes:**
- 200 OK
- 401 Unauthorized (invalid token)

#### GET /api/auth/audit-log
Retrieve user's authentication audit log.

**Request:**
```
Authorization: Bearer <jwt_token>
?limit=50
```

**Response:**
```json
{
  "success": true,
  "logs": [
    {
      "id": "audit_...",
      "userId": "uid_...",
      "action": "studenthub_login",
      "details": {
        "email": "user@studenthub.edu",
        "studenthubId": "studenthub_uid_..."
      },
      "appId": "studenthub",
      "timestamp": "2026-05-26T10:30:00Z",
      "status": "success"
    },
    ...
  ],
  "count": 50
}
```

**Status Codes:**
- 200 OK
- 401 Unauthorized (invalid token)

### App Authorization Endpoints

#### POST /api/auth/authorize-app
Grant an app permission to access user data.

**Request:**
```json
{
  "appId": "storehub",
  "appName": "StoreHub",
  "permissions": ["profile", "events", "schedule"]
}
```

**Response:**
```json
{
  "success": true,
  "message": "StoreHub has been authorized",
  "app": {
    "appId": "storehub",
    "appName": "StoreHub",
    "authorizedAt": "2026-05-26T10:30:00Z",
    "permissions": ["profile", "events", "schedule"]
  }
}
```

**Status Codes:**
- 201 Created
- 400 Bad Request (missing appId/appName)
- 401 Unauthorized (invalid token)

#### GET /api/auth/authorized-apps
List apps authorized to access user data.

**Request:**
```
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "success": true,
  "apps": [
    {
      "appId": "storehub",
      "appName": "StoreHub",
      "authorizedAt": "2026-05-26T10:30:00Z",
      "permissions": ["profile", "events"]
    },
    ...
  ],
  "count": 2
}
```

**Status Codes:**
- 200 OK
- 401 Unauthorized (invalid token)

#### POST /api/auth/revoke-app
Revoke an app's access to user data.

**Request:**
```json
{
  "appId": "storehub"
}
```

**Response:**
```json
{
  "success": true,
  "message": "App access has been revoked"
}
```

**Status Codes:**
- 200 OK
- 400 Bad Request (missing appId)
- 401 Unauthorized (invalid token)

## Identity Linking Strategy

### Canonical Identity Resolution

When a user logs in via StudentHub, the backend resolves their canonical identity using this priority:

1. **StudentHub ID (highest priority)** - If `studenthubId` is provided:
   - Lookup in `studenthubIdMap`
   - Return existing user (update profile)
   - Ensures same StudentHub account always maps to same local user

2. **Email (fallback)** - If no StudentHub ID match:
   - Lookup by email
   - Link StudentHub ID if not already linked
   - Log `account_linked` event

3. **Create new** (no match) - If neither works:
   - Create new local user
   - Link StudentHub ID
   - Log `account_created` event

### Why This Prevents Duplicates

- StudentHub ID is the single source of truth
- Email-only lookup only happens if ID not provided (first time linking)
- Once linked, same StudentHub ID always resolves to same user
- Map is maintained in memory and could be persisted to database

Example:
```
StudentHub ID → Local User
─────────────────────────
shub_xyz12345 → uid_local_001
shub_xyz12346 → uid_local_002
```

## Security Considerations

### Current Implementation (In-Memory)

**For Development/Testing:**
- Works fine with re-auth on restart
- Identity mapping maintained in memory

**For Production:**

The following should be implemented:
1. **Persistent Storage** - Use database (PostgreSQL, MongoDB) for:
   - User records
   - StudentHub ID mappings
   - Audit logs
   - Token revocation list

2. **Production Security Hardening:**
   - Hash passwords with bcrypt/argon2
   - Store JWT secret in vault (HashiCorp Vault, AWS Secrets Manager)
   - Implement rate limiting on auth endpoints
   - Add HTTPS/TLS enforcement
   - Set secure cookie flags
   - Implement CORS allowlist
   - Add request signing for inter-app communication
   - Expire revoked tokens from memory periodically

3. **Token Management:**
   - Implement refresh token flow with sliding expiration
   - Store refresh tokens in secure HTTP-only cookies
   - Add JTI blacklist with TTL to reduce memory
   - Implement token rotation

4. **Audit & Compliance:**
   - Persist audit logs to database
   - Add IP address and user agent capture
   - Implement log retention policies
   - Add alerting for suspicious patterns

## Integration with Frontend

### Frontend Auth Flow

The frontend (in `/src/lib/auth.ts`) implements:

1. **PKCE Client** - Generates code verifier/challenge locally
2. **Session Storage** - Stores pending PKCE requests in sessionStorage
3. **Token Storage** - Stores JWT in localStorage
4. **Token Verification** - Calls `/verify` on app load to validate session

### Frontend Environment Variables

```bash
VITE_API_BASE_URL=http://localhost:4000
```

### Frontend Auth Context

The frontend should:
1. Load stored session on app start
2. Verify token with backend
3. Set Authorization header on all requests: `Authorization: Bearer <token>`
4. Handle 401 responses by clearing session and redirecting to login
5. Call `/logout` before clearing session

## Migration Path (For Multiple Apps)

### First App (BU Scheduler)

1. User logs in with StudentHub
2. Backend creates canonical account linked to StudentHub ID
3. User grants permissions to BU Scheduler app

### Second App (e.g., StoreHub)

1. User logs in with same StudentHub account
2. Backend finds existing account by StudentHub ID (no duplicate!)
3. User can grant additional permissions
4. User can share data across apps

### Benefits

- No data duplication
- Consistent user identity
- Unified audit trail
- Cross-app data sharing

## Testing

### Test Scenarios

1. **First-time StudentHub login**
   - POST /authorize → receive code
   - POST /exchange → create user, return token

2. **Returning StudentHub user**
   - POST /authorize → receive code
   - POST /exchange → find existing user, return token

3. **Email-based linking**
   - Create local account (signup)
   - Login with StudentHub using same email
   - Account should link (not duplicate)

4. **Token revocation**
   - Login → receive token
   - POST /logout → revoke token
   - Use revoked token → 401 Unauthorized

5. **Audit logging**
   - Perform various auth actions
   - GET /audit-log → see all events chronologically

## Environment Variables

Add to `backend/.env`:

```bash
# Core

APP_NAME=BU Scheduler API
JWT_SECRET=super-secret-key-change-in-production
JWT_EXPIRY=7d
CORS_ORIGIN=http://localhost:5173,https://bu-scheduler.example.com

# Frontend
FRONTEND_URL=http://localhost:5173

# StudentHub (if integrating with actual StudentHub)
STUDENTHUB_CLIENT_ID=your_client_id
STUDENTHUB_CLIENT_SECRET=your_client_secret
STUDENTHUB_API_URL=https://studenthub.example.com/api
```

## Future Enhancements

1. **Database Integration** - Replace in-memory storage with persistent DB
2. **Refresh Token Flow** - Implement refresh tokens for longer sessions
3. **Rate Limiting** - Prevent brute force attacks
4. **2FA/MFA Support** - Add multi-factor authentication
5. **Social Login** - Add Google, GitHub, Microsoft login
6. **User Profile Sync** - Periodic sync from StudentHub
7. **Delegation** - Allow admins to manage user permissions
8. **Webhooks** - Notify apps of auth events

## Troubleshooting

### "Token has been revoked"

- Token was previously used to logout
- User needs to login again

### "Authorization code not found"

- Code didn't match backend records (request expired or invalid)
- Code already used (single-use)
- Request code again from /authorize

### "PKCE verification failed"

- Code verifier doesn't match challenge
- Browser sent wrong codeVerifier (shouldn't happen with SDK)
- Frontend app storage corrupted (clear browser storage)

### "State mismatch"

- State from request doesn't match exchange call
- CSRF attack attempted or frontend bug
- Clear sessionStorage and retry

## Related Documentation

- Frontend auth: `src/lib/auth.ts`
- Express app setup: `backend/src/app.ts`
- User store: `backend/src/multiAppAuthStore.ts`
- Frontend login: `src/pages/pages.tsx` (login page)
