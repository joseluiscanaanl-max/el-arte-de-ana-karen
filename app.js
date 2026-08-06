(() => {
  'use strict'

  const KEYS = {
    settings: 'ak-settings-v1',
    clients: 'ak-clients-v1',
    quotes: 'ak-quotes-v1',
    promotions: 'ak-promotions-v1',
  }

  const defaultSettings = {
    hourlyRate: 150,
    marginPercent: 35,
    depositPercent: 50,
    indirectPercent: 10,
  }

  const id = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`)
  const today = () => new Date().toISOString().slice(0, 10)
  const futureDate = (days) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10)

  const load = (key, fallback) => {
    try {
      const raw = localStorage.getItem(key)
      return raw ? JSON.parse(raw) : fallback
    } catch {
      return fallback
    }
  }

  const save = () => {
    localStorage.setItem(KEYS.settings, JSON.stringify(state.settings))
    localStorage.setItem(KEYS.clients, JSON.stringify(state.clients))
    localStorage.setItem(KEYS.quotes, JSON.stringify(state.quotes))
    localStorage.setItem(KEYS.promotions, JSON.stringify(state.promotions))
  }

  const esc = (value = '') => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')

  const { calculate, money } = window.AKPricing


  const exampleClients = [
    {
      id: 'client-laura',
      name: 'Laura Martínez',
      whatsapp: '833 123 4567',
      instagram: '@lauramartinez',
      preferences: 'Retratos familiares y tonos cálidos.',
      nextAction: 'Enviar recordatorio para aprobar el boceto.',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'client-sofia',
      name: 'Sofía Herrera',
      whatsapp: '833 987 6543',
      instagram: '@sofia.herrera',
      preferences: 'Mascotas y fondos sencillos.',
      nextAction: 'Preguntar si recibió correctamente su cuadro.',
      createdAt: new Date().toISOString(),
    },
  ]

  const newDraft = (clientId = '') => ({
    clientId,
    title: '',
    type: 'Basado en fotografía',
    technique: 'Acrílico',
    width: 40,
    height: 50,
    people: 1,
    pets: 0,
    background: 'Sencillo',
    urgent: false,
    materials: [
      { id: id(), name: 'Lienzo', cost: 300 },
      { id: id(), name: 'Pinturas y materiales', cost: 250 },
    ],
    hours: 10,
    hourlyRate: state?.settings?.hourlyRate ?? defaultSettings.hourlyRate,
    indirectPercent: state?.settings?.indirectPercent ?? defaultSettings.indirectPercent,
    packaging: 120,
    shipping: 0,
    marginPercent: state?.settings?.marginPercent ?? defaultSettings.marginPercent,
    depositPercent: state?.settings?.depositPercent ?? defaultSettings.depositPercent,
    deliveryDate: '',
    notes: 'Incluye una revisión del boceto antes de comenzar la pintura.',
  })

  let state = {
    view: 'inicio',
    settings: load(KEYS.settings, defaultSettings),
    clients: load(KEYS.clients, exampleClients),
    quotes: load(KEYS.quotes, []),
    promotions: load(KEYS.promotions, []),
    draft: null,
    editingQuoteId: null,
    notice: '',
  }

  state.draft = newDraft(state.clients[0]?.id || '')

  if (state.quotes.length === 0) {
    const example = {
      ...newDraft('client-laura'),
      title: 'Retrato familiar al atardecer',
      width: 60,
      height: 80,
      people: 2,
      background: 'Detallado',
      materials: [
        { id: id(), name: 'Lienzo 60 × 80 cm', cost: 480 },
        { id: id(), name: 'Pinturas y medios', cost: 320 },
        { id: id(), name: 'Barniz final', cost: 100 },
      ],
      hours: 18,
      packaging: 180,
      deliveryDate: futureDate(21),
    }
    state.quotes = [{
      ...example,
      id: 'quote-example',
      status: 'Esperando aprobación',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      price: calculate(example),
    }]
    save()
  }

  const statusOptions = [
    'Borrador',
    'Cotización enviada',
    'Esperando aprobación',
    'Esperando anticipo',
    'Boceto en proceso',
    'Boceto aprobado',
    'Pintura en proceso',
    'Obra terminada',
    'Esperando saldo',
    'Entregada',
  ]

  const app = document.getElementById('app')

  const toast = (message) => {
    state.notice = message
    render()
    window.setTimeout(() => {
      state.notice = ''
      const node = document.querySelector('.toast')
      if (node) node.remove()
    }, 2600)
  }

  const navButton = (view, icon, label) => `
    <button class="nav-button ${state.view === view ? 'active' : ''}" data-view="${view}">
      <span>${icon}</span><small>${label}</small>
    </button>`

  const shell = (content) => `
    <div class="app-shell">
      <header class="topbar">
        <div class="brand-mark">AK</div>
        <div><p class="eyebrow">MI TALLER</p><h1>El Arte de Ana Karen</h1></div>
        <button class="icon-button" data-view="ajustes" aria-label="Ajustes">⚙</button>
      </header>
      ${state.notice ? `<div class="toast" role="status">${esc(state.notice)}</div>` : ''}
      <main class="main-content">${content}</main>
      <nav class="bottom-nav">
        ${navButton('inicio', '⌂', 'Inicio')}
        ${navButton('cotizar', '＋', 'Cotizar')}
        ${navButton('pedidos', '▤', 'Pedidos')}
        ${navButton('clientes', '♙', 'Clientes')}
        ${navButton('promocionar', '✦', 'Promover')}
      </nav>
    </div>`

  const dashboard = () => {
    const active = state.quotes.filter(q => q.status !== 'Entregada')
    const delivered = state.quotes.filter(q => q.status === 'Entregada').length
    const expectedSales = state.quotes.reduce((sum, q) => sum + q.price.suggestedPrice, 0)
    const expectedProfit = state.quotes.reduce((sum, q) => sum + q.price.profit, 0)
    const next = active[0]
    const client = state.clients.find(c => c.id === next?.clientId)
    return `
      <section class="page-stack">
        <div class="welcome-card">
          <p class="eyebrow">HOLA, ANA KAREN</p>
          <h2>¿Qué quieres hacer hoy?</h2>
          <p>Tu taller te ayuda con los números y te muestra solamente el siguiente paso.</p>
          <button class="primary-button" data-action="new-quote">＋ Calcular precio de un cuadro</button>
        </div>
        ${next ? `
          <button class="next-action" data-view="pedidos">
            <div class="next-icon">✓</div>
            <div><span>Siguiente acción</span><strong>${esc(next.status)}: ${esc(next.title)}</strong><small>${esc(client?.name || 'Cliente')} · Toca para continuar</small></div><b>›</b>
          </button>` : `<div class="empty-state">No hay encargos pendientes. Es un buen momento para promocionar una obra.</div>`}
        <div class="quick-grid">
          <button class="quick-card" data-view="pedidos"><span>▤</span><strong>Ver encargos</strong><small>${active.length} activos</small></button>
          <button class="quick-card" data-view="promocionar"><span>✦</span><strong>Promocionar</strong><small>Crear una publicación</small></button>
        </div>
        <div>
          <div class="section-heading"><div><p class="eyebrow">RESUMEN</p><h3>Tu taller</h3></div></div>
          <div class="metrics-grid">
            <article><span>Cotizado</span><strong>${money(expectedSales)}</strong></article>
            <article><span>Ganancia estimada</span><strong>${money(expectedProfit)}</strong></article>
            <article><span>Clientes</span><strong>${state.clients.length}</strong></article>
            <article><span>Entregados</span><strong>${delivered}</strong></article>
          </div>
        </div>
      </section>`
  }

  const field = (label, name, value, type = 'text', extra = '') => `
    <label>${label}<input name="${name}" type="${type}" value="${esc(value)}" ${extra}></label>`

  const selectField = (label, name, value, options) => `
    <label>${label}<select name="${name}">${options.map(o => `<option ${o === value ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select></label>`

  const pricePanel = (p) => `
    <div class="price-result" id="price-result">
      <p>PRECIO SUGERIDO</p><strong>${money(p.suggestedPrice)}</strong>
      <span>Anticipo: ${money(p.deposit)} · Saldo: ${money(p.balance)}</span>
      <div class="price-breakdown">
        <div><span>Materiales</span><b>${money(p.materialCost)}</b></div>
        <div><span>Mano de obra</span><b>${money(p.laborCost)}</b></div>
        <div><span>Indirectos</span><b>${money(p.indirectCost)}</b></div>
        <div><span>Complejidad</span><b>${money(p.complexityCost)}</b></div>
        ${p.urgencyCost > 0 ? `<div><span>Urgencia</span><b>${money(p.urgencyCost)}</b></div>` : ''}
        <div class="total-line"><span>Costo total</span><b>${money(p.totalCost)}</b></div>
        <div class="profit-line"><span>Ganancia estimada</span><b>${money(p.profit)}</b></div>
      </div>
      <small>El precio se redondea hacia arriba a múltiplos de $50.</small>
      <button class="primary-button" type="button" data-action="save-quote">${state.editingQuoteId ? 'Guardar cambios' : 'Guardar cotización'}</button>
    </div>`

  const quoteBuilder = () => {
    const d = state.draft
    const p = calculate(d)
    return `
      <section class="page-stack quote-page">
        <div class="page-title"><p class="eyebrow">PASO A PASO</p><h2>${state.editingQuoteId ? 'Editar cotización' : 'Calcular precio'}</h2><p>Completa los datos. El precio se actualiza automáticamente.</p></div>
        <form id="quote-form" class="contents-form">
          <section class="form-card">
            <div class="form-card-title"><span>1</span><h3>Cliente y obra</h3></div>
            <div class="form-fields">
              <label>Cliente<select name="clientId"><option value="">Selecciona un cliente</option>${state.clients.map(c => `<option value="${c.id}" ${c.id === d.clientId ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
              ${field('Nombre de la obra', 'title', d.title, 'text', 'placeholder="Ej. Retrato de familia"')}
              <div class="two-columns">
                ${selectField('Tipo', 'type', d.type, ['Obra original', 'Cuadro por encargo', 'Basado en fotografía'])}
                ${selectField('Técnica', 'technique', d.technique, ['Acrílico', 'Óleo', 'Acuarela', 'Técnica mixta', 'Otra'])}
              </div>
              <div class="two-columns">${field('Ancho (cm)', 'width', d.width, 'number', 'min="1"')}${field('Alto (cm)', 'height', d.height, 'number', 'min="1"')}</div>
            </div>
          </section>
          <section class="form-card">
            <div class="form-card-title"><span>2</span><h3>Complejidad</h3></div>
            <div class="form-fields">
              <div class="two-columns">${field('Personas', 'people', d.people, 'number', 'min="0"')}${field('Mascotas', 'pets', d.pets, 'number', 'min="0"')}</div>
              ${selectField('Fondo', 'background', d.background, ['Sencillo', 'Detallado', 'Muy detallado'])}
              <label class="switch-row"><div><strong>Trabajo urgente</strong><small>Agrega 25% por prioridad y reorganización del taller.</small></div><input name="urgent" type="checkbox" ${d.urgent ? 'checked' : ''}></label>
            </div>
          </section>
          <section class="form-card">
            <div class="form-card-title"><span>3</span><h3>Materiales</h3></div>
            <div class="form-fields">
              <div class="material-list">${d.materials.map(m => `<div class="material-row" data-material-id="${m.id}"><input class="material-name" value="${esc(m.name)}" placeholder="Material"><input class="material-cost" type="number" min="0" value="${m.cost}"><button class="remove-button" type="button" data-remove-material="${m.id}">×</button></div>`).join('')}</div>
              <button class="secondary-button" type="button" data-action="add-material">＋ Agregar material</button>
            </div>
          </section>
          <section class="form-card">
            <div class="form-card-title"><span>4</span><h3>Tiempo y gastos</h3></div>
            <div class="form-fields">
              <div class="two-columns">${field('Horas estimadas', 'hours', d.hours, 'number', 'min="0"')}${field('Valor por hora', 'hourlyRate', d.hourlyRate, 'number', 'min="0"')}</div>
              <div class="two-columns">${field('Gastos indirectos (%)', 'indirectPercent', d.indirectPercent, 'number', 'min="0" max="100"')}${field('Empaque', 'packaging', d.packaging, 'number', 'min="0"')}</div>
              ${field('Envío', 'shipping', d.shipping, 'number', 'min="0"')}
            </div>
          </section>
          <section class="form-card">
            <div class="form-card-title"><span>5</span><h3>Precio y entrega</h3></div>
            <div class="form-fields">
              <div class="two-columns">${field('Margen deseado (%)', 'marginPercent', d.marginPercent, 'number', 'min="0" max="80"')}${field('Anticipo (%)', 'depositPercent', d.depositPercent, 'number', 'min="0" max="100"')}</div>
              ${field('Fecha estimada de entrega', 'deliveryDate', d.deliveryDate, 'date')}
              <label>Condiciones y notas<textarea name="notes" rows="3">${esc(d.notes)}</textarea></label>
            </div>
          </section>
        </form>
        ${pricePanel(p)}
      </section>`
  }

  const orders = () => `
    <section class="page-stack">
      <div class="section-heading"><div><p class="eyebrow">SEGUIMIENTO</p><h2>Mis encargos</h2></div><button class="small-primary" data-action="new-quote">＋ Nuevo</button></div>
      ${state.quotes.length ? `<div class="order-list">${state.quotes.map(q => {
        const c = state.clients.find(x => x.id === q.clientId)
        return `<article class="order-card">
          <div class="order-top"><div><span class="status-pill">${esc(q.status)}</span><h3>${esc(q.title)}</h3><p>${esc(c?.name || 'Cliente')} · ${q.width} × ${q.height} cm · ${esc(q.technique)}</p></div><strong>${money(q.price.suggestedPrice)}</strong></div>
          <label class="status-select">Siguiente etapa<select data-status-id="${q.id}">${statusOptions.map(s => `<option ${s === q.status ? 'selected' : ''}>${s}</option>`).join('')}</select></label>
          <div class="order-money"><span>Anticipo <b>${money(q.price.deposit)}</b></span><span>Saldo <b>${money(q.price.balance)}</b></span><span>Ganancia <b>${money(q.price.profit)}</b></span></div>
          <div class="action-row"><button data-share-quote="${q.id}">Compartir</button><button data-edit-quote="${q.id}">Editar</button><button data-promote-quote="${q.id}">Promover</button><button class="danger-link" data-delete-quote="${q.id}">Eliminar</button></div>
        </article>`
      }).join('')}</div>` : `<div class="empty-state">Todavía no hay cotizaciones guardadas.</div>`}
    </section>`

  const clientsView = () => `
    <section class="page-stack">
      <div class="section-heading"><div><p class="eyebrow">RELACIONES</p><h2>Clientes</h2></div><button class="small-primary" data-action="toggle-client-form">＋ Agregar</button></div>
      <div class="form-card compact-form" id="client-form-card" hidden>
        <form id="client-form" class="compact-form">
          ${field('Nombre', 'name', '')}
          <div class="two-columns">${field('WhatsApp', 'whatsapp', '', 'tel')}${field('Instagram', 'instagram', '')}</div>
          <label>Qué le gusta<textarea name="preferences" rows="2"></textarea></label>
          ${field('Próxima acción', 'nextAction', '')}
          <button class="primary-button" type="submit">Guardar cliente</button>
        </form>
      </div>
      <div class="client-list">${state.clients.map(c => {
        const count = state.quotes.filter(q => q.clientId === c.id).length
        return `<article class="client-card"><div class="avatar">${esc(c.name.slice(0,2).toUpperCase())}</div><div class="client-info"><h3>${esc(c.name)}</h3><p>${esc(c.whatsapp || 'Sin WhatsApp')}${c.instagram ? ` · ${esc(c.instagram)}` : ''}</p>${c.preferences ? `<small>${esc(c.preferences)}</small>` : ''}${c.nextAction ? `<div class="client-next">Siguiente: ${esc(c.nextAction)}</div>` : ''}</div><div class="client-actions"><span>${count} obras</span><button data-client-quote="${c.id}">Cotizar</button></div></article>`
      }).join('')}</div>
    </section>`

  const promotionsView = () => `
    <section class="page-stack">
      <div class="page-title"><p class="eyebrow">CONTENIDO</p><h2>Promocionar mi arte</h2><p>Convierte una obra terminada en una publicación lista para usar.</p></div>
      <div class="form-card compact-form">
        <label>Elige una obra<select id="promotion-quote"><option value="">Selecciona una obra</option>${state.quotes.map(q => `<option value="${q.id}">${esc(q.title)}</option>`).join('')}</select></label>
        <button class="primary-button" data-action="create-promotion">✦ Preparar publicación</button>
      </div>
      ${state.promotions.map(p => {
        const q = state.quotes.find(x => x.id === p.quoteId)
        return `<article class="promotion-card" data-promotion-id="${p.id}">
          <div class="section-heading"><div><p class="eyebrow">BORRADOR</p><h3>${esc(q?.title || 'Obra')}</h3></div><span class="status-pill">${esc(p.platform)}</span></div>
          <label>Texto para publicación<textarea class="promo-caption" rows="10">${esc(p.caption)}</textarea></label>
          <label>Idea para video<textarea class="promo-video" rows="5">${esc(p.videoIdea)}</textarea></label>
          <label>Hashtags<textarea class="promo-tags" rows="3">${esc(p.hashtags)}</textarea></label>
          <button class="secondary-button" data-copy-promotion="${p.id}">Copiar publicación</button>
        </article>`
      }).join('') || `<div class="empty-state">Selecciona una obra y la aplicación preparará el texto, la idea de video y los hashtags.</div>`}
    </section>`

  const settingsView = () => `
    <section class="page-stack">
      <div class="page-title"><p class="eyebrow">PREFERENCIAS</p><h2>Ajustes del taller</h2><p>Estos valores aparecerán automáticamente en las nuevas cotizaciones.</p></div>
      <form id="settings-form" class="form-card compact-form">
        ${field('Valor de una hora de trabajo', 'hourlyRate', state.settings.hourlyRate, 'number', 'min="0"')}
        ${field('Margen de ganancia deseado (%)', 'marginPercent', state.settings.marginPercent, 'number', 'min="0" max="80"')}
        ${field('Anticipo recomendado (%)', 'depositPercent', state.settings.depositPercent, 'number', 'min="0" max="100"')}
        ${field('Gastos indirectos (%)', 'indirectPercent', state.settings.indirectPercent, 'number', 'min="0" max="100"')}
        <button class="primary-button" type="submit">Guardar preferencias</button>
      </form>
      <div class="form-card compact-form"><div><p class="eyebrow">SEGURIDAD</p><h3>Respaldo de información</h3><p>Descarga clientes, cotizaciones y publicaciones en un archivo.</p></div><button class="secondary-button" data-action="backup">Descargar respaldo</button></div>
      <div class="info-box"><strong>Privacidad</strong><p>Esta primera versión guarda la información únicamente en este dispositivo. No envía datos a servidores externos.</p></div>
    </section>`

  function render() {
    const content = state.view === 'inicio' ? dashboard()
      : state.view === 'cotizar' ? quoteBuilder()
      : state.view === 'pedidos' ? orders()
      : state.view === 'clientes' ? clientsView()
      : state.view === 'promocionar' ? promotionsView()
      : settingsView()
    app.innerHTML = shell(content)
    bind()
  }

  function syncDraftFromForm() {
    const form = document.getElementById('quote-form')
    if (!form) return
    const data = new FormData(form)
    const materials = [...form.querySelectorAll('[data-material-id]')].map(row => ({
      id: row.dataset.materialId,
      name: row.querySelector('.material-name').value,
      cost: Number(row.querySelector('.material-cost').value) || 0,
    }))
    state.draft = {
      ...state.draft,
      clientId: data.get('clientId') || '',
      title: data.get('title') || '',
      type: data.get('type') || 'Basado en fotografía',
      technique: data.get('technique') || 'Acrílico',
      width: Number(data.get('width')) || 0,
      height: Number(data.get('height')) || 0,
      people: Number(data.get('people')) || 0,
      pets: Number(data.get('pets')) || 0,
      background: data.get('background') || 'Sencillo',
      urgent: data.get('urgent') === 'on',
      materials,
      hours: Number(data.get('hours')) || 0,
      hourlyRate: Number(data.get('hourlyRate')) || 0,
      indirectPercent: Number(data.get('indirectPercent')) || 0,
      packaging: Number(data.get('packaging')) || 0,
      shipping: Number(data.get('shipping')) || 0,
      marginPercent: Number(data.get('marginPercent')) || 0,
      depositPercent: Number(data.get('depositPercent')) || 0,
      deliveryDate: data.get('deliveryDate') || '',
      notes: data.get('notes') || '',
    }
  }

  function updatePriceOnly() {
    syncDraftFromForm()
    const node = document.getElementById('price-result')
    if (node) node.outerHTML = pricePanel(calculate(state.draft))
    bindPriceButton()
  }

  function bindPriceButton() {
    const button = document.querySelector('[data-action="save-quote"]')
    if (button) button.addEventListener('click', saveQuote)
  }

  function startNewQuote(clientId = state.clients[0]?.id || '') {
    state.editingQuoteId = null
    state.draft = newDraft(clientId)
    state.view = 'cotizar'
    render()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function saveQuote() {
    syncDraftFromForm()
    if (!state.draft.title.trim()) return toast('Escribe un nombre para la obra.')
    if (!state.draft.clientId) return toast('Selecciona un cliente.')
    const now = new Date().toISOString()
    if (state.editingQuoteId) {
      state.quotes = state.quotes.map(q => q.id === state.editingQuoteId ? { ...q, ...state.draft, price: calculate(state.draft), updatedAt: now } : q)
      state.editingQuoteId = null
      toast('Cotización actualizada.')
    } else {
      state.quotes.unshift({ ...state.draft, id: id(), status: 'Borrador', createdAt: now, updatedAt: now, price: calculate(state.draft) })
      toast('Cotización guardada.')
    }
    save()
    state.view = 'pedidos'
    render()
  }

  async function shareQuote(quoteId) {
    const q = state.quotes.find(x => x.id === quoteId)
    const c = state.clients.find(x => x.id === q?.clientId)
    if (!q) return
    const text = `Hola ${c?.name || ''}. Te comparto la cotización de tu obra “${q.title}”.\n\nTécnica: ${q.technique}\nMedidas: ${q.width} × ${q.height} cm\nPrecio: ${money(q.price.suggestedPrice)}\nAnticipo (${q.depositPercent}%): ${money(q.price.deposit)}\nSaldo: ${money(q.price.balance)}${q.deliveryDate ? `\nEntrega estimada: ${new Date(`${q.deliveryDate}T12:00:00`).toLocaleDateString('es-MX')}` : ''}\n\n${q.notes}\n\nEl Arte de Ana Karen`
    try {
      if (navigator.share) await navigator.share({ title: `Cotización: ${q.title}`, text })
      else {
        await navigator.clipboard.writeText(text)
        toast('Cotización copiada para WhatsApp.')
      }
    } catch {}
  }

  function createPromotion(quoteId) {
    const q = state.quotes.find(x => x.id === quoteId)
    if (!q) return toast('Selecciona una obra.')
    const c = state.clients.find(x => x.id === q.clientId)
    const people = q.people > 1 ? `${q.people} personas` : q.people === 1 ? 'una persona muy especial' : 'una historia especial'
    const promotion = {
      id: id(), quoteId: q.id, platform: 'Ambas', createdAt: new Date().toISOString(),
      caption: `Cada obra comienza con una historia. 🎨\n\nEn esta pieza transformé una fotografía de ${people} en un cuadro de ${q.width} × ${q.height} cm, trabajado con ${q.technique.toLowerCase()}.\n\nGracias${c ? ` a ${c.name}` : ''} por confiarme este recuerdo.\n\n¿Te gustaría convertir una fotografía especial en una obra de arte? Escríbeme por mensaje directo.`,
      videoIdea: 'Video de 15–25 segundos: 1) mostrar la fotografía desenfocada o con autorización; 2) tres tomas rápidas del proceso; 3) acercamiento a pinceladas; 4) revelar la obra terminada; 5) cerrar con “Cuadros personalizados por El Arte de Ana Karen”.',
      hashtags: '#ElArteDeAnaKaren #ArteMexicano #PinturaPersonalizada #RetratoPorEncargo #ArteHechoAMano #Tampico',
    }
    state.promotions = [promotion, ...state.promotions.filter(p => p.quoteId !== q.id)]
    save()
    state.view = 'promocionar'
    toast('Contenido promocional preparado.')
  }

  function bind() {
    document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => {
      const view = button.dataset.view
      if (view === 'cotizar') return startNewQuote()
      state.view = view
      render()
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }))

    document.querySelectorAll('[data-action="new-quote"]').forEach(button => button.addEventListener('click', () => startNewQuote()))

    const quoteForm = document.getElementById('quote-form')
    if (quoteForm) quoteForm.addEventListener('input', updatePriceOnly)
    bindPriceButton()

    document.querySelector('[data-action="add-material"]')?.addEventListener('click', () => {
      syncDraftFromForm()
      state.draft.materials.push({ id: id(), name: '', cost: 0 })
      render()
    })
    document.querySelectorAll('[data-remove-material]').forEach(button => button.addEventListener('click', () => {
      syncDraftFromForm()
      if (state.draft.materials.length > 1) state.draft.materials = state.draft.materials.filter(m => m.id !== button.dataset.removeMaterial)
      render()
    }))

    document.querySelectorAll('[data-edit-quote]').forEach(button => button.addEventListener('click', () => {
      const q = state.quotes.find(x => x.id === button.dataset.editQuote)
      if (!q) return
      const { id: quoteId, status, createdAt, updatedAt, price, ...draft } = q
      void status; void createdAt; void updatedAt; void price
      state.editingQuoteId = quoteId
      state.draft = JSON.parse(JSON.stringify(draft))
      state.view = 'cotizar'
      render()
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }))

    document.querySelectorAll('[data-share-quote]').forEach(button => button.addEventListener('click', () => shareQuote(button.dataset.shareQuote)))
    document.querySelectorAll('[data-promote-quote]').forEach(button => button.addEventListener('click', () => createPromotion(button.dataset.promoteQuote)))
    document.querySelectorAll('[data-delete-quote]').forEach(button => button.addEventListener('click', () => {
      const quoteId = button.dataset.deleteQuote
      if (!confirm('¿Eliminar esta cotización?')) return
      state.quotes = state.quotes.filter(q => q.id !== quoteId)
      state.promotions = state.promotions.filter(p => p.quoteId !== quoteId)
      save(); toast('Registro eliminado.')
    }))
    document.querySelectorAll('[data-status-id]').forEach(select => select.addEventListener('change', () => {
      state.quotes = state.quotes.map(q => q.id === select.dataset.statusId ? { ...q, status: select.value, updatedAt: new Date().toISOString() } : q)
      save(); toast('Estado actualizado.')
    }))

    document.querySelector('[data-action="toggle-client-form"]')?.addEventListener('click', () => {
      const card = document.getElementById('client-form-card')
      if (card) card.hidden = !card.hidden
    })
    document.getElementById('client-form')?.addEventListener('submit', event => {
      event.preventDefault()
      const data = new FormData(event.currentTarget)
      const name = String(data.get('name') || '').trim()
      if (!name) return toast('Escribe el nombre del cliente.')
      const client = {
        id: id(), name, whatsapp: String(data.get('whatsapp') || ''), instagram: String(data.get('instagram') || ''),
        preferences: String(data.get('preferences') || ''), nextAction: String(data.get('nextAction') || ''), createdAt: new Date().toISOString(),
      }
      state.clients.unshift(client)
      save(); toast('Cliente guardado.')
    })
    document.querySelectorAll('[data-client-quote]').forEach(button => button.addEventListener('click', () => startNewQuote(button.dataset.clientQuote)))

    document.querySelector('[data-action="create-promotion"]')?.addEventListener('click', () => {
      const quoteId = document.getElementById('promotion-quote')?.value
      createPromotion(quoteId)
    })
    document.querySelectorAll('[data-promotion-id]').forEach(card => {
      const promoId = card.dataset.promotionId
      card.addEventListener('input', () => {
        state.promotions = state.promotions.map(p => p.id === promoId ? {
          ...p,
          caption: card.querySelector('.promo-caption').value,
          videoIdea: card.querySelector('.promo-video').value,
          hashtags: card.querySelector('.promo-tags').value,
        } : p)
        save()
      })
    })
    document.querySelectorAll('[data-copy-promotion]').forEach(button => button.addEventListener('click', async () => {
      const p = state.promotions.find(x => x.id === button.dataset.copyPromotion)
      if (!p) return
      await navigator.clipboard.writeText(`${p.caption}\n\n${p.hashtags}`)
      toast('Texto copiado.')
    }))

    document.getElementById('settings-form')?.addEventListener('submit', event => {
      event.preventDefault()
      const data = new FormData(event.currentTarget)
      state.settings = {
        hourlyRate: Number(data.get('hourlyRate')) || 0,
        marginPercent: Number(data.get('marginPercent')) || 0,
        depositPercent: Number(data.get('depositPercent')) || 0,
        indirectPercent: Number(data.get('indirectPercent')) || 0,
      }
      save(); toast('Preferencias guardadas.')
    })
    document.querySelector('[data-action="backup"]')?.addEventListener('click', () => {
      const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), ...state }, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `respaldo-arte-ana-karen-${today()}.json`; a.click()
      URL.revokeObjectURL(url)
      toast('Respaldo descargado.')
    })
  }

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}))
  }

  render()
})()
