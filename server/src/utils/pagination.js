export const parsePagination = (req, { defaultLimit = 100, maxLimit = 200 } = {}) => {
  const rawLimit = Number.parseInt(req.query?.limit, 10)
  const rawOffset = Number.parseInt(req.query?.offset, 10)

  let limit = Number.isFinite(rawLimit) ? rawLimit : defaultLimit
  if (limit < 1) limit = defaultLimit
  if (limit > maxLimit) limit = maxLimit

  let offset = Number.isFinite(rawOffset) ? rawOffset : 0
  if (offset < 0) offset = 0

  return {
    limit,
    offset,
    from: offset,
    to: offset + limit - 1,
  }
}
