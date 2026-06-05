import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { Spinner, ErrorMessage } from '../components/ui'

export default function TeacherDashboard() {
  const { user } = useAuth()
  const [students, setStudents] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)

  const classId = user?.teacher?.classId

  useEffect(() => {
    const url = classId ? `/students?classId=${classId}` : '/students'
    api(url)
      .then(setStudents)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [classId])

  if (loading) return <Spinner />

  const className = user?.teacher?.class?.className || 'All Classes'

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>
        Welcome, {user?.name}
        <span style={{ fontSize: 14, fontWeight: 400, color: '#6b7280', marginLeft: 10 }}>
          {user?.teacher?.subjectName ? `· ${user.teacher.subjectName}` : ''}
        </span>
      </h2>

      <ErrorMessage message={error} />

      {/* Class summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 28 }}>
        {[
          { label: `Students in ${className}`, value: students.length, color: '#4f8ef7' },
          { label: 'Students with Results',    value: students.filter(s => s.results?.length > 0).length, color: '#10b981' },
        ].map(c => (
          <div key={c.label} style={{ background: '#fff', borderRadius: 10, padding: '18px 20px', boxShadow: '0 1px 4px rgba(0,0,0,.06)', borderTop: `3px solid ${c.color}` }}>
            <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>{c.label}</p>
            <p style={{ margin: '6px 0 0', fontSize: 28, fontWeight: 700, color: '#1a1f36' }}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Student list — no payment data shown */}
      <h3 style={{ margin: '0 0 12px' }}>{className} — Students</h3>
      <div style={{ background: '#fff', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: '#f9fafb' }}>
              {['Admission No.', 'Name', 'Class'].map(h => (
                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#374151' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {students.map(s => (
              <tr key={s.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontSize: 13, color: '#6b7280' }}>{s.admissionNumber}</td>
                <td style={{ padding: '10px 16px', fontWeight: 500 }}>{s.name}</td>
                <td style={{ padding: '10px 16px', color: '#6b7280' }}>{s.class.className}</td>
              </tr>
            ))}
            {students.length === 0 && (
              <tr><td colSpan={3} style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>No students found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
