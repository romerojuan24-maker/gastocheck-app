// Pantalla de gestión de vehículos — vertical Flotillas
import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList,
  ActivityIndicator, Modal, TextInput, ScrollView, Alert,
} from 'react-native';
import {
  BRAND, VEHICLE_STATUS_META, VEHICLE_TYPE_LABELS, VEHICLE_TYPE_ICONS,
  VEHICLE_TYPES, vehicleDisplayName,
} from '@gastocheck/shared';
import type { FleetVehicle, VehicleStatus, VehicleType } from '@gastocheck/shared';
import { supabase } from '../lib/supabase';

const money = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);

const STATUS_FILTERS: { key: VehicleStatus | 'all'; label: string }[] = [
  { key: 'all',         label: 'Todos' },
  { key: 'active',      label: 'Activos' },
  { key: 'maintenance', label: 'En taller' },
  { key: 'inactive',    label: 'Inactivos' },
];

interface VehicleWithCost extends FleetVehicle {
  month_cost?: number;
  receipt_count?: number;
}

export default function FleetVehiclesScreen() {
  const [vehicles,    setVehicles]    = useState<VehicleWithCost[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [filter,      setFilter]      = useState<VehicleStatus | 'all'>('all');
  const [companyId,   setCompanyId]   = useState<string | null>(null);
  const [showModal,   setShowModal]   = useState(false);
  const [editVehicle, setEditVehicle] = useState<FleetVehicle | null>(null);
  const [saving,      setSaving]      = useState(false);

  // Form state
  const [fEconomic, setFEconomic] = useState('');
  const [fPlates,   setFPlates]   = useState('');
  const [fBrand,    setFBrand]    = useState('');
  const [fModel,    setFModel]    = useState('');
  const [fYear,     setFYear]     = useState('');
  const [fType,     setFType]     = useState<VehicleType>('otro');
  const [fKm,       setFKm]       = useState('');
  const [fStatus,   setFStatus]   = useState<VehicleStatus>('active');
  const [fNotes,    setFNotes]    = useState('');

  // ── Cargar vehículos ──────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: member } = await supabase
        .from('company_members').select('company_id').eq('user_id', user.id).single();
      if (!member) return;
      setCompanyId(member.company_id);

      let q = supabase
        .from('vehicles')
        .select('*')
        .eq('company_id', member.company_id)
        .order('economic_number', { ascending: true });

      if (filter !== 'all') q = q.eq('status', filter);
      const { data: vList } = await q;

      // Costo del mes por vehículo
      const now   = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      const enriched: VehicleWithCost[] = [];

      for (const v of vList ?? []) {
        const { count, data: recs } = await supabase
          .from('receipts')
          .select('total_amount', { count: 'exact' })
          .eq('vehicle_id', v.id)
          .gte('receipt_date', start)
          .not('status', 'in', '(cancelled,rejected)');

        const month_cost = (recs ?? []).reduce((s, r) => s + (r.total_amount ?? 0), 0);
        enriched.push({ ...v, month_cost, receipt_count: count ?? 0 });
      }
      setVehicles(enriched);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  // ── Abrir modal (crear / editar) ──────────────────────────────────────────

  function openCreate() {
    setEditVehicle(null);
    setFEconomic(''); setFPlates(''); setFBrand(''); setFModel('');
    setFYear(''); setFType('otro'); setFKm(''); setFStatus('active'); setFNotes('');
    setShowModal(true);
  }

  function openEdit(v: FleetVehicle) {
    setEditVehicle(v);
    setFEconomic(v.economic_number ?? '');
    setFPlates(v.plates ?? '');
    setFBrand(v.brand ?? '');
    setFModel(v.model ?? '');
    setFYear(v.year ? String(v.year) : '');
    setFType(v.vehicle_type);
    setFKm(v.current_km ? String(v.current_km) : '');
    setFStatus(v.status);
    setFNotes(v.notes ?? '');
    setShowModal(true);
  }

  // ── Guardar ───────────────────────────────────────────────────────────────

  async function save() {
    if (!companyId) return;
    setSaving(true);

    const payload = {
      company_id:      companyId,
      economic_number: fEconomic.trim() || null,
      plates:          fPlates.trim().toUpperCase() || null,
      brand:           fBrand.trim() || null,
      model:           fModel.trim() || null,
      year:            fYear ? parseInt(fYear) : null,
      vehicle_type:    fType,
      current_km:      fKm ? parseInt(fKm) : null,
      status:          fStatus,
      notes:           fNotes.trim() || null,
    };

    const { error } = editVehicle
      ? await supabase.from('vehicles').update(payload).eq('id', editVehicle.id)
      : await supabase.from('vehicles').insert(payload);

    setSaving(false);
    if (error) { Alert.alert('Error', error.message); return; }
    setShowModal(false);
    load();
  }

  // ── Eliminar ──────────────────────────────────────────────────────────────

  function confirmDelete(v: FleetVehicle) {
    Alert.alert(
      'Eliminar vehículo',
      `¿Eliminar "${vehicleDisplayName(v)}"?\nSus comprobantes no se borrarán.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar', style: 'destructive',
          onPress: async () => {
            await supabase.from('vehicles').delete().eq('id', v.id);
            load();
          },
        },
      ],
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={{ flex: 1, backgroundColor: BRAND.gray }}>

      {/* Filtros */}
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

      {/* Botón agregar */}
      <TouchableOpacity style={styles.addBtn} onPress={openCreate}>
        <Text style={styles.addBtnText}>+ Agregar vehículo</Text>
      </TouchableOpacity>

      {/* Lista */}
      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={BRAND.blue} /></View>
      ) : vehicles.length === 0 ? (
        <View style={styles.center}>
          <Text style={{ fontSize: 48 }}>🚛</Text>
          <Text style={styles.emptyText}>Sin vehículos registrados</Text>
        </View>
      ) : (
        <FlatList
          data={vehicles}
          keyExtractor={(v) => v.id}
          contentContainerStyle={{ padding: 12, paddingBottom: 32 }}
          refreshing={loading}
          onRefresh={load}
          renderItem={({ item: v }) => {
            const statusMeta = VEHICLE_STATUS_META[v.status];
            return (
              <TouchableOpacity style={styles.card} onLongPress={() => openEdit(v)}>
                <View style={styles.cardHeader}>
                  <Text style={styles.typeIcon}>
                    {VEHICLE_TYPE_ICONS[v.vehicle_type]}
                  </Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.vehicleName} numberOfLines={1}>
                      {vehicleDisplayName(v)}
                    </Text>
                    <Text style={styles.vehicleSub}>
                      {VEHICLE_TYPE_LABELS[v.vehicle_type]}
                      {v.current_km ? ` · ${v.current_km.toLocaleString()} km` : ''}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: statusMeta.color + '18' }]}>
                    <Text style={[styles.statusText, { color: statusMeta.color }]}>
                      {statusMeta.icon} {statusMeta.label}
                    </Text>
                  </View>
                </View>

                <View style={styles.cardFooter}>
                  <View style={styles.kpi}>
                    <Text style={styles.kpiValue}>{money(v.month_cost ?? 0)}</Text>
                    <Text style={styles.kpiLabel}>Gasto este mes</Text>
                  </View>
                  <View style={styles.kpi}>
                    <Text style={styles.kpiValue}>{v.receipt_count ?? 0}</Text>
                    <Text style={styles.kpiLabel}>Comprobantes</Text>
                  </View>
                  <TouchableOpacity onPress={() => confirmDelete(v)} style={styles.deleteBtn}>
                    <Text style={styles.deleteBtnText}>🗑</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* Modal crear/editar */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet"
        onRequestClose={() => setShowModal(false)}>
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowModal(false)}>
              <Text style={styles.modalCancel}>Cancelar</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {editVehicle ? 'Editar vehículo' : 'Nuevo vehículo'}
            </Text>
            <TouchableOpacity onPress={save} disabled={saving}>
              <Text style={[styles.modalSave, saving && { opacity: 0.4 }]}>
                {saving ? '...' : 'Guardar'}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.modalBody}>
            {/* Tipo de vehículo */}
            <Text style={styles.label}>Tipo de vehículo</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              style={{ marginBottom: 12 }} contentContainerStyle={{ gap: 8 }}>
              {VEHICLE_TYPES.map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.typeChip, fType === t && { backgroundColor: BRAND.blue }]}
                  onPress={() => setFType(t)}
                >
                  <Text style={fType === t ? { color: '#fff' } : { color: BRAND.navy }}>
                    {VEHICLE_TYPE_ICONS[t]} {VEHICLE_TYPE_LABELS[t]}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <FormRow label="Número económico" value={fEconomic} onChange={setFEconomic} placeholder="Ej: 001" />
            <FormRow label="Placas" value={fPlates} onChange={setFPlates} placeholder="Ej: ABC1234" caps />
            <FormRow label="Marca" value={fBrand} onChange={setFBrand} placeholder="Ej: Nissan" />
            <FormRow label="Modelo" value={fModel} onChange={setFModel} placeholder="Ej: NP300" />
            <FormRow label="Año" value={fYear} onChange={setFYear} placeholder="2022" numeric />
            <FormRow label="Kilometraje actual" value={fKm} onChange={setFKm} placeholder="45000" numeric />

            {/* Estado */}
            <Text style={styles.label}>Estado</Text>
            <View style={styles.statusRow}>
              {(['active', 'maintenance', 'inactive'] as VehicleStatus[]).map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[
                    styles.statusChip,
                    { borderColor: VEHICLE_STATUS_META[s].color },
                    fStatus === s && { backgroundColor: VEHICLE_STATUS_META[s].color },
                  ]}
                  onPress={() => setFStatus(s)}
                >
                  <Text style={[
                    { fontSize: 13, fontWeight: '600' },
                    fStatus === s ? { color: '#fff' } : { color: VEHICLE_STATUS_META[s].color },
                  ]}>
                    {VEHICLE_STATUS_META[s].icon} {VEHICLE_STATUS_META[s].label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Notas (opcional)</Text>
            <TextInput
              style={[styles.input, { height: 72 }]}
              multiline
              value={fNotes}
              onChangeText={setFNotes}
              placeholder="Observaciones del vehículo..."
              placeholderTextColor="#B0BEC5"
            />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

function FormRow({ label, value, onChange, placeholder, numeric, caps }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; numeric?: boolean; caps?: boolean;
}) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#B0BEC5"
        keyboardType={numeric ? 'number-pad' : 'default'}
        autoCapitalize={caps ? 'characters' : 'words'}
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
  cardHeader:   { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12 },
  typeIcon:     { fontSize: 28, marginTop: 2 },
  vehicleName:  { fontSize: 15, fontWeight: '700', color: BRAND.navy },
  vehicleSub:   { fontSize: 12, color: '#90A4AE', marginTop: 2 },
  statusBadge:  { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 },
  statusText:   { fontSize: 11, fontWeight: '700' },
  cardFooter:   { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#F5F5F5', paddingTop: 10, alignItems: 'center' },
  kpi:          { flex: 1 },
  kpiValue:     { fontSize: 15, fontWeight: '800', color: BRAND.navy },
  kpiLabel:     { fontSize: 11, color: '#90A4AE', marginTop: 1 },
  deleteBtn:    { padding: 6 },
  deleteBtnText:{ fontSize: 20 },
  // Modal
  modal:        { flex: 1, backgroundColor: BRAND.gray },
  modalHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E0E0E0' },
  modalTitle:   { fontSize: 16, fontWeight: '700', color: BRAND.navy },
  modalCancel:  { fontSize: 15, color: '#90A4AE', paddingVertical: 4, paddingHorizontal: 4 },
  modalSave:    { fontSize: 15, color: BRAND.blue, fontWeight: '700', paddingVertical: 4, paddingHorizontal: 4 },
  modalBody:    { padding: 16, paddingBottom: 40 },
  label:        { fontSize: 11, fontWeight: '700', color: '#90A4AE', textTransform: 'uppercase', marginBottom: 6, marginTop: 4 },
  input:        { backgroundColor: '#fff', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#E0E0E0', fontSize: 14, color: BRAND.navy },
  typeChip:     { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#E0E0E0', backgroundColor: '#fff' },
  statusRow:    { flexDirection: 'row', gap: 8, marginBottom: 12 },
  statusChip:   { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, alignItems: 'center' },
});
