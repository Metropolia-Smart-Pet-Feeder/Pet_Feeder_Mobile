import axios from 'axios';

const API_URL = 'http://104.168.122.188:3000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

let currentToken: string | null = null;

// Add auth token to requests
export const setAuthToken = (token: string | null) => {
  currentToken = token;
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common['Authorization'];
  }
};

// Auth
export const login = (username: string, password: string) =>
  api.post('/auth/login', { username, password });

export const register = (username: string, email: string, password: string) =>
  api.post('/auth/register', { username, email, password });

// Devices
export const getDevices = () => api.get('/devices');

export const registerDevice = (device_id: string) =>
  api.post('/devices/register', { device_id });

export const renameDevice = (device_id: string, name: string) =>
  api.put(`/devices/${device_id}/rename`, { name });

export const removeDevice = (device_id: string) =>
  api.delete(`/devices/${device_id}`);

// Cats
export const getCats = (device_id: string) =>
  api.get(`/cats/device/${device_id}`);

export const addCat = (device_id: string, rfid: string, name: string) =>
  api.post('/cats', { device_id, rfid, name });

export const renameCat = (rfid: string, device_id: string, name: string) =>
  api.put(`/cats/${rfid}/rename`, { device_id, name });

export const removeCat = (rfid: string, device_id: string) =>
  api.delete(`/cats/${rfid}`, { data: { device_id } });

// Schedules
export const getSchedules = (device_id: string) =>
  api.get(`/schedules/device/${device_id}`);

export const updateSchedules = (device_id: string, schedules: Array<{ hour: number; minute: number; amount: number }>) =>
  api.put(`/schedules/device/${device_id}`, { schedules });

// Events
export const getEvents = (device_id: string, limit = 100, offset = 0) =>
  api.get(`/events/device/${device_id}`, { params: { limit, offset } });

// Photos
export const getPhotos = (device_id: string) =>
  api.get(`/photos/device/${device_id}`);

export const getPhotoUrl = (device_id: string, photo_id: number) =>
  `${API_URL}/photos/device/${device_id}/${photo_id}?token=${currentToken ?? ''}`;

export default api;
