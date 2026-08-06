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

  const load = (key, fallback) => {
    try {
      const raw = localStorage.getItem(key)
      return raw ? JSON.parse(raw) : fallback
    } catch {
      return fallback
    }
  }

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
    const quotes = load(KEYS.quotes, []).filter((quote) => normalizeStatus(quote.status) !== 'Cancelada')
    const clientNames = new Map(clients.map((client) => [client.id, client.name || 'Cliente']))
    const byClient = new Map()

    quotes.forEach((quote) => {
      const quoted = priceOf(quote)
      const collected = collectedFor(quote)
      const clientId = quote.clientId || `sin-cliente-${quote.id}`
      const current = byClient.get(clientId) || {
        clientId,
        name: clientNames.get(quote.clientId) || 'Cliente sin nombre',
        works: 0,
        quoted: 0,
        deposits: 0,
        paid: 0,
        difference: 0,
      }

      current.works += 1
      current.quoted += quoted
      current.deposits += collected.deposit
      current.paid += collected.paid
      current.difference += Math.max(0, quoted - collected.paid)
      byClient.set(clientId, current)
    })

    const rows = [...byClient.values()].sort((a, b) => {
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
      .ak-finance-client strong {
        display: block;
        color: #2d075f;
      }
      .ak-finance-client small { color: #80698b; }
      .ak-finance-paid { color: #087d46; font-weight: 900; }
      .ak-finance-difference { color: #b42357; font-weight: 900; }
      .ak-finance-zero { color: #087d46; }
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
      @media (max-width: 620px) {
        .ak-finance-detail-header { padding: 14px; }
        .ak-finance-table { min-width: 650px; }
        .ak-finance-table th,
        .ak-finance-table td { padding: 11px 13px; }
      }
    `
    document.head.append(style)
  }

  const detailMarkup = ({ rows, totals }) => {
    if (!rows.length) {
      return `
        <div class="ak-finance-detail-header">
          <div><h4>Detalle por cliente</h4><p>Anticipos, pagos y diferencia pendiente.</p></div>
        </div>
        <p class="ak-finance-empty">Todavía no hay cotizaciones para mostrar.</p>
      `
    }

    const body = rows.map((row) => `
      <tr>
        <td class="ak-finance-client"><strong>${escapeHtml(row.name)}</strong><small>${row.works} ${row.works === 1 ? 'encargo' : 'encargos'}</small></td>
        <td>${money(row.quoted)}</td>
        <td>${money(row.deposits)}</td>
        <td class="ak-finance-paid">${money(row.paid)}</td>
        <td class="${row.difference ? 'ak-finance-difference' : 'ak-finance-zero'}">${money(row.difference)}</td>
      </tr>
    `).join('')

    return `
      <div class="ak-finance-detail-header">
        <div><h4>Detalle por cliente</h4><p>Cuánto se cotizó, cuánto se recibió y cuánto falta cobrar.</p></div>
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

  const escapeHtml = (value = '') => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')

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
