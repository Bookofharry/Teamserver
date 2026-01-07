export const normalizePlan = (plan) => {
  const safe = String(plan || '').trim().toLowerCase()
  if (!safe) return null
  if (safe === 'premium+' || safe === 'premium plus' || safe === 'premium_plus') return 'premium_plus'
  if (safe === 'premium') return 'premium'
  if (safe === 'plus') return 'premium'
  if (safe === 'free') return 'free'
  return safe
}

const PLAN_ORDER = {
  free: 0,
  premium: 1,
  premium_plus: 2,
}

export const planRank = (plan) => {
  const normalized = normalizePlan(plan)
  if (!normalized) return -1
  return PLAN_ORDER[normalized] ?? -1
}

const parseList = (value) =>
  String(value || '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)

const PREMIUM_PLUS_EMAILS = new Set(parseList(process.env.PREMIUM_PLUS_EMAILS))
const PREMIUM_PLUS_DOMAINS = new Set(parseList(process.env.PREMIUM_PLUS_DOMAINS))
const PREMIUM_PLUS_USER_IDS = new Set(parseList(process.env.PREMIUM_PLUS_USER_IDS))

export const isPremiumOverride = ({ email, userId }) => {
  const normalizedEmail = String(email || '').trim().toLowerCase()
  if (userId && PREMIUM_PLUS_USER_IDS.has(String(userId))) return true
  if (!normalizedEmail) return false
  if (PREMIUM_PLUS_EMAILS.has(normalizedEmail)) return true
  const domain = normalizedEmail.split('@')[1]
  return Boolean(domain && PREMIUM_PLUS_DOMAINS.has(domain))
}

export const resolvePlan = ({ profilePlan, authPlan, isSubscribed }) => {
  const candidates = []
  const addCandidate = (plan) => {
    const normalized = normalizePlan(plan)
    if (normalized) candidates.push(normalized)
  }
  addCandidate(profilePlan)
  if (Array.isArray(authPlan)) {
    authPlan.forEach(addCandidate)
  } else {
    addCandidate(authPlan)
  }
  candidates.push(isSubscribed ? 'premium' : 'free')
  let best = candidates[0] || 'free'
  let bestRank = planRank(best)
  for (const candidate of candidates) {
    const rank = planRank(candidate)
    if (rank > bestRank) {
      best = candidate
      bestRank = rank
    }
  }
  return best
}

export const isHigherPlan = (nextPlan, currentPlan) => planRank(nextPlan) > planRank(currentPlan)

export const resolvePlanForUser = ({ profilePlan, authPlan, isSubscribed, email, userId }) => {
  if (isPremiumOverride({ email, userId })) return 'premium_plus'
  return resolvePlan({ profilePlan, authPlan, isSubscribed })
}
