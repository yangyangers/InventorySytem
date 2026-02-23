import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { SessionUser } from '@/types'

interface Auth {
  user: SessionUser | null
  setUser: (u: SessionUser | null) => void
  logout: () => void
}

export const useAuth = create<Auth>()(
  persist(
    (set) => ({
      user: null,
      setUser: (user) => set({ user }),
      logout: () => set({ user: null }),
    }),
    { name: 'ims_auth_v2' }
  )
)
