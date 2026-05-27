# BU Scheduler Backend Auth - Implementation Summary

## What Was Implemented

This update adds **StudentHub-linked canonical identity management** to the BU Scheduler backend, ensuring a single user account even when logging in from multiple apps.

## Key Changes

### 1. Data Model Updates

**UserRecord** now includes StudentHub identity linking:
```typescript
{
  // ... existing fields ...
  studenthubId?: string;              // Canonical StudentHub identifier
  identityProvider?: 'local' | 'studenthub';
  linkedAt?: string;                  // When identity was linked
  authVersion: number;                // For future schema versions
}
```

**AuthTokenPayload** now includes token revocation tracking:
```typescript
{
  // ... existing fields ...
  jti: string;                        // JWT ID for revocation
  iat: number;                        // Issued at timestamp
}
```

### 2. Internal Storage Structures (In-Memory)

- **studenthubIdMap**: `Map<string, string>` - Maps StudentHub ID → local user ID
  - Ensures same StudentHub ID always resolves to same local user
  - Prevents duplicate accounts

- **revokedTokens**: `Set<string>` - Tracks revoked JWT IDs
  - Used for logout functionality
  - Token checked before allowing API access

- **auditLogs**: `AuditLog[]` - Chronological authentication event log
  - Tracks account creation, linking, logins, logouts, app authorization
  - Can be persisted to database later

### 3. New Authentication Methods (multiAppAuthStore)

```typescript
// Audit logging
addAuditLog(userId, action, details, appId?, status)
getAuditLogs(userId?, limit)

// StudentHub identity linking
linkStudentHubIdentity(userId, studenthubId)
getUserByStudentHubId(studenthubId)

// Token revocation
revokeToken(jti)
isTokenRevoked(jti)
```

### 4. Modified Endpoints

#### `/api/auth/student hub/exchange` (Enhanced)
**New optional parameter:**
```json
{
  "code": "shc_...",
  "state": "...",
  "codeVerifier": "...",
  "studenthubId": "studenthub_uid_optional"
}
```

**Backend now:**
- Uses `studenthubId` as primary identifier for canonical resolution
- Falls back to email matching if StudentHub ID not provided
- Links StudentHub ID to existing accounts automatically
- Returns `isNewAccount` flag

#### New: `POST /api/auth/logout`
- Revokes current JWT token by marking JTI as revoked
- Logs logout event
- Token-based (uses Authorization header)

#### New: `GET /api/auth/audit-log`
- Returns authentication events for current user
- Accepts `?limit=50` parameter
- Shows: account creation, linking, logins, logouts, app authorization

### 5. Audit Logging Added to All Auth Operations

| Operation | Audit Event | Details |
|-----------|-------------|---------|
| Create local account | `account_created` | provider: 'local', email, displayName |
| Link StudentHub | `account_linked` | provider: 'studenthub', email, StudentHub ID |
| StudentHub login | `studenthub_login` | email, StudentHub ID, flow (login/signup) |
| Local login | `local_login` | email |
| Logout | `logout` | appId |
| App authorization | `app_authorized` | appId, appName, permissions |
| App revocation | `app_revoked` | appId |

### 6. Identity Resolution Logic (Critical)

When exchanging StudentHub auth code:

```
1. If studenthubId provided:
   → Look up in studenthubIdMap
   → If found: use existing user (update profile)
   → If not found: continue to step 2

2. Look up by email:
   → If found: link studenthubId to this user (log event)
   → If not found: continue to step 3

3. Create new user:
   → Create local account
   → Link studenthubId
   → Log account_created event
```

**Why this prevents duplicates:**
- StudentHub ID is authoritative identifier
- Email provides fallback linking for first-time auth
- Once linked, same StudentHub ID always = same local user
- Map maintained in memory (can be persisted to DB)

## API Usage Examples

### StudentHub Login Flow

**Frontend initiates:**
```javascript
// 1. Prepare PKCE request locally
const request = await prepareStudentHubAuthRequest({
  flow: 'login',
  email: 'user@studenthub.edu',
  displayName: 'John Student',
  returnTo: '/home'
});

// 2. Get authorization code from backend
const authResult = await authorizeStudentHubPopup(request);
// Returns: { code, state, expiresInSeconds, ... }

// 3. Exchange code for JWT token
// Optionally pass studenthubId for even better canonical resolution
const session = await fetch('/api/auth/studenthub/exchange', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    code: authResult.code,
    state: request.state,
    codeVerifier: request.codeVerifier,
    studenthubId: 'shub_abc123'  // Optional - backend finds user by this
  })
});

// Returns: { token, user, authorizedApps, returnTo, isNewAccount }
// Frontend stores token in localStorage
```

### Verify Token

```javascript
const response = await fetch('/api/auth/verify', {
  headers: { 'Authorization': `Bearer ${token}` }
});
// Returns: { success, valid, user, timestamp }
```

### Logout

