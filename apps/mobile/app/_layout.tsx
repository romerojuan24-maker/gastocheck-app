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

    // Escuchar cambios de auth — solo reaccionar a eventos reales
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION' || event === 'USER_UPDATED') {
        setSession(session);
      } else if (event === 'SIGNED_OUT') {
        setSession(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session === undefined) return;

    const inLogin = segments[0] === 'login';

    if (!session && !inLogin) {
      // Delay generoso para que autoRefreshToken renueve antes de redirigir
      const timer = setTimeout(async () => {
        // getSession() usa caché local — no falla por red ni token expirado temporalmente
        const { data: { session: fresh } } = await supabase.auth.getSession();
        if (!fresh) router.replace('/login');
      }, 3000);
      return () => clearTimeout(timer);
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

  if (session === undefined) return null;

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
      <Stack.Screen name="camera-screen" options={{ title: 'Cámara',               presentation: 'modal', headerShown: false }} />
      <Stack.Screen name="receipts"      options={{ title: 'Mis comprobantes' }} />
      <Stack.Screen name="receipt-search" options={{ title: 'Búsqueda avanzada' }} />
      <Stack.Screen name="batches"       options={{ title: 'Relaciones contables' }} />
<Stack.Screen name="viaticos"      options={{ title: 'Viáticos' }} />
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
      <Stack.Screen name="supervisor/viaticos-aprobacion" options={{ title: 'Aprobar Viáticos' }} />
      <Stack.Screen name="gastadores"    options={{ title: 'Mis Compradores' }} />
      <Stack.Screen name="events"          options={{ title: 'Eventos' }} />
      <Stack.Screen name="event-detail"    options={{ title: 'Detalle del Evento' }} />
      <Stack.Screen name="administracion"  options={{ title: 'Administración' }} />
      <Stack.Screen name="empresas"         options={{ title: 'Mis Empresas' }} />
      <Stack.Screen name="herramientas"      options={{ title: 'Herramientas' }} />
      <Stack.Screen name="reportes"          options={{ title: 'Reportes' }} />
      <Stack.Screen name="catalogo-cuentas"  options={{ title: 'Catálogo de cuentas' }} />
      <Stack.Screen name="rutas-equipo"      options={{ title: 'Rutas del equipo' }} />
      <Stack.Screen name="bancocheck"        options={{ title: 'BancoCheck' }} />
    </Stack>
  );
}
