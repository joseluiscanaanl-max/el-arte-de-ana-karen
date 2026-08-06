(() => {
  'use strict'

  const STYLE_ID = 'ak-acrylic-share-style'
  let busy = false

  const injectStyles = () => {
    if (document.getElementById(STYLE_ID)) return
    const style = document.createElement('style')
    style.id = STYLE_ID
    style.textContent = `
      .ak-acrylic-preview__share {
        min-height: 42px;
        padding: 9px 15px;
        border: 2px solid var(--purple-700);
        border-radius: 12px;
        background: #fffaff;
        color: var(--purple-700);
        font: inherit;
        font-weight: 900;
        cursor: pointer;
      }
      .ak-acrylic-preview__share:disabled { opacity: .62; cursor: wait; }
      .ak-acrylic-share-status {
        grid-column: 1 / -1;
        margin: 0;
        color: var(--muted);
        font-size: .76rem;
        line-height: 1.4;
      }
      @media (max-width: 520px) {
        .ak-acrylic-preview__share { width: 100%; }
      }
    `
    document.head.appendChild(style)
  }

  const ensureButton = () => {
    injectStyles()
    const section = document.getElementById('ak-joce-acrylic-preview')
    const selection = section?.querySelector('.ak-acrylic-preview__selection')
    if (!selection || selection.querySelector('[data-ak-share-acrylic]')) return

    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'ak-acrylic-preview__share'
    button.dataset.akShareAcrylic = ''
    button.textContent = 'Compartir vista previa'

    const status = document.createElement('p')
    status.className = 'ak-acrylic-share-status'
    status.dataset.akShareStatus = ''
    status.textContent = 'La imagen se genera en este dispositivo; no se envía a servidores externos.'

    selection.append(button, status)
  }

  const selectedData = () => {
    const section = document.getElementById('ak-joce-acrylic-preview')
    const card = section?.querySelector('.ak-acrylic-card.is-selected')
    const canvas = card?.querySelector('canvas')
    const label = card?.querySelector('.ak-acrylic-card__label')?.textContent?.trim() || 'Vista acrílica'
    return { section, canvas, label }
  }

  const canvasBlob = (canvas) => new Promise((resolve, reject) => {
    if (!canvas) return reject(new Error('No hay una vista seleccionada'))
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('No se pudo preparar la imagen'))
    }, 'image/png', 0.95)
  })

  const safeName = (label) => label
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

  const download = (blob, filename) => {
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const shareSelected = async () => {
    if (busy) return
    const { section, canvas, label } = selectedData()
    const button = section?.querySelector('[data-ak-share-acrylic]')
    const status = section?.querySelector('[data-ak-share-status]')
    if (!canvas || !button) return

    busy = true
    button.disabled = true
    button.textContent = 'Preparando…'
    if (status) status.textContent = 'JoCe está preparando la vista seleccionada.'

    try {
      const blob = await canvasBlob(canvas)
      const filename = `el-arte-de-ana-karen-${safeName(label)}.png`
      const file = new File([blob], filename, { type: 'image/png' })
      const shareData = {
        title: 'Vista previa de El Arte de Ana Karen',
        text: `${label}. Simulación orientativa de cómo podría verse la obra en pintura acrílica.`,
        files: [file],
      }

      if (navigator.share && (!navigator.canShare || navigator.canShare(shareData))) {
        await navigator.share(shareData)
        if (status) status.textContent = 'Vista previa compartida.'
      } else {
        download(blob, filename)
        if (status) status.textContent = 'La vista previa se descargó para que puedas enviarla al cliente.'
      }
    } catch (error) {
      if (error?.name === 'AbortError') {
        if (status) status.textContent = 'Se canceló el envío. La vista continúa disponible.'
      } else if (status) {
        status.textContent = 'No se pudo compartir en este intento. Vuelve a intentarlo.'
      }
    } finally {
      busy = false
      button.disabled = false
      button.textContent = 'Compartir vista previa'
    }
  }

  document.addEventListener('click', (event) => {
    if (event.target.closest?.('[data-ak-share-acrylic]')) shareSelected()
  })

  injectStyles()
  setInterval(ensureButton, 700)
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensureButton, { once: true })
  else ensureButton()
})()
