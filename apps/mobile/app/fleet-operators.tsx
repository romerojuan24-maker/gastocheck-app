// Pantalla de gestión de operadores — vertical Flotillas
import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList,
  ActivityIndicator, Modal, TextInput, ScrollView, Alert,
} from 'react-native';
import {
  BRAND, OPERATOR_STATUS_META, VEHICLE_TYPE_ICONS, vehicleDisplayName,
} from '@gastocheck/shared';
import type { FleetOperator, FleetVehicle, OperatorStatus } from '@gastocheck/shared';
import { supabase } from '../lib/supabase';
import { getActiveMembership } from '../lib/membership';

const money = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);

const STATUS_FILTERS: { key: OperatorStatus | 'all'; label: string }[] = [
  { key: 'all',       label: 'Todos' },
  { key: 'active',    label: 'Activos' },
  { key: 'inactive',  label: 'Inactivos' },
  { key: 'suspended', label: 'Suspendidos' },
];

interface OperatorWithCost extends FleetOperator {
  month_cost?: number;
  receipt_count?: number;
  vehicle?: FleetVehicle | null;
}

export default function FleetOperatorsScreen() {
  const [operators,   setOperators]   = useState<OperatorWithCost[]>([]);
  const [vehicles,    setVehicles]    = useState<FleetVehicle[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [filter,      setFilter]      = useState<OperatorStatus | 'all'>('all');
  const [companyId,   setCompanyId]   = useState<string | null>(null);
  const [showModal,   setShowModal]   = useState(false);
  const [editOp,      setEditOp]      = useState<FleetOperator | null>(null);
  const [saving,      setSaving]      = useState(false);

  // Form
  const [fName,     setFName]     = useState('');
  const [fPhone,    setFPhone]    = useState('');
  const [fLicense,  setFLicense]  = useState('');
  const [fStatus,   setFStatus]   = useState<OperatorStatus>('active');
  const [fVehicle,  setFVehicle]  = useState<string | null>(null);
  const [fNotes,    setFNotes]    = useState('');

  // ── Cargar operadores ─────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const member = await getActiveMembership(user.id);
      if (!member) return;
      setCompanyId(member.company_id);

      // Vehículos disponibles
      const { data: vList } = await supabase
        .from('vehicles').select('*').eq('company_id', member.company_id).order('economic_number');
      setVehicles((vList ?? []) as FleetVehicle[]);

      // Listar operadores asignados a esta empresa (desde operator_companies)
      const { data: opData } = await supabase
        .from('operator_companies')
        .select(`
          operator:operators(*)
        `)
        .eq('company_id', member.company_id);

      let opList = (opData ?? []).map((item: any) => item.operator).filter(Boolean) as typeof opList;
      if (filter !== 'all') {
        opList = opList.filter((op: any) => op.status === filter);
      }
      opList = opList.sort((a: any, b: any) => (a.name ?? '').localeCompare(b.name ?? ''));

      // Costo del mes por operador
      const now   = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      const vehicleMap = new Map((vList ?? []).map((v: FleetVehicle) => [v.id, v]));
      const enriched: OperatorWithCost[] = [];

      for (const op of opList ?? []) {
        const { count, data: recs } = await supabase
          .from('receipts')
          .select('total_amount', { count: 'exact' })
          .eq('operator_id', op.id)
          .gte('receipt_date', start)
          .not('status', 'in', '(cancelled,rejected)');

        const month_cost = (recs ?? []).reduce((s: number, r: any) => s + (r.total_amount ?? 0), 0);
        enriched.push({
          ...op,
          month_cost,
          receipt_count: count ?? 0,
          vehicle: op.assigned_vehicle_id ? vehicleMap.get(op.assigned_vehicle_id) ?? null : null,
        });
      }
      setOperators(enriched);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  // ── Modal ─────────────────────────────────────────────────────────────────

  function openCreate() {
    setEditOp(null);
    setFName(''); setFPhone(''); setFLicense('');
    setFStatus('active'); setFVehicle(null); setFNotes('');
    setShowModal(true);
  }

  function openEdit(op: FleetOperator) {
    setEditOp(op);
    setFName(op.name);
    setFPhone(op.phone ?? '');
    setFLicense(op.license_number ?? '');
    setFStatus(op.status);
    setFVehicle(op.assigned_vehicle_id);
    setFNotes(op.notes ?? '');
    setShowModal(true);
  }

  async function save() {
    if (!companyId || !fName.trim()) return;
    setSaving(true);

    try {
      const payload = {
        company_id:          companyId,
        name:                fName.trim(),
        phone:               fPhone.trim() || null,
        license_number:      fLicense.trim() || null,
        status:              fStatus,
        assigned_vehicle_id: fVehicle || null,
        notes:               fNotes.trim() || null,
      };

      let operatorId = editOp?.id;

      if (editOp) {
        // Actualizar operador existente
        const { error } = await supabase.from('operators').update(payload).eq('id', editOp.id);
        if (error) throw error;
      } else {
        // Crear operador nuevo
        const { data, error } = await supabase.from('operators').insert(payload).select('id').single();
        if (error) throw error;
        operatorId = data?.id;

        // Agregar a operator_companies para esta empresa
        if (operatorId && companyId) {
          await supabase.from('operator_companies').insert({ operator_id: operatorId, company_id: companyId });
        }
      }

      setShowModal(false);
      load();
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete(op: FleetOperator) {
    Alert.alert('Eliminar operador', `¿Eliminar a "${op.name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive',
        onPress: async () => {
          await supabase.from('operators').delete().eq('id', op.id);
          load();
        },
      },
    ]);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={{ flex: 1, backgroundColor: BRAND.gray }}>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filtersRow}>
        {STATUS_FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.chip, filter === f.key && { backgroundColor: BRAND.blue }]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[styles.chipText, filter === f.key && { color: '#fff' }]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <TouchableOpacity style={styles.addBtn} onPress={openCreate}>
        <Text style={styles.addBtnText}>+ Agregar operador</Text>
      </TouchableOpacity>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={BRAND.blue} /></View>
      ) : operators.length === 0 ? (
        <View style={styles.center}>
          <Text style={{ fontSize: 48 }}>🧑‍✈️</Text>
          <Text style={styles.emptyText}>Sin operadores registrados</Text>
        </View>
      ) : (
        <FlatList
          data={operators}
          keyExtractor={(o) => o.id}
          contentContainerStyle={{ padding: 12, paddingBottom: 32 }}
          refreshing={loading}
          onRefresh={load}
          renderItem={({ item: op }) => {
            const meta = OPERATOR_STATUS_META[op.status];
            return (
              <TouchableOpacity style={styles.card} onLongPress={() => openEdit(op)}>
                <View style={styles.cardHeader}>
                  <View style={[styles.avatar, { backgroundColor: meta.color + '18' }]}>
                    <Text style={{ fontSize: 22 }}>🧑‍✈️</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.opName}>{op.name}</Text>
                    {op.phone && <Text style={styles.opSub}>📞 {op.phone}</Text>}
                    {op.license_number && <Text style={styles.opSub}>🪪 {op.license_number}</Text>}
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: meta.color + '18' }]}>
                    <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
                  </View>
                </View>

                {op.vehicle && (
                  <View style={styles.vehicleTag}>
                    <Text style={styles.vehicleTagText}>
                      {VEHICLE_TYPE_ICONS[op.vehicle.vehicle_type]} {vehicleDisplayName(op.vehicle)}
                    </Text>
                  </View>
                )}

                <View style={styles.cardFooter}>
                  <View style={styles.kpi}>
                    <Text style={styles.kpiValue}>{money(op.month_cost ?? 0)}</Text>
                    <Text style={styles.kpiLabel}>Gasto este mes</Text>
                  </View>
                  <View style={styles.kpi}>
                    <Text style={styles.kpiValue}>{op.receipt_count ?? 0}</Text>
                    <Text style={styles.kpiLabel}>Comprobantes</Text>
                  </View>
                  <TouchableOpacity onPress={() => confirmDelete(op)} style={{ padding: 6 }}>
                    <Text style={{ fontSize: 20 }}>🗑</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* Modal */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet"
        onRequestClose={() => setShowModal(false)}>
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowModal(false)}>
              <Text style={styles.modalCancel}>Cancelar</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{editOp ? 'Editar operador' : 'Nuevo operador'}</Text>
            <TouchableOpacity onPress={save} disabled={saving || !fName.trim()}>
              <Text style={[styles.modalSave, (!fName.trim() || saving) && { opacity: 0.4 }]}>
                {saving ? '...' : 'Guardar'}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.modalBody}>
            <FL label="Nombre completo *" value={fName} onChange={setFName} placeholder="Juan García López" />
            <FL label="Teléfono" value={fPhone} onChange={setFPhone} placeholder="6441234567" numeric />
            <FL label="Número de licencia" value={fLicense} onChange={setFLicense} placeholder="GAJL890101HMCRPC09" caps />

            {/* Estado */}
            <Text style={styles.label}>Estado</Text>
            <View style={styles.statusRow}>
              {(['active', 'inactive', 'suspended'] as OperatorStatus[]).map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[
                    styles.statusChip,
                    { borderColor: OPERATOR_STATUS_META[s].color },
                    fStatus === s && { backgroundColor: OPERATOR_STATUS_META[s].color },
                  ]}
                  onPress={() => setFStatus(s)}
                >
                  <Text style={[
                    { fontSize: 12, fontWeight: '700' },
                    fStatus === s ? { color: '#fff' } : { color: OPERATOR_STATUS_META[s].color },
                  ]}>
                    {OPERATOR_STATUS_META[s].label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Vehículo asignado */}
            <Text style={styles.label}>Vehículo asignado (opcional)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              style={{ marginBottom: 12 }} contentContainerStyle={{ gap: 8 }}>
              <TouchableOpacity
                style={[styles.vehicleChip, !fVehicle && { backgroundColor: BRAND.blue }]}
                onPress={() => setFVehicle(null)}
              >
                <Text style={[styles.vehicleChipText, !fVehicle && { color: '#fff' }]}>
                  Sin asignar
                </Text>
              </TouchableOpacity>
              {vehicles.map((v) => (
                <TouchableOpacity
                  key={v.id}
                  style={[styles.vehicleChip, fVehicle === v.id && { backgroundColor: BRAND.blue }]}
                  onPress={() => setFVehicle(v.id)}
                >
                  <Text style={[styles.vehicleChipText, fVehicle === v.id && { color: '#fff' }]}>
                    {VEHICLE_TYPE_ICONS[v.vehicle_type]} {v.economic_number ?? v.plates ?? 'Veh.'}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <FL label="Notas" value={fNotes} onChange={setFNotes} placeholder="Observaciones..." multiline />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

function FL({ label, value, onChange, placeholder, numeric, caps, multiline }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; numeric?: boolean; caps?: boolean; multiline?: boolean;
}) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && { height: 72 }]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#B0BEC5"
        keyboardType={numeric ? 'phone-pad' : 'default'}
        autoCapitalize={caps ? 'characters' : 'words'}
        multiline={multiline}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  filtersRow:   { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  chip:         { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E0E0E0' },
  chipText:     { fontSize: 13, color: BRAND.navy, fontWeight: '600' },
  addBtn:       { marginHorizontal: 12, marginBottom: 8, backgroundColor: BRAND.blue, borderRadius: 12, padding: 14, alignItems: 'center' },
  addBtnText:   { color: '#fff', fontSize: 15, fontWeight: '700' },
  center:       { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8, padding: 32 },
  emptyText:    { fontSize: 15, color: '#90A4AE' },
  card:         { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#F0F0F0' },
  cardHeader:   { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
  avatar:       { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  opName:       { fontSize: 15, fontWeight: '700', color: BRAND.navy },
  opSub:        { fontSize: 12, color: '#90A4AE', marginTop: 1 },
  statusBadge:  { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4, alignSelf: 'flex-start' },
  statusText:   { fontSize: 11, fontWeight: '700' },
  vehicleTag:   { backgroundColor: BRAND.gray, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, alignSelf: 'flex-start', marginBottom: 8 },
  vehicleTagText: { fontSize: 12, color: BRAND.navy, fontWeight: '600' },
  cardFooter:   { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#F5F5F5', paddingTop: 10, alignItems: 'center' },
  kpi:          { flex: 1 },
  kpiValue:     { fontSize: 15, fontWeight: '800', color: BRAND.navy },
  kpiLabel:     { fontSize: 11, color: '#90A4AE', marginTop: 1 },
  modal:        { flex: 1, backgroundColor: BRAND.gray },
  modalHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E0E0E0' },
  modalTitle:   { fontSize: 16, fontWeight: '700', color: BRAND.navy },
  modalCancel:  { fontSize: 15, color: '#90A4AE', paddingVertical: 4, paddingHorizontal: 4 },
  modalSave:    { fontSize: 15, color: BRAND.blue, fontWeight: '700', paddingVertical: 4, paddingHorizontal: 4 },
  modalBody:    { padding: 16, paddingBottom: 40 },
  label:        { fontSize: 11, fontWeight: '700', color: '#90A4AE', textTransform: 'uppercase', marginBottom: 6, marginTop: 4 },
  input:        { backgroundColor: '#fff', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#E0E0E0', fontSize: 14, color: BRAND.navy },
  statusRow:    { flexDirection: 'row', gap: 8, marginBottom: 12 },
  statusChip:   { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, alignItems: 'center' },
  vehicleChip:  { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#E0E0E0', backgroundColor: '#fff' },
  vehicleChipText: { fontSize: 13, color: BRAND.navy, fontWeight: '600' },
});
