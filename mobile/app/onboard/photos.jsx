import { useState } from 'react';
import { View, Text, Image, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useOnboard } from '../../context/OnboardContext';
import { supabase } from '../../lib/supabase';
import { WizardProgress } from '../../components/onboard/WizardProgress';
import { Btn } from '../../components/ui/Btn';
import { C, F } from '../../lib/tokens';

export default function PhotosScreen() {
  const router = useRouter();
  const { form, update } = useOnboard();
  const [uploading, setUploading] = useState(false);

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [16, 9], quality: 0.8 });
    if (!result.canceled && result.assets[0]) {
      update({ photos: [...form.photos, result.assets[0].uri].slice(0, 3) });
    }
  }

  async function takePhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed', 'Camera access is required.'); return; }
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [16, 9], quality: 0.8 });
    if (!result.canceled && result.assets[0]) {
      update({ photos: [...form.photos, result.assets[0].uri].slice(0, 3) });
    }
  }

  async function handleNext() {
    if (form.photos.length === 0) { router.push('/onboard/connect'); return; }
    setUploading(true);
    const uploaded = [];
    let failedCount = 0;
    for (const uri of form.photos) {
      const ext = uri.split('.').pop() || 'jpg';
      const path = `screens/${form.screenId}/${Date.now()}.${ext}`;
      const response = await fetch(uri);
      const blob = await response.blob();
      const { error } = await supabase.storage.from('screen-photos').upload(path, blob, { contentType: `image/${ext}` });
      if (!error) {
        const { data: { publicUrl } } = supabase.storage.from('screen-photos').getPublicUrl(path);
        uploaded.push(publicUrl);
      } else {
        failedCount += 1;
      }
    }
    if (uploaded.length > 0) {
      await supabase.from('screens').update({ screen_photos: uploaded }).eq('id', form.screenId);
    }
    setUploading(false);
    if (failedCount > 0) {
      Alert.alert(
        'Some photos failed to upload',
        `${failedCount} of ${form.photos.length} photo${form.photos.length !== 1 ? 's' : ''} could not be uploaded. You can continue and add them later from the screen detail page.`,
        [{ text: 'Continue anyway', onPress: () => router.push('/onboard/connect') }, { text: 'Cancel', style: 'cancel' }]
      );
      return;
    }
    router.push('/onboard/connect');
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <WizardProgress step={4} />
        <Text style={[styles.title, { fontFamily: F.sansBold }]}>Add photos</Text>
        <Text style={[styles.sub, { fontFamily: F.sans }]}>Show advertisers where your screen is located. Up to 3 photos.</Text>
        <View style={styles.previews}>
          {form.photos.map((uri, i) => (
            <View key={i} style={styles.previewWrap}>
              <Image source={{ uri }} style={styles.preview} resizeMode="cover" accessibilityLabel={`Selected photo ${i + 1}`} />
              <TouchableOpacity
                onPress={() => update({ photos: form.photos.filter((_, j) => j !== i) })}
                style={styles.removeBtn}
                accessibilityRole="button"
                accessibilityLabel={`Remove photo ${i + 1}`}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
        {form.photos.length < 3 && (
          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 24 }}>
            <Btn variant="secondary" onPress={pickImage} style={{ flex: 1 }}>📁 Library</Btn>
            <Btn variant="secondary" onPress={takePhoto} style={{ flex: 1 }}>📷 Camera</Btn>
          </View>
        )}
        <Btn onPress={handleNext} loading={uploading} size="lg">{form.photos.length === 0 ? 'Skip' : 'Next'}</Btn>
        <Btn variant="ghost" onPress={() => router.back()} style={{ marginTop: 10 }}>Back</Btn>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 24 },
  title: { fontSize: 22, color: C.text, marginBottom: 8 },
  sub: { fontSize: 14, color: C.textSub, marginBottom: 20, lineHeight: 20 },
  previews: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', marginBottom: 16 },
  previewWrap: { position: 'relative' },
  preview: { width: 100, height: 70, borderRadius: 8 },
  removeBtn: { position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.6)', width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
});
