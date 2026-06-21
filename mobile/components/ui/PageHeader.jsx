import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { C, F } from '../../lib/tokens';

export function PageHeader({ title, subtitle, actions }) {
  return (
    <View style={styles.header}>
      <View style={styles.text}>
        <Text style={[styles.title, { fontFamily: F.sansBold }]}>{title}</Text>
        {subtitle && <Text style={[styles.subtitle, { fontFamily: F.sans }]}>{subtitle}</Text>}
      </View>
      {actions && <View style={styles.actions}>{actions}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { marginBottom: 20 },
  text: { marginBottom: 8 },
  title: { fontSize: 22, fontWeight: '700', color: C.text },
  subtitle: { fontSize: 14, color: C.textSub, marginTop: 2 },
  actions: { marginTop: 8 },
});
