import { useState } from 'react'
import { apiJson, apiBlob, apiText } from '../api'

export default function ProfileForm({ initialData, onNext }) {
  const [form, setForm] = useState({
    name: initialData?.name || '',
    email: initialData?.email || '',
    phone: initialData?.phone || '',
    linkedin: initialData?.linkedin || '',
    github: initialData?.github || '',
    skills: initialData?.skills || [],
    experience: initialData?.experience || [],
    education: initialData?.education || [],
    projects: initialData?.projects || [],
  })

  const [skillInput, setSkillInput] = useState('')
  const [importing, setImporting] = useState(false)
  const [enhancing, setEnhancing] = useState({ type: null, index: null, bulletIndex: null })

  // Basic update
  const update = (field, value) => setForm((p) => ({ ...p, [field]: value }))

  // Skills
  const addSkill = () => {
    if (!skillInput.trim()) return
    setForm((p) => ({ ...p, skills: [...p.skills, skillInput.trim()] }))
    setSkillInput('')
  }
  const removeSkill = (i) => {
    setForm((p) => ({ ...p, skills: p.skills.filter((_, idx) => idx !== i) }))
  }

  // Experience
  const addExperience = () => {
    setForm((p) => ({
      ...p,
      experience: [...p.experience, { title: '', company: '', start: '', end: '', bullets: [''] }],
    }))
  }
  const updateExp = (i, field, value) => {
    const newExp = [...form.experience]
    newExp[i][field] = value
    update('experience', newExp)
  }
  const addExpBullet = (i) => {
    const newExp = [...form.experience]
    newExp[i].bullets = [...(newExp[i].bullets || []), '']
    update('experience', newExp)
  }
  const updateExpBullet = (ei, bi, val) => {
    const newExp = [...form.experience]
    newExp[ei].bullets[bi] = val
    update('experience', newExp)
  }
  const removeExpBullet = (ei, bi) => {
    const newExp = [...form.experience]
    newExp[ei].bullets = newExp[ei].bullets.filter((_, idx) => idx !== bi)
    update('experience', newExp)
  }
  const removeExp = (i) => {
    setForm((p) => ({ ...p, experience: p.experience.filter((_, idx) => idx !== i) }))
  }

  // Projects
  const addProject = () => {
    setForm((p) => ({
      ...p,
      projects: [...p.projects, { name: '', description: '', tech: [], github_url: '', demo_url: '' }],
    }))
  }
  const updateProj = (i, field, value) => {
    const newProj = [...form.projects]
    newProj[i][field] = value
    update('projects', newProj)
  }
  const removeProj = (i) => {
    setForm((p) => ({ ...p, projects: p.projects.filter((_, idx) => idx !== i) }))
  }
  const moveProjUp = (i) => {
    if (i === 0) return
    const newProj = [...form.projects]
    const temp = newProj[i - 1]
    newProj[i - 1] = newProj[i]
    newProj[i] = temp
    update('projects', newProj)
  }
  const moveProjDown = (i) => {
    if (i === form.projects.length - 1) return
    const newProj = [...form.projects]
    const temp = newProj[i + 1]
    newProj[i + 1] = newProj[i]
    newProj[i] = temp
    update('projects', newProj)
  }

  // Education
  const addEducation = () => {
    setForm((p) => ({
      ...p,
      education: [...p.education, { degree: '', school: '', start: '', end: '', location: '', cgpa: '' }],
    }))
  }
  const updateEdu = (i, field, value) => {
    const newEdu = [...form.education]
    newEdu[i][field] = value
    update('education', newEdu)
  }
  const removeEdu = (i) => {
    setForm((p) => ({ ...p, education: p.education.filter((_, idx) => idx !== i) }))
  }

  // Import
  const handlePdfUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setImporting(true)
    const formData = new FormData()
    formData.append('file', file)
    try {
      const data = await apiJson('/api/profile/import-pdf', {
        method: 'POST',
        body: formData,
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      const newForm = {
        name: data.name || '',
        email: data.email || '',
        phone: data.phone || '',
        linkedin: data.linkedin || '',
        github: data.github || '',
        skills: data.skills || [],
        experience: data.experience || [],
        education: data.education || [],
        projects: data.projects || [],
      }
      setForm(newForm)

      const el = document.getElementById('resumeUpload')
      if (el) el.value = ''
    } catch (err) {
      alert(err.message)
    } finally {
      setImporting(false)
    }
  }

  const handleLatexUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setImporting(true)
    const formData = new FormData()
    formData.append('file', file)
    try {
      const data = await apiJson('/api/profile/import-latex', {
        method: 'POST',
        body: formData,
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      const newForm = {
        name: data.name || '',
        email: data.email || '',
        phone: data.phone || '',
        linkedin: data.linkedin || '',
        github: data.github || '',
        skills: data.skills || [],
        experience: data.experience || [],
        education: data.education || [],
        projects: data.projects || [],
      }
      setForm(newForm)

      const el = document.getElementById('latexUpload')
      if (el) el.value = ''
    } catch (err) {
      alert(err.message)
    } finally {
      setImporting(false)
    }
  }

  // AI Enhance
  const handleEnhance = async (type, index, bulletIndex, currentText) => {
      if (!currentText || !currentText.trim()) return;
      setEnhancing({ type, index, bulletIndex });
      try {
          const res = await apiJson('/api/enhance-text', {
              method: 'POST',
              body: JSON.stringify({ text: currentText }),
          });

          if (res.enhanced_text) {
              if (type === 'experience') {
                  updateExpBullet(index, bulletIndex, res.enhanced_text);
              } else if (type === 'project') {
                  updateProj(index, 'description', res.enhanced_text);
              }
          }
      } catch (err) {
          console.error("Enhance failed:", err);
          alert(err.message || 'Failed to enhance text');
      } finally {
          setEnhancing({ type: null, index: null, bulletIndex: null });
      }
  };

  const submitForm = async (e) => {
    e.preventDefault()
    try {
      const saved = await apiJson('/api/profile', {
        method: 'PUT',
        body: JSON.stringify(form)
      })
      onNext(saved)
    } catch (err) {
      alert(err.message)
    }
  }

  return (
    <form className="wizard-form" onSubmit={submitForm}>
      <h2 className="step-title">1. Your Profile Data</h2>
      <p className="step-desc">
        Fill in your actual info below. Gemini will format this into a stunning resume.
      </p>

      {/* Importers */}
      <div className="importer-section" style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative' }}>
          <input
            id="resumeUpload"
            type="file"
            accept=".pdf"
            onChange={handlePdfUpload}
            style={{ position: 'absolute', opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }}
            disabled={importing}
          />
          <button
            type="button"
            className="btn btn-secondary"
            disabled={importing}
            style={{ pointerEvents: 'none', padding: '12px 24px', borderRadius: 8 }}
          >
            {importing ? '⏳ Parsing...' : '📄 Import from PDF'}
          </button>
        </div>

        {/* Removed redundant raw text section for cleaner UI */}

        <div style={{ position: 'relative' }}>
          <input
            id="latexUpload"
            type="file"
            accept=".tex"
            onChange={handleLatexUpload}
            style={{ position: 'absolute', opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }}
            disabled={importing}
          />
          <button
            type="button"
            className="btn btn-secondary"
            disabled={importing}
            style={{ pointerEvents: 'none', padding: '12px 24px', borderRadius: 8 }}
          >
            {importing ? '⏳ Parsing...' : '🚀 Parse LaTeX'}
          </button>
        </div>
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
        <div className="form-group">
          <label className="form-label">GitHub</label>
          <input className="form-input" value={form.github} onChange={(e) => update('github', e.target.value)} placeholder="https://github.com/..." />
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
        <label className="form-label">WORK EXPERIENCE</label>
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
            <label className="form-label" style={{ marginTop: 8 }}>EXPERIENCE BULLETS</label>
            <div className="bullets-list">
              {(exp.bullets || []).map((b, bi) => (
                <div className="bullet-row" key={bi} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                  <textarea
                    className="form-input"
                    value={b}
                    onChange={(e) => updateExpBullet(idx, bi, e.target.value)}
                    placeholder="What you actually did"
                    rows={2}
                    style={{ flexGrow: 1, resize: 'vertical' }}
                  />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                     <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleEnhance('experience', idx, bi, b)}
                        disabled={enhancing.type !== null}
                        title="Enhance with AI"
                        style={{ padding: '4px 8px', width: '32px' }}
                     >
                        {enhancing.type === 'experience' && enhancing.index === idx && enhancing.bulletIndex === bi ? '⌛' : '✨'}
                     </button>
                     <button type="button" className="btn btn-danger btn-sm" onClick={() => removeExpBullet(idx, bi)} style={{ padding: '4px 8px', width: '32px' }}>×</button>
                  </div>
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
        <label className="form-label">Projects</label>
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
            <div className="form-row">
              <div className="form-group">
                <input className="form-input" value={proj.github_url || ''} onChange={(e) => updateProj(idx, 'github_url', e.target.value)} placeholder="GitHub URL (optional)" />
              </div>
              <div className="form-group">
                <input className="form-input" value={proj.demo_url || ''} onChange={(e) => updateProj(idx, 'demo_url', e.target.value)} placeholder="Live Demo URL (optional)" />
              </div>
            </div>
            <div className="form-group">
                <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                    <textarea
                        className="form-textarea"
                        value={proj.description}
                        onChange={(e) => updateProj(idx, 'description', e.target.value)}
                        placeholder="Honestly describe what the project does. e.g., 'A chatbot using OpenAI API for customer support' — Gemini will turn this into enterprise gold."
                        rows={3}
                        style={{ flexGrow: 1 }}
                    />
                     <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleEnhance('project', idx, null, proj.description)}
                        disabled={enhancing.type !== null}
                        title="Enhance with AI"
                        style={{ padding: '4px 8px', width: '32px', alignSelf: 'stretch' }}
                     >
                        {enhancing.type === 'project' && enhancing.index === idx ? '⌛' : '✨'}
                     </button>
                </div>
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
            <div className="form-row">
              <div className="form-group">
                <input className="form-input" value={edu.start || ''} onChange={(e) => updateEdu(idx, 'start', e.target.value)} placeholder="Start Date (e.g., Aug 2023)" />
              </div>
              <div className="form-group">
                <input className="form-input" value={edu.end || ''} onChange={(e) => updateEdu(idx, 'end', e.target.value)} placeholder="End Date (e.g., May 2027)" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <input className="form-input" value={edu.location || ''} onChange={(e) => updateEdu(idx, 'location', e.target.value)} placeholder="Location (e.g., Punjab, India)" />
              </div>
              <div className="form-group">
                <input className="form-input" value={edu.cgpa || ''} onChange={(e) => updateEdu(idx, 'cgpa', e.target.value)} placeholder="CGPA (e.g., 8.64/10)" />
              </div>
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
