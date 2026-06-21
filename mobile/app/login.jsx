import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../context/AuthContext';
import { Inp } from '../components/ui/Inp';
import { Btn } from '../components/ui/Btn';
import { ErrorBanner } from '../components/ui/ErrorBanner';
import { C, F, gradColors, gradStart, gradEnd } from '../lib/tokens';

export default function LoginScreen() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSignIn() {
    if (!email.trim() || !password.trim()) {
      setError('Email and password are required');
      return;
    }
    setError('');
    setLoading(true);
    const { error: authError } = await signIn(email.trim(), password);
    setLoading(false);
    if (authError) {
      setError(authError.message);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <LinearGradient colors={gradColors} start={gradStart} end={gradEnd} style={styles.strip} />
        <View style={styles.container}>
          <Text style={[styles.brand, { fontFamily: F.sansBold }]}>ADGRID</Text>
          <Text style={[styles.title, { fontFamily: F.sansBold }]}>Operator Portal</Text>
          <Text style={[styles.sub, { fontFamily: F.sans }]}>Sign in to manage your screens</Text>
          <View style={styles.form}>
            <ErrorBanner message={error} />
            <Inp
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
            />
            <Inp
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              secureTextEntry
            />
            <Btn onPress={handleSignIn} loading={loading} size="lg">
              Sign in
            </Btn>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, backgroundColor: C.bg },
  strip: { height: 6 },
  container: { flex: 1, padding: 24, paddingTop: 48 },
  brand: { fontSize: 13, color: C.purple, letterSpacing: 3, marginBottom: 8 },
  title: { fontSize: 28, color: C.text, marginBottom: 6 },
  sub: { fontSize: 15, color: C.textSub, marginBottom: 40 },
  form: { gap: 0 },
});
