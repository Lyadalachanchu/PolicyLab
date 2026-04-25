import { useState, useEffect, useCallback } from 'react'
import { api } from '../api'
import PersonaCard from '../components/PersonaCard'
import CoverageGrid from '../components/CoverageGrid'
import AddPersonaForm from '../components/AddPersonaForm'

export default function PersonasPage({ gemeenteCode, onNext }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [generating, setGenerating] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [expandedId, setExpandedId] = useState(null)
  const [n, setN] = useState(50)

  const fetchPersonas = useCallback(async () => {
    try {
      const res = await api.getPersonas(gemeenteCode)
      setData(res)
      return res
    } catch {
      // gemeente not yet created — that's fine
      return null
    }
  }, [gemeenteCode])

  useEffect(() => {
    if (!gemeenteCode) return
    fetchPersonas()
  }, [gemeenteCode, fetchPersonas])

  // Poll while generating
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
    setGenerating(true)
    setError('')
    try {
      await api.generatePersonas(gemeenteCode, n)
      await fetchPersonas()
    } catch (err) {
      setError(err.message)
    } finally {
      setGenerating(false)
    }
  }

  async function handlePersonaAdded() {
    setShowAddForm(false)
    await fetchPersonas()
  }

  const status = data?.generation_status
  const isRunning = status === 'pending' || status === 'running'
  const isDone = status === 'complete'
  const personas = data?.personas || []

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Citizen Personas</h1>
          <p className="text-gray-600 mt-1">
            CBS-anchored synthetic residents for {gemeenteCode}
          </p>
        </div>
        {isDone && (
          <button
            onClick={onNext}
            className="px-5 py-2 rounded-xl font-medium text-white"
            style={{ background: '#C97A2F' }}
          >
            Next: Create Policy →
          </button>
        )}
      </div>

      {/* Generation panel */}
      {!isDone && (
        <div className="bg-white/60 rounded-2xl p-6 shadow-sm mb-6">
          {isRunning ? (
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
              <div>
                <p className="font-medium">Generating personas…</p>
                <p className="text-sm text-gray-500">
                  {status === 'pending' ? 'Queued — fetching CBS data' : 'Generating narratives via Claude'}
                </p>
              </div>
            </div>
          ) : (
            <div>
              <p className="font-medium mb-4">No personas generated yet</p>
              <div className="flex items-center gap-4">
                <label className="text-sm text-gray-600">
                  Count:
                  <input
                    type="number"
                    value={n}
                    min={1}
                    max={500}
                    onChange={(e) => setN(Number(e.target.value))}
                    className="ml-2 w-20 border border-gray-200 rounded-lg px-2 py-1 text-sm"
                  />
                </label>
                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  className="px-5 py-2 rounded-xl font-medium text-white disabled:opacity-50"
                  style={{ background: '#C97A2F' }}
                >
                  {generating ? 'Starting…' : 'Generate Personas'}
                </button>
              </div>
              {error && (
                <p className="mt-3 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Coverage */}
      {data?.coverage && Object.keys(data.coverage).length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-3">Demographic Coverage</h2>
          <CoverageGrid coverage={data.coverage} />
        </div>
      )}

      {/* Personas list */}
      {personas.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">
              {personas.length} Persona{personas.length !== 1 ? 's' : ''}
            </h2>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="text-sm px-4 py-1.5 rounded-xl border font-medium"
              style={{ borderColor: '#C97A2F', color: '#C97A2F' }}
            >
              + Add Manual Persona
            </button>
          </div>

          {showAddForm && (
            <div className="mb-4">
              <AddPersonaForm
                gemeenteCode={gemeenteCode}
                onDone={handlePersonaAdded}
                onCancel={() => setShowAddForm(false)}
              />
            </div>
          )}

          <div className="space-y-2">
            {personas.map((p) => (
              <PersonaCard
                key={p.id}
                persona={p}
                expanded={expandedId === p.id}
                onToggle={() => setExpandedId(expandedId === p.id ? null : p.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
