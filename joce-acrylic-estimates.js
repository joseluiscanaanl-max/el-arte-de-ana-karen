(() => {
  'use strict'

  const STYLE_ID = 'ak-acrylic-estimates-style'
  const PRESETS = {
    simple: { background: 'Sencillo', hourOffset: -2, label: 'Fondo sencillo' },
    medium: { background: 'Detallado', hourOffset: -1, label: 'Fondo medio' },
    detailed: { background: 'Muy detallado', hourOffset: 0, label: 'Fondo detallado' },
  }

  let timer = null
  let lastSignature = ''

  const injectStyles = () => {
    if (document.getElementById(STYLE_ID)) return
    const style = document.createElement('style')
    style.id = STYLE_ID
    style.textContent = `
      .ak-acrylic-card__recommended { position:absolute; top:10px; left:10px; z-index:2; padding:5px 8px; border-radius:999px; background:linear-gradient(135deg,var(--purple-700),var(--pink-600)); color:#fff; font-size:.64rem; font-weight:900; letter-spacing:.04em; text-transform:uppercase; box-shadow:0 6px 14px rgba(95,7,149,.2); }
      .ak-acrylic-card__meta { display:grid; grid-template-columns:1fr 1fr; gap:7px; }
      .ak-acrylic-card__meta span { display:grid; gap:2px; padding:8px; border:1px solid var(--line); border-radius:11px; background:#fff; color:var(--muted); font-size:.7rem; }
      .ak-acrylic-card__meta strong { color:var(--purple-900); font-size:.88rem; }
      .ak-acrylic-card__choose { display:block; padding:9px 10px; border-radius:10px; background:#f5e8f5; color:var(--purple-800); font-size:.78rem; font-weight:900; text-align:center; }
      .ak-acrylic-card.is-selected .ak-acrylic-card__choose { background:linear-gradient(135deg,var(--purple-700),var(--pink-600)); color:#fff; }
    `
    document.head.appendChild(style)
  }

  const number = (field, fallback = 0) => {
    const value = Number(field?.value)
    return Number.isFinite(value) ? value : fallback
  }

  const readDraft = (form) => ({
    materials: [...form.querySelectorAll('[data-material-id]')].map((row) => ({
      name: row.querySelector('.material-name')?.value || '',
      cost: number(row.querySelector('.material-cost')),
    })),
    hours: number(form.elements.hours),
    hourlyRate: number(form.elements.hourlyRate),
    packaging: number(form.elements.packaging),
    shipping: number(form.elements.shipping),
    indirectPercent: number(form.elements.indirectPercent),
    people: number(form.elements.people),
    pets: number(form.elements.pets),
    background: form.elements.background?.value || 'Sencillo',
    urgent: Boolean(form.elements.urgent?.checked),
    marginPercent: number(form.elements.marginPercent),
    depositPercent: number(form.elements.depositPercent),
  })

  const keyFromBackground = (value) => {
    const normalized = String(value || '').toLowerCase()
    if (normalized.includes('muy')) return 'detailed'
    if (normalized.includes('detall')) return 'medium'
    return 'simple'
  }

  const buildEstimate = (baseDraft, preset) => {
    const hours = Math.max(1, Math.round(number({ value: baseDraft.hours }) + preset.hourOffset))
    const draft = { ...baseDraft, hours, background: preset.background }
    const price = window.AKPricing.calculate(draft)
    return { hours, price }
  }

  const enhance = () => {
    injectStyles()
    const section = document.getElementById('ak-joce-acrylic-preview')
    const form = document.getElementById('quote-form')
    if (!section || !form || !window.AKPricing) return

    const baseDraft = readDraft(form)
    const recommendedKey = keyFromBackground(form.elements.background?.value)
    const signature = JSON.stringify({
      hours: baseDraft.hours,
      rate: baseDraft.hourlyRate,
      materials: baseDraft.materials,
      packaging: baseDraft.packaging,
      shipping: baseDraft.shipping,
      indirect: baseDraft.indirectPercent,
      people: baseDraft.people,
      pets: baseDraft.pets,
      urgent: baseDraft.urgent,
      margin: baseDraft.marginPercent,
      deposit: baseDraft.depositPercent,
      recommendedKey,
    })
    if (signature === lastSignature && section.dataset.akEstimatesReady === 'true') return
    lastSignature = signature

    Object.entries(PRESETS).forEach(([key, preset]) => {
      const card = section.querySelector(`[data-ak-acrylic-key="${key}"]`)
      if (!card) return
      const estimate = buildEstimate(baseDraft, preset)
      card.dataset.akHours = String(estimate.hours)
      card.dataset.akBackground = preset.background

      card.querySelector('.ak-acrylic-card__recommended')?.remove()
      card.querySelector('.ak-acrylic-card__meta')?.remove()
      card.querySelector('.ak-acrylic-card__choose')?.remove()

      if (key === recommendedKey) {
        const badge = document.createElement('span')
        badge.className = 'ak-acrylic-card__recommended'
        badge.textContent = 'Recomendado por JoCe'
        card.appendChild(badge)
      }

      const meta = document.createElement('div')
      meta.className = 'ak-acrylic-card__meta'
      meta.innerHTML = `
        <span>Horas estimadas<strong>${estimate.hours} horas</strong></span>
        <span>Precio sugerido<strong>${window.AKPricing.money(estimate.price.suggestedPrice)}</strong></span>
      `
      card.appendChild(meta)

      const choose = document.createElement('span')
      choose.className = 'ak-acrylic-card__choose'
      choose.textContent = 'Seleccionar esta vista'
      card.appendChild(choose)
    })

    section.dataset.akEstimatesReady = 'true'
  }

  const schedule = (delay = 120) => {
    clearTimeout(timer)
    timer = setTimeout(enhance, delay)
  }

  document.addEventListener('click', (event) => {
    const useButton = event.target.closest?.('[data-ak-use-acrylic]')
    if (!useButton) return
    const section = document.getElementById('ak-joce-acrylic-preview')
    const selected = section?.querySelector('.ak-acrylic-card.is-selected')
    const form = document.getElementById('quote-form')
    if (!selected || !form) return

    const hours = Number(selected.dataset.akHours)
    const background = selected.dataset.akBackground
    if (Number.isFinite(hours) && form.elements.hours) form.elements.hours.value = String(hours)
    if (background && form.elements.background) form.elements.background.value = background
    form.elements.hours?.dispatchEvent(new Event('input', { bubbles: true }))
    form.elements.background?.dispatchEvent(new Event('change', { bubbles: true }))
    schedule(250)
  })

  document.addEventListener('input', () => schedule())
  document.addEventListener('change', () => schedule())

  setInterval(enhance, 1000)
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', enhance, { once: true })
  else enhance()
})()
