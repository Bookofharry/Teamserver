-- Optimize chat RLS policies by avoiding per-row auth() evaluation.

drop policy if exists chat_messages_select on public.workspace_messages;
create policy chat_messages_select
on public.workspace_messages
for select
using (
  exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = workspace_id
      and wm.user_id = (select auth.uid())
  )
);

drop policy if exists chat_messages_insert on public.workspace_messages;
create policy chat_messages_insert
on public.workspace_messages
for insert
with check (
  sender_id = (select auth.uid())
  and exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = workspace_id
      and wm.user_id = (select auth.uid())
  )
);

drop policy if exists chat_messages_update on public.workspace_messages;
create policy chat_messages_update
on public.workspace_messages
for update
using (
  sender_id = (select auth.uid())
  or exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = workspace_id
      and wm.user_id = (select auth.uid())
      and wm.role in ('owner', 'admin')
  )
)
with check (
  sender_id = (select auth.uid())
  or exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = workspace_id
      and wm.user_id = (select auth.uid())
      and wm.role in ('owner', 'admin')
  )
);

drop policy if exists chat_attachments_select on public.workspace_message_attachments;
create policy chat_attachments_select
on public.workspace_message_attachments
for select
using (
  exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = workspace_id
      and wm.user_id = (select auth.uid())
  )
);

drop policy if exists chat_attachments_insert on public.workspace_message_attachments;
create policy chat_attachments_insert
on public.workspace_message_attachments
for insert
with check (
  uploader_id = (select auth.uid())
  and exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = workspace_id
      and wm.user_id = (select auth.uid())
  )
);

drop policy if exists chat_reactions_select on public.workspace_message_reactions;
create policy chat_reactions_select
on public.workspace_message_reactions
for select
using (
  exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = workspace_id
      and wm.user_id = (select auth.uid())
  )
);

drop policy if exists chat_reactions_insert on public.workspace_message_reactions;
create policy chat_reactions_insert
on public.workspace_message_reactions
for insert
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = workspace_id
      and wm.user_id = (select auth.uid())
  )
);

drop policy if exists chat_reactions_delete on public.workspace_message_reactions;
create policy chat_reactions_delete
on public.workspace_message_reactions
for delete
using (user_id = (select auth.uid()));

drop policy if exists chat_mentions_select on public.workspace_message_mentions;
create policy chat_mentions_select
on public.workspace_message_mentions
for select
using (
  exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = workspace_id
      and wm.user_id = (select auth.uid())
  )
);

drop policy if exists chat_mentions_insert on public.workspace_message_mentions;
create policy chat_mentions_insert
on public.workspace_message_mentions
for insert
with check (
  exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = workspace_id
      and wm.user_id = (select auth.uid())
  )
);

drop policy if exists chat_notifications_select on public.workspace_message_notifications;
create policy chat_notifications_select
on public.workspace_message_notifications
for select
using (user_id = (select auth.uid()));

drop policy if exists chat_notifications_update on public.workspace_message_notifications;
create policy chat_notifications_update
on public.workspace_message_notifications
for update
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists chat_notifications_insert on public.workspace_message_notifications;
create policy chat_notifications_insert
on public.workspace_message_notifications
for insert
with check ((select auth.role()) = 'service_role');

drop policy if exists chat_audits_select on public.workspace_message_audits;
create policy chat_audits_select
on public.workspace_message_audits
for select
using (
  exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = workspace_id
      and wm.user_id = (select auth.uid())
      and wm.role in ('owner', 'admin')
  )
);

drop policy if exists chat_audits_insert on public.workspace_message_audits;
create policy chat_audits_insert
on public.workspace_message_audits
for insert
with check ((select auth.role()) = 'service_role');
