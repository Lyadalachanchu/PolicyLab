import { useState, useEffect, useCallback } from 'react'
import { api } from '../api'
import MarketCard from '../components/MarketCard'

const STATUS_LABEL = { pending: 'Pending', running: 'Running', complete: 'Complete' }
const STATUS_COLOR = { pending: '#8A8A8A', running: '#C97A2F', complete: '#389800' }

export default function ResultsPage({ simulationId, onViewImprovements, onComplete }) {
  const [sim, setSim] = useState(null)
  const [markets, setMarkets] = useState(null)
  const [error, setError] = useState('')
  const [running, setRunning] = useState(false)

  const fetchSim = useCallback(async () => {
    try { const s = await api.getSimulation(simulationId); setSim(s); return s }
    catch (err) { setError(err.message); return null }
  }, [simulationId])

  const fetchMarkets = useCallback(async () => {
    try { const m = await api.getMarkets(simulationId); setMarkets(m) }
    catch {}
  }, [simulationId])

  useEffect(() => {
    if (!simulationId) return
    fetchSim(); fetchMarkets()
  }, [simulationId, fetchSim, fetchMarkets])

  useEffect(() => {
    if (sim?.status === 'complete') onComplete?.()
  }, [sim, onComplete])

  useEffect(() => {
    if (!sim) return
    if (sim.status !== 'running' && sim.status !== 'pending') return
    const id = setInterval(async () => {
      const s = await fetchSim(); await fetchMarkets()
      if (s && s.status === 'complete') clearInterval(id)
    }, 5000)
    return () => clearInterval(id)
  }, [sim, fetchSim, fetchMarkets])

  async function handleRun() {
    setRunning(true); setError('')
    try { await api.runSimulation(simulationId); await fetchSim() }
    catch (err) { setError(err.message) }
    finally { setRunning(false) }
  }

  if (!simulationId) return (
    <div className="py-20 text-center text-gray-400">
      <p className="text-sm uppercase tracking-widest" style={{ letterSpacing: '0.1em' }}>No simulation created yet — define metrics first.</p>
    </div>
  )

  if (!sim) return (
    <div className="py-20 flex items-center justify-center gap-3 text-gray-400">
      <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
      <span className="text-sm">Loading simulation…</span>
    </div>
  )

  const byMetric = {}
  if (markets) {
    for (const m of markets) {
      if (!byMetric[m.metric_id]) byMetric[m.metric_id] = {}
      byMetric[m.metric_id][m.condition] = m
    }
  }

  return (
    <div>
      {/* Page header */}
      <div className="flex items-start justify-between mb-10" style={{ borderBottom: '1px solid #D9DEE8', paddingBottom: '2rem' }}>
        <div>
          <p className="text-xs uppercase tracking-widest text-gray-400 mb-2" style={{ letterSpacing: '0.12em' }}>Step 5 of 6</p>
          <h1 className="text-4xl mb-2" style={{ fontFamily: 'Instrument Serif, Georgia, serif' }}>Simulation Results</h1>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-2 text-sm font-semibold" style={{ color: STATUS_COLOR[sim.status] }}>
              {sim.status === 'running' && <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />}
              {STATUS_LABEL[sim.status] || sim.status}
            </span>
            {sim.completed_at && (
              <span className="text-xs text-gray-400">· {new Date(sim.completed_at).toLocaleString()}</span>
            )}
          </div>
        </div>

        <div className="flex gap-3 shrink-0">
          {sim.status === 'complete' && (
            <span className="text-xs uppercase tracking-widest text-green-600 font-semibold" style={{ letterSpacing: '0.1em' }}>
              ✓ Complete — scroll to improve
            </span>
          )}
          {sim.status === 'pending' && (
            <button onClick={handleRun} disabled={running}
              className="px-6 py-3 text-xs font-semibold uppercase text-white disabled:opacity-40 flex items-center gap-2"
              style={{ background: '#0D132D', letterSpacing: '0.08em' }}>
              {running ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Starting…</> : '▶ Run Simulation'}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="border-l-4 border-red-600 bg-red-50 px-4 py-3 mb-6">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Markets */}
      {Object.keys(byMetric).length > 0 ? (
        <div className="space-y-10">
          {Object.entries(byMetric).map(([metricId, conditions]) => {
            const sample = conditions.passes || conditions.fails
            const [title, ...rest] = (sample?.metric_description || '').split(' — ')
            const desc = rest.join(' — ')
            return (
              <div key={metricId}>
                <div className="mb-4" style={{ borderLeft: '3px solid #0D132D', paddingLeft: '1rem' }}>
                  <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1" style={{ letterSpacing: '0.1em' }}>
                    {metricId.replace(/_/g, ' ')}
                  </p>
                  <h2 className="text-xl font-semibold text-gray-900" style={{ fontFamily: 'Instrument Serif, Georgia, serif' }}>{title}</h2>
                  {desc && <p className="text-sm text-gray-500 mt-0.5">{desc}</p>}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {['passes', 'fails'].map((cond) =>
                    conditions[cond] ? <MarketCard key={cond} market={conditions[cond]} /> : null
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : sim.status === 'pending' && (
        <div className="py-16 text-center" style={{ border: '1px solid #D9DEE8' }}>
          <p className="text-gray-400 text-sm uppercase tracking-widest mb-2" style={{ letterSpacing: '0.1em' }}>Ready to run</p>
          <p className="text-gray-400 text-sm">Click "Run Simulation" to start the prediction market.</p>
        </div>
      )}

      {(sim.status === 'running' || sim.status === 'pending') && markets && markets.length > 0 && (
        <p className="mt-6 text-center text-xs text-gray-400">Polling every 5 seconds…</p>
      )}
    </div>
  )
}
