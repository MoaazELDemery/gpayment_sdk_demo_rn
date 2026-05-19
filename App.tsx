import React, { useState } from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ScrollView,
  Platform,
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { payWithGeidea } from '@geidea/payment-sdk-react-native';
import type {
  Language,
  Region,
  GeideaResult,
} from '@geidea/payment-sdk-react-native';

type PickerOption<T extends string> = { label: string; value: T };

const LANGUAGES: PickerOption<Language>[] = [
  { label: 'English', value: 'en' },
  { label: 'Arabic', value: 'ar' },
];

const ENVIRONMENTS: PickerOption<string>[] = [
  { label: 'Production', value: 'prod' },
  { label: 'Pre-Prod', value: 'preprod' },
];

const REGIONS: PickerOption<Region>[] = [
  { label: 'Egypt', value: 'egypt' },
  { label: 'KSA', value: 'ksa' },
  { label: 'UAE', value: 'uae' },
];

function SegmentedControl<T extends string>({
  options,
  selected,
  onSelect,
}: {
  options: PickerOption<T>[];
  selected: T;
  onSelect: (v: T) => void;
}) {
  return (
    <View style={styles.segmentRow}>
      {options.map(opt => (
        <TouchableOpacity
          key={opt.value}
          style={[
            styles.segmentBtn,
            selected === opt.value && styles.segmentBtnActive,
          ]}
          onPress={() => onSelect(opt.value)}>
          <Text
            style={[
              styles.segmentText,
              selected === opt.value && styles.segmentTextActive,
            ]}>
            {opt.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function HomeScreen() {
  const [sessionId, setSessionId] = useState('');
  const [language, setLanguage] = useState<Language>('en');
  const [environment, setEnvironment] = useState<string>('prod');
  const [region, setRegion] = useState<Region>('egypt');
  const [loading, setLoading] = useState(false);

  const handlePay = async () => {
    if (!sessionId.trim()) {
      Alert.alert('Missing Session ID', 'Please enter a session ID.');
      return;
    }

    setLoading(true);
    try {
      const result: GeideaResult = await payWithGeidea({
        sessionId: sessionId.trim(),
        language,
        region,
        merchantName: 'Demo Store',
        primaryColor: '#FF4D00',
        secondaryColor: '#FFFFFF',
      });

      if (result.status === 'canceled') {
        Alert.alert('Payment Canceled', 'The payment was canceled by the user.');
      } else if (result.status === 'completed') {
        const r = result.result;
        Alert.alert(
          'Payment Completed',
          `Order: ${r?.orderId ?? 'N/A'}\nToken: ${r?.tokenId ?? 'N/A'}\n` +
            `Brand: ${r?.paymentMethod?.brand ?? 'N/A'}\n` +
            `Card: ${r?.paymentMethod?.maskedCardNumber ?? 'N/A'}`,
        );
      }
    } catch (err: any) {
      Alert.alert('Payment Error', err?.message ?? 'An unknown error occurred.');
      console.log('Payment error details:', err?.response ?? err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, { paddingBottom: 24 }]}
      keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Geidea Payment SDK</Text>
      <Text style={styles.subtitle}>Demo Application</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Session ID</Text>
        <TextInput
          style={styles.input}
          value={sessionId}
          onChangeText={setSessionId}
          placeholder="Enter session ID"
          placeholderTextColor="#999"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Text style={styles.label}>Language</Text>
        <SegmentedControl
          options={LANGUAGES}
          selected={language}
          onSelect={setLanguage}
        />

        <Text style={styles.label}>Environment</Text>
        <SegmentedControl
          options={ENVIRONMENTS}
          selected={environment}
          onSelect={setEnvironment}
        />

        <Text style={styles.label}>Region</Text>
        <SegmentedControl
          options={REGIONS}
          selected={region}
          onSelect={setRegion}
        />

        <TouchableOpacity
          style={[styles.payBtn, loading && styles.payBtnDisabled]}
          onPress={handlePay}
          disabled={loading}>
          <Text style={styles.payBtnText}>
            {loading ? 'Processing...' : 'PAY'}
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.platformNote}>
        Running on {Platform.OS} ({Platform.Version})
      </Text>
    </ScrollView>
  );
}

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen
          name="Home"
          component={HomeScreen}
          options={{ title: 'Geidea SDK Demo' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const PRIMARY = '#FF4D00';

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: '#F5F5F7',
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1A1A2E',
    textAlign: 'center',
    marginTop: 40,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#444',
    marginTop: 16,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    color: '#333',
    backgroundColor: '#FAFAFA',
  },
  segmentRow: {
    flexDirection: 'row',
    gap: 8,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DDD',
    backgroundColor: '#FAFAFA',
    alignItems: 'center',
  },
  segmentBtnActive: {
    borderColor: PRIMARY,
    backgroundColor: `${PRIMARY}15`,
  },
  segmentText: {
    fontSize: 14,
    color: '#666',
  },
  segmentTextActive: {
    color: PRIMARY,
    fontWeight: '600',
  },
  payBtn: {
    marginTop: 28,
    backgroundColor: PRIMARY,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  payBtnDisabled: {
    opacity: 0.6,
  },
  payBtnText: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 1,
  },
  platformNote: {
    textAlign: 'center',
    color: '#AAA',
    fontSize: 12,
    marginTop: 20,
  },
});
