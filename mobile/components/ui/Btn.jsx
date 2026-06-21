import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { C, F, gradColors, gradStart, gradEnd } from '../../lib/tokens';

export function Btn({ children, variant = 'primary', size = 'md', onPress, disabled, loading, style }) {
  const sz = { sm: { px: 12, py: 6, fs: 12 }, md: { px: 16, py: 10, fs: 13 }, lg: { px: 20, py: 13, fs: 14 } }[size];

  const variantStyle = {
    primary: { bg: null, color: '#fff', borderWidth: 0 },
    secondary: { bg: C.surface, color: C.textMid, borderWidth: 1, borderColor: C.border },
    ghost: { bg: 'transparent', color: C.textSub, borderWidth: 0 },
    danger: { bg: C.redSoft, color: C.red, borderWidth: 1, borderColor: C.redBorder },
    success: { bg: C.greenSoft, color: C.green, borderWidth: 1, borderColor: C.greenBorder },
  }[variant] || {};

  const inner = (
    <TouchableOpacity
      onPress={disabled || loading ? undefined : onPress}
      activeOpacity={disabled ? 1 : 0.75}
      style={[
        styles.base,
        {
          paddingHorizontal: sz.px,
          paddingVertical: sz.py,
          backgroundColor: variantStyle.bg || (variant !== 'primary' ? C.surface : undefined),
          borderWidth: variantStyle.borderWidth ?? 0,
          borderColor: variantStyle.borderColor,
          opacity: disabled ? 0.5 : 1,
          borderRadius: 8,
        },
        style,
      ]}
    >
      {loading
        ? <ActivityIndicator size="small" color={variantStyle.color} />
        : <Text style={[styles.label, { fontSize: sz.fs, color: variantStyle.color, fontFamily: F.sansMed }]}>{children}</Text>
      }
    </TouchableOpacity>
  );

  if (variant === 'primary') {
    return (
      <LinearGradient
        colors={gradColors}
        start={gradStart}
        end={gradEnd}
        style={{ borderRadius: 8, overflow: 'hidden' }}
      >
        {inner}
      </LinearGradient>
    );
  }
  return inner;
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  label: { fontWeight: '500' },
});
