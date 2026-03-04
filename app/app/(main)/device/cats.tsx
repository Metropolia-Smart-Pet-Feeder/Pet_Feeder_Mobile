import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useDeviceStore } from '../../../stores/deviceStore';
import mqttService from '../../../services/mqtt';
import * as api from '../../../services/api';

interface Cat {
  rfid: string;
  name: string;
  created_at: string;
}

type AddStep = 'scanning' | 'naming';

export default function CatsScreen() {
  const insets = useSafeAreaInsets();
  const currentDevice = useDeviceStore((state) => state.currentDevice);
  const [cats, setCats] = useState<Cat[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingCat, setEditingCat] = useState<Cat | null>(null);
  const [addStep, setAddStep] = useState<AddStep>('scanning');

  // Form state
  const [rfidTag, setRfidTag] = useState('');
  const [catName, setCatName] = useState('');

  const rfidListenerRef = useRef<((topic: string, payload: any) => void) | null>(null);

  useEffect(() => {
    fetchCats();
  }, [currentDevice]);

  const fetchCats = async () => {
    if (!currentDevice) return;

    setIsLoading(true);
    try {
      const response = await api.getCats(currentDevice.device_id);
      setCats(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Failed to fetch cats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const stopRfidListener = () => {
    if (rfidListenerRef.current && currentDevice) {
      mqttService.removeDeviceListener(currentDevice.device_id, rfidListenerRef.current);
      rfidListenerRef.current = null;
    }
  };

  const startRfidScan = async () => {
    if (!currentDevice) return;

    try {
      await mqttService.connect();
    } catch {
      // Already connected — ignore
    }

    const listener = (_topic: string, payload: any) => {
      if (payload.type === 'cat_identified' && payload.rfid) {
        const existing = cats.find((c) => c.rfid === payload.rfid);
        if (existing) {
          Alert.alert(
            'Already Registered',
            `This tag is already registered to "${existing.name}". Please scan a different tag.`
          );
          return; // Keep listening
        }
        stopRfidListener();
        setRfidTag(payload.rfid);
        setAddStep('naming');
      }
    };

    rfidListenerRef.current = listener;
    mqttService.subscribeToDevice(currentDevice.device_id, listener);
  };

  const handleSave = async () => {
    if (!currentDevice || !catName.trim()) {
      Alert.alert('Error', 'Please enter a name');
      return;
    }

    try {
      if (editingCat) {
        await api.renameCat(editingCat.rfid, currentDevice.device_id, catName);
      } else {
        await api.addCat(currentDevice.device_id, rfidTag, catName);
      }

      await fetchCats();
      closeModal();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to save');
    }
  };

  const handleDelete = (cat: Cat) => {
    Alert.alert(
      'Remove Pet',
      `Are you sure you want to remove ${cat.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            if (!currentDevice) return;
            try {
              await api.removeCat(cat.rfid, currentDevice.device_id);
              await fetchCats();
            } catch {
              Alert.alert('Error', 'Failed to remove cat');
            }
          },
        },
      ]
    );
  };

  const openAddModal = () => {
    setEditingCat(null);
    setRfidTag('');
    setCatName('');
    setAddStep('scanning');
    setModalVisible(true);
    startRfidScan();
  };

  const openEditModal = (cat: Cat) => {
    setRfidTag(cat.rfid);
    setCatName(cat.name);
    setEditingCat(cat);
    setModalVisible(true);
  };

  const closeModal = () => {
    stopRfidListener();
    setModalVisible(false);
    setEditingCat(null);
    setRfidTag('');
    setCatName('');
  };

  const renderModalContent = () => {
    if (editingCat) {
      return (
        <>
          <Text style={styles.modalTitle}>Edit Pet</Text>
          <TextInput
            style={styles.input}
            placeholder="Cat Name"
            value={catName}
            onChangeText={setCatName}
            autoFocus
          />
          <View style={styles.modalButtons}>
            <TouchableOpacity style={styles.cancelButton} onPress={closeModal}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
              <Text style={styles.saveButtonText}>Save</Text>
            </TouchableOpacity>
          </View>
        </>
      );
    }

    if (addStep === 'scanning') {
      return (
        <>
          <Text style={styles.modalTitle}>Add Cat</Text>
          <View style={styles.scanContainer}>
            <View style={styles.scanIconWrapper}>
              <Ionicons name="radio-outline" size={56} color="#007AFF" />
            </View>
            <Text style={styles.scanTitle}>Scan RFID Tag</Text>
            <Text style={styles.scanDescription}>
              Hold your cat's RFID tag near the food bowl
            </Text>
            <ActivityIndicator size="large" color="#007AFF" style={styles.scanSpinner} />
            <Text style={styles.scanWaiting}>Waiting for tag...</Text>
          </View>
          <TouchableOpacity style={styles.scanCancelButton} onPress={closeModal}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </>
      );
    }

    // addStep === 'naming'
    return (
      <>
        <Text style={styles.modalTitle}>Name Your Cat</Text>
        <View style={styles.tagDetectedRow}>
          <Ionicons name="checkmark-circle" size={20} color="#34C759" />
          <Text style={styles.tagDetectedText}>Tag detected: {rfidTag}</Text>
        </View>
        <TextInput
          style={styles.input}
          placeholder="Cat Name"
          value={catName}
          onChangeText={setCatName}
          autoFocus
        />
        <View style={styles.modalButtons}>
          <TouchableOpacity style={styles.cancelButton} onPress={closeModal}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
            <Text style={styles.saveButtonText}>Save</Text>
          </TouchableOpacity>
        </View>
      </>
    );
  };

  const renderCat = ({ item }: { item: Cat }) => (
    <TouchableOpacity style={styles.catCard} onPress={() => openEditModal(item)}>
      <View style={styles.catAvatar}>
        <Ionicons name="paw" size={24} color="#fff" />
      </View>
      <View style={styles.catInfo}>
        <Text style={styles.catName}>{item.name}</Text>
        <Text style={styles.catRfid}>RFID: {item.rfid}</Text>
      </View>
      <TouchableOpacity style={styles.deleteButton} onPress={() => handleDelete(item)}>
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
        data={cats}
        renderItem={renderCat}
        keyExtractor={(item) => item.rfid}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="paw-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>No cats registered</Text>
            <Text style={styles.emptySubtext}>
              Tap + and scan your cat's RFID tag to add them
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
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: 24 + insets.bottom }]}>
            {renderModalContent()}
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
  catCard: {
    flexDirection: 'row',
    alignItems: 'center',
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
  catAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FF9500',
    justifyContent: 'center',
    alignItems: 'center',
  },
  catInfo: {
    flex: 1,
    marginLeft: 12,
  },
  catName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  catRfid: {
    fontSize: 12,
    color: '#999',
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
    textAlign: 'center',
    paddingHorizontal: 16,
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
  scanContainer: {
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 24,
  },
  scanIconWrapper: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#EBF4FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  scanTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  scanDescription: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  scanSpinner: {
    marginBottom: 12,
  },
  scanWaiting: {
    fontSize: 13,
    color: '#999',
  },
  tagDetectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FBF4',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  tagDetectedText: {
    fontSize: 14,
    color: '#333',
    fontFamily: 'monospace',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    marginBottom: 16,
    backgroundColor: '#f9f9f9',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 8,
    marginRight: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    justifyContent: 'center',
  },
  scanCancelButton: {
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    justifyContent: 'center',
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
    marginLeft: 8,
    borderRadius: 8,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});
