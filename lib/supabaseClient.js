import { createClient } from '@supabase/supabase-js'

// ⬇️ PASTE YOUR REAL VALUES HERE (from Supabase → Settings → API)
// Use the Project URL (ends with .supabase.co) and the anon public key (NOT service_role)
const supabaseUrl = 'https://yaxkujoiqmsixougkkdu.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlheGt1am9pcW1zaXhvdWdra2R1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIyNTk4MjksImV4cCI6MjA2NzgzNTgyOX0.rAvWAdXuy9KR7efCMZ_dWNv0idE-DQkcsawX60WkZkA'

// Create a single shared client for the whole app
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Tiny self-test on load — prints to browser DevTools console
;(async () => {
  try {
    const { data, error } = await supabase.auth.getSession()
    if (error) {
      console.error('[Supabase] getSession error:', error.message)
    } else {
      console.log('[Supabase] Client OK. Session:', data?.session ? 'present' : 'none')
    }
  } catch (e) {
    console.error('[Supabase] Client init failed:', e)
  }
})()



