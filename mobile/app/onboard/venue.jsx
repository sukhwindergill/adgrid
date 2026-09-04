import { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useOnboard } from '../../context/OnboardContext';
import { supabase } from '../../lib/supabase';
import { WizardProgress } from '../../components/onboard/WizardProgress';
import { Btn } from '../../components/ui/Btn';
import { Inp } from '../../components/ui/Inp';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { C, F } from '../../lib/tokens';
import { VENUE_TAXONOMY, STATE_LABEL, STATE_TIMEZONE } from '@adgrid/core';

export default function VenueScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const { form, update } = useOnboard();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const categories = Object.entries(VENUE_TAXONOMY).map(([k, v]) => ({ value: k, label: v.label }));
  const subtypes = form.venue_category ? VENUE_TAXONOMY[form.venue_category]?.subtypes || [] : [];

  async function handleNext() {
    if (!form.name.trim()) { setError('Screen name is required'); return; }
    if (!form.venue_category) { setError('Venue category is required'); return; }
    if (!form.city.trim()) { setError('City is required'); return; }
    setError('');
    setLoading(true);
    const { data, error: err } = await supabase
      .from('screens')
      .insert({ operator_id: profile?.id, name: form.name.trim(), venue_category: form.venue_category, venue_subtype: form.venue_subtype || null, city: form.city.trim(), state: form.state.trim() || null, country: form.country, status: 'pending' })
      .select().single();
    setLoading(false);
    if (err) { setError(err.message); return; }
    update({ screenId: data?.id });
    router.push('/onboard/hours');
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <WizardProgress step={2} />
        <Text style={[styles.title, { fontFamily: F.sansBold }]}>About your screen</Text>
        <ErrorBanner message={error} />
        <Inp label="Screen name" value={form.name} onChangeText={v => update({ name: v })} placeholder="e.g. Main Lobby Screen" autoCapitalize="words" />
        <Inp label="City" value={form.city} onChangeText={v => update({ city: v })} placeholder="Toronto" autoCapitalize="words" />
        <Inp label={STATE_LABEL[form.country] || 'Province'} value={form.state} onChangeText={v => {
          // Best-effort auto-fill: only overrides timezone on an exact
          // province-name match (case-insensitive) against STATE_TIMEZONE,
          // matching what the hint text on the next step actually promises
          // -- this used to just claim auto-detection while timezone always
          // stayed the static 'America/Toronto' default.
          const zones = STATE_TIMEZONE[form.country] || {};
          const matchKey = Object.keys(zones).find(k => k.toLowerCase() === v.trim().toLowerCase());
          update(matchKey ? { state: v, timezone: zones[matchKey] } : { state: v });
        }} placeholder="Ontario" autoCapitalize="words" />
        <Text style={[styles.fieldLabel, { fontFamily: F.sansMed }]}>Venue category</Text>
        <View style={styles.pills}>
          {categories.map(cat => (
            <TouchableOpacity key={cat.value} onPress={() => update({ venue_category: cat.value, venue_subtype: '' })}
              accessibilityRole="button" accessibilityState={{ selected: form.venue_category === cat.value }}
              style={[styles.pill, { borderColor: form.venue_category === cat.value ? C.purple : C.border, backgroundColor: form.venue_category === cat.value ? C.purpleSoft : C.surface }]}>
              <Text style={[styles.pillText, { fontFamily: F.sansMed, color: form.venue_category === cat.value ? C.purple : C.textSub }]}>{cat.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {subtypes.length > 0 && (
          <>
            <Text style={[styles.fieldLabel, { fontFamily: F.sansMed }]}>Venue type</Text>
            <View style={styles.pills}>
              {subtypes.map(sub => (
                <TouchableOpacity key={sub} onPress={() => update({ venue_subtype: sub })}
                  accessibilityRole="button" accessibilityState={{ selected: form.venue_subtype === sub }}
                  style={[styles.pill, { borderColor: form.venue_subtype === sub ? C.purple : C.border, backgroundColor: form.venue_subtype === sub ? C.purpleSoft : C.surface }]}>
                  <Text style={[styles.pillText, { fontFamily: F.sansMed, color: form.venue_subtype === sub ? C.purple : C.textSub }]}>{sub}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}
        <Btn onPress={handleNext} loading={loading} size="lg" style={{ marginTop: 24 }}>Next</Btn>
        <Btn variant="ghost" onPress={() => router.back()} style={{ marginTop: 10 }}>Back</Btn>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 24 },
  title: { fontSize: 22, color: C.text, marginBottom: 20 },
  fieldLabel: { fontSize: 13, color: C.textMid, marginBottom: 8, marginTop: 8, fontWeight: '500' },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  pill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  pillText: { fontSize: 12 },
});
