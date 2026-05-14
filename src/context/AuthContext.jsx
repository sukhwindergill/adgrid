import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeRole, setActiveRole] = useState(null)

  async function fetchProfile(userId) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    setProfile(data)
    if (data?.role) setActiveRole(data.role)
    return data
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code   = params.get('code')

    const init = async () => {
      if (code) {
        // OAuth PKCE callback — exchange code for session explicitly
        await supabase.auth.exchangeCodeForSession(code)
        // Clean the URL so code isn't reused on refresh
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
      else setProfile(null)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function signUp(email, password, role, name) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { role, name } },
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
  }

  async function signInWithOAuth(provider) {
    const redirectTo = window.location.origin
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo },
    })
    return { data, error }
  }

  async function setRole(role) {
    if (!user) return
    const { error } = await supabase.auth.updateUser({ data: { role } })
    if (!error) {
      await supabase.from('profiles').upsert({ id: user.id, role }, { onConflict: 'id' })
      await fetchProfile(user.id)
    }
    return { error }
  }

  const role = profile?.role ?? user?.user_metadata?.role ?? null

  const canToggleToOperator = profile?.role === 'operator'

  function toggleRole(targetRole) {
    if (targetRole === 'operator' && !canToggleToOperator) return
    setActiveRole(targetRole)
  }

  return (
    <AuthContext.Provider value={{
      user, profile, role, loading,
      activeRole, canToggleToOperator, toggleRole,
      signUp, signIn, signOut, signInWithOAuth, setRole,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
