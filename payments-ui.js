(() => {
  'use strict'

  const QUOTES_KEY = 'ak-quotes-v1'
  const categoryLabels = {
    deposit: 'Anticipo',
    partial: 'Abono',
    final: 'Pago final',
    legacy: 'Pago inferido',
  }
  const methodLabels = {
    cash: 'Efectivo',
    transfer: 'Transferencia',
    card: 'Tarjeta',
    other: 'Otro',
  }

  const money = (minor) => new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
  }).format(minor / 100)

  const localToday = () => {
    const date = new Date()
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const readQuotes = () => {
    try {
      const parsed = JSON.parse(localStorage.getItem(QUOTES_KEY) || '[]')
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }

  const quoteAmounts = (quote) => ({
    priceMinor: Math.max(0, Math.round(Number(quote?.price?.suggestedPrice || 0) * 100)),
    requiredDepositMinor: Math.max(0, Math.round(Number(quote?.price?.deposit || 0) * 100)),
  })

  const parseAmountMinor = (value) => {
    const normalized = String(value || '').trim().replace(',', '.')
    if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return 0
    const [pesos, cents = ''] = normalized.split('.')
    const amount = Number(pesos) * 100 + Number(cents.padEnd(2, '0'))
    return Number.isSafeInteger(amount) && amount > 0 ? amount : 0
  }

  const movementTitle = (movement) => movement.type === 'reversal'
    ? `Reverso de ${categoryLabels[movement.category] || 'pago'}`
    : categoryLabels[movement.category] || 'Pago'

  const renderHistory = (container, movements) => {
    container.replaceChildren()
    if (!movements.length) {
      const empty = document.createElement('p')
      empty.className = 'payment-empty-history'
      empty.textContent = 'Aún no hay pagos registrados.'
      container.append(empty)
      return
    }

    const list = document.createElement('ol')
    list.className = 'payment-history-list'
    movements.slice().reverse().forEach((movement) => {
      const item = document.createElement('li')
      item.className = `payment-history-item${movement.type === 'reversal' ? ' is-reversal' : ''}`

      const top = document.createElement('div')
      const title = document.createElement('strong')
      title.textContent = movementTitle(movement)
      const amount = document.createElement('b')
      amount.textContent = money(movement.amountMinor)
      top.append(title, amount)
      item.append(top)

      if (movement.migrated && movement.inferred && movement.needsReview) {
        const migrated = document.createElement('p')
        migrated.className = 'payment-migrated-label'
        migrated.textContent = 'Migrado de V1 · pendiente de revisión'
        item.append(migrated)
      } else {
        const details = [movement.occurredOn]
        if (movement.method) details.push(methodLabels[movement.method] || movement.method)
        if (movement.note) details.push(movement.note)
        if (details.filter(Boolean).length) {
          const metadata = document.createElement('p')
          metadata.textContent = details.filter(Boolean).join(' · ')
          item.append(metadata)
        }
      }

      if (movement.type === 'reversal' && movement.correctionReason) {
        const reason = document.createElement('p')
        reason.textContent = `Motivo: ${movement.correctionReason}`
        item.append(reason)
      }
      list.append(item)
    })
    container.append(list)
  }

  const makePaymentSection = (quote) => {
    const section = document.createElement('section')
    section.className = 'order-payments'
    section.dataset.paymentQuoteId = quote.id
    section.innerHTML = `
      <div class="payment-section-heading">
        <div><p>FINANZAS REALES</p><h4>Pagos</h4></div>
        <button type="button" class="payment-open-button">Registrar pago</button>
      </div>
      <div class="payment-storage-warning" role="alert" hidden></div>
      <dl class="payment-summary">
        <div><dt>Precio total</dt><dd data-payment-total></dd></div>
        <div><dt>Anticipo requerido</dt><dd data-payment-deposit></dd></div>
        <div><dt>Total pagado real</dt><dd data-payment-paid></dd></div>
        <div><dt>Saldo pendiente</dt><dd data-payment-balance></dd></div>
      </dl>
      <p class="payment-deposit-status" data-payment-deposit-status></p>
      <details class="payment-history">
        <summary>Historial de movimientos</summary>
        <div data-payment-history></div>
      </details>
      <dialog class="payment-dialog" aria-label="Registrar pago">
        <form class="payment-form">
          <div class="payment-dialog-heading"><h4>Registrar pago</h4><button type="button" class="payment-close-button" aria-label="Cerrar">×</button></div>
          <label>Tipo de pago
            <select name="category" required>
              <option value="deposit">Anticipo</option>
              <option value="partial">Abono</option>
              <option value="final">Pago final</option>
            </select>
          </label>
          <label>Importe en pesos
            <input name="amount" type="text" inputmode="decimal" autocomplete="off" placeholder="0.00" required>
          </label>
          <label>Fecha del pago
            <input name="occurredOn" type="date" required>
          </label>
          <label>Método de pago (opcional)
            <select name="method">
              <option value="">Sin especificar</option>
              <option value="cash">Efectivo</option>
              <option value="transfer">Transferencia</option>
              <option value="card">Tarjeta</option>
              <option value="other">Otro</option>
            </select>
          </label>
          <label>Nota (opcional)
            <textarea name="note" rows="2"></textarea>
          </label>
          <div class="payment-form-error" role="alert" hidden></div>
          <label class="payment-overpayment-warning" hidden>
            <span data-overpayment-message></span>
            <span class="payment-confirm-row"><input type="checkbox" name="confirmOverpayment"> Confirmo que deseo registrar este sobrepago</span>
          </label>
          <button type="submit" class="payment-save-button">Guardar pago</button>
        </form>
      </dialog>`

    const store = window.AKPaymentStorage.createStore(window.localStorage)
    const openButton = section.querySelector('.payment-open-button')
    const warning = section.querySelector('.payment-storage-warning')
    const dialog = section.querySelector('.payment-dialog')
    const form = section.querySelector('.payment-form')
    const error = section.querySelector('.payment-form-error')
    const overpayment = section.querySelector('.payment-overpayment-warning')
    const dateInput = form.elements.occurredOn

    const refresh = () => {
      const loaded = store.load()
      const amounts = quoteAmounts(quote)
      const safeLedger = loaded.ledger
      const summary = window.AKPayments.summarize(safeLedger, quote.id, amounts)

      section.querySelector('[data-payment-total]').textContent = money(summary.priceMinor)
      section.querySelector('[data-payment-deposit]').textContent = money(summary.requiredDepositMinor)
      section.querySelector('[data-payment-paid]').textContent = money(summary.totalPaidMinor)
      section.querySelector('[data-payment-balance]').textContent = money(summary.balanceMinor)
      const depositStatus = section.querySelector('[data-payment-deposit-status]')
      depositStatus.textContent = summary.depositCovered ? 'Anticipo cubierto' : 'Anticipo pendiente'
      depositStatus.classList.toggle('is-covered', summary.depositCovered)
      renderHistory(section.querySelector('[data-payment-history]'), window.AKPayments.movementsFor(safeLedger, quote.id))

      const blocked = loaded.status === 'corrupt' || loaded.status === 'incompatible'
      warning.hidden = !blocked
      warning.textContent = blocked
        ? `No se pueden registrar pagos: el ledger está ${loaded.status === 'corrupt' ? 'dañado' : 'en un esquema incompatible'}. Los datos originales se conservaron sin cambios.`
        : ''
      openButton.disabled = blocked
      openButton.setAttribute('aria-disabled', String(blocked))
      return { loaded, summary }
    }

    openButton.addEventListener('click', () => {
      const state = refresh()
      if (state.loaded.status === 'corrupt' || state.loaded.status === 'incompatible') return
      form.reset()
      dateInput.value = localToday()
      error.hidden = true
      overpayment.hidden = true
      dialog.showModal()
    })

    section.querySelector('.payment-close-button').addEventListener('click', () => dialog.close())
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close()
    })

    form.addEventListener('input', (event) => {
      if (event.target.name === 'amount') {
        form.elements.confirmOverpayment.checked = false
        overpayment.hidden = true
      }
      error.hidden = true
    })

    form.addEventListener('submit', (event) => {
      event.preventDefault()
      const amountMinor = parseAmountMinor(form.elements.amount.value)
      if (!amountMinor) {
        error.textContent = 'Escribe un importe válido mayor que cero, con máximo dos decimales.'
        error.hidden = false
        return
      }

      const current = refresh()
      if (current.loaded.status === 'corrupt' || current.loaded.status === 'incompatible') {
        dialog.close()
        return
      }
      if (amountMinor > current.summary.balanceMinor && !form.elements.confirmOverpayment.checked) {
        overpayment.querySelector('[data-overpayment-message]').textContent = `El importe supera el saldo pendiente de ${money(current.summary.balanceMinor)}.`
        overpayment.hidden = false
        return
      }

      try {
        const ledger = window.AKPayments.appendPayment(current.loaded.ledger, {
          id: crypto.randomUUID ? crypto.randomUUID() : `payment-${Date.now()}-${Math.random()}`,
          quoteId: quote.id,
          category: form.elements.category.value,
          amountMinor,
          occurredOn: form.elements.occurredOn.value,
          method: form.elements.method.value,
          note: form.elements.note.value,
          createdAt: new Date().toISOString(),
        })
        store.save(ledger)
        refresh()
        dialog.close()
      } catch (saveError) {
        error.textContent = `No fue posible guardar el pago: ${saveError.message}`
        error.hidden = false
      }
    })

    refresh()
    return section
  }

  const enhanceOrders = () => {
    if (!window.AKPayments || !window.AKPaymentStorage) return
    const quotes = new Map(readQuotes().map((quote) => [String(quote.id), quote]))
    document.querySelectorAll('.order-card select[data-status-id]').forEach((select) => {
      const quoteId = String(select.dataset.statusId || '')
      const card = select.closest('.order-card')
      const quote = quotes.get(quoteId)
      if (!card || !quote || card.querySelector(`[data-payment-quote-id="${CSS.escape(quoteId)}"]`)) return
      card.append(makePaymentSection(quote))
    })
  }

  const start = () => {
    enhanceOrders()
    const app = document.getElementById('app')
    if (app) new MutationObserver(enhanceOrders).observe(app, { childList: true, subtree: true })
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true })
  else start()
})()
