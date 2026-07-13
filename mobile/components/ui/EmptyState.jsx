import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { C, F } from '../../lib/tokens';

export function EmptyState({ icon, title, subtitle }) {
  return (
    <View style={styles.wrap}>
      {icon && <Text style={styles.icon}>{icon}</Text>}
      {title && <Text style={[styles.title, { fontFamily: F.sansBold }]}>{title}</Text>}
      {subtitle && <Text style={[styles.subtitle, { fontFamily: F.sans }]}>{subtitle}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', padding: 40, gap: 8 },
  icon: { fontSize: 48, marginBottom: 8 },
  title: { fontSize: 18, color: C.text },
  subtitle: { fontSize: 14, color: C.textSub, textAlign: 'center' },
});
