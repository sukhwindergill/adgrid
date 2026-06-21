import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../../context/AuthContext';
import { usePushNotifications } from '../../../hooks/usePushNotifications';
import { C, F } from '../../../lib/tokens';

const MENU_ITEMS = [
  { icon: '📊', label: 'Analytics', route: '/(tabs)/more/analytics' },
  { icon: '🏢', label: 'Advertisers', route: '/(tabs)/more/advertisers' },
  { icon: '💳', label: 'Billing', route: '/(tabs)/more/billing' },
  { icon: '⚙️', label: 'Settings', route: '/(tabs)/more/settings' },
];

export default function MoreScreen() {
  const router = useRouter();
  const { profile, signOut } = useAuth();
  const { deregister } = usePushNotifications(profile?.id);

  async function handleSignOut() {
    Alert.alert('Sign out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: async () => {
        if (profile?.id) await deregister(profile.id);
        await signOut();
      }},
    ]);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={[styles.title, { fontFamily: F.sansBold }]}>More</Text>
        {profile && (
          <View style={styles.profileRow}>
            <View style={styles.avatar}>
              <Text style={[styles.avatarText, { fontFamily: F.sansBold }]}>
                {(profile.full_name || 'O')[0].toUpperCase()}
              </Text>
            </View>
            <View>
              <Text style={[styles.profileName, { fontFamily: F.sansSemi }]}>{profile.full_name}</Text>
              <Text style={[styles.profileEmail, { fontFamily: F.sans }]}>{profile.email}</Text>
            </View>
          </View>
        )}
        <View style={styles.menu}>
          {MENU_ITEMS.map((item, idx) => (
            <TouchableOpacity key={item.route} onPress={() => router.push(item.route)}
              style={[styles.menuItem, idx < MENU_ITEMS.length - 1 && { borderBottomWidth: 1, borderBottomColor: C.border }]}>
              <Text style={styles.menuIcon}>{item.icon}</Text>
              <Text style={[styles.menuLabel, { fontFamily: F.sansMed }]}>{item.label}</Text>
              <Text style={styles.menuChevron}>›</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity onPress={handleSignOut} style={styles.signOut}>
          <Text style={[styles.signOutText, { fontFamily: F.sansMed }]}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 22, color: C.text, marginBottom: 20 },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 28, padding: 16, backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.border },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.purpleSoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 18, color: C.purple },
  profileName: { fontSize: 15, color: C.text },
  profileEmail: { fontSize: 12, color: C.textSub, marginTop: 2 },
  menu: { backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.border, overflow: 'hidden', marginBottom: 24 },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  menuIcon: { fontSize: 18, marginRight: 14 },
  menuLabel: { flex: 1, fontSize: 15, color: C.text },
  menuChevron: { fontSize: 20, color: C.textMuted },
  signOut: { padding: 16, alignItems: 'center' },
  signOutText: { fontSize: 15, color: C.red },
});
