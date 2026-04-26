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
    age_band: '25-34', gender: 'male', income_quartile: 'Q2',
    employment_status: 'employed', migration_background: 'dutch',
    housing_type: 'owner', narrative: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function set(field, value) { setForm((p) => ({ ...p, [field]: value })) }

  async function handleSubmit(e) {
    e.preventDefault()
    if (form.narrative.trim().length < 10) { setError('Narrative must be at least 10 characters'); return }
    setError('')
    setLoading(true)
    try { await api.addPersona(gemeenteCode, form); onDone() }
    catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  return (
    <form onSubmit={handleSubmit} style={{ border: '1px solid #D9DEE8' }} className="p-6">
      <h3 className="text-sm font-semibold uppercase tracking-widest text-gray-600 mb-6" style={{ letterSpacing: '0.1em' }}>
        Add Manual Persona
      </h3>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-6">
        {Object.entries(FIELDS).map(([field, options]) => (
          <div key={field}>
            <label className="block text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1 capitalize" style={{ letterSpacing: '0.08em' }}>
              {field.replace(/_/g, ' ')}
            </label>
            <select
              value={form[field]}
              onChange={(e) => set(field, e.target.value)}
              className="w-full border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-gray-900 bg-white"
            >
              {options.map((o) => <option key={o} value={o}>{o.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
        ))}
      </div>

      <div className="mb-6">
        <label className="block text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1" style={{ letterSpacing: '0.08em' }}>
          Narrative
        </label>
        <textarea
          value={form.narrative}
          onChange={(e) => set('narrative', e.target.value)}
          rows={4}
          placeholder="Describe this person's situation, values, concerns, and relationship to local policy…"
          className="w-full border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-gray-900 resize-none"
        />
      </div>

      {error && (
        <div className="border-l-4 border-red-600 bg-red-50 px-4 py-3 mb-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="flex gap-3">
        <button type="submit" disabled={loading}
          className="px-6 py-2 text-xs font-semibold uppercase text-white disabled:opacity-40"
          style={{ background: '#0D132D', letterSpacing: '0.08em' }}>
          {loading ? 'Adding…' : 'Add Persona'}
        </button>
        <button type="button" onClick={onCancel}
          className="px-6 py-2 text-xs font-semibold uppercase"
          style={{ border: '1px solid #D9DEE8', color: '#293340', letterSpacing: '0.08em' }}>
          Cancel
        </button>
      </div>
    </form>
  )
}
