import Ably from 'ably'
import logger from './logger.js'

let realtimeClient
const channelPromises = new Map()

const getRealtimeClient = () => {
  if (realtimeClient) return realtimeClient
  const apiKey = process.env.ABLY_API_KEY
  if (!apiKey) return null
  realtimeClient = new Ably.Realtime({ key: apiKey })
  return realtimeClient
}

const getChannel = async (roomName) => {
  const existing = channelPromises.get(roomName)
  if (existing) return existing
  const client = getRealtimeClient()
  if (!client) return null
  const channelPromise = Promise.resolve(client.channels.get(roomName))
  channelPromises.set(roomName, channelPromise)
  try {
    return await channelPromise
  } catch (error) {
    channelPromises.delete(roomName)
    throw error
  }
}

export const publishChatRoomEvent = async (roomName, payload) => {
  try {
    const channel = await getChannel(roomName)
    if (!channel) return { sent: false, reason: 'missing_key' }
    const safePayload = JSON.parse(JSON.stringify(payload))
    await channel.publish('chat-event', safePayload)
    return { sent: true }
  } catch (error) {
    logger.warn({ error: error?.message || error, roomName }, 'Ably Chat publish failed')
    return { sent: false, reason: 'publish_failed' }
  }
}
