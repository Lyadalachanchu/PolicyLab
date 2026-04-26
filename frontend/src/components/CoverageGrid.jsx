const STATUS_COLOR = { ok: '#389800', under: '#C97A2F', over: '#B50000' }
const STATUS_LABEL = { ok: 'On target', under: 'Under', over: 'Over' }

function DimensionTable({ dimension, buckets }) {
  return (
    <div style={{ border: '1px solid #D9DEE8' }}>
      <div className="px-4 py-3" style={{ background: '#F3F3F3', borderBottom: '1px solid #D9DEE8' }}>
        <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-600 capitalize" style={{ letterSpacing: '0.1em' }}>
          {dimension.replace(/_/g, ' ')}
        </h3>
      </div>
      <div className="divide-y" style={{ borderColor: '#D9DEE8' }}>
        {Object.entries(buckets).map(([bucket, info]) => (
          <div key={bucket} className="px-4 py-3">
            <div className="flex items-baseline justify-between text-xs mb-2">
              <span className="text-gray-700 capitalize font-medium">{bucket.replace(/_/g, ' ')}</span>
              <span className="text-gray-500 tabular-nums">
                <span className="font-semibold" style={{ color: STATUS_COLOR[info.status] }}>
                  {info.actual_pct.toFixed(0)}%
                </span>
                <span className="text-gray-300 mx-1">/</span>
                <span>{info.cbs_pct.toFixed(0)}% CBS</span>
              </span>
            </div>
            <div className="relative h-1.5" style={{ background: '#E8E6E0' }}>
              <div
                className="absolute inset-y-0 left-0 opacity-30"
                style={{ width: `${Math.min(info.cbs_pct, 100)}%`, background: '#293340' }}
              />
              <div
                className="absolute inset-y-0 left-0"
                style={{ width: `${Math.min(info.actual_pct, 100)}%`, background: STATUS_COLOR[info.status] }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {info.count} persona{info.count !== 1 ? 's' : ''} · {STATUS_LABEL[info.status] || info.status}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function CoverageGrid({ coverage }) {
  return (
    <div>
      <p className="text-xs text-gray-400 mb-4 uppercase tracking-widest" style={{ letterSpacing: '0.08em' }}>
        Coloured bar = % of personas · Grey bar = % of city population (CBS)
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Object.entries(coverage).map(([dimension, buckets]) => (
          <DimensionTable key={dimension} dimension={dimension} buckets={buckets} />
        ))}
      </div>
    </div>
  )
}
