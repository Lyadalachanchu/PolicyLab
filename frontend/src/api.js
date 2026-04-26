const BASE = '/api'

async function req(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body != null ? { 'Content-Type': 'application/json' } : {},
    body: body != null ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || res.statusText)
  }
  return res.json()
}

export const api = {
  getMunicipality: (code) => req('GET', `/municipalities/${code}`),

  generatePersonas: (code, n = 30) =>
    req('POST', `/municipalities/${code}/personas/generate`, { n }),

  getPersonas: (code) => req('GET', `/municipalities/${code}/personas`),

  addPersona: (code, data) => req('POST', `/municipalities/${code}/personas`, data),

  suggestMetrics: (policy) => req('POST', `/metrics/suggest`, { policy }),

  createPolicy: (data) => req('POST', `/policies`, data),

  createSimulation: (policyId, metrics) =>
    req('POST', `/policies/${policyId}/simulations`, { metrics }),

  getSimulation: (id) => req('GET', `/simulations/${id}`),

  runSimulation: (id) => req('POST', `/simulations/${id}/run`),

  getMarkets: (simulationId) => req('GET', `/simulations/${simulationId}/markets`),

  getMarket: (marketId) => req('GET', `/markets/${marketId}`),

  getImprovements: (simulationId) =>
    req('POST', `/simulations/${simulationId}/improvements`),
}
