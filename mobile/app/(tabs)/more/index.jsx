import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../../context/AuthContext';
import * as Linking from 'expo-linking';
import { usePushNotifications } from '../../../hooks/usePushNotifications';
import { ModeSwitch } from '../../../components/ui/ModeSwitch';
import { CREATE_CAMPAIGN_URL } from '../../../lib/webApp';
import { C, F } from '../../../lib/tokens';

const OPERATOR_MENU = [
  { icon: '📊', label: 'Analytics', route: '/(tabs)/more/analytics' },
  { icon: '🏢', label: 'Advertisers', route: '/(tabs)/more/advertisers' },
  { icon: '💳', label: 'Billing', route: '/(tabs)/more/billing' },
  { icon: '⚙️', label: 'Settings', route: '/(tabs)/more/settings' },
];

const ADVERTISER_MENU = [
  { icon: '➕', label: 'Create campaign on web', url: CREATE_CAMPAIGN_URL },
  { icon: '⚙️', label: 'Settings', route: '/(tabs)/more/settings' },
];

export default function MoreScreen() {
  const router = useRouter();
  const { profile, signOut, activeMode, setActiveMode } = useAuth();
  const { deregister } = usePushNotifications(profile?.id);
  const menuItems = activeMode === 'advertiser' ? ADVERTISER_MENU : OPERATOR_MENU;

  async function switchMode(mode) {
    await setActiveMode(mode);
    router.replace(mode === 'advertiser' ? '/(tabs)/campaigns' : '/(tabs)');
  }

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
                {(profile.name || 'O')[0].toUpperCase()}
              </Text>
            </View>
            <View>
              <Text style={[styles.profileName, { fontFamily: F.sansSemi }]}>{profile.name}</Text>
              <Text style={[styles.profileEmail, { fontFamily: F.sans }]}>{profile.email}</Text>
            </View>
          </View>
        )}
        {activeMode && <ModeSwitch value={activeMode} onChange={switchMode} />}
        <View style={styles.menu}>
          {menuItems.map((item, idx) => (
            <TouchableOpacity key={item.label}
              onPress={() => (item.url ? Linking.openURL(item.url) : router.push(item.route))}
              accessibilityRole={item.url ? 'link' : 'button'} accessibilityLabel={item.label}
              style={[styles.menuItem, idx < menuItems.length - 1 && { borderBottomWidth: 1, borderBottomColor: C.border }]}>
              <Text style={styles.menuIcon}>{item.icon}</Text>
              <Text style={[styles.menuLabel, { fontFamily: F.sansMed }]}>{item.label}</Text>
              <Text style={styles.menuChevron}>{item.url ? '↗' : '›'}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity onPress={handleSignOut} accessibilityRole="button" accessibilityLabel="Sign out" style={styles.signOut}>
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
