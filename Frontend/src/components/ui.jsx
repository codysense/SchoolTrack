// ── Spinner ──────────────────────────────────────────────────────────────────
export function Spinner({ size = 32 }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
      <div style={{
        width: size, height: size,
        border: `3px solid #e5e7eb`,
        borderTopColor: '#4f8ef7',
        borderRadius: '50%',
        animation: 'spin .7s linear infinite'
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

// ── ErrorMessage ─────────────────────────────────────────────────────────────
export function ErrorMessage({ message, onRetry }) {
  if (!message) return null
  return (
    <div style={{
      background: '#fee2e2', color: '#991b1b',
      padding: '12px 16px', borderRadius: 8,
      fontSize: 13, display: 'flex',
      justifyContent: 'space-between', alignItems: 'center',
      marginBottom: 16
    }}>
      <span>⚠ {message}</span>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{ background: 'none', border: '1px solid #fca5a5', color: '#991b1b', padding: '3px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 12, marginLeft: 12 }}
        >
          Retry
        </button>
      )}
    </div>
  )
}

// ── PageShell ─────────────────────────────────────────────────────────────────
// Wraps every page with a title row + optional action button
export function PageShell({ title, action, children }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#1a1f36' }}>{title}</h2>
        {action}
      </div>
      {children}
    </div>
  )
}

// ── Badge ─────────────────────────────────────────────────────────────────────
const BADGE_STYLES = {
  blue:   { background: '#eff6ff', color: '#2563eb' },
  green:  { background: '#d1fae5', color: '#065f46' },
  yellow: { background: '#fef3c7', color: '#92400e' },
  red:    { background: '#fee2e2', color: '#991b1b' },
  gray:   { background: '#f3f4f6', color: '#374151' },
}

export function Badge({ label, color = 'blue' }) {
  const s = BADGE_STYLES[color] || BADGE_STYLES.blue
  return (
    <span style={{ ...s, padding: '2px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>
      {label}
    </span>
  )
}

// ── ActionButton ──────────────────────────────────────────────────────────────
export function ActionButton({ onClick, children, variant = 'primary', disabled = false, size = 'md' }) {
  const styles = {
    primary:   { background: disabled ? '#93c5fd' : '#4f8ef7', color: '#fff', border: 'none' },
    secondary: { background: '#fff', color: '#374151', border: '1px solid #d1d5db' },
    danger:    { background: '#fff', color: '#dc2626', border: '1px solid #fca5a5' },
    warning:   { background: disabled ? '#fcd34d' : '#f59e0b', color: '#fff', border: 'none' },
  }
  const padding = size === 'sm' ? '5px 12px' : '8px 18px'

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        ...styles[variant],
        padding, borderRadius: 8,
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontWeight: 600, fontSize: size === 'sm' ? 13 : 14,
        transition: 'opacity .15s',
      }}
    >
      {children}
    </button>
  )
}

// ── FormField ──────────────────────────────────────────────────────────────────
export function FormField({ label, hint, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
        {label}
      </label>
      {children}
      {hint && <p style={{ margin: '4px 0 0', fontSize: 11, color: '#9ca3af' }}>{hint}</p>}
    </div>
  )
}

// Shared input style — import and spread onto your <input> / <select>
export const inputStyle = {
  width: '100%',
  padding: '8px 12px',
  border: '1px solid #d1d5db',
  borderRadius: 8,
  fontSize: 14,
  boxSizing: 'border-box',
  outline: 'none',
  color: '#1a1f36',
  background: '#fff',
}
