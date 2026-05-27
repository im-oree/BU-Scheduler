# Testing the StudentHub Auth System Locally

This guide walks through testing the complete authentication flow end-to-end.

## Prerequisites

- Backend running on `http://localhost:4000`
- Frontend running on `http://localhost:5173`
- JWT secret configured in `.env`
- Node.js and npm installed

## Basic Setup

### 1. Start the Backend

```bash
cd backend
npm install
npm run dev
```

Expected output:
```
> bu-scheduler-backend@0.1.0 dev
> tsx watch src/server.ts

Server running on http://localhost:4000
```

### 2. Start the Frontend (New Terminal)

```bash
npm install
npm run dev
```

Expected output:
```
> root@0.0.1 dev
> vite

Local:   http://localhost:5173/
```

## Test Scenarios

### Scenario 1: Check Backend Health

**Test:** Verify backend is responding

```bash
curl http://localhost:4000/api/health
```

**Expected Response:**
```json
{
  "ok": true,
  "service": "BU Scheduler API",
  "timestamp": "2026-05-26T..."
}
```

### Scenario 2: Check API Spec

**Test:** List all available endpoints

```bash
curl http://localhost:4000/api/spec
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "identity": "StudentHub-linked BU Scheduler",
    "roles": [...],
    "endpoints": [
      "GET /api/health",
      "POST /api/auth/signup",
      "POST /api/auth/login",
      "POST /api/auth/studenthub/authorize",
      "POST /api/auth/studenthub/exchange",
      "POST /api/auth/logout",
      "GET /api/auth/audit-log",
      ...
    ]
  }
}
```

### Scenario 3: Local Signup Flow

**Test:** Create a local account and get JWT token

```bash
curl -X POST http://localhost:4000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser@example.com",
    "password": "password123",
    "displayName": "Test User"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "token": "eyJhbGc...",
  "user": {
    "uid": "uid_abc123def456",
    "email": "testuser@example.com",
    "displayName": "Test User",
    "authorizedApps": []
  },
  "authorizedApps": [],
  "message": "Account created successfully"
}
```

**Save the token:**
```bash
export TOKEN="eyJhbGc..."
```

### Scenario 4: Local Login

**Test:** Login with email/password

```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser@example.com",
    "password": "password123"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "token": "eyJhbGc...",
  "user": { ... },
  "authorizedApps": []
}
```

### Scenario 5: Verify Token

**Test:** Validate token and get current user info

```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:4000/api/auth/verify
```

**Expected Response:**
```json
{
  "success": true,
  "valid": true,
  "user": {
    "uid": "uid_abc123def456",
    "email": "testuser@example.com",
    "displayName": "Test User",
    "authorizedApps": []
  }
}
```

### Scenario 6: StudentHub PKCE Flow (Simulated)

**Step 1: Request Authorization Code**

```bash
curl -X POST http://localhost:4000/api/auth/studenthub/authorize \
  -H "Content-Type: application/json" \
  -d '{
    "state": "base64url_state_value",
    "codeChallenge": "base64url_challenge_value",
    "nonce": "base64url_nonce_value",
    "returnTo": "/home",
    "email": "studenthub@university.edu",
    "displayName": "StudentHub User",
    "flow": "login"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "code": "shc_abc123...",
  "state": "base64url_state_value",
  "expiresInSeconds": 300,
  "returnTo": "/home",
  "flow": "login"
}
```

**Step 2: Exchange Code for Token**

```bash
curl -X POST http://localhost:4000/api/auth/studenthub/exchange \
  -H "Content-Type: application/json" \
  -d '{
    "code": "shc_abc123...",
    "state": "base64url_state_value",
    "codeVerifier": "base64url_verifier_value",
    "studenthubId": "shub_studenthub_user_id"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "token": "eyJhbGc...",
  "user": {
    "uid": "uid_def456ghi789",
    "email": "studenthub@university.edu",
    "displayName": "StudentHub User",
    "authorizedApps": []
  },
  "authorizedApps": [],
  "returnTo": "/home",
  "nonce": "base64url_nonce_value",
  "state": "base64url_state_value",
  "isNewAccount": true
}
```

