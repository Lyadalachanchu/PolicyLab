import { useState, useEffect } from 'react'
import { api } from '../api'

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
}

const TAG_COLORS = {
  Access: '#0D132D', Equity: '#293340', Finance: '#C97A2F',
  Performance: '#389800', Demand: '#151A30', Employment: '#0B1B33',
  Housing: '#8A8A8A', Health: '#B50000',
}

function MetricCard({ metric, selected, onToggle, onBucketsChange }) {
  const [editingBuckets, setEditingBuckets] = useState(false)
  const [bucketText, setBucketText] = useState(metric.ranges.join('\n'))

  function saveBuckets() {
    const buckets = bucketText.split('\n').map((b) => b.trim()).filter(Boolean)
    if (buckets.length >= 2) { onBucketsChange(buckets); setEditingBuckets(false) }
  }

  return (
    <div style={{ border: `1px solid ${selected ? '#0D132D' : '#D9DEE8'}`, borderLeft: selected ? '3px solid #0D132D' : '3px solid transparent' }}>
      <div className="p-5">
        <div className="flex items-start gap-4">
          <input type="checkbox" checked={selected} onChange={onToggle}
            className="mt-1 w-4 h-4 shrink-0 cursor-pointer" />
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-xs font-semibold uppercase px-2 py-0.5 text-white"
                style={{ background: TAG_COLORS[metric.tag] || '#293340', letterSpacing: '0.06em' }}>
                {metric.tag}
              </span>
              <span className="text-xs text-gray-400">{metric.unit}</span>
            </div>
            <h3 className="font-semibold text-gray-900 mb-1">{metric.name}</h3>
            <p className="text-sm text-gray-500">{metric.desc}</p>
            {metric.affected_groups && metric.affected_groups.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                <span className="text-xs text-gray-400 self-center">Affects:</span>
                {metric.affected_groups.map((g, i) => (
                  <span key={i} className="text-xs px-2 py-0.5"
                    style={{ border: '1px solid #D9DEE8', color: '#293340', background: '#FAFAFA' }}>
                    {g}
                  </span>
                ))}
              </div>
            )}

            <div className="mt-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase text-gray-400" style={{ letterSpacing: '0.08em' }}>Buckets</span>
                {selected && (
                  <button onClick={() => setEditingBuckets(!editingBuckets)}
                    className="text-xs font-semibold uppercase text-gray-400 hover:text-gray-700"
                    style={{ letterSpacing: '0.06em' }}>
                    {editingBuckets ? 'Done' : 'Edit'}
                  </button>
                )}
              </div>

              {editingBuckets ? (
                <div>
                  <textarea value={bucketText} onChange={(e) => setBucketText(e.target.value)}
                    rows={metric.ranges.length + 1}
                    className="w-full text-sm border border-gray-300 px-3 py-2 resize-none focus:outline-none focus:border-gray-900"
                    placeholder="One bucket per line" />
                  <button onClick={saveBuckets}
                    className="mt-1 text-xs font-semibold uppercase px-3 py-1.5 text-white"
                    style={{ background: '#0D132D', letterSpacing: '0.06em' }}>
                    Save
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {metric.ranges.map((r, i) => (
                    <span key={i} className="text-xs px-2 py-0.5"
                      style={{ background: '#F3F3F3', color: '#293340' }}>{r}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function MetricsPage({ policyId, policyText, gemeenteCode, onDone }) {
  const [metrics, setMetrics] = useState(() => {
    try { return JSON.parse(localStorage.getItem('metrics') || '[]') } catch { return [] }
  })
  const [selected, setSelected] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('metricsSelected') || 'null')
      return saved ? new Set(saved) : new Set()
    } catch { return new Set() }
  })
  const [loading, setLoading] = useState(false)
  const [suggesting, setSuggesting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { localStorage.setItem('metrics', JSON.stringify(metrics)) }, [metrics])
  useEffect(() => { localStorage.setItem('metricsSelected', JSON.stringify([...selected])) }, [selected])

  async function handleSuggest() {
    setSuggesting(true); setError('')
    try {
      const suggestions = await api.suggestMetrics(policyText)
      setMetrics(suggestions)
      setSelected(new Set(suggestions.map((_, i) => i)))
    } catch (err) { setError(err.message) }
    finally { setSuggesting(false) }
  }

  function toggleMetric(i) {
    setSelected((prev) => { const next = new Set(prev); next.has(i) ? next.delete(i) : next.add(i); return next })
  }

  function updateBuckets(i, buckets) {
    setMetrics((prev) => prev.map((m, j) => j === i ? { ...m, ranges: buckets } : m))
  }

  async function handleCreate() {
    const chosen = metrics.filter((_, i) => selected.has(i))
    if (chosen.length === 0) { setError('Select at least one metric'); return }
    setLoading(true); setError('')
    try {
      const metricsPayload = chosen.map((m) => ({
        metric_id: slugify(m.name),
        description: `${m.name} — ${m.desc}`,
        buckets: m.ranges,
      }))
      const sim = await api.createSimulation(policyId, metricsPayload)
      onDone(sim.id)
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-10" style={{ borderBottom: '1px solid #D9DEE8', paddingBottom: '2rem' }}>
        <div>
          <p className="text-xs uppercase tracking-widest text-gray-400 mb-2" style={{ letterSpacing: '0.12em' }}>Step 4 of 6</p>
          <h1 className="text-4xl mb-2" style={{ fontFamily: 'Instrument Serif, Georgia, serif' }}>Outcome Metrics</h1>
          <p className="text-gray-500 text-lg">Define what to measure. Claude suggests metrics from your policy text.</p>
        </div>
        <button onClick={handleSuggest} disabled={suggesting || !policyText}
          className="flex items-center gap-2 px-6 py-3 text-xs font-semibold uppercase text-white disabled:opacity-40 shrink-0"
          style={{ background: '#0D132D', letterSpacing: '0.08em' }}>
          {suggesting ? (
            <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Suggesting…</>
          ) : '✦ Suggest Metrics'}
        </button>
      </div>

      {error && (
        <div className="border-l-4 border-red-600 bg-red-50 px-4 py-3 mb-6">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {metrics.length === 0 && !suggesting && (
        <div className="py-16 text-center" style={{ border: '1px solid #D9DEE8' }}>
          <p className="text-gray-400 text-sm uppercase tracking-widest" style={{ letterSpacing: '0.1em' }}>No metrics yet</p>
          <p className="text-gray-400 text-sm mt-2">Click "Suggest Metrics" to generate policy-specific metrics via Claude</p>
        </div>
      )}

      {metrics.length > 0 && (
        <>
          <div className="space-y-3 mb-8">
            {metrics.map((m, i) => (
              <MetricCard key={i} metric={m} selected={selected.has(i)}
                onToggle={() => toggleMetric(i)}
                onBucketsChange={(buckets) => updateBuckets(i, buckets)} />
            ))}
          </div>

          <div className="flex items-center justify-between p-5" style={{ border: '1px solid #D9DEE8', background: '#F3F3F3' }}>
            <p className="text-sm text-gray-600">
              <span className="font-semibold">{selected.size}</span> of {metrics.length} metrics selected
              <span className="text-gray-400 ml-2">→ {selected.size * 2} markets</span>
            </p>
            <button onClick={handleCreate} disabled={loading || selected.size === 0}
              className="px-8 py-3 text-xs font-semibold uppercase text-white disabled:opacity-40"
              style={{ background: '#0D132D', letterSpacing: '0.08em' }}>
              {loading ? 'Creating…' : 'Create Simulation'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
