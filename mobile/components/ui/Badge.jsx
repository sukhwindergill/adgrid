import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { C, F } from '../../lib/tokens';

const variants = {
  green:  { bg: C.greenSoft,  text: C.green,  border: C.greenBorder },
  amber:  { bg: C.amberSoft,  text: C.amber,  border: C.amberBorder },
  red:    { bg: C.redSoft,    text: C.red,    border: C.redBorder },
  blue:   { bg: C.blueSoft,   text: C.blue,   border: C.blueBorder },
  purple: { bg: C.purpleSoft, text: C.purple, border: C.purpleBorder },
  muted:  { bg: C.surfaceAlt, text: C.textMuted, border: C.border },
};

export function Badge({ label, variant = 'muted', dot }) {
  const v = variants[variant] || variants.muted;
  return (
    <View style={[styles.badge, { backgroundColor: v.bg, borderColor: v.border }]}>
      {dot && <View style={[styles.dot, { backgroundColor: v.text }]} />}
      <Text style={[styles.text, { color: v.text, fontFamily: F.sansMed }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, alignSelf: 'flex-start' },
  dot: { width: 6, height: 6, borderRadius: 3 },
  text: { fontSize: 11, fontWeight: '500' },
});
