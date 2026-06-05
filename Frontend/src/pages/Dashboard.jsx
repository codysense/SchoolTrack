import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useTerm } from '../context/TermContext'
import { Spinner, ErrorMessage } from '../components/ui'
import TeacherDashboard from './TeacherDashboard'

function StatCard({ label, value, color = '#4f8ef7', sub, small }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 10,
      padding: small ? '14px 16px' : '18px 22px',
      boxShadow: '0 1px 4px rgba(0,0,0,.06)',
      borderTop: `3px solid ${color}`
    }}>
      <p style={{ margin: 0, fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</p>
      <p style={{ margin: '5px 0 0', fontSize: small ? 18 : 22, fontWeight: 700, color: '#1a1f36' }}>{value}</p>
      {sub && <p style={{ margin: '3px 0 0', fontSize: 11, color: '#9ca3af' }}>{sub}</p>}
    </div>
  )
}

function SectionLabel({ children, action }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '22px 0 10px' }}>
      <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.08em' }}>
        {children}
      </p>
      {action}
    </div>
  )
}

export default function Dashboard() {
  const { isAdmin } = useAuth()
  if (!isAdmin) return <TeacherDashboard />

  const { currentTerm, sessions, termLabel } = useTerm()
  const [selectedTermId, setSelectedTermId] = useState(null)
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  // Use current term by default when it loads
  useEffect(() => {
    if (currentTerm && !selectedTermId) setSelectedTermId(currentTerm.id)
  }, [currentTerm])

  useEffect(() => {
    if (selectedTermId === undefined) return
    setLoading(true)
    const url = selectedTermId ? `/payments/summary?termId=${selectedTermId}` : '/payments/summary'
    api(url)
      .then(setSummary)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [selectedTermId])

  const fmt = n => `₦${Number(n || 0).toLocaleString()}`

  // Flatten all terms for the selector
  const allTerms = sessions.flatMap(s => s.terms.map(t => ({ ...t, sessionName: s.name })))

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0 }}>Dashboard</h2>
          <p style={{ margin: '3px 0 0', fontSize: 13, color: '#6b7280' }}>{termLabel}</p>
        </div>

        {/* Term selector */}
        <select
          value={selectedTermId || ''}
          onChange={e => setSelectedTermId(e.target.value || null)}
          style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, background: '#fff', minWidth: 200 }}
        >
          <option value="">All time</option>
          {allTerms.map(t => (
            <option key={t.id} value={t.id}>
              {t.sessionName} — {t.name}{t.isCurrent ? ' ✓' : ''}
            </option>
          ))}
        </select>
      </div>

      <ErrorMessage message={error} />

      {loading ? <Spinner /> : summary && (
        <>
          {/* No active term warning */}
          {!currentTerm && (
            <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#92400e' }}>
              ⚠ No active term set. Go to <strong>Sessions</strong> and click "Set Active" on a term before recording payments or results.
            </div>
          )}

          {/* Enrolment */}
          <div style={{ background: '#1a1f36', borderRadius: 12, padding: '18px 24px', marginBottom: 4, display: 'inline-flex', alignItems: 'center', gap: 14 }}>
            <span style={{ fontSize: 28 }}>👥</span>
            <div>
              <p style={{ margin: 0, fontSize: 11, color: '#8891b4', textTransform: 'uppercase', letterSpacing: '.04em' }}>Active Students</p>
              <p style={{ margin: '3px 0 0', fontSize: 34, fontWeight: 800, color: '#fff' }}>{summary.totalStudents}</p>
            </div>
          </div>

          {/* School fees */}
          <SectionLabel>School Fees</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(165px, 1fr))', gap: 12 }}>
            <StatCard label="Expected"    value={fmt(summary.schoolFeeExpected)}    color="#6366f1" />
            <StatCard label="Collected"   value={fmt(summary.schoolFeeCollected)}   color="#10b981" />
            <StatCard label="Outstanding" value={fmt(summary.schoolFeeOutstanding)} color="#f59e0b"
              sub={summary.schoolFeeOutstanding > 0 ? 'Needs follow-up' : '✓ All clear'} />
          </div>

          {/* Per-optional-fee cards — dynamic, one card per fee type */}
          {summary.optFeeSummary.length > 0 && (
            <>
              <SectionLabel>Optional Fees & Levies</SectionLabel>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
                {summary.optFeeSummary.map(fee => (
                  <div key={fee.id} style={{
                    background: '#fff', borderRadius: 10,
                    padding: '16px 18px', boxShadow: '0 1px 4px rgba(0,0,0,.06)',
                    borderLeft: '4px solid #f59e0b'
                  }}>
                    <p style={{ margin: '0 0 2px', fontSize: 13, fontWeight: 700, color: '#1a1f36' }}>{fee.name}</p>
                    <p style={{ margin: '0 0 10px', fontSize: 11, color: '#9ca3af' }}>{fee.assignCount} student{fee.assignCount !== 1 ? 's' : ''} assigned</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <div>
                        <p style={{ margin: 0, fontSize: 10, color: '#9ca3af', textTransform: 'uppercase' }}>Expected</p>
                        <p style={{ margin: '2px 0 0', fontSize: 14, fontWeight: 700 }}>{fmt(fee.expected)}</p>
                      </div>
                      <div>
                        <p style={{ margin: 0, fontSize: 10, color: '#9ca3af', textTransform: 'uppercase' }}>Collected</p>
                        <p style={{ margin: '2px 0 0', fontSize: 14, fontWeight: 700, color: '#10b981' }}>{fmt(fee.collected)}</p>
                      </div>
                    </div>
                    {/* Mini progress bar */}
                    <div style={{ marginTop: 10 }}>
                      <div style={{ background: '#f3f4f6', borderRadius: 4, height: 5, overflow: 'hidden' }}>
                        <div style={{
                          width: fee.expected > 0 ? `${Math.min(100, (fee.collected / fee.expected) * 100)}%` : '0%',
                          height: '100%', background: fee.outstanding <= 0 ? '#10b981' : '#f59e0b', borderRadius: 4
                        }} />
                      </div>
                      <p style={{ margin: '4px 0 0', fontSize: 11, color: fee.outstanding > 0 ? '#f59e0b' : '#10b981', fontWeight: 600 }}>
                        {fee.outstanding > 0 ? `${fmt(fee.outstanding)} outstanding` : '✓ Fully collected'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Combined totals */}
          <SectionLabel>Combined Totals</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(165px, 1fr))', gap: 12, marginBottom: 28 }}>
            <StatCard label="Total Expected"    value={fmt(summary.totalExpected)}    color="#374151" />
            <StatCard label="Total Collected"   value={fmt(summary.totalCollected)}   color="#10b981" />
            <StatCard label="Total Outstanding" value={fmt(summary.totalOutstanding)} color="#dc2626"
              sub={summary.totalOutstanding <= 0 ? '✓ All clear' : undefined} />
          </div>

          {/* Recent payments */}
          <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>Recent School Fee Payments</h3>
          <div style={{ background: '#fff', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  {['Student', 'Class', 'Amount', 'Method', 'Date'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: '#374151', fontWeight: 600, fontSize: 13 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(summary.recentPayments || []).map(p => (
                  <tr key={p.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '10px 14px', fontWeight: 500 }}>{p.student.name}</td>
                    <td style={{ padding: '10px 14px', color: '#6b7280' }}>{p.student.class.className}</td>
                    <td style={{ padding: '10px 14px', fontWeight: 600, color: '#10b981' }}>{fmt(p.amountPaid)}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ background: '#eff6ff', color: '#2563eb', padding: '2px 8px', borderRadius: 12, fontSize: 12 }}>{p.paymentMethod}</span>
                    </td>
                    <td style={{ padding: '10px 14px', color: '#6b7280', fontSize: 13 }}>{new Date(p.date).toLocaleDateString()}</td>
                  </tr>
                ))}
                {!summary.recentPayments?.length && (
                  <tr><td colSpan={5} style={{ padding: '32px 16px', textAlign: 'center', color: '#9ca3af' }}>No payments for this term</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
