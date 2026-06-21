import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { C, F } from '../../lib/tokens';

const STEPS = ['Welcome', 'Venue', 'Hours', 'Photos', 'Connect'];

export function WizardProgress({ step }) {
  const pct = ((step - 1) / (STEPS.length - 1)) * 100;
  return (
    <View style={styles.wrap}>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct}%` }]} />
      </View>
      <View style={styles.labels}>
        {STEPS.map((label, i) => (
          <Text key={label} style={[styles.label, {
            fontFamily: i + 1 === step ? F.sansSemi : F.sans,
            color: i + 1 <= step ? C.purple : C.textMuted,
          }]}>{label}</Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 28 },
  track: { height: 4, backgroundColor: C.border, borderRadius: 2, marginBottom: 8 },
  fill: { height: '100%', backgroundColor: C.purple, borderRadius: 2 },
  labels: { flexDirection: 'row', justifyContent: 'space-between' },
  label: { fontSize: 10 },
});
