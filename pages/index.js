import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'

const supabase = createClient(
  'https://your-project-id.supabase.co', // 🔁 Replace with your actual Supabase URL
  'your-anon-key'                        // 🔁 Replace with your actual Supabase anon key
)

export default function Home() {
  const [session, setSession] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (session)
    return (
      <div>
        <h1>Welcome, {session.user.email}</h1>
        <button onClick={() => supabase.auth.signOut()}>Sign Out</button>
      </div>
    )

  return (
    <div style={{ maxWidth: '400px', margin: 'auto', paddingTop: '100px' }}>
      <Auth
        supabaseClient={supabase}
        appearance={{ theme: ThemeSupa }}
        providers={[]} // ⛔ No social providers
      />
    </div>
  )
}
