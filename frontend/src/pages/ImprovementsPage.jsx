import { useState } from 'react'
import { api } from '../api'

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
}

function loadSavedMetrics() {
  try {
    const metrics = JSON.parse(localStorage.getItem('metrics') || '[]')
    const selected = new Set(JSON.parse(localStorage.getItem('metricsSelected') || '[]'))
    return metrics.filter((_, i) => selected.has(i)).map((m) => ({
      metric_id: slugify(m.name),
      description: `${m.name} — ${m.desc}`,
      buckets: m.ranges,
    }))
  } catch { return [] }
}

function DiffHunk({ hunk, index }) {
  const originalLines = hunk.original.split('\n')
  const revisedLines = hunk.revised.split('\n')

  return (
    <div style={{ border: '1px solid #D9DEE8' }}>
      <div className="flex items-center justify-between px-4 py-2" style={{ background: '#F3F3F3', borderBottom: '1px solid #D9DEE8' }}>
        <span className="text-xs font-semibold uppercase text-gray-500" style={{ letterSpacing: '0.08em', fontFamily: 'Instrument Sans, sans-serif' }}>
          Change {index + 1}
        </span>
        <span className="text-xs text-gray-400">{hunk.reason}</span>
      </div>
      <div className="font-mono text-sm">
        {originalLines.map((line, i) => (
          <div key={`-${i}`} className="flex" style={{ background: '#FFF5F5' }}>
            <span className="w-8 text-center text-red-400 select-none py-1.5 shrink-0" style={{ borderRight: '1px solid #FECACA' }}>−</span>
            <span className="text-red-800 px-4 py-1.5 whitespace-pre-wrap break-words flex-1">{line}</span>
          </div>
        ))}
        {revisedLines.map((line, i) => (
          <div key={`+${i}`} className="flex" style={{ background: '#F0FFF4' }}>
            <span className="w-8 text-center text-green-500 select-none py-1.5 shrink-0" style={{ borderRight: '1px solid #BBF7D0' }}>+</span>
            <span className="text-green-900 px-4 py-1.5 whitespace-pre-wrap break-words flex-1">{line}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function FindingCard({ finding }) {
  return (
    <div className="p-5" style={{ border: '1px solid #D9DEE8', borderLeft: '3px solid #B50000' }}>
      <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1" style={{ letterSpacing: '0.08em' }}>Adverse Finding</p>
      <p className="font-semibold text-gray-900 mb-1">{finding.metric}</p>
      <p className="text-sm text-gray-500 mb-1">
        Predicted: <span className="font-medium text-gray-700">{finding.consensus_outcome}</span>
      </p>
      <p className="text-sm text-gray-600 mt-2">{finding.citizen_concern}</p>
      <p className="text-sm text-gray-400 mt-2 italic">→ {finding.suggested_change}</p>
    </div>
  )
}

function applyHunks(text, hunks) {
  let result = text
  for (const hunk of hunks) result = result.replace(hunk.original, hunk.revised)
  return result
}

export default function ImprovementsPage({ simulationId, policyText, policyTitle, gemeenteCode, onAccepted }) {
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [accepting, setAccepting] = useState(false)
  const [error, setError] = useState('')
  const [accepted, setAccepted] = useState(false)

  async function handleGenerate() {
    setLoading(true); setError('')
    try { setResult(await api.getImprovements(simulationId)) }
    catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  async function handleAccept() {
    if (!result) return
    setAccepting(true); setError('')
    try {
      const revisedText = applyHunks(policyText, result.policy_hunks)
      const policy = await api.createPolicy({
        gemeente_code: gemeenteCode,
        title: `${policyTitle} (revised)`,
        description: revisedText,
      })
      const savedMetrics = loadSavedMetrics()
      if (savedMetrics.length === 0) throw new Error('No saved metrics — go to Metrics tab to reconfigure.')
      const sim = await api.createSimulation(policy.id, savedMetrics)
      setAccepted(true)
      onAccepted(policy.id, revisedText, sim.id)
    } catch (err) { setError(err.message) }
    finally { setAccepting(false) }
  }

  if (!simulationId) return (
    <div className="py-20 text-center">
      <p className="text-sm uppercase tracking-widest text-gray-400" style={{ letterSpacing: '0.1em' }}>
        Run a simulation first to generate improvement suggestions.
      </p>
    </div>
  )

  return (
    <div>
      <div className="flex items-start justify-between mb-10" style={{ borderBottom: '1px solid #D9DEE8', paddingBottom: '2rem' }}>
        <div>
          <p className="text-xs uppercase tracking-widest text-gray-400 mb-2" style={{ letterSpacing: '0.12em' }}>Step 6 of 6</p>
          <h1 className="text-4xl mb-2" style={{ fontFamily: 'Instrument Serif, Georgia, serif' }}>Policy Improvements</h1>
          <p className="text-gray-500 text-lg">Claude reviews adverse outcomes and suggests targeted changes to the policy text.</p>
        </div>
        {!result && (
          <button onClick={handleGenerate} disabled={loading}
            className="flex items-center gap-2 px-6 py-3 text-xs font-semibold uppercase text-white disabled:opacity-40 shrink-0"
            style={{ background: '#0D132D', letterSpacing: '0.08em' }}>
            {loading ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Analysing…</> : '✦ Suggest Improvements'}
          </button>
        )}
      </div>

      {error && (
        <div className="border-l-4 border-red-600 bg-red-50 px-4 py-3 mb-6">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {result && (
        <>
          {result.adverse_findings.length > 0 && (
            <section className="mb-10">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-4" style={{ letterSpacing: '0.1em' }}>
                {result.adverse_findings.length} Adverse Finding{result.adverse_findings.length !== 1 ? 's' : ''}
              </h2>
              <div className="space-y-3">
                {result.adverse_findings.map((f, i) => <FindingCard key={i} finding={f} />)}
              </div>
            </section>
          )}

          {result.policy_hunks.length > 0 ? (
            <section className="mb-6">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-4" style={{ letterSpacing: '0.1em' }}>
                {result.policy_hunks.length} Suggested Change{result.policy_hunks.length !== 1 ? 's' : ''}
              </h2>
              <div className="space-y-3">
                {result.policy_hunks.map((hunk, i) => <DiffHunk key={i} hunk={hunk} index={i} />)}
              </div>
            </section>
          ) : (
            <div className="border-l-4 border-green-500 bg-green-50 px-4 py-3 mb-6">
              <p className="text-sm text-green-800">No specific text changes required — findings are informational.</p>
            </div>
          )}

          {result.policy_hunks.length > 0 && !accepted && (
            <div className="sticky bottom-6">
              <div className="flex items-center justify-between p-5" style={{ border: '1px solid #D9DEE8', background: 'white' }}>
                <div>
                  <p className="font-semibold text-gray-900">{result.policy_hunks.length} change{result.policy_hunks.length !== 1 ? 's' : ''} ready to apply</p>
                  <p className="text-sm text-gray-500">Creates a revised policy and returns to Results to re-run the simulation.</p>
                </div>
                <button onClick={handleAccept} disabled={accepting}
                  className="px-8 py-3 text-xs font-semibold uppercase text-white disabled:opacity-40 flex items-center gap-2 shrink-0 ml-6"
                  style={{ background: '#0D132D', letterSpacing: '0.08em' }}>
                  {accepting ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Applying…</> : '✓ Accept & Re-run'}
                </button>
              </div>
            </div>
          )}

          {accepted && (
            <div className="border-l-4 border-green-500 bg-green-50 px-4 py-3">
              <p className="text-sm text-green-800">✓ Revised policy created — redirecting to Results.</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
