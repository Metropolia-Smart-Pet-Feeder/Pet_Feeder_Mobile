import { useEffect, useState } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { useDeviceStore } from '../../../stores/deviceStore';
import * as api from '../../../services/api';

interface Cat {
  rfid: string;
  name: string;
  created_at: string;
}

export default function CatsScreen() {
  const currentDevice = useDeviceStore((state) => state.currentDevice);
  const [cats, setCats] = useState<Cat[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingCat, setEditingCat] = useState<Cat | null>(null);
  
  // Form state
  const [rfidTag, setRfidTag] = useState('');
  const [catName, setCatName] = useState('');

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

  const handleSave = async () => {
    if (!currentDevice || !catName.trim()) {
      Alert.alert('Error', 'Please enter a name');
      return;
    }

    try {
      if (editingCat) {
        await api.renameCat(editingCat.rfid, currentDevice.device_id, catName);
      } else {
        if (!rfidTag.trim()) {
          Alert.alert('Error', 'Please enter RFID tag');
          return;
        }
        await api.addCat(currentDevice.device_id, rfidTag, catName);
      }
      
      await fetchCats();
      setModalVisible(false);
      resetForm();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to save');
    }
  };

  const handleDelete = (cat: Cat) => {
    Alert.alert(
      'Remove Cat',
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
            } catch (error) {
              Alert.alert('Error', 'Failed to remove cat');
            }
          },
        },
      ]
    );
  };

  const openAddModal = () => {
    resetForm();
    setEditingCat(null);
    setModalVisible(true);
  };

  const openEditModal = (cat: Cat) => {
    setRfidTag(cat.rfid);
    setCatName(cat.name);
    setEditingCat(cat);
    setModalVisible(true);
  };

  const resetForm = () => {
    setRfidTag('');
    setCatName('');
    setEditingCat(null);
  };

  const renderCat = ({ item }: { item: Cat }) => (
    <TouchableOpacity
      style={styles.catCard}
      onPress={() => openEditModal(item)}
    >
      <View style={styles.catAvatar}>
        <Ionicons name="paw" size={24} color="#fff" />
      </View>
      <View style={styles.catInfo}>
        <Text style={styles.catName}>{item.name}</Text>
        <Text style={styles.catRfid}>RFID: {item.rfid}</Text>
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
        data={cats}
        renderItem={renderCat}
        keyExtractor={(item) => item.rfid}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="paw-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>No cats registered</Text>
            <Text style={styles.emptySubtext}>
              Add your cats with their RFID tags
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
              {editingCat ? 'Edit Cat' : 'Add Cat'}
            </Text>

            {!editingCat && (
              <TextInput
                style={styles.input}
                placeholder="RFID Tag"
                value={rfidTag}
                onChangeText={setRfidTag}
                autoCapitalize="none"
              />
            )}

            <TextInput
              style={styles.input}
              placeholder="Cat Name"
              value={catName}
              onChangeText={setCatName}
              autoFocus={!!editingCat}
            />

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
