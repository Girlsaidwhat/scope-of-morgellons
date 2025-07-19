// pages/signin.js
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useEffect, useState } from 'react'

export default function SignIn() {
  const [supabaseClient, setSupabaseClient] = useState(null)

  useEffect(() => {
    const client = createClientComponentClient()
    setSupabaseClient(client)
  }, [])

  if (!supabaseClient) return <p>Loading...</p>

  // Placeholder UI for sign in
  return (
    <div style={{ maxWidth: '400px', margin: '2rem auto' }}>
      <h1>Sign In</h1>
      <p>Supabase client is ready. Implement your auth UI here.</p>
    </div>
  )
}

