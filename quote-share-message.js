(() => {
  'use strict'

  const QUOTES_KEY = 'ak-quotes-v1'
  const CLIENTS_KEY = 'ak-clients-v1'

  const readList = (key) => {
    try {
      const value = JSON.parse(localStorage.getItem(key) || '[]')
      return Array.isArray(value) ? value : []
    } catch {
      return []
    }
  }

  const money = (value) => window.AKPricing?.money
    ? window.AKPricing.money(value)
    : new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(Number(value) || 0)

  const buildQuoteMessage = (quoteId) => {
    const quotes = readList(QUOTES_KEY)
    const clients = readList(CLIENTS_KEY)
    const quote = quotes.find((item) => item?.id === quoteId)
    if (!quote) return null

    const client = clients.find((item) => item?.id === quote.clientId)
    const clientName = String(client?.name || '').trim()
    const title = String(quote.title || 'tu obra').trim()
    const technique = String(quote.technique || '').trim()
    const notes = String(quote.notes || '').trim()
    const depositPercent = Number(quote.depositPercent) || 0
    const suggestedPrice = quote.price?.suggestedPrice
    const deposit = quote.price?.deposit
    const balance = quote.price?.balance
    const deliveryDate = quote.deliveryDate
      ? new Date(`${quote.deliveryDate}T12:00:00`).toLocaleDateString('es-MX')
      : ''

    const lines = [
      `Hola${clientName ? ` ${clientName}` : ''}.`,
      'Gracias por tu interés en cotizar tu obra con nuestro arte. 🎨',
      '',
      `Te comparto la cotización de tu obra “${title}”.`,
      '',
      technique ? `Técnica: ${technique}` : '',
      quote.width && quote.height ? `Medidas: ${quote.width} × ${quote.height} cm` : '',
      `Material y mano de obra: ${money(suggestedPrice)}`,
      `Anticipo (${depositPercent}%): ${money(deposit)}`,
      `Saldo: ${money(balance)}`,
      deliveryDate ? `Entrega estimada: ${deliveryDate}` : '',
      '',
      'Esta cotización corresponde al material y la mano de obra para realizar la obra.',
      'El empaque y el envío se cotizan por separado.',
      'Para cotizar el envío con mensajería, por favor compártenos el domicilio completo de destino: calle, número, colonia, código postal, ciudad y estado.',
      notes ? '' : null,
      notes || null,
      '',
      'Gracias por confiar en El Arte de Ana Karen.',
    ].filter((line) => line !== null && line !== undefined)

    return {
      title: `Cotización: ${title}`,
      text: lines.join('\n'),
    }
  }

  const showCopiedFeedback = (button) => {
    const original = button.textContent
    button.textContent = 'Copiada para WhatsApp'
    button.disabled = true
    setTimeout(() => {
      button.textContent = original
      button.disabled = false
    }, 1600)
  }

  const shareQuote = async (button) => {
    const payload = buildQuoteMessage(button.dataset.shareQuote)
    if (!payload) return

    try {
      if (navigator.share) {
        await navigator.share(payload)
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(payload.text)
        showCopiedFeedback(button)
      }
    } catch (error) {
      if (error?.name !== 'AbortError' && navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(payload.text)
          showCopiedFeedback(button)
        } catch {}
      }
    }
  }

  document.addEventListener('click', (event) => {
    const button = event.target.closest?.('[data-share-quote]')
    if (!button) return

    event.preventDefault()
    event.stopPropagation()
    event.stopImmediatePropagation()
    void shareQuote(button)
  }, true)

  window.AKQuoteShare = Object.freeze({ buildQuoteMessage })
})()
