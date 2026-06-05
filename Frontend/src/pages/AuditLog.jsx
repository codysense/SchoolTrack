import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { Spinner, ErrorMessage, Badge, inputStyle } from '../components/ui'

const ACTION_COLORS = {
  CREATE: 'green',
  UPDATE: 'blue',
  DELETE: 'red',
  LOGIN:  'gray',
  REMIND: 'yellow',
}

const ENTITIES = ['Student', 'Payment', 'OptionalFee', 'OptionalFeeAssign', 'OptionalFeePayment',
                  'Result', 'Subject', 'Class', 'Session', 'Term', 'User', 'School']

export default function AuditLog() {
  const [logs,    setLogs]    = useState([])
  const [actors,  setActors]  = useState([])
  const [total,   setTotal]   = useState(0)
  const [pages,   setPages]   = useState(1)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  const [filters, setFilters] = useState({ userId: '', entity: '', action: '', from: '', to: '', page: 1 })

  const load = (f = filters) => {
    setLoading(true)
    const params = new URLSearchParams()
    Object.entries(f).forEach(([k, v]) => { if (v) params.set(k, v) })
    Promise.all([
      api(`/audit?${params}`),
      api('/audit/actors')
    ])
      .then(([data, a]) => { setLogs(data.logs); setTotal(data.total); setPages(data.pages); setActors(a) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const setFilter = (key, value) => {
    const next = { ...filters, [key]: value, page: 1 }
    setFilters(next)
    load(next)
  }

  const setPage = p => {
    const next = { ...filters, page: p }
    setFilters(next)
    load(next)
  }

  const actionColor = a => ACTION_COLORS[a] || 'gray'

  const roleColor = r => ({ ADMIN: 'blue', TEACHER: 'green', STUDENT: 'yellow' }[r] || 'gray')

  return (
    <div>
      <h2 style={{ marginTop: 0, marginBottom: 6 }}>Audit Log</h2>
      <p style={{ margin: '0 0 20px', fontSize: 13, color: '#6b7280' }}>
        Every action in the system is recorded here — who did what, and when.
      </p>

      <ErrorMessage message={error} />

      {/* Filters */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
        <select value={filters.userId} onChange={e => setFilter('userId', e.target.value)} style={{ ...inputStyle, maxWidth: 190, fontSize: 13, padding: '7px 10px' }}>
          <option value="">All users</option>
          {actors.map(a => <option key={a.userId || a.userName} value={a.userId || ''}>{a.userName} ({a.userRole})</option>)}
        </select>

        <select value={filters.entity} onChange={e => setFilter('entity', e.target.value)} style={{ ...inputStyle, maxWidth: 170, fontSize: 13, padding: '7px 10px' }}>
          <option value="">All entities</option>
          {ENTITIES.map(e => <option key={e} value={e}>{e}</option>)}
        </select>

        <select value={filters.action} onChange={e => setFilter('action', e.target.value)} style={{ ...inputStyle, maxWidth: 140, fontSize: 13, padding: '7px 10px' }}>
          <option value="">All actions</option>
          {['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'REMIND'].map(a => <option key={a} value={a}>{a}</option>)}
        </select>

        <input type="date" value={filters.from} onChange={e => setFilter('from', e.target.value)}
          style={{ ...inputStyle, maxWidth: 155, fontSize: 13, padding: '7px 10px' }} placeholder="From date" />
        <input type="date" value={filters.to} onChange={e => setFilter('to', e.target.value)}
          style={{ ...inputStyle, maxWidth: 155, fontSize: 13, padding: '7px 10px' }} placeholder="To date" />

        <button onClick={() => { const f = { userId: '', entity: '', action: '', from: '', to: '', page: 1 }; setFilters(f); load(f) }}
          style={{ padding: '7px 14px', border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', fontSize: 13, cursor: 'pointer', color: '#6b7280' }}>
          Clear
        </button>
      </div>

      <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 10px' }}>{total} records</p>

      {/* Table */}
      <div style={{ background: '#fff', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
        {loading ? <Spinner /> : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                {['When', 'User', 'Role', 'Action', 'Entity', 'Detail'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, fontSize: 12, color: '#374151', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <tr key={log.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '9px 14px', color: '#6b7280', whiteSpace: 'nowrap', fontSize: 12 }}>
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                  <td style={{ padding: '9px 14px', fontWeight: 500 }}>{log.userName}</td>
                  <td style={{ padding: '9px 14px' }}>
                    <Badge label={log.userRole} color={roleColor(log.userRole)} />
                  </td>
                  <td style={{ padding: '9px 14px' }}>
                    <Badge label={log.action} color={actionColor(log.action)} />
                  </td>
                  <td style={{ padding: '9px 14px', color: '#6b7280' }}>{log.entity}</td>
                  <td style={{ padding: '9px 14px', maxWidth: 300, color: '#374151' }}>{log.detail || '—'}</td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr><td colSpan={6} style={{ padding: '40px 14px', textAlign: 'center', color: '#9ca3af' }}>No audit records match your filters</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div style={{ display: 'flex', gap: 6, marginTop: 16, justifyContent: 'center' }}>
          <button onClick={() => setPage(filters.page - 1)} disabled={filters.page <= 1}
            style={{ padding: '6px 14px', border: '1px solid #d1d5db', borderRadius: 7, background: '#fff', cursor: 'pointer', fontSize: 13 }}>
            ←
          </button>
          {Array.from({ length: Math.min(pages, 7) }, (_, i) => i + 1).map(p => (
            <button key={p} onClick={() => setPage(p)}
              style={{ padding: '6px 12px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 13, cursor: 'pointer',
                background: filters.page === p ? '#4f8ef7' : '#fff',
                color: filters.page === p ? '#fff' : '#374151' }}>
              {p}
            </button>
          ))}
          <button onClick={() => setPage(filters.page + 1)} disabled={filters.page >= pages}
            style={{ padding: '6px 14px', border: '1px solid #d1d5db', borderRadius: 7, background: '#fff', cursor: 'pointer', fontSize: 13 }}>
            →
          </button>
        </div>
      )}
    </div>
  )
}
