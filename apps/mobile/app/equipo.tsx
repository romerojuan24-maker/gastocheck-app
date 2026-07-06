// Equipo — pantalla única de gestión de equipo para TODA la plataforma.
// Antes cada módulo (GastoCheck, CobraCheck) tenía su propia versión
// parcial/duplicada; esta es la única fuente para ver miembros, cambiar
// roles e invitar, sin importar en qué módulo se vaya a trabajar.
import { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  TextInput, Alert, ActivityIndicator, Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { BRAND } from '@gastocheck/shared';
import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const MANAGER_ROLES = ['owner', 'admin', 'supervisor', 'accountant', 'contador_general'];

const ROLE_META: Record<string, { label: string; icon: string; color: string; desc: string }> = {
  owner:            { label: 'Propietario',       icon: '👑', color: BRAND.navy,   desc: 'Acceso total, no se puede invitar (se crea al registrar la empresa).' },
  admin:            { label: 'Admin',              icon: '👑', color: BRAND.navy,   desc: 'Acceso completo: empresa, equipo, cuentas bancarias y todos los módulos.' },
  contador_general: { label: 'Contador General',   icon: '📊', color: BRAND.purple, desc: 'Contador de toda la empresa: ve y aprueba en todos los módulos.' },
  accountant:       { label: 'Contador de Módulo', icon: '🧮', color: BRAND.purple, desc: 'Clasifica cuentas, valida CFDI, genera pólizas y exporta a CONTPAQi.' },
  spender:          { label: 'Comprador',          icon: '🛒', color: BRAND.green,  desc: 'Captura tickets, genera reembolsos y consulta proveedores.' },
  collector:        { label: 'Cobrador',           icon: '🎯', color: BRAND.cobra,  desc: 'Rutas de cobranza, registra pagos y promesas de clientes.' },
  supervisor:       { label: 'Supervisor',         icon: '📋', color: BRAND.orange ?? '#FB8C00', desc: 'Aprueba anticipos y reembolsos del equipo.' },
};

const INVITABLE_ROLES = ['admin', 'contador_general', 'accountant', 'spender', 'collector'];

interface Member {
  user_id: string;
  role: string;
  full_name: string | null;
}

export default function EquipoScreen() {
  const router = useRouter();
  const [loading,     setLoading]     = useState(true);
  const [companyId,   setCompanyId]   = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [userId,      setUserId]      = useState<string | null>(null);
  const [userRole,    setUserRole]    = useState<string | null>(null);
  const [members,     setMembers]     = useState<Member[]>([]);

  const [showInvite, setShowInvite] = useState(false);
  const [inviteRole, setInviteRole] = useState<string>('spender');
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const selectedId = await AsyncStorage.getItem('selectedCompanyId');
      if (!selectedId) { setLoading(false); return; }
      setCompanyId(selectedId);

      const { data: me } = await supabase
        .from('company_members')
        .select('role')
        .eq('company_id', selectedId)
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle();
      setUserRole(me?.role ?? null);

      const { data: co } = await supabase.from('companies').select('name').eq('id', selectedId).maybeSingle();
      setCompanyName((co as any)?.name ?? null);

      const { data: mlist } = await supabase
        .from('company_members')
        .select('user_id, role, profiles:user_id(full_name)')
        .eq('company_id', selectedId)
        .eq('status', 'active')
        .order('role');
      setMembers((mlist ?? []).map((m: any) => ({
        user_id: m.user_id, role: m.role, full_name: m.profiles?.full_name ?? null,
      })));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  function showMemberOptions(m: Member) {
    const isSelf = m.user_id === userId;
    Alert.alert(
      m.full_name ?? '(sin nombre)',
      `Rol: ${ROLE_META[m.role]?.label ?? m.role}`,
      [
        ...(!isSelf ? [{ text: '🔄 Cambiar rol', onPress: () => changeMemberRole(m) }] : []),
        ...(!isSelf ? [{ text: '🚫 Quitar del equipo', style: 'destructive' as const, onPress: () => removeMember(m) }] : []),
        { text: 'Cancelar', style: 'cancel' as const },
      ],
    );
  }

  function changeMemberRole(m: Member) {
    if (!companyId) return;
    const opts = INVITABLE_ROLES
      .filter((r) => r !== m.role)
      .map((r) => ({ role: r, label: `${ROLE_META[r].icon} ${ROLE_META[r].label}` }));
    Alert.alert(
      `Cambiar rol de ${m.full_name ?? '...'}`,
      'Selecciona el nuevo rol:',
      [
        ...opts.map((o) => ({
          text: o.label,
          onPress: async () => {
            const { error } = await supabase.from('company_members').update({ role: o.role })
              .eq('user_id', m.user_id).eq('company_id', companyId);
            if (error) { Alert.alert('Error', 'No se pudo cambiar el rol.'); return; }
            load();
          },
        })),
        { text: 'Cancelar', style: 'cancel' as const },
      ],
    );
  }

  function removeMember(m: Member) {
    if (!companyId) return;
    Alert.alert(
      '¿Quitar del equipo?',
      `${m.full_name ?? '(sin nombre)'} perderá acceso a esta empresa.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Quitar', style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.from('company_members')
              .update({ status: 'disabled' })
              .eq('user_id', m.user_id).eq('company_id', companyId);
            if (error) { Alert.alert('Error', 'No se pudo quitar al miembro.'); return; }
            load();
          },
        },
      ],
    );
  }

  async function handleInvite() {
    if (!companyId) return;
    if (!inviteName.trim() || !inviteEmail.trim()) {
      Alert.alert('Faltan datos', 'Nombre y correo son obligatorios.');
      return;
    }
    setInviting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke('invite-gastador', {
        body: {
          company_id: companyId,
          full_name:  inviteName.trim(),
          email:      inviteEmail.trim().toLowerCase(),
          role:       inviteRole,
        },
        headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
      });
      if (error || data?.error) {
        Alert.alert('Error', data?.error ?? error?.message ?? 'No se pudo invitar.');
        return;
      }
      setShowInvite(false);
      setInviteName('');
      setInviteEmail('');
      const tempMsg = data?.temp_password ? `\n\nContraseña temporal: ${data.temp_password}` : '';
      Alert.alert('✓ Invitado', `${inviteName.trim()} ya tiene acceso como ${ROLE_META[inviteRole]?.label}.${tempMsg}`);
      load();
    } finally {
      setInviting(false);
    }
  }

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BRAND.gray }}>
        <ActivityIndicator size="large" color={BRAND.blue} />
      </View>
    );
  }

  if (!userRole || !MANAGER_ROLES.includes(userRole)) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BRAND.gray, padding: 24 }}>
        <Text style={{ fontSize: 40, marginBottom: 12 }}>🔒</Text>
        <Text style={{ fontSize: 16, fontWeight: '700', color: BRAND.navy, textAlign: 'center' }}>Sin acceso a Equipo</Text>
        <Text style={{ fontSize: 13, color: '#90A4AE', textAlign: 'center', marginTop: 6 }}>
          Tu rol no tiene permiso para gestionar el equipo.
        </Text>
        <TouchableOpacity style={{ marginTop: 20 }} onPress={() => router.back()}>
          <Text style={{ color: BRAND.blue, fontWeight: '700' }}>← Volver</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: BRAND.gray }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>‹</Text>
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Equipo</Text>
          {companyName && <Text style={styles.headerSub}>{companyName}</Text>}
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Text style={styles.sectionHint}>
          Todos los miembros de la empresa, en cualquier módulo — administra roles e invita aquí una sola vez.
        </Text>

        {members.length === 0 ? (
          <Text style={styles.emptyHint}>Sin miembros aún.</Text>
        ) : (
          members.map((m) => {
            const meta = ROLE_META[m.role] ?? { label: m.role, icon: '👤', color: '#90A4AE' };
            return (
              <TouchableOpacity key={m.user_id} style={styles.memberRow} onPress={() => showMemberOptions(m)} activeOpacity={0.8}>
                <View style={[styles.memberAvatar, { backgroundColor: meta.color + '18' }]}>
                  <Text style={{ fontSize: 18 }}>{meta.icon}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.memberName}>
                    {m.full_name ?? '(sin nombre)'}{m.user_id === userId ? '  (tú)' : ''}
                  </Text>
                  <View style={[styles.rolePill, { backgroundColor: meta.color + '18' }]}>
                    <Text style={[styles.rolePillText, { color: meta.color }]}>{meta.label}</Text>
                  </View>
                </View>
                {m.user_id !== userId && <Text style={{ fontSize: 18, color: '#B0BEC5' }}>···</Text>}
              </TouchableOpacity>
            );
          })
        )}

        <TouchableOpacity style={styles.inviteBtn} onPress={() => setShowInvite(true)}>
          <Text style={styles.inviteBtnText}>+ Invitar al equipo</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Modal invitar */}
      <Modal visible={showInvite} animationType="slide" transparent onRequestClose={() => setShowInvite(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Invitar al equipo</Text>

            <Text style={styles.fieldLabel}>Nombre completo</Text>
            <TextInput style={styles.input} value={inviteName} onChangeText={setInviteName} placeholder="Nombre y apellido" placeholderTextColor="#B0BEC5" />

            <Text style={styles.fieldLabel}>Correo</Text>
            <TextInput style={styles.input} value={inviteEmail} onChangeText={setInviteEmail} placeholder="correo@empresa.com"
              placeholderTextColor="#B0BEC5" autoCapitalize="none" keyboardType="email-address" />

            <Text style={styles.fieldLabel}>Rol</Text>
            <View style={{ gap: 8, marginBottom: 16 }}>
              {INVITABLE_ROLES.map((r) => {
                const meta = ROLE_META[r];
                const active = inviteRole === r;
                return (
                  <TouchableOpacity key={r} style={[styles.roleOption, active && { borderColor: meta.color, backgroundColor: meta.color + '10' }]}
                    onPress={() => setInviteRole(r)}>
                    <Text style={{ fontSize: 18, marginRight: 10 }}>{meta.icon}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.roleOptionTitle, active && { color: meta.color }]}>{meta.label}</Text>
                      <Text style={styles.roleOptionDesc}>{meta.desc}</Text>
                    </View>
                    {active && <Text style={{ color: meta.color, fontSize: 16 }}>✓</Text>}
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity style={[styles.modalCancelBtn, { flex: 1 }]} onPress={() => setShowInvite(false)}>
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalSaveBtn, { flex: 1 }, inviting && { opacity: 0.6 }]} onPress={handleInvite} disabled={inviting}>
                {inviting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.modalSaveText}>Invitar</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#fff', paddingTop: 54, paddingBottom: 16, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: '#E0E0E0',
  },
  backBtn: { padding: 4 },
  backBtnText: { fontSize: 28, color: BRAND.navy },
  headerTitle: { fontSize: 18, fontWeight: '800', color: BRAND.navy },
  headerSub: { fontSize: 12, color: '#90A4AE', marginTop: 1 },

  sectionHint: { fontSize: 12, color: '#90A4AE', marginBottom: 14, lineHeight: 17 },
  emptyHint: { fontSize: 13, color: '#B0BEC5', textAlign: 'center', paddingVertical: 20 },

  memberRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderRadius: 12, padding: 12, marginBottom: 8,
    borderWidth: 1, borderColor: '#E8EAF6',
  },
  memberAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  memberName: { fontSize: 15, fontWeight: '700', color: BRAND.navy },
  rolePill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, marginTop: 4, alignSelf: 'flex-start' },
  rolePillText: { fontSize: 11, fontWeight: '700' },

  inviteBtn: {
    borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 12,
    borderWidth: 1.5, borderColor: BRAND.blue, borderStyle: 'dashed',
  },
  inviteBtnText: { fontSize: 14, fontWeight: '700', color: BRAND.blue },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40, maxHeight: '85%' },
  modalTitle: { fontSize: 18, fontWeight: '800', color: BRAND.navy, marginBottom: 16 },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: '#90A4AE', textTransform: 'uppercase', marginBottom: 6, marginTop: 8 },
  input: { backgroundColor: '#fff', borderRadius: 12, padding: 13, borderWidth: 1, borderColor: '#E0E0E0', fontSize: 15, color: BRAND.navy },

  roleOption: {
    flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12,
    borderWidth: 1.5, borderColor: '#E0E0E0', backgroundColor: '#fff',
  },
  roleOptionTitle: { fontSize: 14, fontWeight: '700', color: BRAND.navy },
  roleOptionDesc: { fontSize: 11, color: '#90A4AE', marginTop: 1 },

  modalCancelBtn: { borderRadius: 12, paddingVertical: 13, backgroundColor: '#F5F5F5', alignItems: 'center' },
  modalCancelText: { fontSize: 15, fontWeight: '600', color: '#90A4AE' },
  modalSaveBtn: { borderRadius: 12, paddingVertical: 13, backgroundColor: BRAND.blue, alignItems: 'center' },
  modalSaveText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
