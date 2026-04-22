export default function JDInput({ value, onChange }) {
  return (
    <div className="form-group">
      <label className="form-label">Job Description</label>
      <textarea
        id="jd-textarea"
        className="form-textarea"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Paste the full job description here. Include requirements, responsibilities, qualifications — everything. The more detail, the better Gemini can tailor your resume."
        style={{ minHeight: '300px', fontSize: '0.9rem', lineHeight: '1.6' }}
      />
      <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 6 }}>
        {value.length > 0 ? `${value.split(/\s+/).filter(Boolean).length} words` : 'Paste a JD to get started'}
      </p>
    </div>
  )
}
