import logger from './logger.js';

export const logEvent = async (supabase, { userId, workspaceId, action, metadata }) => {
  if (!action || !supabase) return;
  const payload = {
    user_id: userId || null,
    workspace_id: workspaceId || null,
    action,
    metadata: metadata ?? null,
  };
  const { error } = await supabase.from('event_logs').insert(payload);
  if (error) {
     logger.warn({ action, error: error?.message || error }, 'Event log failed');
  }
};
