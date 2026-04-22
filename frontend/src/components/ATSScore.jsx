export default function ATSScore({ ats }) {
  const { score = 0, matched = [], missing = [] } = ats || {}

  const circumference = 2 * Math.PI * 56
  const offset = circumference - (score / 100) * circumference
  const color = score >= 80 ? 'var(--success)' : score >= 60 ? 'var(--warning)' : 'var(--danger)'

  return (
    <div className="ats-container">
      <h3 className="card-title" style={{ textAlign: 'center' }}>ATS Compatibility Score</h3>

      <div className="ats-gauge">
        <svg width="140" height="140">
          <circle className="ats-gauge-circle" cx="70" cy="70" r="56" />
          <circle
            className="ats-gauge-value"
            cx="70" cy="70" r="56"
            stroke={color}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="ats-gauge-text">
          <div className="ats-score-number" style={{ color }}>{score}%</div>
          <div className="ats-score-label">ATS Match</div>
        </div>
      </div>

      {matched.length > 0 && (
        <div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 8, textAlign: 'center' }}>
            ✅ Matched Keywords ({matched.length})
          </p>
          <div className="ats-keywords">
            {matched.slice(0, 30).map((kw, i) => (
              <span className="keyword-matched" key={i}>{kw}</span>
            ))}
          </div>
        </div>
      )}

      {missing.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 8, textAlign: 'center' }}>
            ❌ Missing Keywords ({missing.length})
          </p>
          <div className="ats-keywords">
            {missing.slice(0, 20).map((kw, i) => (
              <span className="keyword-missing" key={i}>{kw}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
