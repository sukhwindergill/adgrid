import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { C, F } from '../../lib/tokens';

export function PillFilter({ options, value, onChange }) {
  return (
    <View style={styles.row}>
      {options.map(opt => {
        const active = opt.value === value;
        return (
          <TouchableOpacity key={String(opt.value)} onPress={() => onChange(opt.value)}
            accessibilityRole="button" accessibilityState={{ selected: active }}
            style={[styles.pill, { borderColor: active ? C.purple : C.border, backgroundColor: active ? C.purpleSoft : C.surface }]}>
            <Text style={[styles.label, { fontFamily: F.sansMed, color: active ? C.purple : C.textSub }]}>{opt.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  pill: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  label: { fontSize: 12 },
});
