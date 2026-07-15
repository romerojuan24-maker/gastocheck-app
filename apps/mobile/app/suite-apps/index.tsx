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
    title: 'Banco',
    icon: '🏦',
    route: '/bancocheck',
  },
  {
    id: 'facturacheck',
    title: 'Factura',
    icon: '📄',
    route: '/facturacheck',
  },
  {
    id: 'flujocheck',
    title: 'Flujo',
    icon: '💰',
    route: '/flujocheck',
  },
  {
    id: 'inventariocheck',
    title: 'Inventario',
    icon: '📦',
    route: '/inventariocheck',
  },
];

const BOTTOM_GRID = [
  { id: 'empresa',    icon: '🏢', label: 'Empresa',    route: '/empresas' },
  { id: 'empleados',  icon: '👥', label: 'Empleados',  route: '/equipo' },
  { id: 'finanzas',   icon: '💰', label: 'Finanzas',   route: '/administracion' },
  { id: 'engrane',    icon: '⚙️',  label: 'Engrane',    route: '/settings' },
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
          <Text style={s.sessionText}>Sesión • {formatTimeRemaining(remainingTime)}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.content}>
        {TOOLS.map(tool => (
          <TouchableOpacity
            key={tool.id}
            style={s.fullWidthBtn}
            onPress={() => handleToolPress(tool.route)}
            activeOpacity={0.7}
          >
            <Text style={s.fullWidthIcon}>{tool.icon}</Text>
            <Text style={s.fullWidthLabel}>{tool.title}</Text>
          </TouchableOpacity>
        ))}

        <View style={s.bottomGrid}>
          {BOTTOM_GRID.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={s.bottomGridItem}
              onPress={() => handleToolPress(item.route)}
              activeOpacity={0.7}
            >
              <Text style={s.bottomGridIcon}>{item.icon}</Text>
              <Text style={s.bottomGridLabel}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={s.footer}>
          <Text style={s.footerText}>🔐 Sesión segura</Text>
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
  sessionText: { fontSize: 11, color: '#90A4AE' },
  content: { padding: 16, paddingBottom: 44 },
  noAccess: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  icon: { fontSize: 60, marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '800', color: BRAND.navy, textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#90A4AE', textAlign: 'center', marginBottom: 32 },
  authenticateBtn: { backgroundColor: BRAND.navy, paddingHorizontal: 32, paddingVertical: 14, borderRadius: 10 },
  authenticateBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  fullWidthBtn: {
    backgroundColor: '#fff', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginBottom: 12,
    elevation: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 3,
  },
  fullWidthIcon: { fontSize: 28 },
  fullWidthLabel: { fontSize: 14, fontWeight: '600', color: BRAND.navy },

  bottomGrid: {
    flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginTop: 20, marginBottom: 16,
  },
  bottomGridItem: {
    flex: 1, aspectRatio: 1, backgroundColor: '#fff', borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
    elevation: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 3,
  },
  bottomGridIcon: { fontSize: 28, marginBottom: 4 },
  bottomGridLabel: { fontSize: 9, fontWeight: '600', color: BRAND.navy, textAlign: 'center' },
  footer: { marginTop: 24, paddingVertical: 16, alignItems: 'center' },
  footerText: { fontSize: 12, color: '#90A4AE', textAlign: 'center' },
});
