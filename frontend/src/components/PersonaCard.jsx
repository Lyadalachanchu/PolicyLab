const SOURCE_BADGE = {
  cbs_anchored: { label: 'CBS', style: 'bg-blue-100 text-blue-700' },
  manual: { label: 'Manual', style: 'bg-purple-100 text-purple-700' },
}

export default function PersonaCard({ persona, expanded, onToggle }) {
  const badge = SOURCE_BADGE[persona.source] || { label: persona.source, style: 'bg-gray-100 text-gray-600' }

  return (
    <div className="bg-white/60 rounded-xl overflow-hidden">
      <button
        className="w-full text-left px-5 py-3 flex items-center gap-3 hover:bg-white/40 transition-colors"
        onClick={onToggle}
      >
        <div className="flex-1 grid grid-cols-3 gap-2 text-sm sm:grid-cols-6">
          <span className="font-medium">{persona.age_band}</span>
          <span className="text-gray-600">{persona.gender}</span>
          <span className="text-gray-600">{persona.income_quartile}</span>
          <span className="text-gray-500 hidden sm:block">{persona.employment_status.replace('_', ' ')}</span>
          <span className="text-gray-500 hidden sm:block">{persona.housing_type.replace('_', ' ')}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full self-center ${badge.style} hidden sm:block`}>
            {badge.label}
          </span>
        </div>
        <span className="text-gray-400 text-xs ml-auto">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="px-5 pb-4 border-t border-gray-100">
          <div className="flex flex-wrap gap-2 mt-3 mb-3">
            <Chip label={persona.migration_background.replace('_', ' ')} />
            <Chip label={persona.housing_type.replace('_', ' ')} />
            <Chip label={persona.employment_status.replace('_', ' ')} />
            <span className={`text-xs px-2 py-0.5 rounded-full ${badge.style}`}>{badge.label}</span>
          </div>
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{persona.narrative}</p>
        </div>
      )}
    </div>
  )
}

function Chip({ label }) {
  return (
    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full capitalize">{label}</span>
  )
}
