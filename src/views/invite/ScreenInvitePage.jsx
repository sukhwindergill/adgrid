import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase.js';
import { SUPABASE_FUNCTIONS_URL } from '../../lib/constants.js';
import { C, F } from '../../design/tokens.js';
import { Card } from '../../components/primitives/Card.jsx';
import { Btn } from '../../components/primitives/Btn.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { IconScreen } from '../../components/icons.jsx';

export function ScreenInvitePage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [state, setState] = useState('loading'); // loading | invalid | error | booked | valid
  const [screen, setScreen] = useState(null);

  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: invite, error: inviteError } = await supabase
        .from('screen_invites')
        .select('screen_id, status')
        .eq('token', token)
        .single();

      if (cancelled) return;
      if (inviteError) { setState('error'); return; }
      if (!invite) { setState('invalid'); return; }
      if (invite.status === 'booked') { setState('booked'); return; }

      const { data: screenRow, error: screenError } = await supabase
        .from('screens')
        .select('id, name, city, venue_category, screen_photos')
        .eq('id', invite.screen_id)
        .single();

      if (cancelled) return;
      if (screenError) { setState('error'); return; }
      if (!screenRow) { setState('invalid'); return; }
      setScreen(screenRow);
      setState('valid');

      // Fire-and-forget view tracking -- must never block rendering the page.
      fetch(`${SUPABASE_FUNCTIONS_URL}/record-screen-invite-view`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      }).catch(() => {});
    })();
    return () => { cancelled = true; };
  }, [token, retryCount]);

  const getStarted = async () => {
    if (user) {
      // Already signed in -- signup can't run, so consume the invite
      // directly with the existing session instead of routing through
      // /login (PublicOnlyRoute would just bounce them straight back to
      // /app without ever calling accept-screen-invite, silently
      // orphaning the token).
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/accept-screen-invite`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
            body: JSON.stringify({ token }),
          });
          if (res.ok) {
            const result = await res.json();
            if (result?.screen_id) {
              sessionStorage.setItem('adgrid_preset_screen_id', result.screen_id);
              sessionStorage.setItem('adgrid_pending_screen_invite_token', token);
            }
          }
        }
      } catch {
        // best-effort -- fall through to /app regardless
      }
      navigate('/app');
      return;
    }
    localStorage.setItem('adgrid_screen_invite_token', token);
    navigate('/login?mode=signup&intent=advertiser');
  };

  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <Card style={{ maxWidth: 460, padding: 36, textAlign: 'center' }}>
        {state === 'loading' && (
          <div style={{ fontSize: 14, color: C.textSub, fontFamily: F.sans }}>Loading…</div>
        )}
        {state === 'error' && (
          <>
            <div style={{ fontSize: 15, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 8 }}>
              Something went wrong loading this invite
            </div>
            <div style={{ fontSize: 13, color: C.textSub, fontFamily: F.sans, marginBottom: 20 }}>
              This is likely a temporary connection issue. Try again.
            </div>
            <Btn onClick={() => { setState('loading'); setRetryCount((n) => n + 1); }}>Try again</Btn>
          </>
        )}
        {state === 'invalid' && (
          <>
            <div style={{ fontSize: 15, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 8 }}>
              This invite link isn't valid
            </div>
            <div style={{ fontSize: 13, color: C.textSub, fontFamily: F.sans, marginBottom: 20 }}>
              It may have been mistyped. You can still explore AdGrid directly.
            </div>
            <Btn onClick={() => navigate('/')}>Go to AdGrid →</Btn>
          </>
        )}
        {state === 'booked' && (
          <>
            <div style={{ fontSize: 15, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 8 }}>
              This invite has already been used
            </div>
            <div style={{ fontSize: 13, color: C.textSub, fontFamily: F.sans, marginBottom: 20 }}>
              Someone already booked this screen through this link. You can still sign up directly.
            </div>
            <Btn onClick={() => navigate('/login?mode=signup&intent=advertiser')}>Sign up →</Btn>
          </>
        )}
        {state === 'valid' && screen && (
          <>
            <div style={{ color: C.purple, marginBottom: 12, display: 'flex', justifyContent: 'center' }}><IconScreen size={36} /></div>
            <div style={{ fontSize: 15, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 4 }}>
              You've been invited to advertise on
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: C.purple, fontFamily: F.sans, marginBottom: 4 }}>
              {screen.name}
            </div>
            <div style={{ fontSize: 13, color: C.textSub, fontFamily: F.sans, marginBottom: 24 }}>
              {screen.city}{screen.venue_category ? ` · ${screen.venue_category}` : ''}
            </div>
            <Btn onClick={getStarted} style={{ width: '100%' }}>Get Started →</Btn>
          </>
        )}
      </Card>
    </div>
  );
}
