

## Plan: Create `check-user-exists` Edge Function

### What it does
A simple endpoint that Make.com calls (before or after a Hotmart purchase) to check if a user already exists in the database by email. Returns the user's existence status and current credit balance, so Make.com can decide the next step in the automation flow (add credits to existing user vs. create new user via `create-user-webhook`).

### Technical details

**1. Create `supabase/functions/check-user-exists/index.ts`**
- Accepts POST with JSON body: `{ email }`
- Validates the `x-webhook-secret` header (same `WEBHOOK_SECRET` already configured)
- Uses `SUPABASE_SERVICE_ROLE_KEY` for admin lookup
- Logic:
  - Look up user by email via `supabaseAdmin.auth.admin.listUsers()`
  - If found: return `{ exists: true, userId, email, creditsBalance }`
  - If not found: return `{ exists: false, email }`
- No database changes — read-only operation

**2. No new secrets needed**
- Reuses the existing `WEBHOOK_SECRET` for security

**3. No frontend changes needed**

### Expected request
```json
POST /check-user-exists
Header: x-webhook-secret: <secret>
Body: { "email": "buyer@example.com" }
```

### Expected responses
```json
// User exists
{ "exists": true, "userId": "uuid", "email": "...", "creditsBalance": 24 }

// User not found
{ "exists": false, "email": "..." }
```

### Make.com flow
1. Hotmart purchase triggers Make.com
2. Make.com calls `check-user-exists` with buyer email
3. Based on `exists` response, Make.com routes to `create-user-webhook` (handles both new and existing users with credit addition)

