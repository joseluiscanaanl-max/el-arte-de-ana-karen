(() => {
  'use strict'

  const KEYS = {
    quotes: 'ak-quotes-v1',
    clients: 'ak-clients-v1',
    followups: 'ak-followups-v1',
  }

  const TARGET_STATUS = 'Seguimiento al cliente'

  const load = (key, fallback) => {
    try {
      const raw = localStorage.getItem(key)
      return raw ? JSON.parse(raw) : fallback
    } catch {
      return fallback
    }
  }

  const store = (key, value) => localStorage.setItem(key, JSON.stringify(value))
  const today = () => new Date().toISOString().slice(0, 10)
  const futureDate = (days = 7) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10)

  const formatDate = (value) => {
    if (!value) return ''
    const [year, month, day] = value.split('-')
    return `${day}/${month}/${year}`
  }

  const firstName = (name = '') => name.trim().split(/\s+/)[0] || 'Hola'

  const normalizePhone = (value = '') => {
    let digits = String(value).replace(/\D/g, '')
    if (/^521\d{10}$/.test(digits)) digits = `52${digits.slice(3)}`
    return digits.length >= 11 ? digits : ''
  }

  const getRecord = (quoteId) => {
    const all = load(KEYS.followups, {})
    return all[quoteId] || {}
  }

  const saveRecord = (quoteId, patch) => {
    const all = load(KEYS.followups, {})
    all[quoteId] = {
      ...(all[quoteId] || {}),
      ...patch,
      updatedAt: new Date().toISOString(),
    }
    store(KEYS.followups, all)
    return all[quoteId]
  }

  const updateClientNextAction = (clientId, text) => {
    const clients = load(KEYS.clients, [])
    const index = clients.findIndex((client) => client.id === clientId)
    if (index < 0) return
    clients[index] = { ...clients[index], nextAction: text }
    store(KEYS.clients, clients)
  }

  const messageTemplates = (quote, client) => {
    const name = firstName(client?.name)
    const title = quote?.title || 'tu obra'

    return {
      thanks: {
        label: 'Agradecer y pedir una reseña',
        text: `Hola ${name}. Muchas gracias por confiar en El Arte de Ana Karen para crear “${title}”. Me dio mucho gusto realizar tu obra. ¿Podrías contarme qué te pareció el resultado? Tu opinión me ayuda mucho a seguir creciendo como artista.`,
      },
      photo: {
        label: 'Pedir una foto del cuadro colocado',
        text: `Hola ${name}. Espero que estés disfrutando “${title}”. Cuando tengas oportunidad, ¿podrías enviarme una fotografía del cuadro colocado en su espacio? Me encantará verlo formando parte de tu hogar.`,
      },
      permission: {
        label: 'Pedir permiso para publicarlo',
        text: `Hola ${name}. Me gustaría compartir “${title}” en las redes de El Arte de Ana Karen. ¿Me autorizas a publicar fotografías de la obra? No compartiré tu información personal sin tu permiso.`,
      },
      complete: {
        label: 'Enviar seguimiento completo',
        text: `Hola ${name}. Muchas gracias por confiar en El Arte de Ana Karen para crear “${title}”. Me encantaría saber qué te pareció el resultado. Cuando tengas oportunidad, ¿podrías enviarme una fotografía del cuadro colocado y decirme si me autorizas a compartir la obra en mis redes? Tu opinión y tu apoyo me ayudan mucho a seguir creciendo como artista.`,
      },
    }
  }

  const ensureStyles = () => {
    if (document.getElementById('ak-followup-styles')) return
    const style = document.createElement('style')
    style.id = 'ak-followup-styles'
    style.textContent = `
      .ak-followup-panel {
        margin-top: 16px;
        padding: 18px;
        border: 1px solid rgba(142, 15, 172, .18);
        border-radius: 18px;
        background: linear-gradient(180deg, rgba(255,255,255,.96), rgba(252,244,255,.98));
        box-shadow: 0 14px 34px rgba(94, 7, 149, .08);
      }
      .ak-followup-kicker {
        margin: 0 0 4px;
        color: #e320a1;
        font-size: .76rem;
        font-weight: 900;
        letter-spacing: .12em;
      }
      .ak-followup-panel h4 {
        margin: 0;
        color: #2d075f;
        font-size: 1.1rem;
      }
      .ak-followup-help {
        margin: 6px 0 14px;
        color: #705a7f;
        line-height: 1.45;
      }
      .ak-followup-panel label {
        display: grid;
        gap: 6px;
        color: #321058;
        font-weight: 800;
      }
      .ak-followup-panel select,
      .ak-followup-panel textarea,
      .ak-followup-panel input[type="date"] {
        width: 100%;
        box-sizing: border-box;
        border: 1px solid #e4cbea;
        border-radius: 13px;
        background: #fff;
        color: #2d075f;
        font: inherit;
      }
      .ak-followup-panel select,
      .ak-followup-panel input[type="date"] {
        min-height: 46px;
        padding: 10px 12px;
      }
      .ak-followup-panel textarea {
        min-height: 150px;
        resize: vertical;
        padding: 12px;
        line-height: 1.45;
      }
      .ak-followup-actions {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
        margin-top: 10px;
      }
      .ak-followup-primary,
      .ak-followup-secondary,
      .ak-followup-reminder-button {
        min-height: 46px;
        border-radius: 13px;
        padding: 11px 14px;
        font-weight: 900;
        cursor: pointer;
      }
      .ak-followup-primary {
        border: 0;
        color: #fff;
        background: linear-gradient(135deg, #7e0fa0, #e320a1);
      }
      .ak-followup-secondary,
      .ak-followup-reminder-button {
        border: 1px solid #d9b7e1;
        color: #5f0795;
        background: #fff;
      }
      .ak-followup-status {
        min-height: 20px;
        margin: 8px 0 0;
        color: #685276;
        font-size: .9rem;
      }
      .ak-followup-checks {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 8px;
        margin-top: 16px;
      }
      .ak-followup-checks label {
        display: flex;
        align-items: center;
        gap: 8px;
        min-height: 48px;
        padding: 9px 10px;
        border: 1px solid #ead7ee;
        border-radius: 13px;
        background: #fff;
        font-size: .88rem;
      }
      .ak-followup-checks input {
        width: 20px;
        height: 20px;
        accent-color: #d91a9b;
        flex: 0 0 auto;
      }
      .ak-followup-reminder {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 10px;
        align-items: end;
        margin-top: 16px;
        padding-top: 16px;
        border-top: 1px solid #ead7ee;
      }
      .ak-followup-saved {
        margin: 8px 0 0;
        color: #16834f;
        font-weight: 800;
      }
      @media (max-width: 620px) {
        .ak-followup-actions,
        .ak-followup-checks,
        .ak-followup-reminder {
          grid-template-columns: 1fr;
        }
      }
    `
    document.head.append(style)
  }

  const openWhatsApp = (client, message) => {
    const phone = normalizePhone(client?.whatsapp)
    const destination = phone ? `https://wa.me/${phone}` : 'https://wa.me/'
    window.open(`${destination}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer')
  }

  const copyMessage = async (message) => {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(message)
      return true
    }
    const temp = document.createElement('textarea')
    temp.value = message
    temp.style.position = 'fixed'
    temp.style.opacity = '0'
    document.body.append(temp)
    temp.select()
    const copied = document.execCommand('copy')
    temp.remove()
    return copied
  }

  const createPanel = (card, quote, client) => {
    if (card.querySelector('.ak-followup-panel')) return

    const record = getRecord(quote.id)
    const templates = messageTemplates(quote, client)
    const selectedTemplate = record.lastTemplate && templates[record.lastTemplate]
      ? record.lastTemplate
      : 'thanks'

    const panel = document.createElement('section')
    panel.className = 'ak-followup-panel'
    panel.innerHTML = `
      <p class="ak-followup-kicker">CUIDAR AL CLIENTE</p>
      <h4>Seguimiento después de la entrega</h4>
      <p class="ak-followup-help">Elige un mensaje, revísalo y ábrelo en WhatsApp. Después marca lo que ya recibiste.</p>
      <label>Mensaje
        <select data-followup-template></select>
      </label>
      <label style="margin-top:10px">Texto para el cliente
        <textarea data-followup-message></textarea>
      </label>
      <div class="ak-followup-actions">
        <button type="button" class="ak-followup-primary" data-followup-whatsapp>Abrir en WhatsApp</button>
        <button type="button" class="ak-followup-secondary" data-followup-copy>Copiar mensaje</button>
      </div>
      <p class="ak-followup-status" data-followup-status aria-live="polite"></p>
      <div class="ak-followup-checks" aria-label="Resultados del seguimiento">
        <label><input type="checkbox" data-followup-check="reviewReceived"> Reseña recibida</label>
        <label><input type="checkbox" data-followup-check="photoReceived"> Foto recibida</label>
        <label><input type="checkbox" data-followup-check="permissionGranted"> Permiso para publicar</label>
      </div>
      <div class="ak-followup-reminder">
        <label>Recordarme dar seguimiento
          <input type="date" data-followup-reminder>
        </label>
        <button type="button" class="ak-followup-reminder-button" data-followup-save-reminder>Guardar recordatorio</button>
      </div>
      <p class="ak-followup-saved" data-followup-saved></p>
    `

    const actions = card.querySelector('.action-row')
    if (actions) actions.insertAdjacentElement('beforebegin', panel)
    else card.append(panel)

    const templateSelect = panel.querySelector('[data-followup-template]')
    const messageArea = panel.querySelector('[data-followup-message]')
    const status = panel.querySelector('[data-followup-status]')
    const reminderInput = panel.querySelector('[data-followup-reminder]')
    const savedText = panel.querySelector('[data-followup-saved]')

    Object.entries(templates).forEach(([key, template]) => {
      const option = document.createElement('option')
      option.value = key
      option.textContent = template.label
      option.selected = key === selectedTemplate
      templateSelect.append(option)
    })

    messageArea.value = templates[selectedTemplate].text
    reminderInput.value = record.reminderDate || futureDate(7)
    if (record.reminderDate) savedText.textContent = `Recordatorio guardado para el ${formatDate(record.reminderDate)}.`
    if (record.lastOpenedAt) status.textContent = `Último mensaje abierto el ${new Date(record.lastOpenedAt).toLocaleDateString('es-MX')}.`

    panel.querySelectorAll('[data-followup-check]').forEach((input) => {
      input.checked = Boolean(record[input.dataset.followupCheck])
      input.addEventListener('change', () => {
        saveRecord(quote.id, { [input.dataset.followupCheck]: input.checked })
      })
    })

    templateSelect.addEventListener('change', () => {
      messageArea.value = templates[templateSelect.value].text
      status.textContent = ''
    })

    panel.querySelector('[data-followup-whatsapp]').addEventListener('click', () => {
      const message = messageArea.value.trim()
      if (!message) return
      openWhatsApp(client, message)
      saveRecord(quote.id, {
        lastTemplate: templateSelect.value,
        lastMessage: message,
        lastOpenedAt: new Date().toISOString(),
      })
      status.textContent = client?.whatsapp
        ? 'WhatsApp abierto con el mensaje preparado.'
        : 'WhatsApp abierto. Selecciona el contacto del cliente.'
    })

    panel.querySelector('[data-followup-copy]').addEventListener('click', async () => {
      const message = messageArea.value.trim()
      if (!message) return
      try {
        await copyMessage(message)
        status.textContent = 'Mensaje copiado.'
      } catch {
        status.textContent = 'No fue posible copiar el mensaje.'
      }
    })

    panel.querySelector('[data-followup-save-reminder]').addEventListener('click', () => {
      const reminderDate = reminderInput.value
      if (!reminderDate) {
        savedText.textContent = 'Selecciona una fecha.'
        return
      }
      saveRecord(quote.id, { reminderDate })
      updateClientNextAction(
        quote.clientId,
        `Dar seguimiento a “${quote.title}” el ${formatDate(reminderDate)}`
      )
      savedText.textContent = reminderDate <= today()
        ? 'Recordatorio activo para hoy.'
        : `Recordatorio guardado para el ${formatDate(reminderDate)}.`
    })
  }

  const removePanelsFromOtherStages = () => {
    document.querySelectorAll('.ak-followup-panel').forEach((panel) => {
      const card = panel.closest('.order-card')
      const status = card?.querySelector('.status-pill')?.textContent?.trim()
      if (status !== TARGET_STATUS) panel.remove()
    })
  }

  const patchFollowups = () => {
    ensureStyles()
    removePanelsFromOtherStages()

    const quotes = load(KEYS.quotes, [])
    const clients = load(KEYS.clients, [])
    const quoteMap = new Map(quotes.map((quote) => [quote.id, quote]))
    const clientMap = new Map(clients.map((client) => [client.id, client]))

    document.querySelectorAll('.order-card').forEach((card) => {
      const status = card.querySelector('.status-pill')?.textContent?.trim()
      if (status !== TARGET_STATUS) return

      const quoteId = card.querySelector('select[data-status-id]')?.dataset.statusId
      const quote = quoteMap.get(quoteId)
      if (!quote) return
      createPanel(card, quote, clientMap.get(quote.clientId))
    })
  }

  let scheduled = false
  const schedulePatch = () => {
    if (scheduled) return
    scheduled = true
    requestAnimationFrame(() => {
      scheduled = false
      patchFollowups()
    })
  }

  const start = () => {
    schedulePatch()
    const app = document.getElementById('app')
    if (app) new MutationObserver(schedulePatch).observe(app, { childList: true, subtree: true })
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true })
  } else {
    start()
  }
})()
