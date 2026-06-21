import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { C, F } from '../../../lib/tokens';
export default function MoreScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ flex: 1, padding: 20 }}>
        <Text style={{ fontFamily: F.sansBold, fontSize: 22, color: C.text }}>More</Text>
        <Text style={{ fontFamily: F.sans, color: C.textSub, marginTop: 8 }}>Coming soon</Text>
      </View>
    </SafeAreaView>
  );
}
