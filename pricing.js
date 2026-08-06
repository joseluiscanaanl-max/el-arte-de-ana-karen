(function (root, factory) {
  const api = factory()
  if (typeof module === 'object' && module.exports) module.exports = api
  else root.AKPricing = api
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict'

  const money = (value) => new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 0,
  }).format(Number(value) || 0)

  const round50 = (value) => Math.ceil(value / 50) * 50

  const calculate = (draft) => {
    const materialCost = draft.materials.reduce((sum, item) => sum + Math.max(0, Number(item.cost) || 0), 0)
    const laborCost = Math.max(0, Number(draft.hours) || 0) * Math.max(0, Number(draft.hourlyRate) || 0)
    const baseCost = materialCost + laborCost + Math.max(0, Number(draft.packaging) || 0) + Math.max(0, Number(draft.shipping) || 0)
    const indirectCost = baseCost * (Math.max(0, Number(draft.indirectPercent) || 0) / 100)
    const peopleFactor = Math.max(0, (Number(draft.people) || 0) - 1) * 0.10
    const petsFactor = Math.max(0, Number(draft.pets) || 0) * 0.07
    const backgroundFactor = draft.background === 'Muy detallado' ? 0.18 : draft.background === 'Detallado' ? 0.10 : 0
    const complexityCost = (laborCost + materialCost) * (peopleFactor + petsFactor + backgroundFactor)
    const beforeUrgency = baseCost + indirectCost + complexityCost
    const urgencyCost = draft.urgent ? beforeUrgency * 0.25 : 0
    const totalCost = beforeUrgency + urgencyCost
    const margin = Math.min(0.8, Math.max(0, (Number(draft.marginPercent) || 0) / 100))
    const suggestedPrice = round50(totalCost / (1 - margin || 1))
    const profit = suggestedPrice - totalCost
    const deposit = round50(suggestedPrice * ((Number(draft.depositPercent) || 0) / 100))
    const balance = suggestedPrice - deposit
    return { materialCost, laborCost, indirectCost, complexityCost, urgencyCost, totalCost, suggestedPrice, profit, deposit, balance }
  }

  return { calculate, money, round50 }
})
