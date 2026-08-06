const assert = require('node:assert/strict')
const { calculate, round50 } = require('../pricing.js')

const base = {
  materials: [{ cost: 900 }],
  hours: 12,
  hourlyRate: 150,
  packaging: 200,
  shipping: 0,
  indirectPercent: 10,
  people: 1,
  pets: 0,
  background: 'Sencillo',
  urgent: false,
  marginPercent: 35,
  depositPercent: 50,
}

const result = calculate(base)
assert.equal(result.materialCost, 900)
assert.equal(result.laborCost, 1800)
assert.equal(result.totalCost, 3190)
assert.equal(result.suggestedPrice, 4950)
assert.equal(result.deposit, 2500)
assert.equal(result.balance, 2450)
assert.equal(round50(4923), 4950)

const urgent = calculate({ ...base, urgent: true })
assert.ok(urgent.suggestedPrice > result.suggestedPrice)
assert.ok(urgent.urgencyCost > 0)

const complex = calculate({ ...base, people: 2, pets: 1, background: 'Muy detallado' })
assert.ok(complex.complexityCost > 0)
assert.ok(complex.suggestedPrice > result.suggestedPrice)

console.log('Pricing tests passed')
