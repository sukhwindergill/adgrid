import { Stack } from 'expo-router';
import { C } from '../../../lib/tokens';

export default function ScreensLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg } }} />;
}
