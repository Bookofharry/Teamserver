export default function handler(_req, res) {
  res.status(200).json({ status: 'ok', message: 'TeamPad API is live' })
}
