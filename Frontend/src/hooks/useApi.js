import { useState, useEffect, useCallback } from 'react'
import { api } from '../api/client'

/**
 * useApi(path, deps?)
 * Fetches data on mount (and whenever deps change).
 * Returns { data, loading, error, refetch }
 *
 * Usage:
 *   const { data: students, loading, error, refetch } = useApi('/students')
 */
export function useApi(path, deps = []) {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  const fetch_ = useCallback(() => {
    setLoading(true)
    setError(null)
    api(path)
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, ...deps])

  useEffect(() => { fetch_() }, [fetch_])

  return { data, loading, error, refetch: fetch_ }
}

/**
 * useSubmit()
 * Returns { submit, submitting, error, clearError }
 * For POST / PUT / DELETE actions in forms.
 *
 * Usage:
 *   const { submit, submitting, error } = useSubmit()
 *   await submit(() => api('/students', { method: 'POST', body: form }))
 */
export function useSubmit() {
  const [submitting, setSubmitting] = useState(false)
  const [error,      setError]      = useState(null)

  const submit = useCallback(async (fn, onSuccess) => {
    setSubmitting(true)
    setError(null)
    try {
      const result = await fn()
      if (onSuccess) onSuccess(result)
      return result
    } catch (e) {
      setError(e.message)
      throw e
    } finally {
      setSubmitting(false)
    }
  }, [])

  return { submit, submitting, error, clearError: () => setError(null) }
}
