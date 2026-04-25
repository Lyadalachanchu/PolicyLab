import { useState } from 'react'

function ProbabilityBar({ label, probability, isTop }) {
  const pct = (probability * 100).toFixed(1)
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-gray-700">{label}</span>
        <span className="font-semibold" style={isTop ? { color: '#C97A2F' } : { color: '#6B7280' }}>
          {pct}%
        </span>
      </div>
      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            background: isTop ? '#C97A2F' : '#D1D5DB',
          }}
        />
      </div>
    </div>
  )
}

export default function MarketCard({ market }) {
  const [showBets, setShowBets] = useState(false)

  const maxProb = Math.max(...market.buckets.map((b) => b.probability))
  const conditionBadge = market.condition === 'passes'
    ? 'bg-green-100 text-green-700'
    : 'bg-red-100 text-red-700'

  return (
    <div className="border border-gray-200 rounded-xl p-4 bg-white/40">
      <div className="flex items-center justify-between mb-3">
        <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full uppercase tracking-wide ${conditionBadge}`}>
          If policy {market.condition}
        </span>
        <span className="text-xs text-gray-400">{market.total_bets} bets</span>
      </div>

      <div className="space-y-2">
        {market.buckets.map((bucket) => (
          <ProbabilityBar
            key={bucket.index}
            label={bucket.label}
            probability={bucket.probability}
            isTop={bucket.probability === maxProb}
          />
        ))}
      </div>

      {market.bets && market.bets.length > 0 && (
        <div className="mt-3 border-t border-gray-100 pt-3">
          <button
            onClick={() => setShowBets(!showBets)}
            className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
          >
            {showBets ? '▲' : '▼'} {showBets ? 'Hide' : 'Show'} persona bets
          </button>

          {showBets && (
            <div className="mt-2 space-y-2 max-h-64 overflow-y-auto">
              {market.bets.map((bet) => (
                <div key={bet.id} className="text-xs bg-gray-50 rounded-lg p-2.5">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-gray-700">→ {bet.bucket_label}</span>
                    <span className="text-gray-400">· persona #{bet.persona_id}</span>
                  </div>
                  <p className="text-gray-500 leading-relaxed">{bet.reason}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
