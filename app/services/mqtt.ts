import 'react-native-url-polyfill/auto';
import mqtt, { MqttClient } from 'mqtt';

const MQTT_BROKER = 'ws://104.168.122.188:9001/mqtt';
const MQTT_OPTIONS = {
  username: 'petfeeder_admin',
  password: 'admin',
  reconnectPeriod: 5000,
  connectTimeout: 30000,
};

type EventCallback = (topic: string, payload: any) => void;

class MqttService {
  private client: MqttClient | null = null;
  private subscribers: Map<string, EventCallback[]> = new Map();
  private subscribedTopics: Set<string> = new Set();

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.client?.connected) {
        resolve();
        return;
      }

      this.client = mqtt.connect(MQTT_BROKER, MQTT_OPTIONS);

      this.client.on('connect', () => {
        console.log('MQTT connected');
        // Resubscribe to topics after reconnection
        this.subscribedTopics.forEach((topic) => {
          this.client?.subscribe(topic);
        });
        resolve();
      });

      this.client.on('error', (error) => {
        console.error('MQTT error:', error);
        reject(error);
      });

      this.client.on('message', (topic, message) => {
        try {
          const payload = JSON.parse(message.toString());
          const callbacks = this.subscribers.get(topic) || [];
          callbacks.forEach((cb) => cb(topic, payload));
        } catch (e) {
          console.error('Failed to parse MQTT message:', e);
        }
      });

      this.client.on('close', () => {
        console.log('MQTT connection closed');
      });

      this.client.on('reconnect', () => {
        console.log('MQTT reconnecting...');
      });
    });
  }

  disconnect(): void {
    if (this.client) {
      this.client.end();
      this.client = null;
      this.subscribedTopics.clear();
    }
  }

  subscribeToDevice(deviceId: string, callback: EventCallback): void {
    const topic = `petfeeder/${deviceId}/event`;
    
    if (!this.subscribers.has(topic)) {
      this.subscribers.set(topic, []);
    }
    this.subscribers.get(topic)?.push(callback);

    if (!this.subscribedTopics.has(topic)) {
      this.subscribedTopics.add(topic);
      this.client?.subscribe(topic, (err) => {
        if (err) {
          console.error(`Failed to subscribe to ${topic}:`, err);
        } else {
          console.log(`Subscribed to ${topic}`);
        }
      });
    }
  }

  unsubscribeFromDevice(deviceId: string): void {
    const topic = `petfeeder/${deviceId}/event`;
    this.subscribers.delete(topic);
    this.subscribedTopics.delete(topic);
    this.client?.unsubscribe(topic);
  }

  sendCommand(deviceId: string, command: object): void {
    const topic = `petfeeder/${deviceId}/command`;
    if (this.client?.connected) {
      this.client.publish(topic, JSON.stringify(command));
      console.log(`Published to ${topic}:`, command);
    } else {
      console.error('MQTT not connected');
    }
  }

  // Convenience methods
  triggerFeed(deviceId: string, amount: number): void {
    this.sendCommand(deviceId, { action: 'feed', amount });
  }

  updateSchedule(deviceId: string, schedules: Array<{ hour: number; minute: number; amount: number }>): void {
    this.sendCommand(deviceId, { action: 'schedule', schedules });
  }

  isConnected(): boolean {
    return this.client?.connected || false;
  }
}

export const mqttService = new MqttService();
export default mqttService;
