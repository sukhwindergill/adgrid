import { useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Card } from '../ui/Card';
import { Btn } from '../ui/Btn';
import { Badge } from '../ui/Badge';
import { C, F } from '../../lib/tokens';
import { SCREEN_OWNER_SHARE } from '@adgrid/core';

const REJECT_REASONS = [
  'Inappropriate content',
  'Competitor brand',
  'Not relevant to my venue',
  'Other',
];

export function ApprovalCard({ row, onApprove, onReject }) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState(REJECT_REASONS[0]);
  const [acting, setActing] = useState(false);

  const creative = row.campaign?.media_url
    ? { url: row.campaign.media_url, headline: row.campaign.headline }
    : null;
  const estimatedRevenue = ((row.campaign?.budget || 0) * SCREEN_OWNER_SHARE).toFixed(2);

  async function handleApprove() {
    setActing(true);
    await onApprove();
    setActing(false);
  }

  async function handleReject() {
    setActing(true);
    const result = await onReject(reason);
    setActing(false);
    if (!result?.error) setRejecting(false);
  }

  function confirmReject() {
    Alert.alert('Reject this ad?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reject', style: 'destructive', onPress: handleReject },
    ]);
  }

  return (
    <Card style={styles.card}>
      {creative?.url && (
        <Image source={{ uri: creative.url }} style={styles.creative} resizeMode="cover" />
      )}
      <View style={styles.body}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.campaignName, { fontFamily: F.sansSemi }]} numberOfLines={1}>
              {row.campaign?.name}
            </Text>
            <Text style={[styles.advertiser, { fontFamily: F.sans }]}>
              {row.campaign?.advertiser_name}
            </Text>
          </View>
          <Badge label={`~$${estimatedRevenue}`} variant="green" />
        </View>

        <View style={styles.meta}>
          <Text style={[styles.metaText, { fontFamily: F.sans }]}>📺 {row.screen?.name}</Text>
          {creative?.headline && (
            <Text style={[styles.metaText, { fontFamily: F.sans }]}>💬 "{creative.headline}"</Text>
          )}
        </View>

        {!rejecting ? (
          <View style={styles.actions}>
            <Btn variant="danger" onPress={() => setRejecting(true)} style={{ flex: 1 }}>Reject</Btn>
            <Btn onPress={handleApprove} loading={acting} style={{ flex: 1 }}>Approve</Btn>
          </View>
        ) : (
          <View style={styles.rejectSection}>
            <Text style={[styles.rejectLabel, { fontFamily: F.sansMed }]}>Reason for rejection</Text>
            {REJECT_REASONS.map(r => (
              <TouchableOpacity key={r} onPress={() => setReason(r)}
                style={[styles.reasonOption, { borderColor: reason === r ? C.red : C.border, backgroundColor: reason === r ? C.redSoft : C.surface }]}>
                <Text style={[styles.reasonText, { fontFamily: F.sans, color: reason === r ? C.red : C.textSub }]}>{r}</Text>
              </TouchableOpacity>
            ))}
            <View style={styles.actions}>
              <Btn variant="secondary" onPress={() => setRejecting(false)} style={{ flex: 1 }}>Cancel</Btn>
              <Btn variant="danger" onPress={confirmReject} loading={acting} style={{ flex: 1 }}>Confirm Rejection</Btn>
            </View>
          </View>
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: 0, overflow: 'hidden', marginBottom: 16 },
  creative: { width: '100%', height: 160 },
  body: { padding: 14 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10, gap: 10 },
  campaignName: { fontSize: 15, color: C.text, marginBottom: 2 },
  advertiser: { fontSize: 12, color: C.textSub },
  meta: { gap: 4, marginBottom: 14 },
  metaText: { fontSize: 12, color: C.textMuted },
  actions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  rejectSection: { marginTop: 4 },
  rejectLabel: { fontSize: 13, color: C.textMid, marginBottom: 8 },
  reasonOption: { padding: 10, borderRadius: 8, borderWidth: 1, marginBottom: 6 },
  reasonText: { fontSize: 13 },
});
