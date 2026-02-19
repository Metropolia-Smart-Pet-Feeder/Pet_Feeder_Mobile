import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDeviceStore } from '../../../stores/deviceStore';
import * as api from '../../../services/api';

interface FeedingEvent {
  id: number;
  type: string;
  data: any;
  timestamp: string;
}

interface Photo {
  id: number;
  filename: string;
  captured_at: string;
}

type Tab = 'events' | 'photos';

const { width } = Dimensions.get('window');

export default function HistoryScreen() {
  const currentDevice = useDeviceStore((state) => state.currentDevice);
  const [activeTab, setActiveTab] = useState<Tab>('events');
  const [events, setEvents] = useState<FeedingEvent[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [viewerIndex, setViewerIndex] = useState(0);
  const viewerRef = useRef<FlatList>(null);

  useEffect(() => {
    if (activeTab === 'events') {
      fetchEvents();
    } else {
      fetchPhotos();
    }
  }, [currentDevice, activeTab]);

  const fetchEvents = async () => {
    if (!currentDevice) return;

    setIsLoading(true);
    try {
      const response = await api.getEvents(currentDevice.device_id, 50, 0);
      setEvents(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Failed to fetch events:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPhotos = async () => {
    if (!currentDevice) return;

    setIsLoading(true);
    try {
      const response = await api.getPhotos(currentDevice.device_id);
      setPhotos(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Failed to fetch photos:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'dispense':
        return 'restaurant-outline';
      case 'cat_identified':
        return 'paw-outline';
      case 'cat_came':
        return 'enter-outline';
      case 'cat_leave':
        return 'exit-outline';
      case 'tank_level':
        return 'server-outline';
      case 'error':
        return 'warning-outline';
      default:
        return 'information-circle-outline';
    }
  };

  const getEventColor = (eventType: string) => {
    switch (eventType) {
      case 'dispense':
        return '#34C759';
      case 'cat_identified':
        return '#FF9500';
      case 'cat_came':
        return '#AF52DE';
      case 'cat_leave':
        return '#FF9500';
      case 'tank_level':
        return '#007AFF';
      case 'error':
        return '#FF3B30';
      default:
        return '#666';
    }
  };

  const formatEventData = (event: FeedingEvent) => {
    switch (event.type) {
      case 'dispense':
        return `Dispensed ${event.data?.amount || 1} portion(s)`;
      case 'cat_identified':
        return `${event.data?.cat_name || 'Unknown cat'} detected`;
      case 'cat_came':
        return 'A cat arrived at the feeder';
      case 'cat_leave':
        return 'A cat left the feeder';
      case 'tank_level':
        return `Tank level: ${event.data?.level || 0}%`;
      case 'error':
        return event.data?.message || 'An error occurred';
      default:
        return event.type;
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString();
  };

  const openViewer = (index: number) => {
    setViewerIndex(index);
    setSelectedIndex(index);
  };

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setViewerIndex(viewableItems[0].index ?? 0);
    }
  }).current;

  const renderEvent = ({ item }: { item: FeedingEvent }) => (
    <View style={styles.eventCard}>
      <View style={[styles.eventIcon, { backgroundColor: getEventColor(item.type) }]}>
        <Ionicons name={getEventIcon(item.type) as any} size={20} color="#fff" />
      </View>
      <View style={styles.eventInfo}>
        <Text style={styles.eventText}>{formatEventData(item)}</Text>
        <Text style={styles.eventTime}>{formatTime(item.timestamp)}</Text>
      </View>
    </View>
  );

  const renderPhoto = ({ item, index }: { item: Photo; index: number }) => (
    <TouchableOpacity
      style={styles.photoThumbnail}
      onPress={() => openViewer(index)}
    >
      <Image
        source={{ uri: api.getPhotoUrl(currentDevice!.device_id, item.id) }}
        style={styles.thumbnailImage}
      />
    </TouchableOpacity>
  );

  const renderViewerPhoto = ({ item }: { item: Photo }) => (
    <View style={styles.viewerPage}>
      <Image
        source={{ uri: api.getPhotoUrl(currentDevice!.device_id, item.id) }}
        style={styles.viewerImage}
        resizeMode="contain"
      />
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Tab Switcher */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'events' && styles.tabActive]}
          onPress={() => setActiveTab('events')}
        >
          <Text style={[styles.tabText, activeTab === 'events' && styles.tabTextActive]}>
            Events
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'photos' && styles.tabActive]}
          onPress={() => setActiveTab('photos')}
        >
          <Text style={[styles.tabText, activeTab === 'photos' && styles.tabTextActive]}>
            Photos
          </Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      ) : activeTab === 'events' ? (
        <FlatList
          key="events"
          data={events}
          renderItem={renderEvent}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="list-outline" size={64} color="#ccc" />
              <Text style={styles.emptyText}>No events yet</Text>
            </View>
          }
        />
      ) : (
        <FlatList
          key="photos"
          data={photos}
          renderItem={renderPhoto}
          keyExtractor={(item) => item.id.toString()}
          numColumns={3}
          contentContainerStyle={styles.photoGrid}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="images-outline" size={64} color="#ccc" />
              <Text style={styles.emptyText}>No photos yet</Text>
            </View>
          }
        />
      )}

      {/* Photo Viewer Modal */}
      <Modal
        visible={selectedIndex !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedIndex(null)}
      >
        <View style={styles.photoModal}>
          <Text style={styles.photoCounter}>
            {viewerIndex + 1} / {photos.length}
          </Text>

          <FlatList
            ref={viewerRef}
            data={photos}
            renderItem={renderViewerPhoto}
            keyExtractor={(item) => item.id.toString()}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={selectedIndex ?? 0}
            getItemLayout={(_, index) => ({
              length: width,
              offset: width * index,
              index,
            })}
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
          />

          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setSelectedIndex(null)}
          >
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const photoSize = (width - 32 - 8) / 3;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#007AFF',
  },
  tabText: {
    fontSize: 16,
    color: '#666',
  },
  tabTextActive: {
    color: '#007AFF',
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    padding: 16,
  },
  eventCard: {
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
  eventIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  eventInfo: {
    flex: 1,
    marginLeft: 12,
  },
  eventText: {
    fontSize: 16,
    color: '#333',
  },
  eventTime: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  photoGrid: {
    padding: 16,
  },
  photoThumbnail: {
    width: photoSize,
    height: photoSize,
    margin: 2,
    borderRadius: 8,
    overflow: 'hidden',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
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
  photoModal: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
  },
  photoCounter: {
    position: 'absolute',
    top: 50,
    alignSelf: 'center',
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    zIndex: 10,
  },
  viewerPage: {
    width: width,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewerImage: {
    width: width,
    height: width,
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    padding: 8,
    zIndex: 10,
  },
});
