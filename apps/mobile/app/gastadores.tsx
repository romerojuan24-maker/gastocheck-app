// Gestión de Gastadores — solo visible para owner/admin
import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList,
  ActivityIndicator, Modal, TextInput, Alert,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { BRAND } from '@gastocheck/shared';
import { supabase } from '../lib/supabase';

const INVITE_FN = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/invite-gastador`;

interface Gastador {
  id:        string;
  user_id:   string;
  status:    string;
  full_name: string | null;
  email:     string | null;
  role:      string;
}

export default function GastadoresScreen() {
  const [gastadores,   setGastadores]  = useState<Gastador[]>([]);
  const [loading,      setLoading]     = useState(true);
  const [companyId,    setCompanyId]   = useState<string | null>(null);
  const [showModal,    setShowModal]   = useState(false);
  const [submitting,   setSubmitting]  = useState(false);

  // Form fields
  const [fName,     setFName]     = useState('');
  const [fEmail,    setFEmail]    = useState('');
  const [fPassword, setFPassword] = useState('');
  const [showPass,  setShowPass]  = useState(false);

  const loadGastadores = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: member } = await supabase
        .from('company_members')
        .select('company_id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (!member) return;
      setCompanyId(member.company_id);

      // Traer todos los miembros con rol spender/employee
      const { data: members } = await supabase
        .from('company_members')
        .select('id, user_id, status, role')
        .eq('company_id', member.company_id)
        .in('role', ['spender', 'employee'])
        .order('created_at', { ascending: false });

      if (!members?.length) { setGastadores([]); return; }

      // Enriquecer con profiles
      const userIds = members.map((m: any) => m.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds);

      // Enriquecer con emails vía auth (disponible solo para el mismo usuario)
      const enriched: Gastador[] = members.map((m: any) => {
        const profile = profiles?.find((p: any) => p.id === m.user_id);
        return {
          id:        m.id,
          user_id:   m.user_id,
          status:    m.status,
          role:      m.role,
          full_name: profile?.full_name ?? null,
          email:     null,
        };
      });
      setGastadores(enriched);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadGastadores(); }, [loadGastadores]);

  function resetForm() {
    setFName(''); setFEmail(''); setFPassword(''); setShowPass(false);
  }

  async function handleInvite() {
    if (!fName.trim() || !fEmail.trim()) {
      Alert.alert('Campos requeridos', 'Nombre completo y correo son obligatorios.');
      return;
    }
    if (fPassword && fPassword.length < 8) {
      Alert.alert('Contraseña muy corta', 'Debe tener al menos 8 caracteres.');
      return;
    }
    if (!companyId) return;

    setSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        Alert.alert('Sin sesión', 'Inicia sesión nuevamente.');
        return;
      }

      const body: Record<string, string> = {
        company_id: companyId,
        full_name:  fName.trim(),
        email:      fEmail.trim().toLowerCase(),
        role:       'spender',
      };
      if (fPassword.trim()) body.password = fPassword.trim();

      const res = await fetch(INVITE_FN, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          Authorization:  `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        Alert.alert('Error', data.error ?? 'No se pudo crear el comprador.');
        return;
      }

      const successMsg = data.temp_password
        ? `Comprador creado.\n\nContraseña temporal: ${data.temp_password}\n\nGuárdala — no se mostrará de nuevo.`
        : 'Comprador creado exitosamente.';

      Alert.alert('✓ Comprador agregado', successMsg, [
        {
          text: 'Entendido',
          onPress: () => {
            setShowModal(false);
            resetForm();
            loadGastadores();
          },
        },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Verifica tu conexión.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleStatus(gastador: Gastador) {
    const newStatus = gastador.status === 'active' ? 'disabled' : 'active';
    const label = newStatus === 'active' ? 'activar' : 'deshabilitar';
    Alert.alert(
      `¿${label.charAt(0).toUpperCase() + label.slice(1)} comprador?`,
      `${gastador.full_name ?? gastador.email ?? 'Este comprador'} quedará ${newStatus === 'active' ? 'activo' : 'inactivo'}.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: label.charAt(0).toUpperCase() + label.slice(1),
          onPress: async () => {
            const { error } = await supabase
              .from('company_members')
              .update({ status: newStatus })
              .eq('id', gastador.id);
            if (error) Alert.alert('Error', error.message);
            else loadGastadores();
          },
        },
      ],
    );
  }

  function renderItem({ item }: { item: Gastador }) {
    const isActive = item.status === 'active';
    const initials = (item.full_name ?? '?')
      .split(' ')
      .map((w) => w[0] ?? '')
      .slice(0, 2)
      .join('')
      .toUpperCase();

    return (
      <View style={[styles.card, !isActive && styles.cardDisabled]}>
        <View style={styles.cardRow}>
          <View style={[styles.avatar, !isActive && { backgroundColor: '#E0E0E0' }]}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.name}>{item.full_name ?? '(sin nombre)'}</Text>
            <Text style={styles.meta}>
              {isActive ? '🟢 Activo' : '⚪ Deshabilitado'} · {item.role}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.toggleBtn, isActive ? styles.toggleBtnDisable : styles.toggleBtnActivate]}
            onPress={() => handleToggleStatus(item)}
          >
            <Text style={[styles.toggleBtnText, !isActive && { color: BRAND.green }]}>
              {isActive ? 'Deshabilitar' : 'Activar'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: BRAND.gray }}>
      {/* Botón agregar */}
      <TouchableOpacity style={styles.addBtn} onPress={() => setShowModal(true)}>
        <Text style={styles.addBtnText}>+ Agregar Comprador</Text>
      </TouchableOpacity>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={BRAND.blue} />
        </View>
      ) : gastadores.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>👤</Text>
          <Text style={styles.emptyTitle}>Sin compradores</Text>
          <Text style={styles.emptyText}>Agrega tu primer comprador para que pueda registrar gastos.</Text>
        </View>
      ) : (
        <FlatList
          data={gastadores}
          keyExtractor={(g) => g.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 12, paddingBottom: 32 }}
          refreshing={loading}
          onRefresh={loadGastadores}
        />
      )}

      {/* Modal: agregar gastador */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet"
        onRequestClose={() => { setShowModal(false); resetForm(); }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nuevo Comprador</Text>
              <TouchableOpacity onPress={() => { setShowModal(false); resetForm(); }}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
              <Text style={styles.fieldLabel}>Nombre completo *</Text>
              <TextInput
                style={styles.input}
                placeholder="Juan Pérez"
                placeholderTextColor="#B0BEC5"
                value={fName}
                onChangeText={setFName}
                autoCapitalize="words"
              />

              <Text style={styles.fieldLabel}>Correo electrónico *</Text>
              <TextInput
                style={styles.input}
                placeholder="juan@miempresa.com"
                placeholderTextColor="#B0BEC5"
                value={fEmail}
                onChangeText={setFEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />

              <Text style={styles.fieldLabel}>Contraseña (opcional)</Text>
              <View style={styles.passwordRow}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="Dejar vacío para generar automáticamente"
                  placeholderTextColor="#B0BEC5"
                  value={fPassword}
                  onChangeText={setFPassword}
                  secureTextEntry={!showPass}
                />
                <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPass(!showPass)}>
                  <Text style={styles.eyeIcon}>{showPass ? '🙈' : '👁️'}</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.hint}>
                Si dejas la contraseña vacía, se generará una temporal que deberás compartir con el comprador.
              </Text>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => { setShowModal(false); resetForm(); }}>
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.createBtn, submitting && { opacity: 0.6 }]}
                onPress={handleInvite}
                disabled={submitting}
              >
                {submitting
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.createBtnText}>Agregar Comprador</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  addBtn:         { margin: 12, backgroundColor: BRAND.blue, borderRadius: 12, padding: 14, alignItems: 'center' },
  addBtnText:     { color: '#fff', fontSize: 15, fontWeight: '700' },
  center:         { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyIcon:      { fontSize: 48, marginBottom: 8 },
  emptyTitle:     { fontSize: 18, fontWeight: '700', color: BRAND.navy, marginBottom: 4 },
  emptyText:      { fontSize: 14, color: '#90A4AE', textAlign: 'center', lineHeight: 20 },
  card:           { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 8 },
  cardDisabled:   { opacity: 0.6 },
  cardRow:        { flexDirection: 'row', alignItems: 'center' },
  avatar:         {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: BRAND.blue + '20',
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText:     { fontSize: 16, fontWeight: '700', color: BRAND.blue },
  name:           { fontSize: 15, fontWeight: '700', color: BRAND.navy },
  meta:           { fontSize: 12, color: '#90A4AE', marginTop: 2 },
  toggleBtn:      { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1 },
  toggleBtnDisable: { borderColor: '#FFCDD2', backgroundColor: '#FFF3F3' },
  toggleBtnActivate: { borderColor: '#C8E6C9', backgroundColor: '#F1F8F1' },
  toggleBtnText:  { fontSize: 12, fontWeight: '700', color: BRAND.red },
  // Modal
  modal:          { flex: 1, backgroundColor: BRAND.gray },
  modalHeader:    {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E0E0E0',
  },
  modalTitle:     { fontSize: 17, fontWeight: '800', color: BRAND.navy },
  modalClose:     { fontSize: 18, color: '#90A4AE', fontWeight: '700' },
  modalBody:      { padding: 16 },
  fieldLabel:     { fontSize: 11, fontWeight: '700', color: '#90A4AE', textTransform: 'uppercase', marginBottom: 6, marginTop: 14 },
  input:          {
    backgroundColor: '#fff', borderRadius: 10, padding: 13,
    borderWidth: 1, borderColor: '#E0E0E0', fontSize: 15, color: BRAND.navy,
  },
  passwordRow:    { flexDirection: 'row', gap: 8, alignItems: 'center' },
  eyeBtn:         { backgroundColor: '#fff', borderRadius: 10, padding: 13, borderWidth: 1, borderColor: '#E0E0E0' },
  eyeIcon:        { fontSize: 18 },
  hint:           { fontSize: 12, color: '#90A4AE', marginTop: 8, lineHeight: 17 },
  modalActions:   {
    flexDirection: 'row', gap: 12, padding: 16, paddingBottom: 32,
    backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#F0F0F0',
  },
  cancelBtn:      { flex: 1, backgroundColor: '#F5F5F5', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  cancelBtnText:  { fontSize: 15, fontWeight: '700', color: '#90A4AE' },
  createBtn:      { flex: 2, backgroundColor: BRAND.blue, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  createBtnText:  { fontSize: 15, fontWeight: '700', color: '#fff' },
});
