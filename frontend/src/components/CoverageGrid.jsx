const STATUS_COLOR = {
  ok: '#22C55E',
  under: '#EAB308',
  over: '#EF4444',
}

function DimensionTable({ dimension, buckets }) {
  return (
    <div className="bg-white/60 rounded-xl p-4">
      <h3 className="text-sm font-semibold mb-3 capitalize">
        {dimension.replace(/_/g, ' ')}
      </h3>
      <div className="space-y-3">
        {Object.entries(buckets).map(([bucket, info]) => {
          const actual = info.actual_pct   // already a %
          const cbs = info.cbs_pct
          const barActual = Math.min(actual, 100)
          const barCbs = Math.min(cbs, 100)

          return (
            <div key={bucket}>
              <div className="flex items-baseline justify-between text-xs mb-1">
                <span className="text-gray-700 capitalize">{bucket.replace(/_/g, ' ')}</span>
                <span className="text-gray-500 tabular-nums">
                  <span className="font-medium" style={{ color: STATUS_COLOR[info.status] }}>
                    {actual.toFixed(0)}%
                  </span>
                  <span className="text-gray-300 mx-1">of personas /</span>
                  <span className="text-gray-400">{cbs.toFixed(0)}% in city</span>
                </span>
              </div>

              {/* Stacked bar: city benchmark (gray) with persona actual (colored) overlaid */}
              <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden">
                {/* CBS benchmark */}
                <div
                  className="absolute inset-y-0 left-0 rounded-full opacity-30"
                  style={{ width: `${barCbs}%`, background: '#6B7280' }}
                />
                {/* Actual */}
                <div
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{ width: `${barActual}%`, background: STATUS_COLOR[info.status] }}
                />
              </div>

              <p className="text-xs text-gray-400 mt-0.5">
                {info.count} persona{info.count !== 1 ? 's' : ''}
                {info.status === 'under' && ' · underrepresented'}
                {info.status === 'over' && ' · overrepresented'}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function CoverageGrid({ coverage }) {
  return (
    <div>
      <p className="text-xs text-gray-400 mb-3">
        Coloured bar = % of your personas · Grey bar = % of city population (CBS)
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Object.entries(coverage).map(([dimension, buckets]) => (
          <DimensionTable key={dimension} dimension={dimension} buckets={buckets} />
        ))}
      </div>
    </div>
  )
}
