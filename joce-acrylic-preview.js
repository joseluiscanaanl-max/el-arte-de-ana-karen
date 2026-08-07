(() => {
  'use strict'

  const SECTION_ID = 'ak-joce-acrylic-preview'
  const STYLE_ID = 'ak-joce-acrylic-preview-style'
  const ENDPOINT = window.JOCE_AI_ENDPOINT || '/api/joce-acrylic'
  const PRESETS = [
    {
      key: 'simple',
      label: 'Fondo sencillo',
      background: 'Sencillo',
      description: 'Pintura acrílica simple, con formas amplias y muy poco detalle en el entorno.',
    },
    {
      key: 'medium',
      label: 'Fondo medio',
      background: 'Detallado',
      description: 'Estilo acrílico aprobado con detalle equilibrado y natural.',
    },
    {
      key: 'detailed',
      label: 'Fondo detallado',
      background: 'Muy detallado',
      description: 'El mismo estilo aprobado, conservando más elementos reconocibles del entorno.',
    },
  ]

  let selectedKey = 'medium'
  let lastSignature = ''
  let renderSequence = 0
  let timer = null
  let activeController = null

  const injectStyles = () => {
    if (document.getElementById(STYLE_ID)) return
    const style = document.createElement('style')
    style.id = STYLE_ID
    style.textContent = `
      .ak-acrylic-preview { display:grid; gap:12px; padding-top:2px; }
      .ak-acrylic-preview__head h4 { margin:0; color:var(--purple-900); font-size:1.08rem; }
      .ak-acrylic-preview__head p { margin:5px 0 0; color:var(--muted); line-height:1.45; }
      .ak-acrylic-preview__grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:10px; }
      .ak-acrylic-card { position:relative; display:grid; gap:8px; min-width:0; padding:10px; border:2px solid var(--line); border-radius:18px; background:#fffaff; color:var(--purple-900); text-align:left; transition:.18s ease; cursor:pointer; }
      .ak-acrylic-card:hover { transform:translateY(-1px); border-color:#dca0d0; }
      .ak-acrylic-card.is-selected { border-color:var(--pink-600); background:linear-gradient(145deg,#fffaff,#fdf0fa); box-shadow:0 10px 24px rgba(226,31,151,.13); }
      .ak-acrylic-card__media { position:relative; overflow:hidden; border-radius:13px; background:#f3eaf6; }
      .ak-acrylic-card canvas { display:block; width:100%; aspect-ratio:3/2; border-radius:13px; background:#f3eaf6; object-fit:cover; }
      .ak-acrylic-card__status { position:absolute; inset:0; display:grid; place-items:center; padding:16px; background:linear-gradient(145deg,rgba(255,250,255,.94),rgba(247,231,247,.94)); color:#684979; text-align:center; font-size:.76rem; font-weight:900; line-height:1.4; }
      .ak-acrylic-card__status[hidden] { display:none; }
      .ak-acrylic-card__status.is-loading::before { content:''; width:25px; height:25px; margin-bottom:8px; border:3px solid #e8b9dd; border-top-color:var(--pink-600); border-radius:50%; animation:akAiSpin .8s linear infinite; }
      .ak-acrylic-card__status.is-loading { align-content:center; gap:2px; }
      @keyframes akAiSpin { to { transform:rotate(360deg); } }
      .ak-acrylic-card__label { color:var(--pink-600); font-size:.72rem; font-weight:900; letter-spacing:.05em; text-transform:uppercase; }
      .ak-acrylic-card__description { color:var(--muted); font-size:.78rem; line-height:1.38; }
      .ak-acrylic-card__check { position:absolute; top:17px; right:17px; z-index:3; display:none; width:25px; height:25px; place-items:center; border-radius:50%; background:var(--pink-600); color:#fff; font-weight:900; box-shadow:0 5px 15px rgba(226,31,151,.25); }
      .ak-acrylic-card.is-selected .ak-acrylic-card__check { display:grid; }
      .ak-acrylic-preview__selection { display:grid; grid-template-columns:1fr auto; align-items:center; gap:10px; padding:12px 13px; border-radius:15px; background:#fbf2fa; color:#51396a; }
      .ak-acrylic-preview__selection strong { color:var(--purple-900); }
      .ak-acrylic-preview__use,.ak-acrylic-preview__retry { min-height:42px; padding:9px 15px; border:0; border-radius:12px; background:linear-gradient(135deg,var(--purple-700),var(--pink-600)); color:#fff; font:inherit; font-weight:900; cursor:pointer; }
      .ak-acrylic-preview__retry { display:none; width:max-content; background:#fff; color:var(--purple-800); border:1px solid #dca0d0; }
      .ak-acrylic-preview.has-error .ak-acrylic-preview__retry { display:block; }
      .ak-acrylic-preview__note { margin:0; color:var(--muted); font-size:.76rem; line-height:1.4; }
      @media (max-width:760px) { .ak-acrylic-preview__grid { grid-template-columns:1fr; } }
      @media (max-width:520px) { .ak-acrylic-preview__selection { grid-template-columns:1fr; } .ak-acrylic-preview__use { width:100%; } }
    `
    document.head.appendChild(style)
  }

  const presetFromBackground = (value) => {
    const normalized = String(value || '').toLowerCase()
    if (normalized.includes('muy')) return 'detailed'
    if (normalized.includes('detall')) return 'medium'
    return 'simple'
  }

  const selectedPreset = () => PRESETS.find((preset) => preset.key === selectedKey) || PRESETS[1]

  const updateSelection = () => {
    const section = document.getElementById(SECTION_ID)
    if (!section) return
    section.querySelectorAll('[data-ak-acrylic-key]').forEach((card) => {
      const selected = card.dataset.akAcrylicKey === selectedKey
      card.classList.toggle('is-selected', selected)
      card.setAttribute('aria-pressed', selected ? 'true' : 'false')
    })
    const label = section.querySelector('[data-ak-acrylic-selection]')
    if (label) label.innerHTML = `Vista seleccionada: <strong>${selectedPreset().label}</strong>`
  }

  const applySelected = () => {
    const form = document.getElementById('quote-form')
    const preset = selectedPreset()
    const field = form?.elements?.background
    if (!form || !field || !preset) return

    field.value = preset.background
    field.dispatchEvent(new Event('change', { bubbles:true }))

    const result = document.getElementById('ak-analysis-result')
    const backgroundArticle = [...(result?.querySelectorAll('.ak-analysis-grid article') || [])].find((article) =>
      article.querySelector('span')?.textContent?.trim().toLowerCase().startsWith('fondo')
    )
    const strong = backgroundArticle?.querySelector('strong')
    if (strong) strong.textContent = preset.background

    const status = document.getElementById('ak-analysis-status')
    if (status) status.textContent = `${preset.label} aplicado. JOCE actualizará horas y precio según este nivel de detalle.`
  }

  const statusFor = (section, key) => section.querySelector(`[data-ak-ai-status="${key}"]`)
  const canvasFor = (section, key) => section.querySelector(`[data-ak-acrylic-canvas="${key}"]`)

  const setStatus = (section, key, message, mode = 'loading') => {
    const status = statusFor(section, key)
    if (!status) return
    status.hidden = false
    status.className = `ak-acrylic-card__status${mode === 'loading' ? ' is-loading' : ''}`
    status.textContent = message
  }

  const clearStatus = (section, key) => {
    const status = statusFor(section, key)
    if (status) status.hidden = true
  }

  const paintPlaceholder = (canvas) => {
    canvas.width = 900
    canvas.height = 600
    const context = canvas.getContext('2d')
    const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height)
    gradient.addColorStop(0, '#fff8ff')
    gradient.addColorStop(1, '#f1def0')
    context.fillStyle = gradient
    context.fillRect(0, 0, canvas.width, canvas.height)
  }

  const loadImage = (source) => new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('No fue posible abrir la imagen generada.'))
    image.src = source
  })

  const drawGenerated = async (canvas, source) => {
    const image = await loadImage(source)
    canvas.width = image.naturalWidth || image.width
    canvas.height = image.naturalHeight || image.height
    canvas.style.setProperty('--ak-photo-aspect', `${canvas.width}/${canvas.height}`)
    const context = canvas.getContext('2d')
    context.clearRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
  }

  const compressImage = (image, maxSide = 1536, quality = 0.84) => {
    const widthSource = image.naturalWidth || image.width
    const heightSource = image.naturalHeight || image.height
    const ratio = Math.min(1, maxSide / Math.max(widthSource, heightSource))
    const width = Math.max(1, Math.round(widthSource * ratio))
    const height = Math.max(1, Math.round(heightSource * ratio))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    context.drawImage(image, 0, 0, width, height)
    return canvas.toDataURL('image/jpeg', quality)
  }

  const compressDataUrl = async (source) => compressImage(await loadImage(source), 1400, 0.80)

  const requestVariant = async ({ variant, image, styleReference, signal }) => {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ variant, image, styleReference:styleReference || undefined }),
      signal,
    })

    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(payload.error || 'No fue posible generar la vista con IA.')
    if (!payload.image) throw new Error('La IA no devolvió una imagen.')
    return payload.image
  }

  const generatePreviews = async (image, section, sequence) => {
    activeController?.abort()
    activeController = new AbortController()
    const { signal } = activeController

    section.classList.remove('has-error')
    PRESETS.forEach((preset) => {
      paintPlaceholder(canvasFor(section, preset.key))
      setStatus(section, preset.key, preset.key === 'medium' ? 'Creando el estilo acrílico aprobado…' : 'Esperando la referencia de estilo…')
    })

    try {
      const original = compressImage(image)
      const medium = await requestVariant({ variant:'medium', image:original, signal })
      if (sequence !== renderSequence) return

      await drawGenerated(canvasFor(section, 'medium'), medium)
      clearStatus(section, 'medium')

      const styleReference = await compressDataUrl(medium)
      setStatus(section, 'simple', 'Simplificando únicamente el fondo…')
      setStatus(section, 'detailed', 'Agregando detalle únicamente al fondo…')

      const results = await Promise.allSettled([
        requestVariant({ variant:'simple', image:original, styleReference, signal }),
        requestVariant({ variant:'detailed', image:original, styleReference, signal }),
      ])
      if (sequence !== renderSequence) return

      const pairs = [
        ['simple', results[0]],
        ['detailed', results[1]],
      ]

      for (const [key, result] of pairs) {
        if (result.status === 'fulfilled') {
          await drawGenerated(canvasFor(section, key), result.value)
          clearStatus(section, key)
        } else {
          setStatus(section, key, result.reason?.message || 'No se pudo generar esta opción.', 'error')
          section.classList.add('has-error')
        }
      }

      document.dispatchEvent(new CustomEvent('ak:acrylic-ai-ready', { detail:{ sectionId:SECTION_ID } }))
    } catch (error) {
      if (error?.name === 'AbortError') return
      PRESETS.forEach((preset) => setStatus(section, preset.key, error?.message || 'No fue posible generar las vistas.', 'error'))
      section.classList.add('has-error')
    }
  }

  const renderSection = (image) => {
    injectStyles()
    const result = document.getElementById('ak-analysis-result')
    const form = document.getElementById('quote-form')
    if (!result || !form) return

    let section = document.getElementById(SECTION_ID)
    if (!section) {
      section = document.createElement('section')
      section.id = SECTION_ID
      section.className = 'ak-acrylic-preview'
      const sizes = document.getElementById('ak-joce-canvas-sizes')
      const notes = result.querySelector('.ak-joce-notes')
      if (sizes?.nextSibling) result.insertBefore(section, sizes.nextSibling)
      else if (notes) result.insertBefore(section, notes)
      else result.appendChild(section)
    }

    selectedKey = presetFromBackground(form.elements?.background?.value)
    section.innerHTML = `
      <div class="ak-acrylic-preview__head">
        <h4>Vista previa con IA</h4>
        <p>JOCE conserva la fotografía original y el estilo acrílico sencillo aprobado. Solo cambia la complejidad del fondo.</p>
      </div>
      <div class="ak-acrylic-preview__grid">
        ${PRESETS.map((preset) => `
          <button class="ak-acrylic-card" type="button" data-ak-acrylic-key="${preset.key}" aria-pressed="false">
            <span class="ak-acrylic-card__check">✓</span>
            <span class="ak-acrylic-card__media">
              <canvas data-ak-acrylic-canvas="${preset.key}" aria-label="Simulación ${preset.label}"></canvas>
              <span class="ak-acrylic-card__status is-loading" data-ak-ai-status="${preset.key}">Preparando…</span>
            </span>
            <strong class="ak-acrylic-card__label">${preset.label}</strong>
            <span class="ak-acrylic-card__description">${preset.description}</span>
          </button>
        `).join('')}
      </div>
      <div class="ak-acrylic-preview__selection">
        <span data-ak-acrylic-selection></span>
        <button class="ak-acrylic-preview__use" type="button" data-ak-use-acrylic>Usar esta vista</button>
      </div>
      <button class="ak-acrylic-preview__retry" type="button" data-ak-retry-ai>Volver a intentar</button>
      <p class="ak-acrylic-preview__note">La generación puede tardar hasta dos minutos por etapa. La obra final será pintada a mano por Ana Karen.</p>
    `

    updateSelection()
    const sequence = ++renderSequence
    generatePreviews(image, section, sequence)
  }

  const ensure = () => {
    const result = document.getElementById('ak-analysis-result')
    const image = document.getElementById('ak-photo-preview')
    if (!result?.classList.contains('is-visible') || !image?.naturalWidth || !image?.naturalHeight) return
    const signature = `${image.currentSrc || image.src}|${image.naturalWidth}x${image.naturalHeight}|ai-v1`
    if (signature === lastSignature && document.getElementById(SECTION_ID)) return
    lastSignature = signature
    renderSection(image)
  }

  const schedule = (delay = 180) => {
    clearTimeout(timer)
    timer = setTimeout(ensure, delay)
  }

  document.addEventListener('click', (event) => {
    const card = event.target.closest?.('[data-ak-acrylic-key]')
    if (card) {
      selectedKey = card.dataset.akAcrylicKey || 'medium'
      updateSelection()
      return
    }

    if (event.target.closest?.('[data-ak-use-acrylic]')) {
      applySelected()
      return
    }

    if (event.target.closest?.('[data-ak-retry-ai]')) {
      const image = document.getElementById('ak-photo-preview')
      const section = document.getElementById(SECTION_ID)
      if (image?.naturalWidth && section) generatePreviews(image, section, ++renderSequence)
    }
  })

  document.addEventListener('change', (event) => {
    if (event.target?.id === 'ak-reference-photo') {
      activeController?.abort()
      lastSignature = ''
      schedule(260)
    }
  })

  injectStyles()
  setInterval(ensure, 900)
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensure, { once:true })
  else ensure()
})()
