import { Stack } from 'expo-router';

export default function Layout() {
  return (
    <Stack
      screenOptions={{
        headerStyle:   { backgroundColor: '#0D1B2A' },
        headerTintColor: '#fff',
      }}
    >
      <Stack.Screen name="index"           options={{ title: 'Mi saldo' }} />
      <Stack.Screen name="capture"         options={{ title: 'Capturar ticket',        presentation: 'modal' }} />
      <Stack.Screen name="receipts"        options={{ title: 'Mis comprobantes' }} />
      <Stack.Screen name="batches"         options={{ title: 'Relaciones contables' }} />
      <Stack.Screen name="batch-detail"    options={{ title: 'Detalle de relación' }} />
      <Stack.Screen name="supplier-detail" options={{ title: 'Historial proveedor' }} />
    </Stack>
  );
}
