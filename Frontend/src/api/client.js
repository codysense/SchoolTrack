const BASE = import.meta.env.VITE_API_URL || '/api'

export async function api(path, options = {}) {
  const token = localStorage.getItem('token')

  const res = await fetch(`${BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` })
    },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined
  })

  // Handle auth expiry globally
  if (res.status === 401) {
    localStorage.clear()
    window.location.href = '/login'
    throw new Error('Session expired')
  }

  // Try to parse JSON — fall back to status text
  let data
  const contentType = res.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    data = await res.json()
  } else {
    data = { error: await res.text() || res.statusText }
  }

  if (!res.ok) {
    throw new Error(data?.error || `Request failed (${res.status})`)
  }

  return data
}
