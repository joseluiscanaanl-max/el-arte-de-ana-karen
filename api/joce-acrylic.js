export const config = { maxDuration: 60 }

const SPACE = 'https://akhaliq-qwen-image-edit-2511-lightning.hf.space'

const VARIANTS = {
  simple: 'Simplify the background strongly. Use broad calm shapes, very few small details, soft warm natural colors, and keep only the main plants and large architectural masses.',
  medium: 'Keep a balanced simple background. Preserve recognizable plants and architecture but simplify small objects and distant people into broad acrylic shapes.',
  detailed: 'Keep more of the recognizable environment and plants, but still simplify all small details so the complete image remains clearly handmade acrylic rather than photographic.',
}

const BASE_PROMPT = `Transform this exact reference photograph into a SIMPLE HAND-PAINTED ACRYLIC PAINTING ON CANVAS.
Preserve the same people, recognizable faces, expressions, pose, clothing, objects in their hands, camera angle, crop and overall composition.
Paint the people themselves in acrylic too: no photographic skin, hair or clothing.
Use broad simple visible brushstrokes, opaque matte acrylic paint, subtle canvas weave, simplified forms, warm natural colors and low visual complexity.
The result must look like a real handmade beginner-to-intermediate acrylic portrait on stretched canvas, not a photo filter, not airbrush, not vector art, not cartoon and not hyperrealism.
Do not beautify, age, de-age, add or remove people, change eyewear, clothes, hands, food or other objects. Do not add text, logos, frames or watermarks.`

const allowCors = (req, res) => {
  const origin = String(req.headers.origin || '')
  const allowed =
    origin === 'https://joseluiscanaanl-max.github.io' ||
    origin.endsWith('.vercel.app') ||
    origin === ''

  if (allowed) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*')
    res.setHeader('Vary', 'Origin')
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

const parseDataUrl = (value) => {
  const match = String(value || '').match(/^data:(image\/(?:jpeg|jpg|png|webp));base64,([A-Za-z0-9+/=]+)$/)
  if (!match) return null
  const mime = match[1] === 'image/jpg' ? 'image/jpeg' : match[1]
  return { mime, buffer: Buffer.from(match[2], 'base64') }
}

const hfHeaders = () => {
  const headers = {}
  if (process.env.HF_TOKEN) headers.Authorization = `Bearer ${process.env.HF_TOKEN}`
  return headers
}

const inferEndpoint = async () => {
  try {
    const response = await fetch(`${SPACE}/gradio_api/info`, { headers: hfHeaders() })
    if (!response.ok) return 'infer'
    const info = await response.json()
    const names = Object.keys(info?.named_endpoints || {})
    const selected = names.find((name) => name.toLowerCase().includes('infer')) || names[0]
    return String(selected || '/infer').replace(/^\//, '')
  } catch {
    return 'infer'
  }
}

const uploadImage = async (parsed) => {
  const extension = parsed.mime === 'image/png' ? 'png' : parsed.mime === 'image/webp' ? 'webp' : 'jpg'
  const form = new FormData()
  form.append('files', new Blob([parsed.buffer], { type: parsed.mime }), `reference.${extension}`)

  const response = await fetch(`${SPACE}/gradio_api/upload`, {
    method: 'POST',
    headers: hfHeaders(),
    body: form,
  })
  if (!response.ok) throw new Error(`hf_upload_${response.status}`)

  const payload = await response.json()
  const path = Array.isArray(payload) ? payload[0] : payload?.files?.[0] || payload?.path
  if (!path) throw new Error('hf_upload_empty')
  return {
    path,
    orig_name: `reference.${extension}`,
    meta: { _type: 'gradio.FileData' },
  }
}

const readCompleteData = (text) => {
  const lines = String(text || '').split(/\r?\n/)
  let lastData = null
  let event = ''
  for (const line of lines) {
    if (line.startsWith('event:')) event = line.slice(6).trim()
    if (line.startsWith('data:')) {
      const raw = line.slice(5).trim()
      if (event === 'complete' || !event) {
        try { lastData = JSON.parse(raw) } catch { /* keep polling result parsing tolerant */ }
      }
    }
  }
  return lastData
}

const resultUrl = (value) => {
  const first = Array.isArray(value) ? value[0] : value
  if (!first) return ''
  if (typeof first === 'string') {
    if (/^https?:\/\//.test(first)) return first
    if (first.startsWith('/')) return `${SPACE}/gradio_api/file=${first}`
    return ''
  }
  if (first.url) return first.url
  if (first.path) return /^https?:\/\//.test(first.path) ? first.path : `${SPACE}/gradio_api/file=${first.path}`
  return ''
}

const generateWithQwen = async (parsed, prompt) => {
  const endpoint = await inferEndpoint()
  const file = await uploadImage(parsed)
  const seed = 24681357

  const submit = await fetch(`${SPACE}/gradio_api/call/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...hfHeaders() },
    body: JSON.stringify({
      data: [file, prompt, seed, false, 1.0, 4],
    }),
  })
  if (!submit.ok) throw new Error(`hf_submit_${submit.status}`)

  const submitted = await submit.json()
  if (!submitted?.event_id) throw new Error('hf_event_missing')

  const result = await fetch(`${SPACE}/gradio_api/call/${endpoint}/${submitted.event_id}`, {
    headers: hfHeaders(),
  })
  if (!result.ok) throw new Error(`hf_result_${result.status}`)

  const completed = readCompleteData(await result.text())
  const url = resultUrl(completed)
  if (!url) throw new Error('hf_image_missing')

  const imageResponse = await fetch(url, { headers: hfHeaders() })
  if (!imageResponse.ok) throw new Error(`hf_file_${imageResponse.status}`)
  const mime = imageResponse.headers.get('content-type') || 'image/png'
  const buffer = Buffer.from(await imageResponse.arrayBuffer())
  return `data:${mime};base64,${buffer.toString('base64')}`
}

export default async function handler(req, res) {
  allowCors(req, res)

  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' })

  const { imageDataUrl, variant = 'simple' } = req.body || {}
  const parsed = parseDataUrl(imageDataUrl)
  if (!parsed) return res.status(400).json({ error: 'invalid_image' })
  if (parsed.buffer.length > 4_500_000) return res.status(413).json({ error: 'image_too_large' })

  const variantPrompt = VARIANTS[variant] || VARIANTS.simple
  const prompt = `${BASE_PROMPT}\n\nBACKGROUND OPTION: ${variantPrompt}`

  try {
    const dataUrl = await generateWithQwen(parsed, prompt)
    res.setHeader('Cache-Control', 'no-store')
    return res.status(200).json({ variant, provider: 'huggingface-qwen-lightning', dataUrl })
  } catch (error) {
    console.error('JOCE Hugging Face acrylic endpoint error', error)
    const code = String(error?.message || '')
    const quota = code.includes('429') || code.includes('quota')
    return res.status(quota ? 429 : 502).json({
      error: quota ? 'free_quota_exhausted' : 'service_unavailable',
      message: quota
        ? 'La cuota gratuita de IA está ocupada o agotada por ahora. Intenta de nuevo más tarde.'
        : 'La IA gratuita no respondió en este momento. Intenta nuevamente.',
    })
  }
}
