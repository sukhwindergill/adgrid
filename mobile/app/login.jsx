import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../context/AuthContext';
import { Inp } from '../components/ui/Inp';
import { Btn } from '../components/ui/Btn';
import { ErrorBanner } from '../components/ui/ErrorBanner';
import { C, F, gradColors, gradStart, gradEnd } from '../lib/tokens';

const CODE_RE = /^\d{6}$/;

export default function LoginScreen() {
  const { signIn, resetPasswordForEmail, verifyRecoveryCode, updatePassword } = useAuth();
  const [mode, setMode] = useState('signin'); // 'signin' | 'forgot' | 'code'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
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
    if (authError) setError(authError.message);
  }

  async function handleForgot() {
    if (!email.includes('@')) {
      setError('Enter a valid email address.');
      return;
    }
    setError(''); setSuccess(''); setLoading(true);
    const { error: err } = await resetPasswordForEmail(email.trim());
    setLoading(false);
    if (err) { setError(err.message); return; }
    setSuccess('Check your email for a reset code.');
    setMode('code');
  }

  async function handleResetPassword() {
    if (!CODE_RE.test(code)) {
      setError('Enter the 6-digit code from your email.');
      return;
    }
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setError('');
    setLoading(true);
    if (!verified) {
      const { error: verifyErr } = await verifyRecoveryCode(email.trim(), code.trim());
      if (verifyErr) {
        setLoading(false);
        setError(verifyErr.message);
        return;
      }
      setVerified(true);
    }
    const { error: updateErr } = await updatePassword(newPassword);
    setLoading(false);
    if (updateErr) { setError(updateErr.message); return; }
    setMode('signin');
    setPassword('');
    setCode('');
    setNewPassword('');
    setVerified(false);
    setSuccess('Password updated. You can now sign in.');
  }

  function startOver() {
    setMode('forgot');
    setCode(''); setNewPassword(''); setVerified(false);
    setError(''); setSuccess('');
  }

  function goToForgot() {
    setMode('forgot');
    setError(''); setSuccess('');
  }

  function backToSignIn() {
    setMode('signin');
    setError(''); setSuccess('');
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <LinearGradient colors={gradColors} start={gradStart} end={gradEnd} style={styles.strip} />
        <View style={styles.container}>
          <Text style={[styles.brand, { fontFamily: F.sansBold }]}>ADGRID</Text>
          <Text style={[styles.title, { fontFamily: F.sansBold }]}>
            {mode === 'forgot' ? 'Reset your password' : mode === 'code' ? 'Enter your code' : 'Operator Portal'}
          </Text>
          <Text style={[styles.sub, { fontFamily: F.sans }]}>
            {mode === 'forgot' ? "Enter your email and we'll send a reset code."
              : mode === 'code' ? 'Enter the 6-digit code we emailed you and choose a new password.'
              : 'Sign in to manage your screens'}
          </Text>
          <View style={styles.form}>
            <ErrorBanner message={error} />
            {!!success && !error && (
              <View style={styles.successBanner}>
                <Text style={[styles.successText, { fontFamily: F.sans }]}>{success}</Text>
              </View>
            )}

            {mode === 'signin' && (
              <>
                <Inp label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" />
                <Inp label="Password" value={password} onChangeText={setPassword} placeholder="Password" secureTextEntry />
                <Btn onPress={handleSignIn} loading={loading} size="lg">Sign in</Btn>
                <Btn variant="ghost" onPress={goToForgot} style={{ marginTop: 10 }}>Forgot password?</Btn>
              </>
            )}

            {mode === 'forgot' && (
              <>
                <Inp label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" />
                <Btn onPress={handleForgot} loading={loading} size="lg">Send reset code</Btn>
                <Btn variant="ghost" onPress={backToSignIn} style={{ marginTop: 10 }}>Back to sign in</Btn>
              </>
            )}

            {mode === 'code' && (
              <>
                <Inp label="6-digit code" value={code} onChangeText={setCode} placeholder="123456" keyboardType="number-pad" maxLength={6} />
                <Inp label="New password" value={newPassword} onChangeText={setNewPassword} placeholder="New password" secureTextEntry />
                <Btn onPress={handleResetPassword} loading={loading} size="lg">Reset password</Btn>
                <Btn variant="ghost" onPress={startOver} style={{ marginTop: 10 }}>Start over</Btn>
              </>
            )}
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
  successBanner: { backgroundColor: C.greenSoft, borderWidth: 1, borderColor: C.greenBorder, borderRadius: 8, padding: 12, marginBottom: 16 },
  successText: { color: C.green, fontSize: 13 },
});
