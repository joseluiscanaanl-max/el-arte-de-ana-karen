(() => {
  'use strict'

  const CLIENTS_KEY = 'ak-clients-v1'
  const QUOTES_KEY = 'ak-quotes-v1'
  const EXAMPLE_QUOTE_IDS = new Set(['quote-example'])

  const readList = (key) => {
    try {
      const value = JSON.parse(localStorage.getItem(key) || '[]')
      return Array.isArray(value) ? value : []
    } catch {
      return []
    }
  }

  const isExampleQuote = (quote) => Boolean(
    quote?.isExample === true
    || quote?.example === true
    || EXAMPLE_QUOTE_IDS.has(String(quote?.id || ''))
  )

  const priceOf = (quote) => Math.max(0, Math.round((Number(quote?.price?.suggestedPrice) || 0) * 100))
  const depositOf = (quote) => Math.min(
    priceOf(quote),
    Math.max(0, Math.round((Number(quote?.price?.deposit) || 0) * 100))
  )

  const money = (minor) => new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
  }).format((Number(minor) || 0) / 100)

  const buildRealFinance = () => {
    if (!window.AKPaymentStorage?.createStore || !window.AKPayments?.summarize) return null

    const loaded = window.AKPaymentStorage.createStore(window.localStorage).load()
    if (loaded.status === 'corrupt' || loaded.status === 'incompatible') return null

    const clients = readList(CLIENTS_KEY)
    const quotes = readList(QUOTES_KEY).filter((quote) => !isExampleQuote(quote))
    const names = new Map(clients.map((client) => [client.id, client.name || 'Cliente']))
    const byClient = new Map()

    quotes.forEach((quote) => {
      const quoted = priceOf(quote)
      const requiredDeposit = depositOf(quote)
      const financial = window.AKPayments.summarize(loaded.ledger, quote.id, {
        priceMinor: quoted,
        requiredDepositMinor: requiredDeposit,
      })
      const clientId = quote.clientId || `sin-cliente-${quote.id}`
      const current = byClient.get(clientId) || {
        clientId,
        name: names.get(quote.clientId) || 'Cliente sin nombre',
        works: 0,
        quoted: 0,
        coveredDeposit: 0,
        paid: 0,
        pending: 0,
      }

      current.works += 1
      current.quoted += quoted
      current.coveredDeposit += Math.min(financial.totalPaidMinor, requiredDeposit)
      current.paid += financial.totalPaidMinor
      current.pending += financial.balanceMinor
      byClient.set(clientId, current)
    })

    const rows = [...byClient.values()]
    const totals = rows.reduce((sum, row) => ({
      quoted: sum.quoted + row.quoted,
      coveredDeposit: sum.coveredDeposit + row.coveredDeposit,
      paid: sum.paid + row.paid,
      pending: sum.pending + row.pending,
    }), { quoted: 0, coveredDeposit: 0, paid: 0, pending: 0 })

    return { rows, totals, quotes }
  }

  const setText = (node, value) => {
    if (node && node.textContent !== value) node.textContent = value
  }

  const updateValues = (root, values) => {
    const map = {
      quoted: values.quoted,
      'covered-deposit': values.coveredDeposit,
      paid: values.paid,
      pending: values.pending,
    }
    Object.entries(map).forEach(([key, value]) => {
      root.querySelectorAll(`[data-ak-finance-value="${key}"]`).forEach((node) => setText(node, money(value)))
    })
  }

  const detailFor = (key) => [...document.querySelectorAll('[data-ak-finance-detail-for]')]
    .find((node) => node.dataset.akFinanceDetailFor === key)

  const patchFinance = () => {
    const summary = buildRealFinance()
    if (!summary) return

    const totals = summary.totals
    const metricValues = {
      quoted: totals.quoted,
      'covered-deposit': totals.coveredDeposit,
      paid: totals.paid,
      pending: totals.pending,
    }

    Object.entries(metricValues).forEach(([metric, value]) => {
      setText(document.querySelector(`[data-ak-finance-metric="${metric}"] strong`), money(value))
    })

    document.querySelectorAll('[data-ak-finance-total-row]').forEach((row) => updateValues(row, totals))

    const rowsByClient = new Map(summary.rows.map((row) => [String(row.clientId), row]))
    document.querySelectorAll('[data-ak-finance-client-row]').forEach((rowNode) => {
      const clientId = String(rowNode.dataset.akFinanceClientRow || '')
      const real = rowsByClient.get(clientId)
      const shouldHide = !real
      if (rowNode.hidden !== shouldHide) rowNode.hidden = shouldHide

      const toggle = rowNode.querySelector('[data-ak-finance-toggle]')
      if (!real) {
        const detail = toggle ? detailFor(toggle.dataset.akFinanceToggle) : null
        if (detail && !detail.hidden) detail.hidden = true
        if (toggle?.getAttribute('aria-expanded') !== 'false') toggle?.setAttribute('aria-expanded', 'false')
        return
      }

      updateValues(rowNode, real)
      const count = rowNode.querySelector('.ak-finance-client-button small')
      setText(count, `${real.works} ${real.works === 1 ? 'encargo' : 'encargos'} · Toca para ver cada obra`)
    })

    const quotesById = new Map(readList(QUOTES_KEY).map((quote) => [String(quote.id), quote]))
    document.querySelectorAll('[data-ak-finance-quote-id]').forEach((card) => {
      const quote = quotesById.get(String(card.dataset.akFinanceQuoteId || ''))
      const shouldHide = Boolean(quote && isExampleQuote(quote))
      if (card.hidden !== shouldHide) card.hidden = shouldHide
    })

    const note = document.querySelector('.ak-finance-note')
    if (note && !note.querySelector('[data-ak-example-finance-note]')) {
      const span = document.createElement('span')
      span.dataset.akExampleFinanceNote = 'true'
      span.textContent = ' Los registros de ejemplo no se incluyen en estos totales.'
      note.append(span)
    }
  }

  let scheduled = false
  const schedule = () => {
    if (scheduled) return
    scheduled = true
    requestAnimationFrame(() => requestAnimationFrame(() => {
      scheduled = false
      patchFinance()
    }))
  }

  const start = () => {
    schedule()
    const app = document.getElementById('app')
    if (app) new MutationObserver(schedule).observe(app, { childList: true, subtree: true, characterData: true })
    window.addEventListener('storage', schedule)
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start)
  else start()
})()
