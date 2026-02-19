import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDeviceStore } from '../../../stores/deviceStore';
import mqttService from '../../../services/mqtt';
import * as api from '../../../services/api';

export default function DeviceControlScreen() {
  const currentDevice = useDeviceStore((state) => state.currentDevice);
  const [tankLevel, setTankLevel] = useState<number | null>(null);
  const [lastFeed, setLastFeed] = useState<string | null>(null);
  const [isFeeding, setIsFeeding] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!currentDevice) return;

    // Load last known values from DB
    const loadInitialState = async () => {
      try {
        const response = await api.getEvents(currentDevice.device_id, 50, 0);
        const events: any[] = Array.isArray(response.data) ? response.data : [];

        const lastTankEvent = events.find((e) => e.type === 'tank_level');
        if (lastTankEvent) setTankLevel(lastTankEvent.data?.level ?? null);

        const lastDispenseEvent = events.find((e) => e.type === 'dispense');
        if (lastDispenseEvent) {
          const date = new Date(lastDispenseEvent.timestamp);
          setLastFeed(date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        }
      } catch (error) {
        console.error('Failed to load initial state:', error);
      }
    };

    const connectMqtt = async () => {
      try {
        await mqttService.connect();
        setIsConnected(true);

        mqttService.subscribeToDevice(currentDevice.device_id, (_topic, payload) => {
          if (payload.type === 'tank_level') {
            setTankLevel(payload.level);
          } else if (payload.type === 'dispense') {
            setLastFeed(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
            setIsFeeding(false);
          }
        });
      } catch (error) {
        console.error('MQTT connection failed:', error);
      }
    };

    loadInitialState();
    connectMqtt();

    return () => {
      if (currentDevice) {
        mqttService.unsubscribeFromDevice(currentDevice.device_id);
      }
    };
  }, [currentDevice]);

  const handleFeed = () => {
    if (!currentDevice) return;

    Alert.alert(
      'Feed Now',
      'Dispense one portion of food?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Feed',
          onPress: () => {
            setIsFeeding(true);
            mqttService.triggerFeed(currentDevice.device_id, 1);
            
            // Timeout in case no response
            setTimeout(() => {
              setIsFeeding(false);
            }, 10000);
          },
        },
      ]
    );
  };

  const getTankColor = () => {
    if (tankLevel === null) return '#ccc';
    if (tankLevel > 50) return '#34C759';
    if (tankLevel > 20) return '#FF9500';
    return '#FF3B30';
  };

  return (
    <View style={styles.container}>
      {/* Status Cards */}
      <View style={styles.statusRow}>
        <View style={styles.statusCard}>
          <Ionicons name="server-outline" size={32} color={getTankColor()} />
          <Text style={styles.statusValue}>
            {tankLevel !== null ? `${tankLevel}%` : '--'}
          </Text>
          <Text style={styles.statusLabel}>Tank Level</Text>
        </View>

        <View style={styles.statusCard}>
          <Ionicons name="time-outline" size={32} color="#007AFF" />
          <Text style={styles.statusValue}>{lastFeed || '--'}</Text>
          <Text style={styles.statusLabel}>Last Feed</Text>
        </View>
      </View>

      {/* Connection Status */}
      <View style={styles.connectionStatus}>
        <View
          style={[
            styles.connectionDot,
            { backgroundColor: isConnected ? '#34C759' : '#FF3B30' },
          ]}
        />
        <Text style={styles.connectionText}>
          {isConnected ? 'Connected' : 'Disconnected'}
        </Text>
      </View>

      {/* Feed Button */}
      <TouchableOpacity
        style={[styles.feedButton, isFeeding && styles.feedButtonDisabled]}
        onPress={handleFeed}
        disabled={isFeeding || !isConnected}
        activeOpacity={0.8}
      >
        <Ionicons
          name={isFeeding ? 'hourglass-outline' : 'restaurant-outline'}
          size={48}
          color="#fff"
        />
        <Text style={styles.feedButtonText}>
          {isFeeding ? 'Feeding...' : 'Feed Now'}
        </Text>
      </TouchableOpacity>

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <TouchableOpacity
          style={styles.quickActionButton}
          onPress={() => {
            if (currentDevice) {
              mqttService.triggerFeed(currentDevice.device_id, 0.5);
            }
          }}
          disabled={!isConnected}
        >
          <Text style={styles.quickActionText}>Half Portion</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickActionButton}
          onPress={() => {
            if (currentDevice) {
              mqttService.triggerFeed(currentDevice.device_id, 2);
            }
          }}
          disabled={!isConnected}
        >
          <Text style={styles.quickActionText}>Double Portion</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statusCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 8,
  },
  statusLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  connectionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  connectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  connectionText: {
    fontSize: 14,
    color: '#666',
  },
  feedButton: {
    backgroundColor: '#007AFF',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 32,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  feedButtonDisabled: {
    backgroundColor: '#ccc',
    shadowColor: '#ccc',
  },
  feedButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 8,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  quickActionButton: {
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginHorizontal: 8,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  quickActionText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
