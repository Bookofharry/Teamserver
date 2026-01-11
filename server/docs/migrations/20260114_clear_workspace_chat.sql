-- Clear all workspace chat data across all workspaces.
-- Run with care: this deletes messages, reactions, attachments, mentions, notifications, and audits.

delete from workspace_message_notifications;
delete from workspace_message_mentions;
delete from workspace_message_reactions;
delete from workspace_message_attachments;
delete from workspace_message_audits;
delete from workspace_messages;
