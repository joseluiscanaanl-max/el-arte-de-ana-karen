export const config = { maxDuration: 60 }

const VARIANTS = {
  simple: 'Simplify the background strongly: broad calm shapes, very few small details, soft warm neutral and natural colors. Keep only the main plants and large architectural masses.',
  medium: 'Keep a balanced background: recognizable plants and architecture, but simplify small objects and people into broad acrylic shapes with moderate detail.',
  detailed: 'Keep the background recognizable with somewhat more environmental detail, while still clearly hand-painted, simplified, and less detailed than a photograph.',
}

const BASE_PROMPT = `Transform the supplied reference photograph into a SIMPLE HAND-PAINTED ACRYLIC PAINTING ON CANVAS.

NON-NEGOTIABLE RULES:
- Preserve the same people, facial identity, expressions, pose, clothing, objects they are holding, camera angle, crop, and overall composition.
- The people themselves must visibly look painted in acrylic; never leave photographic skin or photographic clothing.
- Use broad simple visible brushstrokes, opaque matte acrylic paint, subtle canvas weave, simplified shapes, warm natural colors, and low visual complexity.
- The result must look like a real beginner-to-intermediate handmade acrylic portrait on stretched canvas, not a photo filter, not digital airbrush, not vector art, not cartoon, and not hyperrealism.
- Do not beautify, age, de-age, add or remove people, change eyewear, change clothes, change hands, change food/objects, or invent text/logos.
- Keep faces recognizable and natural while reducing tiny photographic details.
- Preserve the original horizontal or vertical composition.
- No decorative frame, no captions, no typography, no watermark.`

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

export default async function handler(req, res) {
  allowCors(req, res)

  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' })

  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({
      error: 'openai_not_configured',
      message: 'Falta configurar OPENAI_API_KEY en Vercel.',
    })
  }

  const { imageDataUrl, variant = 'medium', orientation = 'landscape' } = req.body || {}
  const parsed = parseDataUrl(imageDataUrl)
  if (!parsed) return res.status(400).json({ error: 'invalid_image' })
  if (parsed.buffer.length > 5_500_000) return res.status(413).json({ error: 'image_too_large' })

  const variantPrompt = VARIANTS[variant] || VARIANTS.medium
  const prompt = `${BASE_PROMPT}\n\nBACKGROUND OPTION: ${variantPrompt}`
  const extension = parsed.mime === 'image/png' ? 'png' : parsed.mime === 'image/webp' ? 'webp' : 'jpg'
  const imageBlob = new Blob([parsed.buffer], { type: parsed.mime })
  const form = new FormData()
  form.append('model', 'gpt-image-2')
  form.append('prompt', prompt)
  form.append('image', imageBlob, `reference.${extension}`)
  form.append('quality', 'medium')
  form.append('size', orientation === 'portrait' ? '1024x1536' : '1536x1024')
  form.append('output_format', 'jpeg')

  try {
    const response = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: form,
    })

    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      console.error('OpenAI image edit failed', response.status, payload)
      return res.status(response.status >= 500 ? 502 : 400).json({
        error: 'image_generation_failed',
        message: payload?.error?.message || 'No fue posible generar la vista acrílica.',
      })
    }

    const b64 = payload?.data?.[0]?.b64_json
    if (!b64) return res.status(502).json({ error: 'empty_image_response' })

    res.setHeader('Cache-Control', 'no-store')
    return res.status(200).json({
      variant,
      dataUrl: `data:image/jpeg;base64,${b64}`,
    })
  } catch (error) {
    console.error('JOCE acrylic endpoint error', error)
    return res.status(502).json({ error: 'service_unavailable' })
  }
}
