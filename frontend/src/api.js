const API = import.meta.env.VITE_API_URL || ''

async function apiFetch(path, options = {}) {
  const token = localStorage.getItem('token')
  const headers = { 'Content-Type': 'application/json', ...options.headers }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${API}${path}`, { ...options, headers })

  if (res.status === 401) {
    localStorage.removeItem('token')
    localStorage.removeItem('email')
    window.location.href = '/login'
    throw new Error('Unauthorized')
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Request failed' }))
    throw new Error(err.detail || 'Request failed')
  }

  return res
}

export async function apiJson(path, options = {}) {
  const res = await apiFetch(path, options)
  return res.json()
}

export async function apiBlob(path, options = {}) {
  const res = await apiFetch(path, options)
  return res.blob()
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
