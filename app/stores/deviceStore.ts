import { create } from 'zustand';
import * as api from '../services/api';

interface Device {
  device_id: string;
  name: string;
  registered_at: string;
}

interface DeviceState {
  devices: Device[];
  currentDevice: Device | null;
  isLoading: boolean;
  error: string | null;

  fetchDevices: () => Promise<void>;
  setCurrentDevice: (device: Device | null) => void;
  addDevice: (device_id: string) => Promise<void>;
  renameDevice: (device_id: string, name: string) => Promise<void>;
  removeDevice: (device_id: string) => Promise<void>;
  clearError: () => void;
}

export const useDeviceStore = create<DeviceState>((set, get) => ({
  devices: [],
  currentDevice: null,
  isLoading: false,
  error: null,

  fetchDevices: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.getDevices();
      const devices = response.data || [];
      set({ devices, isLoading: false });
    } catch (error: any) {
      set({ 
        error: error.response?.data?.error || 'Failed to fetch devices', 
        isLoading: false,
        devices: []
      });
    }
  },

  setCurrentDevice: (device: Device | null) => {
    set({ currentDevice: device });
  },

  addDevice: async (device_id: string) => {
    set({ isLoading: true, error: null });
    try {
      await api.registerDevice(device_id);
      await get().fetchDevices();
    } catch (error: any) {
      set({ 
        error: error.response?.data?.error || 'Failed to add device', 
        isLoading: false 
      });
      throw error;
    }
  },

  renameDevice: async (device_id: string, name: string) => {
    set({ isLoading: true, error: null });
    try {
      await api.renameDevice(device_id, name);
      await get().fetchDevices();
      
      // Update current device if it's the one being renamed
      const current = get().currentDevice;
      if (current?.device_id === device_id) {
        set({ currentDevice: { ...current, name } });
      }
    } catch (error: any) {
      set({ 
        error: error.response?.data?.error || 'Failed to rename device', 
        isLoading: false 
      });
      throw error;
    }
  },

  removeDevice: async (device_id: string) => {
    set({ isLoading: true, error: null });
    try {
      await api.removeDevice(device_id);
      await get().fetchDevices();
      
      // Clear current device if it's the one being removed
      if (get().currentDevice?.device_id === device_id) {
        set({ currentDevice: null });
      }
    } catch (error: any) {
      set({ 
        error: error.response?.data?.error || 'Failed to remove device', 
        isLoading: false 
      });
      throw error;
    }
  },

  clearError: () => set({ error: null }),
}));
