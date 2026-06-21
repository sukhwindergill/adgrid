import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { C, F } from '../../lib/tokens';

export function ErrorBanner({ message }) {
  if (!message) return null;
  return (
    <View style={styles.banner}>
      <Text style={[styles.text, { fontFamily: F.sans }]}>⚠ {message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { backgroundColor: C.redSoft, borderWidth: 1, borderColor: C.redBorder, borderRadius: 8, padding: 12, marginBottom: 16 },
  text: { color: C.red, fontSize: 13 },
});
