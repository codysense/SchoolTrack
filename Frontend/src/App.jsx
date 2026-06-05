import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { TermProvider }  from './context/TermContext'
import Layout            from './components/Layout'
import Login             from './pages/Login'
import Dashboard         from './pages/Dashboard'
import Students          from './pages/Students'
import StudentDetail     from './pages/StudentDetail'
import Classes           from './pages/Classes'
import Payments          from './pages/Payments'
import Results           from './pages/Results'
import Notifications     from './pages/Notifications'
import OptionalFees      from './pages/OptionalFees'
import Setup             from './pages/Setup'
import Sessions          from './pages/Sessions'
import AuditLog          from './pages/AuditLog'
import StudentPortal     from './pages/StudentPortal'

function AdminOnly({ children }) {
  const { user } = useAuth()
  if (!user)                   return <Navigate to="/login"  replace />
  if (user.role === 'STUDENT') return <Navigate to="/portal" replace />
  if (user.role !== 'ADMIN')   return <Navigate to="/"       replace />
  return children
}

function StudentOnly({ children }) {
  const { user } = useAuth()
  if (!user)                    return <Navigate to="/login" replace />
  if (user.role !== 'STUDENT')  return <Navigate to="/"     replace />
  return children
}

function StaffOnly({ children }) {
  const { user } = useAuth()
  if (!user)                   return <Navigate to="/login"  replace />
  if (user.role === 'STUDENT') return <Navigate to="/portal" replace />
  return children
}

function LoginGate() {
  const { user } = useAuth()
  if (user?.role === 'STUDENT') return <Navigate to="/portal" replace />
  if (user?.role)               return <Navigate to="/"       replace />
  return <Login />
}

function StaffApp() {
  return (
    <StaffOnly>
      <TermProvider>
        <Layout>
          <Routes>
            <Route path="/"              element={<Dashboard />} />
            <Route path="/students"      element={<Students />} />
            <Route path="/students/:id"  element={<StudentDetail />} />
            <Route path="/classes"       element={<Classes />} />
            <Route path="/results"       element={<Results />} />

            {/* Admin-only */}
            <Route path="/sessions"      element={<AdminOnly><Sessions /></AdminOnly>} />
            <Route path="/payments"      element={<AdminOnly><Payments /></AdminOnly>} />
            <Route path="/optional-fees" element={<AdminOnly><OptionalFees /></AdminOnly>} />
            <Route path="/notifications" element={<AdminOnly><Notifications /></AdminOnly>} />
            <Route path="/audit"         element={<AdminOnly><AuditLog /></AdminOnly>} />
            <Route path="/setup"         element={<AdminOnly><Setup /></AdminOnly>} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </TermProvider>
    </StaffOnly>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login"  element={<LoginGate />} />
          <Route path="/portal" element={<StudentOnly><StudentPortal /></StudentOnly>} />
          <Route path="/*"      element={<StaffApp />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
