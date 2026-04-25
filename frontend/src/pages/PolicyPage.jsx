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
      onDone(policy.id, description.trim())
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-2">Define Policy</h1>
      <p className="text-gray-600 mb-6">
        Describe the policy you want to stress-test against citizen personas.
      </p>

      <form onSubmit={handleSubmit} className="bg-white/60 rounded-2xl p-6 shadow-sm space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Policy Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Affordable Housing Initiative 2025"
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none bg-white"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Policy Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the policy in detail — what it does, who it affects, how it will be implemented, and what outcomes you hope to achieve..."
            rows={8}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none bg-white resize-none"
          />
          <p className="text-xs text-gray-400 mt-1">
            The more detail you provide, the better the metric suggestions and persona responses will be.
          </p>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading || !title.trim() || !description.trim()}
          className="w-full py-3 rounded-xl font-medium text-white transition-opacity disabled:opacity-50"
          style={{ background: '#C97A2F' }}
        >
          {loading ? 'Creating Policy…' : 'Create Policy →'}
        </button>
      </form>
    </div>
  )
}
