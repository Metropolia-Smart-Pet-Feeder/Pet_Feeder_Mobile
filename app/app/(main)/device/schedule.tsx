import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Modal,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { useDeviceStore } from '../../../stores/deviceStore';
import * as api from '../../../services/api';
import mqttService from '../../../services/mqtt';

interface Schedule {
  id?: number;
  hour: number;
  minute: number;
  amount: number;
}

export default function ScheduleScreen() {
  const currentDevice = useDeviceStore((state) => state.currentDevice);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  
  // Form state
  const [hour, setHour] = useState(8);
  const [minute, setMinute] = useState(0);
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

    const newSchedule = { hour, minute, amount };
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
      
      setSchedules(updatedSchedules);
      setModalVisible(false);
      resetForm();
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
              setSchedules(updatedSchedules);
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
    setHour(schedule.hour);
    setMinute(schedule.minute);
    setAmount(schedule.amount);
    setEditingSchedule(schedule);
    setModalVisible(true);
  };

  const resetForm = () => {
    setHour(8);
    setMinute(0);
    setAmount(1);
    setEditingSchedule(null);
  };

  const formatTime = (hour: number, minute: number) => {
    const h = hour % 12 || 12;
    const ampm = hour < 12 ? 'AM' : 'PM';
    const m = minute.toString().padStart(2, '0');
    return `${h}:${m} ${ampm}`;
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
            <View style={styles.timePickerRow}>
              <Picker
                selectedValue={hour}
                onValueChange={setHour}
                style={styles.picker}
              >
                {[...Array(24)].map((_, i) => (
                  <Picker.Item key={i} label={i.toString().padStart(2, '0')} value={i} />
                ))}
              </Picker>
              <Text style={styles.timeSeparator}>:</Text>
              <Picker
                selectedValue={minute}
                onValueChange={setMinute}
                style={styles.picker}
              >
                {[0, 15, 30, 45].map((m) => (
                  <Picker.Item key={m} label={m.toString().padStart(2, '0')} value={m} />
                ))}
              </Picker>
            </View>

            <Text style={styles.label}>Amount (portions)</Text>
            <Picker
              selectedValue={amount}
              onValueChange={setAmount}
              style={styles.fullPicker}
            >
              {[0.5, 1, 1.5, 2, 2.5, 3].map((a) => (
                <Picker.Item key={a} label={a.toString()} value={a} />
              ))}
            </Picker>

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
  timePickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  picker: {
    flex: 1,
    height: 150,
  },
  fullPicker: {
    height: 150,
    marginBottom: 16,
  },
  timeSeparator: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  cancelButton: {
    flex: 1,
    padding: 16,
    marginRight: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    padding: 16,
    marginLeft: 8,
    borderRadius: 8,
    backgroundColor: '#007AFF',
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
