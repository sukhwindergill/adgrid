import { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useOnboard } from '../../context/OnboardContext';
import { supabase } from '../../lib/supabase';
import { WizardProgress } from '../../components/onboard/WizardProgress';
import { Btn } from '../../components/ui/Btn';
import { C, F } from '../../lib/tokens';

export default function ConnectScreen() {
  const router = useRouter();
  const { form, reset } = useOnboard();
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [checking, setChecking] = useState(false);
  const [connStatus, setConnStatus] = useState('idle'); // 'idle' | 'ok' | 'none'

  useEffect(() => {
    async function loadToken() {
      const { data, error: err } = await supabase.rpc('get_screen_token', { p_screen_id: form.screenId });
      if (err || !data) setError(true);
      else setToken(data);
      setLoading(false);
    }
    loadToken();
  }, [form.screenId]);

  async function checkConnection() {
    setChecking(true);
    const since = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from('display_heartbeats')
      .select('id')
      .eq('screen_id', form.screenId)
      .gte('created_at', since)
      .limit(1);
    setConnStatus(data && data.length > 0 ? 'ok' : 'none');
    setChecking(false);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={styles.wrap}>
        <WizardProgress step={5} />
        <Text style={[styles.title, { fontFamily: F.sansBold }]}>Connect your display</Text>
        <Text style={[styles.sub, { fontFamily: F.sans }]}>
          Your screen has a unique token. Enter it in your display device's setup (or paste
          it into the AdGrid web dashboard's Setup Guide for full install steps) — the ad
          player uses it to know which screen it is.
        </Text>

        {loading && <Text style={[styles.sub, { fontFamily: F.sans }]}>Loading your token…</Text>}

        {!loading && error && (
          <Text style={[styles.errorText, { fontFamily: F.sans }]}>
            Couldn't load your screen token. Check your connection and try again from the
            Screens tab.
          </Text>
        )}

        {!loading && !error && (
          <>
            <View style={styles.tokenBox}>
              <Text selectable style={[styles.token, { fontFamily: F.sansMed }]}>{token}</Text>
            </View>
            <Text style={[styles.hint, { fontFamily: F.sans }]}>
              Long-press the token above to copy it.
            </Text>

            <Btn variant="secondary" onPress={checkConnection} loading={checking} style={{ marginTop: 20 }}>
              Check Connection
            </Btn>
            {connStatus === 'ok' && (
              <Text style={[styles.okText, { fontFamily: F.sans }]}>✓ Connected — heartbeat received</Text>
            )}
            {connStatus === 'none' && (
              <Text style={[styles.hint, { fontFamily: F.sans }]}>No heartbeat yet — that's expected until the display device is configured.</Text>
            )}
          </>
        )}

        <Btn onPress={() => { reset(); router.replace('/(tabs)/screens'); }} size="lg" style={{ marginTop: 24 }}>
          Done
        </Btn>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 24 },
  title: { fontSize: 20, color: C.text, marginBottom: 8 },
  sub: { fontSize: 13, color: C.textSub, lineHeight: 18, marginBottom: 20 },
  hint: { fontSize: 12, color: C.textMuted, marginTop: 8 },
  errorText: { fontSize: 13, color: C.red },
  tokenBox: { backgroundColor: C.surfaceAlt, borderWidth: 1, borderColor: C.border, borderRadius: 8, padding: 14 },
  token: { fontSize: 15, color: C.text, letterSpacing: 0.5 },
  okText: { fontSize: 13, color: C.green, marginTop: 8 },
});
