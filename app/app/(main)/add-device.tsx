import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Device } from 'react-native-ble-plx';
import { bleService } from '../../services/ble';
import { useDeviceStore } from '../../stores/deviceStore';

type Step = 'scan' | 'connect' | 'wifi' | 'complete';

export default function AddDeviceScreen() {
  const router = useRouter();
  const { addDevice } = useDeviceStore();
  
  const [step, setStep] = useState<Step>('scan');
  const [isScanning, setIsScanning] = useState(false);
  const [foundDevices, setFoundDevices] = useState<Device[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [ssid, setSsid] = useState('');
  const [wifiPassword, setWifiPassword] = useState('');
  const [isProvisioning, setIsProvisioning] = useState(false);

  const startScan = async () => {
    setIsScanning(true);
    setFoundDevices([]);

    try {
      await bleService.scanForDevices((device) => {
        setFoundDevices((prev) => {
          if (prev.find((d) => d.id === device.id)) return prev;
          return [...prev, device];
        });
      });
    } catch (error: any) {
      Alert.alert('Scan Error', error.message);
    } finally {
      setIsScanning(false);
    }
  };

  const handleDeviceSelect = async (device: Device) => {
    setSelectedDevice(device);
    setIsConnecting(true);
    setStep('connect');

    try {
      await bleService.connectToDevice(device.id);
      setStep('wifi');
    } catch (error: any) {
      Alert.alert('Connection Error', error.message);
      setStep('scan');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleProvision = async () => {
    if (!ssid.trim()) {
      Alert.alert('Error', 'Please enter WiFi name');
      return;
    }

    setIsProvisioning(true);

    try {
      const deviceId = await bleService.sendWifiCredentials(ssid, wifiPassword);
      await bleService.disconnect();
      
      // Register device to user's account
      await addDevice(deviceId);
      
      setStep('complete');
    } catch (error: any) {
      Alert.alert('Provisioning Error', error.message);
    } finally {
      setIsProvisioning(false);
    }
  };

  const handleDone = () => {
    router.back();
  };

  const renderScanStep = () => (
    <View style={styles.stepContainer}>
      <Ionicons name="bluetooth" size={64} color="#007AFF" />
      <Text style={styles.stepTitle}>Find Your Feeder</Text>
      <Text style={styles.stepDescription}>
        Make sure your Pet Feeder is in pairing mode (LED blinking blue)
      </Text>

      {foundDevices.length > 0 && (
        <FlatList
          data={foundDevices}
          keyExtractor={(item) => item.id}
          style={styles.deviceList}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.bleDeviceItem}
              onPress={() => handleDeviceSelect(item)}
            >
              <Ionicons name="hardware-chip-outline" size={24} color="#007AFF" />
              <View style={styles.bleDeviceInfo}>
                <Text style={styles.bleDeviceName}>{item.name || 'Unknown'}</Text>
                <Text style={styles.bleDeviceId}>{item.id}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#ccc" />
            </TouchableOpacity>
          )}
        />
      )}

      <TouchableOpacity
        style={[styles.button, isScanning && styles.buttonDisabled]}
        onPress={startScan}
        disabled={isScanning}
      >
        {isScanning ? (
          <>
            <ActivityIndicator color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.buttonText}>Scanning...</Text>
          </>
        ) : (
          <Text style={styles.buttonText}>
            {foundDevices.length > 0 ? 'Scan Again' : 'Start Scanning'}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );

  const renderConnectStep = () => (
    <View style={styles.stepContainer}>
      <ActivityIndicator size="large" color="#007AFF" />
      <Text style={styles.stepTitle}>Connecting...</Text>
      <Text style={styles.stepDescription}>
        Connecting to {selectedDevice?.name}
      </Text>
    </View>
  );

  const renderWifiStep = () => (
    <View style={styles.stepContainer}>
      <Ionicons name="wifi" size={64} color="#007AFF" />
      <Text style={styles.stepTitle}>WiFi Setup</Text>
      <Text style={styles.stepDescription}>
        Enter your WiFi credentials to connect the feeder to your network
      </Text>

      <TextInput
        style={styles.input}
        placeholder="WiFi Name (SSID)"
        value={ssid}
        onChangeText={setSsid}
        autoCapitalize="none"
      />

      <TextInput
        style={styles.input}
        placeholder="WiFi Password"
        value={wifiPassword}
        onChangeText={setWifiPassword}
        secureTextEntry
      />

      <TouchableOpacity
        style={[styles.button, isProvisioning && styles.buttonDisabled]}
        onPress={handleProvision}
        disabled={isProvisioning}
      >
        {isProvisioning ? (
          <>
            <ActivityIndicator color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.buttonText}>Setting up...</Text>
          </>
        ) : (
          <Text style={styles.buttonText}>Connect</Text>
        )}
      </TouchableOpacity>
    </View>
  );

  const renderCompleteStep = () => (
    <View style={styles.stepContainer}>
      <Ionicons name="checkmark-circle" size={64} color="#34C759" />
      <Text style={styles.stepTitle}>Setup Complete!</Text>
      <Text style={styles.stepDescription}>
        Your Pet Feeder has been added successfully
      </Text>

      <TouchableOpacity style={styles.button} onPress={handleDone}>
        <Text style={styles.buttonText}>Done</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      {step === 'scan' && renderScanStep()}
      {step === 'connect' && renderConnectStep()}
      {step === 'wifi' && renderWifiStep()}
      {step === 'complete' && renderCompleteStep()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  stepContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 24,
    marginBottom: 8,
  },
  stepDescription: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 32,
  },
  deviceList: {
    width: '100%',
    maxHeight: 200,
    marginBottom: 16,
  },
  bleDeviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    marginBottom: 8,
  },
  bleDeviceInfo: {
    flex: 1,
    marginLeft: 12,
  },
  bleDeviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  bleDeviceId: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    marginBottom: 16,
    backgroundColor: '#f9f9f9',
  },
  button: {
    flexDirection: 'row',
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
