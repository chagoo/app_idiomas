import React, { useEffect, useState } from 'react'
import { getProfile, getUser, Profile, signIn, signOut, signUp } from '../lib/supabase'

type Props = {
  onAuthChange?: (profile: Profile | null) => void
  visible: boolean
}

export default function AuthPanel({ onAuthChange, visible }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [profile, setProfile] = useState<Profile | null>(null)
  const [msg, setMsg] = useState<string>('')

  useEffect(() => {
    if (!visible) return
    ;(async () => {
      const u = await getUser()
      if (u) {
        const p = await getProfile()
        setProfile(p)
        onAuthChange?.(p)
      }
    })()
  }, [visible])

  if (!visible) return null

  const doSignIn = async () => {
    setMsg('')
    const { error } = await signIn(email, password)
    if (error) { setMsg(error.message); return }
    const p = await getProfile()
    setProfile(p)
    onAuthChange?.(p)
  }

  const doSignUp = async () => {
    setMsg('')
    const { data, error } = await signUp(email, password)
    if (error) { setMsg(error.message); return }
    setMsg('Registro exitoso. Revisa tu correo si las confirmaciones estan activadas.')
  }

  const doSignOut = async () => {
    await signOut()
    setProfile(null)
    onAuthChange?.(null)
  }

  return (
    <div style={{
      marginBottom: 12,
      padding: 12,
      border: '1px solid #e5e7eb', borderRadius: 8,
      background: '#f8fafc', color: '#0f172a'
    }}>
      <strong>Autenticacion</strong>
      {profile ? (
        <div style={{ marginTop: 8 }}>
          Sesion iniciada · Rol: <b>{profile.role}</b>
          <button style={{ marginLeft: 8 }} onClick={doSignOut}>Cerrar sesion</button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
          <input placeholder="email" value={email} onChange={e=>setEmail(e.target.value)} />
          <input placeholder="password" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
          <button onClick={doSignIn}>Entrar</button>
          <button onClick={doSignUp}>Registrar</button>
        </div>
      )}
      {msg && <div style={{ marginTop: 8, color: '#334155' }}>{msg}</div>}
    </div>
  )
}

