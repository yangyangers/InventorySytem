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

// Wrap any promise with a timeout
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms)
    ),
  ])
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
    const { data: { subscription } } = sb.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        // Retry up to 3 times to handle transient network/DB hiccups
        let profile: SessionUser | null = null
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            profile = await withTimeout(
              fetchProfile(session.user.id, session.user.email),
              8000
            )
            if (profile) break
          } catch (err) {
            console.warn(`fetchProfile attempt ${attempt} failed:`, err)
            if (attempt < 3) await new Promise(r => setTimeout(r, 1000 * attempt))
          }
        }

        if (profile) {
          set({ user: profile, ready: true })
        } else {
          // Profile fetch failed but the Supabase session is still valid.
          // Do NOT set user:null here — that would log the user out for a
          // transient DB/network error. Just mark ready without changing user.
          console.warn('fetchProfile failed after 3 retries — keeping session alive')
          set({ ready: true })
        }
      } else {
        // No session at all — genuinely logged out
        set({ user: null, ready: true })
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