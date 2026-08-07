(() => {
  'use strict'

  const PRESETS = {
    simple: { scale: 0.30, saturation: 0.90, backgroundStrokes: 900, backgroundStrokeAlpha: 0.30 },
    medium: { scale: 0.46, saturation: 0.98, backgroundStrokes: 650, backgroundStrokeAlpha: 0.24 },
    detailed: { scale: 0.68, saturation: 1.04, backgroundStrokes: 430, backgroundStrokeAlpha: 0.18 },
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

  const clamp = (value) => Math.max(0, Math.min(255, value))

  const posterize = (data, levels = 15, saturation = 1.06, contrast = 1.08) => {
    const step = 255 / Math.max(2, levels - 1)
    for (let index = 0; index < data.length; index += 4) {
      let red = data[index]
      let green = data[index + 1]
      let blue = data[index + 2]
      const average = (red + green + blue) / 3

      red = average + (red - average) * saturation
      green = average + (green - average) * saturation
      blue = average + (blue - average) * saturation

      red = (red - 128) * contrast + 128
      green = (green - 128) * contrast + 128
      blue = (blue - 128) * contrast + 128

      data[index] = clamp(Math.round(red / step) * step)
      data[index + 1] = clamp(Math.round(green / step) * step)
      data[index + 2] = clamp(Math.round(blue / step) * step)
    }
  }

  const paintStrokeLayer = (context, pixels, width, height, seed, options = {}) => {
    const random = randomFactory(seed)
    const count = options.count || Math.min(1800, Math.round((width * height) / 120))
    const minLength = options.minLength || 5
    const maxLength = options.maxLength || 17
    const minWidth = options.minWidth || 1.1
    const maxWidth = options.maxWidth || 4.6
    const minAlpha = options.minAlpha || 0.16
    const maxAlpha = options.maxAlpha || 0.34
    const mask = options.mask || null

    context.save()
    context.lineCap = 'round'
    context.lineJoin = 'round'

    for (let index = 0; index < count; index += 1) {
      const x = Math.floor(random() * width)
      const y = Math.floor(random() * height)

      if (mask && !mask(x, y)) continue

      const pixel = (y * width + x) * 4
      const red = pixels[pixel]
      const green = pixels[pixel + 1]
      const blue = pixels[pixel + 2]
      const angle = (random() - 0.5) * 1.1
      const length = minLength + random() * (maxLength - minLength)
      const lineWidth = minWidth + random() * (maxWidth - minWidth)
      const alpha = minAlpha + random() * (maxAlpha - minAlpha)

      context.strokeStyle = `rgba(${red},${green},${blue},${alpha})`
      context.lineWidth = lineWidth
      context.beginPath()
      context.moveTo(x, y)
      context.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length)
      context.stroke()
    }

    context.restore()
  }

  const addCanvasTexture = (context, width, height) => {
    context.save()
    context.globalAlpha = 0.055
    context.strokeStyle = '#6f5b45'
    context.lineWidth = 0.55

    for (let y = 2; y < height; y += 5) {
      context.beginPath()
      context.moveTo(0, y)
      context.lineTo(width, y + 1)
      context.stroke()
    }

    context.globalAlpha = 0.035
    for (let x = 2; x < width; x += 7) {
      context.beginPath()
      context.moveTo(x, 0)
      context.lineTo(x + 1, height)
      context.stroke()
    }

    context.restore()
  }

  const buildBasePainting = (image) => {
    const maxSide = 820
    const ratio = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight))
    const width = Math.max(1, Math.round(image.naturalWidth * ratio))
    const height = Math.max(1, Math.round(image.naturalHeight * ratio))

    const sample = document.createElement('canvas')
    sample.width = Math.max(1, Math.round(width * 0.62))
    sample.height = Math.max(1, Math.round(height * 0.62))
    const sampleContext = sample.getContext('2d')
    sampleContext.imageSmoothingEnabled = true
    sampleContext.imageSmoothingQuality = 'high'
    sampleContext.drawImage(image, 0, 0, sample.width, sample.height)

    const base = document.createElement('canvas')
    base.width = width
    base.height = height
    const context = base.getContext('2d', { willReadFrequently: true })
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    context.drawImage(sample, 0, 0, width, height)

    const imageData = context.getImageData(0, 0, width, height)
    posterize(imageData.data, 15, 1.06, 1.08)
    context.putImageData(imageData, 0, 0)

    const seed = hash(`${image.currentSrc || image.src}|acrilico-aprobado-v2`)
    paintStrokeLayer(context, imageData.data, width, height, seed, {
      count: Math.min(2100, Math.round((width * height) / 95)),
      minLength: 4,
      maxLength: 15,
      minWidth: 1.3,
      maxWidth: 5.2,
      minAlpha: 0.18,
      maxAlpha: 0.38,
    })
    addCanvasTexture(context, width, height)

    return { canvas: base, pixels: imageData.data, seed }
  }

  const isBackgroundPoint = (x, y, width, height) => {
    const dx = (x - width * 0.56) / (width * 0.44)
    const dy = (y - height * 0.61) / (height * 0.56)
    return dx * dx + dy * dy > 1
  }

  const renderVariant = (canvas, basePainting, preset, key) => {
    const base = basePainting.canvas
    const width = base.width
    const height = base.height

    canvas.width = width
    canvas.height = height
    canvas.style.setProperty('--ak-photo-aspect', `${width}/${height}`)

    const context = canvas.getContext('2d', { willReadFrequently: true })
    context.clearRect(0, 0, width, height)
    context.drawImage(base, 0, 0)

    const background = document.createElement('canvas')
    background.width = width
    background.height = height
    const backgroundContext = background.getContext('2d', { willReadFrequently: true })

    const small = document.createElement('canvas')
    small.width = Math.max(1, Math.round(width * preset.scale))
    small.height = Math.max(1, Math.round(height * preset.scale))
    const smallContext = small.getContext('2d')
    smallContext.imageSmoothingEnabled = true
    smallContext.imageSmoothingQuality = 'high'
    smallContext.drawImage(base, 0, 0, small.width, small.height)

    backgroundContext.imageSmoothingEnabled = true
    backgroundContext.imageSmoothingQuality = 'high'
    backgroundContext.filter = `saturate(${preset.saturation})`
    backgroundContext.drawImage(small, 0, 0, width, height)
    backgroundContext.filter = 'none'

    const backgroundData = backgroundContext.getImageData(0, 0, width, height)
    posterize(backgroundData.data, key === 'simple' ? 10 : key === 'medium' ? 13 : 16, preset.saturation, 1.04)
    backgroundContext.putImageData(backgroundData, 0, 0)

    paintStrokeLayer(
      backgroundContext,
      backgroundData.data,
      width,
      height,
      basePainting.seed + (key === 'simple' ? 101 : key === 'medium' ? 202 : 303),
      {
        count: preset.backgroundStrokes,
        minLength: key === 'simple' ? 10 : 7,
        maxLength: key === 'simple' ? 28 : 21,
        minWidth: key === 'simple' ? 2.4 : 1.7,
        maxWidth: key === 'simple' ? 7.2 : 5.8,
        minAlpha: preset.backgroundStrokeAlpha * 0.65,
        maxAlpha: preset.backgroundStrokeAlpha,
        mask: (x, y) => isBackgroundPoint(x, y, width, height),
      },
    )

    context.save()
    context.beginPath()
    context.rect(0, 0, width, height)
    context.ellipse(width * 0.56, height * 0.61, width * 0.44, height * 0.56, 0, 0, Math.PI * 2)
    context.clip('evenodd')
    context.globalAlpha = key === 'simple' ? 0.95 : key === 'medium' ? 0.76 : 0.48
    context.drawImage(background, 0, 0)
    context.restore()

    addCanvasTexture(context, width, height)
  }

  const updateText = (section) => {
    const heading = section.querySelector('.ak-acrylic-preview__head h4')
    const intro = section.querySelector('.ak-acrylic-preview__head p')
    const note = section.querySelector('.ak-acrylic-preview__note')
    if (heading) heading.textContent = 'Vista previa del cuadro'
    if (intro) intro.textContent = 'Las personas y el fondo conservan pinceladas y textura acrílica; solo cambia el detalle del entorno.'
    if (note) note.textContent = 'Vista orientativa generada en el navegador. La obra final será pintada a mano por Ana Karen.'
  }

  const ensure = () => {
    const image = document.getElementById('ak-photo-preview')
    const section = document.getElementById('ak-joce-acrylic-preview')
    if (!image?.naturalWidth || !section) return

    const canvases = [...section.querySelectorAll('[data-ak-acrylic-canvas]')]
    if (canvases.length !== 3) return

    const signature = `${image.currentSrc || image.src}|${image.naturalWidth}x${image.naturalHeight}|v2`
    if (signature === lastSignature && section.dataset.akSimpleStyle === 'ready-v2') return
    lastSignature = signature

    const basePainting = buildBasePainting(image)
    canvases.forEach((canvas) => {
      const key = canvas.dataset.akAcrylicCanvas || 'medium'
      renderVariant(canvas, basePainting, PRESETS[key] || PRESETS.medium, key)
    })

    updateText(section)
    section.dataset.akSimpleStyle = 'ready-v2'
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
