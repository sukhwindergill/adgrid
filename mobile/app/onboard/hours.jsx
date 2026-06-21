import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useOnboard } from '../../context/OnboardContext';
import { supabase } from '../../lib/supabase';
import { WizardProgress } from '../../components/onboard/WizardProgress';
import { Btn } from '../../components/ui/Btn';
import { Inp } from '../../components/ui/Inp';
import { C, F } from '../../lib/tokens';

export default function HoursScreen() {
  const router = useRouter();
  const { form, update } = useOnboard();

  async function handleNext() {
    await supabase.from('screens').update({
      operating_hours_start: form.operating_hours_start,
      operating_hours_end: form.operating_hours_end,
      timezone: form.timezone,
    }).eq('id', form.screenId);
    router.push('/onboard/photos');
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <WizardProgress step={3} />
        <Text style={[styles.title, { fontFamily: F.sansBold }]}>Operating hours</Text>
        <Text style={[styles.sub, { fontFamily: F.sans }]}>When is your screen on and showing ads?</Text>
        <Inp label="Start time (HH:MM)" value={form.operating_hours_start} onChangeText={v => update({ operating_hours_start: v })} placeholder="08:00" keyboardType="numbers-and-punctuation" />
        <Inp label="End time (HH:MM)" value={form.operating_hours_end} onChangeText={v => update({ operating_hours_end: v })} placeholder="22:00" keyboardType="numbers-and-punctuation" />
        <Inp label="Timezone (IANA)" value={form.timezone} onChangeText={v => update({ timezone: v })} placeholder="America/Toronto" />
        <Text style={[styles.hint, { fontFamily: F.sans }]}>Timezone is auto-detected from your province/region.</Text>
        <Btn onPress={handleNext} size="lg" style={{ marginTop: 24 }}>Next</Btn>
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
