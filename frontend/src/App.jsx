import { useState, useEffect } from 'react'
import MunicipalityPage from './pages/MunicipalityPage'
import PersonasPage from './pages/PersonasPage'
import PolicyPage from './pages/PolicyPage'
import MetricsPage from './pages/MetricsPage'
import ResultsPage from './pages/ResultsPage'
import ImprovementsPage from './pages/ImprovementsPage'

function load(key) {
  const v = localStorage.getItem(key)
  return v ? JSON.parse(v) : null
}
function save(key, val) {
  if (val != null) localStorage.setItem(key, JSON.stringify(val))
}

function AccordionSection({ index, label, accessible, complete, summary, open, onToggle, children }) {
  return (
    <div style={{ borderBottom: '1px solid #D9DEE8' }}>
      {/* Header */}
      <button
        onClick={() => accessible && onToggle()}
        disabled={!accessible}
        className="w-full flex items-center justify-between px-6 py-5 text-left transition-colors"
        style={{
          background: open ? '#FFFFFF' : accessible ? '#FAFAFA' : '#FAFAFA',
          cursor: accessible ? 'pointer' : 'not-allowed',
        }}
      >
        <div className="flex items-center gap-4">
          {/* Step number */}
          <span
            className="w-7 h-7 flex items-center justify-center text-xs font-semibold shrink-0"
            style={{
              background: complete ? '#389800' : open ? '#0D132D' : accessible ? '#D9DEE8' : '#F3F3F3',
              color: complete || open ? '#FFFFFF' : accessible ? '#293340' : '#8A8A8A',
            }}
          >
            {complete ? '✓' : index + 1}
          </span>

          <div>
            <span
              className="text-sm font-semibold uppercase tracking-widest"
              style={{
                letterSpacing: '0.1em',
                color: open ? '#0D132D' : accessible ? '#293340' : '#8A8A8A',
              }}
            >
              {label}
            </span>
            {!open && summary && (
              <p className="text-xs text-gray-400 mt-0.5 normal-case font-normal" style={{ letterSpacing: 0 }}>
                {summary}
              </p>
            )}
          </div>
        </div>

        {accessible && (
          <span className="text-gray-400 text-xs ml-4 shrink-0">
            {open ? '▲' : '▼'}
          </span>
        )}
      </button>

      {/* Content */}
      {open && (
        <div className="px-6 pb-10 pt-2">
          {children}
        </div>
      )}
    </div>
  )
}

export default function App() {
  const [gemeenteCode, setGemeenteCode] = useState(() => load('gemeenteCode') || '')
  const [policyId, setPolicyId] = useState(() => load('policyId') || null)
  const [policyTitle, setPolicyTitle] = useState(() => load('policyTitle') || '')
  const [policyText, setPolicyText] = useState(() => load('policyText') || '')
  const [simulationId, setSimulationId] = useState(() => load('simulationId') || null)

  // Which section is expanded — open the furthest completed + 1 by default
  const initialOpen = () => {
    if (!load('gemeenteCode')) return 0
    if (!load('policyId')) return 1
    if (!load('simulationId')) return 3
    return 4
  }
  const [openIndex, setOpenIndex] = useState(initialOpen)

  useEffect(() => save('gemeenteCode', gemeenteCode), [gemeenteCode])
  useEffect(() => save('policyId', policyId), [policyId])
  useEffect(() => save('policyTitle', policyTitle), [policyTitle])
  useEffect(() => save('policyText', policyText), [policyText])
  useEffect(() => save('simulationId', simulationId), [simulationId])

  function toggle(i) {
    setOpenIndex((prev) => (prev === i ? -1 : i))
  }

  function handleMunicipalityDone(code) {
    setGemeenteCode(code)
    setOpenIndex(1) // open Personas
  }

  function handlePolicyDone(id, title, text) {
    setPolicyId(id); setPolicyTitle(title); setPolicyText(text)
    setOpenIndex(3) // open Metrics
  }

  function handleSimulationDone(id) {
    setSimulationId(id)
    setOpenIndex(4) // open Results
  }

  function handleImprovementsAccepted(newPolicyId, newPolicyText, newSimulationId) {
    setPolicyId(newPolicyId)
    setPolicyText(newPolicyText)
    setPolicyTitle((t) => t.replace(' (revised)', '') + ' (revised)')
    setSimulationId(newSimulationId)
    setOpenIndex(4) // open Results
  }

  const accessible = [
    true,
    !!gemeenteCode,
    !!gemeenteCode,
    !!policyId,
    !!simulationId,
    !!simulationId,
  ]

  const summaries = [
    gemeenteCode || null,
    gemeenteCode ? `${load('personaCount') || ''} personas for ${gemeenteCode}`.trim() : null,
    policyTitle || null,
    policyId ? 'Metrics configured' : null,
    simulationId ? 'Simulation ready' : null,
    null,
  ]

  const sections = [
    {
      label: 'Municipality',
      complete: !!gemeenteCode,
      content: (
        <MunicipalityPage initialCode={gemeenteCode} onDone={handleMunicipalityDone} />
      ),
    },
    {
      label: 'Personas',
      complete: false,
      content: <PersonasPage gemeenteCode={gemeenteCode} />,
    },
    {
      label: 'Policy',
      complete: !!policyId,
      content: (
        <PolicyPage gemeenteCode={gemeenteCode} onDone={handlePolicyDone} />
      ),
    },
    {
      label: 'Metrics',
      complete: !!simulationId,
      content: (
        <MetricsPage
          policyId={policyId}
          policyText={policyText}
          gemeenteCode={gemeenteCode}
          onDone={handleSimulationDone}
        />
      ),
    },
    {
      label: 'Results',
      complete: false,
      content: (
        <ResultsPage
          simulationId={simulationId}
          onViewImprovements={() => setOpenIndex(5)}
        />
      ),
    },
    {
      label: 'Improve',
      complete: false,
      content: (
        <ImprovementsPage
          simulationId={simulationId}
          policyText={policyText}
          policyTitle={policyTitle}
          gemeenteCode={gemeenteCode}
          onAccepted={handleImprovementsAccepted}
        />
      ),
    },
  ]

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header style={{ background: 'linear-gradient(180deg, #0B1B33, #151A30)' }}>
        <div className="max-w-4xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-9 h-9 border border-white/30 flex items-center justify-center shrink-0">
              <span className="text-white text-base">⚖</span>
            </div>
            <div>
              <div className="text-white text-lg tracking-wide" style={{ fontFamily: 'Instrument Serif, Georgia, serif' }}>
                PolicyLab
              </div>
              <div className="text-white/40 text-xs uppercase tracking-widest" style={{ letterSpacing: '0.15em' }}>
                Municipal Policy Simulation
              </div>
            </div>
          </div>
          {gemeenteCode && (
            <div className="text-right">
              <div className="text-white/40 text-xs uppercase tracking-widest mb-0.5" style={{ letterSpacing: '0.12em' }}>Municipality</div>
              <div className="text-white font-semibold text-sm">{gemeenteCode}</div>
            </div>
          )}
        </div>
      </header>

      {/* Accordion */}
      <main className="max-w-4xl mx-auto" style={{ borderLeft: '1px solid #D9DEE8', borderRight: '1px solid #D9DEE8' }}>
        {sections.map((s, i) => (
          <AccordionSection
            key={i}
            index={i}
            label={s.label}
            accessible={accessible[i]}
            complete={s.complete}
            summary={summaries[i]}
            open={openIndex === i}
            onToggle={() => toggle(i)}
          >
            {s.content}
          </AccordionSection>
        ))}
      </main>
    </div>
  )
}
