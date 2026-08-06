(() => {
  'use strict'

  const CARD_ID = 'ak-joce-photo-analysis'
  const STYLE_ID = 'ak-joce-photo-position-style'
  let scheduled = false

  const addStyles = () => {
    if (document.getElementById(STYLE_ID)) return
    const style = document.createElement('style')
    style.id = STYLE_ID
    style.textContent = `
      .quote-page #${CARD_ID} {
        grid-column: 1 / -1 !important;
        width: 100%;
      }

      .quote-page #${CARD_ID}[data-joce-first="true"] {
        box-shadow: 0 18px 38px rgba(95, 7, 149, 0.14);
      }
    `
    document.head.appendChild(style)
  }

  const placeFirst = () => {
    scheduled = false
    addStyles()

    const form = document.getElementById('quote-form')
    const card = document.getElementById(CARD_ID)
    if (!form || !card) return

    const firstRegularCard = [...form.querySelectorAll('.form-card')].find((node) =>
      node instanceof HTMLElement && node.id !== CARD_ID
    )

    if (firstRegularCard && card !== firstRegularCard) {
      const parent = firstRegularCard.parentNode
      if (parent && (card.parentNode !== parent || card.nextElementSibling !== firstRegularCard)) {
        parent.insertBefore(card, firstRegularCard)
      }
    }

    if (card.dataset.joceFirst !== 'true') card.dataset.joceFirst = 'true'

    const heading = card.querySelector('.form-card-title h3')
    const title = 'Primero, JoCe analiza la foto'
    if (heading && heading.textContent !== title) heading.textContent = title
  }

  const schedulePlace = () => {
    if (scheduled) return
    scheduled = true
    requestAnimationFrame(placeFirst)
  }

  const app = document.getElementById('app') || document.documentElement
  const observer = new MutationObserver(schedulePlace)
  observer.observe(app, { childList: true, subtree: true })

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', schedulePlace, { once: true })
  } else {
    schedulePlace()
  }
})()
