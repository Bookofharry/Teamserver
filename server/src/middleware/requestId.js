import crypto from 'crypto'
import logger from '../utils/logger.js'

const HEADER_NAME = 'x-request-id'

export const requestIdMiddleware = (req, res, next) => {
  const incoming = req.get(HEADER_NAME)
  const id = incoming && String(incoming).trim() ? String(incoming).trim() : (crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex'))
  req.requestId = id
  res.setHeader(HEADER_NAME, id)

  // attach request-scoped logger
  try {
    req.log = logger.child({ requestId: id })
    res.log = req.log
  } catch (e) {
    req.log = logger
    res.log = logger
  }

  next()
}

export default requestIdMiddleware
