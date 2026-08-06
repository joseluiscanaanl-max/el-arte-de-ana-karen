(() => {
  'use strict'

  const SECTION_ID = 'ak-joce-canvas-sizes'
  const STYLE_ID = 'ak-joce-canvas-sizes-style'
  const SIZE_LABELS = ['Esencial', 'Recomendado', 'Presencia', 'Gran formato']
  let options = []
  let selectedKey = ''
  let lastSignature = ''
  let retryTimer = null

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

  const injectStyles = () => {
    if (document.getElementById(STYLE_ID)) return
    const style = document.createElement('style')
    style.id = STYLE_ID
    style.textContent = `
      .ak-canvas-sizes { display: grid; gap: 12px; }
      .ak-canvas-sizes__head h4 { margin: 0; color: var(--purple-900); font-size: 1.05rem; }
      .ak-canvas-sizes__head p { margin: 5px 0 0; color: var(--muted); line-height: 1.45; }
      .ak-canvas-sizes__grid { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 10px; }
      .ak-canvas-option { position: relative; display: grid; gap: 5px; padding: 14px; border: 2px solid var(--line); border-radius: 17px; background: #fffaff; color: var(--purple-900); text-align: left; cursor: pointer; transition: border-color .18s ease, box-shadow .18s ease, transform .18s ease; }
      .ak-canvas-option:hover { transform: translateY(-1px); border-color: #dca0d0; }
      .ak-canvas-option.is-selected { border-color: var(--pink-600); box-shadow: 0 10px 24px rgba(226,31,151,.12); background: linear-gradient(145deg,#fffaff,#fdf0fa); }
      .ak-canvas-option__label { color: var(--pink-600); font-size: .68rem; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; }
      .ak-canvas-option__size { font-size: 1.16rem; font-weight: 900; }
      .ak-canvas-option__meta { color: var(--muted); font-size: .82rem; line-height: 1.35; }
      .ak-canvas-option__price { margin-top: 3px; font-size: 1.12rem; font-weight: 900; }
      .ak-canvas-option__deposit { color: #51396a; font-size: .78rem; font-weight: 700; }
      .ak-canvas-option__badge { position: absolute; top: 10px; right: 10px; padding: 4px 7px; border-radius: 999px; background: var(--pink-600); color: white; font-size: .62rem; font-weight: 900; }
      .ak-canvas-sizes__note { margin: 0; padding: 11px 13px; border-radius: 13px; background: #fbf4fa; color: #654f76; line-height: 1.4; font-size: .84rem; }
      @media (max-width: 560px) { .ak-canvas-sizes__grid { grid-template-columns: 1fr; } }
    `
    document.head.appendChild(style)
  }

  const baseCatalog = [
    [20, 25], [20, 30], [25, 30], [25, 35], [25, 40], [30, 30],
    [30, 40], [30, 45], [35, 45], [35, 50], [35, 60], [40, 40],
    [40, 50], [40, 60], [45, 60], [45, 80], [50, 50], [50, 60],
    [50, 70], [50, 75], [60, 60], [60, 80], [60, 90], [60, 100],
    [70, 100], [80, 80], [80, 120],
  ]

  const sizeCatalogForAspect = (aspect) => {
    const landscape = aspect > 1.08
    return baseCatalog.map(([w, h]) => landscape ? { width: h, height: w } : { width: w, height: h })
  }

  const chooseCanvasSizes = (aspect) => {
    const bands = [
      [0, 1100],
      [1101, 2400],
      [2401, 4500],
      [4501, Infinity],
    ]
    const catalog = sizeCatalogForAspect(aspect)
    const selected = []

    bands.forEach(([minArea, maxArea], index) => {
      const candidates = catalog.filter(({ width, height }) => {
        const area = width * height
        return area >= minArea && area <= maxArea
      })
      if (!candidates.length) return

      const best = candidates.sort((a, b) => {
        const ratioA = a.width / a.height
        const ratioB = b.width / b.height
        const ratioPenaltyA = Math.abs(Math.log(ratioA / aspect))
        const ratioPenaltyB = Math.abs(Math.log(ratioB / aspect))
        return ratioPenaltyA - ratioPenaltyB
      })[0]

      selected.push({ ...best, label: SIZE_LABELS[index] })
    })

    return selected
  }

  const techniqueFactors = {
    'Acrílico': { material: 0.20, base: 120, time: 1 },
    'Óleo': { material: 0.31, base: 190, time: 1.25 },
    'Acuarela': { material: 0.16, base: 110, time: 0.88 },
    'Técnica mixta': { material: 0.27, base: 170, time: 1.18 },
    'Otra': { material: 0.22, base: 140, time: 1.05 },
  }

  const materialMinimum = (width, height, technique) => {
    const factor = techniqueFactors[technique] || techniqueFactors.Otra
    return round50(width * height * factor.material + factor.base)
  }

  const estimatedCanvasCost = (width, height) => round50(100 + width * height * 0.10)

  const suggestedHours = ({ width, height, technique, background, people, pets }) => {
    const areaFactor = Math.sqrt((width * height) / 2000)
    const techniqueFactor = (techniqueFactors[technique] || techniqueFactors.Otra).time
    const backgroundHours = background === 'Muy detallado' ? 5 : background === 'Detallado' ? 2.5 : 0
    const subjectHours = Math.max(0, people - 1) * 2.5 + Math.max(0, pets) * 1.5
    return Math.max(4, Math.ceil((7.5 * areaFactor + backgroundHours + subjectHours) * techniqueFactor))
  }

  const suggestedBackground = (result, form) => {
    const article = [...result.querySelectorAll('.ak-analysis-grid article')].find((item) =>
      item.querySelector('span')?.textContent?.trim().toLowerCase().startsWith('fondo')
    )
    return article?.querySelector('strong')?.textContent?.trim() || text(form, 'background', 'Sencillo')
  }

  const detectedPeople = (result, form) => {
    const match = result.textContent.match(/Se detectaron\s+(\d+)\s+rostro/i)
    return match ? Number(match[1]) : Math.max(0, num(form, 'people', 1))
  }

  const priceForOption = (form, option, background, people, pets, technique) => {
    const minimumMaterials = materialMinimum(option.width, option.height, technique)
    const hours = suggestedHours({
      width: option.width,
      height: option.height,
      technique,
      background,
      people,
      pets,
    })
    const draft = {
      materials: [{ name: 'Materiales estimados', cost: minimumMaterials }],
      hours,
      hourlyRate: num(form, 'hourlyRate', 150),
      packaging: num(form, 'packaging'),
      shipping: num(form, 'shipping'),
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
      ...option,
      key: `${option.width}x${option.height}`,
      hours,
      minimumMaterials,
      canvasCost: estimatedCanvasCost(option.width, option.height),
      price,
    }
  }

  const buildOptions = (form, result, preview) => {
    const aspect = preview.naturalWidth / preview.naturalHeight
    const background = suggestedBackground(result, form)
    const people = detectedPeople(result, form)
    const pets = Math.max(0, num(form, 'pets', 0))
    const technique = text(form, 'technique', 'Acrílico')
    return chooseCanvasSizes(aspect).map((option) =>
      priceForOption(form, option, background, people, pets, technique)
    )
  }

  const selectedOption = () => options.find((option) => option.key === selectedKey) || options[1] || options[0]

  const ratioLabel = (aspect) => {
    if (Math.abs(aspect - 1) < 0.08) return 'cuadrada'
    return aspect > 1 ? 'horizontal' : 'vertical'
  }

  const renderSection = (result, preview) => {
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
        <p>JoCe comparó cuatro tamaños compatibles con la composición ${ratioLabel(aspect)} de la foto.</p>
      </div>
      <div class="ak-canvas-sizes__grid">
        ${options.map((option, index) => {
          const selected = option.key === selectedKey
          const price = option.price
          return `
            <button class="ak-canvas-option${selected ? ' is-selected' : ''}" type="button" data-ak-canvas-key="${option.key}">
              ${index === 1 ? '<span class="ak-canvas-option__badge">MEJOR EQUILIBRIO</span>' : ''}
              <span class="ak-canvas-option__label">${option.label}</span>
              <strong class="ak-canvas-option__size">${option.width} × ${option.height} cm</strong>
              <span class="ak-canvas-option__meta">${option.hours} h · materiales ${money(option.minimumMaterials)} · lienzo aprox. ${money(option.canvasCost)}</span>
              <strong class="ak-canvas-option__price">${price ? money(price.suggestedPrice) : 'Por calcular'}</strong>
              <span class="ak-canvas-option__deposit">Anticipo ${price ? money(price.deposit) : '—'}</span>
            </button>
          `
        }).join('')}
      </div>
      <p class="ak-canvas-sizes__note">El precio cambia con el área del lienzo, las horas de trabajo y los materiales. Confirma el costo real del lienzo con el proveedor antes de enviar la cotización.</p>
    `

    updateAnalysisSummary(result)
  }

  const updateAnalysisSummary = (result) => {
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
    if (verdict) verdict.textContent = `Para un lienzo de ${option.width} × ${option.height} cm, JoCe estima aproximadamente ${option.hours} horas de trabajo.`
  }

  const applyMaterialSuggestion = (form, option) => {
    const rows = [...form.querySelectorAll('.material-row')]
    if (!rows.length) return
    const canvasRow = rows.find((row) => row.querySelector('.material-name')?.value?.toLowerCase().includes('lienzo')) || rows[0]
    const otherRow = rows.find((row) => row !== canvasRow && /pintur|material/i.test(row.querySelector('.material-name')?.value || '')) || rows[1]
    const canvasInput = canvasRow?.querySelector('.material-cost')
    if (canvasInput) {
      canvasInput.value = option.canvasCost
      dispatch(canvasInput)
    }
    const remaining = Math.max(0, option.minimumMaterials - option.canvasCost)
    const otherInput = otherRow?.querySelector('.material-cost')
    if (otherInput) {
      otherInput.value = remaining
      dispatch(otherInput)
    } else if (canvasInput) {
      canvasInput.value = option.minimumMaterials
      dispatch(canvasInput)
    }
  }

  const applySelectedSize = () => {
    const form = document.getElementById('quote-form')
    const option = selectedOption()
    if (!form || !option) return
    setField(form, 'width', option.width)
    setField(form, 'height', option.height)
    setField(form, 'hours', option.hours)
    applyMaterialSuggestion(form, option)
    const status = document.getElementById('ak-analysis-status')
    if (status) status.textContent = `Sugerencias aplicadas para lienzo de ${option.width} × ${option.height} cm. Confirma personas, mascotas y el costo real del lienzo.`
    setTimeout(() => document.getElementById('price-result')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 140)
  }

  const sync = () => {
    const form = document.getElementById('quote-form')
    const result = document.getElementById('ak-analysis-result')
    const preview = document.getElementById('ak-photo-preview')
    if (!form || !result?.classList.contains('is-visible') || !preview?.naturalWidth || !preview?.naturalHeight) return false

    const signature = [
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
      suggestedBackground(result, form),
    ].join('|')

    if (signature !== lastSignature || !document.getElementById(SECTION_ID)) {
      lastSignature = signature
      const previousSelection = selectedKey
      options = buildOptions(form, result, preview)
      selectedKey = options.some((option) => option.key === previousSelection)
        ? previousSelection
        : (options[1] || options[0])?.key || ''
      renderSection(result, preview)
    }
    return true
  }

  const retrySync = (remaining = 40) => {
    clearTimeout(retryTimer)
    if (sync() || remaining <= 0) return
    retryTimer = setTimeout(() => retrySync(remaining - 1), 300)
  }

  document.addEventListener('change', (event) => {
    if (event.target?.id === 'ak-reference-photo') {
      lastSignature = ''
      retrySync()
      return
    }
    if (event.target?.closest?.('#quote-form')) {
      lastSignature = ''
      setTimeout(sync, 80)
    }
  })

  document.addEventListener('input', (event) => {
    if (!event.target?.closest?.('#quote-form')) return
    if (!['people', 'pets', 'hourlyRate', 'marginPercent', 'depositPercent'].includes(event.target.name)) return
    lastSignature = ''
    clearTimeout(retryTimer)
    retryTimer = setTimeout(sync, 180)
  })

  document.addEventListener('click', (event) => {
    const sizeButton = event.target.closest?.('[data-ak-canvas-key]')
    if (sizeButton) {
      selectedKey = sizeButton.dataset.akCanvasKey || ''
      const result = document.getElementById('ak-analysis-result')
      const preview = document.getElementById('ak-photo-preview')
      if (result && preview) renderSection(result, preview)
      return
    }

    if (event.target.closest?.('[data-ak-apply-analysis]')) {
      setTimeout(applySelectedSize, 0)
      return
    }

    setTimeout(() => retrySync(8), 180)
  })

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => retrySync(10), { once: true })
  } else {
    retrySync(10)
  }
})()
