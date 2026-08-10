(() => {
  'use strict'

  const QUOTES_KEY = 'ak-quotes-v1'
  const FOLLOWUPS_KEY = 'ak-followups-v1'

  const readJson = (key, fallback) => {
    try {
      const raw = localStorage.getItem(key)
      return raw === null ? fallback : JSON.parse(raw)
    } catch {
      return fallback
    }
  }

  const localToday = () => {
    const date = new Date()
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const getQuote = (quoteId) => {
    const quotes = readJson(QUOTES_KEY, [])
    return Array.isArray(quotes) ? quotes.find((quote) => quote?.id === quoteId) || null : null
  }

  const hasFollowup = (quoteId) => {
    const followups = readJson(FOLLOWUPS_KEY, {})
    return Boolean(followups && typeof followups === 'object' && !Array.isArray(followups) && followups[quoteId])
  }

  const paymentState = (quoteId) => {
    if (!window.AKPaymentStorage) return { blocked: true, hasMovements: false, reason: 'no disponible' }
    const loaded = window.AKPaymentStorage.createStore(window.localStorage).load()
    if (loaded.status === 'corrupt' || loaded.status === 'incompatible') {
      return { blocked: true, hasMovements: false, reason: loaded.status }
    }
    return {
      blocked: false,
      hasMovements: loaded.ledger.movements.some((movement) => movement.quoteId === quoteId),
      reason: '',
    }
  }

  const verifyQuoteAndPayments = (quoteId) => {
    const quote = getQuote(quoteId)
    if (!quote) {
      return {
        allowed: false,
        quote: null,
        payments: null,
        message: 'No fue posible verificar este pedido. No se modificó ningún dato.',
      }
    }

    const payments = paymentState(quoteId)
    if (payments.blocked) {
      return {
        allowed: false,
        quote,
        payments,
        message: 'No se puede modificar este pedido porque el historial de pagos no pudo verificarse de forma segura. Restaura o revisa los datos antes de continuar.',
      }
    }

    return { allowed: true, quote, payments, message: '' }
  }

  const deletionDecision = (quoteId) => {
    const verified = verifyQuoteAndPayments(quoteId)
    if (!verified.allowed) return verified

    const { quote, payments } = verified
    if (quote.status !== 'Borrador' || payments.hasMovements || hasFollowup(quoteId)) {
      return {
        allowed: false,
        message: 'Para conservar el historial del taller, solo se pueden eliminar borradores sin pagos ni seguimiento. Si el pedido ya avanzó, usa la etapa “Cancelada” en lugar de borrarlo.',
      }
    }

    return { allowed: true, message: '' }
  }

  const editDecision = (quoteId) => {
    const verified = verifyQuoteAndPayments(quoteId)
    if (!verified.allowed) return verified

    if (verified.payments.hasMovements) {
      return {
        allowed: false,
        message: 'Esta cotización ya tiene pagos registrados. Para conservar importes, saldos e historial financiero, no se puede editar retroactivamente. Si cambian las condiciones, cancela este pedido y crea una nueva cotización.',
      }
    }

    return { allowed: true, message: '' }
  }

  const patchPaymentControls = () => {
    const today = localToday()
    document.querySelectorAll('.order-payments[data-payment-quote-id]').forEach((section) => {
      section.querySelectorAll('input[name="occurredOn"]').forEach((input) => {
        if (input.max !== today) input.max = today
      })

      const quote = getQuote(section.dataset.paymentQuoteId)
      if (!quote || quote.status !== 'Cancelada') return

      const openButton = section.querySelector('.payment-open-button')
      if (openButton) {
        openButton.disabled = true
        openButton.setAttribute('aria-disabled', 'true')
        openButton.title = 'El pedido está cancelado; no se registran pagos nuevos.'
      }

      if (!section.querySelector('.payment-cancelled-note')) {
        const note = document.createElement('p')
        note.className = 'payment-storage-warning payment-cancelled-note'
        note.setAttribute('role', 'status')
        note.textContent = 'Pedido cancelado: el historial financiero se conserva, pero no se pueden registrar pagos nuevos. Las correcciones de movimientos existentes siguen disponibles.'
        const heading = section.querySelector('.payment-section-heading')
        if (heading) heading.insertAdjacentElement('afterend', note)
        else section.prepend(note)
      }
    })
  }

  const quoteIdFromForm = (form) => form.closest('.order-payments')?.dataset.paymentQuoteId || ''
  const dateIsFuture = (value) => Boolean(value) && value > localToday()

  document.addEventListener('click', (event) => {
    const deleteButton = event.target.closest?.('[data-delete-quote]')
    if (deleteButton) {
      const decision = deletionDecision(deleteButton.dataset.deleteQuote)
      if (!decision.allowed) {
        event.preventDefault()
        event.stopImmediatePropagation()
        window.alert(decision.message)
      }
      return
    }

    const editButton = event.target.closest?.('[data-edit-quote]')
    if (!editButton) return
    const decision = editDecision(editButton.dataset.editQuote)
    if (decision.allowed) return

    event.preventDefault()
    event.stopImmediatePropagation()
    window.alert(decision.message)
  }, true)

  document.addEventListener('submit', (event) => {
    const form = event.target
    if (!(form instanceof HTMLFormElement)) return

    if (form.classList.contains('payment-form')) {
      const quote = getQuote(quoteIdFromForm(form))
      if (!quote || quote.status === 'Cancelada') {
        event.preventDefault()
        event.stopImmediatePropagation()
        window.alert(quote ? 'Este pedido está cancelado. No se pueden registrar pagos nuevos.' : 'No fue posible verificar este pedido. No se registró ningún pago.')
        return
      }
      if (dateIsFuture(form.elements.occurredOn?.value)) {
        event.preventDefault()
        event.stopImmediatePropagation()
        window.alert('La fecha de un pago real no puede estar en el futuro.')
      }
      return
    }

    if (form.classList.contains('payment-correction-form') && dateIsFuture(form.elements.occurredOn?.value)) {
      event.preventDefault()
      event.stopImmediatePropagation()
      window.alert('La fecha de una corrección no puede estar en el futuro.')
    }
  }, true)

  const start = () => {
    patchPaymentControls()
    const app = document.getElementById('app')
    if (app) new MutationObserver(patchPaymentControls).observe(app, { childList: true, subtree: true })
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true })
  else start()

  window.AKOrderIntegrity = { deletionDecision, editDecision }
})()
