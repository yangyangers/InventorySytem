import { create } from 'zustand'
import { sb } from '@/lib/supabase'
import { SessionUser } from '@/types'

interface Auth {
  user:    SessionUser | null
  ready:   boolean
  setUser: (u: SessionUser | null) => void
  logout:  () => Promise<void>
  init:    () => () => void
}

export const useAuth = create<Auth>()((set) => ({
  user:  null,
  ready: false,

  setUser: (user) => set({ user }),

  logout: async () => {
    await sb.auth.signOut()
    set({ user: null })
  },

  init: () => {
    // Check for existing session on app load
    sb.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        const profile = await fetchProfile(session.user.id, session.user.email)
        set({ user: profile, ready: true })
      } else {
        set({ ready: true })
      }
    })

    // Listen for sign-in / sign-out / token refresh
    const { data: { subscription } } = sb.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        const profile = await fetchProfile(session.user.id, session.user.email)
        set({ user: profile })
      } else {
        set({ user: null })
      }
    })

    return () => subscription.unsubscribe()
  },
}))

/**
 * Fetch the user's profile from the custom users table.
 * Primary:  look up by auth_id  (fast, always correct for new users)
 * Fallback: look up by email    (handles old users missing auth_id)
 *           and auto-links auth_id so fallback is never needed again
 */
async function fetchProfile(
  authUserId: string,
  authEmail?: string
): Promise<SessionUser | null> {

  // 1. Try by auth_id first
  const { data: byAuthId } = await sb
    .from('users')
    .select('id, username, full_name, email, role, business_id, avatar_color, auth_id')
    .eq('auth_id', authUserId)
    .maybeSingle()

  if (byAuthId) return byAuthId

  // 2. Fallback — find by email (covers existing users without auth_id)
  if (!authEmail) return null

  const { data: byEmail } = await sb
    .from('users')
    .select('id, username, full_name, email, role, business_id, avatar_color, auth_id')
    .eq('email', authEmail.toLowerCase())
    .maybeSingle()

  if (!byEmail) return null

  // 3. Auto-link auth_id so this fallback never runs again for this user
  if (!byEmail.auth_id) {
    await sb
      .from('users')
      .update({ auth_id: authUserId })
      .eq('id', byEmail.id)
  }

  return byEmail
}