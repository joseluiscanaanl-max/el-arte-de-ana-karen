(() => {
  'use strict'

  const CARD_ID = 'ak-joce-photo-analysis'
  const STYLE_ID = 'ak-joce-photo-analysis-style'
  const SESSION_KEY = 'ak-joce-reference-v1'
  let analysis = null
  let previewUrl = ''

  const money = (value) => window.AKPricing?.money
    ? window.AKPricing.money(value)
    : new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(Number(value) || 0)

  const num = (form, name, fallback = 0) => {
    const value = Number(form?.elements?.[name]?.value)
    return Number.isFinite(value) ? value : fallback
  }

  const text = (form, name, fallback = '') => String(form?.elements?.[name]?.value ?? fallback)

  const dispatch = (element, type = 'input') => {
    if (!element) return
    element.dispatchEvent(new Event(type, { bubbles: true }))
  }

  const setField = (form, name, value) => {
    const field = form?.elements?.[name]
    if (!field) return
    field.value = value
    dispatch(field, field.tagName === 'SELECT' ? 'change' : 'input')
  }

  const materialRows = (form) => [...(form?.querySelectorAll('.material-row') || [])]
    .map((row) => ({
      name: row.querySelector('.material-name')?.value?.trim() || 'Material',
      cost: Math.max(0, Number(row.querySelector('.material-cost')?.value) || 0),
    }))

  const buildDraft = (form, overrides = {}) => ({
    materials: materialRows(form),
    hours: num(form, 'hours'),
    hourlyRate: num(form, 'hourlyRate'),
    packaging: num(form, 'packaging'),
    shipping: num(form, 'shipping'),
    indirectPercent: num(form, 'indirectPercent'),
    people: num(form, 'people'),
    pets: num(form, 'pets'),
    background: text(form, 'background', 'Sencillo'),
    urgent: Boolean(form?.elements?.urgent?.checked),
    marginPercent: num(form, 'marginPercent'),
    depositPercent: num(form, 'depositPercent'),
    ...overrides,
  })

  const injectStyles = () => {
    if (document.getElementById(STYLE_ID)) return
    const style = document.createElement('style')
    style.id = STYLE_ID
    style.textContent = `
      .ak-joce-card { overflow: hidden; }
      .ak-joce-intro { margin: -4px 0 14px; color: var(--muted); line-height: 1.5; }
      .ak-photo-picker { display: grid; place-items: center; gap: 7px; min-height: 118px; padding: 18px; border: 2px dashed #e7b7de; border-radius: 18px; background: linear-gradient(145deg,#fffaff,#fcedfa); color: var(--purple-700); text-align: center; cursor: pointer; }
      .ak-photo-picker strong { font-size: 1rem; }
      .ak-photo-picker small { color: var(--muted); font-weight: 600; }
      .ak-photo-picker input { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
      .ak-photo-preview { display: none; width: 100%; max-height: 360px; object-fit: contain; margin-top: 12px; border-radius: 18px; background: #f6edf9; border: 1px solid var(--line); }
      .ak-photo-preview.is-visible { display: block; }
      .ak-analysis-status { margin-top: 12px; padding: 13px 14px; border-radius: 14px; background: #fbf2fa; color: var(--muted); line-height: 1.45; }
      .ak-analysis-status.is-working { color: var(--purple-700); font-weight: 800; }
      .ak-analysis-result { display: none; margin-top: 14px; }
      .ak-analysis-result.is-visible { display: grid; gap: 12px; }
      .ak-joce-verdict { padding: 16px; border-radius: 18px; color: white; background: linear-gradient(135deg,var(--purple-700),var(--pink-600)); box-shadow: 0 12px 26px rgba(95,7,149,.17); }
      .ak-joce-verdict p { margin: 0 0 5px; color: #ffd9f1; font-size: .7rem; font-weight: 900; letter-spacing: .12em; }
      .ak-joce-verdict strong { display: block; font-size: 1.18rem; }
      .ak-joce-verdict span { display: block; margin-top: 6px; color: #fff1fb; line-height: 1.4; }
      .ak-analysis-grid { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 9px; }
      .ak-analysis-grid article { padding: 13px; border: 1px solid var(--line); border-radius: 15px; background: #fffaff; }
      .ak-analysis-grid span { display: block; color: var(--muted); font-size: .7rem; text-transform: uppercase; letter-spacing: .05em; }
      .ak-analysis-grid strong { display: block; margin-top: 4px; color: var(--purple-900); }
      .ak-joce-notes { display: grid; gap: 8px; margin: 0; padding: 0; list-style: none; }
      .ak-joce-notes li { padding: 10px 12px; border-radius: 13px; background: #fbf4fa; color: #51396a; line-height: 1.4; }
      .ak-joce-notes li::before { content: '✓'; margin-right: 8px; color: var(--pink-600); font-weight: 900; }
      .ak-analysis-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 9px; }
      @media (max-width: 520px) { .ak-analysis-grid, .ak-analysis-actions { grid-template-columns: 1fr; } }
    `
    document.head.appendChild(style)
  }

  const markup = () => `
    <section class="form-card ak-joce-card" id="${CARD_ID}">
      <div class="form-card-title"><span>✦</span><h3>JoCe analiza la foto</h3></div>
      <p class="ak-joce-intro">Sube la imagen de referencia que proporcionó el cliente. JoCe revisará su complejidad visual y propondrá ajustes antes de calcular el precio.</p>
      <label class="ak-photo-picker">
        <input id="ak-reference-photo" type="file" accept="image/*">
        <strong>＋ Subir foto o imagen del cliente</strong>
        <small>JPG, PNG o fotografía tomada con el teléfono</small>
      </label>
      <img class="ak-photo-preview" id="ak-photo-preview" alt="Imagen de referencia del cliente">
      <div class="ak-analysis-status" id="ak-analysis-status">Todavía no hay una imagen. JoCe necesita verla antes de sugerir.</div>
      <div class="ak-analysis-result" id="ak-analysis-result"></div>
    </section>
  `

  const insertCard = () => {
    injectStyles()
    const form = document.getElementById('quote-form')
    if (!form || document.getElementById(CARD_ID)) return
    const firstCard = form.querySelector('.form-card')
    if (!firstCard) return
    firstCard.insertAdjacentHTML('afterend', markup())
    bindCard(form)
    restorePreview(form)
  }

  const restorePreview = (form) => {
    try {
      const stored = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null')
      if (!stored?.dataUrl) return
      const preview = document.getElementById('ak-photo-preview')
      if (preview) {
        preview.src = stored.dataUrl
        preview.classList.add('is-visible')
      }
      const status = document.getElementById('ak-analysis-status')
      if (status) status.textContent = 'Imagen recuperada. Selecciónala nuevamente para repetir el análisis o conserva las sugerencias ya aplicadas.'
    } catch {}
  }

  const bindCard = (form) => {
    const input = document.getElementById('ak-reference-photo')
    input?.addEventListener('change', async () => {
      const file = input.files?.[0]
      if (!file) return
      await analyzeFile(file, form)
    })
  }

  const loadImage = (file) => new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => resolve({ img, url })
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo leer la imagen')) }
    img.src = url
  })

  const visualMetrics = (img) => {
    const maxSide = 520
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight))
    const width = Math.max(1, Math.round(img.naturalWidth * scale))
    const height = Math.max(1, Math.round(img.naturalHeight * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    ctx.drawImage(img, 0, 0, width, height)
    const pixels = ctx.getImageData(0, 0, width, height).data
    const gray = new Float32Array(width * height)
    let lumSum = 0
    let lumSq = 0
    let satSum = 0

    for (let i = 0, p = 0; i < pixels.length; i += 4, p += 1) {
      const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2]
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
      gray[p] = lum
      lumSum += lum
      lumSq += lum * lum
      const max = Math.max(r, g, b), min = Math.min(r, g, b)
      satSum += max === 0 ? 0 : (max - min) / max
    }

    let edges = 0
    let comparisons = 0
    for (let y = 0; y < height - 1; y += 2) {
      for (let x = 0; x < width - 1; x += 2) {
        const i = y * width + x
        const contrast = Math.abs(gray[i] - gray[i + 1]) + Math.abs(gray[i] - gray[i + width])
        if (contrast > 45) edges += 1
        comparisons += 1
      }
    }

    const count = width * height
    const mean = lumSum / count
    const variance = Math.max(0, lumSq / count - mean * mean)
    return {
      width: img.naturalWidth,
      height: img.naturalHeight,
      aspect: img.naturalWidth / img.naturalHeight,
      brightness: mean / 255,
      contrast: Math.sqrt(variance) / 128,
      saturation: satSum / count,
      edgeDensity: comparisons ? edges / comparisons : 0,
      canvas,
    }
  }

  const detectFaces = async (file) => {
    if (!('FaceDetector' in window) || !('createImageBitmap' in window)) return null
    try {
      const bitmap = await createImageBitmap(file)
      const detector = new FaceDetector({ fastMode: true, maxDetectedFaces: 12 })
      const faces = await detector.detect(bitmap)
      bitmap.close?.()
      return faces.length
    } catch {
      return null
    }
  }

  const classify = (metrics, faceCount) => {
    let score = 0
    if (metrics.edgeDensity > 0.22) score += 3
    else if (metrics.edgeDensity > 0.12) score += 2
    else if (metrics.edgeDensity > 0.07) score += 1
    if (metrics.contrast > 0.50) score += 2
    else if (metrics.contrast > 0.32) score += 1
    if (metrics.saturation > 0.42) score += 1
    if ((faceCount || 0) >= 3) score += 2
    else if ((faceCount || 0) >= 1) score += 1

    const background = score >= 6 ? 'Muy detallado' : score >= 3 ? 'Detallado' : 'Sencillo'
    const level = score >= 6 ? 'Alta' : score >= 3 ? 'Media' : 'Básica'
    return { score, background, level }
  }

  const materialMinimum = (form) => {
    const area = Math.max(1, num(form, 'width', 40) * num(form, 'height', 50))
    const technique = text(form, 'technique', 'Acrílico')
    const factors = {
      'Acrílico': [0.20, 120],
      'Óleo': [0.31, 190],
      'Acuarela': [0.16, 110],
      'Técnica mixta': [0.27, 170],
      'Otra': [0.22, 140],
    }
    const [factor, base] = factors[technique] || factors.Otra
    return Math.ceil((area * factor + base) / 50) * 50
  }

  const suggestedHours = (form, classification, faceCount) => {
    const width = Math.max(1, num(form, 'width', 40))
    const height = Math.max(1, num(form, 'height', 50))
    const areaFactor = Math.sqrt((width * height) / 2000)
    const technique = text(form, 'technique', 'Acrílico')
    const techniqueFactor = ({ 'Óleo': 1.25, 'Acuarela': 0.88, 'Técnica mixta': 1.18, 'Otra': 1.05 })[technique] || 1
    const people = faceCount ?? Math.max(0, num(form, 'people', 1))
    const pets = Math.max(0, num(form, 'pets', 0))
    const backgroundHours = classification.background === 'Muy detallado' ? 5 : classification.background === 'Detallado' ? 2.5 : 0
    const subjectHours = Math.max(0, people - 1) * 2.5 + pets * 1.5
    const hours = (7.5 * areaFactor + backgroundHours + subjectHours) * techniqueFactor
    return Math.max(4, Math.ceil(hours))
  }

  const saveThumbnail = (canvas) => {
    try {
      const max = 900
      const scale = Math.min(1, max / Math.max(canvas.width, canvas.height))
      const out = document.createElement('canvas')
      out.width = Math.round(canvas.width * scale)
      out.height = Math.round(canvas.height * scale)
      out.getContext('2d').drawImage(canvas, 0, 0, out.width, out.height)
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ dataUrl: out.toDataURL('image/jpeg', 0.72), savedAt: Date.now() }))
    } catch {}
  }

  const analyzeFile = async (file, form) => {
    const status = document.getElementById('ak-analysis-status')
    const result = document.getElementById('ak-analysis-result')
    if (status) {
      status.textContent = 'JoCe está revisando composición, contraste y nivel de detalle…'
      status.classList.add('is-working')
    }
    if (result) result.classList.remove('is-visible')

    try {
      const { img, url } = await loadImage(file)
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      previewUrl = url
      const preview = document.getElementById('ak-photo-preview')
      if (preview) {
        preview.src = url
        preview.classList.add('is-visible')
      }

      const metrics = visualMetrics(img)
      const faceCount = await detectFaces(file)
      const classification = classify(metrics, faceCount)
      const hours = suggestedHours(form, classification, faceCount)
      const minMaterials = materialMinimum(form)
      const currentMaterials = materialRows(form).reduce((sum, item) => sum + item.cost, 0)
      const people = faceCount && faceCount > 0 ? faceCount : Math.max(0, num(form, 'people', 1))
      const proposedDraft = buildDraft(form, { hours, background: classification.background, people })
      const price = window.AKPricing?.calculate ? window.AKPricing.calculate(proposedDraft) : null
      const startupNeed = price ? price.materialCost + num(form, 'packaging') + num(form, 'shipping') + price.laborCost * 0.25 : 0
      const depositCovers = price ? price.deposit >= startupNeed : true

      analysis = { metrics, faceCount, classification, hours, minMaterials, currentMaterials, people, price, depositCovers }
      saveThumbnail(metrics.canvas)
      renderAnalysis(form)
      if (status) {
        status.textContent = 'Análisis visual terminado. Revisa las sugerencias antes de aplicarlas.'
        status.classList.remove('is-working')
      }
    } catch (error) {
      if (status) {
        status.textContent = 'No pude analizar esta imagen. Prueba con otra fotografía en formato JPG o PNG.'
        status.classList.remove('is-working')
      }
    }
  }

  const renderAnalysis = (form) => {
    const result = document.getElementById('ak-analysis-result')
    if (!result || !analysis) return
    const a = analysis
    const faceNote = a.faceCount === null
      ? 'El navegador no permite contar rostros. Confirma manualmente personas y mascotas.'
      : a.faceCount > 0
        ? `Se detectaron ${a.faceCount} rostro${a.faceCount === 1 ? '' : 's'}. Confirma que coincida con la foto.`
        : 'No se detectaron rostros con claridad. Confirma manualmente las personas.'
    const materialNote = a.currentMaterials >= a.minMaterials
      ? `Los materiales registrados (${money(a.currentMaterials)}) alcanzan el mínimo orientativo.`
      : `Revisa materiales: hay ${money(a.currentMaterials)} y JoCe estima al menos ${money(a.minMaterials)} para este tamaño y técnica.`
    const priceText = a.price
      ? `${money(a.price.suggestedPrice)} · anticipo ${money(a.price.deposit)}`
      : 'Se calculará al aplicar'

    result.innerHTML = `
      <div class="ak-joce-verdict">
        <p>ANÁLISIS DE JOCE</p>
        <strong>Complejidad visual ${a.classification.level.toLowerCase()}</strong>
        <span>La foto sugiere fondo ${a.classification.background.toLowerCase()} y aproximadamente ${a.hours} horas de trabajo.</span>
      </div>
      <div class="ak-analysis-grid">
        <article><span>Fondo sugerido</span><strong>${a.classification.background}</strong></article>
        <article><span>Horas sugeridas</span><strong>${a.hours} horas</strong></article>
        <article><span>Precio orientativo</span><strong>${priceText}</strong></article>
        <article><span>Anticipo</span><strong>${a.depositCovers ? 'Sí cubre el arranque' : 'Conviene aumentarlo'}</strong></article>
      </div>
      <ul class="ak-joce-notes">
        <li>${faceNote}</li>
        <li>${materialNote}</li>
        <li>La foto mide ${a.metrics.width} × ${a.metrics.height} px. El tamaño final del cuadro también influye en las horas.</li>
        <li>JoCe hace una estimación inicial; Ana Karen conserva siempre la decisión final del precio.</li>
      </ul>
      <div class="ak-analysis-actions">
        <button class="primary-button" type="button" data-ak-apply-analysis>Aplicar sugerencias de JoCe</button>
        <button class="secondary-button" type="button" data-ak-change-photo>Cambiar imagen</button>
      </div>
    `
    result.classList.add('is-visible')
    result.querySelector('[data-ak-apply-analysis]')?.addEventListener('click', () => applyAnalysis(form))
    result.querySelector('[data-ak-change-photo]')?.addEventListener('click', () => document.getElementById('ak-reference-photo')?.click())
  }

  const applyAnalysis = (form) => {
    if (!analysis) return
    setField(form, 'background', analysis.classification.background)
    setField(form, 'hours', analysis.hours)
    if (analysis.faceCount && analysis.faceCount > 0) setField(form, 'people', analysis.faceCount)

    const currentMaterials = materialRows(form).reduce((sum, item) => sum + item.cost, 0)
    if (currentMaterials < analysis.minMaterials) {
      const costs = [...form.querySelectorAll('.material-cost')]
      if (costs.length) {
        const difference = analysis.minMaterials - currentMaterials
        const last = costs[costs.length - 1]
        last.value = Math.max(0, Number(last.value) || 0) + difference
        dispatch(last, 'input')
      }
    }

    const status = document.getElementById('ak-analysis-status')
    if (status) status.textContent = 'Sugerencias aplicadas. Revisa personas, mascotas y materiales antes de guardar la cotización.'
    setTimeout(() => document.getElementById('price-result')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 120)
  }

  const observer = new MutationObserver(insertCard)
  observer.observe(document.documentElement, { childList: true, subtree: true })
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', insertCard)
  else insertCard()
})()
