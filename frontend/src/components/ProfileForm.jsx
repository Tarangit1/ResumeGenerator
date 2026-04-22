import { useState, useEffect, useRef } from 'react'

const API = import.meta.env.VITE_API_URL || ''

export default function ProfileForm({ initial, onSave }) {
  const [form, setForm] = useState({
    name: '', email: '', phone: '', linkedin: '',
    skills: [], experience: [], education: [], projects: [],
  })
  const [skillInput, setSkillInput] = useState('')
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState('')
  const [showLatexInput, setShowLatexInput] = useState(false)
  const [latexCode, setLatexCode] = useState('')
  const fileInputRef = useRef(null)

  const applyImport = (data) => {
    setForm({
      name: data.name || '',
      email: data.email || '',
      phone: data.phone || '',
      linkedin: data.linkedin || '',
      skills: data.skills || [],
      experience: data.experience || [],
      education: data.education || [],
      projects: data.projects || [],
    })
  }

  const handlePdfImport = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    setImportError('')
    try {
      const formData = new FormData()
      formData.append('file', file)
      const token = localStorage.getItem('token')
      const geminiKey = localStorage.getItem('geminiApiKey')
      const headers = { 'Authorization': `Bearer ${token}` }
      if (geminiKey) headers['X-Gemini-Key'] = geminiKey
      
      const res = await fetch(`${API}/api/profile/import-pdf`, {
        method: 'POST',
        headers,
        body: formData,
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail || 'Import failed')
      }
      const data = await res.json()
      applyImport(data)
    } catch (err) {
      setImportError(err.message)
    } finally {
      setImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleLatexImport = async () => {
    if (!latexCode.trim()) return
    setImporting(true)
    setImportError('')
    try {
      const token = localStorage.getItem('token')
      const geminiKey = localStorage.getItem('geminiApiKey')
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      }
      if (geminiKey) headers['X-Gemini-Key'] = geminiKey

      const res = await fetch(`${API}/api/profile/import-latex`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ latex: latexCode }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail || 'Import failed')
      }
      const data = await res.json()
      applyImport(data)
      setShowLatexInput(false)
      setLatexCode('')
    } catch (err) {
      setImportError(err.message)
    } finally {
      setImporting(false)
    }
  }

  useEffect(() => {
    if (initial) {
      setForm({
        name: initial.name || '',
        email: initial.email || '',
        phone: initial.phone || '',
        linkedin: initial.linkedin || '',
        skills: initial.skills || [],
        experience: initial.experience || [],
        education: initial.education || [],
        projects: initial.projects || [],
      })
    }
  }, [initial])

  const update = (key, val) => setForm((f) => ({ ...f, [key]: val }))

  const addSkill = () => {
    const s = skillInput.trim()
    if (s && !form.skills.includes(s)) {
      update('skills', [...form.skills, s])
      setSkillInput('')
    }
  }

  const removeSkill = (idx) => {
    update('skills', form.skills.filter((_, i) => i !== idx))
  }

  // Experience
  const addExperience = () => {
    update('experience', [...form.experience, { title: '', company: '', start: '', end: '', bullets: [''] }])
  }

  const updateExp = (idx, key, val) => {
    const copy = [...form.experience]
    copy[idx] = { ...copy[idx], [key]: val }
    update('experience', copy)
  }

  const removeExp = (idx) => {
    update('experience', form.experience.filter((_, i) => i !== idx))
  }

  const addExpBullet = (idx) => {
    const copy = [...form.experience]
    copy[idx].bullets = [...(copy[idx].bullets || []), '']
    update('experience', copy)
  }

  const updateExpBullet = (expIdx, bulletIdx, val) => {
    const copy = [...form.experience]
    copy[expIdx].bullets[bulletIdx] = val
    update('experience', copy)
  }

  const removeExpBullet = (expIdx, bulletIdx) => {
    const copy = [...form.experience]
    copy[expIdx].bullets = copy[expIdx].bullets.filter((_, i) => i !== bulletIdx)
    update('experience', copy)
  }

  // Projects
  const addProject = () => {
    update('projects', [...form.projects, { name: '', description: '', tech: [] }])
  }

  const updateProj = (idx, key, val) => {
    const copy = [...form.projects]
    copy[idx] = { ...copy[idx], [key]: val }
    update('projects', copy)
  }

  const removeProj = (idx) => {
    update('projects', form.projects.filter((_, i) => i !== idx))
  }

  const moveProjUp = (idx) => {
    if (idx === 0) return
    const copy = [...form.projects]
    const temp = copy[idx - 1]
    copy[idx - 1] = copy[idx]
    copy[idx] = temp
    update('projects', copy)
  }

  const moveProjDown = (idx) => {
    if (idx === form.projects.length - 1) return
    const copy = [...form.projects]
    const temp = copy[idx + 1]
    copy[idx + 1] = copy[idx]
    copy[idx] = temp
    update('projects', copy)
  }

  // Education
  const addEducation = () => {
    update('education', [...form.education, { degree: '', school: '', year: '' }])
  }

  const updateEdu = (idx, key, val) => {
    const copy = [...form.education]
    copy[idx] = { ...copy[idx], [key]: val }
    update('education', copy)
  }

  const removeEdu = (idx) => {
    update('education', form.education.filter((_, i) => i !== idx))
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(form) }}>

      {/* Import Section */}
      <div className="card" style={{ marginBottom: 24, background: 'rgba(79, 140, 255, 0.04)', border: '1px dashed rgba(79, 140, 255, 0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <span style={{ fontSize: '1.2rem' }}>📥</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>Import from Existing Resume</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Upload PDF or paste LaTeX — Gemini extracts your profile</div>
          </div>
        </div>

        {importError && <div className="auth-error" style={{ marginBottom: 12 }}>{importError}</div>}

        <div style={{ display: 'flex', gap: 8 }}>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            onChange={handlePdfImport}
            style={{ display: 'none' }}
            id="pdf-upload"
          />
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
          >
            {importing ? '⏳ Parsing...' : '📄 Upload PDF'}
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setShowLatexInput(!showLatexInput)}
            disabled={importing}
          >
            📝 Paste LaTeX
          </button>
        </div>

        {showLatexInput && (
          <div style={{ marginTop: 12 }}>
            <textarea
              className="form-textarea"
              value={latexCode}
              onChange={(e) => setLatexCode(e.target.value)}
              placeholder="Paste your LaTeX resume code here..."
              style={{ minHeight: 150, fontFamily: 'monospace', fontSize: '0.8rem' }}
            />
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleLatexImport}
              disabled={importing || !latexCode.trim()}
              style={{ marginTop: 8 }}
            >
              {importing ? '⏳ Parsing...' : '🚀 Parse LaTeX'}
            </button>
          </div>
        )}
      </div>

      {/* Basic Info */}
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Full Name</label>
          <input className="form-input" value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="John Doe" />
        </div>
        <div className="form-group">
          <label className="form-label">Email</label>
          <input className="form-input" type="email" value={form.email} onChange={(e) => update('email', e.target.value)} placeholder="john@example.com" />
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Phone</label>
          <input className="form-input" value={form.phone} onChange={(e) => update('phone', e.target.value)} placeholder="+1 234 567 8900" />
        </div>
        <div className="form-group">
          <label className="form-label">LinkedIn</label>
          <input className="form-input" value={form.linkedin} onChange={(e) => update('linkedin', e.target.value)} placeholder="https://linkedin.com/in/..." />
        </div>
      </div>

      {/* Skills */}
      <div className="form-group">
        <label className="form-label">Skills</label>
        <div className="tag-input-wrap">
          <input
            className="form-input"
            value={skillInput}
            onChange={(e) => setSkillInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSkill() } }}
            placeholder="Type skill and press Enter"
          />
          <button type="button" className="btn btn-secondary btn-sm" onClick={addSkill}>Add</button>
        </div>
        <div className="tags-container">
          {form.skills.map((s, i) => (
            <span className="tag" key={i}>
              {s}
              <span className="tag-remove" onClick={() => removeSkill(i)}>×</span>
            </span>
          ))}
        </div>
      </div>

      {/* Experience */}
      <div className="form-group">
        <label className="form-label">Work Experience</label>
        {form.experience.map((exp, idx) => (
          <div className="entry-card" key={idx}>
            <div className="entry-header">
              <span className="entry-number">Experience #{idx + 1}</span>
              <button type="button" className="btn btn-danger btn-sm" onClick={() => removeExp(idx)}>Remove</button>
            </div>
            <div className="form-row">
              <div className="form-group">
                <input className="form-input" value={exp.title} onChange={(e) => updateExp(idx, 'title', e.target.value)} placeholder="Job Title" />
              </div>
              <div className="form-group">
                <input className="form-input" value={exp.company} onChange={(e) => updateExp(idx, 'company', e.target.value)} placeholder="Company" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <input className="form-input" value={exp.start} onChange={(e) => updateExp(idx, 'start', e.target.value)} placeholder="Start (e.g., Jan 2023)" />
              </div>
              <div className="form-group">
                <input className="form-input" value={exp.end} onChange={(e) => updateExp(idx, 'end', e.target.value)} placeholder="End (e.g., Present)" />
              </div>
            </div>
            <label className="form-label" style={{ marginTop: 8 }}>Bullets (honest descriptions, Gemini will inflate)</label>
            <div className="bullets-list">
              {(exp.bullets || []).map((b, bi) => (
                <div className="bullet-row" key={bi}>
                  <input
                    className="form-input"
                    value={b}
                    onChange={(e) => updateExpBullet(idx, bi, e.target.value)}
                    placeholder="What you actually did"
                  />
                  <button type="button" className="btn btn-danger btn-sm" onClick={() => removeExpBullet(idx, bi)}>×</button>
                </div>
              ))}
            </div>
            <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 6 }} onClick={() => addExpBullet(idx)}>+ Add bullet</button>
          </div>
        ))}
        <button type="button" className="btn btn-secondary btn-sm" onClick={addExperience}>+ Add Experience</button>
      </div>

      {/* Projects */}
      <div className="form-group">
        <label className="form-label">Projects (honest descriptions — Gemini will make them sound FAANG-level)</label>
        {form.projects.map((proj, idx) => (
          <div className="entry-card" key={idx}>
            <div className="entry-header">
              <span className="entry-number">Project #{idx + 1}</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => moveProjUp(idx)} disabled={idx === 0}>↑</button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => moveProjDown(idx)} disabled={idx === form.projects.length - 1}>↓</button>
                <button type="button" className="btn btn-danger btn-sm" onClick={() => removeProj(idx)}>Remove</button>
              </div>
            </div>
            <div className="form-group">
              <input className="form-input" value={proj.name} onChange={(e) => updateProj(idx, 'name', e.target.value)} placeholder="Project name" />
            </div>
            <div className="form-group">
              <textarea
                className="form-textarea"
                value={proj.description}
                onChange={(e) => updateProj(idx, 'description', e.target.value)}
                placeholder="Honestly describe what the project does. e.g., 'A chatbot using OpenAI API for customer support' — Gemini will turn this into enterprise gold."
                rows={3}
              />
            </div>
            <div className="form-group">
              <input
                className="form-input"
                value={(proj.tech || []).join(', ')}
                onChange={(e) => updateProj(idx, 'tech', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                placeholder="Tech stack (comma separated): React, Python, PostgreSQL"
              />
            </div>
          </div>
        ))}
        <button type="button" className="btn btn-secondary btn-sm" onClick={addProject}>+ Add Project</button>
      </div>

      {/* Education */}
      <div className="form-group">
        <label className="form-label">Education</label>
        {form.education.map((edu, idx) => (
          <div className="entry-card" key={idx}>
            <div className="entry-header">
              <span className="entry-number">Education #{idx + 1}</span>
              <button type="button" className="btn btn-danger btn-sm" onClick={() => removeEdu(idx)}>Remove</button>
            </div>
            <div className="form-row">
              <div className="form-group">
                <input className="form-input" value={edu.degree} onChange={(e) => updateEdu(idx, 'degree', e.target.value)} placeholder="Degree (e.g., B.Tech CS)" />
              </div>
              <div className="form-group">
                <input className="form-input" value={edu.school} onChange={(e) => updateEdu(idx, 'school', e.target.value)} placeholder="School / University" />
              </div>
            </div>
            <div className="form-group">
              <input className="form-input" value={edu.year} onChange={(e) => updateEdu(idx, 'year', e.target.value)} placeholder="Year (e.g., 2024)" />
            </div>
          </div>
        ))}
        <button type="button" className="btn btn-secondary btn-sm" onClick={addEducation}>+ Add Education</button>
      </div>

      <div className="wizard-nav" style={{ marginTop: 24 }}>
        <div />
        <button type="submit" className="btn btn-primary btn-lg">
          Save Profile & Continue →
        </button>
      </div>
    </form>
  )
}
