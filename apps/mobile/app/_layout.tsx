import { Stack, useRouter, useSegments, usePathname } from 'expo-router';
import { useEffect, useState, useRef } from 'react';
import { ActivityIndicator, Alert, AppState, Text, View } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import * as Updates from 'expo-updates';
import { supabase } from '../lib/supabase';
import { BRAND } from '@gastocheck/shared';
import { initLogger, setCurrentScreen } from '../lib/logger';
import { ErrorBoundary } from '../components/ErrorBoundary';

// Captura console.* al buffer local; console.warn/error también se envían
// automáticamente a Supabase diagnostic_logs con la pantalla activa
initLogger();

export default function Layout() {
  const router   = useRouter();
  const segments = useSegments();
  const pathname = usePathname();
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [updating, setUpdating] = useState(false);

  useEffect(() => { setCurrentScreen(pathname); }, [pathname]);

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

  const sessionAlertShown = useRef(false);

  useEffect(() => {
    // Sesión inicial
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));

    // Escuchar cambios de auth — solo reaccionar a eventos reales
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION' || event === 'USER_UPDATED') {
        sessionAlertShown.current = false;
        setSession(session);
      } else if (event === 'SIGNED_OUT') {
        setSession(null);
      }
    });

    // Refrescar token cuando la app vuelve al foreground
    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (session) setSession(session);
        });
      }
    });

    return () => { subscription.unsubscribe(); appStateSub.remove(); };
  }, []);

  useEffect(() => {
    if (session === undefined) return;

    const inLogin = segments[0] === 'login';

    if (!session && !inLogin) {
      // Delay generoso para que autoRefreshToken renueve antes de redirigir
      const timer = setTimeout(async () => {
        const { data: { session: fresh } } = await supabase.auth.getSession();
        if (!fresh) {
          if (!sessionAlertShown.current) {
            sessionAlertShown.current = true;
            Alert.alert(
              'Sesión expirada',
              'Tu sesión ha terminado. Vuelve a iniciar sesión para continuar.',
              [{ text: 'Iniciar sesión', onPress: () => router.replace('/login') }],
            );
          } else {
            router.replace('/login');
          }
        }
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
          Actualizando CHECK SUITE…
        </Text>
      </View>
    );
  }

  if (session === undefined) return null;

  return (
    <ErrorBoundary>
    <Stack
      screenOptions={{
        headerStyle:     { backgroundColor: '#0D1B2A' },
        headerTintColor: '#fff',
        headerTitleStyle:{ fontWeight: '700' },
      }}
    >
      <Stack.Screen name="login"            options={{ headerShown: false }} />
      <Stack.Screen name="index"            options={{ headerShown: false }} />
      <Stack.Screen name="gastocheck/index" options={{ headerShown: false }} />
      <Stack.Screen name="cobracheck/index" options={{ headerShown: false }} />
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
      <Stack.Screen name="billing"        options={{ title: 'Plan y Suscripción' }} />
      <Stack.Screen name="mis-depositos"  options={{ title: 'Mis Depósitos' }} />
      <Stack.Screen name="settings"       options={{ title: 'Ajustes' }} />
      <Stack.Screen name="supervisor"    options={{ title: 'Panel Contador' }} />
      <Stack.Screen name="admin-panel"   options={{ title: 'Panel Administrador' }} />
      <Stack.Screen name="supervisor/reembolsos/index"  options={{ title: 'Reembolsos Pendientes' }} />
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
      <Stack.Screen name="bancocheck/index"        options={{ title: 'BancoCheck' }} />
      <Stack.Screen name="facturacheck/index"      options={{ title: 'FacturaCheck' }} />
      <Stack.Screen name="flujocheck/index"        options={{ title: 'FlujoCheck' }} />
      <Stack.Screen name="inventariocheck/index"   options={{ title: 'Inventario' }} />
      <Stack.Screen name="polizas"           options={{ title: 'Mis Pólizas' }} />
      <Stack.Screen name="depositos"         options={{ title: 'Mis Depósitos' }} />
      <Stack.Screen name="reembolso"         options={{ title: 'Reembolso' }} />
      <Stack.Screen name="cobracheck/mi-ruta"       options={{ title: 'Mi Ruta' }} />
      <Stack.Screen name="cobracheck/tareas-diarias" options={{ title: 'Tareas Diarias' }} />
      <Stack.Screen name="cobracheck/clientes"       options={{ title: 'Clientes' }} />
      <Stack.Screen name="cobracheck/historial"      options={{ title: 'Historial' }} />
      <Stack.Screen name="cobracheck/cartera-total"    options={{ title: 'Relación CxC' }} />
      <Stack.Screen name="cobracheck/comprobantes"     options={{ title: 'Relación de Facturas' }} />
      <Stack.Screen name="cobracheck/pagos"            options={{ title: 'Registrar Pago' }} />
      <Stack.Screen name="cobracheck/factura-manual"   options={{ title: 'Alta de Factura' }} />
      <Stack.Screen name="cobracheck/polizas"          options={{ title: 'Pólizas' }} />
      <Stack.Screen name="cobracheck/reporte-cobrador" options={{ title: 'Reporte Cobrador' }} />
      <Stack.Screen name="cobracheck/transferencia"    options={{ title: 'Transferencia Bancaria' }} />
      <Stack.Screen name="cobracheck/reportes"         options={{ title: 'Reportes de Cobranza' }} />
      <Stack.Screen name="cobracheck/alta-cliente"     options={{ title: 'Alta de Cliente' }} />
      <Stack.Screen name="cobracheck/generar-ruta"     options={{ title: 'Generar Ruta del Día' }} />
    </Stack>
    </ErrorBoundary>
  );
}
