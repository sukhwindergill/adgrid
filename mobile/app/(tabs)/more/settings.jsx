import { useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../../context/AuthContext';
import { supabase } from '../../../lib/supabase';
import { Inp } from '../../../components/ui/Inp';
import { Btn } from '../../../components/ui/Btn';
import { Card } from '../../../components/ui/Card';
import { PageHeader } from '../../../components/ui/PageHeader';
import { ErrorBanner } from '../../../components/ui/ErrorBanner';
import { C, F } from '../../../lib/tokens';

export default function SettingsScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const [name, setName] = useState(profile?.full_name || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  async function handleSave() {
    if (!name.trim()) { setError('Name is required'); return; }
    setError(''); setSaving(true);
    const { error: err } = await supabase.from('profiles').update({ full_name: name.trim() }).eq('id', profile.id);
    setSaving(false);
    if (err) setError(err.message);
    else { setSuccess(true); setTimeout(() => setSuccess(false), 2000); }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Btn variant="ghost" onPress={() => router.back()} style={styles.back}>← Back</Btn>
        <PageHeader title="Settings" subtitle="Your account preferences" />
        <Card style={styles.card}>
          <Text style={[styles.cardTitle, { fontFamily: F.sansSemi }]}>Profile</Text>
          <ErrorBanner message={error} />
          {success && (
            <View style={styles.successBanner}>
              <Text style={[{ fontFamily: F.sans, color: C.green, fontSize: 13 }]}>✓ Saved</Text>
            </View>
          )}
          <Inp label="Full name" value={name} onChangeText={setName} placeholder="Your name" autoCapitalize="words" />
          <Inp label="Email" value={profile?.email || ''} onChangeText={() => {}} editable={false} />
          <Btn onPress={handleSave} loading={saving}>Save changes</Btn>
        </Card>
        <Card style={styles.card}>
          <Text style={[styles.cardTitle, { fontFamily: F.sansSemi }]}>Account</Text>
          <Text style={[styles.infoText, { fontFamily: F.sans }]}>
            To delete your account or change your email, contact support at support@adgrid.io
          </Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 40 },
  back: { marginBottom: 12, paddingHorizontal: 0 },
  card: { marginBottom: 16 },
  cardTitle: { fontSize: 15, color: C.text, marginBottom: 12 },
  infoText: { fontSize: 13, color: C.textSub, lineHeight: 20 },
  successBanner: { backgroundColor: C.greenSoft, borderWidth: 1, borderColor: C.greenBorder, borderRadius: 8, padding: 10, marginBottom: 12 },
});
