import { useState } from 'react'

export default function MunicipalityPage({ initialCode, onDone }) {
  const [code, setCode] = useState(initialCode || '')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function handleSubmit(e) {
    e.preventDefault()
    const trimmed = code.trim().toUpperCase()
    if (!trimmed.match(/^GM\d{4}$/)) {
      setError('Gemeente code must be in the format GM0363')
      return
    }
    setError('')
    setLoading(true)
    onDone(trimmed)
  }

  return (
    <div className="max-w-2xl">
      <p className="text-xs uppercase tracking-widest text-gray-400 mb-3" style={{ letterSpacing: '0.12em' }}>
        Step 1 of 6
      </p>
      <h1 className="text-4xl mb-2" style={{ fontFamily: 'Instrument Serif, Georgia, serif' }}>
        Select Municipality
      </h1>
      <p className="text-gray-500 mb-10 text-lg">
        Enter a CBS gemeente code to load demographic data and generate synthetic citizen personas.
      </p>

      <form onSubmit={handleSubmit}>
        <div className="mb-6">
          <label className="block text-xs font-semibold uppercase tracking-widest text-gray-500 mb-2" style={{ letterSpacing: '0.1em' }}>
            Gemeente Code
          </label>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="GM0363"
            className="w-full border border-gray-300 px-4 py-3 text-base focus:outline-none focus:border-gray-900 transition-colors"
            style={{ fontFamily: 'Instrument Sans, sans-serif' }}
          />
          <p className="text-xs text-gray-400 mt-2">
            Examples: GM0363 (Amsterdam) · GM0518 (Den Haag) · GM0599 (Rotterdam)
          </p>
        </div>

        {error && (
          <div className="border-l-4 border-red-600 bg-red-50 px-4 py-3 mb-6">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !code.trim()}
          className="px-8 py-3 text-sm font-semibold uppercase text-white disabled:opacity-40 transition-opacity"
          style={{ background: '#0D132D', letterSpacing: '0.08em' }}
        >
          {loading ? 'Loading…' : 'Continue'}
        </button>
      </form>

      <div style={{ borderTop: '1px solid #D9DEE8', marginTop: '3rem', paddingTop: '2rem' }}>
        <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400 mb-4" style={{ letterSpacing: '0.1em' }}>How It Works</h2>
        <ol className="space-y-3">
          {[
            'CBS demographic data is fetched for the selected municipality',
            '50 synthetic citizen personas are generated via Claude AI',
            'You define a policy and choose measurable outcome metrics',
            'Personas bet on LMSR prediction markets to surface probable outcomes',
          ].map((step, i) => (
            <li key={i} className="flex gap-4 text-sm text-gray-600">
              <span className="w-6 h-6 shrink-0 flex items-center justify-center text-xs font-semibold text-white mt-0.5" style={{ background: '#293340' }}>
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
