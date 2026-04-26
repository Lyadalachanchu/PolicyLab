import { useState } from 'react'

const HOUSING_LABELS = {
  social_rent: 'Social renters',
  private_rent: 'Private renters',
  owner: 'Homeowners',
}

const INCOME_LABELS = {
  Q1: 'Q1 — lowest income',
  Q2: 'Q2 — lower-middle',
  Q3: 'Q3 — upper-middle',
  Q4: 'Q4 — highest income',
}

const AGE_LABELS = {
  '18-24': '18–24',
  '25-34': '25–34',
  '35-44': '35–44',
  '45-54': '45–54',
  '55-64': '55–64',
  '65+': '65+',
}

function groupBets(bets, field, labelMap) {
  const groups = {}
  for (const bet of bets) {
    const key = bet[field]
    if (!key) continue
    if (!groups[key]) groups[key] = {}
    groups[key][bet.bucket_label] = (groups[key][bet.bucket_label] || 0) + 1
  }
  return Object.entries(groups)
    .map(([key, counts]) => {
      const total = Object.values(counts).reduce((a, b) => a + b, 0)
      const [topBucket, topCount] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
      const agreement = Math.round((topCount / total) * 100)
      return { key, label: labelMap[key] || key, topBucket, topCount, total, agreement }
    })
    .sort((a, b) => a.key.localeCompare(b.key))
}

