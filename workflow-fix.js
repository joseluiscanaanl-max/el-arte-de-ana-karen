(() => {
  'use strict'

  const QUOTES_KEY = 'ak-quotes-v1'
  const workflow = [
    'Borrador',
    'Cotización enviada',
    'Esperando aprobación de cotización',
    'Esperando anticipo',
    'Anticipo recibido',
    'Boceto en proceso',
    'Esperando aprobación del boceto',
    'Boceto aprobado',
    'Pintura en proceso',
    'Obra terminada',
    'Esperando saldo',
    'Pago completo',
    'Lista para entregar',
    'Entregada',
    'Seguimiento al cliente',
  ]

  const aliases = {
    'Esperando aprobación': 'Esperando aprobación de cotización',
  }

  const readQuotes = () => {
    try {
      const raw = localStorage.getItem(QUOTES_KEY)
      return raw ? JSON.parse(raw) : []
    } catch {
      return []
    }
  }

  const normalizeQuotes = () => {
    const quotes = readQuotes()
    let changed = false
    const normalized = quotes.map((quote) => {
      const status = aliases[quote.status] || quote.status
      if (status !== quote.status) changed = true
      return { ...quote, status }
    })
    if (changed) localStorage.setItem(QUOTES_KEY, JSON.stringify(normalized))
    return normalized
  }

  const patchHeader = () => {
    const topbar = document.querySelector('.topbar')
    if (!topbar || topbar.querySelector('.brand-wrap')) return

    const mark = topbar.querySelector('.brand-mark')
    const oldCopy = mark?.nextElementSibling
    if (!mark || !oldCopy) return

    const wrap = document.createElement('div')
    wrap.className = 'brand-wrap'
    wrap.innerHTML = `
      <img class="brand-logo" src="./icon.svg" alt="El Arte de Ana Karen">
      <div class="brand-copy">
        <p class="eyebrow">EL ARTE DE ANA KAREN</p>
        <h1>Mi taller creativo</h1>
      </div>`

    topbar.insertBefore(wrap, mark)
    mark.remove()
    oldCopy.remove()
  }

  const ensureStyles = () => {
    if (document.getElementById('workflow-fix-styles')) return
    const style = document.createElement('style')
    style.id = 'workflow-fix-styles'
    style.textContent = `
      .workflow-confirm-button {
        width: 100%;
        min-height: 46px;
        margin-top: 10px;
        border: 0;
        border-radius: 14px;
        padding: 12px 16px;
        color: white;
        background: linear-gradient(135deg, #7e0fa0, #e320a1);
        font-weight: 900;
        box-shadow: 0 10px 24px rgba(126, 15, 160, .18);
      }
      .workflow-confirm-button:focus-visible {
        outline: 3px solid rgba(227, 32, 161, .25);
        outline-offset: 2px;
      }
    `
    document.head.append(style)
  }

  const makeOption = (value, selected = false) => {
    const option = document.createElement('option')
    option.value = value
    option.textContent = value
    option.selected = selected
    return option
  }

  const removeConfirmButton = (card) => {
    card?.querySelector('.workflow-confirm-button')?.remove()
  }

  const updateButtonText = (button, select) => {
    const target = select.value
    button.textContent = target === 'Cancelada'
      ? 'Confirmar cancelación'
      : `Confirmar avance a “${target}”`
  }

  const saveFallback = (quoteId, targetStatus) => {
    const quotes = readQuotes()
    const index = quotes.findIndex((quote) => quote.id === quoteId)
    if (index < 0) return false
    quotes[index] = {
      ...quotes[index],
      status: targetStatus,
      updatedAt: new Date().toISOString(),
    }
    localStorage.setItem(QUOTES_KEY, JSON.stringify(quotes))
    return true
  }

  const ensureConfirmButton = (select) => {
    const card = select.closest('.order-card')
    const field = select.closest('.status-select') || select.parentElement
    if (!card || !field) return

    let button = card.querySelector('.workflow-confirm-button')
    if (!button) {
      button = document.createElement('button')
      button.type = 'button'
      button.className = 'workflow-confirm-button'
      field.insertAdjacentElement('afterend', button)

      button.addEventListener('click', () => {
        const quoteId = select.dataset.statusId
        const targetStatus = select.value
        const beforeStatus = readQuotes().find((quote) => quote.id === quoteId)?.status

        select.dataset.workflowConfirming = '1'
        select.dispatchEvent(new Event('change', { bubbles: true }))

        window.setTimeout(() => {
          const afterStatus = readQuotes().find((quote) => quote.id === quoteId)?.status
          if (afterStatus === targetStatus) return

          if (afterStatus === beforeStatus && saveFallback(quoteId, targetStatus)) {
            window.location.reload()
          }
        }, 150)
      })
    }

    if (select.dataset.workflowGuard !== '1') {
      select.addEventListener('change', (event) => {
        if (select.dataset.workflowConfirming === '1') {
          delete select.dataset.workflowConfirming
          return
        }
        event.stopImmediatePropagation()
        updateButtonText(button, select)
      }, true)
      select.dataset.workflowGuard = '1'
    }

    updateButtonText(button, select)
  }

  const patchOrderSelects = () => {
    const quotes = normalizeQuotes()
    const quoteMap = new Map(quotes.map((quote) => [quote.id, quote]))

    document.querySelectorAll('select[data-status-id]').forEach((select) => {
      const quote = quoteMap.get(select.dataset.statusId)
      if (!quote) return

      const currentStatus = aliases[quote.status] || quote.status
      const card = select.closest('.order-card')
      const pill = card?.querySelector('.status-pill')
      if (pill && pill.textContent !== currentStatus) pill.textContent = currentStatus

      if (currentStatus === 'Cancelada') {
        const key = 'cancelada'
        if (select.dataset.workflowFix !== key) {
          select.innerHTML = ''
          select.append(makeOption('Pedido cancelado', true))
          select.disabled = true
          select.dataset.workflowFix = key
        }
        removeConfirmButton(card)
        return
      }

      const index = workflow.indexOf(currentStatus)
      const safeIndex = index >= 0 ? index : 0
      const nextStatus = workflow[safeIndex + 1] || null

      if (!nextStatus) {
        const key = 'completado'
        if (select.dataset.workflowFix !== key) {
          select.innerHTML = ''
          select.append(makeOption('Proceso completado', true))
          select.disabled = true
          select.dataset.workflowFix = key
        }
        removeConfirmButton(card)
        return
      }

      const futureStatuses = [...workflow.slice(safeIndex + 1), 'Cancelada']
      const key = `${currentStatus}|${futureStatuses.join('|')}`
      if (select.dataset.workflowFix !== key) {
        select.disabled = false
        select.innerHTML = ''
        futureStatuses.forEach((status) => select.append(makeOption(status, status === nextStatus)))
        select.value = nextStatus
        select.dataset.workflowFix = key
      }

      ensureConfirmButton(select)
    })
  }

  let scheduled = false
  const applyFixes = () => {
    if (scheduled) return
    scheduled = true
    requestAnimationFrame(() => {
      scheduled = false
      ensureStyles()
      patchHeader()
      patchOrderSelects()
    })
  }

  const start = () => {
    applyFixes()
    const app = document.getElementById('app')
    if (!app) return
    new MutationObserver(applyFixes).observe(app, { childList: true, subtree: true })
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true })
  } else {
    start()
  }
})()
