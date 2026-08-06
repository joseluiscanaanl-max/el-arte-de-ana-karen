(() => {
  'use strict'

  const KEYS = {
    clients: 'ak-clients-v1',
    quotes: 'ak-quotes-v1',
    followups: 'ak-followups-v1',
  }

  const load = (key, fallback) => {
    try {
      const raw = localStorage.getItem(key)
      return raw ? JSON.parse(raw) : fallback
    } catch {
      return fallback
    }
  }

  const store = (key, value) => localStorage.setItem(key, JSON.stringify(value))
  const firstName = (name = '') => name.trim().split(/\s+/)[0] || 'cliente'

  const normalizePhone = (value = '') => {
    let digits = String(value).replace(/\D/g, '')

    if (/^\d{10}$/.test(digits)) digits = `52${digits}`
    if (/^521\d{10}$/.test(digits)) digits = `52${digits.slice(3)}`

    return digits.length >= 11 && digits.length <= 15 ? digits : ''
  }

  const getContext = (panel) => {
    const card = panel?.closest('.order-card')
    const quoteId = card?.querySelector('select[data-status-id]')?.dataset.statusId
    if (!quoteId) return null

    const quote = load(KEYS.quotes, []).find((item) => item.id === quoteId)
    if (!quote) return null

    const client = load(KEYS.clients, []).find((item) => item.id === quote.clientId)
    return { card, quote, client }
  }

  const saveClientPhone = (clientId, phone) => {
    const clients = load(KEYS.clients, [])
    const index = clients.findIndex((client) => client.id === clientId)
    if (index < 0) return false

    clients[index] = { ...clients[index], whatsapp: phone }
    store(KEYS.clients, clients)
    return true
  }

  const saveOpenedMessage = (quoteId, message) => {
    const records = load(KEYS.followups, {})
    records[quoteId] = {
      ...(records[quoteId] || {}),
      lastMessage: message,
      lastOpenedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    store(KEYS.followups, records)
  }

  const openDirectChat = (phone, message) => {
    window.open(
      `https://wa.me/${phone}?text=${encodeURIComponent(message)}`,
      '_blank',
      'noopener,noreferrer'
    )
  }

  const setStatus = (panel, text) => {
    const status = panel.querySelector('[data-followup-status]')
    if (status) status.textContent = text
  }

  const ensureStyles = () => {
    if (document.getElementById('ak-followup-phone-fix-styles')) return

    const style = document.createElement('style')
    style.id = 'ak-followup-phone-fix-styles'
    style.textContent = `
      .ak-phone-required {
        margin-top: 10px;
        padding: 14px;
        border: 1px solid #f0c6df;
        border-radius: 14px;
        background: #fff7fc;
      }
      .ak-phone-required[hidden] { display: none; }
      .ak-phone-required p {
        margin: 0 0 10px;
        color: #5d2455;
        line-height: 1.4;
      }
      .ak-phone-required-row {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 8px;
      }
      .ak-phone-required input {
        min-height: 46px;
        width: 100%;
        box-sizing: border-box;
        padding: 10px 12px;
        border: 1px solid #e4cbea;
        border-radius: 13px;
        background: #fff;
        color: #2d075f;
        font: inherit;
      }
      .ak-phone-required button {
        min-height: 46px;
        padding: 10px 14px;
        border: 0;
        border-radius: 13px;
        color: #fff;
        background: linear-gradient(135deg, #7e0fa0, #e320a1);
        font-weight: 900;
        cursor: pointer;
      }
      .ak-phone-required-error {
        min-height: 18px;
        margin: 7px 0 0 !important;
        color: #b42357 !important;
        font-size: .86rem;
        font-weight: 800;
      }
      @media (max-width: 620px) {
        .ak-phone-required-row { grid-template-columns: 1fr; }
      }
    `
    document.head.append(style)
  }

  const showPhoneForm = (panel, client) => {
    ensureStyles()

    let form = panel.querySelector('.ak-phone-required')
    if (!form) {
      form = document.createElement('div')
      form.className = 'ak-phone-required'
      form.innerHTML = `
        <p><strong>Falta el WhatsApp del cliente.</strong><br>
        Guarda el número para abrir directamente el chat correcto.</p>
        <div class="ak-phone-required-row">
          <input type="tel" inputmode="tel" autocomplete="tel" placeholder="Ej. 833 123 4567" data-ak-phone-input>
          <button type="button" data-ak-save-phone>Guardar y abrir WhatsApp</button>
        </div>
        <p class="ak-phone-required-error" data-ak-phone-error></p>
      `

      const status = panel.querySelector('[data-followup-status]')
      if (status) status.insertAdjacentElement('afterend', form)
      else panel.append(form)
    }

    const name = firstName(client?.name)
    const explanation = form.querySelector('p')
    if (explanation) {
      explanation.innerHTML = `<strong>Falta el WhatsApp de ${name}.</strong><br>Guarda el número para abrir directamente el chat correcto.`
    }

    form.hidden = false
    form.querySelector('[data-ak-phone-error]').textContent = ''
    form.querySelector('[data-ak-phone-input]').focus()
    return form
  }

  const stopOriginalClick = (event) => {
    event.preventDefault()
    event.stopPropagation()
    event.stopImmediatePropagation()
  }

  document.addEventListener('click', (event) => {
    const whatsappButton = event.target.closest('[data-followup-whatsapp]')
    if (whatsappButton) {
      stopOriginalClick(event)

      const panel = whatsappButton.closest('.ak-followup-panel')
      const context = getContext(panel)
      const message = panel?.querySelector('[data-followup-message]')?.value.trim() || ''

      if (!context || !message) {
        setStatus(panel, 'No fue posible preparar el mensaje.')
        return
      }

      const phone = normalizePhone(context.client?.whatsapp)
      if (!phone) {
        showPhoneForm(panel, context.client)
        setStatus(panel, `Agrega el número de WhatsApp de ${firstName(context.client?.name)}.`)
        return
      }

      openDirectChat(phone, message)
      saveOpenedMessage(context.quote.id, message)
      setStatus(panel, `WhatsApp abierto directamente con ${firstName(context.client?.name)}.`)
      return
    }

    const savePhoneButton = event.target.closest('[data-ak-save-phone]')
    if (!savePhoneButton) return

    stopOriginalClick(event)

    const form = savePhoneButton.closest('.ak-phone-required')
    const panel = savePhoneButton.closest('.ak-followup-panel')
    const context = getContext(panel)
    const input = form?.querySelector('[data-ak-phone-input]')
    const error = form?.querySelector('[data-ak-phone-error]')
    const message = panel?.querySelector('[data-followup-message]')?.value.trim() || ''
    const phone = normalizePhone(input?.value)

    if (!context || !phone) {
      if (error) error.textContent = 'Escribe un número válido, por ejemplo 833 123 4567.'
      input?.focus()
      return
    }

    if (!saveClientPhone(context.quote.clientId, phone)) {
      if (error) error.textContent = 'No fue posible guardar el número del cliente.'
      return
    }

    form.hidden = true
    openDirectChat(phone, message)
    saveOpenedMessage(context.quote.id, message)
    setStatus(panel, `Número guardado. WhatsApp abierto directamente con ${firstName(context.client?.name)}.`)
  }, true)
})()
