import { Stack } from 'expo-router';

export default function Layout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#0D1B2A' },
        headerTintColor: '#fff',
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Mi saldo' }} />
      <Stack.Screen name="capture" options={{ title: 'Capturar ticket', presentation: 'modal' }} />
    </Stack>
  );
}
