import { GoogleGenAI, Type } from '@google/genai'

const DEFAULT_CHAT_MODEL = (process.env.GEMINI_CHAT_MODEL || 'gemini-2.0-flash').trim()
const DEFAULT_MAX_TOKENS = Number(process.env.GEMINI_MAX_TOKENS) || 2048

const STRUCTURED_SYSTEM_INSTRUCTION =
  'Return JSON that matches the response schema. ' +
  'If there are no action items or open questions, return empty arrays. ' +
  'If the summary is unknown, return "None."'

const STRUCTURED_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.STRING },
    actionItems: { type: Type.ARRAY, items: { type: Type.STRING } },
    openQuestions: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ['summary', 'actionItems', 'openQuestions'],
}

const getClient = () => new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' })

const safeString = (value) => (typeof value === 'string' ? value.trim() : '')

const normalizeStructuredData = (data, rawText) => {
  if (!data || typeof data !== 'object') {
    return {
      summary: safeString(rawText) || 'None.',
      actionItems: [],
      openQuestions: [],
    }
  }
  return {
    summary: safeString(data.summary) || 'None.',
    actionItems: Array.isArray(data.actionItems) ? data.actionItems.filter(Boolean) : [],
    openQuestions: Array.isArray(data.openQuestions) ? data.openQuestions.filter(Boolean) : [],
  }
}

const formatStructuredData = (data) => {
  const summary = safeString(data.summary) || 'None.'
  const actionItems = data.actionItems.length ? data.actionItems.map((item) => `- ${item}`).join('\n') : 'None.'
  const openQuestions = data.openQuestions.length ? data.openQuestions.map((item) => `- ${item}`).join('\n') : 'None.'
  return `## Summary\n${summary}\n\n## Action Items\n${actionItems}\n\n## Open Questions\n${openQuestions}`
}

const parseResponseText = (response) => {
  if (!response) return ''
  if (typeof response.text === 'string') return response.text
  if (typeof response?.response?.text === 'function') return response.response.text()
  return ''
}

export const generateStructuredAnswer = async (prompt, opts = {}) => {
  const ai = getClient()
  const response = await ai.models.generateContent({
    model: opts.model || DEFAULT_CHAT_MODEL,
    contents: String(prompt),
    config: {
      systemInstruction: opts.systemInstruction || STRUCTURED_SYSTEM_INSTRUCTION,
      responseMimeType: 'application/json',
      responseSchema: STRUCTURED_RESPONSE_SCHEMA,
      generationConfig: { maxOutputTokens: opts.maxTokens || DEFAULT_MAX_TOKENS },
    },
  })

  const rawText = parseResponseText(response)
  let parsed = null
  try {
    parsed = rawText ? JSON.parse(rawText) : null
  } catch (e) {
    parsed = null
  }
  const normalized = normalizeStructuredData(parsed, rawText)
  return {
    text: formatStructuredData(normalized),
    data: normalized,
    raw: rawText,
    response,
  }
}

export async function* streamStructuredAnswer(prompt, opts = {}) {
  const { text } = await generateStructuredAnswer(prompt, opts)
  const chunkSize = 160
  for (let i = 0; i < text.length; i += chunkSize) {
    yield text.slice(i, i + chunkSize)
  }
}
