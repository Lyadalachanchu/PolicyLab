import { useState, useEffect, useCallback } from 'react'
import { api } from '../api'
import PersonaCard from '../components/PersonaCard'
import CoverageGrid from '../components/CoverageGrid'
import AddPersonaForm from '../components/AddPersonaForm'

export default function PersonasPage({ gemeenteCode }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [generating, setGenerating] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [expandedId, setExpandedId] = useState(null)
  const [n, setN] = useState(50)

  const fetchPersonas = useCallback(async () => {
    try { const res = await api.getPersonas(gemeenteCode); setData(res); return res }
    catch { return null }
  }, [gemeenteCode])

  useEffect(() => { if (gemeenteCode) fetchPersonas() }, [gemeenteCode, fetchPersonas])

  useEffect(() => {
    if (!data) return
    if (data.generation_status !== 'pending' && data.generation_status !== 'running') return
    const id = setInterval(async () => {
      const res = await fetchPersonas()
      if (res && res.generation_status === 'complete') clearInterval(id)
    }, 3000)
    return () => clearInterval(id)
  }, [data, fetchPersonas])

  async function handleGenerate() {
    setGenerating(true); setError('')
    try { await api.generatePersonas(gemeenteCode, n); await fetchPersonas() }
    catch (err) { setError(err.message) }
    finally { setGenerating(false) }
  }

  const status = data?.generation_status
  const isRunning = status === 'pending' || status === 'running'
  const isDone = status === 'complete'
  const personas = data?.personas || []

  return (
    <div>
      {/* Page header */}
      <div className="flex items-start justify-between mb-10" style={{ borderBottom: '1px solid #D9DEE8', paddingBottom: '2rem' }}>
        <div>
          <p className="text-xs uppercase tracking-widest text-gray-400 mb-2" style={{ letterSpacing: '0.12em' }}>Step 2 of 6</p>
          <h1 className="text-4xl mb-2" style={{ fontFamily: 'Instrument Serif, Georgia, serif' }}>Citizen Personas</h1>
          <p className="text-gray-500 text-lg">CBS-anchored synthetic residents for {gemeenteCode}</p>
        </div>
        {isDone && (
          <span className="text-xs uppercase tracking-widest text-green-600 font-semibold" style={{ letterSpacing: '0.1em' }}>
            ✓ Complete — scroll to continue
          </span>
        )}
      </div>

      {/* Generation status */}
      {!isDone && (
        <div style={{ border: '1px solid #D9DEE8' }} className="p-6 mb-8">
          {isRunning ? (
            <div className="flex items-center gap-4">
              <div className="w-5 h-5 border-2 border-gray-800 border-t-transparent rounded-full animate-spin shrink-0" />
              <div>
                <p className="font-semibold">Generating personas…</p>
                <p className="text-sm text-gray-500 mt-0.5">
                  {status === 'pending' ? 'Queued — fetching CBS demographic data' : 'Generating narratives via Claude'}
                </p>
              </div>
            </div>
          ) : (
            <div>
              <p className="font-semibold mb-1">No personas generated yet</p>
              <p className="text-sm text-gray-500 mb-5">Generate CBS-anchored personas for {gemeenteCode} before running a simulation.</p>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-semibold uppercase text-gray-500" style={{ letterSpacing: '0.08em' }}>Count</label>
                  <input type="number" value={n} min={1} max={500} onChange={(e) => setN(Number(e.target.value))}
                    className="w-20 border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:border-gray-900" />
                </div>
                <button onClick={handleGenerate} disabled={generating}
                  className="px-6 py-2 text-xs font-semibold uppercase text-white disabled:opacity-40"
                  style={{ background: '#0D132D', letterSpacing: '0.08em' }}>
                  {generating ? 'Starting…' : 'Generate Personas'}
                </button>
              </div>
              {error && (
                <div className="border-l-4 border-red-600 bg-red-50 px-4 py-3 mt-4">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Coverage */}
      {data?.coverage && Object.keys(data.coverage).length > 0 && (
        <section className="mb-10">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-5" style={{ letterSpacing: '0.1em' }}>
            Demographic Coverage
          </h2>
          <CoverageGrid coverage={data.coverage} />
        </section>
      )}

      {/* Personas list */}
      {personas.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400" style={{ letterSpacing: '0.1em' }}>
              {personas.length} Persona{personas.length !== 1 ? 's' : ''}
            </h2>
            <button onClick={() => setShowAddForm(!showAddForm)}
              className="text-xs font-semibold uppercase px-4 py-2"
              style={{ border: '1px solid #D9DEE8', color: '#293340', letterSpacing: '0.08em' }}>
              + Add Manual Persona
            </button>
          </div>

          {showAddForm && (
            <div className="mt-4 mb-4">
              <AddPersonaForm gemeenteCode={gemeenteCode}
                onDone={async () => { setShowAddForm(false); await fetchPersonas() }}
                onCancel={() => setShowAddForm(false)} />
            </div>
          )}

          <div style={{ borderTop: '1px solid #D9DEE8' }}>
            {personas.map((p) => (
              <PersonaCard key={p.id} persona={p}
                expanded={expandedId === p.id}
                onToggle={() => setExpandedId(expandedId === p.id ? null : p.id)} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
