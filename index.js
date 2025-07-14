import { useState, useEffect } from 'react'
import { supabase } from '../utils/supabaseClient'

export default function Home() {
  const [session, setSession] = useState(null)
  const [file, setFile] = useState(null)
  const [images, setImages] = useState([])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    fetchImages()
  }, [])

  const fetchImages = async () => {
    const { data } = await supabase.storage.from('images').list('', {
      limit: 100,
      offset: 0,
      sortBy: { column: 'created_at', order: 'desc' },
    })
    setImages(data || [])
  }

  const uploadImage = async () => {
    if (!file) return alert('Please choose a file first.')

    const fileName = `${Date.now()}-${file.name}`
    const { error } = await supabase.storage.from('images').upload(fileName, file)
    if (error) return alert('Upload failed: ' + error.message)
    setFile(null)
    fetchImages()
  }

  const signUp = async (email, password) => {
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) alert(error.message)
  }

  const signIn = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) alert(error.message)
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setSession(null)
  }

  return (
    <main style={{ padding: '2rem', maxWidth: 600, margin: 'auto', textAlign: 'center' }}>
      <h1>The Scope of Morgellons</h1>

      {!session ? (
        <AuthForm onSignUp={signUp} onSignIn={signIn} />
      ) : (
        <>
          <button onClick={signOut} style={{ marginBottom: 20 }}>Sign Out</button>

          <div style={{ marginBottom: 20 }}>
            <input type="file" onChange={e => setFile(e.target.files[0])} />
            <button onClick={uploadImage}>Upload Image</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {images.map(img => (
              <img
                key={img.name}
                src={`https://yaxkujoiqmsixougkkdu.supabase.co/storage/v1/object/public/images/${img.name}`}
                alt={img.name}
                style={{ width: '100%', borderRadius: 8 }}
              />
            ))}
          </div>
        </>
      )}
    </main>
  )
}

function AuthForm({ onSignUp, onSignIn }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  return (
    <div style={{ marginBottom: 20 }}>
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        style={{ padding: 8, marginRight: 8 }}
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={e => setPassword(e.target.value)}
        style={{ padding: 8, marginRight: 8 }}
      />
      <button onClick={() => onSignUp(email, password)} style={{ marginRight: 8 }}>Sign Up</button>
      <button onClick={() => onSignIn(email, password)}>Log In</button>
    </div>
  )
}
