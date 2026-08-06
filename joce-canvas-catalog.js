(() => {
  'use strict'

  const SECTION_ID = 'ak-approved-canvas-catalog'
  const STYLE_ID = 'ak-approved-canvas-catalog-style'

  const CATALOG = [
    { key: 'mini', label: 'Mini', width: 20, height: 25, minHours: 6, maxHours: 8, canvasCost: 300, paintCost: 160 },
    { key: 'classic', label: 'Clásico', width: 30, height: 40, minHours: 10, maxHours: 14, canvasCost: 550, paintCost: 260 },
    { key: 'recommended', label: 'Recomendado', width: 40, height: 50, minHours: 18, maxHours: 24, canvasCost: 950, paintCost: 420 },
    { key: 'impact', label: 'Impacto', width: 50, height: 70, minHours: 24, maxHours: 32, canvasCost: 1450, paintCost: 620 },
    { key: 'gallery', label: 'Galería', width: 60, height: 80, minHours: 30, maxHours: 40, canvasCost: 1950, paintCost: 820 },
  ]

  const BACKGROUNDS = {
    simple: { value: 'Sencillo', label: 'Fondo sencillo', hourAdd: 0, paintFactor: 0.78 },
    medium: { value: 'Detallado', label: 'Fondo medio', hourAdd: 2, paintFactor: 1 },
    detailed: { value: 'Muy detallado', label: 'Fondo detallado', hourAdd: 6, paintFactor: 1.32 },
  }

  const TECHNIQUES = {
    'Acrílico': { hourFactor: 1, materialFactor: 1 },
    'Óleo': { hourFactor: 1.2, materialFactor: 1.25 },
    'Acuarela': { hourFactor: 0.88, materialFactor: 0.82 },
    'Técnica mixta': { hourFactor: 1.15, materialFactor: 1.2 },
    'Otra': { hourFactor: 1.05, materialFactor: 1.05 },
  }

  let selectedKey = 'recommended'
  let lastSignature = ''
  let timer = null

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

  const number = (field, fallback = 0) => {
    if (!field || field.value === '') return fallback
    const value = Number(field.value)
    return Number.isFinite(value) ? value : fallback
  }

  const injectStyles = () => {
    if (document.getElementById(STYLE_ID)) return
    const style = document.createElement('style')
    style.id = STYLE_ID
    style.textContent = `
      .ak-approved-catalog { display:grid; gap:14px; margin-top:14px; padding:16px; border:1px solid var(--line); border-radius:20px; background:#fff; box-shadow:0 12px 30px rgba(73,18,95,.07); }
      .ak-approved-catalog__head { display:grid; gap:5px; }
      .ak-approved-catalog__head h4 { margin:0; color:var(--purple-900); font-size:1.12rem; }
      .ak-approved-catalog__head p { margin:0; color:var(--muted); line-height:1.45; }
      .ak-approved-catalog__list { display:grid; gap:7px; }
      .ak-approved-size { position:relative; display:grid; grid-template-columns:auto minmax(0,1fr) auto; align-items:center; gap:11px; width:100%; min-height:64px; padding:10px 12px; border:2px solid var(--line); border-radius:15px; background:#fffaff; color:var(--purple-900); text-align:left; cursor:pointer; transition:.18s ease; }
      .ak-approved-size:hover { transform:translateY(-1px); border-color:#cda9e6; }
      .ak-approved-size.is-selected { border-color:var(--purple-600); background:linear-gradient(145deg,#fff,#fbf3ff); box-shadow:0 8px 20px rgba(95,7,149,.11); }
      .ak-approved-size__radio { width:22px; height:22px; border:2px solid #a98fbb; border-radius:50%; background:#fff; box-shadow:inset 0 0 0 5px #fff; }
      .ak-approved-size.is-selected .ak-approved-size__radio { border-color:var(--purple-600); background:var(--purple-600); }
      .ak-approved-size__main { display:grid; gap:3px; }
      .ak-approved-size__title { display:flex; flex-wrap:wrap; align-items:center; gap:8px; }
      .ak-approved-size__title strong { font-size:1.02rem; }
      .ak-approved-size__label { padding:4px 8px; border-radius:999px; background:#f0e3f7; color:#753aa4; font-size:.68rem; font-weight:850; }
      .ak-approved-size__badge { padding:5px 9px; border-radius:999px; background:linear-gradient(135deg,var(--purple-700),var(--pink-600)); color:#fff; font-size:.65rem; font-weight:900; letter-spacing:.03em; text-transform:uppercase; }
      .ak-approved-size__materials { color:var(--muted); font-size:.76rem; line-height:1.35; }
      .ak-approved-size__hours { color:#5c4370; font-size:.82rem; font-weight:800; white-space:nowrap; }
      .ak-approved-catalog__note { margin:0; padding:9px 12px; border-radius:999px; background:#f7ecfb; color:#68447e; text-align:center; font-size:.8rem; font-weight:750; }
      .ak-approved-price { display:grid; grid-template-columns:minmax(150px,.72fr) minmax(220px,1.28fr); gap:14px; padding:14px; border:1px solid var(--line); border-radius:18px; background:#fffaff; }
      .ak-approved-price__preview { display:grid; align-content:start; gap:8px; }
      .ak-approved-price__preview canvas { display:block; width:100%; aspect-ratio:4/3; border-radius:14px; background:#efe7f2; object-fit:cover; }
      .ak-approved-price__preview small { color:var(--muted); line-height:1.35; }
      .ak-approved-price__details { display:grid; align-content:start; gap:7px; }
      .ak-approved-price__details h5 { margin:0 0 3px; color:var(--purple-900); font-size:1.02rem; }
      .ak-approved-price__row { display:flex; justify-content:space-between; gap:12px; padding-bottom:5px; border-bottom:1px dotted #decde4; color:#4e385f; font-size:.84rem; }
      .ak-approved-price__row strong { color:var(--purple-900); text-align:right; }
      .ak-approved-price__total { display:flex; justify-content:space-between; gap:12px; margin-top:4px; padding:11px 12px; border-radius:13px; background:#f0e2f7; color:#6e2999; font-weight:900; }
      .ak-approved-price__total strong { font-size:1.35rem; }
      .ak-approved-price__deposit { display:flex; justify-content:space-between; gap:12px; color:#4e385f; font-size:.85rem; }
      .ak-approved-catalog__actions { display:grid; grid-template-columns:1fr 1.1fr; gap:10px; }
      .ak-approved-catalog__actions button { min-height:45px; border-radius:13px; font:inherit; font-weight:900; cursor:pointer; }
      .ak-approved-catalog__change { border:1px solid var(--purple-600); background:#fff; color:var(--purple-700); }
      .ak-approved-catalog__apply { border:0; background:linear-gradient(135deg,var(--purple-700),var(--purple-500)); color:#fff; box-shadow:0 9px 20px rgba(95,7,149,.18); }
      @media (max-width:760px) {
        .ak-approved-price { grid-template-columns:1fr; }
        .ak-approved-price__preview canvas { max-height:300px; }
      }
      @media (max-width:540px) {
        .ak-approved-catalog { padding:13px; }
        .ak-approved-size { grid-template-columns:auto 1fr; }
        .ak-approved-size__hours { grid-column:2; white-space:normal; }
        .ak-approved-catalog__actions { grid-template-columns:1fr; }
      }
    `
    document.head.appendChild(style)
  }

  const selectedBackgroundKey = () => {
    const selected = document.querySelector('#ak-joce-acrylic-preview .ak-acrylic-card.is-selected')
    const key = selected?.dataset?.akAcrylicKey
    if (key && BACKGROUNDS[key]) return key

    const value = document.getElementById('quote-form')?.elements?.background?.value || ''
    if (/muy/i.test(value)) return 'detailed'
    if (/detall/i.test(value)) return 'medium'
    return 'simple'
  }

  const orient = (entry, preview) => {
    const landscape = preview && preview.naturalWidth > preview.naturalHeight
    return landscape
      ? { ...entry, width: Math.max(entry.width, entry.height), height: Math.min(entry.width, entry.height) }
      : { ...entry, width: Math.min(entry.width, entry.height), height: Math.max(entry.width, entry.height) }
  }

  const recommendedKey = (form, backgroundKey) => {
    const people = Math.max(0, number(form.elements.people, 1))
    const pets = Math.max(0, number(form.elements.pets, 0))
    if (people >= 4 || pets >= 2 || (backgroundKey === 'detailed' && people >= 3)) return 'impact'
    if (people <= 1 && pets === 0 && backgroundKey === 'simple') return 'classic'
    return 'recommended'
  }

  const estimate = (entry, form, preview, backgroundKey) => {
    const oriented = orient(entry, preview)
    const background = BACKGROUNDS[backgroundKey]
    const techniqueName = form.elements.technique?.value || 'Acrílico'
    const technique = TECHNIQUES[techniqueName] || TECHNIQUES.Acrílico
    const people = Math.max(0, number(form.elements.people, 1))
    const pets = Math.max(0, number(form.elements.pets, 0))
    const additionalSubjects = Math.max(0, people - 2) * 2 + pets * 1.25
    const calculatedHours = Math.ceil((entry.minHours + background.hourAdd + additionalSubjects) * technique.hourFactor)
    const hours = Math.max(entry.minHours, Math.min(entry.maxHours, calculatedHours))
    const canvasCost = round50(entry.canvasCost)
    const paintCost = round50(entry.paintCost * background.paintFactor * technique.materialFactor)
    const materials = [
      { name: `Lienzo ${oriented.width} × ${oriented.height} cm`, cost: canvasCost },
      { name: 'Pintura acrílica, médiums y sellado', cost: paintCost },
    ]
    const draft = {
      materials,
      hours,
      hourlyRate: number(form.elements.hourlyRate, 150),
      packaging: number(form.elements.packaging, 0),
      shipping: number(form.elements.shipping, 0),
      indirectPercent: number(form.elements.indirectPercent, 10),
      people,
      pets,
      background: background.value,
      urgent: Boolean(form.elements.urgent?.checked),
      marginPercent: number(form.elements.marginPercent, 35),
      depositPercent: number(form.elements.depositPercent, 50),
    }
    const price = window.AKPricing.calculate(draft)
    return { ...oriented, backgroundKey, background, hours, canvasCost, paintCost, materials, price }
  }

  const allEstimates = (form, preview, backgroundKey) => CATALOG.map((entry) => estimate(entry, form, preview, backgroundKey))

  const chosen = (estimates) => estimates.find((entry) => entry.key === selectedKey) || estimates[2] || estimates[0]

  const copySelectedPreview = (target) => {
    const source = document.querySelector('#ak-joce-acrylic-preview .ak-acrylic-card.is-selected canvas')
    if (!source || !target) return
    const ratio = source.width && source.height ? source.width / source.height : 4 / 3
    target.width = Math.min(900, source.width || 900)
    target.height = Math.max(1, Math.round(target.width / ratio))
    const ctx = target.getContext('2d')
    ctx.clearRect(0, 0, target.width, target.height)
    ctx.drawImage(source, 0, 0, target.width, target.height)
  }

  const render = (section, form, preview) => {
    const backgroundKey = selectedBackgroundKey()
    const recommendation = recommendedKey(form, backgroundKey)
    if (!CATALOG.some((entry) => entry.key === selectedKey)) selectedKey = recommendation
    const estimates = allEstimates(form, preview, backgroundKey)
    const option = chosen(estimates)

    section.innerHTML = `
      <div class="ak-approved-catalog__head">
        <h4>Catálogo de lienzos y precio recomendado</h4>
        <p>JoCe considera el tamaño, la cantidad de pintura, el fondo elegido, las personas y las horas de trabajo.</p>
      </div>
      <div class="ak-approved-catalog__list">
        ${estimates.map((entry) => `
          <button type="button" class="ak-approved-size${entry.key === selectedKey ? ' is-selected' : ''}" data-ak-approved-size="${entry.key}">
            <span class="ak-approved-size__radio" aria-hidden="true"></span>
            <span class="ak-approved-size__main">
              <span class="ak-approved-size__title">
                <strong>${entry.width} × ${entry.height} cm</strong>
                <span class="ak-approved-size__label">${entry.label}</span>
                ${entry.key === recommendation ? '<span class="ak-approved-size__badge">Recomendado por JoCe</span>' : ''}
              </span>
              <span class="ak-approved-size__materials">Lienzo ${money(entry.canvasCost)} · pintura y sellado ${money(entry.paintCost)}</span>
            </span>
            <span class="ak-approved-size__hours">◷ ${entry.minHours}–${entry.maxHours} h · cálculo ${entry.hours} h</span>
          </button>
        `).join('')}
      </div>
      <p class="ak-approved-catalog__note">Más tamaño = más lienzo, más pintura y más horas.</p>
      <div class="ak-approved-price">
        <div class="ak-approved-price__preview">
          <canvas id="ak-approved-price-preview"></canvas>
          <small>Vista elegida: <strong>${option.background.label}</strong></small>
        </div>
        <div class="ak-approved-price__details">
          <h5>Precio sugerido por JoCe</h5>
          <div class="ak-approved-price__row"><span>Personas</span><strong>${Math.max(0, number(form.elements.people, 1))}</strong></div>
          <div class="ak-approved-price__row"><span>Tamaño</span><strong>${option.width} × ${option.height} cm</strong></div>
          <div class="ak-approved-price__row"><span>Lienzo</span><strong>${money(option.canvasCost)}</strong></div>
          <div class="ak-approved-price__row"><span>Pintura y sellado</span><strong>${money(option.paintCost)}</strong></div>
          <div class="ak-approved-price__row"><span>Horas estimadas</span><strong>${option.hours} h</strong></div>
          <div class="ak-approved-price__row"><span>Mano de obra</span><strong>${money(option.price.laborCost)}</strong></div>
          <div class="ak-approved-price__row"><span>Complejidad</span><strong>${money(option.price.complexityCost)}</strong></div>
          <div class="ak-approved-price__total"><span>Precio recomendado</span><strong>${money(option.price.suggestedPrice)}</strong></div>
          <div class="ak-approved-price__deposit"><span>Anticipo sugerido</span><strong>${money(option.price.deposit)}</strong></div>
        </div>
      </div>
      <div class="ak-approved-catalog__actions">
        <button type="button" class="ak-approved-catalog__change" data-ak-change-acrylic>← Cambiar vista acrílica</button>
        <button type="button" class="ak-approved-catalog__apply" data-ak-apply-approved-size>Aplicar tamaño y precio</button>
      </div>
    `
    copySelectedPreview(section.querySelector('#ak-approved-price-preview'))
    section.dataset.signature = JSON.stringify({ selectedKey, backgroundKey, recommendation })
  }

  const ensure = () => {
    const form = document.getElementById('quote-form')
    const acrylic = document.getElementById('ak-joce-acrylic-preview')
    const preview = document.getElementById('ak-photo-preview')
    if (!form || !acrylic || !preview?.naturalWidth || !window.AKPricing) return

    injectStyles()
    document.getElementById('ak-joce-canvas-sizes')?.remove()

    let section = document.getElementById(SECTION_ID)
    if (!section) {
      section = document.createElement('section')
      section.id = SECTION_ID
      section.className = 'ak-approved-catalog'
      acrylic.insertAdjacentElement('afterend', section)
    }

    const backgroundKey = selectedBackgroundKey()
    const signature = JSON.stringify({
      src: preview.currentSrc || preview.src,
      width: preview.naturalWidth,
      height: preview.naturalHeight,
      people: number(form.elements.people, 1),
      pets: number(form.elements.pets, 0),
      technique: form.elements.technique?.value,
      backgroundKey,
      rate: number(form.elements.hourlyRate, 150),
      indirect: number(form.elements.indirectPercent, 10),
      margin: number(form.elements.marginPercent, 35),
      deposit: number(form.elements.depositPercent, 50),
      packaging: number(form.elements.packaging, 0),
      shipping: number(form.elements.shipping, 0),
      urgent: Boolean(form.elements.urgent?.checked),
      selectedKey,
    })
    if (signature === lastSignature && section.children.length) {
      copySelectedPreview(section.querySelector('#ak-approved-price-preview'))
      return
    }
    lastSignature = signature
    render(section, form, preview)
  }

  const schedule = (delay = 120) => {
    clearTimeout(timer)
    timer = setTimeout(ensure, delay)
  }

  const ensureMaterialRows = (form, callback, attempts = 0) => {
    const rows = [...form.querySelectorAll('.material-row')]
    if (rows.length >= 2 || attempts >= 3) {
      callback(rows)
      return
    }
    form.querySelector('[data-action="add-material"]')?.click()
    setTimeout(() => {
      const refreshed = document.getElementById('quote-form')
      if (refreshed) ensureMaterialRows(refreshed, callback, attempts + 1)
    }, 180)
  }

  const applySelection = () => {
    const form = document.getElementById('quote-form')
    const preview = document.getElementById('ak-photo-preview')
    if (!form || !preview?.naturalWidth) return
    const option = chosen(allEstimates(form, preview, selectedBackgroundKey()))
    if (!option) return

    ensureMaterialRows(form, (rows) => {
      const currentForm = document.getElementById('quote-form')
      if (!currentForm) return
      currentForm.elements.width.value = String(option.width)
      currentForm.elements.height.value = String(option.height)
      currentForm.elements.hours.value = String(option.hours)
      currentForm.elements.background.value = option.background.value

      const currentRows = [...currentForm.querySelectorAll('.material-row')]
      option.materials.forEach((material, index) => {
        const row = currentRows[index]
        if (!row) return
        const name = row.querySelector('.material-name')
        const cost = row.querySelector('.material-cost')
        if (name) name.value = material.name
        if (cost) cost.value = String(material.cost)
      })

      currentForm.elements.hours.dispatchEvent(new Event('input', { bubbles: true }))
      setTimeout(schedule, 240)
    })
  }

  document.addEventListener('click', (event) => {
    const size = event.target.closest?.('[data-ak-approved-size]')
    if (size) {
      selectedKey = size.dataset.akApprovedSize
      lastSignature = ''
      ensure()
      return
    }

    if (event.target.closest?.('[data-ak-apply-approved-size]')) {
      applySelection()
      return
    }

    if (event.target.closest?.('[data-ak-change-acrylic]')) {
      document.getElementById('ak-joce-acrylic-preview')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  })

  document.addEventListener('input', () => schedule())
  document.addEventListener('change', () => schedule())
  document.addEventListener('click', (event) => {
    if (event.target.closest?.('[data-ak-acrylic-key], [data-ak-use-acrylic]')) schedule(220)
  })

  const observer = new MutationObserver(() => schedule(80))
  observer.observe(document.documentElement, { childList: true, subtree: true })
  setInterval(ensure, 1200)
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensure, { once: true })
  else ensure()
})()