function DemographicBreakdown({ bets }) {
  const [dimension, setDimension] = useState('housing_type')

  const hasDemographics = bets.some((b) => b.persona_housing_type)
  if (!hasDemographics || bets.length === 0) return null

  const DIMS = [
    { key: 'housing_type', label: 'Housing', field: 'persona_housing_type', map: HOUSING_LABELS },
    { key: 'income_quartile', label: 'Income', field: 'persona_income_quartile', map: INCOME_LABELS },
    { key: 'age_band', label: 'Age', field: 'persona_age_band', map: AGE_LABELS },
  ]

  const active = DIMS.find((d) => d.key === dimension)
  const groups = groupBets(bets, active.field, active.map)

  // Check if groups diverge meaningfully (any two groups have different top buckets)
  const topBuckets = new Set(groups.map((g) => g.topBucket))
  const hasDivergence = topBuckets.size > 1

  return (
    <div className="mt-4 pt-4" style={{ borderTop: '1px solid #F3F3F3' }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <p className="text-xs font-semibold uppercase text-gray-400" style={{ letterSpacing: '0.08em' }}>
            Views by group
          </p>
          {hasDivergence && (
            <span
              className="text-xs font-semibold uppercase px-1.5 py-0.5"
              style={{ background: '#FFF3E0', color: '#C97A2F', letterSpacing: '0.06em' }}
            >
              ⚡ Divided
            </span>
          )}
        </div>
        <div className="flex gap-1">
          {DIMS.map((d) => (
            <button
              key={d.key}
              onClick={() => setDimension(d.key)}
              className="text-xs font-semibold uppercase px-2 py-1"
              style={{
                letterSpacing: '0.06em',
                background: dimension === d.key ? '#0D132D' : '#F3F3F3',
                color: dimension === d.key ? '#FFFFFF' : '#293340',
              }}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        {groups.map(({ key, label, topBucket, topCount, total, agreement }) => (
          <div key={key} className="flex items-center gap-3">
            <span className="text-xs text-gray-500 shrink-0" style={{ width: '7.5rem' }}>
              {label}
            </span>
            <span className="text-xs font-medium text-gray-800 flex-1 truncate">
              {topBucket}
            </span>
            <span
              className="text-xs tabular-nums shrink-0"
              style={{ color: agreement >= 70 ? '#389800' : agreement >= 50 ? '#C97A2F' : '#8A8A8A' }}
            >
              {agreement}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ProbabilityBar({ label, probability, isTop }) {
  const pct = (probability * 100).toFixed(1)
  return (
    <div className="py-2" style={{ borderBottom: '1px solid #F3F3F3' }}>
      <div className="flex items-center justify-between text-sm mb-1.5">
        <span className="text-gray-700">{label}</span>
        <span className="font-semibold tabular-nums" style={{ color: isTop ? '#0D132D' : '#8A8A8A' }}>
          {pct}%
        </span>
      </div>
      <div className="h-1.5" style={{ background: '#E8E6E0' }}>
        <div
          className="h-full transition-all duration-500"
          style={{ width: `${pct}%`, background: isTop ? '#0D132D' : '#D9DEE8' }}
        />
      </div>
    </div>
  )
}

export default function MarketCard({ market }) {
  const [showReasons, setShowReasons] = useState(false)
  const maxProb = Math.max(...market.buckets.map((b) => b.probability))
  const topBucket = market.buckets.find((b) => b.probability === maxProb)
  const isConsensus = maxProb > 0.8

  const passes = market.condition === 'passes'

  return (
    <div style={{ border: '1px solid #D9DEE8' }}>
      {/* Condition header */}
      <div
        className="px-4 py-3 flex items-center justify-between"
        style={{
          background: passes ? '#0D132D' : '#F3F3F3',
          borderBottom: '1px solid #D9DEE8',
        }}
      >
        <span
          className="text-xs font-semibold uppercase"
          style={{ letterSpacing: '0.1em', color: passes ? '#FFFFFF' : '#293340' }}
        >
          If Policy {market.condition}
        </span>
        <span className="text-xs" style={{ color: passes ? 'rgba(255,255,255,0.5)' : '#8A8A8A' }}>
          {market.total_bets} bets
        </span>
      </div>

      <div className="p-4">
        {/* Consensus callout */}
        {isConsensus && topBucket && (
          <div className="mb-4 px-3 py-2" style={{ background: '#F3F3F3', borderLeft: '3px solid #0D132D' }}>
            <p className="text-xs text-gray-500 uppercase tracking-widest mb-0.5" style={{ letterSpacing: '0.08em' }}>Consensus</p>
            <p className="text-sm font-semibold text-gray-900">
              {topBucket.label}
              <span className="font-normal text-gray-400 ml-2">({(maxProb * 100).toFixed(0)}% agreement)</span>
            </p>
          </div>
        )}

        {/* Probability bars */}
        <div>
          {market.buckets.map((bucket) => (
            <ProbabilityBar
              key={bucket.index}
              label={bucket.label}
              probability={bucket.probability}
              isTop={bucket.probability === maxProb}
            />
          ))}
        </div>

        {/* Demographic breakdown — who thinks what */}
        {market.bets && <DemographicBreakdown bets={market.bets} />}

        {/* Individual reasons */}
        {market.bets && market.bets.length > 0 && (
          <div className="mt-4">
            <button
              onClick={() => setShowReasons(!showReasons)}
              className="text-xs font-semibold uppercase text-gray-400 hover:text-gray-700 flex items-center gap-1 transition-colors"
              style={{ letterSpacing: '0.08em' }}
            >
              {showReasons ? '▲' : '▼'} {showReasons ? 'Hide' : 'Show'} individual reasoning
            </button>

            {showReasons && (
              <div className="mt-3 space-y-3 max-h-72 overflow-y-auto">
                {market.bets.map((bet) => (
                  <div key={bet.id} style={{ borderLeft: '2px solid #D9DEE8' }} className="pl-3">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className="text-xs font-semibold text-gray-700">{bet.bucket_label}</span>
                      {bet.persona_housing_type && (
                        <span className="text-xs text-gray-400">
                          · {HOUSING_LABELS[bet.persona_housing_type] || bet.persona_housing_type}
                        </span>
                      )}
                      {bet.persona_income_quartile && (
                        <span className="text-xs text-gray-400">· {bet.persona_income_quartile}</span>
                      )}
                      {bet.persona_age_band && (
                        <span className="text-xs text-gray-400">· {bet.persona_age_band}</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 leading-relaxed">{bet.reason}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
