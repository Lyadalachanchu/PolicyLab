import { useState } from 'react'
import { api } from '../api'

export default function PolicyPage({ gemeenteCode, onDone }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!title.trim() || !description.trim()) {
      setError('Both title and description are required')
      return
    }
    setError('')
    setLoading(true)
    try {
      const policy = await api.createPolicy({
        gemeente_code: gemeenteCode,
        title: title.trim(),
        description: description.trim(),
      })
      onDone(policy.id, title.trim(), description.trim())
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl">
      <p className="text-xs uppercase tracking-widest text-gray-400 mb-3" style={{ letterSpacing: '0.12em' }}>Step 3 of 6</p>
      <h1 className="text-4xl mb-2" style={{ fontFamily: 'Instrument Serif, Georgia, serif' }}>Define Policy</h1>
      <p className="text-gray-500 mb-10 text-lg">
        Describe the policy you want to stress-test against citizen personas.
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-widest text-gray-500 mb-2" style={{ letterSpacing: '0.1em' }}>
            Policy Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Affordable Housing Initiative 2025"
            className="w-full border border-gray-300 px-4 py-3 text-base focus:outline-none focus:border-gray-900 transition-colors"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-widest text-gray-500 mb-2" style={{ letterSpacing: '0.1em' }}>
            Policy Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the policy in detail — what it does, who it affects, how it will be implemented, and what outcomes you hope to achieve…"
            rows={9}
            className="w-full border border-gray-300 px-4 py-3 text-base focus:outline-none focus:border-gray-900 transition-colors resize-none"
          />
          <p className="text-xs text-gray-400 mt-1">
            The more detail you provide, the more accurate the metric suggestions and persona responses will be.
          </p>
        </div>

        {error && (
          <div className="border-l-4 border-red-600 bg-red-50 px-4 py-3">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !title.trim() || !description.trim()}
          className="px-8 py-3 text-sm font-semibold uppercase text-white disabled:opacity-40"
          style={{ background: '#0D132D', letterSpacing: '0.08em' }}
        >
          {loading ? 'Creating…' : 'Create Policy'}
        </button>
      </form>
    </div>
  )
}
