// Pantalla de Administración — solo para owner y admin
import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  TextInput, Alert, ActivityIndicator, Switch,
  Share,
} from 'react-native';
import { useRouter } from 'expo-router';
import { BRAND } from '@gastocheck/shared';
import { supabase } from '../lib/supabase';

const SECTOR_OPTIONS = [
  { key: 'agro',              label: '🌾 Agrícola' },
  { key: 'construccion',      label: '🏗️ Construcción' },
  { key: 'transportistas',    label: '🚛 Transporte' },
  { key: 'alimentos',         label: '🍽️ Alimentos' },
  { key: 'distribucion',      label: '📦 Distribución' },
  { key: 'manufactura',       label: '🏭 Manufactura' },
  { key: 'servicios_tecnicos', label: '🔧 Servicios Técnicos' },
  { key: 'comercio',          label: '🛒 Comercio' },
  { key: 'otro',              label: '💼 Otro' },
];

const PLAN_LABELS: Record<string, string> = {
  basico:      'Básico (2 usuarios)',
  profesional: 'Profesional (10 usuarios)',
  empresarial: 'Empresarial (sin límite)',
};

interface CompanyData {
  id:               string;
  name:             string;
  rfc:              string | null;
  nombre_comercial: string | null;
  direccion:        string | null;
  ciudad:           string | null;
  cp:               string | null;
  telefono:         string | null;
  sector:           string | null;
  tiene_flotilla:   boolean;
  moneda:           string;
  plan:             string;
  plan_seats:       number;
}

