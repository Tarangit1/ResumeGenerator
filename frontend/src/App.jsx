import { useState, useEffect, createContext, useContext, useRef } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Generator from './pages/Generator'

const AuthContext = createContext(null)
const DEFAULT_MODEL = 'meta/llama-3.2-11b-vision-instruct'
const API = import.meta.env.VITE_API_URL || ''

export function useAuth() {
  return useContext(AuthContext)
}

function AuthProvider({ children }) {
  const [token, setToken] = useState(localStorage.getItem('token'))
  const [email, setEmail] = useState(localStorage.getItem('email') || '')

  const login = (t, e) => {
    setToken(t)
    setEmail(e)
    localStorage.setItem('token', t)
    localStorage.setItem('email', e)
  }

  const logout = () => {
    setToken(null)
    setEmail('')
    localStorage.removeItem('token')
    localStorage.removeItem('email')
  }

  return (
    <AuthContext.Provider value={{ token, email, login, logout, isLoggedIn: !!token }}>
      {children}
    </AuthContext.Provider>
  )
}

function ProtectedRoute({ children }) {
  const { isLoggedIn } = useAuth()
  return isLoggedIn ? children : <Navigate to="/login" />
}

function ModelSettingsModal({ onClose }) {
  const { token } = useAuth()
  const [modelInput, setModelInput] = useState(
    localStorage.getItem('nvidiaModelId') || DEFAULT_MODEL
  )
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null) // { ok, reply } or { error }

  const handleSave = () => {
    const val = modelInput.trim()
    if (val) {
      localStorage.setItem('nvidiaModelId', val)
    } else {
      localStorage.removeItem('nvidiaModelId')
    }
    onClose()
  }

  const handleReset = () => {
    setModelInput(DEFAULT_MODEL)
    localStorage.removeItem('nvidiaModelId')
    setTestResult(null)
  }

  const handleTest = async () => {
    const model = modelInput.trim() || DEFAULT_MODEL
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch(`${API}/api/model/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ model_id: model }),
      })
      const data = await res.json()
      if (!res.ok) {
        setTestResult({ error: data.detail || 'Test failed' })
      } else {
        setTestResult({ ok: true, reply: data.reply })
      }
    } catch (e) {
      setTestResult({ error: e.message })
    } finally {
      setTesting(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: 'var(--surface)', borderRadius: 'var(--radius)',
        border: '1px solid var(--border)', padding: '28px',
        width: '100%', maxWidth: '480px', boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>⚙️ Model Settings</h2>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1.2rem', lineHeight: 1 }}
          >×</button>
        </div>

        <div style={{ marginBottom: 8 }}>
          <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
            NVIDIA NIM MODEL ID
          </label>
          <input
            className="form-input"
            value={modelInput}
            onChange={(e) => { setModelInput(e.target.value); setTestResult(null) }}
            placeholder={DEFAULT_MODEL}
            style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}
          />
          <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 5 }}>
            Default: <code style={{ fontSize: '0.72rem' }}>{DEFAULT_MODEL}</code>
          </p>
        </div>

        {testResult && (
          <div style={{
            padding: '10px 12px', borderRadius: 'var(--radius-sm)', marginBottom: 14,
            background: testResult.ok ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
            border: `1px solid ${testResult.ok ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
            fontSize: '0.82rem',
            color: testResult.ok ? 'var(--success)' : 'var(--accent)',
          }}>
            {testResult.ok
              ? `✅ Model OK — replied: "${testResult.reply}"`
              : `❌ ${testResult.error}`}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={handleTest}
            disabled={testing}
            style={{ flex: 1 }}
          >
            {testing ? '⏳ Testing...' : '🔌 Test Model'}
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={handleReset}
          >
            Reset
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={handleSave}
            style={{ flex: 1 }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

function AppHeader() {
  const { isLoggedIn, email, logout } = useAuth()
  const navigate = useNavigate()
  const [showSettings, setShowSettings] = useState(false)

  if (!isLoggedIn) return null

  return (
    <>
      <header className="app-header">
        <div className="app-logo" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
          ResumeForge
        </div>
        <div className="app-header-actions">
          <span className="user-email">{email}</span>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')}>Dashboard</button>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/generate')}>Generate</button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setShowSettings(true)}
            title="Model Settings"
            style={{ fontSize: '0.78rem', padding: '4px 8px' }}
          >
            ⚙️ Model
          </button>
          <button className="btn btn-danger btn-sm" onClick={() => { logout(); navigate('/login') }}>Logout</button>
        </div>
      </header>
      {showSettings && <ModelSettingsModal onClose={() => setShowSettings(false)} />}
    </>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="app-container">
          <AppHeader />
          <div className="main-content">
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/generate" element={<ProtectedRoute><Generator /></ProtectedRoute>} />
            </Routes>
          </div>
        </div>
      </AuthProvider>
    </BrowserRouter>
  )
}
