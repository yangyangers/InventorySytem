import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@/store/auth'
import Shell from '@/components/layout/Shell'
import Login           from '@/pages/Login'
import ForgotPassword  from '@/pages/ForgotPassword'
import ResetPassword   from '@/pages/ResetPassword'
import Dashboard  from '@/pages/Dashboard'
import Inventory  from '@/pages/Inventory'
import Transactions from '@/pages/Transactions'
import Suppliers  from '@/pages/Suppliers'
import Profile    from '@/pages/Profile'
import Staff      from '@/pages/Staff'
import Reports    from '@/pages/Reports'
import Categories from '@/pages/Categories'

function Guard({ children, admin = false }: { children: React.ReactNode; admin?: boolean }) {
  const { user, ready } = useAuth()
  if (!ready) return null                                          // wait for session check
  if (!user)  return <Navigate to="/login" replace />
  if (admin && user.role !== 'admin') return <Navigate to="/" replace />
  return <>{children}</>
}

export default function App() {
  const { user, ready, init } = useAuth()

  // Subscribe to Supabase Auth state changes once on mount
  useEffect(() => init(), [])

  if (!ready) return null   // avoid flash before session resolved

  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/login"           element={user ? <Navigate to="/" replace /> : <Login />} />
        <Route path="/forgot-password" element={user ? <Navigate to="/" replace /> : <ForgotPassword />} />
        {/* Supabase redirects here after user clicks the reset email link */}
        <Route path="/reset-password"  element={<ResetPassword />} />

        {/* Protected routes */}
        <Route path="/" element={<Guard><Shell /></Guard>}>
          <Route index element={<Dashboard />} />
          <Route path="inventory"    element={<Inventory />} />
          <Route path="transactions" element={<Transactions />} />
          <Route path="suppliers"    element={<Suppliers />} />
          <Route path="profile"      element={<Profile />} />
          <Route path="staff"        element={<Guard admin><Staff /></Guard>} />
          <Route path="reports"      element={<Guard admin><Reports /></Guard>} />
          <Route path="categories"   element={<Guard admin><Categories /></Guard>} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
