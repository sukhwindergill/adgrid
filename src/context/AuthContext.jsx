import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { SUPABASE_FUNCTIONS_URL } from '../lib/constants.js'

const AuthContext = createContext({})

export function AuthProvider({ children }) {
  const [user, setUser]                     = useState(null)
  const [profile, setProfile]               = useState(null)
  const [activeMode, setActiveModeState]    = useState(null)
  const [activeAccount, setActiveAccountState] = useState(null) // { id, name, role, isOwn }
  const [grants, setGrants]                 = useState([])      // active account_grants[]
  const [loading, setLoading]               = useState(true)
  const [passwordRecovery, setPasswordRecovery] = useState(false)

  async function fetchProfile(userId) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    setProfile(data)
    if (data && !data.active_mode) {
      // First login after signup: honor the intent picked on the signup
      // form (advertiser vs screen operator) instead of always defaulting
      // to advertiser — otherwise a would-be operator lands on the
      // advertiser dashboard with no clue the operator mode toggle exists.
      const intent = localStorage.getItem('adgrid_signup_intent')
      const mode = intent === 'operator' ? 'operator' : 'advertiser'
      setActiveModeState(mode)
      localStorage.removeItem('adgrid_signup_intent')
      supabase.from('profiles').update({ active_mode: mode }).eq('id', userId).then(() => {})

      // Screen-invite conversion: set by ScreenInvitePage's "Get Started"
      // button at localStorage.setItem time, well before signUp() ran --
      // localStorage (not sessionStorage) is required here because email
      // confirmation is mandatory in this project (see LoginPage's "Check
      // your email to confirm your account" message) and the confirmation
      // click can land back in a fresh tab/session, which sessionStorage
      // would not survive.
      const inviteToken = localStorage.getItem('adgrid_screen_invite_token')
      if (inviteToken) {
        localStorage.removeItem('adgrid_screen_invite_token')
        // Awaited (not fire-and-forget): Task 11's AppInner reads
        // sessionStorage.adgrid_preset_screen_id via a lazy useState
        // initializer that only runs once, at first mount -- which happens
        // as soon as fetchProfile resolves and loading flips to false. The
        // sessionStorage write below must land before that happens, or
        // Task 11 can never see it.
        try {
          const { data: { session } } = await supabase.auth.getSession()
          if (session) {
            const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/accept-screen-invite`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
              body: JSON.stringify({ token: inviteToken }),
            })
            const result = res.ok ? await res.json() : null
            if (result?.screen_id) {
              sessionStorage.setItem('adgrid_preset_screen_id', result.screen_id)
              sessionStorage.setItem('adgrid_pending_screen_invite_token', inviteToken)
            }
          }
        } catch {
          // best-effort -- any failure (getSession, fetch, json parse) must never block login
        }
      }
    } else {
      setActiveModeState(data?.active_mode ?? 'advertiser')
    }
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
    const params   = new URLSearchParams(window.location.search)
    const code     = params.get('code')
    // Supabase appends `type=recovery` to password-reset redirect URLs.
    // Exchanging the code still gives the client a working session (needed
    // for updatePassword()), but we must NOT surface it as a real login —
    // otherwise clicking a reset-password email logs the user straight in
    // without ever verifying/changing the password.
    const isRecovery = params.get('type') === 'recovery'

    const init = async () => {
      if (code) {
        await supabase.auth.exchangeCodeForSession(code)
        window.history.replaceState({}, '', window.location.pathname)
      }
      if (isRecovery) {
        setLoading(false)
        return
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') { setPasswordRecovery(true); return; }
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

  async function signUp(email, password, name, tosAcceptedAt) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name, tos_accepted_at: tosAcceptedAt ?? new Date().toISOString() } },
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
    sessionStorage.removeItem('adgrid_hub_visited')
    sessionStorage.removeItem('adgrid_preset_screen_id')
    sessionStorage.removeItem('adgrid_pending_screen_invite_token')
  }

  async function signInWithOAuth(provider) {
    const redirectTo = window.location.origin
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo },
    })
    return { data, error }
  }

  async function resetPasswordForEmail(email) {
    return supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin })
  }

  async function updatePassword(password) {
    const result = await supabase.auth.updateUser({ password })
    if (!result.error) {
      setPasswordRecovery(false)
      // Never let a recovery-link session flow straight into the app —
      // end it and require a fresh sign-in with the new password.
      await signOut()
    }
    return result
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
    if (!error && user) await fetchGrants(user.id)
    return { error }
  }

  async function revokeGrant(grantId) {
    const revokedAccountId = grants.find(g => g.id === grantId)?.account_id
    const { error } = await supabase
      .from('account_grants')
      .update({ status: 'revoked' })
      .eq('id', grantId)
    if (!error) {
      setGrants(prev => prev.filter(g => g.id !== grantId))
      if (activeAccount?.id && revokedAccountId === activeAccount.id) {
        setActiveAccount(null)
      }
    }
    return { error }
  }

  return (
    <AuthContext.Provider value={{
      user, profile, activeMode, loading,
      activeAccount, grants, passwordRecovery,
      signUp, signIn, signOut, signInWithOAuth,
      resetPasswordForEmail, updatePassword,
      setActiveMode, setActiveAccount, acceptGrant, revokeGrant,
      refreshGrants: () => user ? fetchGrants(user.id) : Promise.resolve(),
      refreshProfile: () => user ? fetchProfile(user.id) : Promise.resolve(),
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
