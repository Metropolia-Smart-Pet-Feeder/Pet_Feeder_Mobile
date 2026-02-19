import { BleManager, Device, Characteristic } from 'react-native-ble-plx';
import { PermissionsAndroid, Platform } from 'react-native';

// UUIDs matching your ESP32 firmware
const SERVICE_UUID = '4fafc201-1fb5-459e-8fcc-c5c9c331914b';
const CHARACTERISTIC_UUID = 'beb5483e-36e1-4688-b7f5-ea07361b26a8';

class BleService {
  private manager: BleManager;
  private connectedDevice: Device | null = null;

  constructor() {
    this.manager = new BleManager();
  }

  async requestPermissions(): Promise<boolean> {
    if (Platform.OS === 'android') {
      const apiLevel = Platform.Version;

      if (apiLevel >= 31) {
        // Android 12+
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
        // Android 11 and below
        const result = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );
        return result === 'granted';
      }
    }
    return true; // iOS handles permissions via Info.plist
  }

  async scanForDevices(
    onDeviceFound: (device: Device) => void,
    timeout = 10000
  ): Promise<void> {
    const hasPermissions = await this.requestPermissions();
    if (!hasPermissions) {
      throw new Error('Bluetooth permissions not granted');
    }

    return new Promise((resolve, reject) => {
      const foundDevices = new Set<string>();

      this.manager.startDeviceScan(
        [SERVICE_UUID],
        { allowDuplicates: false },
        (error, device) => {
          if (error) {
            this.manager.stopDeviceScan();
            reject(error);
            return;
          }

          if (device && device.name && !foundDevices.has(device.id)) {
            foundDevices.add(device.id);
            onDeviceFound(device);
          }
        }
      );

      setTimeout(() => {
        this.manager.stopDeviceScan();
        resolve();
      }, timeout);
    });
  }

  stopScan(): void {
    this.manager.stopDeviceScan();
  }

  async connectToDevice(deviceId: string): Promise<Device> {
    const device = await this.manager.connectToDevice(deviceId);
    await device.discoverAllServicesAndCharacteristics();
    this.connectedDevice = device;
    return device;
  }

  async sendWifiCredentials(ssid: string, password: string): Promise<string> {
    if (!this.connectedDevice) {
      throw new Error('No device connected');
    }

    const payload = JSON.stringify({ ssid, password });
    
    await this.connectedDevice.writeCharacteristicWithResponseForService(
      SERVICE_UUID,
      CHARACTERISTIC_UUID,
      Buffer.from(payload).toString('base64')
    );

    // Read response (device ID)
    const characteristic = await this.connectedDevice.readCharacteristicForService(
      SERVICE_UUID,
      CHARACTERISTIC_UUID
    );

    if (characteristic.value) {
      const response = Buffer.from(characteristic.value, 'base64').toString('utf-8');
      return JSON.parse(response).device_id;
    }

    throw new Error('No response from device');
  }

  async disconnect(): Promise<void> {
    if (this.connectedDevice) {
      await this.manager.cancelDeviceConnection(this.connectedDevice.id);
      this.connectedDevice = null;
    }
  }

  destroy(): void {
    this.manager.destroy();
  }
}

export const bleService = new BleService();
export default bleService;
