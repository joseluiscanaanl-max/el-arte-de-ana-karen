(() => {
  'use strict'

  const PRESETS = {
    simple: { scale: 0.16, blur: 7, saturation: 0.82 },
    medium: { scale: 0.30, blur: 3, saturation: 0.94 },
    detailed: { scale: 0.48, blur: 0.8, saturation: 1 },
  }
  let lastSignature = ''

  const randomFactory = (seed) => {
    let state = seed || 1
    return () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296)
  }

  const hash = (value) => {
    let state = 2166136261
    for (let index = 0; index < value.length; index += 1) {
      state ^= value.charCodeAt(index)
      state = Math.imul(state, 16777619)
    }
    return state >>> 0
  }

  const basePainting = (image) => {
    const maxSide = 760
    const ratio = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight))
    const width = Math.max(1, Math.round(image.naturalWidth * ratio))
    const height = Math.max(1, Math.round(image.naturalHeight * ratio))
    const sample = document.createElement('canvas')
    sample.width = Math.max(1, Math.round(width * 0.52))
    sample.height = Math.max(1, Math.round(height * 0.52))
    sample.getContext('2d').drawImage(image, 0, 0, sample.width, sample.height)

    const base = document.createElement('canvas')
    base.width = width
    base.height = height
    const context = base.getContext('2d', { willReadFrequently: true })
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    context.drawImage(sample, 0, 0, width, height)

    const imageData = context.getImageData(0, 0, width, height)
    const data = imageData.data
    const step = 255 / 17
    for (let index = 0; index < data.length; index += 4) {
      const average = (data[index] + data[index + 1] + data[index + 2]) / 3
      for (let channel = 0; channel < 3; channel += 1) {
        let value = average + (data[index + channel] - average) * 1.03
        value = (value - 128) * 1.04 + 128
        data[index + channel] = Math.max(0, Math.min(255, Math.round(value / step) * step))
      }
    }
    context.putImageData(imageData, 0, 0)

    const random = randomFactory(hash(`${image.currentSrc || image.src}|acrilico-sencillo`))
    context.save()
    context.globalCompositeOperation = 'soft-light'
    context.lineCap = 'round'
    const count = Math.min(680, Math.round(width * height / 220))
    for (let index = 0; index < count; index += 1) {
      const x = Math.floor(random() * width)
      const y = Math.floor(random() * height)
      const pixel = (y * width + x) * 4
      const angle = (random() - 0.5) * 0.72
      const length = 7 + random() * 18
      context.strokeStyle = `rgba(${data[pixel]},${data[pixel + 1]},${data[pixel + 2]},${0.11 + random() * 0.15})`
      context.lineWidth = 1.4 + random() * 3.1
      context.beginPath()
      context.moveTo(x, y)
      context.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length)
      context.stroke()
    }
    context.restore()
    return base
  }

  const subjectMask = (width, height) => {
    const mask = document.createElement('canvas')
    mask.width = width
    mask.height = height
    const context = mask.getContext('2d')
    context.filter = `blur(${Math.max(18, Math.round(width * 0.035))}px)`
    context.fillStyle = '#fff'
    context.beginPath()
    context.ellipse(width * 0.54, height * 0.61, width * 0.43, height * 0.57, 0, 0, Math.PI * 2)
    context.fill()
    return mask
  }

  const renderVariant = (canvas, base, mask, preset) => {
    const small = document.createElement('canvas')
    small.width = Math.max(1, Math.round(base.width * preset.scale))
    small.height = Math.max(1, Math.round(base.height * preset.scale))
    small.getContext('2d').drawImage(base, 0, 0, small.width, small.height)

    canvas.width = base.width
    canvas.height = base.height
    canvas.style.setProperty('--ak-photo-aspect', `${base.width}/${base.height}`)
    const context = canvas.getContext('2d')
    context.filter = `blur(${preset.blur}px) saturate(${preset.saturation})`
    context.drawImage(small, 0, 0, base.width, base.height)
    context.filter = 'none'

    const subjects = document.createElement('canvas')
    subjects.width = base.width
    subjects.height = base.height
    const subjectContext = subjects.getContext('2d')
    subjectContext.drawImage(base, 0, 0)
    subjectContext.globalCompositeOperation = 'destination-in'
    subjectContext.drawImage(mask, 0, 0)
    context.drawImage(subjects, 0, 0)
  }

  const updateText = (section) => {
    const heading = section.querySelector('.ak-acrylic-preview__head h4')
    const intro = section.querySelector('.ak-acrylic-preview__head p')
    const note = section.querySelector('.ak-acrylic-preview__note')
    if (heading) heading.textContent = 'Vista previa del cuadro'
    if (intro) intro.textContent = 'La foto original se convierte una sola vez a pintura acrílica sencilla; en las tres opciones solo cambia el fondo.'
    if (note) note.textContent = 'Estilo fijo aprobado: mismas personas, encuadre y pinceladas. Únicamente cambia el nivel de detalle del fondo.'
  }

  const ensure = () => {
    const image = document.getElementById('ak-photo-preview')
    const section = document.getElementById('ak-joce-acrylic-preview')
    if (!image?.naturalWidth || !section) return
    const canvases = [...section.querySelectorAll('[data-ak-acrylic-canvas]')]
    if (canvases.length !== 3) return

    const signature = `${image.currentSrc || image.src}|${image.naturalWidth}x${image.naturalHeight}|${canvases.map((canvas) => canvas.isConnected).join('')}`
    if (signature === lastSignature && section.dataset.akSimpleStyle === 'ready') return
    lastSignature = signature

    const base = basePainting(image)
    const mask = subjectMask(base.width, base.height)
    canvases.forEach((canvas) => {
      const key = canvas.dataset.akAcrylicCanvas
      renderVariant(canvas, base, mask, PRESETS[key] || PRESETS.medium)
    })
    updateText(section)
    section.dataset.akSimpleStyle = 'ready'
  }

  document.addEventListener('change', (event) => {
    if (event.target?.id === 'ak-reference-photo') {
      lastSignature = ''
      document.getElementById('ak-joce-acrylic-preview')?.removeAttribute('data-ak-simple-style')
    }
  })

  setInterval(ensure, 700)
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensure, { once: true })
  else ensure()
})()
