import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { S } from '../../lib/tokens';

export function Card({ children, style, onPress }) {
  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={[S.card, S.shadow, style]}>
        {children}
      </TouchableOpacity>
    );
  }
  return <View style={[S.card, S.shadow, style]}>{children}</View>;
}
