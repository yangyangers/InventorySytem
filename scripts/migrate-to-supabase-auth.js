// scripts/migrate-to-supabase-auth.js
//
// ONE-TIME SCRIPT: Creates Supabase Auth accounts for all existing users
// and links them to your custom `users` table via `auth_id`.
//
// Run ONCE from your project root:
//   node scripts/migrate-to-supabase-auth.js
//
// Requirements:
//   - VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env
//   - npm install @supabase/supabase-js dotenv (if not already installed)

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL         = process.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY     = process.env.SUPABASE_SERVICE_ROLE_KEY  // From Supabase > Settings > API
const TEMP_PASSWORD        = 'ChangeMe@123!'  // Temporary password — users MUST reset via forgot password

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('\n❌ Missing env vars: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required\n')
  process.exit(1)
}

// Use service role key — this bypasses RLS and can create auth users
const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

async function main() {
  console.log('\n🚀 Starting Supabase Auth migration...\n')

  // 1. Fetch all existing users from your custom table
  const { data: users, error } = await sb.from('users').select('id, email, full_name, username')
  if (error) { console.error('❌ Failed to fetch users:', error.message); process.exit(1) }

  console.log(`📋 Found ${users.length} users to migrate\n`)

  let success = 0, skipped = 0, failed = 0

  for (const user of users) {
    const email = user.email?.trim()
    if (!email) {
      console.warn(`⚠️  Skipping ${user.username} — no email address`)
      skipped++
      continue
    }

    try {
      // 2. Create Supabase Auth user with admin API
      const { data: authData, error: createErr } = await sb.auth.admin.createUser({
        email,
        password: TEMP_PASSWORD,
        email_confirm: true,           // skip email confirmation for existing users
        user_metadata: {
          full_name: user.full_name,
          username:  user.username,
        },
      })

      if (createErr) {
        if (createErr.message.includes('already been registered')) {
          // Auth user exists — look it up and link it
          const { data: { users: authUsers } } = await sb.auth.admin.listUsers()
          const existing = authUsers.find(u => u.email === email)
          if (existing) {
            await sb.from('users').update({ auth_id: existing.id }).eq('id', user.id)
            console.log(`🔗 Linked existing auth user: ${email}`)
            success++
          } else {
            console.warn(`⚠️  Could not find auth user for: ${email}`)
            skipped++
          }
        } else {
          throw createErr
        }
        continue
      }

      // 3. Write auth_id back to custom users table
      const { error: updateErr } = await sb
        .from('users')
        .update({ auth_id: authData.user.id })
        .eq('id', user.id)

      if (updateErr) throw updateErr

      console.log(`✅ Migrated: ${email} (${user.full_name})`)
      success++
    } catch (e) {
      console.error(`❌ Failed: ${email} —`, e.message)
      failed++
    }
  }

  console.log(`
────────────────────────────────────────
✅ Migration complete!
   Migrated : ${success}
   Skipped  : ${skipped} (no email)
   Failed   : ${failed}
────────────────────────────────────────

⚠️  IMPORTANT NEXT STEPS:
1. Run supabase/migrations/supabase-auth-migration.sql in the Supabase SQL Editor
2. In Supabase dashboard > Authentication > URL Configuration:
   - Set Site URL to your app's URL (e.g. https://your-app.vercel.app)
   - Add Redirect URL: https://your-app.vercel.app/reset-password
3. Send a "Forgot Password" email to all migrated users so they can set
   their own password (they currently have the temp password: "${TEMP_PASSWORD}")
4. Once all users have reset their passwords, drop password_hash column:
   ALTER TABLE users DROP COLUMN password_hash;
`)
}

main().catch(console.error)
