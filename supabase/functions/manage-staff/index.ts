import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create admin client using service role key
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Verify the caller is an authenticated admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user: caller } } = await supabaseClient.auth.getUser()
    if (!caller) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Check caller is admin
    const { data: callerProfile } = await supabaseAdmin
      .from('users')
      .select('role, business_id')
      .eq('auth_id', caller.id)
      .single()

    if (!callerProfile || callerProfile.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Only admins can manage staff' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const body = await req.json()
    const { action } = body

    // ── CREATE ──────────────────────────────────────────────
    if (action === 'create') {
      const { email, password, full_name, username, role, business_id } = body

      // Validate
      if (!email || !password || !full_name || !username) {
        return new Response(JSON.stringify({ error: 'Missing required fields' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      if (password.length < 8) {
        return new Response(JSON.stringify({ error: 'Password must be at least 8 characters' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Check username taken
      const { data: existingUsername } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('username', username.toLowerCase())
        .maybeSingle()
      if (existingUsername) {
        return new Response(JSON.stringify({ error: 'Username already taken' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Create auth user via Admin API (correct way — no 500 errors)
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: email.toLowerCase().trim(),
        password,
        email_confirm: true,
        user_metadata: { full_name, username: username.toLowerCase() }
      })

      if (authError) {
        return new Response(JSON.stringify({ error: authError.message }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Insert into users table
      const { error: dbError } = await supabaseAdmin
        .from('users')
        .insert({
          auth_id: authData.user.id,
          full_name: full_name.trim(),
          username: username.toLowerCase().trim(),
          email: email.toLowerCase().trim(),
          role: role || 'staff',
          business_id: business_id || callerProfile.business_id,
          is_active: true,
        })

      if (dbError) {
        // Rollback auth user if db insert fails
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
        return new Response(JSON.stringify({ error: dbError.message }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // ── UPDATE ──────────────────────────────────────────────
    if (action === 'update') {
      const { user_id, full_name, role, email } = body

      // Get auth_id
      const { data: target } = await supabaseAdmin
        .from('users')
        .select('auth_id')
        .eq('id', user_id)
        .single()

      if (!target) {
        return new Response(JSON.stringify({ error: 'User not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Update auth email and name
      if (target.auth_id) {
        const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(target.auth_id, {
          email: email.toLowerCase().trim(),
          user_metadata: { full_name },
        })
        if (authUpdateError) {
          return new Response(JSON.stringify({ error: 'Auth update failed: ' + authUpdateError.message }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
      }

      // Update users table
      const { error: dbUpdateError } = await supabaseAdmin
        .from('users')
        .update({
          full_name: full_name.trim(),
          role,
          email: email.toLowerCase().trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', user_id)

      if (dbUpdateError) {
        return new Response(JSON.stringify({ error: 'DB update failed: ' + dbUpdateError.message }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // ── TOGGLE ACTIVE ────────────────────────────────────────
    if (action === 'toggle') {
      const { user_id, is_active } = body

      const { data: target } = await supabaseAdmin
        .from('users')
        .select('auth_id')
        .eq('id', user_id)
        .single()

      if (target?.auth_id) {
        // Ban or unban via Admin API
        await supabaseAdmin.auth.admin.updateUserById(target.auth_id, {
          ban_duration: is_active ? 'none' : '87600h', // none = unban, 87600h = 10 years
        })
      }

      await supabaseAdmin
        .from('users')
        .update({ is_active, updated_at: new Date().toISOString() })
        .eq('id', user_id)

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // ── DELETE ───────────────────────────────────────────────
    if (action === 'delete') {
      const { user_id } = body

      const { data: target } = await supabaseAdmin
        .from('users')
        .select('auth_id')
        .eq('id', user_id)
        .single()

      // Delete from users table first
      await supabaseAdmin.from('users').delete().eq('id', user_id)

      // Delete from auth via Admin API
      if (target?.auth_id) {
        await supabaseAdmin.auth.admin.deleteUser(target.auth_id)
      }

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})