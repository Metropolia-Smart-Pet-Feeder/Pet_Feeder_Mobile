import { Stack } from 'expo-router';

export default function MainLayout() {
  return (
    <Stack>
      <Stack.Screen 
        name="devices" 
        options={{ headerShown: false }} 
      />
      <Stack.Screen 
        name="account" 
        options={{ 
          title: 'Account',
          presentation: 'modal',
        }} 
      />
      <Stack.Screen 
        name="add-device" 
        options={{ 
          title: 'Add Device',
          presentation: 'modal',
        }} 
      />
      <Stack.Screen 
        name="device" 
        options={{ headerShown: false }} 
      />
    </Stack>
  );
}
