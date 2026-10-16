import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { C, F } from '../../lib/tokens';

// Mirrors web's Sidebar ModeSwitcher (Advertiser | Operator).
const MODES = [
  { id: 'advertiser', label: 'Advertiser' },
  { id: 'operator', label: 'Operator' },
];

export function ModeSwitch({ value, onChange }) {
  return (
    <View style={styles.wrap} accessibilityRole="tablist">
      {MODES.map(m => {
        const active = m.id === value;
        return (
          <TouchableOpacity key={m.id} onPress={() => { if (!active) onChange(m.id); }}
            accessibilityRole="tab" accessibilityState={{ selected: active }}
            accessibilityLabel={`${m.label} mode`}
            style={[styles.option, active && styles.optionActive]}>
            <Text style={[styles.label, { fontFamily: F.sansMed, color: active ? C.purple : C.textSub }]}>{m.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', backgroundColor: C.surfaceAlt, borderRadius: 10, padding: 3, borderWidth: 1, borderColor: C.border, marginBottom: 24 },
  option: { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 8 },
  optionActive: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.purpleBorder },
  label: { fontSize: 13 },
});
