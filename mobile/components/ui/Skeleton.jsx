import React, { useEffect, useRef } from 'react';
import { Animated, View, StyleSheet } from 'react-native';
import { C } from '../../lib/tokens';

export function Skeleton({ width = '100%', height = 16, borderRadius = 8, style }) {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 600, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <Animated.View style={[{ width, height, borderRadius, backgroundColor: C.border, opacity }, style]} />
  );
}

export function SkeletonCard({ rows = 3 }) {
  return (
    <View style={{ backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 16 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} height={i === 0 ? 20 : 14} width={i === 0 ? '60%' : '80%'} style={{ marginBottom: 10 }} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({});
