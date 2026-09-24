const API = import.meta.env.VITE_API_URL || ''

async function apiFetch(path, options = {}) {
  const token = localStorage.getItem('token')
  const headers = { ...options.headers }

  // Only set Content-Type to JSON if not already set and body is a string (JSON payload)
  if (!headers['Content-Type'] && typeof options.body === 'string') {
    headers['Content-Type'] = 'application/json'
  }

  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${API}${path}`, { ...options, headers })

  if (res.status === 401) {
    localStorage.removeItem('token')
    localStorage.removeItem('email')
    window.location.href = '/login'
    throw new Error('Unauthorized')
  }

  if (!res.ok) {
    // Try to extract error detail from JSON response body
    let errorMessage = `Request failed (${res.status})`
    try {
      const contentType = res.headers.get('content-type') || ''
      if (contentType.includes('application/json')) {
        const err = await res.json()
        errorMessage = err.detail || errorMessage
      } else {
        const text = await res.text()
        errorMessage = text.slice(0, 500) || errorMessage
      }
    } catch {
      // If we can't parse the error body, use the status text
      errorMessage = res.statusText || errorMessage
    }
    throw new Error(errorMessage)
  }

  return res
}

export async function apiJson(path, options = {}) {
  const res = await apiFetch(path, options)
  return res.json()
}

export async function apiText(path, options = {}) {
  const res = await apiFetch(path, options)
  return res.text()
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
