(() => {
  'use strict'

  const QUOTES_KEY = 'ak-quotes-v1'
  const RETURN_VIEW_KEY = 'ak-workflow-return-view'
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

  const depositRequiredStatuses = new Set([
    'Boceto en proceso',
    'Esperando aprobación del boceto',
    'Boceto aprobado',
    'Pintura en proceso',
    'Obra terminada',
    'Esperando saldo',
  ])

  const fullPaymentRequiredStatuses = new Set([
    'Pago completo',
    'Lista para entregar',
    'Entregada',
    'Seguimiento al cliente',
  ])

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
      .workflow-confirm-button:disabled {
        opacity: .7;
        cursor: wait;
      }
      .workflow-confirm-button:focus-visible {
        outline: 3px solid rgba(227, 32, 161, .25);
        outline-offset: 2px;
      }
      .workflow-financial-warning {
        margin: 10px 0 0;
        padding: 11px 12px;
        border: 1px solid #efc173;
        border-radius: 12px;
        color: #754700;
        background: #fff6dd;
        font-size: .78rem;
        font-weight: 800;
        line-height: 1.45;
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

  const saveStatus = (quoteId, targetStatus) => {
    const quotes = readQuotes()
    const index = quotes.findIndex((quote) => quote.id === quoteId)
    if (index < 0) return false

    quotes[index] = {
      ...quotes[index],
      status: targetStatus,
      updatedAt: new Date().toISOString(),
    }
    localStorage.setItem(QUOTES_KEY, JSON.stringify(quotes))

    const verification = readQuotes().find((quote) => quote.id === quoteId)
    return verification?.status === targetStatus
  }

  const rememberOrdersView = () => {
    try {
      sessionStorage.setItem(RETURN_VIEW_KEY, 'pedidos')
    } catch {}
  }

  const restoreOrdersView = () => {
    try {
      if (sessionStorage.getItem(RETURN_VIEW_KEY) !== 'pedidos') return
      sessionStorage.removeItem(RETURN_VIEW_KEY)
      document.querySelector('[data-view="pedidos"]')?.click()
    } catch {}
  }

  const money = (minor) => new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
  }).format(minor / 100)

  const financialRequirement = (status) => {
    if (status === 'Anticipo recibido') return 'positive-payment'
    if (depositRequiredStatuses.has(status)) return 'deposit-covered'
    if (fullPaymentRequiredStatuses.has(status)) return 'paid-in-full'
    return null
  }

  const financialSummary = (quote) => {
    const loaded = window.AKPaymentStorage.createStore(window.localStorage).load()
    if (loaded.status === 'corrupt' || loaded.status === 'incompatible') {
      return { blocked: true, ledgerStatus: loaded.status, summary: null }
    }

    const priceMinor = Math.max(0, Math.round((Number(quote?.price?.suggestedPrice) || 0) * 100))
    const requiredDepositMinor = Math.min(
      priceMinor,
      Math.max(0, Math.round((Number(quote?.price?.deposit) || 0) * 100))
    )
    return {
      blocked: false,
      ledgerStatus: loaded.status,
      summary: window.AKPayments.summarize(loaded.ledger, quote.id, { priceMinor, requiredDepositMinor }),
    }
  }

  const validateFinancialTransition = (quote, targetStatus) => {
    if (targetStatus === 'Cancelada') return { allowed: true, message: '' }
    const requirement = financialRequirement(targetStatus)
    if (!requirement) return { allowed: true, message: '' }

    const financial = financialSummary(quote)
    if (financial.blocked) {
      return {
        allowed: false,
        message: `No se puede confirmar este avance porque el ledger de pagos está ${financial.ledgerStatus === 'corrupt' ? 'dañado' : 'en un esquema incompatible'}. Revisa los datos antes de continuar.`,
      }
    }

    const summary = financial.summary
    if (requirement === 'positive-payment' && summary.totalPaidMinor <= 0) {
      return { allowed: false, message: 'Primero registra un pago para confirmar Anticipo recibido.' }
    }
    if (requirement === 'deposit-covered' && !summary.depositCovered) {
      return {
        allowed: false,
        message: `Faltan ${money(summary.requiredDepositMinor - summary.totalPaidMinor)} para cubrir el anticipo antes de comenzar el boceto.`,
      }
    }
    if (requirement === 'paid-in-full' && (!summary.paidInFull || summary.balanceMinor !== 0)) {
      return {
        allowed: false,
        message: `Faltan ${money(summary.balanceMinor)} para marcar este pedido como Pago completo.`,
      }
    }
    return { allowed: true, message: '' }
  }

  const patchFinancialWarning = (card, quote, currentStatus) => {
    if (!card) return
    const requirement = financialRequirement(currentStatus)
    const validation = requirement
      ? validateFinancialTransition(quote, currentStatus)
      : { allowed: true, message: '' }
    let warning = card.querySelector('.workflow-financial-warning')

    if (validation.allowed) {
      warning?.remove()
      return
    }
    if (!warning) {
      warning = document.createElement('p')
      warning.className = 'workflow-financial-warning'
      warning.setAttribute('role', 'alert')
      const payments = card.querySelector('.order-payments')
      if (payments) payments.insertAdjacentElement('beforebegin', warning)
      else card.append(warning)
    }
    const message = `Atención financiera: ${validation.message}`
    if (warning.textContent !== message) warning.textContent = message
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
        if (!quoteId || !targetStatus) return

        button.disabled = true
        button.textContent = 'Guardando avance…'

        const quote = readQuotes().find((item) => item.id === quoteId)
        const validation = quote
          ? validateFinancialTransition(quote, targetStatus)
          : { allowed: false, message: 'No fue posible encontrar este pedido.' }
        if (!validation.allowed) {
          button.disabled = false
          updateButtonText(button, select)
          patchFinancialWarning(card, quote, aliases[quote?.status] || quote?.status)
          window.alert(validation.message)
          return
        }

        if (!saveStatus(quoteId, targetStatus)) {
          button.disabled = false
          updateButtonText(button, select)
          window.alert('No fue posible guardar el avance. Inténtalo nuevamente.')
          return
        }

        rememberOrdersView()
        window.setTimeout(() => window.location.reload(), 80)
      })
    }

    if (select.dataset.workflowGuard !== '1') {
      select.addEventListener('change', (event) => {
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

      patchFinancialWarning(card, quote, currentStatus)

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
    restoreOrdersView()
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
