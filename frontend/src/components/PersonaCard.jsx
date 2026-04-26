const SOURCE_BADGE = {
  cbs_anchored: { label: 'CBS', color: '#0D132D' },
  manual: { label: 'Manual', color: '#C97A2F' },
}

export default function PersonaCard({ persona, expanded, onToggle }) {
  const badge = SOURCE_BADGE[persona.source] || { label: persona.source, color: '#8A8A8A' }

  return (
    <div style={{ borderBottom: '1px solid #D9DEE8' }}>
      <button
        className="w-full text-left px-0 py-4 flex items-center gap-4 hover:bg-gray-50 transition-colors"
        onClick={onToggle}
      >
        <div className="flex-1 grid grid-cols-3 sm:grid-cols-6 gap-2 text-sm">
          <span className="font-semibold text-gray-900">{persona.age_band}</span>
          <span className="text-gray-600 capitalize">{persona.gender}</span>
          <span className="text-gray-600">{persona.income_quartile}</span>
          <span className="text-gray-500 hidden sm:block capitalize">{persona.employment_status.replace(/_/g, ' ')}</span>
          <span className="text-gray-500 hidden sm:block capitalize">{persona.housing_type.replace(/_/g, ' ')}</span>
          <span
            className="hidden sm:inline-flex items-center justify-center text-xs font-semibold uppercase px-2 py-0.5 text-white"
            style={{ background: badge.color, letterSpacing: '0.06em', width: 'fit-content' }}
          >
            {badge.label}
          </span>
        </div>
        <span className="text-gray-400 text-xs ml-2">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="pb-6 pl-0">
          <div className="flex flex-wrap gap-2 mb-4">
            {[
              persona.migration_background.replace(/_/g, ' '),
              persona.housing_type.replace(/_/g, ' '),
              persona.employment_status.replace(/_/g, ' '),
            ].map((tag) => (
              <span
                key={tag}
                className="text-xs font-medium uppercase px-2 py-1 capitalize"
                style={{ background: '#F3F3F3', color: '#293340', letterSpacing: '0.06em' }}
              >
                {tag}
              </span>
            ))}
            <span
              className="text-xs font-medium uppercase px-2 py-1"
              style={{ background: badge.color, color: 'white', letterSpacing: '0.06em' }}
            >
              {badge.label}
            </span>
          </div>
          <p className="text-sm text-gray-700 leading-relaxed">{persona.narrative}</p>
        </div>
      )}
    </div>
  )
}
