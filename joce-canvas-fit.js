(() => {
  'use strict'

  const STYLE_ID = 'ak-joce-canvas-fit-style'
  const NOTE_ID = 'ak-canvas-fit-note'
  let timer = null

  const injectStyles = () => {
    if (document.getElementById(STYLE_ID)) return
    const style = document.createElement('style')
    style.id = STYLE_ID
    style.textContent = `
      .ak-canvas-option__fit { display: inline-flex; align-items: center; width: fit-content; max-width: 100%; padding: 5px 8px; border-radius: 999px; font-size: .7rem; font-weight: 850; line-height: 1.2; }
      .ak-canvas-option__fit.is-excellent { background: #eaf8ef; color: #08743c; }
      .ak-canvas-option__fit.is-good { background: #f2f5e8; color: #5b6812; }
      .ak-canvas-option__fit.is-light-crop { background: #fff3df; color: #8a5300; }
      .ak-canvas-option__fit.is-adapt { background: #fde9ef; color: #a31348; }
      .ak-canvas-fit-note { margin: 0; padding: 11px 13px; border-radius: 13px; background: #f7effa; color: #5d4771; font-size: .82rem; line-height: 1.45; }
      .ak-canvas-fit-note strong { color: var(--purple-900); }
    `
    document.head.appendChild(style)
  }

  const parseSize = (button) => {
    const value = button.querySelector('.ak-canvas-option__size')?.textContent || ''
    const match = value.match(/(\d+(?:\.\d+)?)\s*[×x]\s*(\d+(?:\.\d+)?)/i)
    if (!match) return null
    const width = Number(match[1])
    const height = Number(match[2])
    return width > 0 && height > 0 ? { width, height } : null
  }

  const fitData = (photoAspect, canvasAspect) => {
    const retained = Math.max(0, Math.min(1, Math.min(photoAspect / canvasAspect, canvasAspect / photoAspect)))
    const fitPercent = Math.round(retained * 100)
    const cropPercent = Math.max(0, 100 - fitPercent)

    if (fitPercent >= 96) {
      return { fitPercent, cropPercent, className: 'is-excellent', label: 'Ajuste excelente' }
    }
    if (fitPercent >= 90) {
      return { fitPercent, cropPercent, className: 'is-good', label: 'Ajuste muy bueno' }
    }
    if (fitPercent >= 82) {
      return { fitPercent, cropPercent, className: 'is-light-crop', label: 'Recorte ligero' }
    }
    return { fitPercent, cropPercent, className: 'is-adapt', label: 'Conviene adaptar' }
  }

  const selectedButton = (section) => section.querySelector('.ak-canvas-option.is-selected') || section.querySelector('.ak-canvas-option')

  const updateNote = (section) => {
    const button = selectedButton(section)
    if (!button?.dataset.akFitPercent) return

    let note = document.getElementById(NOTE_ID)
    if (!note) {
      note = document.createElement('p')
      note.id = NOTE_ID
      note.className = 'ak-canvas-fit-note'
      const grid = section.querySelector('.ak-canvas-sizes__grid')
      grid?.insertAdjacentElement('afterend', note)
    }

    const fitPercent = Number(button.dataset.akFitPercent)
    const cropPercent = Number(button.dataset.akCropPercent)
    const label = button.dataset.akFitLabel || 'Compatibilidad calculada'
    const cropText = cropPercent <= 4
      ? 'prácticamente no requiere recorte'
      : `podría requerir ajustar cerca del ${cropPercent}% de la composición`

    note.innerHTML = `<strong>${label}:</strong> este tamaño conserva aproximadamente el ${fitPercent}% de la foto y ${cropText}. JoCe recomienda confirmar que rostros, manos y elementos importantes queden dentro del encuadre.`
  }

  const enhance = () => {
    injectStyles()
    const section = document.getElementById('ak-joce-canvas-sizes')
    const preview = document.getElementById('ak-photo-preview')
    if (!section || !preview?.naturalWidth || !preview?.naturalHeight) return

    const photoAspect = preview.naturalWidth / preview.naturalHeight
    const buttons = [...section.querySelectorAll('.ak-canvas-option')]
    if (!buttons.length) return

    buttons.forEach((button) => {
      const size = parseSize(button)
      if (!size) return
      const fit = fitData(photoAspect, size.width / size.height)
      button.dataset.akFitPercent = String(fit.fitPercent)
      button.dataset.akCropPercent = String(fit.cropPercent)
      button.dataset.akFitLabel = fit.label

      let badge = button.querySelector('.ak-canvas-option__fit')
      if (!badge) {
        badge = document.createElement('span')
        badge.className = 'ak-canvas-option__fit'
        const meta = button.querySelector('.ak-canvas-option__meta')
        meta?.insertAdjacentElement('afterend', badge)
      }
      badge.className = `ak-canvas-option__fit ${fit.className}`
      badge.textContent = `${fit.label} · conserva ${fit.fitPercent}%`
    })

    updateNote(section)
  }

  const schedule = (delay = 80) => {
    clearTimeout(timer)
    timer = setTimeout(enhance, delay)
  }

  document.addEventListener('click', (event) => {
    if (event.target.closest?.('[data-ak-canvas-key]')) schedule(30)

    if (event.target.closest?.('[data-ak-apply-analysis]')) {
      setTimeout(() => {
        const section = document.getElementById('ak-joce-canvas-sizes')
        const button = section && selectedButton(section)
        const status = document.getElementById('ak-analysis-status')
        if (!button || !status) return
        const fitPercent = button.dataset.akFitPercent
        const cropPercent = button.dataset.akCropPercent
        if (!fitPercent) return
        status.textContent += ` Compatibilidad con la foto: ${fitPercent}%; ajuste estimado: ${cropPercent}% de la composición.`
      }, 70)
    }
  })

  document.addEventListener('change', (event) => {
    if (event.target?.id === 'ak-reference-photo' || event.target?.closest?.('#quote-form')) schedule(180)
  })

  injectStyles()
  setInterval(enhance, 900)
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', enhance, { once: true })
  else enhance()
})()
