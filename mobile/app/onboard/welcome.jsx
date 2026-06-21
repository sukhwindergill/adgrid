import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WizardProgress } from '../../components/onboard/WizardProgress';
import { Btn } from '../../components/ui/Btn';
import { C, F } from '../../lib/tokens';

export default function WelcomeScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <WizardProgress step={1} />
        <Text style={styles.emoji}>📺</Text>
        <Text style={[styles.title, { fontFamily: F.sansBold }]}>Let's get your screen on the network</Text>
        <Text style={[styles.sub, { fontFamily: F.sans }]}>
          ADGRID connects your display to advertisers who pay to reach your audience. Setup takes about 5 minutes.
        </Text>
        <View style={styles.bullets}>
          {['Register your screen details', 'Set operating hours', 'Upload a photo', 'Scan QR to connect your display'].map(item => (
            <View key={item} style={styles.bullet}>
              <Text style={{ color: C.purple, fontSize: 18, lineHeight: 22 }}>•</Text>
              <Text style={[styles.bulletText, { fontFamily: F.sans }]}>{item}</Text>
            </View>
          ))}
        </View>
        <Btn onPress={() => router.push('/onboard/venue')} size="lg">Get Started</Btn>
        <Btn variant="ghost" onPress={() => router.back()} style={{ marginTop: 12 }}>Cancel</Btn>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 24, paddingTop: 20 },
  emoji: { fontSize: 52, textAlign: 'center', marginBottom: 20 },
  title: { fontSize: 24, color: C.text, textAlign: 'center', marginBottom: 12 },
  sub: { fontSize: 15, color: C.textSub, textAlign: 'center', lineHeight: 22, marginBottom: 28 },
  bullets: { marginBottom: 32, gap: 10 },
  bullet: { flexDirection: 'row', gap: 10 },
  bulletText: { fontSize: 14, color: C.textSub, flex: 1, lineHeight: 22 },
});
