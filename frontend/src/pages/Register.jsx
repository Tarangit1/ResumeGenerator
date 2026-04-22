import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../App'
import { apiJson } from '../api'

export default function Register() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    setLoading(true)
    try {
      const data = await apiJson('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })
      login(data.token, data.email)
      navigate('/')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1 className="auth-title">Create Account</h1>
        <p className="auth-subtitle">Start generating killer resumes.</p>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              id="register-email"
              type="email"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              id="register-password"
              type="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min 6 characters"
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Confirm Password</label>
            <input
              id="register-confirm"
              type="password"
              className="form-input"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>
          <button
            id="register-submit"
            type="submit"
            className="btn btn-primary btn-lg"
            style={{ width: '100%' }}
            disabled={loading}
          >
            {loading ? 'Creating...' : 'Create Account'}
          </button>
        </form>

        <div className="auth-footer">
          Already have an account? <Link to="/login">Sign in</Link>
        </div>
      </div>
    </div>
  )
}
