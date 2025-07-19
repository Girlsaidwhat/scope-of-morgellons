import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'

const supabase = createClient(
  'https://your-project-ref.supabase.co',
  'your-anon-key'
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
    <Auth
      supabaseClient={supabase}
      appearance={{ theme: ThemeSupa }}
      providers={['google']}
    />
  )
}