export default function AdministracionScreen() {
  const router = useRouter();
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [company,   setCompany]   = useState<CompanyData | null>(null);
  const [memberCount, setMemberCount] = useState(0);

  // Campos editables
  const [fName,            setFName]            = useState('');
  const [fRfc,             setFRfc]             = useState('');
  const [fNombreComercial, setFNombreComercial] = useState('');
  const [fDireccion,       setFDireccion]       = useState('');
  const [fCiudad,          setFCiudad]          = useState('');
  const [fCp,              setFCp]              = useState('');
  const [fTelefono,        setFTelefono]        = useState('');
  const [fSector,          setFSector]          = useState<string | null>(null);
  const [fFlotilla,        setFFlotilla]        = useState(false);
  const [fMoneda,          setFMoneda]          = useState<'MXN' | 'USD'>('MXN');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: member } = await supabase
        .from('company_members')
        .select('company_id, role')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle();
      if (!member) return;

      const { data: co } = await supabase
        .from('companies')
        .select('id, name, rfc, nombre_comercial, direccion, ciudad, cp, telefono, sector, tiene_flotilla, moneda, plan, plan_seats')
        .eq('id', member.company_id)
        .maybeSingle();
      if (!co) return;

      setCompany(co as CompanyData);
      setFName(co.name ?? '');
      setFRfc(co.rfc ?? '');
      setFNombreComercial(co.nombre_comercial ?? '');
      setFDireccion(co.direccion ?? '');
      setFCiudad(co.ciudad ?? '');
      setFCp(co.cp ?? '');
      setFTelefono(co.telefono ?? '');
      setFSector(co.sector ?? null);
      setFFlotilla(co.tiene_flotilla ?? false);
      setFMoneda((co.moneda ?? 'MXN') as 'MXN' | 'USD');

      // Contar miembros activos
      const { count } = await supabase
        .from('company_members')
        .select('id', { count: 'exact' })
        .eq('company_id', member.company_id)
        .eq('status', 'active');
      setMemberCount(count ?? 0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSave() {
    if (!company) return;
    if (!fName.trim()) { Alert.alert('Requerido', 'El nombre de la empresa es obligatorio.'); return; }
    setSaving(true);
    try {
      const { error } = await supabase
        .from('companies')
        .update({
          name:             fName.trim(),
          rfc:              fRfc.trim().toUpperCase() || null,
          nombre_comercial: fNombreComercial.trim() || null,
          direccion:        fDireccion.trim() || null,
          ciudad:           fCiudad.trim() || null,
          cp:               fCp.trim() || null,
          telefono:         fTelefono.trim() || null,
          sector:           fSector,
          tiene_flotilla:   fFlotilla,
          moneda:           fMoneda,
        })
        .eq('id', company.id);
      if (error) throw error;
      Alert.alert('✓ Guardado', 'Datos de la empresa actualizados.');
      load();
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  }

  function inviteCode() {
    if (!company) return '--------';
    return company.id.replace(/-/g, '').substring(0, 8).toUpperCase();
  }

  async function shareInvite(role: 'admin' | 'supervisor' | 'comprador') {
    if (!company) return;
    const code = inviteCode();

    const ROLE_INFO: Record<string, { label: string; accesos: string }> = {
      admin: {
        label:   'Administrador',
        accesos: 'Invita usuarios, asigna roles, accede a Alta Empresa y ve toda la operación de la empresa.',
      },
      supervisor: {
        label:   'Supervisor',
        accesos: 'Genera pólizas, autoriza gastos, reportes de operación y análisis de todos los compradores.',
      },
      comprador: {
        label:   'Comprador',
        accesos: 'Captura tickets, genera sus pólizas, consulta sus comprobantes y reembolsos, y ve los proveedores de la empresa.',
      },
    };

    const { label, accesos } = ROLE_INFO[role];
    const msg =
      `Hola! Te invito a unirte a *${company.name}* en GastoCheck como *${label}*.\n\n` +
      `📋 *Tus accesos como ${label}:*\n${accesos}\n\n` +
      `*Para unirte:*\n` +
      `1️⃣ Descarga la app GastoCheck en tu teléfono\n` +
      `2️⃣ Regístrate con tu nombre y correo\n` +
      `3️⃣ Ingresa el código de empresa: *${code}*\n` +
      `4️⃣ Selecciona el rol: *${label}*\n\n` +
      `¡Listo! Quedarás vinculado a nuestra empresa. 🙌`;
    try {
      await Share.share({ message: msg });
    } catch { /* cancelado */ }
  }

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BRAND.gray }}>
        <ActivityIndicator size="large" color={BRAND.blue} />
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: BRAND.gray }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>

      {/* ── Plan e integrantes ── */}
      <View style={styles.planCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.planLabel}>Plan</Text>
          <Text style={styles.planValue}>{PLAN_LABELS[company?.plan ?? ''] ?? company?.plan}</Text>
        </View>
        <View style={styles.planDivider} />
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.planLabel}>Usuarios activos</Text>
          <Text style={[styles.planValue, memberCount >= (company?.plan_seats ?? 2) && { color: BRAND.red }]}>
            {memberCount} / {company?.plan_seats ?? 2}
          </Text>
          {memberCount >= (company?.plan_seats ?? 2) && (
            <Text style={styles.planWarning}>Límite alcanzado — cambia de plan</Text>
          )}
        </View>
      </View>

      {/* ── Datos Fiscales ── */}
      <SectionHeader title="Datos Fiscales" />

      <Field label="Nombre de la empresa *" value={fName} onChange={setFName} placeholder="Mi Empresa S.A. de C.V." />
      <Field label="RFC" value={fRfc} onChange={setFRfc} placeholder="ABC123456XY0" autoCapitalize="characters" />
      <Field label="Nombre comercial" value={fNombreComercial} onChange={setFNombreComercial} placeholder="Mi Empresa" />
      <Field label="Dirección" value={fDireccion} onChange={setFDireccion} placeholder="Calle 123, Col. Centro" />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 2 }}>
          <Field label="Ciudad" value={fCiudad} onChange={setFCiudad} placeholder="Monterrey, NL" />
        </View>
        <View style={{ flex: 1 }}>
          <Field label="CP" value={fCp} onChange={setFCp} placeholder="64000" keyboardType="number-pad" />
        </View>
      </View>
      <Field label="Teléfono" value={fTelefono} onChange={setFTelefono} placeholder="+52 81 1234 5678" keyboardType="phone-pad" />

      <TouchableOpacity
        style={[styles.saveBtn, saving && { opacity: 0.6 }]}
        onPress={handleSave}
        disabled={saving}
      >
        {saving
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.saveBtnText}>Guardar datos fiscales</Text>}
      </TouchableOpacity>

      {/* ── Compradores ── */}
      <SectionHeader title="Compradores" />
      <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/gastadores' as any)}>
        <View style={{ flex: 1 }}>
          <Text style={styles.actionCardTitle}>👤 Mis Compradores</Text>
          <Text style={styles.actionCardHint}>Gestionar usuarios activos e inactivos</Text>
        </View>
        <Text style={styles.arrow}>›</Text>
      </TouchableOpacity>

      <View style={styles.inviteCard}>
        <Text style={styles.inviteTitle}>📲 Invitar por WhatsApp</Text>
        <Text style={styles.inviteHint}>
          Elige el rol antes de compartir — el mensaje explicará claramente los accesos que tendrá.
        </Text>
        <View style={styles.codeBox}>
          <Text style={styles.codeLabel}>Código de empresa</Text>
          <Text style={styles.codeValue}>{inviteCode()}</Text>
        </View>

        {/* Rol: Administrador */}
        <View style={[styles.roleCard, { borderLeftColor: BRAND.navy }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.roleCardTitle}>🏢 Administrador</Text>
            <Text style={styles.roleCardDesc}>
              Invita usuarios, asigna roles y accede a Alta Empresa. Tiene visibilidad total de la empresa.
            </Text>
          </View>
          <TouchableOpacity style={[styles.roleInviteBtn, { backgroundColor: BRAND.navy }]} onPress={() => shareInvite('admin')}>
            <Text style={styles.roleInviteBtnText}>Invitar</Text>
          </TouchableOpacity>
        </View>

        {/* Rol: Supervisor */}
        <View style={[styles.roleCard, { borderLeftColor: BRAND.blue }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.roleCardTitle}>📋 Supervisor</Text>
            <Text style={styles.roleCardDesc}>
              Genera pólizas, autoriza gastos, reportes de operación y análisis de todos los compradores.
            </Text>
          </View>
          <TouchableOpacity style={[styles.roleInviteBtn, { backgroundColor: BRAND.blue }]} onPress={() => shareInvite('supervisor')}>
            <Text style={styles.roleInviteBtnText}>Invitar</Text>
          </TouchableOpacity>
        </View>

        {/* Rol: Comprador */}
        <View style={[styles.roleCard, { borderLeftColor: BRAND.green }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.roleCardTitle}>🛒 Comprador</Text>
            <Text style={styles.roleCardDesc}>
              Captura tickets, sus pólizas y comprobantes propios, reembolsos y proveedores de la empresa.
            </Text>
          </View>
          <TouchableOpacity style={[styles.roleInviteBtn, { backgroundColor: BRAND.green }]} onPress={() => shareInvite('comprador')}>
            <Text style={styles.roleInviteBtnText}>Invitar</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Definir Perfil ── */}
      <SectionHeader title="Perfil de la Empresa" />

      <Text style={styles.fieldLabel}>Sector</Text>
      <View style={styles.sectorGrid}>
        {SECTOR_OPTIONS.map((s) => (
          <TouchableOpacity
            key={s.key}
            style={[styles.sectorChip, fSector === s.key && styles.sectorChipActive]}
            onPress={() => setFSector(fSector === s.key ? null : s.key)}
          >
            <Text style={[styles.sectorChipText, fSector === s.key && { color: '#fff' }]}>{s.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.toggleRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.toggleLabel}>¿Maneja flotilla vehicular?</Text>
          <Text style={styles.toggleHint}>Activa el módulo de vehículos y operadores</Text>
        </View>
        <Switch
          value={fFlotilla}
          onValueChange={setFFlotilla}
          trackColor={{ false: '#E0E0E0', true: BRAND.green + '80' }}
          thumbColor={fFlotilla ? BRAND.green : '#fff'}
        />
      </View>

      <Text style={styles.fieldLabel}>Moneda principal</Text>
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
        {(['MXN', 'USD'] as const).map((m) => (
          <TouchableOpacity
            key={m}
            style={[styles.monedaChip, fMoneda === m && styles.monedaChipActive]}
            onPress={() => setFMoneda(m)}
          >
            <Text style={[styles.monedaChipText, fMoneda === m && { color: '#fff' }]}>
              {m === 'MXN' ? '🇲🇽 Peso MXN' : '🇺🇸 Dólar USD'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.saveBtn, saving && { opacity: 0.6 }]}
        onPress={handleSave}
        disabled={saving}
      >
        {saving
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.saveBtnText}>Guardar perfil</Text>}
      </TouchableOpacity>

    </ScrollView>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

function Field({
  label, value, onChange, placeholder, autoCapitalize, keyboardType,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  keyboardType?: 'default' | 'number-pad' | 'phone-pad' | 'email-address';
}) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#B0BEC5"
        autoCapitalize={autoCapitalize ?? 'sentences'}
        keyboardType={keyboardType ?? 'default'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  planCard: {
    backgroundColor: BRAND.navy, borderRadius: 16, padding: 18,
    flexDirection: 'row', alignItems: 'center', marginBottom: 16,
  },
  planLabel:   { color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: '600', textTransform: 'uppercase' },
  planValue:   { color: '#fff', fontSize: 18, fontWeight: '800', marginTop: 4 },
  planDivider: { width: 1, height: 40, backgroundColor: 'rgba(255,255,255,0.2)', marginHorizontal: 16 },
  planWarning: { color: BRAND.red, fontSize: 10, fontWeight: '600', marginTop: 4 },

  sectionHeader: { marginTop: 20, marginBottom: 10 },
  sectionTitle:  { fontSize: 13, fontWeight: '800', color: BRAND.blue, textTransform: 'uppercase', letterSpacing: 0.5 },

  fieldLabel: { fontSize: 11, fontWeight: '700', color: '#90A4AE', textTransform: 'uppercase', marginBottom: 6, marginTop: 2 },
  input: {
    backgroundColor: '#fff', borderRadius: 12, padding: 13,
    borderWidth: 1, borderColor: '#E0E0E0', fontSize: 15, color: BRAND.navy,
  },

  saveBtn: {
    backgroundColor: BRAND.blue, borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', marginTop: 4, marginBottom: 8,
  },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  actionCard: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16,
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: '#E0E0E0', marginBottom: 10,
  },
  actionCardTitle: { fontSize: 15, fontWeight: '700', color: BRAND.navy },
  actionCardHint:  { fontSize: 12, color: '#90A4AE', marginTop: 2 },
  arrow:           { fontSize: 22, color: '#B0BEC5' },

  inviteCard: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: '#E0E0E0', marginBottom: 10,
  },
  inviteTitle: { fontSize: 15, fontWeight: '700', color: BRAND.navy, marginBottom: 6 },
  inviteHint:  { fontSize: 13, color: '#90A4AE', lineHeight: 18, marginBottom: 12 },
  codeBox: {
    backgroundColor: BRAND.gray, borderRadius: 12, padding: 14,
    alignItems: 'center', borderWidth: 1, borderColor: '#E0E0E0',
  },
  codeLabel: { fontSize: 11, fontWeight: '600', color: '#90A4AE', textTransform: 'uppercase' },
  codeValue: { fontSize: 28, fontWeight: '800', color: BRAND.navy, letterSpacing: 4, marginTop: 4 },
  roleCard: {
    backgroundColor: '#FAFAFA', borderRadius: 12, padding: 14, marginTop: 10,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderLeftWidth: 4, borderWidth: 1, borderColor: '#E0E0E0',
  },
  roleCardTitle: { fontSize: 14, fontWeight: '800', color: BRAND.navy, marginBottom: 4 },
  roleCardDesc:  { fontSize: 12, color: '#607D8B', lineHeight: 16 },
  roleInviteBtn: { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, minWidth: 70, alignItems: 'center' },
  roleInviteBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },

  sectorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  sectorChip: {
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#E0E0E0',
  },
  sectorChipActive: { backgroundColor: BRAND.blue, borderColor: BRAND.blue },
  sectorChipText:   { fontSize: 13, fontWeight: '600', color: BRAND.navy },

  toggleRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderRadius: 14, padding: 16, marginBottom: 16,
    borderWidth: 1, borderColor: '#E0E0E0',
  },
  toggleLabel: { fontSize: 15, fontWeight: '700', color: BRAND.navy },
  toggleHint:  { fontSize: 12, color: '#90A4AE', marginTop: 2 },

  monedaChip: {
    flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center',
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#E0E0E0',
  },
  monedaChipActive: { backgroundColor: BRAND.navy, borderColor: BRAND.navy },
  monedaChipText:   { fontSize: 14, fontWeight: '700', color: BRAND.navy },
});