```javascript
const response = await fetch('/api/auth/logout', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` }
});
// Returns: { success, message }
// Token is now revoked; further requests will fail
```

### View Audit Trail

```javascript
const response = await fetch('/api/auth/audit-log?limit=50', {
  headers: { 'Authorization': `Bearer ${token}` }
});
// Returns: { success, logs: [...], count }
```

### Authorize an App

```javascript
const response = await fetch('/api/auth/authorize-app', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    appId: 'storehub',
    appName: 'StoreHub',
    permissions: ['profile', 'events', 'transactions']
  })
});
// Returns: { success, message, app }
```

## Multi-App Scenario

### Timeline: Using same StudentHub account across 2 apps

```
Day 1: BU Scheduler
─────────────────
1. User visits scheduler.bu.edu
2. Clicks "Sign in with StudentHub"
3. Frontend: POST /auth/studenthub/authorize
   → Backend returns: code (valid 5 min)
4. Frontend: POST /auth/studenthub/exchange with studenthubId=shub_xyz
   → Backend: studenthubIdMap[shub_xyz] = uid_001 (NEW)
   → Returns: JWT for uid_001
5. User grants app permissions (authorize-app)
   → Audit log: "app_authorized" for BU Scheduler
6. User uses scheduler for a week
7. User logs out: POST /auth/logout
   → Revokes token (added jti to revokedTokens)

Day 8: StoreHub (same StudentHub account)
──────────────────
1. User visits storehub.bu.edu
2. Clicks "Sign in with StudentHub" 
3. Frontend: POST /auth/studenthub/authorize
   → Backend returns: new code
4. Frontend: POST /auth/studenthub/exchange with studenthubId=shub_xyz
   → Backend: lookup studenthubIdMap[shub_xyz]
   → FINDS uid_001 (same as Day 1!)
   → Returns: JWT for uid_001 (NO DUPLICATE)
5. User's data is same as in BU Scheduler
   → Can share permissions/data across apps
   → Audit log shows all activity across both apps
```

## Technical Details

### Security Notes (Current Implementation)

✅ **Done:**
- PKCE prevents authorization code interception
- State parameter prevents CSRF
- Single-use auth codes
- Token revocation
- Audit logging

⚠️ **Before Production:**
- In-memory storage lost on restart (implement persistence)
- Passwords stored plaintext (use bcrypt/argon2)
- JWT secret hardcoded (move to environment variable)
- No rate limiting (add to prevent brute force)
- No HTTPS enforcement (add in production)

### Token Structure

Example decoded JWT:
```json
{
  "uid": "uid_local_001",
  "email": "user@studenthub.edu",
  "displayName": "John Student",
  "sourceApp": "studenthub",
  "authorizedApps": [
    { "appId": "storehub", "appName": "StoreHub", ... }
  ],
  "jti": "jti_abc123...",
  "iat": 1716734400,
  "exp": 1717339200
}
```

## Files Modified

1. **backend/src/multiAppAuthStore.ts**
   - Added: AuditLog type, StudentHub identity linking
   - Updated: UserRecord, AuthTokenPayload, buildTokenPayload()
   - Added: auditLogs[], studenthubIdMap, revokedTokens
   - New methods: addAuditLog, getAuditLogs, linkStudentHubIdentity, etc.

2. **backend/src/app.ts**
   - Updated: authorizeRequest() - now checks token revocation
   - Updated: resolveStudentHubUser() - implements canonical identity resolution  
   - Updated: /exchange endpoint - accepts studenthubId parameter
   - Updated: /signup, /login - added audit logging
   - New: /logout endpoint
   - New: /audit-log endpoint
   - Updated specs endpoint

3. **docs/backend-auth-implementation.md** (NEW)
   - Comprehensive documentation of auth system
   - Architecture, flows, API reference
   - Integration guide for frontend

## Environment Setup

Ensure `.env` has:
```bash
JWT_SECRET=dev-secret-change-in-production
JWT_EXPIRY=7d
CORS_ORIGIN=http://localhost:5173
```

## Testing Checklist

- [ ] FirstStudentHub login creates canonical user
- [ ] Second StudentHub login with same ID returns same user (no duplicate)
- [ ] Email-based linking works when StudentHub ID not provided
- [ ] Token revocation: /logout revokes token
- [ ] Revoked token rejected on next API call
- [ ] Audit log shows all events for user
- [ ] App authorization recorded in audit
- [ ] Local login with email/password still works
- [ ] Cross-app access uses same user ID

## Next Steps

1. **Test against actual StudentHub backend** (if available)
   - Verify proper StudentHub ID extraction
   - Test real auth code flow

2. **Implement persistence** (database layer)
   - Store users, audit logs, token revocation list
   - Query by studenthubId for canonical resolution

3. **Add production security**
   - Password hashing
   - Rate limiting
   - Refresh token rotation
   - CORS hardening

4. **Add monitoring**
   - Alert on failed login attempts
   - Track suspicious patterns
   - Audit log retention

5. **Integrate with other services**
   - Payments service (user per customer)
   - Notifications (user-scoped subscriptions)
   - Groups management (app-aware group permissions)

## Questions & Support

See `docs/backend-auth-implementation.md` for detailed troubleshooting.

Key sections:
- Architecture diagram
- Complete API reference
- Security considerations
- Production migration guide
