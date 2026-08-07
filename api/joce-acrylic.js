'use strict'

const OPENAI_URL = 'https://api.openai.com/v1/responses'
const MAX_IMAGE_LENGTH = 6_000_000

const VARIANTS = {
  medium: `Fondo medio: conserva el centro comercial y las plantas de forma reconocible, pero simplificados con detalle equilibrado. El fondo acompaña a las personas sin competir con ellas.`,
  simple: `Fondo sencillo: reduce únicamente el entorno a formas amplias, limpias y fáciles de pintar. Usa menos hojas, menos arquitectura, menos personas lejanas y ningún texto legible. Mantén intactas las dos personas principales, su ropa, los helados, las expresiones y el encuadre.`,
  detailed: `Fondo detallado: conserva más elementos reconocibles del centro comercial, las plantas, luces y profundidad, pero sigue siendo una pintura acrílica sencilla y artesanal. No aumentes el detalle de los rostros ni cambies a las personas principales.`,
}

const isDataImage = (value) =>
  typeof value === 'string' && /^data:image\/(?:jpeg|jpg|png|webp);base64,/i.test(value)

const allowedOrigin = (origin) => {
  if (!origin) return true
  const configured = String(process.env.JOCE_ALLOWED_ORIGIN || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

  if (configured.includes(origin)) return true
  if (origin === 'https://joseluiscanaanl-max.github.io') return true
  return /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin)
}

const setCors = (req, res) => {
  const origin = req.headers.origin || ''
  if (allowedOrigin(origin) && origin) res.setHeader('Access-Control-Allow-Origin', origin)
  res.setHeader('Vary', 'Origin')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Cache-Control', 'no-store, max-age=0')
}

const readBody = (req) => {
  if (req.body && typeof req.body === 'object') return req.body
  if (typeof req.body === 'string') return JSON.parse(req.body)
  return {}
}

const promptFor = (variant, hasStyleReference) => `
Transforma la primera imagen de referencia en una pintura acrílica sencilla hecha a mano sobre lienzo.

REGLA FIJA APROBADA:
- Conserva exactamente a las mismas dos personas, identidad facial, edad aparente, lentes, sonrisas, cabello, ropa, helados, postura, proporciones, ángulo de cámara y recorte general.
- No agregues ni elimines personas principales, manos, objetos o accesorios.
- Las personas deben verse claramente pintadas con acrílico, no como una fotografía con filtro.
- Usa formas simples, pinceladas opacas visibles, textura sutil de lienzo, acabado mate y colores cálidos naturales.
- Mantén rostros reconocibles y amables, pero con simplificación artesanal.
- Evita fotorrealismo, desenfoque, pixelado, acuarela, óleo con impasto excesivo, caricatura, ilustración digital y texto inventado.
- Composición horizontal de retrato familiar, cercana a la fotografía original.
${hasStyleReference ? '- La segunda imagen es la referencia exacta del estilo aprobado. Conserva lo más posible el tratamiento de las personas y modifica únicamente la complejidad del fondo.' : ''}

${VARIANTS[variant]}
`

module.exports = async function handler(req, res) {
  setCors(req, res)

  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido.' })

  const origin = req.headers.origin || ''
  if (!allowedOrigin(origin)) return res.status(403).json({ error: 'Origen no autorizado.' })

  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({ error: 'La clave privada de IA todavía no está configurada.' })
  }

  let body
  try {
    body = readBody(req)
  } catch {
    return res.status(400).json({ error: 'Solicitud inválida.' })
  }

  const variant = Object.prototype.hasOwnProperty.call(VARIANTS, body.variant) ? body.variant : 'medium'
  const image = body.image
  const styleReference = body.styleReference

  if (!isDataImage(image)) return res.status(400).json({ error: 'Falta una imagen válida.' })
  if (image.length > MAX_IMAGE_LENGTH) return res.status(413).json({ error: 'La imagen es demasiado grande.' })
  if (styleReference && (!isDataImage(styleReference) || styleReference.length > MAX_IMAGE_LENGTH)) {
    return res.status(400).json({ error: 'La referencia de estilo no es válida.' })
  }

  const content = [
    { type: 'input_text', text: promptFor(variant, Boolean(styleReference)) },
    { type: 'input_image', image_url: image, detail: 'high' },
  ]

  if (styleReference) content.push({ type: 'input_image', image_url: styleReference, detail: 'high' })

  let openaiResponse
  try {
    openaiResponse = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5.6',
        input: [{ role: 'user', content }],
        tools: [
          {
            type: 'image_generation',
            quality: 'medium',
            size: '1536x1024',
          },
        ],
      }),
    })
  } catch {
    return res.status(502).json({ error: 'No fue posible conectar con el servicio de IA.' })
  }

  const payload = await openaiResponse.json().catch(() => ({}))
  if (!openaiResponse.ok) {
    const message = payload?.error?.message || 'El servicio de IA rechazó la solicitud.'
    return res.status(openaiResponse.status).json({ error: message })
  }

  const call = Array.isArray(payload.output)
    ? payload.output.find((item) => item?.type === 'image_generation_call' && item.result)
    : null

  if (!call?.result) return res.status(502).json({ error: 'La IA no devolvió una imagen.' })

  return res.status(200).json({
    variant,
    image: `data:image/png;base64,${call.result}`,
    responseId: payload.id || null,
  })
}
