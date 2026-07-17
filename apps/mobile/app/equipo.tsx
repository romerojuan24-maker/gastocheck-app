// Equipo — pantalla única de gestión de equipo para TODA la plataforma.
// Antes cada módulo (GastoCheck, CobraCheck) tenía su propia versión
// parcial/duplicada; esta es la única fuente para ver miembros, cambiar
// roles e invitar, sin importar en qué módulo se vaya a trabajar.
import { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  TextInput, Alert, ActivityIndicator, Modal, Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { BRAND } from '@gastocheck/shared';
import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const MANAGER_ROLES = ['owner', 'admin', 'supervisor', 'accountant', 'contador_general'];
const ADMIN_TIER = ['owner', 'admin'];
const CONTADOR_TIER = ['accountant', 'contador_general', 'supervisor'];

const ROLE_META: Record<string, { label: string; icon: string; color: string; desc: string }> = {
  owner:            { label: 'Propietario',       icon: '👑', color: BRAND.navy,   desc: 'Acceso total, no se puede invitar (se crea al registrar la empresa).' },
  admin:            { label: 'Admin',              icon: '👑', color: BRAND.navy,   desc: 'Acceso completo: empresa, equipo, cuentas bancarias y todos los módulos.' },
  contador_general: { label: 'Contador General',   icon: '📊', color: BRAND.purple, desc: 'Contador de toda la empresa: ve y aprueba en todos los módulos.' },
  accountant:       { label: 'Contador de Módulo', icon: '🧮', color: BRAND.purple, desc: 'Clasifica cuentas, valida CFDI, genera pólizas y exporta a CONTPAQi.' },
  spender:          { label: 'Comprador',          icon: '🛒', color: BRAND.green,  desc: 'Captura tickets, genera reembolsos y consulta proveedores.' },
  collector:        { label: 'Cobrador',           icon: '🎯', color: BRAND.cobra,  desc: 'Rutas de cobranza, registra pagos y promesas de clientes.' },
  supervisor:       { label: 'Supervisor',         icon: '📋', color: BRAND.orange ?? '#FB8C00', desc: 'Aprueba anticipos y reembolsos del equipo.' },
};

// Qué roles puede invitar cada nivel — Admin ve todo; Contador (de módulo o
// general) invita a su propio nivel + operativos, nunca a otro Admin.
// Comprador/Cobrador además se filtran por módulo contratado (organization_modules).
function invitableRolesFor(userRole: string | null, hasGastoCheck: boolean, hasCobraCheck: boolean): string[] {
  const roles: string[] = [];
  if (userRole && ADMIN_TIER.includes(userRole)) {
    // Admin puede invitar otros admins y contadores
    roles.push('admin', 'contador_general', 'accountant');
    // Admin puede invitar operativos según módulos activos
    if (hasGastoCheck) roles.push('spender');
    if (hasCobraCheck) roles.push('collector');
  } else if (userRole && CONTADOR_TIER.includes(userRole)) {
    // Contador puede invitar otros contadores y operativos
    roles.push('accountant', 'contador_general');
    if (hasGastoCheck) roles.push('spender');
    if (hasCobraCheck) roles.push('collector');
  }
  return roles;
}

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
  const [hasGastoCheck, setHasGastoCheck] = useState(true);
  const [hasCobraCheck, setHasCobraCheck] = useState(true);

  const [showInvite, setShowInvite] = useState(false);
  const [inviteRole, setInviteRole] = useState<string>('spender');
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePhone, setInvitePhone] = useState('');
  const [inviting, setInviting] = useState(false);

  // Onboarding extra — solo para Cobrador (company_members.address/ine_photo_url/
  // address_proof_url/license_photo_url/vehicle_id/vehicle_assignment_url/commission_rate,
  // por relación empresa-usuario ya que el mismo cobrador puede trabajar para
  // varias empresas con datos distintos en cada una).
  const [inviteAddress,     setInviteAddress]     = useState('');
  const [inviteCommission,  setInviteCommission]  = useState('');
  const [inePhoto,          setInePhoto]          = useState<string | null>(null);
  const [addressProofPhoto, setAddressProofPhoto] = useState<string | null>(null);
  const [licensePhoto,      setLicensePhoto]      = useState<string | null>(null);
  const [hasVehicle,        setHasVehicle]        = useState(false);
  const [vehicles,          setVehicles]          = useState<{ id: string; label: string }[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [vehicleDocPhoto,   setVehicleDocPhoto]   = useState<string | null>(null);

  const invitableRoles = invitableRolesFor(userRole, hasGastoCheck, hasCobraCheck);

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

      const { data: mods } = await supabase
        .from('organization_modules')
        .select('module_id, is_active')
        .eq('company_id', selectedId)
        .in('module_id', ['gastocheck', 'cobracheck']);
      setHasGastoCheck((mods ?? []).some((m: any) => m.module_id === 'gastocheck' && m.is_active));
      setHasCobraCheck((mods ?? []).some((m: any) => m.module_id === 'cobracheck' && m.is_active));

      const { data: veh } = await supabase.from('vehicles')
        .select('id, economic_number, brand, model').eq('company_id', selectedId).eq('status', 'active');
      setVehicles((veh ?? []).map((v: any) => ({
        id: v.id, label: [v.economic_number, v.brand, v.model].filter(Boolean).join(' — ') || 'Vehículo',
      })));

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
    const opts = invitableRoles
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

  async function pickPhoto(setter: (uri: string) => void) {
    Alert.alert('Foto', '¿Cómo quieres agregarla?', [
      {
        text: 'Cámara', onPress: async () => {
          const r = await ImagePicker.launchCameraAsync({ quality: 0.6 });
          if (!r.canceled && r.assets[0]) setter(r.assets[0].uri);
        },
      },
      {
        text: 'Galería', onPress: async () => {
          const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.6 });
          if (!r.canceled && r.assets[0]) setter(r.assets[0].uri);
        },
      },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  }

  async function uploadDoc(uri: string, uid: string, kind: string): Promise<string | null> {
    try {
      const fileName = `cobrador_docs/${uid}/${kind}_${Date.now()}.jpg`;
      const response = await fetch(uri);
      const blob = await response.blob();
      const { data, error } = await supabase.storage.from('documents').upload(fileName, blob, { upsert: true });
      if (error) return null;
      return data?.path ?? null;
    } catch {
      return null;
    }
  }

  function resetInviteOnboarding() {
    setInviteAddress('');
    setInviteCommission('');
    setInePhoto(null);
    setAddressProofPhoto(null);
    setLicensePhoto(null);
    setHasVehicle(false);
    setSelectedVehicleId(null);
    setVehicleDocPhoto(null);
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

      // Onboarding extra del Cobrador — se guarda en su relación con ESTA
      // empresa (company_members), no en su perfil global.
      if (inviteRole === 'collector' && data?.user_id) {
        const [inePath, addrPath, licPath, vehDocPath] = await Promise.all([
          inePhoto ? uploadDoc(inePhoto, data.user_id, 'ine') : Promise.resolve(null),
          addressProofPhoto ? uploadDoc(addressProofPhoto, data.user_id, 'domicilio') : Promise.resolve(null),
          licensePhoto ? uploadDoc(licensePhoto, data.user_id, 'licencia') : Promise.resolve(null),
          hasVehicle && vehicleDocPhoto ? uploadDoc(vehicleDocPhoto, data.user_id, 'vehiculo') : Promise.resolve(null),
        ]);
        await supabase.from('company_members').update({
          address:                inviteAddress.trim() || null,
          ine_photo_url:          inePath,
          address_proof_url:      addrPath,
          license_photo_url:      licPath,
          vehicle_id:             hasVehicle ? selectedVehicleId : null,
          vehicle_assignment_url: hasVehicle ? vehDocPath : null,
          commission_rate:        inviteCommission ? parseFloat(inviteCommission) : null,
        }).eq('user_id', data.user_id).eq('company_id', companyId);
      }

      setShowInvite(false);
      const name = inviteName.trim();
      const phone = invitePhone.trim();
      const roleLabel = ROLE_META[inviteRole]?.label ?? inviteRole;
      const tempPassword: string | undefined = data?.temp_password;
      setInviteName('');
      setInviteEmail('');
      setInvitePhone('');
      resetInviteOnboarding();
      load();

      if (phone) {
        sendWhatsappInvite(phone, name, roleLabel, inviteEmail.trim(), tempPassword);
      } else {
        const tempMsg = tempPassword ? `\n\nContraseña temporal: ${tempPassword}` : '';
        Alert.alert('✓ Invitado', `${name} ya tiene acceso como ${roleLabel}.${tempMsg}`);
      }
    } finally {
      setInviting(false);
    }
  }

  function sendWhatsappInvite(phone: string, name: string, roleLabel: string, email: string, tempPassword?: string) {
    const digits = phone.replace(/\D/g, '');
    const passLine = tempPassword ? `\nContraseña temporal: ${tempPassword}` : '';
    const message =
      `Hola ${name}, ya tienes acceso a CHECK SUITE${companyName ? ` (${companyName})` : ''} ` +
      `como ${roleLabel}.\n\nCorreo: ${email}${passLine}\n\nDescarga la app y entra con esos datos.`;
    const url = `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('✓ Invitado', `${name} ya tiene acceso como ${roleLabel}. No se pudo abrir WhatsApp.`);
    });
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

        {invitableRoles.length > 0 && (
          <TouchableOpacity style={styles.inviteBtn} onPress={() => { setInviteRole(invitableRoles[0]); setShowInvite(true); }}>
            <Text style={styles.inviteBtnText}>+ Invitar al equipo</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Modal invitar */}
      <Modal visible={showInvite} animationType="slide" transparent onRequestClose={() => setShowInvite(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Invitar al equipo</Text>

            <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ paddingBottom: 8 }} showsVerticalScrollIndicator={false}>
              <Text style={styles.fieldLabel}>Nombre completo</Text>
              <TextInput style={styles.input} value={inviteName} onChangeText={setInviteName} placeholder="Nombre y apellido" placeholderTextColor="#B0BEC5" />

              <Text style={styles.fieldLabel}>Correo</Text>
              <TextInput style={styles.input} value={inviteEmail} onChangeText={setInviteEmail} placeholder="correo@empresa.com"
                placeholderTextColor="#B0BEC5" autoCapitalize="none" keyboardType="email-address" />

              <Text style={styles.fieldLabel}>WhatsApp (opcional)</Text>
              <TextInput style={styles.input} value={invitePhone} onChangeText={setInvitePhone} placeholder="521 55 1234 5678"
                placeholderTextColor="#B0BEC5" keyboardType="phone-pad" />
              <Text style={styles.fieldSubHint}>Si lo llenas, al invitar se abre WhatsApp con el mensaje de acceso listo para enviar.</Text>

              <Text style={styles.fieldLabel}>Rol</Text>
              <View style={{ gap: 8, marginBottom: 8 }}>
                {invitableRoles.map((r) => {
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

              {inviteRole === 'collector' && (
                <View style={styles.onboardingBox}>
                  <Text style={styles.onboardingTitle}>Datos del Cobrador</Text>
                  <Text style={styles.fieldSubHint}>Se guardan solo para esta empresa — el mismo cobrador puede trabajar para otras con datos distintos.</Text>

                  <Text style={styles.fieldLabel}>Domicilio</Text>
                  <TextInput style={styles.input} value={inviteAddress} onChangeText={setInviteAddress}
                    placeholder="Calle, número, colonia, ciudad" placeholderTextColor="#B0BEC5" />

                  <Text style={styles.fieldLabel}>Comisión (%)</Text>
                  <TextInput style={styles.input} value={inviteCommission} onChangeText={setInviteCommission}
                    placeholder="Ej: 3" placeholderTextColor="#B0BEC5" keyboardType="decimal-pad" />

                  <DocRow label="Foto de INE" uri={inePhoto} onPick={() => pickPhoto(setInePhoto)} />
                  <DocRow label="Comprobante de domicilio" uri={addressProofPhoto} onPick={() => pickPhoto(setAddressProofPhoto)} />
                  <DocRow label="Licencia de conducir" uri={licensePhoto} onPick={() => pickPhoto(setLicensePhoto)} />

                  <TouchableOpacity style={styles.vehicleToggle} onPress={() => setHasVehicle(v => !v)}>
                    <Text style={{ fontSize: 16 }}>{hasVehicle ? '☑' : '☐'}</Text>
                    <Text style={styles.vehicleToggleText}>¿Se le asigna vehículo para cobranza?</Text>
                  </TouchableOpacity>

                  {hasVehicle && (
                    <>
                      <Text style={styles.fieldLabel}>Vehículo (Flotilla)</Text>
                      {vehicles.length === 0 ? (
                        <Text style={styles.fieldSubHint}>Sin vehículos dados de alta en Flotilla.</Text>
                      ) : (
                        <View style={{ gap: 6, marginBottom: 4 }}>
                          {vehicles.map(v => (
                            <TouchableOpacity key={v.id}
                              style={[styles.vehicleOption, selectedVehicleId === v.id && styles.vehicleOptionActive]}
                              onPress={() => setSelectedVehicleId(v.id)}>
                              <Text style={[styles.vehicleOptionText, selectedVehicleId === v.id && { color: BRAND.cobra }]}>{v.label}</Text>
                              {selectedVehicleId === v.id && <Text style={{ color: BRAND.cobra }}>✓</Text>}
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}
                      <DocRow label="Documento de asignación" uri={vehicleDocPhoto} onPick={() => pickPhoto(setVehicleDocPhoto)} />
                    </>
                  )}
                </View>
              )}
            </ScrollView>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
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

function DocRow({ label, uri, onPick }: { label: string; uri: string | null; onPick: () => void }) {
  return (
    <TouchableOpacity style={docRowStyles.row} onPress={onPick}>
      <Text style={{ fontSize: 16 }}>{uri ? '✅' : '📷'}</Text>
      <View style={{ flex: 1, marginLeft: 10 }}>
        <Text style={docRowStyles.label}>{label}</Text>
        <Text style={docRowStyles.status}>{uri ? 'Foto agregada — toca para cambiar' : 'Toca para agregar foto'}</Text>
      </View>
    </TouchableOpacity>
  );
}

const docRowStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8F9FA', borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#E0E0E0' },
  label: { fontSize: 13, fontWeight: '600', color: BRAND.navy },
  status: { fontSize: 11, color: '#90A4AE', marginTop: 1 },
});

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
  fieldSubHint: { fontSize: 11, color: '#B0BEC5', marginTop: -2, marginBottom: 4, lineHeight: 15 },
  input: { backgroundColor: '#fff', borderRadius: 12, padding: 13, borderWidth: 1, borderColor: '#E0E0E0', fontSize: 15, color: BRAND.navy },

  roleOption: {
    flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12,
    borderWidth: 1.5, borderColor: '#E0E0E0', backgroundColor: '#fff',
  },
  roleOptionTitle: { fontSize: 14, fontWeight: '700', color: BRAND.navy },
  roleOptionDesc: { fontSize: 11, color: '#90A4AE', marginTop: 1 },

  onboardingBox: { marginTop: 16, padding: 12, backgroundColor: '#FBFBFD', borderRadius: 12, borderWidth: 1, borderColor: '#E8EAF6' },
  onboardingTitle: { fontSize: 13, fontWeight: '800', color: BRAND.navy, marginBottom: 4 },
  vehicleToggle: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, marginBottom: 4 },
  vehicleToggleText: { fontSize: 13, fontWeight: '600', color: BRAND.navy },
  vehicleOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', borderRadius: 10, padding: 11, borderWidth: 1.5, borderColor: '#E0E0E0' },
  vehicleOptionActive: { borderColor: BRAND.cobra, backgroundColor: BRAND.cobra + '10' },
  vehicleOptionText: { fontSize: 13, fontWeight: '600', color: BRAND.navy },

  modalCancelBtn: { borderRadius: 12, paddingVertical: 13, backgroundColor: '#F5F5F5', alignItems: 'center' },
  modalCancelText: { fontSize: 15, fontWeight: '600', color: '#90A4AE' },
  modalSaveBtn: { borderRadius: 12, paddingVertical: 13, backgroundColor: BRAND.blue, alignItems: 'center' },
  modalSaveText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
