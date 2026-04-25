import { useState, useEffect, useCallback } from 'react'
import { api } from '../api'
import MarketCard from '../components/MarketCard'

const STATUS_LABEL = {
  pending: 'Queued',
  running: 'Running…',
  complete: 'Complete',
}

const STATUS_COLOR = {
  pending: '#6B7280',
  running: '#C97A2F',
  complete: '#16A34A',
}

export default function ResultsPage({ simulationId }) {
  const [sim, setSim] = useState(null)
  const [markets, setMarkets] = useState(null)
  const [error, setError] = useState('')
  const [running, setRunning] = useState(false)

  const fetchSim = useCallback(async () => {
    try {
      const s = await api.getSimulation(simulationId)
      setSim(s)
      return s
    } catch (err) {
      setError(err.message)
      return null
    }
  }, [simulationId])

  const fetchMarkets = useCallback(async () => {
    try {
      const m = await api.getMarkets(simulationId)
      setMarkets(m)
    } catch {
      // markets may not be ready yet
    }
  }, [simulationId])

  useEffect(() => {
    if (!simulationId) return
    fetchSim()
    fetchMarkets()
  }, [simulationId, fetchSim, fetchMarkets])

  // Poll while running
  useEffect(() => {
    if (!sim) return
    if (sim.status !== 'running' && sim.status !== 'pending') return
    const id = setInterval(async () => {
      const s = await fetchSim()
      await fetchMarkets()
      if (s && s.status === 'complete') clearInterval(id)
    }, 5000)
    return () => clearInterval(id)
  }, [sim, fetchSim, fetchMarkets])

  async function handleRun() {
    setRunning(true)
    setError('')
    try {
      await api.runSimulation(simulationId)
      await fetchSim()
    } catch (err) {
      setError(err.message)
    } finally {
      setRunning(false)
    }
  }

  if (!simulationId) {
    return (
      <div className="text-center py-20 text-gray-500">
        No simulation created yet. Define metrics first.
      </div>
    )
  }

  if (!sim) {
    return (
      <div className="flex items-center gap-3 py-10">
        <div className="w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
        <span className="text-gray-500">Loading simulation…</span>
      </div>
    )
  }

  // Group markets by metric_id
  const byMetric = {}
  if (markets) {
    for (const m of markets) {
      if (!byMetric[m.metric_id]) byMetric[m.metric_id] = {}
      byMetric[m.metric_id][m.condition] = m
    }
  }

  return (
    <div>
      {/* Simulation header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Simulation Results</h1>
          <div className="flex items-center gap-2 mt-1">
            <span
              className="inline-flex items-center gap-1.5 text-sm font-medium"
              style={{ color: STATUS_COLOR[sim.status] }}
            >
              {sim.status === 'running' && (
                <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
              )}
              {STATUS_LABEL[sim.status] || sim.status}
            </span>
            {sim.completed_at && (
              <span className="text-xs text-gray-400">
                · Completed {new Date(sim.completed_at).toLocaleString()}
              </span>
            )}
          </div>
        </div>

        {sim.status === 'pending' && (
          <button
            onClick={handleRun}
            disabled={running}
            className="px-6 py-2.5 rounded-xl font-medium text-white disabled:opacity-50 flex items-center gap-2"
            style={{ background: '#C97A2F' }}
          >
            {running ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Starting…
              </>
            ) : (
              '▶ Run Simulation'
            )}
          </button>
        )}
      </div>

      {error && (
        <p className="mb-4 text-sm text-red-600 bg-red-50 rounded-lg px-4 py-2">{error}</p>
      )}

      {/* Markets */}
      {Object.keys(byMetric).length > 0 ? (
        <div className="space-y-6">
          {Object.entries(byMetric).map(([metricId, conditions]) => {
            const sample = conditions.passes || conditions.fails
            return (
              <div key={metricId} className="bg-white/60 rounded-2xl p-6 shadow-sm">
                <div className="mb-1">
                  <p className="text-xs text-gray-400 uppercase tracking-wide">{metricId.replace(/_/g, ' ')}</p>
                  <h2 className="font-semibold text-lg">{sample?.metric_description}</h2>
                </div>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {['passes', 'fails'].map((cond) =>
                    conditions[cond] ? (
                      <MarketCard key={cond} market={conditions[cond]} />
                    ) : null
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        sim.status === 'pending' && (
          <div className="bg-white/40 rounded-2xl p-10 text-center text-gray-500">
            <p className="text-lg mb-2">Ready to run</p>
            <p className="text-sm">
              Click "Run Simulation" to have all {sim.markets?.length / 2 || '?'} personas bet on the markets.
            </p>
          </div>
        )
      )}

      {(sim.status === 'running' || sim.status === 'pending') && markets && markets.length > 0 && (
        <div className="mt-4 text-center text-sm text-gray-500">
          Polling every 5 seconds…
        </div>
      )}
    </div>
  )
}
