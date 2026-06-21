import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { Card } from '../ui/Card';
import { HealthBadge } from './HealthBadge';
import { C, F } from '../../lib/tokens';
import { VENUE_TAXONOMY } from '@adgrid/core';

export function ScreenCard({ screen, onPress }) {
  const photo = screen.screen_photos?.[0];
  const venueLabel = screen.venue_subtype || VENUE_TAXONOMY[screen.venue_category]?.label || '';

  return (
    <Card onPress={onPress} style={styles.card}>
      {photo && <Image source={{ uri: photo }} style={styles.photo} resizeMode="cover" />}
      <View style={styles.body}>
        <View style={styles.row}>
          <Text style={[styles.name, { fontFamily: F.sansSemi }]} numberOfLines={1}>{screen.name}</Text>
          <HealthBadge screen={screen} />
        </View>
        <Text style={[styles.meta, { fontFamily: F.sans }]}>
          {[venueLabel, screen.address_city].filter(Boolean).join(' · ')}
        </Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: 0, overflow: 'hidden', marginBottom: 12 },
  photo: { width: '100%', height: 120 },
  body: { padding: 14 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  name: { fontSize: 15, color: C.text, flex: 1, marginRight: 8 },
  meta: { fontSize: 12, color: C.textSub },
});
