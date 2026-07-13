import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { C, F } from '../../lib/tokens';

export function ErrorBanner({ message }) {
  if (!message) return null;
  return (
    <View style={styles.banner} accessibilityRole="alert">
      <Text style={[styles.text, { fontFamily: F.sans }]}>
        <Text accessibilityElementsHidden importantForAccessibility="no-hide-descendants">⚠ </Text>
        <Text>{message}</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { backgroundColor: C.redSoft, borderWidth: 1, borderColor: C.redBorder, borderRadius: 8, padding: 12, marginBottom: 16 },
  text: { color: C.red, fontSize: 13 },
});
