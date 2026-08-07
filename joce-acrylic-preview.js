(() => {
  'use strict'

  const SECTION_ID = 'ak-joce-acrylic-preview'
  const STYLE_ID = 'ak-joce-acrylic-preview-style'
  const PRESETS = [
    { key:'simple', label:'Fondo sencillo', background:'Sencillo', description:'Simple, limpio y con muy pocos detalles en el fondo.' },
    { key:'medium', label:'Fondo medio', background:'Detallado', description:'Fondo equilibrado, suave y todavía sencillo.' },
    { key:'detailed', label:'Fondo detallado', background:'Muy detallado', description:'Conserva más elementos del entorno.' },
  ]

  let selectedKey = 'simple'
  let lastSignature = ''
  let timer = null

  const injectStyles = () => {
    if (document.getElementById(STYLE_ID)) return
    const style = document.createElement('style')
    style.id = STYLE_ID
    style.textContent = `
      .ak-acrylic-preview{display:grid;gap:12px;padding-top:2px}
      .ak-acrylic-preview__head h4{margin:0;color:var(--purple-900);font-size:1.08rem}
      .ak-acrylic-preview__head p{margin:5px 0 0;color:var(--muted);line-height:1.45}
      .ak-acrylic-preview__grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
      .ak-acrylic-card{position:relative;display:grid;gap:8px;min-width:0;padding:10px;border:2px solid var(--line);border-radius:18px;background:#fffaff;color:var(--purple-900);text-align:left;transition:.18s ease;cursor:pointer}
      .ak-acrylic-card:hover{transform:translateY(-1px);border-color:#dca0d0}
      .ak-acrylic-card.is-selected{border-color:var(--pink-600);background:linear-gradient(145deg,#fffaff,#fdf0fa);box-shadow:0 10px 24px rgba(226,31,151,.13)}
      .ak-acrylic-card canvas{display:block;width:100%;aspect-ratio:var(--ak-photo-aspect,4/3);border-radius:13px;background:#f3eaf6;object-fit:contain}
      .ak-acrylic-card__label{color:var(--pink-600);font-size:.72rem;font-weight:900;letter-spacing:.05em;text-transform:uppercase}
      .ak-acrylic-card__description{color:var(--muted);font-size:.78rem;line-height:1.38}
      .ak-acrylic-card__status{min-height:18px;color:#8a6b92;font-size:.7rem;line-height:1.25}
      .ak-acrylic-card__check{position:absolute;top:17px;right:17px;display:none;width:25px;height:25px;place-items:center;border-radius:50%;background:var(--pink-600);color:#fff;font-weight:900;box-shadow:0 5px 15px rgba(226,31,151,.25)}
      .ak-acrylic-card.is-selected .ak-acrylic-card__check{display:grid}
      .ak-acrylic-preview__selection{display:grid;grid-template-columns:1fr auto;align-items:center;gap:10px;padding:12px 13px;border-radius:15px;background:#fbf2fa;color:#51396a}
      .ak-acrylic-preview__selection strong{color:var(--purple-900)}
      .ak-acrylic-preview__use{min-height:42px;padding:9px 15px;border:0;border-radius:12px;background:linear-gradient(135deg,var(--purple-700),var(--pink-600));color:#fff;font:inherit;font-weight:900;cursor:pointer}
      .ak-acrylic-preview__note{margin:0;color:var(--muted);font-size:.76rem;line-height:1.4}
      @media(max-width:760px){.ak-acrylic-preview__grid{grid-template-columns:1fr}}
      @media(max-width:520px){.ak-acrylic-preview__selection{grid-template-columns:1fr}.ak-acrylic-preview__use{width:100%}}
    `
    document.head.appendChild(style)
  }

  const selectedPreset = () => PRESETS.find((preset) => preset.key === selectedKey) || PRESETS[0]

  const drawReference = (canvas, image, preset) => {
    const maxSide = 720
    const ratio = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight))
    const width = Math.max(1, Math.round(image.naturalWidth * ratio))
    const height = Math.max(1, Math.round(image.naturalHeight * ratio))
    canvas.width = width
    canvas.height = height
    canvas.style.setProperty('--ak-photo-aspect', `${width}/${height}`)
    const ctx = canvas.getContext('2d')
    ctx.drawImage(image, 0, 0, width, height)
    const barHeight = Math.max(38, Math.round(height * .12))
    ctx.fillStyle = 'rgba(54,21,74,.78)'
    ctx.fillRect(0, height - barHeight, width, barHeight)
    ctx.fillStyle = '#fff'
    ctx.font = `700 ${Math.max(13, Math.round(width * .023))}px system-ui,sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(`${preset.label} · referencia para cotización`, width / 2, height - barHeight / 2)
    canvas.dataset.aiReady = 'true'
  }

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
    if (label) label.innerHTML = `Nivel elegido: <strong>${preset.label}</strong>`
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
    if (status) status.textContent = `${preset.label} aplicado. JOCE actualizó la cotización según este nivel de detalle.`
  }

  const renderSection = (image) => {
    injectStyles()
    const result = document.getElementById('ak-analysis-result')
    if (!result) return

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

    selectedKey = 'simple'
    section.innerHTML = `
      <div class="ak-acrylic-preview__head">
        <h4>Referencia del cuadro</h4>
        <p>Elige el nivel de detalle del fondo para que JOCE calcule horas, materiales y precio.</p>
      </div>
      <div class="ak-acrylic-preview__grid">
        ${PRESETS.map((preset) => `
          <button class="ak-acrylic-card" type="button" data-ak-acrylic-key="${preset.key}" aria-pressed="false">
            <span class="ak-acrylic-card__check">✓</span>
            <canvas data-ak-acrylic-canvas="${preset.key}" aria-label="Referencia ${preset.label}"></canvas>
            <strong class="ak-acrylic-card__label">${preset.label}</strong>
            <span class="ak-acrylic-card__description">${preset.description}</span>
            <span class="ak-acrylic-card__status">La obra final será pintada a mano por Ana Karen.</span>
          </button>
        `).join('')}
      </div>
      <div class="ak-acrylic-preview__selection">
        <span data-ak-acrylic-selection></span>
        <button class="ak-acrylic-preview__use" type="button" data-ak-use-acrylic>Usar este nivel</button>
      </div>
      <p class="ak-acrylic-preview__note">V1 estable: la fotografía se usa como referencia de composición. La vista artística con IA queda preparada como mejora futura y no afecta la cotización ni el pedido.</p>
    `

    PRESETS.forEach((preset) => {
      const canvas = section.querySelector(`[data-ak-acrylic-canvas="${preset.key}"]`)
      if (canvas) drawReference(canvas, image, preset)
    })
    updateSelection()
  }

  const ensure = () => {
    const result = document.getElementById('ak-analysis-result')
    const image = document.getElementById('ak-photo-preview')
    if (!result?.classList.contains('is-visible') || !image?.naturalWidth || !image?.naturalHeight) return
    const signature = `${image.currentSrc || image.src}|${image.naturalWidth}x${image.naturalHeight}|stable-v1`
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
      lastSignature = ''
      schedule(220)
    }
  })

  injectStyles()
  setInterval(ensure, 900)
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensure, { once:true })
  else ensure()
})()
