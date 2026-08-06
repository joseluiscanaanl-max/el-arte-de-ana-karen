(() => {
  'use strict'

  const KEYS = {
    clients: 'ak-clients-v1',
    quotes: 'ak-quotes-v1',
  }

  const STAGES = [
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

  const expandedClients = new Set()

  const load = (key, fallback) => {
    try {
      const raw = localStorage.getItem(key)
      return raw ? JSON.parse(raw) : fallback
    } catch {
      return fallback
    }
  }

  const escapeHtml = (value = '') => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')

  const money = (value) => new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 0,
  }).format(Number(value) || 0)

  const normalizeStatus = (value = '') => {
    const status = String(value).trim()
    const aliases = {
      'Esperando aprobación': 'Esperando aprobación de cotización',
      'Anticipo pagado': 'Anticipo recibido',
      'Terminada': 'Obra terminada',
      'Pagada': 'Pago completo',
      'Lista': 'Lista para entregar',
    }
    return aliases[status] || status || 'Borrador'
  }

  const priceOf = (quote) => Math.max(0, Number(quote?.price?.suggestedPrice) || 0)
  const depositOf = (quote) => Math.min(
    priceOf(quote),
    Math.max(0, Number(quote?.price?.deposit) || 0)
  )

  const collectedFor = (quote) => {
    const status = normalizeStatus(quote?.status)
    if (status === 'Cancelada') return { deposit: 0, paid: 0 }

    const stage = STAGES.indexOf(status)
    const depositReceived = stage >= STAGES.indexOf('Anticipo recibido')
      ? depositOf(quote)
      : 0
    const paid = stage >= STAGES.indexOf('Pago completo')
      ? priceOf(quote)
      : depositReceived

    return { deposit: depositReceived, paid }
  }

  const buildSummary = () => {
    const clients = load(KEYS.clients, [])
    const quotes = load(KEYS.quotes, [])
      .filter((quote) => normalizeStatus(quote.status) !== 'Cancelada')
    const clientNames = new Map(clients.map((client) => [client.id, client.name || 'Cliente']))
    const byClient = new Map()

    quotes.forEach((quote) => {
      const quoted = priceOf(quote)
      const collected = collectedFor(quote)
      const difference = Math.max(0, quoted - collected.paid)
      const clientId = quote.clientId || `sin-cliente-${quote.id}`
      const current = byClient.get(clientId) || {
        clientId,
        name: clientNames.get(quote.clientId) || 'Cliente sin nombre',
        works: 0,
        quoted: 0,
        deposits: 0,
        paid: 0,
        difference: 0,
        items: [],
      }

      current.works += 1
      current.quoted += quoted
      current.deposits += collected.deposit
      current.paid += collected.paid
      current.difference += difference
      current.items.push({
        quoteId: quote.id,
        title: quote.title || 'Obra sin nombre',
        status: normalizeStatus(quote.status),
        quoted,
        deposit: collected.deposit,
        paid: collected.paid,
        difference,
      })
      byClient.set(clientId, current)
    })

    const rows = [...byClient.values()]
      .map((row) => ({
        ...row,
        items: row.items.sort((a, b) => {
          if (b.difference !== a.difference) return b.difference - a.difference
          return a.title.localeCompare(b.title, 'es')
        }),
      }))
      .sort((a, b) => {
        if (b.difference !== a.difference) return b.difference - a.difference
        return a.name.localeCompare(b.name, 'es')
      })

    const totals = rows.reduce((sum, row) => ({
      quoted: sum.quoted + row.quoted,
      deposits: sum.deposits + row.deposits,
      paid: sum.paid + row.paid,
      difference: sum.difference + row.difference,
    }), { quoted: 0, deposits: 0, paid: 0, difference: 0 })

    return { rows, totals }
  }

  const ensureStyles = () => {
    if (document.getElementById('ak-finance-summary-styles')) return

    const style = document.createElement('style')
    style.id = 'ak-finance-summary-styles'
    style.textContent = `
      .ak-finance-detail {
        margin-top: 14px;
        overflow: hidden;
        border: 1px solid rgba(142, 15, 172, .16);
        border-radius: 18px;
        background: rgba(255,255,255,.9);
        box-shadow: 0 12px 30px rgba(94, 7, 149, .06);
      }
      .ak-finance-detail-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 16px;
        padding: 16px 18px 12px;
      }
      .ak-finance-detail-header h4 {
        margin: 0;
        color: #2d075f;
        font-size: 1.05rem;
      }
      .ak-finance-detail-header p {
        margin: 4px 0 0;
        color: #705a7f;
        line-height: 1.4;
      }
      .ak-finance-table-wrap { overflow-x: auto; }
      .ak-finance-table {
        width: 100%;
        min-width: 720px;
        border-collapse: collapse;
      }
      .ak-finance-table th,
      .ak-finance-table td {
        padding: 12px 16px;
        border-top: 1px solid #f0e2f2;
        text-align: right;
        white-space: nowrap;
      }
      .ak-finance-table th {
        color: #755681;
        background: #fff9fd;
        font-size: .76rem;
        letter-spacing: .04em;
        text-transform: uppercase;
      }
      .ak-finance-table th:first-child,
      .ak-finance-table td:first-child { text-align: left; }
      .ak-finance-client-button {
        display: inline-flex;
        align-items: center;
        gap: 9px;
        padding: 0;
        border: 0;
        background: transparent;
        color: #2d075f;
        font: inherit;
        text-align: left;
        cursor: pointer;
      }
      .ak-finance-client-button:hover strong,
      .ak-finance-client-button:focus-visible strong { text-decoration: underline; }
      .ak-finance-client-button:focus-visible {
        outline: 3px solid rgba(227, 32, 161, .25);
        outline-offset: 4px;
        border-radius: 6px;
      }
      .ak-finance-client-button strong { display: block; }
      .ak-finance-client-button small {
        display: block;
        margin-top: 2px;
        color: #80698b;
      }
      .ak-finance-chevron {
        display: inline-grid;
        place-items: center;
        width: 22px;
        height: 22px;
        flex: 0 0 22px;
        border-radius: 50%;
        background: #f9e5f6;
        color: #9c118f;
        font-weight: 900;
        transition: transform .2s ease;
      }
      .ak-finance-client-button[aria-expanded="true"] .ak-finance-chevron {
        transform: rotate(90deg);
      }
      .ak-finance-paid { color: #087d46; font-weight: 900; }
      .ak-finance-difference { color: #b42357; font-weight: 900; }
      .ak-finance-zero { color: #087d46; }
      .ak-finance-work-row[hidden] { display: none; }
      .ak-finance-work-row > td {
        padding: 0 16px 15px;
        background: #fffafd;
      }
      .ak-finance-work-list {
        display: grid;
        gap: 10px;
        padding: 12px;
        border: 1px solid #efd9ef;
        border-radius: 14px;
        background: #fff;
      }
      .ak-finance-work-card {
        display: grid;
        grid-template-columns: minmax(180px, 1.5fr) repeat(4, minmax(100px, .75fr));
        gap: 12px;
        align-items: center;
        padding: 12px;
        border-radius: 12px;
        background: #fcf5fc;
      }
      .ak-finance-work-title strong {
        display: block;
        color: #2d075f;
        white-space: normal;
      }
      .ak-finance-work-title small {
        display: block;
        margin-top: 3px;
        color: #80698b;
        white-space: normal;
      }
      .ak-finance-work-value span {
        display: block;
        color: #80698b;
        font-size: .72rem;
        text-transform: uppercase;
      }
      .ak-finance-work-value b {
        display: block;
        margin-top: 3px;
        color: #2d075f;
      }
      .ak-finance-work-value.is-paid b { color: #087d46; }
      .ak-finance-work-value.is-difference b { color: #b42357; }
      .ak-finance-total td {
        background: #fbf2fd;
        color: #2d075f;
        font-weight: 900;
      }
      .ak-finance-note {
        margin: 0;
        padding: 11px 16px 14px;
        border-top: 1px solid #f0e2f2;
        color: #80698b;
        font-size: .82rem;
      }
      .ak-finance-empty {
        margin: 0;
        padding: 18px;
        border-top: 1px solid #f0e2f2;
        color: #705a7f;
        text-align: center;
      }
      @media (max-width: 760px) {
        .ak-finance-work-card {
          grid-template-columns: 1fr 1fr;
        }
        .ak-finance-work-title { grid-column: 1 / -1; }
      }
      @media (max-width: 620px) {
        .ak-finance-detail-header { padding: 14px; }
        .ak-finance-table { min-width: 650px; }
        .ak-finance-table th,
        .ak-finance-table td { padding: 11px 13px; }
      }
    `
    document.head.append(style)
  }

  const workDetailMarkup = (row) => row.items.map((item) => `
    <article class="ak-finance-work-card">
      <div class="ak-finance-work-title">
        <strong>${escapeHtml(item.title)}</strong>
        <small>${escapeHtml(item.status)}</small>
      </div>
      <div class="ak-finance-work-value"><span>Cotizado</span><b>${money(item.quoted)}</b></div>
      <div class="ak-finance-work-value"><span>Anticipo</span><b>${money(item.deposit)}</b></div>
      <div class="ak-finance-work-value is-paid"><span>Pagado</span><b>${money(item.paid)}</b></div>
      <div class="ak-finance-work-value ${item.difference ? 'is-difference' : 'is-paid'}"><span>Diferencia</span><b>${money(item.difference)}</b></div>
    </article>
  `).join('')

  const detailMarkup = ({ rows, totals }) => {
    if (!rows.length) {
      return `
        <div class="ak-finance-detail-header">
          <div><h4>Detalle por cliente</h4><p>Anticipos, pagos y diferencia pendiente.</p></div>
        </div>
        <p class="ak-finance-empty">Todavía no hay cotizaciones para mostrar.</p>
      `
    }

    const body = rows.map((row, index) => {
      const key = `cliente-${index}`
      const expanded = expandedClients.has(row.clientId)
      return `
        <tr>
          <td>
            <button type="button" class="ak-finance-client-button" data-ak-finance-toggle="${escapeHtml(key)}" data-ak-client-id="${escapeHtml(row.clientId)}" aria-expanded="${expanded}">
              <span class="ak-finance-chevron" aria-hidden="true">›</span>
              <span><strong>${escapeHtml(row.name)}</strong><small>${row.works} ${row.works === 1 ? 'encargo' : 'encargos'} · Toca para ver cada obra</small></span>
            </button>
          </td>
          <td>${money(row.quoted)}</td>
          <td>${money(row.deposits)}</td>
          <td class="ak-finance-paid">${money(row.paid)}</td>
          <td class="${row.difference ? 'ak-finance-difference' : 'ak-finance-zero'}">${money(row.difference)}</td>
        </tr>
        <tr class="ak-finance-work-row" data-ak-finance-detail-for="${escapeHtml(key)}" ${expanded ? '' : 'hidden'}>
          <td colspan="5"><div class="ak-finance-work-list">${workDetailMarkup(row)}</div></td>
        </tr>
      `
    }).join('')

    return `
      <div class="ak-finance-detail-header">
        <div><h4>Detalle por cliente</h4><p>Toca el nombre de un cliente para revisar cada cuadro.</p></div>
      </div>
      <div class="ak-finance-table-wrap">
        <table class="ak-finance-table">
          <thead><tr><th>Cliente</th><th>Cotizado</th><th>Anticipos</th><th>Pagado</th><th>Diferencia</th></tr></thead>
          <tbody>
            ${body}
            <tr class="ak-finance-total"><td>Total del taller</td><td>${money(totals.quoted)}</td><td>${money(totals.deposits)}</td><td>${money(totals.paid)}</td><td>${money(totals.difference)}</td></tr>
          </tbody>
        </table>
      </div>
      <p class="ak-finance-note">Calculado según la etapa de cada encargo. Los pedidos cancelados no se incluyen.</p>
    `
  }

  const patchDashboard = () => {
    ensureStyles()

    const heading = [...document.querySelectorAll('.section-heading h3')]
      .find((item) => item.textContent.trim() === 'Tu taller')
    if (!heading) return

    const summarySection = heading.closest('.section-heading')?.parentElement
    const metrics = summarySection?.querySelector('.metrics-grid')
    if (!summarySection || !metrics) return

    const summary = buildSummary()
    const signature = JSON.stringify(summary)
    if (metrics.dataset.akFinanceSignature === signature) return

    metrics.dataset.akFinanceSignature = signature
    metrics.innerHTML = `
      <article><span>Cotizado</span><strong>${money(summary.totals.quoted)}</strong></article>
      <article><span>Anticipos recibidos</span><strong>${money(summary.totals.deposits)}</strong></article>
      <article><span>Pagado</span><strong>${money(summary.totals.paid)}</strong></article>
      <article><span>Diferencia por cobrar</span><strong>${money(summary.totals.difference)}</strong></article>
    `

    let detail = summarySection.querySelector('.ak-finance-detail')
    if (!detail) {
      detail = document.createElement('section')
      detail.className = 'ak-finance-detail'
      metrics.insertAdjacentElement('afterend', detail)
    }
    detail.innerHTML = detailMarkup(summary)
  }

  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-ak-finance-toggle]')
    if (!button) return

    const key = button.dataset.akFinanceToggle
    const clientId = button.dataset.akClientId
    const detail = [...document.querySelectorAll('[data-ak-finance-detail-for]')]
      .find((row) => row.dataset.akFinanceDetailFor === key)
    if (!detail) return

    const willOpen = detail.hidden
    detail.hidden = !willOpen
    button.setAttribute('aria-expanded', String(willOpen))
    if (clientId) {
      if (willOpen) expandedClients.add(clientId)
      else expandedClients.delete(clientId)
    }
  })

  let scheduled = false
  const schedulePatch = () => {
    if (scheduled) return
    scheduled = true
    requestAnimationFrame(() => {
      scheduled = false
      patchDashboard()
    })
  }

  const start = () => {
    schedulePatch()
    const app = document.getElementById('app')
    if (app) new MutationObserver(schedulePatch).observe(app, { childList: true, subtree: true })
    window.addEventListener('storage', schedulePatch)
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start)
  else start()
})()
