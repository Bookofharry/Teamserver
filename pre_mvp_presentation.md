# TeamPad Pre-MVP Presentation (v1.8)

## Slide Guide (12 slides)
1) Title + one-liner
2) Problem
3) Why now
4) Solution
5) Product tour (core flows)
6) Workspace chat
7) Notes + version history
8) Security + trust
9) Plans + limits
10) MVP scope + what’s next
11) Risks + mitigations
12) Ask / next step

## 1) Title + One-Liner
**TeamPad**  
The calm, fast workspace where team chat and knowledge live together.

## 2) Problem
Teams lose context across chat threads and scattered docs. Notes get buried, ownership is unclear, and updates are hard to trace.

## 2.1) Why Not Slack / Notion
- Slack = fast chat, weak long-term memory.
- Notion = structured docs, slow for quick coordination.
- TeamPad merges both in one focused workspace.

## 3) Why Now
- Remote and hybrid teams need a single place for decisions and knowledge.
- Chat-first tools don’t preserve long-term context.
- Teams want speed, clarity, and lightweight structure.

## 4) Solution
TeamPad provides structured workspaces, collections, notes, and realtime workspace chat with controlled access, fast search, and a frictionless invite flow.

## 5) Product Tour (Core Flows)
- Visit marketing home (`/`) -> click Open App.
- Auth on `/auth` (signup or login).
- Redirect to `/app` (dashboard).
- Create or select workspace -> create group -> create note.
- Invite members via email -> accept invite via `/invite/:token`.
- Use workspace chat for realtime updates and mentions.

## 6) Workspace Chat
- Realtime per workspace (Ably).
- Mentions, reactions, and image uploads.
- Unread + mention counters.
- Message retention by plan (free 1k, premium 3k, premium+ 10k).

## 7) Notes + Version History
- Create, edit, save, delete.
- Pin/unpin, tags, quick preview.
- Save status + explicit Save button.
- Version history UI + restore flow (plan-limited).
- Attachments stored in Supabase storage.

## 8) Security + Trust
- JWT auth for all private API routes.
- Server uses Supabase service role (RLS enabled in DB).
- Role checks on invite/members/actions.
- Invite acceptance requires matching email.
- CSRF protections for session-bound endpoints.

## 9) Plans + Limits (Draft)
**Free**
- 1 workspace, 5 collections, 8 notes per collection.
- Plain text editor only.
- Version history: 3 latest.
- Chat retention: 1,000 messages.

**Premium ($15/mo)**
- 3 workspaces, 20 collections, 200 notes per collection.
- Rich formatting tools.
- Version history: 10 latest.
- Chat retention: 3,000 messages.

**Premium+ ($25/mo)**
- Unlimited workspaces/collections/notes.
- TeamPad AI, public notes, audit trail.
- Version history: 20 latest.
- Chat retention: 10,000 messages.

## 10) MVP Scope + What’s Next
**Included**
- Auth, workspaces, collections, notes, invites.
- Search, pinning, version history UI.
- Workspace chat (realtime, mentions, reactions).
- Theme + settings.

**Next**
1) Invite acceptance UX polish + email deliverability hardening  
2) Workspace billing + subscription handling  
3) Chat moderation UX + mention notifications UI  
4) Real-time co-editing  

## 11) Risks + Mitigations
- SMTP reliability -> multiple SMTP options + failover checklist.
- Chat delivery -> Ably keys + storage policies checklist.
- Mobile UX -> fixed breakpoints + targeted QA list.

## 11.1) MVP Success Metrics (30 Days)
- Activation: 70% of invited users create or edit a note.
- Retention: 40% weekly active teams.
- Engagement: 3+ notes and 15+ chat messages per workspace.

## 12) Ask / Next Step
- Approve MVP for private beta with 5-10 teams.
- Validate retention and version caps.
- Gather feedback on chat vs. notes usage split.

---

## Target Users
- Small teams (2-20) that collaborate daily
- Product, operations, and marketing teams that need shared notes
- Founders who need a fast, structured knowledge hub

## Current Product Scope (v1.7)

### Core User Flows
- Visit marketing home (`/`) -> click Open App.
- Auth on `/auth` (signup or login).
- Redirect to `/app` (dashboard).
- Create or select workspace -> create group -> create note.
- Invite members via email -> accept invite via `/invite/:token`.
- Use workspace chat for realtime updates and mentions.

