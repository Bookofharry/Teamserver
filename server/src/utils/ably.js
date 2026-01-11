import Ably from 'ably'
let ablyClient

export const getAblyClient = () => {
  if (ablyClient) return ablyClient
  const apiKey = process.env.ABLY_API_KEY
  if (!apiKey) return null

  ablyClient = new Ably.Rest({ key: apiKey })
  return ablyClient
}
