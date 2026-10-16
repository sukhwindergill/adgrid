import { useState } from 'react';
import { View, FlatList, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../../context/AuthContext';
import { useCampaigns } from '../../../hooks/useCampaigns';
import { CampaignCard } from '../../../components/campaigns/CampaignCard';
import { PageHeader } from '../../../components/ui/PageHeader';
import { PillFilter } from '../../../components/ui/PillFilter';
import { EmptyState } from '../../../components/ui/EmptyState';
import { STATUS_FILTERS, matchesFilter } from '../../../lib/campaignStatus';
import { CREATE_CAMPAIGN_URL } from '../../../lib/webApp';
import { C, F } from '../../../lib/tokens';

export default function CampaignsScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const { campaigns, loading, error, refetch } = useCampaigns(profile?.id);
  const [filter, setFilter] = useState('all');
  const visible = campaigns.filter(c => matchesFilter(c.displayStatus, filter));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={styles.container}>
        <PageHeader
          title="Campaigns"
          subtitle={`${campaigns.length} campaign${campaigns.length !== 1 ? 's' : ''}`}
        />
        <TouchableOpacity
          onPress={() => Linking.openURL(CREATE_CAMPAIGN_URL)}
          accessibilityRole="link"
          accessibilityLabel="Create a campaign on the web"
          style={styles.webLink}
        >
          <Text style={[styles.webLinkText, { fontFamily: F.sansMed }]}>+ Create on web ↗</Text>
        </TouchableOpacity>
        <PillFilter options={STATUS_FILTERS} value={filter} onChange={setFilter} />
        {loading && campaigns.length === 0 ? (
          <ActivityIndicator color={C.purple} style={{ marginTop: 40 }} />
        ) : error ? (
          <EmptyState icon="⚠️" title="Couldn't load your campaigns" subtitle="Check your connection and try again." />
        ) : visible.length === 0 ? (
          <EmptyState
            icon="📣"
            title={campaigns.length === 0 ? 'No campaigns yet' : 'Nothing here'}
            subtitle={campaigns.length === 0 ? 'Create your first campaign on the web.' : 'No campaigns match this filter.'}
          />
        ) : (
          <FlatList
            data={visible}
            keyExtractor={c => c.id}
            renderItem={({ item }) => (
              <CampaignCard campaign={item} onPress={() => router.push(`/(tabs)/campaigns/${item.id}`)} />
            )}
            onRefresh={refetch}
            refreshing={loading}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  webLink: { alignSelf: 'flex-start', marginTop: -8, marginBottom: 16, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, borderWidth: 1, borderColor: C.purpleBorder, backgroundColor: C.purpleSoft },
  webLinkText: { fontSize: 13, color: C.purple },
});
