import { useState, useEffect } from 'react'
import MunicipalityPage from './pages/MunicipalityPage'
import PersonasPage from './pages/PersonasPage'
import PolicyPage from './pages/PolicyPage'
import MetricsPage from './pages/MetricsPage'
import ResultsPage from './pages/ResultsPage'

const STEPS = ['Municipality', 'Personas', 'Policy', 'Metrics', 'Results']

function load(key) {
  const v = localStorage.getItem(key)
  return v ? JSON.parse(v) : null
}
function save(key, val) {
  if (val != null) localStorage.setItem(key, JSON.stringify(val))
}

export default function App() {
  const [step, setStep] = useState(0)
  const [gemeenteCode, setGemeenteCode] = useState(() => load('gemeenteCode') || '')
  const [policyId, setPolicyId] = useState(() => load('policyId') || null)
  const [policyText, setPolicyText] = useState(() => load('policyText') || '')
  const [simulationId, setSimulationId] = useState(() => load('simulationId') || null)

  useEffect(() => save('gemeenteCode', gemeenteCode), [gemeenteCode])
  useEffect(() => save('policyId', policyId), [policyId])
  useEffect(() => save('policyText', policyText), [policyText])
  useEffect(() => save('simulationId', simulationId), [simulationId])

  const canAccess = (i) => {
    if (i === 0) return true
    if (i === 1) return !!gemeenteCode
    if (i === 2) return !!gemeenteCode
    if (i === 3) return !!policyId
    if (i === 4) return !!simulationId
    return false
  }

  const pages = [
    <MunicipalityPage
      initialCode={gemeenteCode}
      onDone={(code) => { setGemeenteCode(code); setStep(1) }}
    />,
    <PersonasPage
      gemeenteCode={gemeenteCode}
      onNext={() => setStep(2)}
    />,
    <PolicyPage
      gemeenteCode={gemeenteCode}
      onDone={(id, text) => { setPolicyId(id); setPolicyText(text); setStep(3) }}
    />,
    <MetricsPage
      policyId={policyId}
      policyText={policyText}
      gemeenteCode={gemeenteCode}
      onDone={(id) => { setSimulationId(id); setStep(4) }}
    />,
    <ResultsPage simulationId={simulationId} />,
  ]

  return (
    <div className="min-h-screen" style={{ background: '#F2EBE0' }}>
      <header className="border-b border-amber-200/60 bg-white/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-4">
          <div>
            <span className="text-xl font-bold tracking-tight" style={{ color: '#C97A2F' }}>
              PolicyLab
            </span>
            <span className="ml-2 text-xs text-gray-400 uppercase tracking-widest">
              Municipal Simulation
            </span>
          </div>
          {gemeenteCode && (
            <span className="ml-auto text-sm text-gray-500 bg-white/70 px-3 py-1 rounded-full">
              {gemeenteCode}
            </span>
          )}
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 pt-6 pb-16">
        {/* Step navigation */}
        <div className="flex gap-2 mb-8 flex-wrap">
          {STEPS.map((s, i) => (
            <button
              key={s}
              disabled={!canAccess(i)}
              onClick={() => canAccess(i) && setStep(i)}
              className="px-4 py-2 rounded-full text-sm font-medium transition-all"
              style={
                i === step
                  ? { background: '#C97A2F', color: 'white' }
                  : canAccess(i)
                  ? { background: 'white', color: '#1a1a1a', opacity: 0.8 }
                  : { background: 'white', color: '#999', opacity: 0.4, cursor: 'not-allowed' }
              }
            >
              {i + 1}. {s}
            </button>
          ))}
        </div>

        {pages[step]}
      </div>
    </div>
  )
}
