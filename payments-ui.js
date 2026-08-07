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
    ? 'Corrección de pago'
    : categoryLabels[movement.category] || 'Pago'

  const renderHistory = (container, movements, options = {}) => {
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
    const reversedIds = new Set(movements
      .filter((movement) => movement.type === 'reversal')
      .map((movement) => movement.reversesMovementId))
    movements.slice().reverse().forEach((movement) => {
      const item = document.createElement('li')
      item.className = `payment-history-item${movement.type === 'reversal' ? ' is-reversal' : ''}`
      item.dataset.movementId = movement.id

      const top = document.createElement('div')
      const title = document.createElement('strong')
      title.textContent = movementTitle(movement)
      const amount = document.createElement('b')
      amount.textContent = money(movement.amountMinor)
      top.append(title, amount)
      item.append(top)

      if (movement.type === 'payment' && reversedIds.has(movement.id)) {
        item.classList.add('is-corrected')
        const corrected = document.createElement('span')
        corrected.className = 'payment-corrected-label'
        corrected.textContent = 'Corregido'
        item.append(corrected)
      }

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
        const original = movements.find((candidate) => candidate.id === movement.reversesMovementId)
        const reference = document.createElement('p')
        reference.className = 'payment-correction-reference'
        reference.textContent = original
          ? `Corrige: ${categoryLabels[original.category] || 'Pago'} · ${money(original.amountMinor)}${original.inferred ? ' · movimiento inferido de V1' : ''}`
          : `Corrige el movimiento ${movement.reversesMovementId}`
        const reason = document.createElement('p')
        reason.textContent = `Motivo: ${movement.correctionReason}`
        item.append(reference, reason)
      }

      if (movement.type === 'payment' && !reversedIds.has(movement.id)) {
        const correctButton = document.createElement('button')
        correctButton.type = 'button'
        correctButton.className = 'payment-correct-button'
        correctButton.textContent = 'Corregir pago'
        correctButton.disabled = Boolean(options.blocked)
        correctButton.addEventListener('click', () => options.onCorrect?.(movement.id))
        item.append(correctButton)
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
      </dialog>
      <dialog class="payment-correction-dialog" aria-label="Corregir pago">
        <form class="payment-correction-form">
          <div class="payment-dialog-heading"><h4>Corregir pago</h4><button type="button" class="payment-correction-close" aria-label="Cerrar corrección">×</button></div>
          <p class="payment-correction-explanation">El pago original no se borrará. Se registrará una corrección por el mismo importe para conservar el historial.</p>
          <p class="payment-correction-target" data-correction-target></p>
          <label>Motivo de la corrección
            <textarea name="correctionReason" rows="2" required></textarea>
          </label>
          <label>Fecha de corrección
            <input name="occurredOn" type="date" required>
          </label>
          <label>Nota (opcional)
            <textarea name="note" rows="2"></textarea>
          </label>
          <div class="payment-correction-error" role="alert" hidden></div>
          <label class="payment-correction-confirm">
            <span class="payment-confirm-row"><input type="checkbox" name="confirmCorrection"> Confirmo que deseo registrar esta corrección sin borrar el pago original</span>
          </label>
          <button type="submit" class="payment-save-button">Guardar corrección</button>
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
    const correctionDialog = section.querySelector('.payment-correction-dialog')
    const correctionForm = section.querySelector('.payment-correction-form')
    const correctionError = section.querySelector('.payment-correction-error')
    let correctionMovementId = null

    const isBlocked = (loaded) => loaded.status === 'corrupt' || loaded.status === 'incompatible'

    const openCorrection = (movementId) => {
      const current = refresh()
      if (isBlocked(current.loaded)) return
      const movements = window.AKPayments.movementsFor(current.loaded.ledger, quote.id)
      const original = movements.find((movement) => movement.id === movementId && movement.type === 'payment')
      const alreadyReversed = movements.some((movement) => movement.type === 'reversal' && movement.reversesMovementId === movementId)
      if (!original || alreadyReversed) return

      correctionMovementId = movementId
      correctionForm.reset()
      correctionForm.elements.occurredOn.value = localToday()
      correctionError.hidden = true
      section.querySelector('[data-correction-target]').textContent = `${categoryLabels[original.category] || 'Pago'} por ${money(original.amountMinor)}${original.inferred ? ' · movimiento inferido de V1' : ''}`
      correctionDialog.showModal()
    }

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
      const blocked = isBlocked(loaded)
      renderHistory(
        section.querySelector('[data-payment-history]'),
        window.AKPayments.movementsFor(safeLedger, quote.id),
        { blocked, onCorrect: openCorrection }
      )

      warning.hidden = !blocked
      warning.textContent = blocked
        ? `No se pueden registrar pagos ni correcciones: el ledger está ${loaded.status === 'corrupt' ? 'dañado' : 'en un esquema incompatible'}. Los datos originales se conservaron sin cambios.`
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

    section.querySelector('.payment-correction-close').addEventListener('click', () => correctionDialog.close())
    correctionDialog.addEventListener('click', (event) => {
      if (event.target === correctionDialog) correctionDialog.close()
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

    correctionForm.addEventListener('input', () => {
      correctionError.hidden = true
    })

    correctionForm.addEventListener('submit', (event) => {
      event.preventDefault()
      const reason = correctionForm.elements.correctionReason.value.trim()
      if (!reason) {
        correctionError.textContent = 'Escribe el motivo de la corrección.'
        correctionError.hidden = false
        return
      }
      if (!correctionForm.elements.confirmCorrection.checked) {
        correctionError.textContent = 'Confirma explícitamente que deseas conservar el pago original y registrar la corrección.'
        correctionError.hidden = false
        return
      }

      const current = refresh()
      if (isBlocked(current.loaded)) {
        correctionDialog.close()
        return
      }

      try {
        const ledger = window.AKPayments.appendReversal(current.loaded.ledger, {
          id: crypto.randomUUID ? crypto.randomUUID() : `reversal-${Date.now()}-${Math.random()}`,
          reversesMovementId: correctionMovementId,
          occurredOn: correctionForm.elements.occurredOn.value,
          note: correctionForm.elements.note.value,
          correctionReason: reason,
          createdAt: new Date().toISOString(),
        })
        store.save(ledger)
        correctionMovementId = null
        refresh()
        correctionDialog.close()
      } catch (saveError) {
        correctionError.textContent = `No fue posible guardar la corrección: ${saveError.message}`
        correctionError.hidden = false
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
