# TeamPad Pre-MVP Presentation (v1.7)

## What TeamPad Is
TeamPad is a collaborative note workspace for teams. It keeps team knowledge organized, searchable, and always in sync, with role-based access, workspace invites, and a clean branded UI.

## Problem
Teams lose context across chat threads and scattered docs. Notes get buried, ownership is unclear, and updates are hard to trace.

## Solution
TeamPad provides structured workspaces, group channels, and notes with controlled access, fast search, and a frictionless invite flow.

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
- Versioning captured in `note_versions`.

**Search**
- Workspace-wide search; when query is present, results span all groups.

**Settings**
- Theme selection (light/dark/system).
- Default group + time format preferences.
- Profile update (avatar; name locked with support prompt).
- Reset password trigger (Supabase flow).

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
- REST API at `/v1`
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

## Security + Access Rules (Now)
- JWT auth for all private API routes.
- Server uses Supabase service role (RLS enabled in DB).
- Role checks on invite/members/actions.
- Invite acceptance requires matching email.

## Plans + Permissions (Draft)
**Free**
- Price: $0
- 1 workspace max.
- Up to 5 groups per workspace.
- Up to 8 notes per group.
- Plain text editor only (no rich formatting).
- Basic roles (owner/admin/member) + invites.

**Premium**
- Price: $15/month
- 3 workspaces.
- 20 groups per workspace.
- 200 notes per group.
- Rich formatting tools (headings, lists).
- Stronger team controls (invites, member management).

**Premium+**
- Price: $25/month
- Unlimited workspaces/groups/notes.
- TeamPad AI (summaries/actions).
- Public notes (unlisted shareable links).
- Advanced security + audit trail.
- Priority support + future SSO/analytics.

**Note:** Billing is not implemented yet. These tiers define product boundaries and UI upgrade prompts.

## What We Start With (Pre-MVP Release)
- Auth, workspaces, groups, notes, and invites.
- Search, pinning, note versioning (silent backend).
- Theme + settings.
- Role-based access.
- Branded marketing site.

## What Is Intentionally Out of Scope (For Now)
- Audit log UI
- Real-time collaboration
- Billing / subscriptions
- Workspace analytics
- Full mobile UX
- AI integrations (mock only)

## Risks / Constraints
- Invite system depends on SMTP config (must be reliable).
- Note versioning is backend-only; no UI for history yet.
- Mobile experience is functional but not fully optimized.

## Next Milestones After Pre-MVP
1) Invite acceptance UX polish + email deliverability hardening  
2) Workspace billing + subscription handling  
3) Note history viewer  
4) Real-time collaboration  

## Current Version
**TeamPad v1.7** (pre-MVP baseline)
