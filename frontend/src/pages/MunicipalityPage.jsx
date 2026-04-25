import { useState } from 'react'
import { api } from '../api'

export default function MunicipalityPage({ initialCode, onDone }) {
  const [code, setCode] = useState(initialCode || '')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    const trimmed = code.trim().toUpperCase()
    if (!trimmed.match(/^GM\d{4}$/)) {
      setError('Gemeente code must be in the format GM0363')
      return
    }
    setError('')
    setLoading(true)
    try {
      onDone(trimmed)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold mb-2">Select Municipality</h1>
      <p className="text-gray-600 mb-6">
        Enter a CBS gemeente code to load demographic data and generate synthetic citizen personas.
      </p>

      <form onSubmit={handleSubmit} className="bg-white/60 rounded-2xl p-6 shadow-sm">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Gemeente Code
        </label>
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="GM0363"
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 bg-white"
          style={{ focusRingColor: '#C97A2F' }}
        />
        <p className="text-xs text-gray-400 mt-1">
          Examples: GM0363 (Amsterdam), GM0518 (Den Haag), GM0599 (Rotterdam)
        </p>

        {error && (
          <p className="mt-3 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading || !code.trim()}
          className="mt-4 w-full py-3 rounded-xl font-medium text-white transition-opacity disabled:opacity-50"
          style={{ background: '#C97A2F' }}
        >
          {loading ? 'Loading…' : 'Continue →'}
        </button>
      </form>

      <div className="mt-6 bg-white/40 rounded-xl p-4 text-sm text-gray-600">
        <p className="font-medium mb-1">How it works</p>
        <ol className="space-y-1 list-decimal list-inside">
          <li>CBS demographic data is fetched for the municipality</li>
          <li>50 synthetic citizen personas are generated via Claude</li>
          <li>You define a policy and choose outcome metrics</li>
          <li>Personas bet on LMSR prediction markets to reveal probable outcomes</li>
        </ol>
      </div>
    </div>
  )
}
