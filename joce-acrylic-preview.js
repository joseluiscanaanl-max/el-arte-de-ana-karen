(() => {
  'use strict'

  const SECTION_ID = 'ak-joce-acrylic-preview'
  const STYLE_ID = 'ak-joce-acrylic-preview-style'
  const PRESETS = [
    {
      key: 'simple',
      label: 'Fondo sencillo',
      background: 'Sencillo',
      description: 'Pinceladas amplias y menos detalle para destacar a los protagonistas.',
      scale: 0.42,
      levels: 14,
      saturation: 1.02,
      contrast: 1.04,
      strokes: 420,
    },
    {
      key: 'medium',
      label: 'Fondo medio',
      background: 'Detallado',
      description: 'Equilibrio entre el fondo, las personas y la rapidez de ejecución.',
      scale: 0.68,
      levels: 22,
      saturation: 1.08,
      contrast: 1.07,
      strokes: 720,
    },
    {
      key: 'detailed',
      label: 'Fondo detallado',
      background: 'Muy detallado',
      description: 'Mayor profundidad, textura y cercanía con la fotografía original.',
      scale: 0.92,
      levels: 32,
      saturation: 1.10,
      contrast: 1.09,
      strokes: 1050,
    },
  ]

  let selectedKey = 'medium'
  let lastSignature = ''
  let renderSequence = 0
  let timer = null

  const injectStyles = () => {
    if (document.getElementById(STYLE_ID)) return
    const style = document.createElement('style')
    style.id = STYLE_ID
    style.textContent = `
      .ak-acrylic-preview { display: grid; gap: 12px; padding-top: 2px; }
      .ak-acrylic-preview__head h4 { margin: 0; color: var(--purple-900); font-size: 1.08rem; }
      .ak-acrylic-preview__head p { margin: 5px 0 0; color: var(--muted); line-height: 1.45; }
      .ak-acrylic-preview__grid { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 10px; }
      .ak-acrylic-card { position: relative; display: grid; gap: 8px; min-width: 0; padding: 10px; border: 2px solid var(--line); border-radius: 18px; background: #fffaff; color: var(--purple-900); text-align: left; transition: .18s ease; cursor: pointer; }
      .ak-acrylic-card:hover { transform: translateY(-1px); border-color: #dca0d0; }
      .ak-acrylic-card.is-selected { border-color: var(--pink-600); background: linear-gradient(145deg,#fffaff,#fdf0fa); box-shadow: 0 10px 24px rgba(226,31,151,.13); }
      .ak-acrylic-card canvas { display: block; width: 100%; aspect-ratio: var(--ak-photo-aspect, 4/3); border-radius: 13px; background: #f3eaf6; object-fit: contain; }
      .ak-acrylic-card__label { color: var(--pink-600); font-size: .72rem; font-weight: 900; letter-spacing: .05em; text-transform: uppercase; }
      .ak-acrylic-card__description { color: var(--muted); font-size: .78rem; line-height: 1.38; }
      .ak-acrylic-card__check { position: absolute; top: 17px; right: 17px; display: none; width: 25px; height: 25px; place-items: center; border-radius: 50%; background: var(--pink-600); color: #fff; font-weight: 900; box-shadow: 0 5px 15px rgba(226,31,151,.25); }
      .ak-acrylic-card.is-selected .ak-acrylic-card__check { display: grid; }
      .ak-acrylic-preview__selection { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 10px; padding: 12px 13px; border-radius: 15px; background: #fbf2fa; color: #51396a; }
      .ak-acrylic-preview__selection strong { color: var(--purple-900); }
      .ak-acrylic-preview__use { min-height: 42px; padding: 9px 15px; border: 0; border-radius: 12px; background: linear-gradient(135deg,var(--purple-700),var(--pink-600)); color: #fff; font: inherit; font-weight: 900; cursor: pointer; }
      .ak-acrylic-preview__note { margin: 0; color: var(--muted); font-size: .76rem; line-height: 1.4; }
      @media (max-width: 760px) { .ak-acrylic-preview__grid { grid-template-columns: 1fr; } }
      @media (max-width: 520px) { .ak-acrylic-preview__selection { grid-template-columns: 1fr; } .ak-acrylic-preview__use { width: 100%; } }
    `
    document.head.appendChild(style)
  }

  const hash = (value) => {
    let state = 2166136261
    for (let i = 0; i < value.length; i += 1) {
      state ^= value.charCodeAt(i)
      state = Math.imul(state, 16777619)
    }
    return state >>> 0
  }

  const randomFactory = (seed) => {
    let state = seed || 1
    return () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0
      return state / 4294967296
    }
  }

  const clamp = (value) => Math.max(0, Math.min(255, value))

  const processPixels = (data, preset) => {
    const step = 255 / Math.max(2, preset.levels - 1)
    const contrast = preset.contrast
    const saturation = preset.saturation

    for (let index = 0; index < data.length; index += 4) {
      let red = data[index]
      let green = data[index + 1]
      let blue = data[index + 2]
      const average = (red + green + blue) / 3

      red = average + (red - average) * saturation
      green = average + (green - average) * saturation
      blue = average + (blue - average) * saturation

      red = (red - 128) * contrast + 128
      green = (green - 128) * contrast + 128
      blue = (blue - 128) * contrast + 128

      data[index] = clamp(Math.round(red / step) * step + 3)
      data[index + 1] = clamp(Math.round(green / step) * step + 1)
      data[index + 2] = clamp(Math.round(blue / step) * step - 2)
    }
  }

  const paintStrokes = (ctx, pixels, width, height, preset, seed) => {
    const random = randomFactory(seed)
    const count = Math.min(preset.strokes, Math.round((width * height) / 230))
    ctx.save()
    ctx.globalCompositeOperation = 'soft-light'
    ctx.lineCap = 'round'

    for (let index = 0; index < count; index += 1) {
      const x = Math.floor(random() * width)
      const y = Math.floor(random() * height)
      const pixel = (y * width + x) * 4
      const red = pixels[pixel]
      const green = pixels[pixel + 1]
      const blue = pixels[pixel + 2]
      const angle = (random() - 0.5) * 0.8
      const length = (6 + random() * 18) * (1.15 - preset.scale * 0.35)
      const thickness = 1.2 + random() * (4.4 - preset.scale * 2.2)
      ctx.strokeStyle = `rgba(${red},${green},${blue},${0.12 + random() * 0.16})`
      ctx.lineWidth = thickness
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length)
      ctx.stroke()
    }
    ctx.restore()
  }

  const renderCanvas = (image, canvas, preset, seed) => {
    const maxSide = 640
    const outputScale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight))
    const width = Math.max(1, Math.round(image.naturalWidth * outputScale))
    const height = Math.max(1, Math.round(image.naturalHeight * outputScale))
    const sampleWidth = Math.max(1, Math.round(width * preset.scale))
    const sampleHeight = Math.max(1, Math.round(height * preset.scale))
    const sample = document.createElement('canvas')
    sample.width = sampleWidth
    sample.height = sampleHeight
    const sampleContext = sample.getContext('2d', { willReadFrequently: true })
    sampleContext.imageSmoothingEnabled = true
    sampleContext.imageSmoothingQuality = 'high'
    sampleContext.drawImage(image, 0, 0, sampleWidth, sampleHeight)

    canvas.width = width
    canvas.height = height
    canvas.style.setProperty('--ak-photo-aspect', `${width}/${height}`)
    const context = canvas.getContext('2d', { willReadFrequently: true })
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    context.drawImage(sample, 0, 0, width, height)

    const imageData = context.getImageData(0, 0, width, height)
    processPixels(imageData.data, preset)
    context.putImageData(imageData, 0, 0)
    paintStrokes(context, imageData.data, width, height, preset, seed)
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
      card.classList.toggle('is-selected', card.dataset.akAcrylicKey === selectedKey)
      card.setAttribute('aria-pressed', card.dataset.akAcrylicKey === selectedKey ? 'true' : 'false')
    })
    const preset = selectedPreset()
    const label = section.querySelector('[data-ak-acrylic-selection]')
    if (label) label.innerHTML = `Vista seleccionada: <strong>${preset.label}</strong>`
  }

  const applySelected = () => {
    const form = document.getElementById('quote-form')
    const preset = selectedPreset()
    const field = form?.elements?.background
    if (!form || !field || !preset) return
    field.value = preset.background
    field.dispatchEvent(new Event('change', { bubbles: true }))

    const result = document.getElementById('ak-analysis-result')
    const backgroundArticle = [...(result?.querySelectorAll('.ak-analysis-grid article') || [])].find((article) =>
      article.querySelector('span')?.textContent?.trim().toLowerCase().startsWith('fondo')
    )
    const strong = backgroundArticle?.querySelector('strong')
    if (strong) strong.textContent = preset.background

    const status = document.getElementById('ak-analysis-status')
    if (status) status.textContent = `${preset.label} aplicado. JoCe actualizará horas y precio según este nivel de detalle.`
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
        <h4>Así podría verse en pintura acrílica</h4>
        <p>JoCe prepara tres simulaciones aproximadas con los niveles de fondo disponibles.</p>
      </div>
      <div class="ak-acrylic-preview__grid">
        ${PRESETS.map((preset) => `
          <button class="ak-acrylic-card" type="button" data-ak-acrylic-key="${preset.key}" aria-pressed="false">
            <span class="ak-acrylic-card__check">✓</span>
            <canvas data-ak-acrylic-canvas="${preset.key}" aria-label="Simulación ${preset.label}"></canvas>
            <strong class="ak-acrylic-card__label">${preset.label}</strong>
            <span class="ak-acrylic-card__description">${preset.description}</span>
          </button>
        `).join('')}
      </div>
      <div class="ak-acrylic-preview__selection">
        <span data-ak-acrylic-selection></span>
        <button class="ak-acrylic-preview__use" type="button" data-ak-use-acrylic>Usar esta vista</button>
      </div>
      <p class="ak-acrylic-preview__note">Vista orientativa: el cuadro final será pintado a mano y puede variar en pinceladas, color y detalle.</p>
    `

    const sequence = ++renderSequence
    const baseSeed = hash(`${image.currentSrc || image.src}|${image.naturalWidth}x${image.naturalHeight}`)
    requestAnimationFrame(() => {
      if (sequence !== renderSequence) return
      PRESETS.forEach((preset, index) => {
        const canvas = section.querySelector(`[data-ak-acrylic-canvas="${preset.key}"]`)
        if (canvas) renderCanvas(image, canvas, preset, baseSeed + index * 9973)
      })
      updateSelection()
    })
  }

  const ensure = () => {
    const result = document.getElementById('ak-analysis-result')
    const image = document.getElementById('ak-photo-preview')
    if (!result?.classList.contains('is-visible') || !image?.naturalWidth || !image?.naturalHeight) return
    const signature = `${image.currentSrc || image.src}|${image.naturalWidth}x${image.naturalHeight}`
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
    if (event.target.closest?.('[data-ak-use-acrylic]')) applySelected()
  })

  document.addEventListener('change', (event) => {
    if (event.target?.id === 'ak-reference-photo') {
      lastSignature = ''
      schedule(260)
    }
  })

  injectStyles()
  setInterval(ensure, 900)
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensure, { once: true })
  else ensure()
})()
