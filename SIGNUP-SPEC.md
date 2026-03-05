# Volunteer Signup System — Full Specification

## PROBLEM STATEMENT

The Ritual Song app (`ritualsong-app`) is a liturgical music planning tool used by music ministers at St. Monica Catholic Community. It currently has a two-layer auth system: (1) a site-wide access code gate (`rs_access` cookie) and (2) Supabase email/password auth with a profiles table. The signup experience is functional but friction-heavy — users need an access code just to see the app, then create an account with email+password, then fill out a profile form.

**Current state:** Signup requires access code → email + password → profile fields. No way to invite people. No SMS. No magic links. No approval workflow — anyone who knows the code gets full access.

**Desired state:** A modern, passwordless-first volunteer onboarding system inspired by Flocknote's text-to-join simplicity, with admin-controlled approval, SMS/email communication, and an elegant multi-step signup wizard. New volunteers get limited access (welcome page + their profile) until an admin approves them for full app access.

**Why it matters:** Recruiting and onboarding new music ministers is the #1 growth bottleneck. The current system requires Jeff to verbally give people a code and walk them through signup. A text-to-join flow ("Text STMONICA to 555-1234") that leads to a frictionless signup → admin approval pipeline removes this bottleneck entirely.

---

## ACCEPTANCE CRITERIA

- [ ] Public `/join` page exists outside the access code gate — no code needed to reach it
- [ ] Text-to-join: texting a keyword to a Twilio number triggers an SMS reply with a signup link
- [ ] Passwordless auth works via magic link (email) and OTP (SMS) — no password required
- [ ] Multi-step onboarding wizard collects: name, contact info, ensemble preference, musician role, voice part/instrument, availability
- [ ] New signups land in "pending" status with limited access (welcome page + own profile only)
- [ ] Admin members page shows pending members with approve/reject actions
- [ ] Approved members get notified (SMS + email) and gain full app access
- [ ] Admin can send bulk SMS/email to ensembles or all members
- [ ] TCPA compliance: explicit opt-in consent for SMS, unsubscribe mechanism
- [ ] Design matches current app aesthetic (stone palette, clean Tailwind, liturgical color accents, Calendar V2 typography)
- [ ] `npm run build` passes with zero errors
- [ ] All new tables have RLS policies; pending users cannot access resources

---

## CONSTRAINT ARCHITECTURE