**Save this token:**
```bash
export STUDENTHUB_TOKEN="eyJhbGc..."
```

### Scenario 7: Authorize an App

**Test:** Grant app permission to access user data

```bash
curl -X POST http://localhost:4000/api/auth/authorize-app \
  -H "Authorization: Bearer $STUDENTHUB_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "appId": "storehub",
    "appName": "StoreHub",
    "permissions": ["profile", "events", "transactions"]
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "StoreHub has been authorized",
  "app": {
    "appId": "storehub",
    "appName": "StoreHub",
    "authorizedAt": "2026-05-26T...",
    "permissions": ["profile", "events", "transactions"]
  }
}
```

### Scenario 8: View Audit Log

**Test:** See all authentication events for user

```bash
curl -H "Authorization: Bearer $STUDENTHUB_TOKEN" \
  "http://localhost:4000/api/auth/audit-log?limit=20"
```

**Expected Response:**
```json
{
  "success": true,
  "logs": [
    {
      "id": "audit_abc123...",
      "userId": "uid_def456ghi789",
      "action": "app_authorized",
      "details": {
        "appId": "storehub",
        "appName": "StoreHub",
        "permissions": ["profile", "events", "transactions"]
      },
      "appId": "storehub",
      "timestamp": "2026-05-26T10:45:00Z",
      "status": "success"
    },
    {
      "id": "audit_def456...",
      "userId": "uid_def456ghi789",
      "action": "studenthub_login",
      "details": {
        "email": "studenthub@university.edu",
        "studenthubId": "shub_studenthub_user_id",
        "flow": "login"
      },
      "appId": "studenthub",
      "timestamp": "2026-05-26T10:44:00Z",
      "status": "success"
    }
  ],
  "count": 2
}
```

### Scenario 9: Logout (Token Revocation)

**Test:** Revoke current token

```bash
curl -X POST http://localhost:4000/api/auth/logout \
  -H "Authorization: Bearer $STUDENTHUB_TOKEN"
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

### Scenario 10: Verify Revoked Token

**Test:** Try to use revoked token (should fail)

```bash
curl -H "Authorization: Bearer $STUDENTHUB_TOKEN" \
  http://localhost:4000/api/auth/verify
```

**Expected Response:**
```json HTTP/1.1 401 Unauthorized
{
  "success": false,
  "message": "Token has been revoked"
}
```

### Scenario 11: Canonical Identity Test (Duplicate Prevention)

**Step 1: First StudentHub login (creates user)**

```bash
# Get code
AUTH_RESULT=$(curl -s -X POST http://localhost:4000/api/auth/studenthub/authorize \
  -H "Content-Type: application/json" \
  -d '{
    "state": "state1",
    "codeChallenge": "challenge1",
    "nonce": "nonce1",
    "returnTo": "/home",
    "email": "sameuser@studenthub.edu",
    "displayName": "Same User",
    "flow": "login"
  }')

CODE1=$(echo $AUTH_RESULT | jq -r '.code')

# Exchange with studenthubId
RESULT1=$(curl -s -X POST http://localhost:4000/api/auth/studenthub/exchange \
  -H "Content-Type: application/json" \
  -d "{
    \"code\": \"$CODE1\",
    \"state\": \"state1\",
    \"codeVerifier\": \"verifier1\",
    \"studenthubId\": \"shub_12345\"
  }")

UID1=$(echo $RESULT1 | jq -r '.user.uid')
echo "First login created user: $UID1"
```

**Step 2: Second StudentHub login (same studenthubId)**

```bash
# Get new code
AUTH_RESULT2=$(curl -s -X POST http://localhost:4000/api/auth/studenthub/authorize \
  -H "Content-Type: application/json" \
  -d '{
    "state": "state2",
    "codeChallenge": "challenge2",
    "nonce": "nonce2",
    "returnTo": "/home",
    "email": "sameuser@studenthub.edu",
    "displayName": "Same User Updated",
    "flow": "login"
  }')

