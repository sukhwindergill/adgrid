import { useState, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useOnboard } from '../../context/OnboardContext';
import { supabase } from '../../lib/supabase';
import { WizardProgress } from '../../components/onboard/WizardProgress';
import { Btn } from '../../components/ui/Btn';
import { C, F } from '../../lib/tokens';

export default function ConnectScreen() {
  const router = useRouter();
  const { form, reset } = useOnboard();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState('');
  const lastScanRef = useRef(null);

  async function handleScan({ data }) {
    if (scanned || connecting || data === lastScanRef.current) return;
    lastScanRef.current = data;
    setScanned(true);
    setConnecting(true);
    setError('');
    const { error: err } = await supabase
      .from('screens')
      .update({ screen_token: data, status: 'active' })
      .eq('id', form.screenId);
    setConnecting(false);
    if (err) {
      setError('Could not connect screen. Check the QR code and try again.');
      setScanned(false);
      lastScanRef.current = null;
    } else {
      setConnected(true);
    }
  }

  if (!permission) return null;

  if (!permission.granted) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg, padding: 24 }}>
        <WizardProgress step={5} />
        <Text style={[styles.title, { fontFamily: F.sansBold }]}>Camera access needed</Text>
        <Text style={[styles.sub, { fontFamily: F.sans }]}>Allow camera access to scan your screen's QR code.</Text>
        <Btn onPress={requestPermission} size="lg">Allow Camera</Btn>
      </SafeAreaView>
    );
  }

  if (connected) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg, padding: 24, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 64, marginBottom: 20 }}>✅</Text>
        <Text style={[styles.title, { fontFamily: F.sansBold, textAlign: 'center' }]}>Connected!</Text>
        <Text style={[styles.sub, { fontFamily: F.sans, textAlign: 'center', marginBottom: 40 }]}>
          Your screen is on the AdGrid network and ready to display ads.
        </Text>
        <Btn onPress={() => { reset(); router.replace('/(tabs)/screens'); }} size="lg">View My Screens</Btn>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }}>
      <View style={styles.scanWrap}>
        <WizardProgress step={5} />
        <Text style={[styles.scanTitle, { fontFamily: F.sansBold }]}>Connect your display</Text>
        <Text style={[styles.scanSub, { fontFamily: F.sans }]}>
          Scan the QR code shown on your screen device (TV/monitor running AdGrid display software)
        </Text>
        <CameraView
          style={styles.camera}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={scanned ? undefined : handleScan}
        >
          <View style={styles.overlay}>
            <View style={styles.finder} />
          </View>
        </CameraView>
        {connecting && <Text style={[styles.hint, { fontFamily: F.sans }]}>Connecting…</Text>}
        {!!error && <Text style={[styles.errorText, { fontFamily: F.sans }]}>{error}</Text>}
        {scanned && !connecting && !connected && (
          <Btn variant="secondary" onPress={() => { setScanned(false); lastScanRef.current = null; }} style={{ marginTop: 16 }}>Scan Again</Btn>
        )}
        <Btn variant="ghost" onPress={() => router.back()} style={{ marginTop: 16 }}>Back</Btn>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scanWrap: { flex: 1, padding: 24 },
  scanTitle: { fontSize: 20, color: '#fff', marginBottom: 8 },
  scanSub: { fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 18, marginBottom: 20 },
  camera: { width: '100%', aspectRatio: 1, borderRadius: 12, overflow: 'hidden', marginBottom: 16 },
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  finder: { width: 200, height: 200, borderWidth: 2, borderColor: C.purple, borderRadius: 12 },
  hint: { color: 'rgba(255,255,255,0.7)', textAlign: 'center', marginTop: 8 },
  errorText: { color: C.red, textAlign: 'center', marginTop: 8 },
  title: { fontSize: 22, color: C.text, marginBottom: 8 },
  sub: { fontSize: 14, color: C.textSub, marginBottom: 20, lineHeight: 20 },
});
