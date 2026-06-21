import { Stack } from 'expo-router';
import { OnboardProvider } from '../../context/OnboardContext';
import { C } from '../../lib/tokens';

export default function OnboardLayout() {
  return (
    <OnboardProvider>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg } }} />
    </OnboardProvider>
  );
}
