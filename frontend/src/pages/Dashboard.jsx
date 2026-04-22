import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiJson } from '../api'

export default function Dashboard() {
  const [profile, setProfile] = useState(null)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    Promise.all([
      apiJson('/api/profile'),
      apiJson('/api/history'),
    ]).then(([p, h]) => {
      setProfile(p)
      setHistory(h)
    }).finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0' }}>
        <div className="spinner" />
        <p className="loading-text">Loading dashboard...</p>
      </div>
    )
  }

  const hasProfile = profile && profile.name

  return (
    <div>
      <div className="dashboard-hero">
        <h1>👋 {hasProfile ? `Welcome, ${profile.name}` : 'Welcome to ResumeForge'}</h1>
        <p>{hasProfile ? 'Your profile is ready. Generate tailored resumes.' : 'Set up your profile to get started.'}</p>
      </div>

      <div className="dashboard-grid">
        <div className="stat-card">
          <div className="stat-value">{history.length}</div>
          <div className="stat-label">Resumes Generated</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">
            {history.length > 0 ? Math.round(history.reduce((sum, h) => sum + (h.ats_score || 0), 0) / history.length) + '%' : '—'}
          </div>
          <div className="stat-label">Avg ATS Score</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '32px' }}>
        <button className="btn btn-primary btn-lg" onClick={() => navigate('/generate')}>
          ⚡ Generate Resume
        </button>
        <button className="btn btn-secondary btn-lg" onClick={() => navigate('/generate?step=0')}>
          ✏️ Edit Profile
        </button>
      </div>

      <div className="card" style={{ marginBottom: '32px', borderLeft: '4px solid var(--accent)', background: 'rgba(255,107,107,0.05)' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          🤖 AI Settings <span style={{ fontSize: '0.75rem', padding: '2px 6px', background: 'var(--accent)', color: 'white', borderRadius: '12px' }}>Required</span>
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '16px' }}>
          To generate and parse resumes using the AI engine, please provide your own free Gemini API key. It is stored securely only in your browser.
        </p>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            className="form-input"
            type="password"
            placeholder="paste your gemini api key here (AIza...)"
            defaultValue={localStorage.getItem('geminiApiKey') || ''}
            onChange={(e) => localStorage.setItem('geminiApiKey', e.target.value.trim())}
            style={{ flex: 1, fontFamily: 'monospace' }}
          />
          <button 
            className="btn btn-secondary" 
            onClick={() => alert('API Key saved securely to your browser!')}
          >
            Save Key
          </button>
        </div>
      </div>

      {history.length > 0 && (
        <>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px' }}>Recent History</h2>
          <div className="history-list">
            {history.map((h) => (
              <div
                key={h.id}
                className="history-item"
                onClick={() => navigate('/generate', { state: { resume: h.resume, ats: { score: h.ats_score } } })}
              >
                <div className="history-jd">{h.jd_preview}</div>
                <div className="history-score" style={{ color: h.ats_score >= 70 ? 'var(--success)' : 'var(--warning)' }}>
                  {h.ats_score}%
                </div>
                <div className="history-date">
                  {h.created_at ? new Date(h.created_at).toLocaleDateString() : ''}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
