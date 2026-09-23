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
  const [queueStatus, setQueueStatus] = useState('')

  // UI state for optional JD tailoring
  const [useTailoring, setUseTailoring] = useState(false)

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
      setStep(1)
      setResult(location.state)
    }
  }, [location.state])

  // Fetch rendered LaTeX whenever the result or template changes and we are on Step 1 (Result)
  useEffect(() => {
    if (step === 1 && result?.resume && !loadingProfile) {
      fetchLatex()
    }
  }, [step, result, selectedTemplate, loadingProfile])

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
      setPreviewStale(true)
      compilePreviewPdf(texContent)
    } catch (err) {
      setError(`Failed to fetch LaTeX source: ${err.message}`)
    } finally {
      setFetchingLatex(false)
    }
  }

  const compilePreviewPdf = async (texString) => {
    setCompilingPreview(true)
    setError('')
    try {
      const blob = await apiBlob('/api/pdf-raw', {
        method: 'POST',
        body: JSON.stringify({ latex: texString }),
      })

      if (blob.size === 0) {
        throw new Error('Server returned empty PDF. Check your LaTeX for syntax errors.')
      }

      const url = URL.createObjectURL(blob)
      if (prevPdfUrlRef.current) {
        URL.revokeObjectURL(prevPdfUrlRef.current)
      }
      prevPdfUrlRef.current = url
      setPdfPreviewUrl(url)
      setPreviewStale(false)
    } catch (err) {
      setError(`Preview Compilation Failed: ${err.message}`)
    } finally {
      setCompilingPreview(false)
    }
  }

  const handleGenerate = async () => {
    if (useTailoring && !jd.trim()) {
      setError('Please paste a job description, or disable tailoring.')
      return
    }
    setLoading(true)
    setError('')
    setQueueStatus('Submitting to processing queue...')

    try {
      // Create task
      const { task_id } = await apiJson('/api/generate', {
        method: 'POST',
        body: JSON.stringify({ jd: useTailoring ? jd : "" }),
      })

      // Poll for completion
      const poll = setInterval(async () => {
        try {
          const statusRes = await apiJson(`/api/generate/status/${task_id}`)

          if (statusRes.status === 'processing') {
            setQueueStatus(`Processing: ${statusRes.detail || 'In progress...'}`)
          } else if (statusRes.status === 'completed') {
            clearInterval(poll)
            setResult(statusRes.result)
            setStep(1)
            setLoading(false)
            setQueueStatus('')
          } else if (statusRes.status === 'error') {
            clearInterval(poll)
            setError(`Generation failed: ${statusRes.detail}`)
            setLoading(false)
            setQueueStatus('')
          }
        } catch (err) {
          clearInterval(poll)
          setError(err.message)
          setLoading(false)
          setQueueStatus('')
        }
      }, 2000)

    } catch (err) {
      setError(err.message)
      setLoading(false)
      setQueueStatus('')
    }
  }

  const handleDownload = async () => {
    if (!result) return
    setDownloadingPdf(true)
    setError('')
    try {
      const blob = await apiBlob('/api/pdf-raw', {
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
            onClick={() => { if (i <= step || (i === 1 && result)) setStep(i) }}
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
        <>
          <ProfileForm
            initialData={profile}
            onNext={(savedProfile) => {
              setProfile(savedProfile)
              // Don't auto-advance. Let user click 'Generate PDF' when ready.
            }}
          />
          <hr style={{ margin: '32px 0', border: 'none', borderTop: '1px solid var(--border)' }} />

          <div style={{ backgroundColor: 'var(--card-bg)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: useTailoring ? '16px' : '0' }}>
                  <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '1.2rem' }}>✨</span> Optional: Tailor to a Job Description
                  </h3>
                  <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setUseTailoring(!useTailoring)}
                  >
                      {useTailoring ? 'Disable Tailoring' : 'Enable Tailoring'}
                  </button>
              </div>

              {useTailoring && (
                  <div style={{ marginTop: '16px' }}>
                      <JDInput value={jd} onChange={setJd} />
                  </div>
              )}

              <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                 <button
                    className="btn btn-primary btn-lg generate-btn"
                    onClick={handleGenerate}
                    disabled={loading || (useTailoring && !jd.trim())}
                    style={{ width: '100%', maxWidth: '400px' }}
                  >
                    {loading ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div className="spinner" style={{ width: 16, height: 16, borderLeftColor: '#fff' }} />
                        Generating...
                      </span>
                    ) : (
                      'Generate PDF'
                    )}
                  </button>
                  {queueStatus && <p className="loading-text" style={{ fontSize: '0.85rem' }}>{queueStatus}</p>}
              </div>
          </div>
        </>
      )}

      {/* Step 1: Result */}
      {step === 1 && result && (
        <div style={{ animation: 'fadeIn 0.5s ease-out' }}>
          <h2 className="step-title">3. Your Tailored Resume</h2>

          {result.ats && result.ats.score !== undefined && (
            <ATSScore score={result.ats.score} missing={result.ats.missing} />
          )}

          <div style={{ marginBottom: 16, display: 'flex', gap: 16, alignItems: 'center' }}>
            <div>
              <label className="form-label" style={{ display: 'inline-block', marginRight: 8, marginBottom: 0 }}>Template:</label>
              <select
                className="form-input"
                style={{ display: 'inline-block', width: 'auto', padding: '6px 12px' }}
                value={selectedTemplate}
                onChange={(e) => setSelectedTemplate(e.target.value)}
              >
                <option value="modern.tex.j2">Modern (Default)</option>
                <option value="classic.tex.j2">Classic</option>
              </select>
            </div>
          </div>

          <div className="editor-layout">
            <div className="editor-left">
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <button
                  className={`btn ${activeTab === 'pdf' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                  onClick={() => setActiveTab('pdf')}
                >
                  PDF Preview
                </button>
                <button
                  className={`btn ${activeTab === 'latex' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                  onClick={() => setActiveTab('latex')}
                >
                  LaTeX Source
                </button>
              </div>

              {activeTab === 'latex' && (
                <div style={{ display: 'flex', flexDirection: 'column', height: '600px', gap: 8 }}>
                  <textarea
                    className="form-textarea"
                    value={rawLatex}
                    onChange={(e) => {
                      setRawLatex(e.target.value)
                      setPreviewStale(true)
                    }}
                    style={{
                      flexGrow: 1,
                      fontFamily: 'monospace',
                      fontSize: '0.85rem',
                      whiteSpace: 'pre',
                      overflowWrap: 'normal',
                      overflowX: 'auto'
                    }}
                    spellCheck="false"
                  />
                  <button
                    className="btn btn-secondary"
                    onClick={() => compilePreviewPdf(rawLatex)}
                    disabled={compilingPreview || !previewStale}
                  >
                    {compilingPreview ? 'Compiling...' : previewStale ? 'Recompile PDF' : 'Up to date'}
                  </button>
                </div>
              )}

              {activeTab === 'pdf' && (
                <div style={{ height: '600px', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', position: 'relative', backgroundColor: '#333' }}>
                  {compilingPreview || fetchingLatex ? (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 10 }}>
                      <div className="spinner" />
                      <p style={{ marginTop: 16 }}>{compilingPreview ? 'Compiling PDF...' : 'Generating LaTeX...'}</p>
                    </div>
                  ) : null}

                  {pdfPreviewUrl ? (
                    <iframe
                      src={`${pdfPreviewUrl}#toolbar=0`}
                      style={{ width: '100%', height: '100%', border: 'none' }}
                      title="PDF Preview"
                    />
                  ) : (
                    <div style={{ padding: 24, textAlign: 'center', color: '#999' }}>No preview available.</div>
                  )}
                </div>
              )}
            </div>

            <div className="editor-right">
              <div style={{ position: 'sticky', top: 24 }}>
                <h3 style={{ marginTop: 0, marginBottom: 16, fontSize: '1.1rem' }}>Download</h3>
                <button
                  className="btn btn-primary"
                  style={{ width: '100%', marginBottom: 16 }}
                  onClick={handleDownload}
                  disabled={downloadingPdf || fetchingLatex || compilingPreview}
                >
                  {downloadingPdf ? 'Generating...' : '↓ Download Final PDF'}
                </button>

                <button
                  className="btn btn-secondary"
                  style={{ width: '100%' }}
                  onClick={() => {
                    const blob = new Blob([rawLatex], { type: 'text/plain;charset=utf-8' })
                    downloadBlob(blob, 'resume.tex')
                  }}
                  disabled={!rawLatex}
                >
                  ↓ Download .tex source
                </button>

                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 24 }}>
                  <strong>Pro tip:</strong> You can edit the LaTeX source directly to fix any minor formatting issues before downloading the final PDF.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
