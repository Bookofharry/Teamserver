# MVP Validation Plan (2 Weeks)

## Goal
Prove the core bet: teams will capture decisions in the same space they chat, instead of splitting Slack + docs.

## Week 1 - Ship + Instrument
- Stabilize invite -> accept -> first note flow.
- Ensure Team Pulse status persists and is visible.
- Confirm Dashboard/Chat/Notes are usable on mobile.
- Ship analytics events listed below.

## Week 2 - Validate + Learn
- Run 5-10 team pilots for 7 days.
- Collect qualitative feedback + behavioral data.
- Identify the single most "sticky" workflow to double down on.

## Success Criteria (14 days)
- Activation: 60-70% of invited users create or edit a note within 48 hours.
- Engagement: 60% of workspaces have both chat messages and notes within 72 hours.
- Early retention: 40% of workspaces active on day 7.

## Analytics Events (Minimal, High-Signal)

### Common payload (all events)
- `user_id`
- `workspace_id` (nullable)
- `role` (owner/admin/member)
- `plan` (free/premium/premium_plus)
- `device` (desktop/mobile/tablet)
- `source` (invite/link/marketing)
- `timestamp`

### Event definitions
- `auth_signed_up`
  - payload: `email_domain`, `via` (signup/otp)
- `auth_logged_in`
  - payload: `via` (login/otp)
- `workspace_created`
  - payload: `workspace_id`, `name_length`
- `workspace_selected`
  - payload: `workspace_id`
- `invite_sent`
  - payload: `workspace_id`, `role`, `invite_email_domain`
- `invite_accepted`
  - payload: `workspace_id`, `role`
- `note_created`
  - payload: `note_id`, `group_id`, `source` (button/quickstart)
- `note_viewed`
  - payload: `note_id`, `group_id`
- `note_edited`
  - payload: `note_id`, `group_id`, `field` (title/body/tags)
- `note_saved`
  - payload: `note_id`, `group_id`, `change_count`
- `chat_message_sent`
  - payload: `message_id`, `message_type` (text/image/voice), `has_mentions`
- `chat_message_read`
  - payload: `latest_message_id`, `unread_count`
- `chat_mention_received`
  - payload: `message_id`, `mention_count`
- `search_used`
  - payload: `query_length`, `scope` (workspace/group)
- `team_pulse_set`
  - payload: `status_length`
- `team_pulse_cleared`
  - payload: `previous_status_length`

## Where to Fire Events (Code Map)

- `auth_signed_up`
  - `teampad/src/pages/Auth.tsx` in `handleSignUp` after success.
- `auth_logged_in`
  - `teampad/src/pages/Auth.tsx` in `handleLogin` after success.
  - `teampad/src/pages/Auth.tsx` in `handleOTPVerify` after success.
- `workspace_created`
  - `teampad/src/pages/Dashboard.tsx` after `createWorkspace.mutateAsync` success in both create flows.
- `workspace_selected`
  - `teampad/src/hooks/use-dashboard-state.ts` in `handleWorkspaceChange`.
- `invite_sent`
  - `teampad/src/components/workspaces/MembersDialog.tsx` after `createInvite.mutateAsync` success.
- `invite_accepted`
  - `teampad/src/pages/InviteAccept.tsx` after accept success.
  - `teampad/src/components/settings/SettingsDrawer.tsx` after accept success.
- `note_created`
  - `teampad/src/hooks/use-note-actions.ts` after `createNote.mutateAsync` success.
- `note_viewed`
  - `teampad/src/hooks/use-dashboard-state.ts` in `handleNoteSelect` (fire once per note session).
- `note_edited`
  - `teampad/src/components/notes/NoteEditor.tsx` when `hasChanges` flips from false -> true.
- `note_saved`
  - `teampad/src/components/notes/NoteEditor.tsx` after `handleSaveNote` success.
- `chat_message_sent`
  - `teampad/src/components/chat/ChatPanel.tsx` after `createMessage.mutateAsync` success in `handleSend`.
- `chat_message_read`
  - `teampad/src/pages/Dashboard.tsx` in the effect that updates `teampad-chat-last-read` when `showChatPanel` is true.
- `chat_mention_received`
  - `teampad/src/hooks/use-chat-realtime.ts` in `handleMessageCreated` when `isMentioned` is true.
- `search_used`
  - `teampad/src/components/layout/Sidebar.tsx` when `onSearchChange` updates the debounced query (fire once when query length >= 2).
- `team_pulse_set`
  - `teampad/src/components/workspaces/StatusDialog.tsx` after `updateProfile.mutateAsync` success when status is non-null.
- `team_pulse_cleared`
  - `teampad/src/components/workspaces/StatusDialog.tsx` after `updateProfile.mutateAsync` success when status is null.

## Pilot Checklist (5-10 teams)
- Preload: create the workspace, one collection, and a welcome note.
- Day 0: send invite link + short onboarding script.
- Day 1-2: confirm at least one chat message and one note per team.
- Day 3-4: ask for one "decision -> note" example.
- Day 7: collect feedback and export metrics snapshot.

## Interview Script (15 minutes)
1) What did you try to coordinate this week?
2) When did you use chat vs. notes?
3) Did any chat decision become a note? How?
4) Was anything hard to find later?
5) If you had to remove one feature, which?
6) Would you replace Slack + docs with this? Why or why not?

Notes
- Avoid capturing message or note content in analytics.
- Use a single `trackEvent(name, payload)` helper and keep payloads small.
