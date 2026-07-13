import { View, FlatList, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../../context/AuthContext';
import { useScreens } from '../../../hooks/useScreens';
import { ScreenCard } from '../../../components/screens/ScreenCard';
import { PageHeader } from '../../../components/ui/PageHeader';
import { C, F } from '../../../lib/tokens';

export default function ScreensScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const { screens, loading, refetch } = useScreens(profile?.id);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={styles.container}>
        <PageHeader
          title="Screens"
          subtitle={`${screens.length} screen${screens.length !== 1 ? 's' : ''} on your network`}
        />
        {loading ? (
          <ActivityIndicator color={C.purple} style={{ marginTop: 40 }} />
        ) : screens.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📺</Text>
            <Text style={[styles.emptyTitle, { fontFamily: F.sansBold }]}>No screens yet</Text>
            <Text style={[styles.emptySub, { fontFamily: F.sans }]}>Tap + to register your first screen</Text>
          </View>
        ) : (
          <FlatList
            data={screens}
            keyExtractor={s => s.id}
            renderItem={({ item }) => (
              <ScreenCard screen={item} onPress={() => router.push(`/(tabs)/screens/${item.id}`)} />
            )}
            onRefresh={refetch}
            refreshing={loading}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/onboard/welcome')}
        accessibilityRole="button"
        accessibilityLabel="Add a new screen"
      >
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyIcon: { fontSize: 48, marginBottom: 8 },
  emptyTitle: { fontSize: 18, color: C.text },
  emptySub: { fontSize: 14, color: C.textSub },
  fab: {
    position: 'absolute', bottom: 24, right: 24,
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: C.purple, alignItems: 'center', justifyContent: 'center',
    shadowColor: C.purple, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
  fabIcon: { color: '#fff', fontSize: 26, lineHeight: 28 },
});
