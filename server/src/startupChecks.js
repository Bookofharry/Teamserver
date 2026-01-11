export const verifyGeminiConfigured = () => {
  const provider = (process.env.AI_PROVIDER || '').trim().toLowerCase()
  const isProd = process.env.NODE_ENV === 'production'

  if (provider !== 'gemini' || !isProd) {
    return
  }

  const hasUrl = Boolean((process.env.GEMINI_API_URL || '').trim())
  const hasKey = Boolean((process.env.GEMINI_API_KEY || '').trim())

  if (!hasUrl || !hasKey) {
    throw new Error('GEMINI_API_URL and GEMINI_API_KEY must be set when AI_PROVIDER=gemini')
  }
}

export const verifySupabaseReachable = async (supabase) => {
  const isProd = process.env.NODE_ENV === 'production'
  if (!isProd) return
  try {
    const { error } = await supabase.from('profiles').select('id').limit(1)
    if (error) {
      throw error
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(`Supabase unreachable: ${message}`)
  }
}