CODE2=$(echo $AUTH_RESULT2 | jq -r '.code')

# Exchange with same studenthubId
RESULT2=$(curl -s -X POST http://localhost:4000/api/auth/studenthub/exchange \
  -H "Content-Type: application/json" \
  -d "{
    \"code\": \"$CODE2\",
    \"state\": \"state2\",
    \"codeVerifier\": \"verifier2\",
    \"studenthubId\": \"shub_12345\"
  }")

UID2=$(echo $RESULT2 | jq -r '.user.uid')
echo "Second login returned user: $UID2"

# Verify they're the same
if [ "$UID1" = "$UID2" ]; then
  echo "✅ SUCCESS: Same StudentHub ID resolved to same local user (no duplicate!)"
else
  echo "❌ FAILURE: Different user IDs (unexpected duplicate)"
fi
```

## Frontend Integration Testing

### Test in Browser

1. Open `http://localhost:5173`
2. Navigate to login page
3. Select "Sign in with StudentHub"
4. Enter test credentials
5. Verify token is stored in `localStorage`
6. Check browser Network tab - look for `/api/auth/studenthub/authorize` and `/api/auth/studenthub/exchange` calls

### Check LocalStorage

In browser console:
```javascript
// Check stored session
JSON.parse(localStorage.getItem('bu-scheduler.session'))

// Should show:
{
  token: "eyJhbGc...",
  user: { uid, email, displayName, ... },
  authorizedApps: [...]
}
```

## Troubleshooting

### Token verification fails

**Symptom:** `401 Unauthorized - Invalid or expired token`

**Causes:**
1. Token expired (check JWT decode for `exp`)
2. JWT_SECRET mismatch between sign and verify
3. Token malformed

**Solution:**
```bash
# Decode token to inspect
node -e "console.log(JSON.parse(Buffer.from('$TOKEN'.split('.')[1], 'base64')))"
```

### PKCE verification fails

**Symptom:** `400 Bad Request - PKCE verification failed`

**Causes:**
1. codeVerifier doesn't match codeChallenge
2. Challenge not SHA256 of verifier

**Solution:**
- Use proper PKCE library on frontend
- Test with known good values

### Code already used

**Symptom:** `409 Conflict - Authorization code has already been used`

**Causes:**
1. Exchange called twice with same code
2. Code consumed in another app instance

**Solution:**
- Don't retry exchange automatically
- Get new code from /authorize

### State mismatch

**Symptom:** `400 Bad Request - State mismatch`

**Causes:**
1. State doesn't match between authorize and exchange
2. CSRF attempt

**Solution:**
- Verify same state string used
- Check browser sessionStorage has pending request
- Don't open multiple auth tabs simultaneously

## Advanced Testing

### Test Multi-App Identity Linking

```bash
# User logs into App 1
# ... creates account and gets token1

# User logs into App 2 with same StudentHub email
# ... backend finds existing user by email
# ... links StudentHub ID automatically
# ... returns token2 for SAME user

curl -X GET http://localhost:4000/api/auth/audit-log...
# Verify you see "account_linked" event
```

### Test App Permission Scoping

```bash
# Test that apps can only access granted data
# Login as user, authorize app1 for [profile, events]
# App1 tries to access [profile, transactions]
# Should fail - app only has [profile, events]
```

### Load Testing (Optional)

```bash
# Simulate multiple logins
for i in {1..100}; do
  curl -X POST http://localhost:4000/api/auth/login \
    -H "Content-Type: application/json" \
    -d "{
      \"email\": \"testuser$i@example.com\",
      \"password\": \"password123\",
      \"displayName\": \"Test User $i\"
    }" &
done
wait
```

## Dashboard/Monitoring

Coming soon:
- Admin dashboard to view audit logs
- Rate limiting metrics
- Failed login alerts
- Token revocation status
