const STATUS_COLOR = {
  ok: 'bg-green-500',
  under: 'bg-yellow-400',
  over: 'bg-red-400',
}

function DimensionTable({ dimension, buckets }) {
  return (
    <div className="bg-white/60 rounded-xl p-4">
      <h3 className="text-sm font-semibold mb-3 capitalize">{dimension.replace('_', ' ')}</h3>
      <div className="space-y-2">
        {Object.entries(buckets).map(([bucket, info]) => (
          <div key={bucket}>
            <div className="flex items-center justify-between text-xs mb-0.5">
              <span className="text-gray-600 capitalize">{bucket.replace('_', ' ')}</span>
              <span className="text-gray-500">
                {(info.actual_pct * 100).toFixed(0)}%
                <span className="text-gray-300 mx-1">/</span>
                <span className="text-gray-400">{(info.cbs_pct * 100).toFixed(0)}% CBS</span>
              </span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden flex">
              <div
                className={`h-full rounded-full transition-all ${STATUS_COLOR[info.status] || 'bg-gray-400'}`}
                style={{ width: `${Math.min(info.actual_pct * 100, 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function CoverageGrid({ coverage }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Object.entries(coverage).map(([dimension, buckets]) => (
        <DimensionTable key={dimension} dimension={dimension} buckets={buckets} />
      ))}
    </div>
  )
}
