import { createContext, useContext, useEffect, useState } from 'react'
import { api } from '../api/client'

const TermContext = createContext()

export function TermProvider({ children }) {
  const [currentTerm, setCurrentTerm] = useState(null)   // { id, name, session: { name } }
  const [sessions,    setSessions]    = useState([])
  const [loading,     setLoading]     = useState(true)

  const refresh = () => {
    Promise.all([
      api('/sessions/current-term').catch(() => null),
      api('/sessions').catch(() => [])
    ]).then(([term, sess]) => {
      setCurrentTerm(term)
      setSessions(sess)
    }).finally(() => setLoading(false))
  }

  useEffect(() => { refresh() }, [])

  const termLabel = currentTerm
    ? `${currentTerm.session?.name || ''} ${currentTerm.name}`
    : 'No active term'

  return (
    <TermContext.Provider value={{ currentTerm, sessions, loading, refresh, termLabel }}>
      {children}
    </TermContext.Provider>
  )
}

export const useTerm = () => useContext(TermContext)
