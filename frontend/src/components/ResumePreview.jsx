export default function ResumePreview({ resume, name, email, phone, linkedin }) {
  if (!resume) return null

  return (
    <div className="preview-container">
      {/* Header */}
      {name && <div className="preview-name">{name}</div>}
      <div className="preview-contact">
        {[email, phone, linkedin].filter(Boolean).join(' | ')}
      </div>

      {/* Professional Summary */}
      {resume.summary && (
        <>
          <div className="preview-section-title">Professional Summary</div>
          <p style={{ fontSize: '0.85rem', color: '#333', lineHeight: '1.6' }}>{resume.summary}</p>
        </>
      )}

      {/* Work Experience */}
      {resume.experience?.length > 0 && (
        <>
          <div className="preview-section-title">Work Experience</div>
          {resume.experience.map((exp, i) => (
            <div key={i} style={{ marginBottom: 12 }}>
              <div className="preview-exp-header">
                <span className="preview-exp-title">{exp.title} — {exp.company}</span>
                <span className="preview-exp-date">{exp.start} – {exp.end}</span>
              </div>
              {exp.bullets?.map((b, j) => (
                <div className="preview-bullet" key={j}>{b}</div>
              ))}
            </div>
          ))}
        </>
      )}

      {/* Projects */}
      {resume.projects?.length > 0 && (
        <>
          <div className="preview-section-title">Projects</div>
          {resume.projects.map((proj, i) => (
            <div key={i} style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                {proj.name}
                {proj.tech?.length > 0 && (
                  <span style={{ fontWeight: 400, fontStyle: 'italic', color: '#888', marginLeft: 8 }}>
                    [{proj.tech.join(', ')}]
                  </span>
                )}
              </div>
              {proj.bullets?.map((b, j) => (
                <div className="preview-bullet" key={j}>{b}</div>
              ))}
            </div>
          ))}
        </>
      )}

      {/* Technical Skills */}
      {resume.skills && (
        <>
          <div className="preview-section-title">Technical Skills</div>
          {typeof resume.skills === 'object' && !Array.isArray(resume.skills) ? (
            Object.entries(resume.skills).map(([cat, items]) => (
              items?.length > 0 && (
                <div className="preview-skills-row" key={cat}>
                  <strong>{cat.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}:</strong>{' '}
                  {items.join(', ')}
                </div>
              )
            ))
          ) : Array.isArray(resume.skills) ? (
            <div className="preview-skills-row">{resume.skills.join(', ')}</div>
          ) : null}
        </>
      )}

      {/* Education */}
      {resume.education?.length > 0 && (
        <>
          <div className="preview-section-title">Education</div>
          {resume.education.map((edu, i) => (
            <div key={i} style={{ marginBottom: 4 }}>
              <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{edu.degree}</span>
              {' — '}{edu.school}
              {edu.year && <span style={{ fontStyle: 'italic', color: '#888', marginLeft: 8 }}>({edu.year})</span>}
            </div>
          ))}
        </>
      )}
    </div>
  )
}
