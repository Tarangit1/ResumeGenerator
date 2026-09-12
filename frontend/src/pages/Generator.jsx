import { useState, useEffect, useRef } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { apiJson, apiText, apiBlob, downloadBlob } from '../api'
import ProfileForm from '../components/ProfileForm'
import JDInput from '../components/JDInput'
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
  const [selectedTemplate, setSelectedTemplate] = useState('modern.tex.j2')

  // LaTeX + PDF Preview States
  const [rawLatex, setRawLatex] = useState('')
  const [fetchingLatex, setFetchingLatex] = useState(false)
  const [activeTab, setActiveTab] = useState('pdf') // 'pdf' or 'latex'
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState(null)
  const [compilingPreview, setCompilingPreview] = useState(false)
  const [previewStale, setPreviewStale] = useState(false)
  const [downloadingPdf, setDownloadingPdf] = useState(false)
  const prevPdfUrlRef = useRef(null)

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

  // Fetch rendered LaTeX whenever the result or template changes and we are on Step 2
  useEffect(() => {
    if (step === 2 && result?.resume) {
      fetchLatex()
    }
  }, [step, result, selectedTemplate])

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (prevPdfUrlRef.current) URL.revokeObjectURL(prevPdfUrlRef.current)
    }
  }, [])

  const fetchLatex = async () => {
    setFetchingLatex(true)
    setError('')
    try {
      const texContent = await apiText('/api/tex', {
        method: 'POST',
        body: JSON.stringify({
          resume: result.resume,
          name: profile?.name || '',
          email: profile?.email || '',
          phone: profile?.phone || '',
          linkedin: profile?.linkedin || '',
          github: profile?.github || '',
          template_name: selectedTemplate,
          hide_keywords: result?.ats?.missing || [],
        }),
      })
      setRawLatex(texContent)
      setPreviewStale(false)
      // Auto-compile PDF preview after fetching LaTeX
      await compilePreviewFromLatex(texContent)
    } catch (err) {
      setError(err.message)
    } finally {
      setFetchingLatex(false)
    }
  }

  const compilePreviewFromLatex = async (latex) => {
    if (!latex) return
    setCompilingPreview(true)
    try {
      const blob = await apiBlob('/api/pdf/raw', {
        method: 'POST',
        body: JSON.stringify({ latex }),
      })
      if (blob.size === 0) {
        throw new Error('Server returned empty PDF. Check LaTeX for errors.')
      }
      // Revoke old URL
      if (prevPdfUrlRef.current) URL.revokeObjectURL(prevPdfUrlRef.current)
      const url = URL.createObjectURL(blob)
      prevPdfUrlRef.current = url
      setPdfPreviewUrl(url)
      setPreviewStale(false)
    } catch (err) {
      setError(`PDF preview failed: ${err.message}`)
    } finally {
      setCompilingPreview(false)
    }
  }

  const compilePreview = () => compilePreviewFromLatex(rawLatex)

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
    if (!rawLatex) return
    setDownloadingPdf(true)
    setError('')
    try {
      const blob = await apiBlob('/api/pdf/raw', {
        method: 'POST',
        body: JSON.stringify({ latex: rawLatex }),
      })
      if (blob.size === 0) {
        throw new Error('Server returned empty PDF. Check your LaTeX for errors.')
      }
      downloadBlob(blob, 'resume.pdf')
    } catch (err) {
      setError(`PDF Download Failed: ${err.message}`)
    } finally {
      setDownloadingPdf(false)
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
          <div className="download-bar card" style={{ marginBottom: 20, display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              value={selectedTemplate}
              onChange={(e) => setSelectedTemplate(e.target.value)}
              className="form-input"
              style={{ width: 'auto', padding: '8px 12px', margin: 0 }}
            >
              <option value="modern.tex.j2">Modern (Chhabra Layout)</option>
              <option value="resume.tex.j2">Classic Layout</option>
            </select>

            <button className="btn btn-primary" onClick={handleDownloadPdf} disabled={fetchingLatex || downloadingPdf}>
              {downloadingPdf ? '⏳ Compiling PDF...' : '📄 Download PDF'}
            </button>


            <button className="btn btn-secondary" onClick={() => { setResult(null); setStep(1); setPdfPreviewUrl(null) }} style={{marginLeft: 'auto'}}>
              🔄 Try Different JD
            </button>
          </div>

          {/* Tab switcher */}
          <div className="result-tabs">
            <button
              className={`result-tab ${activeTab === 'pdf' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('pdf')
                if (previewStale && rawLatex) compilePreview()
              }}
            >
              📄 PDF Preview
            </button>
            <button
              className={`result-tab ${activeTab === 'latex' ? 'active' : ''}`}
              onClick={() => setActiveTab('latex')}
            >
              ✏️ LaTeX Source
            </button>
          </div>

          {/* Tab content */}
          <div className="card" style={{ borderTopLeftRadius: 0, borderTopRightRadius: 0 }}>
            {activeTab === 'pdf' ? (
              <div>
                {(fetchingLatex || compilingPreview) ? (
                  <div style={{ textAlign: 'center', padding: '80px 0' }}>
                    <div className="spinner" />
                    <p className="loading-text">
                      {fetchingLatex ? 'Generating LaTeX...' : 'Compiling PDF with pdflatex...'}
                    </p>
                    <p className="loading-text" style={{ fontSize: '0.8rem', marginTop: 8, color: 'var(--text-muted)' }}>
                      This may take a few seconds
                    </p>
                  </div>
                ) : pdfPreviewUrl ? (
                  <div>
                    {previewStale && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', marginBottom: 12, background: 'rgba(251, 191, 36, 0.08)', border: '1px solid rgba(251, 191, 36, 0.2)', borderRadius: 'var(--radius-sm)' }}>
                        <span style={{ color: 'var(--warning)', fontSize: '0.85rem' }}>⚠️ LaTeX was edited. Preview may be outdated.</span>
                        <button className="btn btn-primary btn-sm" onClick={compilePreview}>🔄 Recompile</button>
                      </div>
                    )}
                    <iframe
                      src={pdfPreviewUrl}
                      style={{ width: '100%', height: '850px', border: 'none', borderRadius: '8px', background: '#fff' }}
                      title="PDF Preview"
                    />
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--text-secondary)' }}>
                    <p>No preview available. Waiting for LaTeX compilation...</p>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <p style={{color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '10px'}}>
                  Edit the LaTeX source directly. Changes here are used when downloading PDF or refreshing the preview.
                </p>
                {fetchingLatex ? (
                  <div style={{ textAlign: 'center', padding: '20px' }}><div className="spinner" /></div>
                ) : (
                  <textarea
                    className="form-input"
                    style={{ width: '100%', minHeight: '700px', fontFamily: 'monospace', fontSize: '13px', lineHeight: '1.5', resize: 'vertical' }}
                    value={rawLatex}
                    onChange={(e) => {
                      setRawLatex(e.target.value)
                      setPreviewStale(true)
                    }}
                  />
                )}
              </div>
            )}
          </div>
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
