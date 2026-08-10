(() => {
  'use strict'

  const selector = 'select[data-status-id]'

  const confirmationText = (value) => value === 'Cancelada'
    ? 'Confirmar cancelación'
    : `Confirmar avance a “${value}”`

  const lockUntilWorkflowReady = (root = document) => {
    root.querySelectorAll?.(selector).forEach((select) => {
      if (select.dataset.workflowFix) return
      select.disabled = true
      select.setAttribute('aria-busy', 'true')
    })
  }

  document.addEventListener('change', (event) => {
    const select = event.target?.closest?.(selector)
    if (!select) return

    event.stopImmediatePropagation()
    const button = select.closest('.order-card')?.querySelector('.workflow-confirm-button')
    if (button) button.textContent = confirmationText(select.value)
  }, true)

  const start = () => {
    lockUntilWorkflowReady()
    const app = document.getElementById('app')
    if (!app) return
    new MutationObserver(() => lockUntilWorkflowReady(app)).observe(app, { childList: true, subtree: true })
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true })
  else start()
})()
