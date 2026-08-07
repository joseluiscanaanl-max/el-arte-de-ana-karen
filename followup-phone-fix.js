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
  const FOLLOWUP_WARNING = 'Los seguimientos guardados necesitan revisión. No se cambió ningún dato.'
  const readFollowups = () => {
    const raw = localStorage.getItem(KEYS.followups)
    if (raw === null) return { status: 'empty', records: {}, raw: null }
    try {
      const records = JSON.parse(raw)
      if (!records || typeof records !== 'object' || Array.isArray(records)) throw new TypeError('estructura incompatible')
      return { status: 'valid', records, raw }
    } catch {
      return { status: 'invalid', records: null, raw }
    }
  }
  const firstName = (name = '') => name.trim().split(/\s+/)[0] || 'cliente'

  const normalizePhone = (value = '') => {
    let digits = String(value).replace(/\D/g, '')
    if (/^\d{10}$/.test(digits)) digits = `52${digits}`
    if (/^521\d{10}$/.test(digits)) digits = `52${digits.slice(3)}`
    return digits.length >= 11 && digits.length <= 15 ? digits : ''
  }

  const formatPhone = (value = '') => {
    const phone = normalizePhone(value)
    if (/^52\d{10}$/.test(phone)) {
      const local = phone.slice(2)
      return `+52 ${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`
    }
    return phone ? `+${phone}` : 'Sin número guardado'
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
    const current = readFollowups()
    if (current.status === 'invalid') return false
    const records = current.records
    records[quoteId] = {
      ...(records[quoteId] || {}),
      lastMessage: message,
      lastOpenedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    store(KEYS.followups, records)
    return true
  }

  const openDirectChat = (phone, message) => {
    window.open(
      `https://wa.me/${phone}?text=${encodeURIComponent(message)}`,
      '_blank',
      'noopener,noreferrer'
    )
  }

  const setStatus = (panel, text) => {
    const status = panel?.querySelector('[data-followup-status]')
    if (status) status.textContent = text
  }

  const ensureStyles = () => {
    if (document.getElementById('ak-followup-phone-fix-styles')) return

    const style = document.createElement('style')
    style.id = 'ak-followup-phone-fix-styles'
    style.textContent = `
      .ak-phone-summary {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        margin-top: 10px;
        padding: 11px 13px;
        border: 1px solid #ead7ee;
        border-radius: 13px;
        background: #fff;
        color: #4d255f;
      }
      .ak-phone-summary strong { color: #2d075f; }
      .ak-phone-change {
        flex: 0 0 auto;
        min-height: 38px;
        padding: 8px 12px;
        border: 1px solid #d9b7e1;
        border-radius: 11px;
        color: #5f0795;
        background: #fff;
        font-weight: 900;
        cursor: pointer;
      }
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
      .ak-phone-note {
        margin-top: 8px !important;
        color: #705a7f !important;
        font-size: .84rem;
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
        .ak-phone-summary { align-items: flex-start; }
        .ak-phone-required-row { grid-template-columns: 1fr; }
      }
    `
    document.head.append(style)
  }

  const ensurePhoneSummary = (panel) => {
    if (!panel || panel.querySelector('.ak-phone-summary')) return
    const context = getContext(panel)
    if (!context) return

    const summary = document.createElement('div')
    summary.className = 'ak-phone-summary'
    summary.innerHTML = `
      <span><strong>WhatsApp de ${firstName(context.client?.name)}:</strong><br><span data-ak-phone-value></span></span>
      <button type="button" class="ak-phone-change" data-ak-change-phone>Corregir número</button>
    `

    const status = panel.querySelector('[data-followup-status]')
    if (status) status.insertAdjacentElement('afterend', summary)
    else panel.append(summary)
    updatePhoneSummary(panel)
  }

  const updatePhoneSummary = (panel) => {
    const context = getContext(panel)
    const value = panel?.querySelector('[data-ak-phone-value]')
    if (context && value) value.textContent = formatPhone(context.client?.whatsapp)
  }

  const showPhoneForm = (panel, client, prefill = '') => {
    ensureStyles()

    let form = panel.querySelector('.ak-phone-required')
    if (!form) {
      form = document.createElement('div')
      form.className = 'ak-phone-required'
      form.innerHTML = `
        <p data-ak-phone-explanation></p>
        <div class="ak-phone-required-row">
          <input type="tel" inputmode="tel" autocomplete="tel" placeholder="Número real de 10 dígitos" data-ak-phone-input>
          <button type="button" data-ak-save-phone>Guardar y abrir WhatsApp</button>
        </div>
        <p class="ak-phone-note">La aplicación valida el formato. WhatsApp confirma después si el número tiene una cuenta activa.</p>
        <p class="ak-phone-required-error" data-ak-phone-error></p>
      `

      const summary = panel.querySelector('.ak-phone-summary')
      if (summary) summary.insertAdjacentElement('afterend', form)
      else panel.append(form)
    }

    const name = firstName(client?.name)
    const explanation = form.querySelector('[data-ak-phone-explanation]')
    if (explanation) {
      explanation.innerHTML = `<strong>Escribe el WhatsApp real de ${name}.</strong><br>Se guardará en su ficha y abrirá directamente el chat.`
    }

    const input = form.querySelector('[data-ak-phone-input]')
    input.value = prefill || client?.whatsapp || ''
    form.hidden = false
    form.querySelector('[data-ak-phone-error]').textContent = ''
    input.focus()
    input.select()
    return form
  }

  const stopOriginalClick = (event) => {
    event.preventDefault()
    event.stopPropagation()
    event.stopImmediatePropagation()
  }

  const patchPhoneSummaries = () => {
    ensureStyles()
    document.querySelectorAll('.ak-followup-panel').forEach(ensurePhoneSummary)
  }

  document.addEventListener('click', (event) => {
    const changePhoneButton = event.target.closest('[data-ak-change-phone]')
    if (changePhoneButton) {
      stopOriginalClick(event)
      const panel = changePhoneButton.closest('.ak-followup-panel')
      const context = getContext(panel)
      if (!context) return
      showPhoneForm(panel, context.client, context.client?.whatsapp || '')
      setStatus(panel, `Corrige el número de WhatsApp de ${firstName(context.client?.name)}.`)
      return
    }

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
        setStatus(panel, `Agrega el número real de WhatsApp de ${firstName(context.client?.name)}.`)
        return
      }

      if (readFollowups().status === 'invalid') {
        setStatus(panel, FOLLOWUP_WARNING)
        return
      }

      openDirectChat(phone, message)
      saveOpenedMessage(context.quote.id, message)
      setStatus(panel, `WhatsApp abierto con ${firstName(context.client?.name)}. Si WhatsApp rechaza el número, regresa y pulsa “Corregir número”.`)
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
      if (error) error.textContent = 'Escribe el número real con 10 dígitos.'
      input?.focus()
      return
    }

    if (readFollowups().status === 'invalid') {
      if (error) error.textContent = FOLLOWUP_WARNING
      setStatus(panel, FOLLOWUP_WARNING)
      return
    }

    if (!saveClientPhone(context.quote.clientId, phone)) {
      if (error) error.textContent = 'No fue posible guardar el número del cliente.'
      return
    }

    form.hidden = true
    updatePhoneSummary(panel)
    openDirectChat(phone, message)
    saveOpenedMessage(context.quote.id, message)
    setStatus(panel, `Número actualizado. WhatsApp abierto directamente con ${firstName(context.client?.name)}.`)
  }, true)

  const start = () => {
    patchPhoneSummaries()
    const app = document.getElementById('app')
    if (!app) return
    new MutationObserver(patchPhoneSummaries).observe(app, { childList: true, subtree: true })
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start)
  else start()
})()
