import { Tabs } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { C, F } from '../../lib/tokens';

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
          title: 'Home',
          tabBarIcon: ({ focused }) => <TabIcon icon="🏠" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="screens"
        options={{
          title: 'Screens',
          tabBarIcon: ({ focused }) => <TabIcon icon="📺" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="approvals"
        options={{
          title: 'Approvals',
          tabBarIcon: ({ focused }) => <TabIcon icon="✅" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="revenue"
        options={{
          title: 'Revenue',
          tabBarIcon: ({ focused }) => <TabIcon icon="💰" focused={focused} />,
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
