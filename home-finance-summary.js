(() => {
  'use strict'

  const KEYS = {
    clients: 'ak-clients-v1',
    quotes: 'ak-quotes-v1',
  }
  const MOBILE_SUMMARY_QUERY = '(max-width: 760px)'
  const mobileSummaryMedia = window.matchMedia(MOBILE_SUMMARY_QUERY)

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

  const money = (minor) => new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
  }).format((Number(minor) || 0) / 100)

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

  const priceOf = (quote) => Math.max(0, Math.round((Number(quote?.price?.suggestedPrice) || 0) * 100))
  const depositOf = (quote) => Math.min(
    priceOf(quote),
    Math.max(0, Math.round((Number(quote?.price?.deposit) || 0) * 100))
  )

  const buildSummary = () => {
    const loadedLedger = window.AKPaymentStorage.createStore(window.localStorage).load()
    if (loadedLedger.status === 'corrupt' || loadedLedger.status === 'incompatible') {
      return {
        unavailable: true,
        ledgerStatus: loadedLedger.status,
        rows: [],
        totals: null,
        hasMigratedMovements: false,
      }
    }

    const ledger = loadedLedger.ledger
    const clients = load(KEYS.clients, [])
    const quotes = load(KEYS.quotes, [])
    const clientNames = new Map(clients.map((client) => [client.id, client.name || 'Cliente']))
    const byClient = new Map()
    let hasMigratedMovements = false

    quotes.forEach((quote) => {
      const quoted = priceOf(quote)
      const requiredDeposit = depositOf(quote)
      const financial = window.AKPayments.summarize(ledger, quote.id, {
        priceMinor: quoted,
        requiredDepositMinor: requiredDeposit,
      })
      const movements = window.AKPayments.movementsFor(ledger, quote.id)
      const includesMigrated = movements.some((movement) => movement.migrated && movement.inferred && movement.needsReview)
      if (includesMigrated) hasMigratedMovements = true
      const coveredDeposit = Math.min(financial.totalPaidMinor, requiredDeposit)
      const clientId = quote.clientId || `sin-cliente-${quote.id}`
      const current = byClient.get(clientId) || {
        clientId,
        name: clientNames.get(quote.clientId) || 'Cliente sin nombre',
        works: 0,
        quoted: 0,
        coveredDeposit: 0,
        paid: 0,
        pending: 0,
        overpayment: 0,
        items: [],
      }

      current.works += 1
      current.quoted += quoted
      current.coveredDeposit += coveredDeposit
      current.paid += financial.totalPaidMinor
      current.pending += financial.balanceMinor
      current.overpayment += financial.overpaymentMinor
      current.items.push({
        quoteId: quote.id,
        title: quote.title || 'Obra sin nombre',
        status: normalizeStatus(quote.status),
        quoted,
        coveredDeposit,
        paid: financial.totalPaidMinor,
        pending: financial.balanceMinor,
        overpayment: financial.overpaymentMinor,
        includesMigrated,
      })
      byClient.set(clientId, current)
    })

    const rows = [...byClient.values()]
      .map((row) => ({
        ...row,
        items: row.items.sort((a, b) => {
          if (b.pending !== a.pending) return b.pending - a.pending
          return a.title.localeCompare(b.title, 'es')
        }),
      }))
      .sort((a, b) => {
        if (b.pending !== a.pending) return b.pending - a.pending
        return a.name.localeCompare(b.name, 'es')
      })

    const totals = rows.reduce((sum, row) => ({
      quoted: sum.quoted + row.quoted,
      coveredDeposit: sum.coveredDeposit + row.coveredDeposit,
      paid: sum.paid + row.paid,
      pending: sum.pending + row.pending,
      overpayment: sum.overpayment + row.overpayment,
    }), { quoted: 0, coveredDeposit: 0, paid: 0, pending: 0, overpayment: 0 })

    return { unavailable: false, rows, totals, hasMigratedMovements }
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
      .ak-finance-mobile-list {
        display: grid;
        gap: 12px;
        padding: 0 14px 14px;
      }
      .ak-finance-mobile-card {
        min-width: 0;
        overflow: hidden;
        border: 1px solid #efd9ef;
        border-radius: 16px;
        background: #fff;
      }
      .ak-finance-mobile-card .ak-finance-client-button {
        width: 100%;
        min-width: 0;
        padding: 14px;
      }
      .ak-finance-mobile-card .ak-finance-client-button > span:last-child {
        min-width: 0;
      }
      .ak-finance-mobile-card .ak-finance-client-button strong,
      .ak-finance-mobile-card .ak-finance-client-button small {
        overflow-wrap: anywhere;
      }
      .ak-finance-mobile-values {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
        margin: 0;
        padding: 0 14px 14px;
      }
      .ak-finance-mobile-values div {
        min-width: 0;
        padding: 10px;
        border-radius: 12px;
        background: #fbf4fa;
      }
      .ak-finance-mobile-values dt {
        color: #80698b;
        font-size: .66rem;
        font-weight: 800;
        line-height: 1.25;
        text-transform: uppercase;
      }
      .ak-finance-mobile-values dd {
        margin: 4px 0 0;
        color: #2d075f;
        font-size: clamp(.8rem, 4vw, .98rem);
        font-weight: 900;
        line-height: 1.2;
        white-space: nowrap;
      }
      .ak-finance-mobile-values .ak-finance-paid { color: #087d46; }
      .ak-finance-mobile-values .ak-finance-difference { color: #b42357; }
      .ak-finance-mobile-values .ak-finance-zero { color: #087d46; }
      .ak-finance-mobile-work-list {
        margin: 0 12px 12px;
      }
      .ak-finance-mobile-work-list[hidden] { display: none; }
      .ak-finance-mobile-total {
        min-width: 0;
        overflow: hidden;
        border: 1px solid #e8d2ed;
        border-radius: 16px;
        background: #fbf2fd;
      }
      .ak-finance-mobile-total h5 {
        margin: 0;
        padding: 14px 14px 10px;
        color: #2d075f;
        font-size: 1rem;
      }
      .ak-finance-mobile-total .ak-finance-mobile-values {
        padding-top: 0;
      }
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
      .ak-finance-unavailable {
        grid-column: 1 / -1;
        padding: 16px;
        border: 1px solid #f1b8b8;
        color: #8f2525;
        background: #fff1f1;
      }
      .ak-finance-overpayment {
        margin: 10px 0 0;
        padding: 9px 11px;
        border-radius: 10px;
        color: #7b4c00;
        background: #fff2cf;
        font-size: .76rem;
        font-weight: 900;
      }
      .ak-finance-migrated-note {
        color: #7b4c00;
        font-weight: 900;
      }
      @media (max-width: 760px) {
        .ak-finance-work-card {
          grid-template-columns: 1fr 1fr;
        }
        .ak-finance-work-title { grid-column: 1 / -1; }
      }
      @media (max-width: 620px) {
        .ak-finance-detail-header { padding: 14px; }
      }
    `
    document.head.append(style)
  }

  const workDetailMarkup = (row) => row.items.map((item) => `
    <article class="ak-finance-work-card" data-ak-finance-quote-id="${escapeHtml(item.quoteId)}">
      <div class="ak-finance-work-title">
        <strong>${escapeHtml(item.title)}</strong>
        <small>${escapeHtml(item.status)}</small>
      </div>
      <div class="ak-finance-work-value"><span>Cotizado</span><b>${money(item.quoted)}</b></div>
      <div class="ak-finance-work-value"><span>Anticipo cubierto</span><b>${money(item.coveredDeposit)}</b></div>
      <div class="ak-finance-work-value is-paid"><span>Pagado</span><b>${money(item.paid)}</b></div>
      <div class="ak-finance-work-value ${item.pending ? 'is-difference' : 'is-paid'}"><span>Pendiente</span><b>${money(item.pending)}</b></div>
      ${item.overpayment ? `<p class="ak-finance-overpayment">Sobrepago: ${money(item.overpayment)}</p>` : ''}
      ${item.includesMigrated ? '<p class="ak-finance-overpayment ak-finance-migrated-note">Incluye información migrada de V1 pendiente de revisión.</p>' : ''}
    </article>
  `).join('')

  const amountValuesMarkup = (amounts) => `
    <dl class="ak-finance-mobile-values">
      <div><dt>Cotizado</dt><dd data-ak-finance-value="quoted">${money(amounts.quoted)}</dd></div>
      <div><dt>Anticipo cubierto</dt><dd data-ak-finance-value="covered-deposit">${money(amounts.coveredDeposit)}</dd></div>
      <div><dt>Pagado</dt><dd class="ak-finance-paid" data-ak-finance-value="paid">${money(amounts.paid)}</dd></div>
      <div><dt>Pendiente</dt><dd class="${amounts.pending ? 'ak-finance-difference' : 'ak-finance-zero'}" data-ak-finance-value="pending">${money(amounts.pending)}</dd></div>
    </dl>
  `

  const mobileDetailMarkup = (rows, totals) => `
    <div class="ak-finance-mobile-list">
      ${rows.map((row, index) => {
        const key = `cliente-movil-${index}`
        const detailId = `ak-finance-mobile-detail-${index}`
        const expanded = expandedClients.has(row.clientId)
        return `
          <article class="ak-finance-mobile-card" data-ak-finance-client-row="${escapeHtml(row.clientId)}">
            <button type="button" class="ak-finance-client-button" data-ak-finance-toggle="${escapeHtml(key)}" data-ak-client-id="${escapeHtml(row.clientId)}" aria-expanded="${expanded}" aria-controls="${escapeHtml(detailId)}">
              <span class="ak-finance-chevron" aria-hidden="true">›</span>
              <span><strong>${escapeHtml(row.name)}</strong><small>${row.works} ${row.works === 1 ? 'encargo' : 'encargos'} · Toca para ver cada obra</small></span>
            </button>
            ${amountValuesMarkup(row)}
            <div id="${escapeHtml(detailId)}" class="ak-finance-work-list ak-finance-mobile-work-list" data-ak-finance-detail-for="${escapeHtml(key)}" ${expanded ? '' : 'hidden'}>${workDetailMarkup(row)}</div>
          </article>
        `
      }).join('')}
      <section class="ak-finance-mobile-total" data-ak-finance-total-row aria-label="Total del taller">
        <h5>Total del taller</h5>
        ${amountValuesMarkup(totals)}
      </section>
    </div>
  `

  const desktopDetailMarkup = (rows, totals) => {
    const body = rows.map((row, index) => {
      const key = `cliente-${index}`
      const expanded = expandedClients.has(row.clientId)
      return `
        <tr data-ak-finance-client-row="${escapeHtml(row.clientId)}">
          <td>
            <button type="button" class="ak-finance-client-button" data-ak-finance-toggle="${escapeHtml(key)}" data-ak-client-id="${escapeHtml(row.clientId)}" aria-expanded="${expanded}">
              <span class="ak-finance-chevron" aria-hidden="true">›</span>
              <span><strong>${escapeHtml(row.name)}</strong><small>${row.works} ${row.works === 1 ? 'encargo' : 'encargos'} · Toca para ver cada obra</small></span>
            </button>
          </td>
          <td data-ak-finance-value="quoted">${money(row.quoted)}</td>
          <td data-ak-finance-value="covered-deposit">${money(row.coveredDeposit)}</td>
          <td class="ak-finance-paid" data-ak-finance-value="paid">${money(row.paid)}</td>
          <td class="${row.pending ? 'ak-finance-difference' : 'ak-finance-zero'}" data-ak-finance-value="pending">${money(row.pending)}</td>
        </tr>
        <tr class="ak-finance-work-row" data-ak-finance-detail-for="${escapeHtml(key)}" ${expanded ? '' : 'hidden'}>
          <td colspan="5"><div class="ak-finance-work-list">${workDetailMarkup(row)}</div></td>
        </tr>
      `
    }).join('')

    return `
      <div class="ak-finance-table-wrap">
        <table class="ak-finance-table">
          <thead><tr><th>Cliente</th><th>Cotizado</th><th>Anticipo cubierto</th><th>Pagado</th><th>Pendiente</th></tr></thead>
          <tbody>
            ${body}
            <tr class="ak-finance-total" data-ak-finance-total-row><td>Total del taller</td><td data-ak-finance-value="quoted">${money(totals.quoted)}</td><td data-ak-finance-value="covered-deposit">${money(totals.coveredDeposit)}</td><td data-ak-finance-value="paid">${money(totals.paid)}</td><td data-ak-finance-value="pending">${money(totals.pending)}</td></tr>
          </tbody>
        </table>
      </div>
    `
  }

  const detailMarkup = ({ unavailable, ledgerStatus, rows, totals, hasMigratedMovements }, useMobileLayout) => {
    if (unavailable) {
      return `
        <div class="ak-finance-detail-header"><div><h4>Detalle por cliente</h4></div></div>
        <p class="ak-finance-empty" role="alert">El resumen financiero no puede calcularse porque el ledger está ${ledgerStatus === 'corrupt' ? 'dañado' : 'en un esquema incompatible'}. Revisa los datos de pagos; la información original se conservó sin cambios.</p>
      `
    }
    if (!rows.length) {
      return `
        <div class="ak-finance-detail-header">
          <div><h4>Detalle por cliente</h4><p>Anticipo cubierto, pagos reales y saldo pendiente.</p></div>
        </div>
        <p class="ak-finance-empty">Todavía no hay cotizaciones para mostrar.</p>
      `
    }

    return `
      <div class="ak-finance-detail-header">
        <div><h4>Detalle por cliente</h4><p>Toca el nombre de un cliente para revisar cada cuadro.</p></div>
      </div>
      ${useMobileLayout ? mobileDetailMarkup(rows, totals) : desktopDetailMarkup(rows, totals)}
      <p class="ak-finance-note">Calculado exclusivamente con los movimientos reales del ledger.${hasMigratedMovements ? ' <span class="ak-finance-migrated-note">Puede existir información migrada de V1 pendiente de revisión.</span>' : ''}${totals.overpayment ? ` <span class="ak-finance-overpayment">Sobrepago total: ${money(totals.overpayment)}</span>` : ''}</p>
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
    const useMobileLayout = mobileSummaryMedia.matches
    const signature = JSON.stringify({ summary, useMobileLayout })
    if (metrics.dataset.akFinanceSignature === signature) return

    metrics.dataset.akFinanceSignature = signature
    metrics.innerHTML = summary.unavailable
      ? '<article class="ak-finance-unavailable" role="alert">Resumen financiero no disponible hasta revisar el ledger de pagos.</article>'
      : `
        <article data-ak-finance-metric="quoted"><span>Cotizado</span><strong>${money(summary.totals.quoted)}</strong></article>
        <article data-ak-finance-metric="covered-deposit"><span>Anticipo cubierto</span><strong>${money(summary.totals.coveredDeposit)}</strong></article>
        <article data-ak-finance-metric="paid"><span>Pagado</span><strong>${money(summary.totals.paid)}</strong></article>
        <article data-ak-finance-metric="pending"><span>Pendiente</span><strong>${money(summary.totals.pending)}</strong></article>
      `

    let detail = summarySection.querySelector('.ak-finance-detail')
    if (!detail) {
      detail = document.createElement('section')
      detail.className = 'ak-finance-detail'
      metrics.insertAdjacentElement('afterend', detail)
    }
    detail.innerHTML = detailMarkup(summary, useMobileLayout)
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
    if (mobileSummaryMedia.addEventListener) mobileSummaryMedia.addEventListener('change', schedulePatch)
    else if (mobileSummaryMedia.addListener) mobileSummaryMedia.addListener(schedulePatch)
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start)
  else start()
})()
