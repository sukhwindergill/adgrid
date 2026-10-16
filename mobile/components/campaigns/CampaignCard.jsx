import { View, Text, StyleSheet } from 'react-native';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { STATUS_META } from '../../lib/campaignStatus';
import { C, F } from '../../lib/tokens';
import { formatCurrency } from '@adgrid/core';

export function CampaignCard({ campaign, onPress }) {
  const meta = STATUS_META[campaign.displayStatus] ?? STATUS_META.pending;
  const name = campaign.campaign_name || 'Untitled campaign';
  const dates = [campaign.start_date, campaign.end_date].filter(Boolean).join(' → ');
  return (
    <Card onPress={onPress} style={styles.card}>
      <View style={styles.top}>
        <Text style={[styles.name, { fontFamily: F.sansSemi }]} numberOfLines={1}>{name}</Text>
        <Badge label={meta.label} variant={meta.variant} dot />
      </View>
      {dates ? <Text style={[styles.sub, { fontFamily: F.sans }]}>{dates}</Text> : null}
      <Text style={[styles.sub, { fontFamily: F.mono }]}>
        {formatCurrency(campaign.spent ?? 0, campaign.currency)} of {formatCurrency(campaign.budget ?? 0, campaign.currency)}
      </Text>
      {campaign.rejections?.length > 0 && (
        <View style={styles.rejections}>
          {campaign.rejections.map(r => (
            <Text key={r.screenId} style={[styles.rejection, { fontFamily: F.sans }]}>
              Rejected on {r.screenName}: {r.reason}
            </Text>
          ))}
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 12 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 6 },
  name: { flex: 1, fontSize: 15, color: C.text },
  sub: { fontSize: 12, color: C.textSub, marginTop: 2 },
  rejections: { marginTop: 10, padding: 10, borderRadius: 8, backgroundColor: C.redSoft, borderWidth: 1, borderColor: C.redBorder, gap: 4 },
  rejection: { fontSize: 12, color: C.red },
});
