import { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Alert, Modal, TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Updates from 'expo-updates';
import { BRAND, isFleetSector } from '@gastocheck/shared';
import type { CompanySector } from '@gastocheck/shared';
import { supabase } from '../lib/supabase';

// ── Versión de este OTA (incrementar con cada eas update) ─────────────────────
const OTA_VERSION = 'OTA 5 · v1.0.5';

const CREATE_COMPANY_FN = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/create-company`;

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';

interface Profile {
  email:   string;
  role:    string;
  company: string;
  sector:  CompanySector | null;
}

const ROLE_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  admin:      { label: 'Administrador',  icon: '👑', color: BRAND.purple },
  supervisor: { label: 'Supervisor',     icon: '🧑‍💼', color: BRAND.blue },
  employee:   { label: 'Empleado',       icon: '👤', color: BRAND.navy },
  accountant: { label: 'Contador',       icon: '🧮', color: BRAND.green },
};

export default function SettingsScreen() {
  const router = useRouter();
  const [profile,  setProfile]  = useState<Profile | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [role,     setRole]     = useState<string>('employee');
  const [connOk,   setConnOk]   = useState<boolean | null>(null);
  const [connChecking, setConnChecking] = useState(false);
  const [showCreateCo,  setShowCreateCo]  = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [creatingCo,    setCreatingCo]    = useState(false);

  useEffect(() => { loadProfile(); }, []);

  async function loadProfile() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: member } = await supabase
        .from('company_members')
        .select('role, companies(name, sector)')
        .eq('user_id', user.id)
        .single();

      setRole(member?.role ?? 'employee');
      setProfile({
        email:   user.email ?? '',
        role:    member?.role ?? 'employee',
        company: (member?.companies as any)?.name ?? 'Sin empresa',
        sector:  (member?.companies as any)?.sector ?? null,
      });
    } finally {
      setLoading(false);
    }
  }

  async function checkConnection() {
    setConnChecking(true);
    setConnOk(null);
    try {
      const { error } = await supabase.from('companies').select('id').limit(1);
      setConnOk(!error);
      if (error) Alert.alert('Sin conexión', error.message);
    } catch {
      setConnOk(false);
    } finally {
      setConnChecking(false);
    }
  }

  async function handleCreateCompany() {
    if (!newCompanyName.trim()) return;
    setCreatingCo(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        Alert.alert('Sin sesión', 'Inicia sesión nuevamente.');
        return;
      }
      const res = await fetch(CREATE_COMPANY_FN, {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ company_name: newCompanyName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        Alert.alert('Error', data.error ?? 'No se pudo crear la empresa.');
        return;
      }
      setShowCreateCo(false);
      setNewCompanyName('');
      Alert.alert('¡Listo!', 'Tu empresa fue creada. Bienvenido a GastoCheck.');
      loadProfile();
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Verifica tu conexión e inténtalo de nuevo.');
    } finally {
      setCreatingCo(false);
    }
  }

  async function handleLogout() {
    Alert.alert(
      'Cerrar sesión',
      '¿Estás seguro que deseas salir?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Salir',
          style: 'destructive',
          onPress: async () => {
            await supabase.auth.signOut();
          },
        },
      ],
    );
  }

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BRAND.gray }}>
        <ActivityIndicator size="large" color={BRAND.blue} />
      </View>
    );
  }

  const roleMeta = ROLE_LABELS[role] ?? ROLE_LABELS.employee;
  const isSupervisor = role === 'admin' || role === 'supervisor';
  const isFleet = isFleetSector(profile?.sector ?? null);

  return (
    <ScrollView style={{ backgroundColor: BRAND.gray }} contentContainerStyle={styles.scroll}>

      {/* Perfil */}
      <View style={styles.card}>
        <View style={styles.avatarRow}>
          <View style={[styles.avatar, { backgroundColor: roleMeta.color + '20' }]}>
            <Text style={styles.avatarIcon}>{roleMeta.icon}</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={styles.name} numberOfLines={1}>{profile?.email ?? '—'}</Text>
            <View style={[styles.roleBadge, { backgroundColor: roleMeta.color + '15' }]}>
              <Text style={[styles.roleLabel, { color: roleMeta.color }]}>
                {roleMeta.icon} {roleMeta.label}
              </Text>
            </View>
          </View>
        </View>
        <View style={styles.divider} />
        <Row icon="🏢" label="Empresa" value={profile?.company ?? '—'} />
        {(profile?.company === 'Sin empresa' || !profile?.company) && (
          <TouchableOpacity style={styles.createCoBtn} onPress={() => setShowCreateCo(true)}>
            <Text style={styles.createCoBtnText}>+ Crear empresa</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Acceso supervisor */}
      {isSupervisor && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Panel de supervisor</Text>
          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/supervisor')}>
            <Text style={styles.menuIcon}>🧑‍💼</Text>
            <Text style={styles.menuLabel}>Panel de supervisión</Text>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Navegación */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Accesos rápidos</Text>
        <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/receipts')}>
          <Text style={styles.menuIcon}>🧾</Text>
          <Text style={styles.menuLabel}>Mis comprobantes</Text>
          <Text style={styles.menuArrow}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/batches')}>
          <Text style={styles.menuIcon}>📁</Text>
          <Text style={styles.menuLabel}>Relaciones contables</Text>
          <Text style={styles.menuArrow}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/advance-request')}>
          <Text style={styles.menuIcon}>💸</Text>
          <Text style={styles.menuLabel}>Mis solicitudes de anticipo</Text>
          <Text style={styles.menuArrow}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Vertical Flotillas */}
      {isFleet && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🚛 Flotillas y Reparto</Text>
          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/fleet-dashboard')}>
            <Text style={styles.menuIcon}>📊</Text>
            <Text style={styles.menuLabel}>Dashboard Flotilla</Text>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/fleet-vehicles')}>
            <Text style={styles.menuIcon}>🚗</Text>
            <Text style={styles.menuLabel}>Mis vehículos</Text>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/fleet-operators')}>
            <Text style={styles.menuIcon}>🧑‍✈️</Text>
            <Text style={styles.menuLabel}>Mis operadores</Text>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/item-search')}>
            <Text style={styles.menuIcon}>🔍</Text>
            <Text style={styles.menuLabel}>Historial de refacciones</Text>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Conexión Supabase */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Conexión a base de datos</Text>
        <View style={styles.menuItem}>
          <Text style={styles.menuIcon}>🔗</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.menuLabel}>Supabase URL</Text>
            <Text style={styles.connUrl} numberOfLines={1} ellipsizeMode="middle">
              {SUPABASE_URL || '(no configurada)'}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={[styles.menuItem, { borderTopWidth: 1, borderTopColor: '#F5F5F5' }]}
          onPress={checkConnection}
          disabled={connChecking}
        >
          <Text style={styles.menuIcon}>
            {connChecking ? '⏳' : connOk === true ? '✅' : connOk === false ? '❌' : '🔌'}
          </Text>
          <Text style={styles.menuLabel}>
            {connChecking
              ? 'Probando conexión...'
              : connOk === true
              ? 'Conexión activa'
              : connOk === false
              ? 'Sin conexión — tap para reintentar'
              : 'Probar conexión'}
          </Text>
          {!connChecking && <Text style={styles.menuArrow}>›</Text>}
        </TouchableOpacity>
      </View>

      {/* Cerrar sesión */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>Cerrar sesión</Text>
      </TouchableOpacity>

      {/* Modal: Crear empresa */}
      <Modal visible={showCreateCo} animationType="slide" presentationStyle="pageSheet"
        onRequestClose={() => setShowCreateCo(false)}>
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowCreateCo(false)}>
              <Text style={styles.modalCancel}>Cancelar</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Crear empresa</Text>
            <TouchableOpacity
              onPress={handleCreateCompany}
              disabled={!newCompanyName.trim() || creatingCo}
            >
              <Text style={[styles.modalSave, (!newCompanyName.trim() || creatingCo) && { opacity: 0.4 }]}>
                {creatingCo ? '...' : 'Crear'}
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.modalBody}>
            <Text style={styles.modalLabel}>Nombre de tu empresa *</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Mi Empresa S.A. de C.V."
              placeholderTextColor="#B0BEC5"
              value={newCompanyName}
              onChangeText={setNewCompanyName}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleCreateCompany}
            />
            <Text style={styles.modalHint}>
              Serás el administrador con acceso total. Podrás invitar a un colaborador durante el período de prueba.
            </Text>
          </View>
        </View>
      </Modal>

      {/* Versión OTA — actualizar OTA_VERSION con cada eas update */}
      <View style={styles.versionBox}>
        <Text style={styles.versionMain}>GastoCheck</Text>
        <Text style={styles.versionOta}>{OTA_VERSION}</Text>
        {Updates.updateId ? (
          <Text style={styles.versionId}>
            ID: {Updates.updateId.slice(0, 8)}…
          </Text>
        ) : (
          <Text style={styles.versionId}>Build local / dev</Text>
        )}
      </View>
    </ScrollView>
  );
}

function Row({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowIcon}>{icon}</Text>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll:       { padding: 16, paddingBottom: 40 },
  card:         { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16 },
  avatarRow:    { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  avatar:       { width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center' },
  avatarIcon:   { fontSize: 24 },
  name:         { fontSize: 15, fontWeight: '700', color: BRAND.navy, marginBottom: 4 },
  roleBadge:    { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  roleLabel:    { fontSize: 12, fontWeight: '700' },
  divider:      { height: 1, backgroundColor: '#F0F0F0', marginBottom: 12 },
  row:          { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  rowIcon:      { fontSize: 16, width: 24 },
  rowLabel:     { flex: 1, fontSize: 14, color: '#90A4AE' },
  rowValue:     { fontSize: 14, fontWeight: '600', color: BRAND.navy },
  section:      { backgroundColor: '#fff', borderRadius: 16, marginBottom: 16, overflow: 'hidden' },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: '#90A4AE', textTransform: 'uppercase', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 },
  menuItem:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: 1, borderTopColor: '#F5F5F5' },
  menuIcon:     { fontSize: 18, width: 28 },
  menuLabel:    { flex: 1, fontSize: 15, color: BRAND.navy, fontWeight: '500' },
  menuArrow:    { fontSize: 20, color: '#C0C0C0' },
  logoutBtn:    { backgroundColor: '#FFEBEE', borderRadius: 14, padding: 16, alignItems: 'center', marginBottom: 16 },
  logoutText:   { color: BRAND.red, fontSize: 16, fontWeight: '700' },
  versionBox:   { alignItems: 'center', paddingVertical: 12, marginBottom: 8 },
  versionMain:  { fontSize: 13, fontWeight: '700', color: '#90A4AE' },
  versionOta:   { fontSize: 16, fontWeight: '800', color: BRAND.blue, marginTop: 2 },
  versionId:    { fontSize: 10, color: '#B0BEC5', marginTop: 4, fontFamily: 'monospace' },
  connUrl:      { fontSize: 11, color: '#90A4AE', marginTop: 2 },
  createCoBtn:  { marginTop: 10, backgroundColor: BRAND.blue, borderRadius: 10, padding: 11, alignItems: 'center' },
  createCoBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  modal:        { flex: 1, backgroundColor: BRAND.gray },
  modalHeader:  {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E0E0E0',
  },
  modalTitle:   { fontSize: 16, fontWeight: '700', color: BRAND.navy },
  modalCancel:  { fontSize: 15, color: '#90A4AE', paddingVertical: 4, paddingHorizontal: 4 },
  modalSave:    { fontSize: 15, color: BRAND.blue, fontWeight: '700', paddingVertical: 4, paddingHorizontal: 4 },
  modalBody:    { padding: 16 },
  modalLabel:   { fontSize: 11, fontWeight: '700', color: '#90A4AE', textTransform: 'uppercase', marginBottom: 8, marginTop: 12 },
  modalInput:   {
    backgroundColor: '#fff', borderRadius: 10, padding: 13,
    borderWidth: 1, borderColor: '#E0E0E0', fontSize: 15, color: BRAND.navy,
  },
  modalHint:    { fontSize: 12, color: '#90A4AE', marginTop: 12, lineHeight: 18 },
});
