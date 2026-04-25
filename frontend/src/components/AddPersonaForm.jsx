import { useState } from 'react'
import { api } from '../api'

const FIELDS = {
  age_band: ['0-17', '18-24', '25-34', '35-44', '45-54', '55-64', '65+'],
  gender: ['male', 'female', 'non-binary'],
  income_quartile: ['Q1', 'Q2', 'Q3', 'Q4'],
  employment_status: ['employed', 'self_employed', 'unemployed', 'student', 'retired', 'other_inactive'],
  migration_background: ['dutch', 'western', 'non_western'],
  housing_type: ['owner', 'social_rent', 'private_rent'],
}

export default function AddPersonaForm({ gemeenteCode, onDone, onCancel }) {
  const [form, setForm] = useState({
    age_band: '25-34',
    gender: 'male',
    income_quartile: 'Q2',
    employment_status: 'employed',
    migration_background: 'dutch',
    housing_type: 'owner',
    narrative: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (form.narrative.trim().length < 10) {
      setError('Narrative must be at least 10 characters')
      return
    }
    setError('')
    setLoading(true)
    try {
      await api.addPersona(gemeenteCode, form)
      onDone()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white/70 rounded-2xl p-5 shadow-sm space-y-4">
      <h3 className="font-semibold">Add Manual Persona</h3>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Object.entries(FIELDS).map(([field, options]) => (
          <div key={field}>
            <label className="block text-xs font-medium text-gray-600 mb-1 capitalize">
              {field.replace('_', ' ')}
            </label>
            <select
              value={form[field]}
              onChange={(e) => set(field, e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white"
            >
              {options.map((o) => (
                <option key={o} value={o}>{o.replace('_', ' ')}</option>
              ))}
            </select>
          </div>
        ))}
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Persona Narrative
        </label>
        <textarea
          value={form.narrative}
          onChange={(e) => set('narrative', e.target.value)}
          rows={4}
          placeholder="Describe this person's situation, values, concerns, and how they relate to local policy…"
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-white resize-none"
        />
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={loading}
          className="px-5 py-2 rounded-xl font-medium text-white disabled:opacity-50 text-sm"
          style={{ background: '#C97A2F' }}
        >
          {loading ? 'Adding…' : 'Add Persona'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-5 py-2 rounded-xl font-medium text-gray-600 bg-white text-sm"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
