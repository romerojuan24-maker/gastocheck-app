import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import * as Updates from 'expo-updates';
import { supabase } from '../lib/supabase';
import { BRAND } from '@gastocheck/shared';

export default function Layout() {
  const router   = useRouter();
  const segments = useSegments();
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [updating, setUpdating] = useState(false);

  // ── Auto-update: chequear al arrancar y recargar si hay OTA nueva ──
  const { isUpdatePending } = Updates.useUpdates();

  useEffect(() => {
    // Cuando expo-updates termina de descargar un OTA, recarga automáticamente
    if (isUpdatePending) {
      setUpdating(true);
      Updates.reloadAsync().catch(() => setUpdating(false));
    }
  }, [isUpdatePending]);

  useEffect(() => {
    // Chequeo proactivo al arrancar (por si el automático no corrió)
    if (!Updates.isEnabled) return;
    Updates.checkForUpdateAsync()
      .then(async (res) => {
        if (res.isAvailable) {
          setUpdating(true);
          await Updates.fetchUpdateAsync();
          await Updates.reloadAsync();
        }
      })
      .catch(() => { /* silencioso en dev/sin red */ });
  }, []);

  useEffect(() => {
    // Sesión inicial
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));

    // Escuchar cambios de auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session === undefined) return; // Cargando

    const inLogin = segments[0] === 'login';

    if (!session && !inLogin) {
      router.replace('/login');
    } else if (session && inLogin) {
      router.replace('/');
    }
  }, [session, segments]);

  // Splash mientras se aplica un OTA
  if (updating) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BRAND.navy }}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={{ color: '#fff', marginTop: 16, fontSize: 14, fontWeight: '600' }}>
          Actualizando GastoCheck…
        </Text>
      </View>
    );
  }

  // Splash de carga mientras resolvemos sesión
  if (session === undefined) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BRAND.gray }}>
        <ActivityIndicator size="large" color={BRAND.blue} />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerStyle:     { backgroundColor: '#0D1B2A' },
        headerTintColor: '#fff',
        headerTitleStyle:{ fontWeight: '700' },
      }}
    >
      <Stack.Screen name="login"         options={{ headerShown: false }} />
      <Stack.Screen name="index"         options={{ title: 'Mi saldo',             headerRight: () => null }} />
      <Stack.Screen name="capture"       options={{ title: 'Capturar ticket',      presentation: 'modal' }} />
      <Stack.Screen name="receipts"      options={{ title: 'Mis comprobantes' }} />
      <Stack.Screen name="batches"       options={{ title: 'Relaciones contables' }} />
      <Stack.Screen name="batch-detail"  options={{ title: 'Detalle de relación' }} />
      <Stack.Screen name="receipt-detail"  options={{ title: 'Detalle del comprobante' }} />
      <Stack.Screen name="item-search"      options={{ title: '¿Dónde compro?' }} />
      <Stack.Screen name="fleet-vehicles"  options={{ title: 'Mis vehículos' }} />
      <Stack.Screen name="fleet-operators"   options={{ title: 'Mis operadores' }} />
      <Stack.Screen name="advance-request"   options={{ title: 'Mis anticipos' }} />
      <Stack.Screen name="fleet-dashboard"   options={{ title: 'Dashboard Flotilla' }} />
      <Stack.Screen name="qr-scanner"        options={{ title: 'Escanear QR CFDI', presentation: 'modal' }} />
      <Stack.Screen name="supplier-detail" options={{ title: 'Historial proveedor' }} />
      <Stack.Screen name="settings"      options={{ title: 'Ajustes' }} />
      <Stack.Screen name="supervisor"    options={{ title: 'Panel de supervisor' }} />
      <Stack.Screen name="supervisor/reembolsos"  options={{ title: 'Reembolsos Pendientes' }} />
      <Stack.Screen name="gastadores"    options={{ title: 'Mis Compradores' }} />
      <Stack.Screen name="events"          options={{ title: 'Eventos' }} />
      <Stack.Screen name="event-detail"    options={{ title: 'Detalle del Evento' }} />
      <Stack.Screen name="administracion"  options={{ title: 'Administración' }} />
      <Stack.Screen name="empresas"         options={{ title: 'Mis Empresas' }} />
      <Stack.Screen name="herramientas"      options={{ title: 'Herramientas' }} />
      <Stack.Screen name="reportes"          options={{ title: 'Reportes' }} />
      <Stack.Screen name="catalogo-cuentas"  options={{ title: 'Catálogo de cuentas' }} />
    </Stack>
  );
}
