(() => {
  'use strict'

  const WRAPPER_ID = 'ak-approved-fixed-view'
  const STYLE_ID = 'ak-approved-fixed-view-style'
  let timer = null
  let lastPhoto = ''

  const injectStyles = () => {
    if (document.getElementById(STYLE_ID)) return
    const style = document.createElement('style')
    style.id = STYLE_ID
    style.textContent = `
      .ak-approved-fixed-view {
        --ak-approved-pink:#c84fb2;
        --ak-approved-soft:#faeefa;
        --ak-approved-ink:#32243e;
        --ak-approved-muted:#766a80;
        display:grid;
        gap:18px;
        margin-top:18px;
        padding:22px;
        border:1px solid var(--line,#eadfec);
        border-radius:24px;
        background:#fcfbfd;
      }
      .ak-approved-fixed-view__header { display:flex; justify-content:space-between; align-items:flex-start; gap:16px; }
      .ak-approved-fixed-view__header h3 { margin:0; color:var(--ak-approved-ink); font-family:Georgia,serif; font-size:1.75rem; }
      .ak-approved-fixed-view__header p { margin:7px 0 0; color:var(--ak-approved-muted); line-height:1.45; }
      .ak-approved-fixed-view__badge { flex:none; padding:9px 14px; border-radius:999px; background:var(--ak-approved-soft); color:#943d83; font-size:.78rem; font-weight:900; }
      .ak-approved-fixed-view__workspace { display:grid; grid-template-columns:minmax(0,1fr) minmax(245px,310px); gap:18px; align-items:stretch; }
      .ak-approved-fixed-view__hero { position:relative; min-width:0; overflow:hidden; border:1px solid var(--line,#eadfec); border-radius:20px; background:#f2ebf4; box-shadow:0 10px 28px rgba(58,34,69,.08); }
      .ak-approved-fixed-view__hero canvas { display:block; width:100%; aspect-ratio:16/9; object-fit:cover; }
      .ak-approved-fixed-view__hero-label { position:absolute; left:16px; bottom:14px; padding:9px 14px; border-radius:999px; background:linear-gradient(135deg,#ad429a,#dc63bd); color:#fff; font-size:.76rem; font-weight:900; box-shadow:0 7px 18px rgba(173,66,154,.28); }
      .ak-approved-fixed-view__style { display:grid; align-content:start; gap:12px; padding:22px; border:1px solid var(--line,#eadfec); border-radius:20px; background:#fff; box-shadow:0 10px 28px rgba(58,34,69,.06); }
      .ak-approved-fixed-view__style-icon { display:grid; width:42px; height:42px; place-items:center; border-radius:50%; background:var(--ak-approved-soft); color:var(--ak-approved-pink); font-size:1.25rem; }
      .ak-approved-fixed-view__style h4 { margin:2px 0 0; color:#b4459e; font-family:Georgia,serif; font-size:1.25rem; }
      .ak-approved-fixed-view__style > p { margin:0; color:var(--ak-approved-muted); }
      .ak-approved-fixed-view__checks { display:grid; gap:10px; margin-top:6px; }
      .ak-approved-fixed-view__check { display:flex; align-items:center; gap:9px; color:#64596d; font-size:.83rem; }
      .ak-approved-fixed-view__check b { display:grid; width:19px; height:19px; place-items:center; border-radius:50%; background:var(--ak-approved-soft); color:#b4459e; font-size:.72rem; }
      .ak-approved-fixed-view__approval { margin-top:7px; padding:13px; border-radius:14px; background:var(--ak-approved-soft); color:#674d65; font-size:.78rem; line-height:1.45; }
      .ak-approved-fixed-view__options { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:14px; align-items:stretch; }
      .ak-approved-fixed-view__original { position:relative; display:grid; align-content:start; gap:7px; min-width:0; padding:8px; border:2px solid transparent; border-radius:17px; background:#fff; color:var(--ak-approved-ink); text-align:left; box-shadow:0 7px 18px rgba(58,34,69,.05); cursor:pointer; }
      .ak-approved-fixed-view__original.is-selected { border-color:var(--ak-approved-pink); }
      .ak-approved-fixed-view__original img { display:block; width:100%; aspect-ratio:16/9; border-radius:11px; background:#f2eaf3; object-fit:cover; }
      .ak-approved-fixed-view__number { position:absolute; top:14px; left:14px; display:grid; width:28px; height:28px; place-items:center; border-radius:50%; background:#f1d9f0; color:#694d71; font-size:.75rem; font-weight:900; }
      .ak-approved-fixed-view__option-title { margin:3px 5px 0; font-size:.86rem; font-weight:900; }
      .ak-approved-fixed-view__option-copy { margin:0 5px 5px; color:var(--ak-approved-muted); font-size:.74rem; line-height:1.35; }
      .ak-approved-fixed-view__privacy { margin:0; color:#8c8290; text-align:center; font-size:.72rem; }

      #ak-joce-acrylic-preview.ak-approved-fixed-acrylic { display:contents !important; }
      #ak-joce-acrylic-preview.ak-approved-fixed-acrylic .ak-acrylic-preview__head,
      #ak-joce-acrylic-preview.ak-approved-fixed-acrylic .ak-acrylic-preview__selection,
      #ak-joce-acrylic-preview.ak-approved-fixed-acrylic > p,
      #ak-joce-acrylic-preview.ak-approved-fixed-acrylic > button { display:none !important; }
      #ak-joce-acrylic-preview.ak-approved-fixed-acrylic .ak-acrylic-preview__grid { display:contents !important; }
      #ak-joce-acrylic-preview.ak-approved-fixed-acrylic .ak-acrylic-card {
        position:relative;
        display:grid;
        align-content:start;
        gap:7px;
        min-width:0;
        height:100%;
        padding:8px;
        border:2px solid transparent;
        border-radius:17px;
        background:#fff;
        color:var(--ak-approved-ink);
        box-shadow:0 7px 18px rgba(58,34,69,.05);
      }
      #ak-joce-acrylic-preview.ak-approved-fixed-acrylic .ak-acrylic-card:hover { transform:translateY(-1px); border-color:#e7b5dc; }
      #ak-joce-acrylic-preview.ak-approved-fixed-acrylic .ak-acrylic-card.is-selected { border-color:var(--ak-approved-pink); background:#fff; box-shadow:0 8px 22px rgba(200,79,178,.13); }
      #ak-joce-acrylic-preview.ak-approved-fixed-acrylic .ak-acrylic-card canvas { display:block; width:100%; aspect-ratio:16/9; border-radius:11px; object-fit:cover; }
      #ak-joce-acrylic-preview.ak-approved-fixed-acrylic .ak-acrylic-card__check { top:14px; right:14px; width:27px; height:27px; }
      #ak-joce-acrylic-preview.ak-approved-fixed-acrylic .ak-acrylic-card__label { margin:3px 5px 0; color:var(--ak-approved-ink); font-size:.86rem; letter-spacing:0; text-transform:none; }
      #ak-joce-acrylic-preview.ak-approved-fixed-acrylic .ak-acrylic-card__description { margin:0 5px 5px; min-height:0; color:var(--ak-approved-muted); font-size:.74rem; line-height:1.35; }
      #ak-joce-acrylic-preview.ak-approved-fixed-acrylic .ak-acrylic-card__meta,
      #ak-joce-acrylic-preview.ak-approved-fixed-acrylic .ak-acrylic-card__choose { display:none !important; }
      #ak-joce-acrylic-preview.ak-approved-fixed-acrylic .ak-acrylic-card::before { content:attr(data-ak-option-number); position:absolute; top:14px; left:14px; z-index:2; display:grid; width:28px; height:28px; place-items:center; border-radius:50%; background:#f1d9f0; color:#694d71; font-size:.75rem; font-weight:900; }

      #ak-approved-canvas-catalog.ak-approved-fixed-catalog { display:grid !important; grid-template-columns:minmax(0,1.15fr) minmax(320px,.85fr); grid-template-areas:'head head' 'list price' 'note price' 'actions actions'; gap:14px; margin-top:2px; }
      #ak-approved-canvas-catalog.ak-approved-fixed-catalog .ak-approved-catalog__head { grid-area:head; }
      #ak-approved-canvas-catalog.ak-approved-fixed-catalog .ak-approved-catalog__list { grid-area:list; }
      #ak-approved-canvas-catalog.ak-approved-fixed-catalog .ak-approved-catalog__note { grid-area:note; align-self:start; }
      #ak-approved-canvas-catalog.ak-approved-fixed-catalog .ak-approved-price { grid-area:price; grid-template-columns:minmax(120px,.72fr) minmax(180px,1.28fr); align-self:stretch; }
      #ak-approved-canvas-catalog.ak-approved-fixed-catalog .ak-approved-catalog__actions { grid-area:actions; }
      #ak-joce-canvas-sizes { display:none !important; }

      @media (max-width:980px) {
        .ak-approved-fixed-view__workspace { grid-template-columns:1fr; }
        .ak-approved-fixed-view__options { grid-template-columns:repeat(2,minmax(0,1fr)); }
        #ak-approved-canvas-catalog.ak-approved-fixed-catalog { grid-template-columns:1fr; grid-template-areas:'head' 'list' 'note' 'price' 'actions'; }
      }
      @media (max-width:580px) {
        .ak-approved-fixed-view { padding:15px; border-radius:18px; }
        .ak-approved-fixed-view__header { display:grid; }
        .ak-approved-fixed-view__badge { width:max-content; }
        .ak-approved-fixed-view__options { grid-template-columns:1fr; }
        #ak-approved-canvas-catalog.ak-approved-fixed-catalog .ak-approved-price { grid-template-columns:1fr; }
      }
    `
    document.head.appendChild(style)
  }

  const createWrapper = (result) => {
    let wrapper = document.getElementById(WRAPPER_ID)
    if (wrapper) return wrapper

    wrapper = document.createElement('section')
    wrapper.id = WRAPPER_ID
    wrapper.className = 'ak-approved-fixed-view'
    wrapper.dataset.approvedLayout = 'fixed'
    wrapper.dataset.previewMode = 'acrylic'
    wrapper.innerHTML = `
      <header class="ak-approved-fixed-view__header">
        <div>
          <h3>Vista previa del cuadro</h3>
          <p>Selecciona tu opción favorita. Todas conservan el estilo acrílico aprobado.</p>
        </div>
        <span class="ak-approved-fixed-view__badge">✓ Estilo aprobado</span>
      </header>
      <div class="ak-approved-fixed-view__workspace">
        <article class="ak-approved-fixed-view__hero">
          <canvas id="ak-approved-fixed-hero" aria-label="Vista previa seleccionada"></canvas>
          <span class="ak-approved-fixed-view__hero-label" id="ak-approved-fixed-hero-label">Fondo medio · seleccionado</span>
        </article>
        <aside class="ak-approved-fixed-view__style">
          <span class="ak-approved-fixed-view__style-icon">✦</span>
          <h4>Estilo aprobado</h4>
          <p>Acrílico sencillo sobre lienzo</p>
          <div class="ak-approved-fixed-view__checks">
            <span class="ak-approved-fixed-view__check"><b>✓</b>Pinceladas visibles</span>
            <span class="ak-approved-fixed-view__check"><b>✓</b>Textura de lienzo</span>
            <span class="ak-approved-fixed-view__check"><b>✓</b>Colores cálidos y naturales</span>
            <span class="ak-approved-fixed-view__check"><b>✓</b>Personas con apariencia acrílica</span>
            <span class="ak-approved-fixed-view__check"><b>✓</b>Resultado artesanal</span>
          </div>
          <div class="ak-approved-fixed-view__approval"><strong>JOCE ha aprobado este estilo.</strong><br>Este será el estilo fijo de la vista previa.</div>
        </aside>
      </div>
      <div class="ak-approved-fixed-view__options">
        <button class="ak-approved-fixed-view__original" type="button" data-ak-approved-original>
          <span class="ak-approved-fixed-view__number">1</span>
          <img id="ak-approved-fixed-original" alt="Fotografía original del cliente">
          <strong class="ak-approved-fixed-view__option-title">Foto original</strong>
          <span class="ak-approved-fixed-view__option-copy">La fotografía exactamente como fue subida.</span>
        </button>
      </div>
      <p class="ak-approved-fixed-view__privacy">Tu privacidad es importante. Esta vista es solo para revisión.</p>
    `

    const notes = result.querySelector('.ak-joce-notes')
    if (notes) result.insertBefore(wrapper, notes)
    else result.appendChild(wrapper)
    return wrapper
  }

  const copyToHero = (source, label) => {
    const hero = document.getElementById('ak-approved-fixed-hero')
    const heroLabel = document.getElementById('ak-approved-fixed-hero-label')
    if (!hero || !source) return

    const width = source.naturalWidth || source.width
    const height = source.naturalHeight || source.height
    if (!width || !height) return

    hero.width = width
    hero.height = height
    hero.style.aspectRatio = `${width}/${height}`
    const context = hero.getContext('2d')
    context.clearRect(0, 0, width, height)
    context.drawImage(source, 0, 0, width, height)
    if (heroLabel) heroLabel.textContent = `${label} · seleccionado`
  }

  const selectedCard = (acrylic) => acrylic?.querySelector('.ak-acrylic-card.is-selected') || acrylic?.querySelector('[data-ak-acrylic-key="medium"]') || acrylic?.querySelector('.ak-acrylic-card')

  const showSelectedAcrylic = (wrapper, acrylic) => {
    const card = selectedCard(acrylic)
    const canvas = card?.querySelector('canvas')
    if (!canvas?.width) return
    wrapper.dataset.previewMode = 'acrylic'
    wrapper.querySelector('[data-ak-approved-original]')?.classList.remove('is-selected')
    const label = card.querySelector('.ak-acrylic-card__label')?.textContent?.trim() || 'Vista acrílica'
    copyToHero(canvas, label)
  }

  const ensure = () => {
    injectStyles()
    const result = document.getElementById('ak-analysis-result')
    const photo = document.getElementById('ak-photo-preview')
    const acrylic = document.getElementById('ak-joce-acrylic-preview')
    const catalog = document.getElementById('ak-approved-canvas-catalog')
    if (!result || !photo?.src || !acrylic || !catalog) return

    const wrapper = createWrapper(result)
    const options = wrapper.querySelector('.ak-approved-fixed-view__options')
    const original = wrapper.querySelector('#ak-approved-fixed-original')

    if (photo.src !== lastPhoto) {
      original.src = photo.src
      lastPhoto = photo.src
      wrapper.dataset.previewMode = 'acrylic'
    }

    acrylic.classList.add('ak-approved-fixed-acrylic')
    catalog.classList.add('ak-approved-fixed-catalog')

    if (acrylic.parentElement !== options) options.appendChild(acrylic)
    if (catalog.parentElement !== wrapper) wrapper.appendChild(catalog)

    acrylic.querySelectorAll('[data-ak-acrylic-key]').forEach((card, index) => {
      card.dataset.akOptionNumber = String(index + 2)
    })

    const oldSizes = document.getElementById('ak-joce-canvas-sizes')
    if (oldSizes) oldSizes.setAttribute('aria-hidden', 'true')

    if (wrapper.dataset.previewMode !== 'original') showSelectedAcrylic(wrapper, acrylic)
  }

  const schedule = (delay = 80) => {
    clearTimeout(timer)
    timer = setTimeout(ensure, delay)
  }

  document.addEventListener('click', (event) => {
    const wrapper = document.getElementById(WRAPPER_ID)
    if (!wrapper) return

    if (event.target.closest?.('[data-ak-approved-original]')) {
      wrapper.dataset.previewMode = 'original'
      wrapper.querySelector('[data-ak-approved-original]')?.classList.add('is-selected')
      document.querySelectorAll('#ak-joce-acrylic-preview .ak-acrylic-card').forEach((card) => card.classList.remove('is-selected'))
      copyToHero(document.getElementById('ak-photo-preview'), 'Foto original')
      return
    }

    const card = event.target.closest?.('#ak-joce-acrylic-preview [data-ak-acrylic-key]')
    if (card) {
      wrapper.dataset.previewMode = 'acrylic'
      wrapper.querySelector('[data-ak-approved-original]')?.classList.remove('is-selected')
      setTimeout(() => {
        document.querySelector('#ak-joce-acrylic-preview [data-ak-use-acrylic]')?.click()
        showSelectedAcrylic(wrapper, document.getElementById('ak-joce-acrylic-preview'))
      }, 50)
    }
  })

  const observer = new MutationObserver(() => schedule())
  observer.observe(document.documentElement, { childList:true, subtree:true, attributes:true, attributeFilter:['src','class'] })
  document.addEventListener('change', () => schedule(120))
  setInterval(ensure, 900)
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensure, { once:true })
  else ensure()
})()
