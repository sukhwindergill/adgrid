import { useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useOnboard } from '../../context/OnboardContext';
import { supabase } from '../../lib/supabase';
import { WizardProgress } from '../../components/onboard/WizardProgress';
import { Btn } from '../../components/ui/Btn';
import { Inp } from '../../components/ui/Inp';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { C, F } from '../../lib/tokens';

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export default function HoursScreen() {
  const router = useRouter();
  const { form, update } = useOnboard();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleNext() {
    if (!TIME_RE.test(form.operating_hours_start) || !TIME_RE.test(form.operating_hours_end)) {
      setError('Enter times as HH:MM, e.g. 08:00');
      return;
    }
    if (form.operating_hours_start >= form.operating_hours_end) {
      setError('Start time must be before end time');
      return;
    }
    setError('');
    setLoading(true);
    const { error: err } = await supabase.from('screens').update({
      operating_hours_start: form.operating_hours_start,
      operating_hours_end: form.operating_hours_end,
      timezone: form.timezone,
    }).eq('id', form.screenId);
    setLoading(false);
    if (err) { setError(err.message); return; }
    router.push('/onboard/photos');
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <WizardProgress step={3} />
        <Text style={[styles.title, { fontFamily: F.sansBold }]}>Operating hours</Text>
        <Text style={[styles.sub, { fontFamily: F.sans }]}>When is your screen on and showing ads?</Text>
        <ErrorBanner message={error} />
        <Inp label="Start time (HH:MM)" value={form.operating_hours_start} onChangeText={v => update({ operating_hours_start: v })} placeholder="08:00" keyboardType="numbers-and-punctuation" />
        <Inp label="End time (HH:MM)" value={form.operating_hours_end} onChangeText={v => update({ operating_hours_end: v })} placeholder="22:00" keyboardType="numbers-and-punctuation" />
        <Inp label="Timezone (IANA)" value={form.timezone} onChangeText={v => update({ timezone: v })} placeholder="America/Toronto" />
        <Text style={[styles.hint, { fontFamily: F.sans }]}>Timezone is auto-detected from your province/region.</Text>
        <Btn onPress={handleNext} loading={loading} size="lg" style={{ marginTop: 24 }}>Next</Btn>
        <Btn variant="ghost" onPress={() => router.back()} style={{ marginTop: 10 }}>Back</Btn>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 24 },
  title: { fontSize: 22, color: C.text, marginBottom: 8 },
  sub: { fontSize: 14, color: C.textSub, marginBottom: 20, lineHeight: 20 },
  hint: { fontSize: 12, color: C.textMuted, marginTop: -8 },
});
