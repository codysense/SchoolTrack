import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { useTerm } from '../context/TermContext'
import Modal from '../components/Modal'
import { Spinner, ErrorMessage, Badge, ActionButton, FormField, inputStyle } from '../components/ui'

const METHODS = ['cash', 'transfer', 'card', 'POS']

export default function OptionalFees() {
  const { currentTerm, sessions } = useTerm()

  const [fees,     setFees]     = useState([])
  const [students, setStudents] = useState([])
  const [assigns,  setAssigns]  = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)
  const [tab,      setTab]      = useState('types')

  // Modals
  const [feeModal,    setFeeModal]    = useState(null)
  const [assignModal, setAssignModal] = useState(false)
  const [payModal,    setPayModal]    = useState(null)

  const [feeForm,    setFeeForm]    = useState({ name: '', amount: '', description: '' })
  const [assignForm, setAssignForm] = useState({ optionalFeeId: '', studentIds: [], termId: '' })
  const [payForm,    setPayForm]    = useState({ amountPaid: '', paymentMethod: 'cash', note: '' })
  const [saving,     setSaving]     = useState(false)
  const [formErr,    setFormErr]    = useState('')
  const [filterTermId, setFilterTermId] = useState('')

  const allTerms = sessions.flatMap(s =>
    s.terms.map(t => ({ ...t, sessionName: s.name, label: `${s.name} — ${t.name}${t.isCurrent ? ' ✓' : ''}` }))
  )

  const load = () => {
    setLoading(true)
    const assignUrl = filterTermId
      ? `/optional-fees/assigns?termId=${filterTermId}`
      : '/optional-fees/assigns'
    Promise.all([
      api('/optional-fees/types'),
      api('/students'),
      api(assignUrl)
    ])
      .then(([f, s, a]) => { setFees(f); setStudents(s); setAssigns(a) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [filterTermId])

  // ── Fee type actions ────────────────────────────────────────────────────────
  const openFeeCreate = () => {
    setFeeForm({ name: '', amount: '', description: '' })
    setFormErr(''); setFeeModal('create')
  }
  const openFeeEdit = f => {
    setFeeForm({ name: f.name, amount: f.amount, description: f.description || '' })
    setFormErr(''); setFeeModal(f)
  }

  const saveFee = async () => {
    if (!feeForm.name.trim())                   return setFormErr('Name is required')
    if (!feeForm.amount || isNaN(feeForm.amount)) return setFormErr('Valid amount is required')
    setSaving(true)
    try {
      if (feeModal === 'create') {
        await api('/optional-fees/types', { method: 'POST', body: feeForm })
      } else {
        await api(`/optional-fees/types/${feeModal.id}`, { method: 'PUT', body: feeForm })
      }
      setFeeModal(null); load()
    } catch (e) { setFormErr(e.message) }
    finally { setSaving(false) }
  }

  const deleteFee = async id => {
    if (!confirm('Delete this fee type? All assignments will also be removed.')) return
    await api(`/optional-fees/types/${id}`, { method: 'DELETE' }).catch(e => alert(e.message))
    load()
  }

  // ── Assign actions ──────────────────────────────────────────────────────────
  const openAssign = () => {
    setAssignForm({ optionalFeeId: '', studentIds: [], termId: currentTerm?.id || '' })
    setFormErr(''); setAssignModal(true)
  }

  const saveAssign = async () => {
    if (!assignForm.optionalFeeId)         return setFormErr('Select a fee type')
    if (!assignForm.termId)                return setFormErr('Select a term')
    if (!assignForm.studentIds.length)     return setFormErr('Select at least one student')
    setSaving(true)
    try {
      const res = await api('/optional-fees/assigns', { method: 'POST', body: assignForm })
      alert(res.message)
      setAssignModal(false); load()
    } catch (e) { setFormErr(e.message) }
    finally { setSaving(false) }
  }

  const deleteAssign = async id => {
    if (!confirm('Remove this fee assignment?')) return
    await api(`/optional-fees/assigns/${id}`, { method: 'DELETE' }).catch(e => alert(e.message))
    load()
  }

  // ── Payment actions ─────────────────────────────────────────────────────────
  const openPay = a => {
    setPayForm({ amountPaid: '', paymentMethod: 'cash', note: '' })
    setFormErr(''); setPayModal(a)
  }

  const savePay = async () => {
    if (!payForm.amountPaid) return setFormErr('Enter amount')
    const amt = parseFloat(payForm.amountPaid)
    if (amt <= 0)            return setFormErr('Amount must be greater than 0')
    if (amt > payModal.balance + 0.01) return setFormErr(`Max payable is ₦${payModal.balance.toLocaleString()}`)
    setSaving(true)
    try {
      await api('/optional-fees/payments', {
        method: 'POST',
        body: {
          optionalFeeAssignId: payModal.id,
          studentId:           payModal.studentId,
          amountPaid:          amt,
          paymentMethod:       payForm.paymentMethod,
          note:                payForm.note || null
        }
      })
      setPayModal(null); load()
    } catch (e) { setFormErr(e.message) }
    finally { setSaving(false) }
  }

  const fmt = n => `₦${Number(n || 0).toLocaleString()}`

  if (loading && !fees.length) return <Spinner />

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <h2 style={{ margin: 0 }}>Optional Fees</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <ActionButton variant="secondary" onClick={openAssign}>Assign to Students</ActionButton>
          <ActionButton onClick={openFeeCreate}>+ New Fee Type</ActionButton>
        </div>
      </div>

      <ErrorMessage message={error} onRetry={load} />

      {/* Tabs */}
      <div style={{ display: 'flex', background: '#f3f4f6', borderRadius: 8, padding: 4, marginBottom: 20, width: 'fit-content' }}>
        {[
          { key: 'types',   label: `Fee Types (${fees.length})`          },
          { key: 'assigns', label: `Assignments (${assigns.length})` },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '7px 18px', border: 'none', borderRadius: 6, fontSize: 13,
            fontWeight: 600, cursor: 'pointer',
            background: tab === t.key ? '#fff' : 'transparent',
            color:      tab === t.key ? '#1a1f36' : '#6b7280',
            boxShadow:  tab === t.key ? '0 1px 4px rgba(0,0,0,.08)' : 'none'
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── Fee Types ── */}
      {tab === 'types' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
          {fees.map(f => (
            <div key={f.id} style={{
              background: '#fff', borderRadius: 12, padding: 20,
              boxShadow: '0 1px 4px rgba(0,0,0,.06)', borderLeft: '4px solid #f59e0b'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{f.name}</h3>
                <span style={{ fontWeight: 700, fontSize: 16, color: '#f59e0b' }}>{fmt(f.amount)}</span>
              </div>
              {f.description && (
                <p style={{ margin: '0 0 8px', fontSize: 13, color: '#6b7280' }}>{f.description}</p>
              )}
              <p style={{ margin: '0 0 14px', fontSize: 12, color: '#9ca3af' }}>
                {f._count.assigns} total assignment{f._count.assigns !== 1 ? 's' : ''}
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <ActionButton size="sm" variant="secondary" onClick={() => openFeeEdit(f)}>Edit</ActionButton>
                <ActionButton size="sm" variant="danger"    onClick={() => deleteFee(f.id)}>Delete</ActionButton>
              </div>
            </div>
          ))}
          {fees.length === 0 && (
            <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 48, color: '#9ca3af', background: '#fff', borderRadius: 12 }}>
              No fee types yet. Create one to get started.
            </div>
          )}
        </div>
      )}

      {/* ── Assignments ── */}
      {tab === 'assigns' && (
        <>
          <div style={{ marginBottom: 14 }}>
            <select
              value={filterTermId}
              onChange={e => setFilterTermId(e.target.value)}
              style={{ ...inputStyle, maxWidth: 260, fontSize: 13 }}
            >
              <option value="">All terms</option>
              {allTerms.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </div>

          <div style={{ background: '#fff', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
            {loading ? <Spinner /> : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr style={{ background: '#f9fafb' }}>
                    {['Student', 'Class', 'Fee', 'Term / Session', 'Amount', 'Paid', 'Balance', 'Actions'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#374151', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {assigns.map(a => (
                    <tr key={a.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '10px 14px', fontWeight: 500 }}>{a.student.name}</td>
                      <td style={{ padding: '10px 14px', color: '#6b7280', fontSize: 13 }}>{a.student.class.className}</td>
                      <td style={{ padding: '10px 14px' }}>{a.optionalFee.name}</td>
                      <td style={{ padding: '10px 14px', fontSize: 12, color: '#6b7280' }}>
                        {a.term?.name}<br />
                        <span style={{ color: '#9ca3af' }}>{a.term?.session?.name}</span>
                      </td>
                      <td style={{ padding: '10px 14px' }}>{fmt(a.optionalFee.amount)}</td>
                      <td style={{ padding: '10px 14px', color: '#10b981', fontWeight: 600 }}>{fmt(a.paid)}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <Badge label={fmt(a.balance)} color={a.balance <= 0 ? 'green' : 'yellow'} />
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {a.balance > 0 && (
                            <ActionButton size="sm" onClick={() => openPay(a)}>Pay</ActionButton>
                          )}
                          <ActionButton size="sm" variant="danger" onClick={() => deleteAssign(a.id)}>Remove</ActionButton>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {assigns.length === 0 && (
                    <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>
                      No assignments{filterTermId ? ' for this term' : ''}
                    </td></tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* ── Create / Edit Fee modal ── */}
      {feeModal && (
        <Modal title={feeModal === 'create' ? 'New Fee Type' : `Edit — ${feeModal.name}`} onClose={() => setFeeModal(null)}>
          <ErrorMessage message={formErr} />
          <FormField label="Fee Name">
            <input value={feeForm.name} onChange={e => setFeeForm(p => ({ ...p, name: e.target.value }))}
              placeholder="e.g. PTA Levy, Exam Fee, Book Fee" style={inputStyle} />
          </FormField>
          <FormField label="Amount (₦) per student">
            <input type="number" min="0" value={feeForm.amount} onChange={e => setFeeForm(p => ({ ...p, amount: e.target.value }))}
              placeholder="e.g. 2000" style={inputStyle} />
          </FormField>
          <FormField label="Description (optional)">
            <input value={feeForm.description} onChange={e => setFeeForm(p => ({ ...p, description: e.target.value }))}
              placeholder="Short note about this fee" style={inputStyle} />
          </FormField>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
            <ActionButton variant="secondary" onClick={() => setFeeModal(null)}>Cancel</ActionButton>
            <ActionButton disabled={saving} onClick={saveFee}>{saving ? 'Saving…' : 'Save'}</ActionButton>
          </div>
        </Modal>
      )}

      {/* ── Assign modal ── */}
      {assignModal && (
        <Modal title="Assign Fee to Students" onClose={() => setAssignModal(false)}>
          <ErrorMessage message={formErr} />
          <FormField label="Fee Type">
            <select value={assignForm.optionalFeeId} onChange={e => setAssignForm(p => ({ ...p, optionalFeeId: e.target.value }))} style={inputStyle}>
              <option value="">Select fee…</option>
              {fees.map(f => <option key={f.id} value={f.id}>{f.name} — {fmt(f.amount)}</option>)}
            </select>
          </FormField>
          <FormField label="Term">
            <select value={assignForm.termId} onChange={e => setAssignForm(p => ({ ...p, termId: e.target.value }))} style={inputStyle}>
              <option value="">Select term…</option>
              {allTerms.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </FormField>
          <FormField label={`Students (${assignForm.studentIds.length} selected)`} hint="Hold Ctrl / Cmd to select multiple">
            <select
              multiple
              value={assignForm.studentIds}
              onChange={e => setAssignForm(p => ({ ...p, studentIds: Array.from(e.target.selectedOptions, o => o.value) }))}
              style={{ ...inputStyle, height: 200 }}
            >
              {students.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.class.className}) — {s.admissionNumber}</option>
              ))}
            </select>
          </FormField>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
            <ActionButton variant="secondary" onClick={() => setAssignModal(false)}>Cancel</ActionButton>
            <ActionButton disabled={saving} onClick={saveAssign}>{saving ? 'Assigning…' : 'Assign'}</ActionButton>
          </div>
        </Modal>
      )}

      {/* ── Record payment modal ── */}
      {payModal && (
        <Modal title={`Record Payment — ${payModal.student.name}`} onClose={() => setPayModal(null)}>
          <div style={{ background: '#f9fafb', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 13 }}>
            <strong>{payModal.optionalFee.name}</strong>
            <span style={{ color: '#6b7280', margin: '0 8px' }}>·</span>
            {payModal.term?.session?.name} {payModal.term?.name}
            <br />
            <span style={{ color: '#6b7280' }}>Balance: </span>
            <strong style={{ color: '#f59e0b' }}>{fmt(payModal.balance)}</strong>
            <span style={{ color: '#6b7280', margin: '0 8px' }}>·</span>
            <span style={{ color: '#6b7280' }}>Already paid: </span>
            <strong style={{ color: '#10b981' }}>{fmt(payModal.paid)}</strong>
          </div>
          <ErrorMessage message={formErr} />
          <FormField label={`Amount (₦) — max ${fmt(payModal.balance)}`}>
            <input
              type="number" min="1" max={payModal.balance}
              value={payForm.amountPaid}
              onChange={e => setPayForm(p => ({ ...p, amountPaid: e.target.value }))}
              style={inputStyle}
            />
          </FormField>
          <FormField label="Payment Method">
            <select value={payForm.paymentMethod} onChange={e => setPayForm(p => ({ ...p, paymentMethod: e.target.value }))} style={inputStyle}>
              {METHODS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </FormField>
          <FormField label="Note (optional)">
            <input value={payForm.note} onChange={e => setPayForm(p => ({ ...p, note: e.target.value }))}
              placeholder="e.g. bank teller no." style={inputStyle} />
          </FormField>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
            <ActionButton variant="secondary" onClick={() => setPayModal(null)}>Cancel</ActionButton>
            <ActionButton disabled={saving} onClick={savePay}>{saving ? 'Saving…' : 'Record Payment'}</ActionButton>
          </div>
        </Modal>
      )}
    </div>
  )
}
