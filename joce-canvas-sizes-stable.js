(() => {
  'use strict'

  const SECTION_ID = 'ak-joce-canvas-sizes'
  const STYLE_ID = 'ak-joce-canvas-sizes-stable-style'
  const LABELS = ['Esencial', 'Recomendado', 'Presencia', 'Gran formato']
  const CATALOG = [
    [20, 25], [20, 30], [25, 30], [25, 35], [25, 40], [30, 30],
    [30, 40], [30, 45], [35, 45], [35, 50], [35, 60], [40, 40],
    [40, 50], [40, 60], [45, 60], [45, 80], [50, 50], [50, 60],
    [50, 70], [50, 75], [60, 60], [60, 80], [60, 90], [60, 100],
    [70, 100], [80, 80], [80, 120],
  ]

  let options = []
  let selectedKey = ''
  let lastSignature = ''
  let updateTimer = null

  const money = (value) => window.AKPricing?.money
    ? window.AKPricing.money(value)
    : new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN',
        maximumFractionDigits: 0,
      }).format(Number(value) || 0)

  const round50 = (value) => window.AKPricing?.round50
    ? window.AKPricing.round50(value)
    : Math.ceil((Number(value) || 0) / 50) * 50

  const num = (form, name, fallback = 0) => {
    const field = form?.elements?.[name]
    if (!field || field.value === '') return fallback
    const value = Number(field.value)
    return Number.isFinite(value) ? value : fallback
  }

  const text = (form, name, fallback = '') => {
    const value = form?.elements?.[name]?.value
    return value === undefined || value === null || value === '' ? fallback : String(value)
  }

  const setField = (form, name, value) => {
    const field = form?.elements?.[name]
    if (!field) return
    field.value = value
    field.dispatchEvent(new Event(field.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }))
  }

  const injectStyles = () => {
    if (document.getElementById(STYLE_ID)) return
    const style = document.createElement('style')
    style.id = STYLE_ID
    style.textContent = `
      .ak-canvas-sizes { display: grid; gap: 12px; padding-top: 2px; }
      .ak-canvas-sizes__head h4 { margin: 0; color: var(--purple-900); font-size: 1.08rem; }
      .ak-canvas-sizes__head p { margin: 5px 0 0; color: var(--muted); line-height: 1.45; }
      .ak-canvas-sizes__grid { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 10px; }
      .ak-canvas-option { position: relative; display: grid; gap: 5px; min-width: 0; padding: 15px; border: 2px solid var(--line); border-radius: 17px; background: #fffaff; color: var(--purple-900); text-align: left; transition: .18s ease; }
      .ak-canvas-option:hover { transform: translateY(-1px); border-color: #dca0d0; }
      .ak-canvas-option.is-selected { border-color: var(--pink-600); background: linear-gradient(145deg,#fffaff,#fdf0fa); box-shadow: 0 10px 24px rgba(226,31,151,.13); }
      .ak-canvas-option__label { color: var(--pink-600); font-size: .68rem; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; }
      .ak-canvas-option__size { font-size: 1.16rem; font-weight: 900; }
      .ak-canvas-option__meta { color: var(--muted); font-size: .79rem; line-height: 1.4; }
      .ak-canvas-option__price { margin-top: 4px; font-size: 1.15rem; font-weight: 900; }
      .ak-canvas-option__deposit { color: #51396a; font-size: .78rem; font-weight: 750; }
      .ak-canvas-option__badge { position: absolute; top: 9px; right: 9px; max-width: 46%; padding: 4px 7px; border-radius: 999px; background: var(--pink-600); color: white; font-size: .58rem; font-weight: 900; text-align: center; }
      .ak-canvas-sizes__note { margin: 0; padding: 11px 13px; border-radius: 13px; background: #fbf4fa; color: #654f76; line-height: 1.45; font-size: .83rem; }
      @media (max-width: 560px) { .ak-canvas-sizes__grid { grid-template-columns: 1fr; } }
    `
    document.head.appendChild(style)
  }

  const orientedCatalog = (aspect) => {
    const landscape = aspect > 1.08
    const square = Math.abs(aspect - 1) <= 0.08
    return CATALOG.map(([width, height]) => {
      if (square) {
        const side = Math.round(Math.sqrt(width * height) / 5) * 5
        return { width: side, height: side }
      }
      return landscape
        ? { width: Math.max(width, height), height: Math.min(width, height) }
        : { width: Math.min(width, height), height: Math.max(width, height) }
    })
  }

  const chooseSizes = (aspect) => {
    const bands = [[0, 1100], [1101, 2400], [2401, 4500], [4501, Infinity]]
    const catalog = orientedCatalog(aspect)
    const used = new Set()

    return bands.map(([minimum, maximum], index) => {
      const candidate = catalog
        .filter(({ width, height }) => {
          const area = width * height
          return area >= minimum && area <= maximum
        })
        .sort((a, b) => {
          const penaltyA = Math.abs(Math.log((a.width / a.height) / aspect))
          const penaltyB = Math.abs(Math.log((b.width / b.height) / aspect))
          return penaltyA - penaltyB || (a.width * a.height) - (b.width * b.height)
        })
        .find(({ width, height }) => !used.has(`${width}x${height}`))

      if (!candidate) return null
      used.add(`${candidate.width}x${candidate.height}`)
      return { ...candidate, label: LABELS[index] }
    }).filter(Boolean)
  }

  const techniqueData = (technique) => ({
    'Acrílico': { paintFactor: 0.075, paintBase: 100, time: 1 },
    'Óleo': { paintFactor: 0.11, paintBase: 150, time: 1.25 },
    'Acuarela': { paintFactor: 0.06, paintBase: 90, time: 0.88 },
    'Técnica mixta': { paintFactor: 0.10, paintBase: 140, time: 1.18 },
    'Otra': { paintFactor: 0.08, paintBase: 110, time: 1.05 },
  })[technique] || { paintFactor: 0.08, paintBase: 110, time: 1.05 }

  const findBackground = (result, form) => {
    const article = [...result.querySelectorAll('.ak-analysis-grid article')].find((item) =>
      item.querySelector('span')?.textContent?.trim().toLowerCase().startsWith('fondo')
    )
    return article?.querySelector('strong')?.textContent?.trim() || text(form, 'background', 'Sencillo')
  }

  const findPeople = (result, form) => {
    const match = result.textContent.match(/Se detectaron\s+(\d+)\s+rostro/i)
    return match ? Number(match[1]) : Math.max(0, num(form, 'people', 1))
  }

  const estimateOption = (form, result, size) => {
    const technique = text(form, 'technique', 'Acrílico')
    const factors = techniqueData(technique)
    const background = findBackground(result, form)
    const people = findPeople(result, form)
    const pets = Math.max(0, num(form, 'pets', 0))
    const area = size.width * size.height
    const canvasCost = round50(100 + area * 0.10)
    const paintCost = round50(factors.paintBase + area * factors.paintFactor)
    const materialCost = canvasCost + paintCost
    const areaFactor = Math.sqrt(area / 2000)
    const backgroundHours = background === 'Muy detallado' ? 5 : background === 'Detallado' ? 2.5 : 0
    const subjectHours = Math.max(0, people - 1) * 2.5 + pets * 1.5
    const hours = Math.max(4, Math.ceil((7.5 * areaFactor + backgroundHours + subjectHours) * factors.time))

    const draft = {
      materials: [{ name: 'Lienzo', cost: canvasCost }, { name: 'Pinturas y materiales', cost: paintCost }],
      hours,
      hourlyRate: num(form, 'hourlyRate', 150),
      packaging: num(form, 'packaging', 0),
      shipping: num(form, 'shipping', 0),
      indirectPercent: num(form, 'indirectPercent', 10),
      people,
      pets,
      background,
      urgent: Boolean(form.elements?.urgent?.checked),
      marginPercent: num(form, 'marginPercent', 35),
      depositPercent: num(form, 'depositPercent', 50),
    }

    const price = window.AKPricing?.calculate ? window.AKPricing.calculate(draft) : null
    return {
      ...size,
      key: `${size.width}x${size.height}`,
      background,
      people,
      pets,
      hours,
      canvasCost,
      paintCost,
      materialCost,
      price,
    }
  }

  const selectedOption = () => options.find((option) => option.key === selectedKey) || options[1] || options[0]

  const orientationName = (aspect) => {
    if (Math.abs(aspect - 1) <= 0.08) return 'cuadrada'
    return aspect > 1 ? 'horizontal' : 'vertical'
  }

  const updateSummary = (result) => {
    const option = selectedOption()
    if (!option) return
    const articles = [...result.querySelectorAll('.ak-analysis-grid article')]
    const hoursArticle = articles.find((item) => item.querySelector('span')?.textContent?.toLowerCase().includes('horas'))
    const priceArticle = articles.find((item) => item.querySelector('span')?.textContent?.toLowerCase().includes('precio'))
    if (hoursArticle?.querySelector('strong')) hoursArticle.querySelector('strong').textContent = `${option.hours} horas`
    if (priceArticle?.querySelector('strong') && option.price) {
      priceArticle.querySelector('strong').textContent = `${money(option.price.suggestedPrice)} · anticipo ${money(option.price.deposit)}`
    }
    const verdict = result.querySelector('.ak-joce-verdict span')
    if (verdict) verdict.textContent = `Para un lienzo de ${option.width} × ${option.height} cm, JoCe estima ${option.hours} horas de trabajo.`
  }

  const render = (form, result, preview) => {
    injectStyles()
    let section = document.getElementById(SECTION_ID)
    if (!section) {
      section = document.createElement('section')
      section.id = SECTION_ID
      section.className = 'ak-canvas-sizes'
      const notes = result.querySelector('.ak-joce-notes')
      if (notes) result.insertBefore(section, notes)
      else result.appendChild(section)
    }

    const aspect = preview.naturalWidth / preview.naturalHeight
    section.innerHTML = `
      <div class="ak-canvas-sizes__head">
        <h4>Tamaños de lienzo sugeridos</h4>
        <p>JoCe comparó cuatro tamaños compatibles con la composición ${orientationName(aspect)} de la fotografía.</p>
      </div>
      <div class="ak-canvas-sizes__grid">
        ${options.map((option, index) => `
          <button class="ak-canvas-option${option.key === selectedKey ? ' is-selected' : ''}" type="button" data-ak-canvas-key="${option.key}">
            ${index === 1 ? '<span class="ak-canvas-option__badge">MEJOR EQUILIBRIO</span>' : ''}
            <span class="ak-canvas-option__label">${option.label}</span>
            <strong class="ak-canvas-option__size">${option.width} × ${option.height} cm</strong>
            <span class="ak-canvas-option__meta">${option.hours} horas · lienzo ${money(option.canvasCost)} · pinturas ${money(option.paintCost)}</span>
            <strong class="ak-canvas-option__price">${option.price ? money(option.price.suggestedPrice) : 'Por calcular'}</strong>
            <span class="ak-canvas-option__deposit">Anticipo ${option.price ? money(option.price.deposit) : '—'}</span>
          </button>
        `).join('')}
      </div>
      <p class="ak-canvas-sizes__note">Selecciona un tamaño y luego pulsa “Aplicar sugerencias de JoCe”. El precio considera lienzo, pinturas, horas, complejidad y margen.</p>
    `
    updateSummary(result)
  }

  const buildSignature = (form, result, preview) => [
    preview.currentSrc || preview.src,
    preview.naturalWidth,
    preview.naturalHeight,
    text(form, 'technique', 'Acrílico'),
    num(form, 'people', 1),
    num(form, 'pets', 0),
    num(form, 'hourlyRate', 150),
    num(form, 'marginPercent', 35),
    num(form, 'depositPercent', 50),
    Boolean(form.elements?.urgent?.checked),
    findBackground(result, form),
  ].join('|')

  const ensure = () => {
    try {
      const form = document.getElementById('quote-form')
      const result = document.getElementById('ak-analysis-result')
      const preview = document.getElementById('ak-photo-preview')
      if (!form || !result?.classList.contains('is-visible') || !preview?.naturalWidth || !preview?.naturalHeight) return

      const signature = buildSignature(form, result, preview)
      if (signature === lastSignature && document.getElementById(SECTION_ID)?.children.length) return

      const previous = selectedKey
      const aspect = preview.naturalWidth / preview.naturalHeight
      options = chooseSizes(aspect).map((size) => estimateOption(form, result, size))
      selectedKey = options.some((option) => option.key === previous)
        ? previous
        : (options[1] || options[0])?.key || ''
      lastSignature = signature
      render(form, result, preview)
    } catch (error) {
      const result = document.getElementById('ak-analysis-result')
      if (!result || document.getElementById(SECTION_ID)) return
      const section = document.createElement('section')
      section.id = SECTION_ID
      section.className = 'ak-canvas-sizes'
      section.innerHTML = '<p class="ak-canvas-sizes__note">JoCe no pudo calcular los tamaños en este intento. Cambia la imagen y vuelve a seleccionarla.</p>'
      result.appendChild(section)
    }
  }

  const scheduleEnsure = (delay = 120) => {
    clearTimeout(updateTimer)
    updateTimer = setTimeout(ensure, delay)
  }

  const updateMaterialRows = (form, option) => {
    const rows = [...form.querySelectorAll('.material-row')]
    if (!rows.length) return
    const canvasRow = rows.find((row) => /lienzo/i.test(row.querySelector('.material-name')?.value || '')) || rows[0]
    const paintRow = rows.find((row) => row !== canvasRow && /pintur|material/i.test(row.querySelector('.material-name')?.value || '')) || rows[1]
    const canvasInput = canvasRow?.querySelector('.material-cost')
    const paintInput = paintRow?.querySelector('.material-cost')
    if (canvasInput) {
      canvasInput.value = option.canvasCost
      canvasInput.dispatchEvent(new Event('input', { bubbles: true }))
    }
    if (paintInput) {
      paintInput.value = option.paintCost
      paintInput.dispatchEvent(new Event('input', { bubbles: true }))
    }
  }

  const applySelected = () => {
    const form = document.getElementById('quote-form')
    const option = selectedOption()
    if (!form || !option) return
    setField(form, 'width', option.width)
    setField(form, 'height', option.height)
    setField(form, 'hours', option.hours)
    updateMaterialRows(form, option)
    const status = document.getElementById('ak-analysis-status')
    if (status) status.textContent = `Sugerencias aplicadas para lienzo de ${option.width} × ${option.height} cm. Confirma personas, mascotas y costos antes de guardar.`
  }

  document.addEventListener('click', (event) => {
    const sizeButton = event.target.closest?.('[data-ak-canvas-key]')
    if (sizeButton) {
      selectedKey = sizeButton.dataset.akCanvasKey || ''
      const form = document.getElementById('quote-form')
      const result = document.getElementById('ak-analysis-result')
      const preview = document.getElementById('ak-photo-preview')
      if (form && result && preview) render(form, result, preview)
      return
    }

    if (event.target.closest?.('[data-ak-apply-analysis]')) {
      setTimeout(applySelected, 20)
    }
  })

  document.addEventListener('change', (event) => {
    if (event.target?.id === 'ak-reference-photo' || event.target?.closest?.('#quote-form')) {
      lastSignature = ''
      scheduleEnsure(220)
    }
  })

  document.addEventListener('input', (event) => {
    if (!event.target?.closest?.('#quote-form')) return
    if (!['people', 'pets', 'hourlyRate', 'marginPercent', 'depositPercent'].includes(event.target.name)) return
    lastSignature = ''
    scheduleEnsure(180)
  })

  injectStyles()
  setInterval(ensure, 700)
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensure, { once: true })
  else ensure()
})()
