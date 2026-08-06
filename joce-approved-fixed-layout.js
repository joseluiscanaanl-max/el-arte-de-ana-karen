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
      .ak-approved-fixed-view { display:grid; gap:18px; margin-top:16px; }
      .ak-approved-fixed-view__title { display:flex; align-items:center; gap:8px; margin:0; color:var(--purple-900); font-size:1.38rem; }
      .ak-approved-fixed-view__top { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; align-items:stretch; }
      .ak-approved-fixed-view__original { display:grid; align-content:start; gap:9px; min-width:0; padding:10px; border:2px solid var(--line); border-radius:18px; background:#fff; }
      .ak-approved-fixed-view__label { display:flex; align-items:center; gap:7px; color:var(--purple-900); font-size:.83rem; font-weight:900; }
      .ak-approved-fixed-view__original img { display:block; width:100%; aspect-ratio:4/3; border-radius:13px; background:#f2eaf3; object-fit:cover; }
      .ak-approved-fixed-view__note { grid-column:1/-1; margin:0; padding:10px 13px; border-radius:999px; background:#f8effb; color:#684979; text-align:center; font-size:.82rem; line-height:1.4; }

      #ak-joce-acrylic-preview.ak-approved-fixed-acrylic { display:contents !important; }
      #ak-joce-acrylic-preview.ak-approved-fixed-acrylic .ak-acrylic-preview__head,
      #ak-joce-acrylic-preview.ak-approved-fixed-acrylic .ak-acrylic-preview__selection,
      #ak-joce-acrylic-preview.ak-approved-fixed-acrylic > p,
      #ak-joce-acrylic-preview.ak-approved-fixed-acrylic > button { display:none !important; }
      #ak-joce-acrylic-preview.ak-approved-fixed-acrylic .ak-acrylic-preview__grid { display:contents !important; }
      #ak-joce-acrylic-preview.ak-approved-fixed-acrylic .ak-acrylic-card { min-width:0; height:100%; padding:10px; border-radius:18px; }
      #ak-joce-acrylic-preview.ak-approved-fixed-acrylic .ak-acrylic-card canvas { width:100%; aspect-ratio:4/3; object-fit:cover; }
      #ak-joce-acrylic-preview.ak-approved-fixed-acrylic .ak-acrylic-card__description { min-height:0; }
      #ak-joce-acrylic-preview.ak-approved-fixed-acrylic .ak-acrylic-card__meta,
      #ak-joce-acrylic-preview.ak-approved-fixed-acrylic .ak-acrylic-card__choose { display:none !important; }

      #ak-approved-canvas-catalog.ak-approved-fixed-catalog { display:grid !important; grid-template-columns:minmax(0,1.15fr) minmax(320px,.85fr); grid-template-areas:'head head' 'list price' 'note price' 'actions actions'; gap:14px; margin-top:0; }
      #ak-approved-canvas-catalog.ak-approved-fixed-catalog .ak-approved-catalog__head { grid-area:head; }
      #ak-approved-canvas-catalog.ak-approved-fixed-catalog .ak-approved-catalog__list { grid-area:list; }
      #ak-approved-canvas-catalog.ak-approved-fixed-catalog .ak-approved-catalog__note { grid-area:note; align-self:start; }
      #ak-approved-canvas-catalog.ak-approved-fixed-catalog .ak-approved-price { grid-area:price; grid-template-columns:minmax(120px,.72fr) minmax(180px,1.28fr); align-self:stretch; }
      #ak-approved-canvas-catalog.ak-approved-fixed-catalog .ak-approved-catalog__actions { grid-area:actions; }
      #ak-joce-canvas-sizes { display:none !important; }

      @media (max-width:980px) {
        .ak-approved-fixed-view__top { grid-template-columns:repeat(2,minmax(0,1fr)); }
        #ak-approved-canvas-catalog.ak-approved-fixed-catalog { grid-template-columns:1fr; grid-template-areas:'head' 'list' 'note' 'price' 'actions'; }
      }
      @media (max-width:580px) {
        .ak-approved-fixed-view__top { grid-template-columns:1fr; }
        .ak-approved-fixed-view__note { border-radius:15px; }
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
    wrapper.innerHTML = `
      <h3 class="ak-approved-fixed-view__title">Vista previa ♡</h3>
      <div class="ak-approved-fixed-view__top">
        <article class="ak-approved-fixed-view__original">
          <span class="ak-approved-fixed-view__label">▣ Foto original</span>
          <img id="ak-approved-fixed-original" alt="Fotografía original del cliente">
        </article>
        <p class="ak-approved-fixed-view__note">Vista aproximada en pintura acrílica. La obra final será pintada a mano por Ana Karen.</p>
      </div>
    `

    const notes = result.querySelector('.ak-joce-notes')
    if (notes) result.insertBefore(wrapper, notes)
    else result.appendChild(wrapper)
    return wrapper
  }

  const ensure = () => {
    injectStyles()
    const result = document.getElementById('ak-analysis-result')
    const photo = document.getElementById('ak-photo-preview')
    const acrylic = document.getElementById('ak-joce-acrylic-preview')
    const catalog = document.getElementById('ak-approved-canvas-catalog')
    if (!result || !photo?.src || !acrylic || !catalog) return

    const wrapper = createWrapper(result)
    const top = wrapper.querySelector('.ak-approved-fixed-view__top')
    const note = wrapper.querySelector('.ak-approved-fixed-view__note')
    const original = wrapper.querySelector('#ak-approved-fixed-original')

    if (photo.src !== lastPhoto) {
      original.src = photo.src
      lastPhoto = photo.src
    }

    acrylic.classList.add('ak-approved-fixed-acrylic')
    catalog.classList.add('ak-approved-fixed-catalog')

    if (acrylic.parentElement !== top) top.insertBefore(acrylic, note)
    if (catalog.parentElement !== wrapper) wrapper.appendChild(catalog)

    const oldSizes = document.getElementById('ak-joce-canvas-sizes')
    if (oldSizes) oldSizes.setAttribute('aria-hidden', 'true')
  }

  const schedule = (delay = 80) => {
    clearTimeout(timer)
    timer = setTimeout(ensure, delay)
  }

  const observer = new MutationObserver(() => schedule())
  observer.observe(document.documentElement, { childList:true, subtree:true, attributes:true, attributeFilter:['src','class'] })
  document.addEventListener('click', () => schedule(120))
  document.addEventListener('change', () => schedule(120))
  setInterval(ensure, 1000)
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensure, { once:true })
  else ensure()
})()
