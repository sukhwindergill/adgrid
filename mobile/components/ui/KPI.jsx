import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { C, F, S } from '../../lib/tokens';

export function KPI({ label, value, sub, trend, icon, color }) {
  const trendColor = trend > 0 ? C.green : trend < 0 ? C.red : C.textMuted;
  return (
    <View style={[S.card, S.shadow, styles.kpi]}>
      <View style={styles.top}>
        <Text style={[styles.label, { fontFamily: F.sans }]}>{label}</Text>
        {icon && <Text style={styles.icon}>{icon}</Text>}
      </View>
      <Text style={[styles.value, { color: color || C.text, fontFamily: F.sansBold }]}>{value}</Text>
      <View style={styles.bottom}>
        {sub && <Text style={[styles.sub, { fontFamily: F.sans }]}>{sub}</Text>}
        {trend != null && (
          <Text style={[styles.trend, { color: trendColor, fontFamily: F.sansMed }]}>
            {trend > 0 ? '▲' : '▼'} {Math.abs(trend)}%
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  kpi: { flex: 1, minWidth: 140 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  label: { fontSize: 11, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  icon: { fontSize: 16 },
  value: { fontSize: 26, fontWeight: '700', marginBottom: 4 },
  bottom: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sub: { fontSize: 12, color: C.textSub },
  trend: { fontSize: 12 },
});
