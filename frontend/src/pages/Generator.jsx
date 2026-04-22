import { useState, useEffect } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { apiJson, apiBlob, downloadBlob } from '../api'
import ProfileForm from '../components/ProfileForm'
import JDInput from '../components/JDInput'
import ResumePreview from '../components/ResumePreview'
import ATSScore from '../components/ATSScore'

export default function Generator() {
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const initialStep = parseInt(searchParams.get('step') || '0', 10)

  const [step, setStep] = useState(initialStep)
  const [profile, setProfile] = useState(null)
  const [jd, setJd] = useState('')
  const [result, setResult] = useState(location.state || null)
  const [loading, setLoading] = useState(false)
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    apiJson('/api/profile').then((p) => {
      setProfile(p)
    }).finally(() => setLoadingProfile(false))
  }, [])

  // If we came from history, jump to result step
  useEffect(() => {
    if (location.state?.resume) {
      setStep(2)
      setResult(location.state)
    }
  }, [location.state])

  const handleSaveProfile = async (data) => {
    try {
      await apiJson('/api/profile', {
        method: 'PUT',
        body: JSON.stringify(data),
      })
      setProfile(data)
      setStep(1)
    } catch (err) {
      setError(err.message)
    }
  }

  const handleGenerate = async () => {
    if (!jd.trim()) {
      setError('Paste a job description first')
      return
    }
    setError('')
    setLoading(true)
    try {
      const data = await apiJson('/api/generate', {
        method: 'POST',
        body: JSON.stringify({ jd }),
      })
      setResult(data)
      setStep(2)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadPdf = async () => {
    if (!result?.resume) return
    try {
      const blob = await apiBlob('/api/pdf', {
        method: 'POST',
        body: JSON.stringify({
          resume: result.resume,
          name: profile?.name || '',
          email: profile?.email || '',
          phone: profile?.phone || '',
          linkedin: profile?.linkedin || '',
          hide_keywords: result?.ats?.missing || [],
        }),
      })
      downloadBlob(blob, 'resume.pdf')
    } catch (err) {
      setError(err.message)
    }
  }

  const handleDownloadTex = async () => {
    if (!result?.resume) return
    try {
      const blob = await apiBlob('/api/tex', {
        method: 'POST',
        body: JSON.stringify({
          resume: result.resume,
          name: profile?.name || '',
          email: profile?.email || '',
          phone: profile?.phone || '',
          linkedin: profile?.linkedin || '',
          hide_keywords: result?.ats?.missing || [],
        }),
      })
      downloadBlob(blob, 'resume.tex')
    } catch (err) {
      setError(err.message)
    }
  }

  const steps = [
    { label: 'Profile', icon: '👤' },
    { label: 'Job Description', icon: '📋' },
    { label: 'Result', icon: '🎯' },
  ]

  if (loadingProfile) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0' }}>
        <div className="spinner" />
        <p className="loading-text">Loading profile...</p>
      </div>
    )
  }

  return (
    <div>
      {/* Wizard Steps */}
      <div className="wizard-steps">
        {steps.map((s, i) => (
          <div
            key={i}
            className={`wizard-step ${step === i ? 'active' : ''} ${step > i ? 'completed' : ''}`}
            onClick={() => { if (i <= step || (i === 2 && result)) setStep(i) }}
          >
            <div className="wizard-step-number">
              {step > i ? '✓' : i + 1}
            </div>
            <span className="wizard-step-label">{s.icon} {s.label}</span>
          </div>
        ))}
      </div>

      {error && <div className="auth-error" style={{ marginBottom: 16 }}>{error}</div>}

      {/* Step 0: Profile */}
      {step === 0 && (
        <div className="card">
          <h2 className="card-title">Your Profile</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: 20 }}>
            Fill this once. We save it and reuse for every JD.
          </p>
          <ProfileForm initial={profile} onSave={handleSaveProfile} />
        </div>
      )}

      {/* Step 1: JD Input */}
      {step === 1 && (
        <div className="card">
          <h2 className="card-title">Paste Job Description</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: 20 }}>
            Paste the full JD. Gemini will extract keywords, inflate your projects, and tailor everything.
          </p>
          <JDInput value={jd} onChange={setJd} />
          <div className="wizard-nav">
            <button className="btn btn-secondary" onClick={() => setStep(0)}>← Edit Profile</button>
            <button className="btn btn-primary btn-lg" onClick={handleGenerate} disabled={loading}>
              {loading ? '🔄 Generating...' : '⚡ Generate Resume'}
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Result */}
      {step === 2 && result && (
        <div>
          {/* ATS Score */}
          {result.ats && (
            <div className="card" style={{ marginBottom: 20 }}>
              <ATSScore ats={result.ats} />
            </div>
          )}

          {/* Download bar */}
          <div className="download-bar" style={{ marginBottom: 20 }}>
            <button className="btn btn-primary" onClick={handleDownloadPdf}>📄 Download PDF</button>
            <button className="btn btn-secondary" onClick={handleDownloadTex}>📝 Download .tex</button>
            <button className="btn btn-secondary" onClick={() => { setResult(null); setStep(1) }}>
              🔄 Try Different JD
            </button>
          </div>

          {/* Resume Preview */}
          <ResumePreview
            resume={result.resume}
            name={profile?.name}
            email={profile?.email}
            phone={profile?.phone}
            linkedin={profile?.linkedin}
          />
        </div>
      )}

      {/* Loading overlay */}
      {loading && (
        <div className="loading-overlay">
          <div className="loading-content">
            <div className="spinner" />
            <p className="loading-text">Gemini is inflating your projects & optimizing for ATS...</p>
            <p className="loading-text" style={{ fontSize: '0.8rem', marginTop: 8, color: 'var(--text-muted)' }}>
              This takes 5-15 seconds
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
