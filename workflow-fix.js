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

  const makeOption = (value, selected = false) => {
    const option = document.createElement('option')
    option.value = value
    option.textContent = value
    option.selected = selected
    return option
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
        if (select.dataset.workflowFix === key) return
        select.innerHTML = ''
        select.append(makeOption('Pedido cancelado', true))
        select.disabled = true
        select.dataset.workflowFix = key
        return
      }

      const index = workflow.indexOf(currentStatus)
      const safeIndex = index >= 0 ? index : 0
      const nextStatus = workflow[safeIndex + 1] || null

      if (!nextStatus) {
        const key = 'completado'
        if (select.dataset.workflowFix === key) return
        select.innerHTML = ''
        select.append(makeOption('Proceso completado', true))
        select.disabled = true
        select.dataset.workflowFix = key
        return
      }

      const futureStatuses = [...workflow.slice(safeIndex + 1), 'Cancelada']
      const key = `${currentStatus}|${futureStatuses.join('|')}`
      if (select.dataset.workflowFix === key) return

      select.disabled = false
      select.innerHTML = ''
      futureStatuses.forEach((status) => select.append(makeOption(status, status === nextStatus)))
      select.value = nextStatus
      select.dataset.workflowFix = key
    })
  }

  let scheduled = false
  const applyFixes = () => {
    if (scheduled) return
    scheduled = true
    requestAnimationFrame(() => {
      scheduled = false
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
