(() => {
  'use strict'

  const CARD_ID = 'ak-joce-photo-analysis'
  const STYLE_ID = 'ak-joce-photo-position-style'

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
    addStyles()

    const form = document.getElementById('quote-form')
    const card = document.getElementById(CARD_ID)
    if (!form || !card) return

    const firstRegularCard = [...form.children].find((node) =>
      node instanceof HTMLElement &&
      node.classList.contains('form-card') &&
      node.id !== CARD_ID
    )

    if (firstRegularCard && card.nextElementSibling !== firstRegularCard) {
      form.insertBefore(card, firstRegularCard)
    }

    card.dataset.joceFirst = 'true'

    const heading = card.querySelector('.form-card-title h3')
    if (heading) heading.textContent = 'Primero, JoCe analiza la foto'
  }

  const observer = new MutationObserver(placeFirst)
  observer.observe(document.documentElement, { childList: true, subtree: true })

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', placeFirst)
  } else {
    placeFirst()
  }

  setTimeout(placeFirst, 100)
  setTimeout(placeFirst, 500)
})()
