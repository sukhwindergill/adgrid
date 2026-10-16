import { Stack } from 'expo-router';
import { C } from '../../../lib/tokens';

export default function CampaignsLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg } }} />;
}
