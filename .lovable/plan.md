

## Plan: Create `create-user-webhook` Edge Function

### What it does
A webhook endpoint that Make.com calls after a Hotmart purchase. It creates a new user (if not existing) with the default password `123456` and adds the purchased credits. Existing users just get credits added. New users are flagged with `must_change_password: true` so the existing `/change-password` flow forces password change on first login.

### Technical details

**1. Create `supabase/functions/create-user-webhook/index.ts`**
- Accepts POST with JSON body: `{ email, name, packageId }` (fields Make.com will send)
- Uses `SUPABASE_SERVICE_ROLE_KEY` for admin operations
- Adds a shared secret header check (`x-webhook-secret`) for security — prevents unauthorized calls
- Logic:
  - Validate input (email required, packageId must be one of `basico`, `pro`, `plus`)
  - Look up user by email via `supabaseAdmin.auth.admin.listUsers()`
  - **If user exists**: add credits to existing balance
  - **If user doesn't exist**: create user with password `123456`, `email_confirm: true`, metadata `{ name, must_change_password: true }`; wait for trigger to create profile/credits; then update credits
  - Log transaction in `credit_transactions`
  - Return success response with `isNewUser`, `email`, `credits`

**2. Add webhook secret**
- Use `add_secret` tool to request a `WEBHOOK_SECRET` from the user — this secures the endpoint so only Make.com can call it

**3. No frontend changes needed**
- The existing `ProtectedRoute` already checks `must_change_password` and redirects to `/change-password`
- The `/change-password` page already clears the flag after password update
- Password `123456` is the fixed default as requested

### Expected Make.com webhook payload
```json
{
  "email": "buyer@example.com",
  "name": "João Silva",
  "packageId": "pro"
}
```

### Security
- Webhook secret header validation to prevent unauthorized access
- Uses service role key server-side only
- JWT verification disabled (webhook from external service, no user auth token)

