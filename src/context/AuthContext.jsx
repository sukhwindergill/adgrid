import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

export function AuthProvider({ children }) {
  const [user, setUser]                     = useState(null)
  const [profile, setProfile]               = useState(null)
  const [activeMode, setActiveModeState]    = useState(null)
  const [activeAccount, setActiveAccountState] = useState(null) // { id, name, role, isOwn }
  const [grants, setGrants]                 = useState([])      // active account_grants[]
  const [loading, setLoading]               = useState(true)

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

  const fetchGrants = useCallback(async (userId) => {
    // Fetch direct grants to this user's profile
    const { data: direct } = await supabase
      .from('account_grants')
      .select('*, account:account_id(id, name, company_name, logo_url)')
      .eq('grantee_id', userId)
      .eq('status', 'active')

    // Fetch org memberships, then fetch grants for those orgs
    const { data: memberships } = await supabase
      .from('team_members')
      .select('org_profile_id')
      .eq('user_profile_id', userId)

    const orgIds = (memberships ?? []).map(m => m.org_profile_id).filter(Boolean)

    let viaOrg = []
    if (orgIds.length > 0) {
      const { data: orgGrants } = await supabase
        .from('account_grants')
        .select('*, account:account_id(id, name, company_name, logo_url)')
        .in('grantee_id', orgIds)
        .eq('status', 'active')
      viaOrg = orgGrants ?? []
    }

    // Dedupe by account_id (direct takes precedence)
    const seen = new Set()
    const all = [...(direct ?? []), ...viaOrg].filter(g => {
      if (seen.has(g.account_id)) return false
      seen.add(g.account_id)
      return true
    })
    setGrants(all)
    return all
  }, [])

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
      if (session?.user) {
        await fetchProfile(session.user.id)
        await fetchGrants(session.user.id)
      }
      setLoading(false)
    }
    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfile(session.user.id)
        fetchGrants(session.user.id)

        // Auto-accept a pending grant invite (set before OAuth redirect)
        const pending = sessionStorage.getItem('pending_grant')
        if (pending) {
          sessionStorage.removeItem('pending_grant')
          supabase
            .from('account_grants')
            .update({ status: 'active' })
            .eq('id', pending)
            .then(() => fetchGrants(session.user.id))
        }
      } else {
        setProfile(null)
        setActiveModeState(null)
        setActiveAccountState(null)
        setGrants([])
      }
    })

    return () => subscription.unsubscribe()
  }, [fetchGrants])

  // Restore activeAccount from sessionStorage on mount
  useEffect(() => {
    const stored = sessionStorage.getItem('adgrid_active_account')
    if (stored) {
      try { setActiveAccountState(JSON.parse(stored)) } catch {}
    }
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
    setActiveAccountState(null)
    setGrants([])
    sessionStorage.removeItem('adgrid_active_account')
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
      await supabase.from('profiles').update({ active_mode: mode }).eq('id', user.id)
    }
  }

  function setActiveAccount(account) {
    // account: { id, name, role, isOwn } | null
    setActiveAccountState(account)
    if (account) {
      sessionStorage.setItem('adgrid_active_account', JSON.stringify(account))
    } else {
      sessionStorage.removeItem('adgrid_active_account')
    }
  }

  async function acceptGrant(grantId) {
    const { error } = await supabase
      .from('account_grants')
      .update({ status: 'active' })
      .eq('id', grantId)
    if (!error) await fetchGrants(user.id)
    return { error }
  }

  async function revokeGrant(grantId) {
    const { error } = await supabase
      .from('account_grants')
      .update({ status: 'revoked' })
      .eq('id', grantId)
    if (!error) {
      setGrants(prev => prev.filter(g => g.id !== grantId))
      // If currently acting in this account, switch back to own
      if (activeAccount?.id && grants.find(g => g.id === grantId)?.account_id === activeAccount.id) {
        setActiveAccount(null)
      }
    }
    return { error }
  }

  return (
    <AuthContext.Provider value={{
      user, profile, activeMode, loading,
      activeAccount, grants,
      signUp, signIn, signOut, signInWithOAuth,
      setActiveMode, setActiveAccount, acceptGrant, revokeGrant,
      refreshGrants: () => user ? fetchGrants(user.id) : Promise.resolve(),
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
