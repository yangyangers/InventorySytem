// supabase/functions/send-reset-email/index.ts
// Deploy with: supabase functions deploy send-reset-email
//
// Requires these secrets set via:
//   supabase secrets set RESEND_API_KEY=re_...
//   supabase secrets set APP_URL=https://your-app.vercel.app

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { to, full_name, reset_link } = await req.json()

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY not set')

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'IMS Platform <noreply@yourdomain.com>',  // ← Change to your verified Resend domain
        to: [to],
        subject: 'Reset your IMS password',
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #f9fafb; border-radius: 12px;">
            <div style="background: linear-gradient(135deg, #d4a017, #e8b820); width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; margin-bottom: 24px;">
              <span style="font-size: 22px;">📦</span>
            </div>
            <h1 style="font-size: 22px; font-weight: 800; color: #141c22; margin: 0 0 8px;">Reset your password</h1>
            <p style="color: #4b5563; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
              Hi ${full_name}, we received a request to reset your IMS Platform password.
              Click the button below to choose a new one. This link expires in <strong>1 hour</strong>.
            </p>
            <a href="${reset_link}" style="display: inline-block; background: linear-gradient(135deg, #d4a017, #e8b820); color: #141c22; font-weight: 700; font-size: 15px; padding: 13px 28px; border-radius: 9px; text-decoration: none; margin-bottom: 24px;">
              Reset Password →
            </a>
            <p style="color: #9ca3af; font-size: 13px; line-height: 1.6; margin: 0;">
              If you didn't request this, you can safely ignore this email — your password won't change.<br><br>
              Or copy this link: <span style="color: #5b9490;">${reset_link}</span>
            </p>
          </div>
        `,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Resend error: ${err}`)
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
