import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

export function AuthProvider({ children }) {
  const [user, setUser]             = useState(null)
  const [profile, setProfile]       = useState(null)
  const [activeMode, setActiveModeState] = useState(null) // 'operator' | 'advertiser'
  const [loading, setLoading]       = useState(true)

  async function fetchProfile(userId) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    setProfile(data)
    setActiveModeState(data?.active_mode ?? 'advertiser')
    return data
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code   = params.get('code')

    const init = async () => {
      if (code) {
        await supabase.auth.exchangeCodeForSession(code)
        window.history.replaceState({}, '', window.location.pathname)
      }
      const { data: { session } } = await supabase.auth.getSession()
      setUser(session?.user ?? null)
      if (session?.user) await fetchProfile(session.user.id)
      setLoading(false)
    }
    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else { setProfile(null); setActiveModeState(null) }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function signUp(email, password, name) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    })
    return { data, error }
  }

  async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    return { data, error }
  }

  async function signOut() {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
    setActiveModeState(null)
  }

  async function signInWithOAuth(provider) {
    const redirectTo = window.location.origin
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo },
    })
    return { data, error }
  }

  async function setActiveMode(mode) {
    setActiveModeState(mode)
    if (user) {
      const { error } = await supabase.from('profiles').update({ active_mode: mode }).eq('id', user.id)
      return { error }
    }
    return { error: null }
  }

  return (
    <AuthContext.Provider value={{ user, profile, activeMode, loading, signUp, signIn, signOut, signInWithOAuth, setActiveMode }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