| Category | Constraint |
|----------|-----------|
| **Must** | Use Supabase Auth (magic link + phone OTP) — no custom auth |
| **Must** | Use Twilio for SMS (text-to-join + notifications + OTP relay) |
| **Must** | Keep existing access code gate for the main app; `/join` and `/auth/*` routes bypass it |
| **Must** | Add `status` field to profiles: `pending` → `active` → `inactive` |
| **Must** | Store SMS consent timestamp + method for TCPA compliance |
| **Must** | All new migrations use `supabase/migrations/` naming convention (e.g., `015_signup_system.sql`) |
| **Must** | Preserve backward compatibility — existing users keep their accounts and admin status |
| **Must Not** | Break existing auth flow for current users |
| **Must Not** | Allow pending users to see music plans, song library, or admin pages |
| **Must Not** | Send SMS without explicit opt-in consent |
| **Must Not** | Store passwords — passwordless only for new signups (legacy password login stays for existing users) |
| **Prefer** | Resend for transactional email (magic links, notifications) — cleaner DX than SendGrid |
| **Prefer** | Server Actions over API routes for new form submissions |
| **Prefer** | Progressive disclosure in onboarding wizard (don't overwhelm with all fields at once) |
| **Prefer** | Optimistic UI with toast notifications for admin approval actions |
| **Escalate** | Twilio phone number selection and pricing tier |
| **Escalate** | Whether to support WhatsApp in addition to SMS |
| **Escalate** | Email template design (plain text vs. branded HTML) |

---

## TECH STACK CONTEXT

```
Framework:     Next.js 16.1.6 (App Router, Server Components, Server Actions)
Auth:          Supabase Auth (@supabase/ssr ^0.8.0, @supabase/supabase-js ^2.98.0)
Database:      Supabase Postgres with RLS
Styling:       Tailwind CSS v4 (PostCSS)
Deploy:        Vercel (auto-deploy from GitHub)
SMS (new):     Twilio (to be added)
Email (new):   Resend (to be added) — or Supabase Auth's built-in email for magic links
```

### Current File Structure (relevant)

```
src/
├── app/
│   ├── auth/
│   │   ├── login/       # Email+password login (keep for legacy)
│   │   ├── signup/      # Current signup form (will be replaced)
│   │   └── callback/    # OAuth/magic link callback
│   ├── gate/            # Access code gate page
│   ├── admin/
│   │   ├── booking/     # Scheduling grid
│   │   ├── members/     # Member roster (enhance with approval)
│   │   ├── compliance/  # Background checks
│   │   └── settings/    # Parish settings
│   └── api/
│       ├── gate/        # Access code verification
│       ├── booking-slots/
│       ├── choir-signups/
│       └── admin/
├── lib/
│   ├── supabase/
│   │   ├── client.ts    # Browser client
│   │   ├── server.ts    # Server client (cookie-based)
│   │   └── admin.ts     # Service role client
│   ├── admin.ts         # verifyAdmin() helper
│   └── booking-types.ts
├── middleware.ts         # Gate + auth session refresh
└── components/
    └── layout/
        └── Sidebar.tsx  # Main nav (version v1.13.1)

supabase/
├── schema.sql           # Base schema (profiles, admin_emails)
└── migrations/
    ├── 002_booking_choir_setlist.sql
    ├── 010_profile_enhancements.sql
    └── ...
```

### Existing Database Schema (relevant tables)

```sql
-- profiles (extends auth.users)
profiles (
  id uuid PK → auth.users.id,
  full_name text NOT NULL,
  email text NOT NULL,
  phone text,
  ensemble text CHECK (reflections|foundations|generations|heritage|elevations),
  musician_role text DEFAULT 'vocalist' CHECK (vocalist|instrumentalist|cantor|both),
  voice_part text CHECK (Soprano|Alto|Tenor|Bass),
  instrument_detail text,
  role text NOT NULL DEFAULT 'member' CHECK (admin|member),
  avatar_url text,
  created_at timestamptz,
  updated_at timestamptz
)

-- admin_emails (auto-promote trigger)
admin_emails (email text PK)
-- Trigger: promote_admin_on_insert sets role='admin' if email matches

-- ministry_roles (23 pre-seeded roles)
ministry_roles (id uuid PK, name text UNIQUE, description text, sort_order int)
-- Roles: Director, Cantor, Choir, Organist, Guitarist, Bassist, Drummer,
--         Instrumentalist, Psalmist, Sound, Playback, Piano, Soprano, Alto,
--         Tenor, Bass Vocal, A.Guitar, E.Guitar, E.Bass, Drums/Percussion,
--         Other, Livestream TD

-- booking_slots (admin-managed scheduling)
booking_slots (
  id uuid PK,
  mass_event_id uuid FK,
  ministry_role_id uuid FK → ministry_roles,
  profile_id uuid FK → profiles (nullable),
  person_name text (nullable — for non-users),
  confirmation text CHECK (unconfirmed|confirmed|declined|pending|expected|auto),
  ...
)

-- choir_signups (member self-service)
choir_signups (
  id uuid PK,
  mass_event_id uuid FK,
  user_id uuid FK → profiles,
  voice_part text,
  musician_role text,
  status text CHECK (confirmed|cancelled),
  ...
)
```

### Supabase Client Patterns

```typescript
// Browser (client components)
import { createClient } from "@/lib/supabase/client";
const supabase = createClient();

// Server (server components, route handlers)
import { createClient } from "@/lib/supabase/server";
const supabase = await createClient();

// Admin (service role — bypasses RLS)
import { createAdminClient } from "@/lib/supabase/admin";
const supabase = createAdminClient();

// Admin check
import { verifyAdmin } from "@/lib/admin";
const isAdmin = await verifyAdmin();
```

### Middleware Pattern (src/middleware.ts)

```typescript
// Current: checks rs_access cookie, then refreshes Supabase session
// Public paths: /gate, /auth/callback, /_next/static, /api/*
// Need to ADD: /join, /join/[code], /onboard, /pending to public paths
```

---

## PHASES

### Phase 1: Database Schema + Migration
**Deliverable:** SQL migration file `supabase/migrations/015_signup_system.sql`

**Steps:**
1. Add `status` column to `profiles`: `text NOT NULL DEFAULT 'active' CHECK (pending|active|inactive)` — default 'active' so existing users aren't affected
2. Add `sms_consent` column to `profiles`: `boolean DEFAULT false`
3. Add `sms_consent_at` column to `profiles`: `timestamptz`
4. Add `sms_consent_method` column to `profiles`: `text` (e.g., 'text_to_join', 'signup_form', 'admin_import')
5. Create `invitations` table:
   ```sql
   invitations (
     id uuid PK DEFAULT gen_random_uuid(),
     code text UNIQUE NOT NULL,         -- 8-char alphanumeric
     invited_by uuid FK → profiles,     -- admin who created it
     invited_phone text,                -- if sent via SMS
     invited_email text,                -- if sent via email
     ensemble text,                     -- pre-fill ensemble on signup
     status text DEFAULT 'pending' CHECK (pending|claimed|expired),
     claimed_by uuid FK → profiles,     -- user who claimed it
     claimed_at timestamptz,
     expires_at timestamptz DEFAULT (now() + interval '30 days'),
     created_at timestamptz DEFAULT now()
   )
   ```
6. Create `notifications_log` table:
   ```sql
   notifications_log (
     id uuid PK DEFAULT gen_random_uuid(),
     recipient_id uuid FK → profiles,
     channel text NOT NULL CHECK (sms|email),
     message_type text NOT NULL,        -- 'welcome', 'approved', 'reminder', 'announcement'
     external_id text,                  -- Twilio SID or Resend ID
     status text DEFAULT 'sent',
     created_at timestamptz DEFAULT now()
   )
   ```
7. Update RLS policies:
   - Pending users: SELECT own profile only, UPDATE own profile only
   - Active users: existing permissions (full authenticated access)
   - Add status check to existing `mass_events`, `booking_slots`, `choir_signups` SELECT policies
8. Create helper function: `is_active_user(uid)` that checks `profiles.status = 'active'`

**Done when:** Migration applies cleanly, existing users unaffected (all get `status='active'`), RLS prevents pending users from reading protected tables.

**Estimated scope:** M

---

### Phase 2: Twilio + Resend Integration
**Deliverable:** Server-side SMS and email utilities + API routes for webhooks

**Steps:**
1. Install packages: `npm install twilio resend`
2. Create `src/lib/twilio.ts`:
   ```typescript
   // Twilio client singleton
   // sendSMS(to, body) — send a single SMS
   // Environment: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER
   ```
3. Create `src/lib/resend.ts`:
   ```typescript
   // Resend client singleton
   // sendEmail(to, subject, html) — send transactional email
   // Environment: RESEND_API_KEY, RESEND_FROM_EMAIL
   ```
4. Create `src/app/api/webhooks/twilio/route.ts`:
   ```typescript
   // POST handler for incoming SMS
   // Validate Twilio signature (TWILIO_AUTH_TOKEN)
   // Parse incoming message body
   // If body matches keyword (e.g., "STMONICA", "JOIN"):
   //   - Create invitation record with phone number
   //   - Reply with signup link: "Welcome! Sign up here: {APP_URL}/join/{code}"
   // If body is "STOP":
   //   - Update profiles.sms_consent = false
   //   - Reply with confirmation
   // Log to notifications_log
   ```
5. Create `src/lib/notifications.ts`:
   ```typescript
   // High-level notification helpers:
   // notifyNewSignup(adminIds, newUser) — alert admins of pending member
   // notifyApproval(userId) — tell user they've been approved
   // notifyRejection(userId) — tell user they've been declined
   // sendBulkSMS(profileIds, message) — admin announcements
   // sendBulkEmail(profileIds, subject, html) — admin announcements
   ```
6. Add env vars to `.env.local.example`:
   ```
   TWILIO_ACCOUNT_SID=
   TWILIO_AUTH_TOKEN=
   TWILIO_PHONE_NUMBER=
   RESEND_API_KEY=
   RESEND_FROM_EMAIL=noreply@ritualsong.app
   ```

**Done when:** `sendSMS()` and `sendEmail()` work in dev, Twilio webhook parses keyword and creates invitation, STOP handling works.

**Estimated scope:** M

---

### Phase 3: Public Join Page + Passwordless Auth
**Deliverable:** `/join` landing page, `/join/[code]` invite page, magic link + OTP auth flow

**Steps:**
1. Update `src/middleware.ts`: Add `/join`, `/onboard`, `/pending` to public paths (bypass access code gate). Auth session still refreshed.

2. Create `src/app/join/page.tsx` — Public landing page:
   - Hero section: "Join St. Monica Music Ministry"
   - Brief description of what the app does
   - Two CTAs:
     - "Sign up with Email" → triggers magic link flow
     - "Sign up with Phone" → triggers SMS OTP flow
   - Text-to-join callout: "Or text STMONICA to (310) 555-1234"
   - Design: Clean, welcoming, stone palette. Similar to gate page aesthetic but warmer. No sidebar, no nav — standalone page.
   - If user is already authenticated, redirect to `/` or `/pending`

3. Create `src/app/join/[code]/page.tsx` — Invite link landing:
   - Validates invitation code (server component)
   - If valid: pre-fills ensemble, shows personalized welcome
   - If expired/claimed: shows error with link to `/join`
   - Same auth CTAs as `/join` but with invite context

4. Create `src/app/join/join-form.tsx` — Client component:
   - Tab toggle: Email / Phone
   - Email tab: email input → "Send Magic Link" button
     - Calls `supabase.auth.signInWithOtp({ email })` with `emailRedirectTo: /auth/callback?next=/onboard`
     - Shows "Check your email" confirmation state
   - Phone tab: phone input → "Send Code" button
     - Calls `supabase.auth.signInWithOtp({ phone })` (requires Twilio config in Supabase dashboard)
     - Shows OTP input (6 digits) → verify button
     - On verify: `supabase.auth.verifyOtp({ phone, token, type: 'sms' })`
   - On successful auth: redirect to `/onboard` (if new user) or `/` (if existing)

5. Update `src/app/auth/callback/route.ts`: Handle magic link callback, redirect new users to `/onboard`

**Design notes:**
- `/join` page should feel like an invitation, not a form. Generous white space, large type, one action at a time.
- Use CSS from Calendar V2 (the user specifically referenced this aesthetic): clean sans-serif (system font stack or Inter), generous spacing, subtle shadows, muted stone palette with liturgical color accents.
- Mobile-first — most volunteers will land here from a text message on their phone.

**Done when:** `/join` loads without access code, magic link sends and authenticates, phone OTP sends and verifies, invite codes pre-fill ensemble.

**Estimated scope:** L

---

### Phase 4: Onboarding Wizard
**Deliverable:** `/onboard` multi-step wizard that creates/completes the profile

**Steps:**
1. Create `src/app/onboard/page.tsx` — Server component:
   - Check auth: if no session, redirect to `/join`
   - Check profile: if profile exists and status='active', redirect to `/`
   - If profile exists and status='pending', redirect to `/pending`
   - Otherwise render wizard

2. Create `src/components/onboard/OnboardWizard.tsx` — Client component:
   - 4-step wizard with progress indicator (dots or bar, not numbered steps)
   - Step 1: **Welcome + Name**
     - "Welcome to St. Monica Music Ministry!"
     - Full name input (pre-filled from auth metadata if available)
     - "How should we contact you?" — show email (from auth), add phone if not already provided
   - Step 2: **Your Role**
     - "What do you do?" — select musician role: Vocalist, Instrumentalist, Cantor, Both
     - Conditional: voice part (if vocalist/cantor/both), instrument detail (if instrumentalist/both)
     - Use radio cards, not dropdowns — visual, touch-friendly
   - Step 3: **Your Ensemble**
     - "Which group are you joining?" — ensemble selection with descriptions
     - Brief blurb for each: Reflections (contemporary), Foundations (traditional), etc.
     - Pre-selected if invite had ensemble
   - Step 4: **SMS Consent + Submit**
     - "Stay in the loop" — opt-in to SMS notifications
     - TCPA-compliant language: "By checking this box, you consent to receive text messages from St. Monica Music Ministry at the number provided. Message and data rates may apply. Reply STOP to unsubscribe."
     - Checkbox (not pre-checked)
     - "Join" button → creates profile with status='pending'

3. On submit:
   - Upsert profile: `{ full_name, email, phone, ensemble, musician_role, voice_part, instrument_detail, status: 'pending', sms_consent, sms_consent_at, sms_consent_method: 'signup_form' }`
   - If invite code in URL/session: mark invitation as claimed
   - Notify admins (SMS + email): "New signup: {name} wants to join {ensemble}"
   - Redirect to `/pending`

4. Create `src/app/pending/page.tsx`:
   - Warm message: "You're almost in! An admin will review your signup shortly."
   - Show their profile summary (name, ensemble, role)
   - "Edit Profile" link back to relevant onboard step
   - No sidebar, no nav to main app — standalone page like `/join`
   - If user becomes active (admin approves), redirect to `/` on next visit

**Design notes:**
- One question per screen feel (though technically one page with steps)
- Large, tappable cards for selections (not tiny radio buttons)
- Smooth transitions between steps (slide or fade)
- "Back" button on steps 2-4
- Progress indicator subtle but clear

**Done when:** New user can complete wizard, profile created with status='pending', admins notified, user sees pending page.

**Estimated scope:** L

---

### Phase 5: Admin Approval + Member Management
**Deliverable:** Enhanced `/admin/members` with approval queue, notification triggers

**Steps:**
1. Update `src/app/admin/members/page.tsx`:
   - Fetch profiles with status breakdown
   - Pass pending count as prop to shell

2. Update `src/components/admin/MembersShell.tsx` (or create new version):
   - Add tab/section at top: "Pending Approval ({count})" | "Active Members" | "Inactive"
   - Pending section:
     - Card per pending member: name, ensemble, role, signup date, invite source
     - Two actions: "Approve" (green) and "Decline" (red/subtle)
     - Approve: updates `status='active'`, sends approval notification (SMS if consented + email)
     - Decline: updates `status='inactive'`, sends polite decline notification
     - Bulk approve checkbox + "Approve Selected" button
   - Active section:
     - Existing member roster with enhanced info
     - New action: "Deactivate" → sets status='inactive'
   - Inactive section:
     - Deactivated/declined members
     - "Reactivate" action

3. Create `src/app/api/admin/members/[id]/approve/route.ts`:
   ```typescript
   // PUT: Set profile status='active', trigger notifications
   // Requires admin auth
   ```

4. Create `src/app/api/admin/members/[id]/reject/route.ts`:
   ```typescript
   // PUT: Set profile status='inactive', trigger notifications
   ```

5. Add invite generation to admin members page:
   - "Invite Member" button → modal
   - Input: phone or email, optional ensemble pre-select
   - Creates invitation record
   - Sends SMS with join link (if phone) or email with join link (if email)

6. Update sidebar badge: Show pending count badge on "Members" nav item (small red dot or number)

**Done when:** Admin can see pending queue, approve/reject with one click, notifications fire on approval, invite links can be generated.

**Estimated scope:** L

---

### Phase 6: Communication Hub
**Deliverable:** Admin messaging interface for bulk SMS/email to ensembles

**Steps:**
1. Create `src/app/admin/messages/page.tsx`:
   - "Send Message" interface
   - Recipient selector: individual, ensemble, all active members, custom group
   - Channel: SMS, Email, or Both
   - Message composer:
     - SMS: plain text, 160-char counter, preview
     - Email: subject + body (rich text or markdown), preview
   - Send button with confirmation modal
   - Sent history (from notifications_log)

2. Create `src/app/api/admin/messages/route.ts`:
   - POST: validate admin, resolve recipients, send via Twilio/Resend, log
   - Respect sms_consent for SMS sends
   - Rate limiting: max 200 messages per batch

3. Add "Messages" to admin sidebar nav

**Done when:** Admin can compose and send bulk SMS/email to ensemble groups, sent messages are logged, non-consented users excluded from SMS.

**Estimated scope:** M

---

### Phase 7: Middleware + Access Control Hardening
**Deliverable:** Updated middleware, RLS verification, edge cases

**Steps:**
1. Update `src/middleware.ts`:
   - Public routes: `/join`, `/join/[code]`, `/onboard`, `/pending`, `/auth/*`, `/gate`, `/api/webhooks/*`
   - Pending user routes: `/pending`, `/onboard`, `/auth/*`, `/api/profile` (own only)
   - Active user routes: everything else (existing behavior)
   - If authenticated + pending + trying to access main app → redirect to `/pending`

2. Create `src/lib/user-status.ts`:
   ```typescript
   export async function getUserStatus(): Promise<'anonymous' | 'pending' | 'active' | 'admin'> {
     // Check auth session
     // If no session: 'anonymous'
     // If session: check profiles.status + profiles.role
     // Return appropriate status
   }
   ```

3. Verify RLS policies work correctly:
   - Run test queries as pending user → confirm no access to mass_events, songs, etc.
   - Run test queries as active user → confirm full access
   - Run test queries as admin → confirm admin access

4. Handle edge cases:
   - Existing user (active) logs in via magic link → goes straight to app (not onboard)
   - User's profile exists but is incomplete → redirect to onboard
   - Invite code claimed twice → graceful error
   - Expired invite → redirect to `/join` with message
   - Phone number already in system → merge or warn

**Done when:** Pending users are fully sandboxed, active users unaffected, no unauthorized access paths exist.

**Estimated scope:** M

---

## EVALUATION

### Automated Checks
- `npm run build` — zero errors
- TypeScript strict mode passes
- All new files have proper imports and exports

### Manual Verification
1. **Happy path (email):** Visit `/join` → enter email → receive magic link → click → land on onboard wizard → complete 4 steps → see pending page → admin approves → user notified → user gets full access
2. **Happy path (text-to-join):** Text "STMONICA" to Twilio number → receive link → tap → land on join page → enter phone → receive OTP → verify → onboard wizard → pending → approved
3. **Happy path (invite):** Admin creates invite → volunteer receives SMS/email with link → `/join/CODE` → pre-filled ensemble → auth → onboard → pending → approved
4. **Pending user lockout:** Pending user tries to navigate to `/planner` → redirected to `/pending`
5. **Existing user unaffected:** Current admin logs in with email+password → goes straight to app, no onboard
6. **STOP handling:** User texts "STOP" → sms_consent set to false → confirmation reply
7. **Admin bulk message:** Admin sends SMS to Reflections ensemble → only active+consented members receive it

### Known Failure Modes
- Supabase phone auth requires Twilio credentials in Supabase dashboard (not just app env vars)
- Magic link emails may land in spam — need to verify Resend domain or use Supabase's built-in email
- Twilio webhook URL must be publicly accessible (use Vercel URL, not localhost)
- Rate limits: Twilio free tier = 1 message/second; Resend free tier = 100 emails/day

---

## SUB-AGENT DECOMPOSITION

### Agent 1: Schema + Migration `[model: sonnet]`

**Mission:** Create the database migration that adds signup system tables and modifies existing schema, then verify it applies cleanly.

**Context to load:**
- `supabase/schema.sql`
- `supabase/migrations/002_booking_choir_setlist.sql`
- `supabase/migrations/010_profile_enhancements.sql`
- `src/lib/types.ts` (for existing type definitions)
- Check `supabase/migrations/` for latest migration number

**Constraints:**
- Must: Use `ALTER TABLE` for profiles changes (not recreate)
- Must: Default `status='active'` so existing users aren't affected
- Must: Add RLS policies for all new tables
- Must: Create `is_active_user()` helper function
- Must: Update existing RLS policies on `mass_events`, `booking_slots`, `choir_signups` to check `is_active_user()`
- Must Not: Drop or rename any existing columns
- Must Not: Change the `admin_emails` trigger behavior

**Done signal:** Migration file exists at `supabase/migrations/015_signup_system.sql`, SQL is syntactically valid (no parse errors).

**Output artifact:** Migration SQL file + summary of schema changes.

**Estimated tokens:** S (< 50k)

---

### Agent 2: Twilio + Resend + Notifications `[model: sonnet]`

**Mission:** Set up Twilio SMS client, Resend email client, notification helpers, and the Twilio incoming webhook route.

**Context to load:**
- `src/lib/supabase/admin.ts` (for admin client pattern)
- `src/lib/supabase/server.ts` (for server client pattern)
- `package.json` (current deps)
- `src/app/api/gate/route.ts` (for API route pattern)
- `.env.local.example` or `.env.local` (for env var pattern)
- This spec's Phase 2 section

**Constraints:**
- Must: Validate Twilio webhook signature on incoming SMS
- Must: Handle "STOP" keyword for TCPA compliance
- Must: Log all notifications to `notifications_log` table
- Must: Export clean helper functions from `src/lib/notifications.ts`
- Must Not: Send SMS to users without `sms_consent = true` (except initial signup reply which is transactional)
- Prefer: Singleton client pattern matching existing Supabase clients

**Done signal:** `npm install twilio resend` succeeds, `src/lib/twilio.ts` + `src/lib/resend.ts` + `src/lib/notifications.ts` + `src/app/api/webhooks/twilio/route.ts` exist, TypeScript compiles.

**Output artifact:** 4 new files + updated package.json + env var documentation.

**Estimated tokens:** M (50-100k)

---

### Agent 3: Join Page + Auth Flow + Onboard Wizard + Pending Page `[model: opus]`

**Mission:** Build the complete public-facing signup experience: `/join` landing, `/join/[code]` invite landing, passwordless auth (magic link + phone OTP), 4-step onboarding wizard, and pending approval page. This is the most design-intensive agent — must nail the aesthetic.

**Context to load:**
- `src/app/gate/page.tsx` + `src/app/gate/gate-form.tsx` (dark aesthetic reference)
- `src/app/auth/signup/signup-form.tsx` (current signup pattern — replace this)
- `src/app/auth/login/login-form.tsx` (current login pattern)
- `src/app/auth/callback/route.ts` (callback handler)
- `src/app/calendar-v2/page.tsx` (Calendar V2 aesthetic reference)
- `src/middleware.ts` (to update public paths)
- `src/lib/supabase/client.ts` (browser client)
- `src/lib/supabase/server.ts` (server client)
- `src/lib/notifications.ts` (from Agent 2 — for admin notification on signup)
- `src/components/layout/Sidebar.tsx` (for ensembles list, app aesthetic)
- This spec's Phase 3 + Phase 4 + Phase 7 sections
- Tailwind config / `globals.css` for existing design tokens

**Constraints:**
- Must: `/join` works without access code gate (update middleware)
- Must: Mobile-first design — most users arrive via text message link on phone
- Must: Support both magic link (email) and OTP (phone) auth
- Must: Onboard wizard has 4 steps with back navigation and progress indicator
- Must: Profile created with `status: 'pending'` on wizard completion
- Must: Admin notified of new signup via `notifyNewSignup()` from notifications lib
- Must: `/pending` page shows user's info and a warm "waiting for approval" message
- Must: Authenticated pending users trying to access main app redirect to `/pending`
- Must Not: Use dark theme for join/onboard pages — keep it light and welcoming
- Must Not: Show sidebar or main app navigation on join/onboard/pending pages
- Prefer: Stone palette (stone-50 through stone-900) with subtle liturgical purple (#7C3AED or similar) as accent
- Prefer: System font stack (consistent with Calendar V2)
- Prefer: Slide transitions between wizard steps
- Prefer: Large tappable radio cards for role/ensemble selection (not small inputs)

**Done signal:** All 4 pages render, magic link flow works end-to-end (email sends, callback authenticates, redirects to onboard), OTP flow works (sends code, verifies, redirects), wizard saves profile, pending page displays, middleware blocks pending users from main app.

**Output artifact:** ~8-10 new files (pages + components), updated middleware.

**Estimated tokens:** L (150k+) — This is the biggest agent but should stay in one session since all files are closely related. If context gets tight, the wizard steps could be split into a sub-agent, but try to keep it together.

---

### Agent 4: Admin Approval + Invite + Communication `[model: sonnet]`

**Mission:** Enhance the admin members page with approval queue, build invite generation, and create the admin messaging interface.

**Context to load:**
- `src/app/admin/members/page.tsx` (current members page)
- `src/components/admin/MembersShell.tsx` (current members shell — if exists, otherwise check for the component)
- `src/app/admin/booking/page.tsx` (admin page pattern reference)
- `src/components/layout/Sidebar.tsx` (to add Messages nav + pending badge)
- `src/lib/admin.ts` (verifyAdmin pattern)
- `src/lib/notifications.ts` (from Agent 2)
- `src/lib/twilio.ts` (from Agent 2)
- `src/lib/resend.ts` (from Agent 2)
- `src/app/api/admin/members/route.ts` (existing API — if exists)
- This spec's Phase 5 + Phase 6 sections

**Constraints:**
- Must: Pending members shown prominently at top of members page
- Must: One-click approve/reject with notification triggers
- Must: Invite generation creates invitation record + sends SMS or email
- Must: Messaging page allows sending to individual, ensemble, or all
- Must: SMS only sent to sms_consent=true users
- Must: All sends logged to notifications_log
- Must Not: Allow non-admins to access any admin routes
- Prefer: Optimistic UI for approve/reject (update UI immediately, revert on error)
- Prefer: Toast notifications for admin actions (not page reloads)

**Done signal:** Admin can see pending queue, approve/reject, generate invites, send bulk messages. `npm run build` passes.

**Output artifact:** Updated members page + new API routes + messaging page + sidebar updates.

**Estimated tokens:** M (50-150k)

---

### Agent 5: Integration + Verification `[model: sonnet]`

**Mission:** Wire everything together, run full build, fix any type errors or integration issues, verify all flows work, bump version.

**Context to load:**
- All new files from Agents 1-4
- `package.json` (version bump)
- `src/components/layout/Sidebar.tsx` (version)
- `src/middleware.ts` (final state)
- `tsconfig.json`

**Constraints:**
- Must: `npm run build` passes with zero errors
- Must: All imports resolve correctly
- Must: No TypeScript strict mode violations
- Must: Version bumped (minor version)
- Must: Verify middleware routing works for all user states
- Must Not: Change any existing functionality
- Must Not: Leave any TODO comments or placeholder code

**Done signal:** `npm run build` exits 0, `npm run lint` passes, version bumped in package.json + Sidebar.tsx.

**Output artifact:** Clean build, version bump, any integration fixes applied.

**Estimated tokens:** S-M (30-80k)

---

### Dependency Graph

```
Agent 1 (Schema) ──→ Agent 2 (Twilio/Resend) ──→ Agent 3 (Join/Onboard UI)
                                                ↘
                                                  Agent 4 (Admin Approval/Messages)
                                                    ↘
                                                      Agent 5 (Integration/Verify)
```

**Agent 1** must complete first (schema needed by all others).
**Agent 2** must complete before 3 and 4 (they import notification helpers).
**Agents 3 and 4** can run in parallel after Agent 2.
**Agent 5** runs last after all others complete.

---

## SETUP REQUIRED BEFORE RUNNING

Before starting any agent, these manual steps are needed:

1. **Twilio account**: Create account at twilio.com, get Account SID + Auth Token + phone number
2. **Resend account**: Create account at resend.com, get API key, verify sending domain
3. **Supabase phone auth**: In Supabase dashboard → Auth → Providers → Phone, enable and add Twilio credentials
4. **Supabase magic link**: In Supabase dashboard → Auth → Providers → Email, ensure magic link is enabled (it is by default)
5. **Environment variables**: Add to `.env.local` and Vercel:
   ```
   TWILIO_ACCOUNT_SID=ACxxxxxxxxxx
   TWILIO_AUTH_TOKEN=xxxxxxxxxx
   TWILIO_PHONE_NUMBER=+13105551234
   RESEND_API_KEY=re_xxxxxxxxxx
   RESEND_FROM_EMAIL=noreply@ritualsong.app
   ```
6. **Twilio webhook**: After deploying, set Twilio webhook URL to `https://your-domain.vercel.app/api/webhooks/twilio`
