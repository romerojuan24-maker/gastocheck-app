import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, Platform, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { BRAND } from '@gastocheck/shared';
import { getSuiteAppsSession, clearSuiteAppsSession, getRemainingSessionTime } from '../../lib/suiteAppsAuth';
import { SuiteAppsModal } from '../../components/SuiteAppsModal';

const TOOLS = [
  {
    id: 'bancocheck',
    title: 'BancoCheck',
    subtitle: 'Control bancario',
    icon: '🏦',
    route: '/bancocheck',
    description: 'Importar, conciliar y controlar cuentas bancarias',
  },
  {
    id: 'flujocheck',
    title: 'FlujoCheck',
    subtitle: 'Flujo de caja',
    icon: '💰',
    route: '/flujocheck',
    description: 'Proyectar y analizar flujo de efectivo',
  },
  {
    id: 'facturacheck',
    title: 'FacturaCheck',
    subtitle: 'Facturación CFDI',
    icon: '📄',
    route: '/facturacheck',
    description: 'Emitir comprobantes fiscales digitales',
  },
  {
    id: 'inventariocheck',
    title: 'InventarioCheck',
    subtitle: 'Inventario',
    icon: '📦',
    route: '/inventariocheck',
    description: 'Gestionar movimientos de inventario',
  },
  {
    id: 'advisor',
    title: 'Advisor',
    subtitle: 'Inteligencia',
    icon: '🧠',
    route: '/advisor',
    description: 'Motor de correlación y priorización de alertas',
  },
];

export default function SuiteAppsHome() {
  const router = useRouter();
  const [sessionValid, setSessionValid] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [remainingTime, setRemainingTime] = useState(0);

  const checkSession = useCallback(async () => {
    try {
      const { isValid } = await getSuiteAppsSession();
      setSessionValid(isValid);
      if (isValid) {
        const remaining = await getRemainingSessionTime();
        setRemainingTime(remaining);
      }
    } catch (err) {
      console.error('Error checking Suite Apps session:', err);
      setSessionValid(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      checkSession();
    }, [checkSession])
  );

  useEffect(() => {
    if (!sessionValid) return;
    const interval = setInterval(async () => {
      const remaining = await getRemainingSessionTime();
      if (remaining <= 0) {
        await clearSuiteAppsSession();
        setSessionValid(false);
        Alert.alert('Sesión expirada', 'Tu acceso a Suite Apps ha expirado. Ingresa nuevamente.');
      } else {
        setRemainingTime(remaining);
      }
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [sessionValid]);

  const handleToolPress = (route: string) => {
    router.push(route as any);
  };

  const handleLogout = async () => {
    Alert.alert('Cerrar sesión', '¿Cerrar tu sesión de Suite Apps?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Cerrar',
        style: 'destructive',
        onPress: async () => {
          await clearSuiteAppsSession();
          setSessionValid(false);
        },
      },
    ]);
  };

  const formatTimeRemaining = (ms: number) => {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={BRAND.navy} />
      </View>
    );
  }

  if (!sessionValid) {
    return (
      <View style={s.screen}>
        <View style={s.noAccess}>
          <Text style={s.icon}>🔒</Text>
          <Text style={s.title}>Acceso restringido</Text>
          <Text style={s.subtitle}>Suite Apps requiere autenticación</Text>
          <TouchableOpacity
            style={s.authenticateBtn}
            onPress={() => setShowModal(true)}
            activeOpacity={0.7}
          >
            <Text style={s.authenticateBtnText}>Ingresar</Text>
          </TouchableOpacity>
        </View>
        <SuiteAppsModal
          visible={showModal}
          onDismiss={() => setShowModal(false)}
          onSuccess={() => {
            setShowModal(false);
            checkSession();
          }}
        />
      </View>
    );
  }

  return (
    <View style={s.screen}>
      <View style={s.header}>
        <View style={s.headerTop}>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
            <Text style={s.backBtn}>‹ Atrás</Text>
          </TouchableOpacity>
          <Text style={s.headerTitle}>Suite Apps</Text>
          <TouchableOpacity onPress={handleLogout} activeOpacity={0.7}>
            <Text style={s.logoutBtn}>Salir</Text>
          </TouchableOpacity>
        </View>
        <View style={s.sessionInfo}>
          <Text style={s.sessionText}>Sesión activa • {formatTimeRemaining(remainingTime)} restante</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.content}>
        <Text style={s.contentTitle}>Herramientas disponibles</Text>

        {TOOLS.map(tool => (
          <TouchableOpacity
            key={tool.id}
            style={s.toolCard}
            onPress={() => handleToolPress(tool.route)}
            activeOpacity={0.7}
          >
            <View style={s.toolIcon}>
              <Text style={s.toolIconText}>{tool.icon}</Text>
            </View>
            <View style={s.toolInfo}>
              <Text style={s.toolTitle}>{tool.title}</Text>
              <Text style={s.toolSubtitle}>{tool.subtitle}</Text>
              <Text style={s.toolDesc}>{tool.description}</Text>
            </View>
            <Text style={s.arrow}>›</Text>
          </TouchableOpacity>
        ))}

        <View style={s.footer}>
          <Text style={s.footerText}>🔐 Todos los datos están encriptados y seguros</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const TOP_INSET = Platform.OS === 'ios' ? 54 : 32;

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BRAND.gray },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { backgroundColor: '#fff', paddingTop: TOP_INSET, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#EEF2F7' },
  headerTop: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 12 },
  backBtn: { fontSize: 13, fontWeight: '700', color: BRAND.csblue, paddingRight: 12 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '800', color: BRAND.navy },
  logoutBtn: { fontSize: 13, fontWeight: '700', color: '#E53935', paddingLeft: 12 },
  sessionInfo: { paddingHorizontal: 16, paddingBottom: 8 },
  sessionText: { fontSize: 11, color: '#90A4AE', fontStyle: 'italic' },
  content: { padding: 16, paddingBottom: 44 },
  contentTitle: { fontSize: 20, fontWeight: '800', color: BRAND.navy, marginBottom: 16 },
  noAccess: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  icon: { fontSize: 60, marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '800', color: BRAND.navy, textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#90A4AE', textAlign: 'center', marginBottom: 32 },
  authenticateBtn: { backgroundColor: BRAND.navy, paddingHorizontal: 32, paddingVertical: 14, borderRadius: 10 },
  authenticateBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  toolCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#F0F0F0' },
  toolIcon: { width: 54, height: 54, borderRadius: 12, backgroundColor: '#F5F7FA', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  toolIconText: { fontSize: 28 },
  toolInfo: { flex: 1 },
  toolTitle: { fontSize: 15, fontWeight: '700', color: BRAND.navy, marginBottom: 2 },
  toolSubtitle: { fontSize: 12, color: '#90A4AE', marginBottom: 4 },
  toolDesc: { fontSize: 11, color: '#90A4AE', lineHeight: 15 },
  arrow: { fontSize: 20, color: BRAND.navy, fontWeight: '600', marginLeft: 8 },
  footer: { marginTop: 24, paddingVertical: 16, alignItems: 'center' },
  footerText: { fontSize: 12, color: '#90A4AE', textAlign: 'center' },
});
