import { publishChatRoomEvent } from '../utils/ablyChat.js'

export const publishChatEvent = async (req, res) => {
  const workspaceId = req.params.id
  const payload = req.body || {}
  if (!payload?.type) {
    return res.status(400).json({ error: { code: 'invalid_request', message: 'Event type is required' } })
  }

  const result = await publishChatRoomEvent(`workspace:${workspaceId}`, payload)
  if (!result.sent && result.reason === 'missing_key') {
    return res.status(500).json({ error: { code: 'ably_missing', message: 'Ably is not configured' } })
  }
  if (!result.sent) {
    return res.status(500).json({ error: { code: 'ably_failed', message: 'Failed to publish realtime event' } })
  }

  res.json({ data: { sent: true } })
}