### Features Implemented
**Workspaces**
- Create, rename, delete (owner only).
- Role-based access: owner/admin/member.
- Limit: free users can only create 1 workspace (upgrade gate).

**Members + Invites**
- Invite by email with secure link (24h expiry).
- Accept/Decline flow with signed-in or new-account path.
- Strict invite checks:
  - block self-invite
  - block if already a member
  - block if pending invite exists
- Members list with role badges and remove flow (owner/admin rules).

**Groups**
- Create groups inside a workspace.
- Default group created on workspace setup.

**Notes**
- Create, edit, save, delete.
- Pin/unpin.
- Tags and quick preview in the list.
- Save status + explicit Save button.
- Version history UI + restore flow (plan-limited).
- Attachments (upload/download) stored in Supabase storage.

**Workspace Chat**
- Realtime per workspace (Ably).
- Mentions, reactions, and image uploads.
- Unread + mention counters.
- Message retention by plan (free 1k, premium 3k, premium+ 10k).

**Search**
- Workspace-wide search; when query is present, results span all groups.

**Settings**
- Theme selection (light/dark/system).
- Default group + time format preferences.
- Profile update (avatar; name locked with support prompt).
- Reset password trigger (custom auth flow).

**AI Panel (Mock)**
- AI actions panel in the note editor (summary/actions/title).
- Currently mocked responses (placeholder for future AI integration).

**Branding + UI**
- TeamPad logo and branded marketing site.
- Consistent header/navigation with fixed top bar.
- White background on marketing.
- Clean, sharp UI with limited motion.

## Technical Architecture

**Frontend**
- Vite + React + TypeScript
- Tailwind + shadcn-ui
- React Query for data fetching
- Supabase client for auth/session

**Backend**
- Node.js + Express
- Supabase Admin SDK + JWT validation
- REST API at `/v1` and `/api`
- SMTP email delivery (Nodemailer)

**Database**
Schema file: `server/docs/supabase-schema.sql`

Main tables:
- `profiles` (user profile + subscription flag)
- `workspaces`
- `workspace_members`
- `groups`
- `notes`
- `note_versions`
- `workspace_invites`
- `workspace_messages` + chat tables

## Security + Access Rules (Now)
- JWT auth for all private API routes.
- Server uses Supabase service role (RLS enabled in DB).
- Role checks on invite/members/actions.
- Invite acceptance requires matching email.
- CSRF protections for session-bound endpoints.

## Plans + Permissions (Draft)
**Free**
- Price: $0
- 1 workspace max.
- Up to 5 groups per workspace.
- Up to 8 notes per group.
- Plain text editor only (no rich formatting).
- Basic roles (owner/admin/member) + invites.
- Version history: 3 latest.
- Chat retention: 1,000 messages.

**Premium**
- Price: $15/month
- 3 workspaces.
- 20 groups per workspace.
- 200 notes per group.
- Rich formatting tools (headings, lists).
- Stronger team controls (invites, member management).
- Version history: 10 latest.
- Chat retention: 3,000 messages.

**Premium+**
- Price: $25/month
- Unlimited workspaces/groups/notes.
- TeamPad AI (summaries/actions).
- Public notes (unlisted shareable links).
- Advanced security + audit trail.
- Priority support + future SSO/analytics.
- Version history: 20 latest.
- Chat retention: 10,000 messages.

**Note:** Billing is not implemented yet. These tiers define product boundaries and UI upgrade prompts.

## What We Start With (Pre-MVP Release)
- Auth, workspaces, groups, notes, and invites.
- Search, pinning, and version history UI.
- Workspace chat (realtime, mentions, reactions).
- Theme + settings.
- Role-based access.
- Branded marketing site.

## What Is Intentionally Out of Scope (For Now)
- Audit log UI
- Billing / subscriptions
- Workspace analytics
- AI integrations (mock only)

## Risks / Constraints
- Invite system depends on SMTP config (must be reliable).
- Chat delivery depends on Ably keys and storage policy setup.
- Mobile experience is functional but not fully optimized.

## Next Milestones After Pre-MVP
1) Invite acceptance UX polish + email deliverability hardening  
2) Workspace billing + subscription handling  
3) Chat moderation UX + mention notifications UI  
4) Real-time co-editing  

## Current Version
**TeamPad v1.8** (pre-MVP baseline)
