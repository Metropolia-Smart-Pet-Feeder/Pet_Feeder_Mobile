import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Modal,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDeviceStore } from '../../../stores/deviceStore';
import * as api from '../../../services/api';
import mqttService from '../../../services/mqtt';

interface Schedule {
  id?: number;
  hour: number;
  minute: number;
  amount: number;
}

const ITEM_HEIGHT = 48;
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

function WheelPicker({ items, initialIndex, onChange, width = 80 }: {
  items: number[];
  initialIndex: number;
  onChange: (value: number) => void;
  width?: number;
}) {
  const ref = useRef<ScrollView>(null);
  const laid = useRef(false);

  const scrollToIndex = (idx: number) => {
    ref.current?.scrollTo({ y: idx * ITEM_HEIGHT, animated: false });
  };

  const pickIndex = (y: number) =>
    Math.max(0, Math.min(Math.round(y / ITEM_HEIGHT), items.length - 1));

  return (
    <View style={{ width, height: ITEM_HEIGHT * 3, overflow: 'hidden' }}>
      <View style={{
        position: 'absolute',
        top: ITEM_HEIGHT,
        height: ITEM_HEIGHT,
        left: 0,
        right: 0,
        backgroundColor: '#e8e8e8',
        borderRadius: 8,
      }} />
      <ScrollView
        ref={ref}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        contentContainerStyle={{ paddingVertical: ITEM_HEIGHT }}
        onLayout={() => {
          if (!laid.current) {
            laid.current = true;
            scrollToIndex(initialIndex);
          }
        }}
        onMomentumScrollEnd={(e) => onChange(items[pickIndex(e.nativeEvent.contentOffset.y)])}
        onScrollEndDrag={(e) => onChange(items[pickIndex(e.nativeEvent.contentOffset.y)])}
      >
        {items.map((v) => (
          <View key={v} style={{ height: ITEM_HEIGHT, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ fontSize: 22, color: '#333' }}>
              {String(v).padStart(2, '0')}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

export default function ScheduleScreen() {
  const currentDevice = useDeviceStore((state) => state.currentDevice);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  
  // Form state
  const [time, setTime] = useState(() => { const d = new Date(); d.setHours(8, 0, 0, 0); return d; });
  const [amount, setAmount] = useState(1);

  useEffect(() => {
    fetchSchedules();
  }, [currentDevice]);

  const fetchSchedules = async () => {
    if (!currentDevice) return;
    
    setIsLoading(true);
    try {
      const response = await api.getSchedules(currentDevice.device_id);
      setSchedules(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Failed to fetch schedules:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!currentDevice) return;

    const newSchedule = { hour: time.getHours(), minute: time.getMinutes(), amount };
    let updatedSchedules: Schedule[];

    if (editingSchedule) {
      updatedSchedules = schedules.map((s) =>
        s.id === editingSchedule.id ? { ...s, ...newSchedule } : s
      );
    } else {
      updatedSchedules = [...schedules, newSchedule];
    }

    try {
      await api.updateSchedules(currentDevice.device_id, updatedSchedules);

      // Also send to device via MQTT
      mqttService.updateSchedule(currentDevice.device_id, updatedSchedules);

      setModalVisible(false);
      resetForm();
      await fetchSchedules();
    } catch (error) {
      Alert.alert('Error', 'Failed to save schedule');
    }
  };

  const handleDelete = (schedule: Schedule) => {
    Alert.alert(
      'Delete Schedule',
      'Are you sure you want to delete this schedule?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!currentDevice) return;
            
            const updatedSchedules = schedules.filter((s) => s.id !== schedule.id);
            try {
              await api.updateSchedules(currentDevice.device_id, updatedSchedules);
              mqttService.updateSchedule(currentDevice.device_id, updatedSchedules);
              await fetchSchedules();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete schedule');
            }
          },
        },
      ]
    );
  };

  const openAddModal = () => {
    resetForm();
    setEditingSchedule(null);
    setModalVisible(true);
  };

  const openEditModal = (schedule: Schedule) => {
    const d = new Date();
    d.setHours(schedule.hour, schedule.minute, 0, 0);
    setTime(d);
    setAmount(schedule.amount);
    setEditingSchedule(schedule);
    setModalVisible(true);
  };

  const resetForm = () => {
    const d = new Date();
    d.setHours(8, 0, 0, 0);
    setTime(d);
    setAmount(1);
    setEditingSchedule(null);
  };

  const formatTime = (hour: number, minute: number) => {
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  };

  const renderSchedule = ({ item }: { item: Schedule }) => (
    <TouchableOpacity
      style={styles.scheduleCard}
      onPress={() => openEditModal(item)}
    >
      <View style={styles.scheduleInfo}>
        <Text style={styles.scheduleTime}>{formatTime(item.hour, item.minute)}</Text>
        <Text style={styles.scheduleAmount}>{item.amount} portion(s)</Text>
      </View>
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => handleDelete(item)}
      >
        <Ionicons name="trash-outline" size={20} color="#FF3B30" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={schedules}
        renderItem={renderSchedule}
        keyExtractor={(item, index) => item.id?.toString() || index.toString()}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="time-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>No schedules yet</Text>
            <Text style={styles.emptySubtext}>
              Add feeding times for automatic dispensing
            </Text>
          </View>
        }
      />

      <TouchableOpacity style={styles.addButton} onPress={openAddModal}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {editingSchedule ? 'Edit Schedule' : 'Add Schedule'}
            </Text>

            <Text style={styles.label}>Time</Text>
            <View style={styles.wheelPickerRow}>
              <WheelPicker
                key={`h-${modalVisible}`}
                items={HOURS}
                initialIndex={time.getHours()}
                onChange={(h: number) => { const d = new Date(time); d.setHours(h); setTime(d); }}
                width={80}
              />
              <Text style={styles.wheelSeparator}>:</Text>
              <WheelPicker
                key={`m-${modalVisible}`}
                items={MINUTES}
                initialIndex={time.getMinutes()}
                onChange={(m: number) => { const d = new Date(time); d.setMinutes(m); setTime(d); }}
                width={80}
              />
            </View>

            <Text style={styles.label}>Amount (portions)</Text>
            <View style={styles.amountSelector}>
              <TouchableOpacity
                style={[styles.amountButton, amount <= 1 && styles.amountButtonDisabled]}
                onPress={() => setAmount((a) => Math.max(1, a - 1))}
                disabled={amount <= 1}
              >
                <Ionicons name="remove" size={24} color={amount <= 1 ? '#ccc' : '#007AFF'} />
              </TouchableOpacity>
              <Text style={styles.amountCount}>{amount}</Text>
              <TouchableOpacity
                style={[styles.amountButton, amount >= 10 && styles.amountButtonDisabled]}
                onPress={() => setAmount((a) => Math.min(10, a + 1))}
                disabled={amount >= 10}
              >
                <Ionicons name="add" size={24} color={amount >= 10 ? '#ccc' : '#007AFF'} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                <Text style={styles.saveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    padding: 16,
  },
  scheduleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  scheduleInfo: {
    flex: 1,
  },
  scheduleTime: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  scheduleAmount: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  deleteButton: {
    padding: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 64,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
  },
  addButton: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 48,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 24,
    textAlign: 'center',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  wheelPickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  wheelSeparator: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginHorizontal: 8,
  },
  modalButtons: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  saveButton: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#007AFF',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  amountSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 8,
    marginBottom: 16,
  },
  amountButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  amountButtonDisabled: {
    backgroundColor: '#f9f9f9',
  },
  amountCount: {
    flex: 1,
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
});
