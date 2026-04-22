import { useState, useEffect, createContext, useContext } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Generator from './pages/Generator'

const AuthContext = createContext(null)

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

function AppHeader() {
  const { isLoggedIn, email, logout } = useAuth()
  const navigate = useNavigate()

  if (!isLoggedIn) return null

  return (
    <header className="app-header">
      <div className="app-logo" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
        ResumeForge
      </div>
      <div className="app-header-actions">
        <span className="user-email">{email}</span>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')}>Dashboard</button>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/generate')}>Generate</button>
        <button className="btn btn-danger btn-sm" onClick={() => { logout(); navigate('/login') }}>Logout</button>
      </div>
    </header>
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
