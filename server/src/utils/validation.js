import logger from './logger.js'

export const parseBody = (schema, req, res) => {
  const result = schema.safeParse(req.body || {})
  if (!result.success) {
    const message =
      result.error.issues.map((issue) => issue.message).join(', ') || 'Invalid request'
    res.status(400).json({ error: { code: 'invalid_request', message } })
    return null
  }
  return result.data
}

export const parseOutput = (schema, data) => {
  const result = schema.safeParse(data)
  if (!result.success) {
    logger.warn({ issues: result.error.issues }, 'Invalid response DTO')
    return data
  }
  return result.data
}
