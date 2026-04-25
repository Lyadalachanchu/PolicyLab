import { useState } from 'react'
import { api } from '../api'

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
}

const TAG_COLORS = {
  Access: 'bg-blue-100 text-blue-700',
  Equity: 'bg-purple-100 text-purple-700',
  Finance: 'bg-green-100 text-green-700',
  Performance: 'bg-yellow-100 text-yellow-700',
  Demand: 'bg-orange-100 text-orange-700',
  Employment: 'bg-teal-100 text-teal-700',
  Housing: 'bg-pink-100 text-pink-700',
  Health: 'bg-red-100 text-red-700',
}

function MetricCard({ metric, selected, onToggle, onBucketsChange }) {
  const [editingBuckets, setEditingBuckets] = useState(false)
  const [bucketText, setBucketText] = useState(metric.ranges.join('\n'))

  function saveBuckets() {
    const buckets = bucketText
      .split('\n')
      .map((b) => b.trim())
      .filter(Boolean)
    if (buckets.length >= 2) {
      onBucketsChange(buckets)
      setEditingBuckets(false)
    }
  }

  return (
    <div
      className={`rounded-2xl p-5 transition-all ${
        selected ? 'bg-white shadow-sm ring-2' : 'bg-white/40'
      }`}
      style={selected ? { ringColor: '#C97A2F' } : {}}
    >
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          className="mt-1 w-4 h-4 rounded accent-amber-600"
        />
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                TAG_COLORS[metric.tag] || 'bg-gray-100 text-gray-600'
              }`}
            >
              {metric.tag}
            </span>
            <span className="text-xs text-gray-400">{metric.unit}</span>
          </div>
          <h3 className="font-semibold">{metric.name}</h3>
          <p className="text-sm text-gray-600 mt-1">{metric.desc}</p>

          <div className="mt-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-gray-500">Prediction buckets</span>
              {selected && (
                <button
                  onClick={() => setEditingBuckets(!editingBuckets)}
                  className="text-xs text-gray-400 hover:text-gray-600"
                >
                  {editingBuckets ? 'Done' : 'Edit'}
                </button>
              )}
            </div>

            {editingBuckets ? (
              <div>
                <textarea
                  value={bucketText}
                  onChange={(e) => setBucketText(e.target.value)}
                  rows={metric.ranges.length + 1}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white resize-none"
                  placeholder="One bucket per line"
                />
                <button
                  onClick={saveBuckets}
                  className="mt-1 text-xs px-3 py-1 rounded-lg text-white"
                  style={{ background: '#C97A2F' }}
                >
                  Save buckets
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {metric.ranges.map((r, i) => (
                  <span
                    key={i}
                    className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full"
                  >
                    {r}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function MetricsPage({ policyId, policyText, gemeenteCode, onDone }) {
  const [metrics, setMetrics] = useState([])
  const [selected, setSelected] = useState(new Set())
  const [loading, setLoading] = useState(false)
  const [suggesting, setSuggesting] = useState(false)
  const [error, setError] = useState('')

  async function handleSuggest() {
    setSuggesting(true)
    setError('')
    try {
      const suggestions = await api.suggestMetrics(policyText)
      setMetrics(suggestions)
      setSelected(new Set(suggestions.map((_, i) => i)))
    } catch (err) {
      setError(err.message)
    } finally {
      setSuggesting(false)
    }
  }

  function toggleMetric(i) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  function updateBuckets(i, buckets) {
    setMetrics((prev) => prev.map((m, j) => (j === i ? { ...m, ranges: buckets } : m)))
  }

  async function handleCreate() {
    const chosen = metrics.filter((_, i) => selected.has(i))
    if (chosen.length === 0) {
      setError('Select at least one metric')
      return
    }
    setLoading(true)
    setError('')
    try {
      const metricsPayload = chosen.map((m) => ({
        metric_id: slugify(m.name),
        description: `${m.name} — ${m.desc}`,
        buckets: m.ranges,
      }))
      const sim = await api.createSimulation(policyId, metricsPayload)
      onDone(sim.id)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Outcome Metrics</h1>
          <p className="text-gray-600 mt-1">
            Define what to measure. Claude will suggest relevant metrics based on your policy.
          </p>
        </div>
        <button
          onClick={handleSuggest}
          disabled={suggesting || !policyText}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-white disabled:opacity-50"
          style={{ background: '#C97A2F' }}
        >
          {suggesting ? (
            <>
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Suggesting…
            </>
          ) : (
            '✦ Suggest Metrics'
          )}
        </button>
      </div>

      {error && (
        <p className="mb-4 text-sm text-red-600 bg-red-50 rounded-lg px-4 py-2">{error}</p>
      )}

      {metrics.length === 0 && !suggesting && (
        <div className="bg-white/40 rounded-2xl p-10 text-center text-gray-500">
          <p className="text-lg mb-2">No metrics yet</p>
          <p className="text-sm">Click "Suggest Metrics" to generate policy-specific metrics via Claude</p>
        </div>
      )}

      {metrics.length > 0 && (
        <>
          <div className="space-y-3 mb-6">
            {metrics.map((m, i) => (
              <MetricCard
                key={i}
                metric={m}
                selected={selected.has(i)}
                onToggle={() => toggleMetric(i)}
                onBucketsChange={(buckets) => updateBuckets(i, buckets)}
              />
            ))}
          </div>

          <div className="flex items-center justify-between bg-white/60 rounded-2xl px-6 py-4 shadow-sm">
            <p className="text-sm text-gray-600">
              <span className="font-semibold">{selected.size}</span> of {metrics.length} metrics selected
              <span className="text-gray-400 ml-1">
                → {selected.size * 2} markets (passes + fails × each metric)
              </span>
            </p>
            <button
              onClick={handleCreate}
              disabled={loading || selected.size === 0}
              className="px-6 py-2.5 rounded-xl font-medium text-white disabled:opacity-50"
              style={{ background: '#C97A2F' }}
            >
              {loading ? 'Creating…' : 'Create Simulation →'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
