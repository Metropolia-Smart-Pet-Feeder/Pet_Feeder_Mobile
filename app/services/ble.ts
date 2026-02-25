import {
  ESPProvisionManager,
  ESPDevice,
  ESPTransport,
  ESPSecurity,
} from '@orbital-systems/react-native-esp-idf-provisioning';
import { PermissionsAndroid, Platform } from 'react-native';

export type FoundDevice = {
  name: string;
  id: string;
};

class BleService {
  private connectedDevice: ESPDevice | null = null;

  private async requestPermissions(): Promise<boolean> {
    if (Platform.OS !== 'android') return true;

    const apiLevel = Platform.Version as number;

    if (apiLevel >= 31) {
      const results = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      ]);
      return (
        results['android.permission.BLUETOOTH_SCAN'] === 'granted' &&
        results['android.permission.BLUETOOTH_CONNECT'] === 'granted' &&
        results['android.permission.ACCESS_FINE_LOCATION'] === 'granted'
      );
    } else {
      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
      );
      return result === 'granted';
    }
  }

  async scanForDevices(
    onDeviceFound: (device: FoundDevice) => void
  ): Promise<void> {
    const granted = await this.requestPermissions();
    if (!granted) {
      throw new Error('Bluetooth permissions not granted');
    }

    const devices = await ESPProvisionManager.searchESPDevices(
      'PROV_PETFEEDER_',
      ESPTransport.ble,
      ESPSecurity.secure
    );

    for (const device of devices) {
      onDeviceFound({ name: device.name, id: device.name });
    }
  }

  stopScan(): void {
    // searchESPDevices handles its own lifecycle
  }

  async connectToDevice(deviceName: string): Promise<void> {
    const device = new ESPDevice({
      name: deviceName,
      transport: ESPTransport.ble,
      security: ESPSecurity.secure,
    });

    // Empty pop since ESP firmware uses NULL for proof of possession
    await device.connect('');
    this.connectedDevice = device;
  }

  async sendWifiCredentials(ssid: string, password: string): Promise<string> {
    if (!this.connectedDevice) {
      throw new Error('No device connected');
    }

    await this.connectedDevice.provision(ssid, password);

    // Derive device_id from BLE name: "PROV_PETFEEDER_A1B2C3" -> "PETFEEDER_A1B2C3"
    const deviceId = this.connectedDevice.name.replace(/^PROV_/, '');
    return deviceId;
  }

  async disconnect(): Promise<void> {
    if (this.connectedDevice) {
      this.connectedDevice.disconnect();
      this.connectedDevice = null;
    }
  }
}

export const bleService = new BleService();
export default bleService;
