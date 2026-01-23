# TeamPad Product Design

Version: 2.1
Owner: TeamPad PLC
Status: Active (mobile-first build)

## 0) Current App State (Mobile)
Shipped core flows:
- Auth (signup/login/OTP/reset)
- Workspaces, collections, notes (create/edit/pin/search)
- Realtime chat with reactions
- Invites + member list
- Profile + settings

Planned/experimental (not shipped in mobile UI):
- AI assistant
- Voice notes
- Focus mode
- Team pulse

## 1) Product Definition
TeamPad is a calm, fast workspace for teams to capture, organize, and share knowledge. It centers on the workspace → collection → note model, with a built-in realtime chat for coordination. AI assistance is planned but not part of the current mobile UI.

### Product Promise
- Capture fast, organize once.
- Collaboration without chaos.
- A workspace that stays calm under load.

## 2) Brand and Voice
- Voice: clear, confident, concise.
- Tone: calm, helpful, professional.
- Visual language: soft surfaces, minimal borders, intentional contrast, no noisy gradients inside productivity views.

## 3) Primary Users
- Internal teams (5-50): shared notes, handoffs, decision logs.
- Agencies (10-100): multiple workspaces, client separation, roles.
- Freelancers: personal + client workspaces.

## 4) Core Jobs To Be Done
- Capture notes quickly during work.
- Keep workspaces tidy without complex hierarchy.
- Share context with teammates and keep everyone aligned.
- Keep workspaces calm and predictable on mobile.

## 5) Information Architecture
- User
  - Workspaces
    - Workspace members (owner, admin, member)
    - Collections (groups)
      - Notes
        - Note versions
        - Attachments
    - Workspace chat

## 6) Key User Flows
1. Signup -> Verify email -> Create workspace -> Create first note.
2. Invite teammate -> Member joins -> Shared notes + chat.
3. Search or filter -> Open note -> Edit -> Version captured.
4. Chat -> Mention teammate -> Unread count -> Read clears.
5. (Planned) AI panel -> Ask about workspace or note -> Draft content -> User accepts.
6. (Planned) Voice Note: Record -> Listen -> Send.
7. (Planned) Focus Mode: Distraction-free writing.
8. (Planned) Team Pulse: Update status emoji.

## 7) Feature Inventory
### Notes (current)
- Title + body editor
- Pinning + search
- Fast list previews

### Workspaces
- Workspace switcher
- Role-based access
- Collection management

### Chat (current)
- Realtime messaging
- Reactions
- Typing indicators

### AI (planned / server-ready)
- Vector store notes (pgvector)
- Provider switch (mock or Gemini)

### Distinctive Features (planned)
- Voice Notes
- Focus Mode
- Team Pulse

### Admin and Billing
- Plans: free, premium, premium+
- Usage gates
- Upgrade flows

## 8) Data Model (High Level)
- users
- profiles
- workspaces
- workspace_members
- groups
- notes
- note_versions
- note_attachments
- workspace_messages
- workspace_message_reactions
- workspace_message_mentions
- workspace_message_attachments
- workspace_message_notifications
- workspace_message_audits
- workspace_invites

## 9) Permissions
- Owner: full control.
- Admin: manage members and content.
- Member: create and edit content within the workspace.
- RLS policies enforce access on all chat and content tables.

## 10) Security and Privacy
- Session cookie auth (HTTP-only)
- CSRF protection
- Input validation and sanitization
- Storage rules for workspace-scoped media
- Strict environment secret handling

## 11) UX Principles
- Calm over clutter.
- One task per surface: notes and chat (AI planned).
- Soft borders, consistent spacing, and predictable focus states.
- Always show state: syncing, unread, online, pending.

## 12) Performance
- Query pagination and caching
- Realtime events scoped per workspace
- Lazy loading for panels

## 13) Observability
- Structured logs with request IDs
- Server tests for auth, AI, and API

## 14) Roadmap
- Message edit history + moderation timeline
- Chat media compression improvements
- Expanded admin controls
- Advanced AI workflows

## 15) Open Questions
- Team onboarding flow and templates
- Notification delivery outside the app
- Advanced search across notes and chat
