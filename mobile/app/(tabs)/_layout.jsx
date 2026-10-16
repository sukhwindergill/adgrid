import { Tabs, useRouter } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { C, F } from '../../lib/tokens';
import { useAuth } from '../../context/AuthContext';
import { useScreens } from '../../hooks/useScreens';
import { useApprovals } from '../../hooks/useApprovals';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import { routeForNotification } from '../../lib/notificationRoute';

function TabIcon({ icon, focused, badgeCount }) {
  return (
    <View style={styles.iconWrap}>
      <Text style={[styles.icon, { opacity: focused ? 1 : 0.45 }]}>{icon}</Text>
      {badgeCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badgeCount > 99 ? '99+' : badgeCount}</Text>
        </View>
      )}
    </View>
  );
}

export default function TabsLayout() {
  const router = useRouter();
  const { profile, activeMode, setActiveMode } = useAuth();
  const isAdvertiser = activeMode === 'advertiser';
  // Operator data is only needed for the operator tab bar's badge -- skip
  // the queries (and the approvals realtime channel) in advertiser mode.
  const operatorId = isAdvertiser ? null : profile?.id;
  const { screens } = useScreens(operatorId);
  const screenIds = screens.map(s => s.id);
  const { pendingCount } = useApprovals(operatorId, screenIds);
  // Push tokens are keyed by profile id, so one registration covers both
  // modes; the tap handler picks the destination (and mode) per payload.
  usePushNotifications(profile?.id, response => {
    const { mode, path } = routeForNotification(response);
    if (mode !== activeMode) setActiveMode(mode);
    router.push(path);
  });
  // href: null hides a route from the tab bar without unmounting the
  // navigator, so each mode shows only its own tabs.
  const operatorOnly = isAdvertiser ? { href: null } : {};
  const advertiserOnly = isAdvertiser ? {} : { href: null };

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: C.surface, borderTopColor: C.border, height: 60, paddingBottom: 8 },
        tabBarActiveTintColor: C.purple,
        tabBarInactiveTintColor: C.textMuted,
        tabBarLabelStyle: { fontFamily: F.sansMed, fontSize: 10 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          ...operatorOnly,
          title: 'Home',
          tabBarIcon: ({ focused }) => <TabIcon icon="🏠" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="screens"
        options={{
          ...operatorOnly,
          title: 'Screens',
          tabBarIcon: ({ focused }) => <TabIcon icon="📺" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="approvals"
        options={{
          ...operatorOnly,
          title: 'Approvals',
          tabBarIcon: ({ focused }) => <TabIcon icon="✅" focused={focused} badgeCount={pendingCount} />,
        }}
      />
      <Tabs.Screen
        name="revenue"
        options={{
          ...operatorOnly,
          title: 'Revenue',
          tabBarIcon: ({ focused }) => <TabIcon icon="💰" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="campaigns"
        options={{
          ...advertiserOnly,
          title: 'Campaigns',
          tabBarIcon: ({ focused }) => <TabIcon icon="📣" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          tabBarIcon: ({ focused }) => <TabIcon icon="⋯" focused={focused} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrap: { alignItems: 'center', justifyContent: 'center', position: 'relative' },
  icon: { fontSize: 20 },
  badge: { position: 'absolute', top: -4, right: -10, backgroundColor: C.red, borderRadius: 8, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },
});
