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

  window.AKOrderIntegrity = { deletionDecision, editDecision }
})()
