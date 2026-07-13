import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { C, F } from '../../lib/tokens';

export function Inp({ label, value, onChangeText, placeholder, secureTextEntry, keyboardType, autoCapitalize = 'none', error, multiline, numberOfLines, editable, maxLength }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.wrap}>
      {label && <Text style={[styles.label, { fontFamily: F.sansMed }]}>{label}</Text>}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={C.textMuted}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        multiline={multiline}
        numberOfLines={numberOfLines}
        editable={editable !== false}
        maxLength={maxLength}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[
          styles.input,
          { fontFamily: F.sans, borderColor: error ? C.red : focused ? C.purple : C.border },
          multiline && { height: numberOfLines * 22 + 20, textAlignVertical: 'top' },
          editable === false && { backgroundColor: C.surfaceAlt, color: C.textMuted },
        ]}
      />
      {error && <Text style={[styles.error, { fontFamily: F.sans }]}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 16 },
  label: { fontSize: 13, color: C.textMid, marginBottom: 6, fontWeight: '500' },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: C.text, backgroundColor: C.surface },
  error: { fontSize: 12, color: C.red, marginTop: 4 },
});
