import { getAblyClient } from '../utils/ably.js'

export const createAblyToken = async (req, res) => {
  const client = getAblyClient()
  if (!client) {
    return res.status(500).json({ error: { code: 'ably_missing', message: 'Ably is not configured' } })
  }

  try {
    const tokenRequest = await client.auth.createTokenRequest({
      clientId: req.auth.userId,
    })
    res.json(tokenRequest)
  } catch (error) {
    res.status(500).json({ error: { code: 'ably_failed', message: 'Failed to create Ably token' } })
  }
}
