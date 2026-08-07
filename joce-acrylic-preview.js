(() => {
  'use strict'

  const SECTION_ID = 'ak-joce-acrylic-preview'
  const STYLE_ID = 'ak-joce-acrylic-preview-style'
  const PRESETS = [
    {
      key: 'simple',
      label: 'Fondo sencillo',
      background: 'Sencillo',
      description: 'Simple, limpio y con muy pocos detalles en el fondo.',
    },
    {
      key: 'medium',
      label: 'Fondo medio',
      background: 'Detallado',
      description: 'Fondo equilibrado, suave y todavía sencillo.',
    },
    {
      key: 'detailed',
      label: 'Fondo detallado',
      background: 'Muy detallado',
      description: 'Conserva más del entorno sin perder el estilo acrílico sencillo.',
    },
  ]

  let selectedKey = 'simple'
  let lastSignature = ''
  let timer = null
  let generationId = 0

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
      .ak-acrylic-card canvas { display:block; width:100%; aspect-ratio:var(--ak-photo-aspect,4/3); border-radius:13px; background:#f3eaf6; object-fit:contain; }
      .ak-acrylic-card__label { color:var(--pink-600); font-size:.72rem; font-weight:900; letter-spacing:.05em; text-transform:uppercase; }
      .ak-acrylic-card__description { color:var(--muted); font-size:.78rem; line-height:1.38; }
      .ak-acrylic-card__status { min-height:18px; color:#8a6b92; font-size:.7rem; line-height:1.25; }
      .ak-acrylic-card[data-state="loading"] .ak-acrylic-card__status::before { content:'✦ '; color:var(--pink-600); }
      .ak-acrylic-card[data-state="error"] .ak-acrylic-card__status { color:#a03c57; }
      .ak-acrylic-card__check { position:absolute; top:17px; right:17px; display:none; width:25px; height:25px; place-items:center; border-radius:50%; background:var(--pink-600); color:#fff; font-weight:900; box-shadow:0 5px 15px rgba(226,31,151,.25); }
      .ak-acrylic-card.is-selected .ak-acrylic-card__check { display:grid; }
      .ak-acrylic-preview__selection { display:grid; grid-template-columns:1fr auto; align-items:center; gap:10px; padding:12px 13px; border-radius:15px; background:#fbf2fa; color:#51396a; }
      .ak-acrylic-preview__selection strong { color:var(--purple-900); }
      .ak-acrylic-preview__use { min-height:42px; padding:9px 15px; border:0; border-radius:12px; background:linear-gradient(135deg,var(--purple-700),var(--pink-600)); color:#fff; font:inherit; font-weight:900; cursor:pointer; }
      .ak-acrylic-preview__use:disabled { opacity:.45; cursor:not-allowed; }
      .ak-acrylic-preview__note { margin:0; color:var(--muted); font-size:.76rem; line-height:1.4; }
      @media (max-width:760px) { .ak-acrylic-preview__grid { grid-template-columns:1fr; } }
      @media (max-width:520px) { .ak-acrylic-preview__selection { grid-template-columns:1fr; } .ak-acrylic-preview__use { width:100%; } }
    `
    document.head.appendChild(style)
  }

  const endpoint = () => {
    if (window.JOCE_AI_ENDPOINT) return String(window.JOCE_AI_ENDPOINT).replace(/\/$/, '')
    if (location.hostname.endsWith('.vercel.app')) return '/api/joce-acrylic'
    return ''
  }

  const presetFromBackground = (value) => {
    const normalized = String(value || '').toLowerCase()
    if (normalized.includes('muy')) return 'detailed'
    if (normalized.includes('detall')) return 'medium'
    return 'simple'
  }

  const selectedPreset = () => PRESETS.find((preset) => preset.key === selectedKey) || PRESETS[0]

  const updateSelection = () => {
    const section = document.getElementById(SECTION_ID)
    if (!section) return
    section.querySelectorAll('[data-ak-acrylic-key]').forEach((card) => {
      const active = card.dataset.akAcrylicKey === selectedKey
      card.classList.toggle('is-selected', active)
      card.setAttribute('aria-pressed', active ? 'true' : 'false')
    })
    const preset = selectedPreset()
    const label = section.querySelector('[data-ak-acrylic-selection]')
    if (label) label.innerHTML = `Vista seleccionada: <strong>${preset.label}</strong>`
    const use = section.querySelector('[data-ak-use-acrylic]')
    const activeCanvas = section.querySelector(`[data-ak-acrylic-canvas="${selectedKey}"]`)
    if (use) use.disabled = !activeCanvas?.dataset.aiReady
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
    if (status) status.textContent = `${preset.label} aplicado. JoCe actualizará horas y precio según este nivel de detalle.`
  }

  const resizePhoto = (image) => {
    const maxSide = 1536
    const ratio = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight))
    const width = Math.max(1, Math.round(image.naturalWidth * ratio))
    const height = Math.max(1, Math.round(image.naturalHeight * ratio))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    context.drawImage(image, 0, 0, width, height)
    return {
      dataUrl: canvas.toDataURL('image/jpeg', .88),
      orientation: height > width ? 'portrait' : 'landscape',
      width,
      height,
    }
  }

  const drawPlaceholder = (canvas, image, text = 'Preparando vista con IA…') => {
    const maxSide = 720
    const ratio = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight))
    const width = Math.max(1, Math.round(image.naturalWidth * ratio))
    const height = Math.max(1, Math.round(image.naturalHeight * ratio))
    canvas.width = width
    canvas.height = height
    canvas.style.setProperty('--ak-photo-aspect', `${width}/${height}`)
    const context = canvas.getContext('2d')
    context.drawImage(image, 0, 0, width, height)
    context.save()
    context.fillStyle = 'rgba(255,248,253,.78)'
    context.fillRect(0, 0, width, height)
    context.fillStyle = '#6b3974'
    context.font = `700 ${Math.max(15, Math.round(width * .028))}px system-ui, sans-serif`
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillText(text, width / 2, height / 2)
    context.restore()
  }

  const drawDataUrl = (canvas, dataUrl) => new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      canvas.width = image.naturalWidth
      canvas.height = image.naturalHeight
      canvas.style.setProperty('--ak-photo-aspect', `${image.naturalWidth}/${image.naturalHeight}`)
      const context = canvas.getContext('2d')
      context.clearRect(0, 0, canvas.width, canvas.height)
      context.drawImage(image, 0, 0)
      canvas.dataset.aiReady = 'true'
      resolve()
    }
    image.onerror = reject
    image.src = dataUrl
  })

  const generateVariant = async ({ section, photo, prepared, preset, id }) => {
    const card = section.querySelector(`[data-ak-acrylic-key="${preset.key}"]`)
    const canvas = section.querySelector(`[data-ak-acrylic-canvas="${preset.key}"]`)
    const status = card?.querySelector('.ak-acrylic-card__status')
    if (!card || !canvas) return

    card.dataset.state = 'loading'
    if (status) status.textContent = 'JOCE está pintando esta opción…'
    drawPlaceholder(canvas, photo)

    const target = endpoint()
    if (!target) {
      card.dataset.state = 'error'
      if (status) status.textContent = 'La IA estará disponible en la versión segura de Vercel.'
      drawPlaceholder(canvas, photo, 'IA pendiente de conexión')
      return
    }

    try {
      const response = await fetch(target, {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({
          imageDataUrl: prepared.dataUrl,
          orientation: prepared.orientation,
          variant: preset.key,
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok || !payload.dataUrl) throw new Error(payload.message || 'No fue posible generar la imagen.')
      if (id !== generationId) return
      await drawDataUrl(canvas, payload.dataUrl)
      card.dataset.state = 'ready'
      if (status) status.textContent = 'Vista con IA lista.'
      updateSelection()
    } catch (error) {
      if (id !== generationId) return
      card.dataset.state = 'error'
      if (status) status.textContent = error?.message || 'No fue posible generar esta opción.'
      drawPlaceholder(canvas, photo, 'No se pudo generar')
    }
  }

  const generateAll = async (section, photo) => {
    const id = ++generationId
    const prepared = resizePhoto(photo)
    await Promise.allSettled(PRESETS.map((preset) => generateVariant({ section, photo, prepared, preset, id })))
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
        <h4>Vista previa del cuadro con IA</h4>
        <p>JOCE conserva la fotografía y propone el estilo fijo aprobado: acrílico sencillo sobre lienzo.</p>
      </div>
      <div class="ak-acrylic-preview__grid">
        ${PRESETS.map((preset) => `
          <button class="ak-acrylic-card" type="button" data-ak-acrylic-key="${preset.key}" aria-pressed="false" data-state="loading">
            <span class="ak-acrylic-card__check">✓</span>
            <canvas data-ak-acrylic-canvas="${preset.key}" aria-label="Simulación ${preset.label}"></canvas>
            <strong class="ak-acrylic-card__label">${preset.label}</strong>
            <span class="ak-acrylic-card__description">${preset.description}</span>
            <span class="ak-acrylic-card__status">Preparando…</span>
          </button>
        `).join('')}
      </div>
      <div class="ak-acrylic-preview__selection">
        <span data-ak-acrylic-selection></span>
        <button class="ak-acrylic-preview__use" type="button" data-ak-use-acrylic disabled>Usar esta vista</button>
      </div>
      <p class="ak-acrylic-preview__note">Vista orientativa generada con IA. La obra final será pintada a mano por Ana Karen y conservará su interpretación artística.</p>
    `

    PRESETS.forEach((preset) => {
      const canvas = section.querySelector(`[data-ak-acrylic-canvas="${preset.key}"]`)
      if (canvas) drawPlaceholder(canvas, image)
    })
    updateSelection()
    generateAll(section, image)
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
      selectedKey = card.dataset.akAcrylicKey || 'simple'
      updateSelection()
      return
    }
    if (event.target.closest?.('[data-ak-use-acrylic]')) applySelected()
  })

  document.addEventListener('change', (event) => {
    if (event.target?.id === 'ak-reference-photo') {
      generationId += 1
      lastSignature = ''
      schedule(260)
    }
  })

  injectStyles()
  setInterval(ensure, 900)
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensure, { once:true })
  else ensure()
})()
