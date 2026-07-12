// Operaciones — Generar Programa de Cobranza del Día por Cobrador.
// Arma la ruta del día: elige cobrador, fecha y los clientes a visitar
// (dirección y saldo vienen de cobra_clients / sus facturas pendientes).
// Esto es lo que despues el cobrador ve en "Asignación de Cobranza" de
// Mi Ruta.
import { useState, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { BRAND, formatCurrency } from '@gastocheck/shared';
import { supabase } from '../../lib/supabase';
import { getActiveMembership } from '../../lib/membership';
import DatePickerField from '../../components/DatePickerField';

interface Cobrador {
  user_id: string;
  name: string;
}

interface ClientCandidate {
  id: string;
  name: string;
  address: string | null;
  payer_name: string | null;
  visit_schedule: string | null;
  current_balance: number;
  risk_score: number;
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function GenerarRutaScreen() {
  const router = useRouter();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);

  const [cobradores, setCobradores] = useState<Cobrador[]>([]);
  const [clients,     setClients]   = useState<ClientCandidate[]>([]);

  const [selectedCobrador, setSelectedCobrador] = useState<string | null>(null);
  const [assignedDate,     setAssignedDate]     = useState(todayStr());
  const [selectedClients,  setSelectedClients]  = useState<Set<string>>(new Set());
  const [priority,         setPriority]         = useState<'baja' | 'media' | 'alta' | 'crítica'>('media');

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const m = await getActiveMembership(user.id);
      if (!m) { setLoading(false); return; }
      setCompanyId(m.company_id);

      const { data: members } = await supabase.from('company_members')
        .select('user_id, profiles:user_id(full_name)')
        .eq('company_id', m.company_id).eq('status', 'active').eq('role', 'collector');
      setCobradores((members ?? []).map((mem: any) => ({
        user_id: mem.user_id, name: mem.profiles?.full_name ?? 'Cobrador',
      })));

      const { data: cls } = await supabase.from('cobra_clients')
        .select('id, name, address, payer_name, visit_schedule, current_balance, risk_score')
        .eq('company_id', m.company_id).eq('status', 'active')
        .order('risk_score', { ascending: false });
      setClients(cls ?? []);

      setLoading(false);
    })();
  }, []);

  function toggleClient(id: string) {
    setSelectedClients(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const totalAsignado = useMemo(
    () => clients.filter(c => selectedClients.has(c.id)).reduce((s, c) => s + c.current_balance, 0),
    [clients, selectedClients],
  );

  async function handleGenerate() {
    if (!companyId || !selectedCobrador) {
      Alert.alert('Falta cobrador', 'Selecciona a qué cobrador le asignas la ruta.');
      return;
    }
    if (selectedClients.size === 0) {
      Alert.alert('Sin clientes', 'Selecciona al menos un cliente para la ruta.');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from('cobra_routes').insert({
        company_id:        companyId,
        actor_id:          selectedCobrador,
        actor_type:        'cobrador',
        assigned_date:     assignedDate,
        clients_assigned:  Array.from(selectedClients),
        status:            'planned',
        route_priority:    priority,
      });
      if (error) throw error;

      const cobradorName = cobradores.find(c => c.user_id === selectedCobrador)?.name ?? 'Cobrador';
      Alert.alert('✓ Ruta generada', `${cobradorName} — ${selectedClients.size} cliente(s), ${formatCurrency(totalAsignado)}`, [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'No se pudo generar la ruta.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BRAND.gray }}>
      <ActivityIndicator size="large" color={BRAND.cobra} />
    </View>;
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: BRAND.gray }} contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
      <Text style={styles.fieldLabel}>Cobrador</Text>
      {cobradores.length === 0 ? (
        <Text style={styles.emptyHint}>Sin cobradores dados de alta — invítalos desde Equipo.</Text>
      ) : (
        <View style={{ gap: 8, marginBottom: 8 }}>
          {cobradores.map(c => (
            <TouchableOpacity key={c.user_id}
              style={[styles.optionRow, selectedCobrador === c.user_id && styles.optionRowActive]}
              onPress={() => setSelectedCobrador(c.user_id)}>
              <Text style={[styles.optionText, selectedCobrador === c.user_id && { color: BRAND.cobra }]}>{c.name}</Text>
              {selectedCobrador === c.user_id && <Text style={{ color: BRAND.cobra, fontWeight: '800' }}>✓</Text>}
            </TouchableOpacity>
          ))}
        </View>
      )}

      <Text style={styles.fieldLabel}>Fecha</Text>
      <DatePickerField label="Fecha de la ruta" value={assignedDate} onChange={setAssignedDate} />

      <Text style={styles.fieldLabel}>Prioridad</Text>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
        {(['baja', 'media', 'alta', 'crítica'] as const).map(p => (
          <TouchableOpacity key={p} style={[styles.priorityChip, priority === p && styles.priorityChipActive]} onPress={() => setPriority(p)}>
            <Text style={[styles.priorityChipText, priority === p && { color: '#fff' }]}>{p}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.fieldLabel}>Clientes a visitar ({selectedClients.size} seleccionados — {formatCurrency(totalAsignado)})</Text>
      {clients.length === 0 ? (
        <Text style={styles.emptyHint}>Sin clientes activos.</Text>
      ) : clients.map(c => {
        const active = selectedClients.has(c.id);
        return (
          <TouchableOpacity key={c.id} style={[styles.clientRow, active && styles.clientRowActive]} onPress={() => toggleClient(c.id)}>
            <Text style={{ fontSize: 16 }}>{active ? '☑' : '☐'}</Text>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.clientName}>{c.name}</Text>
              {c.address ? <Text style={styles.clientAddress} numberOfLines={1}>{c.address}</Text> : (
                <Text style={styles.clientAddressMissing}>Sin dirección registrada</Text>
              )}
              {(c.payer_name || c.visit_schedule) && (
                <Text style={styles.clientAddress} numberOfLines={1}>
                  {[c.payer_name, c.visit_schedule].filter(Boolean).join(' · ')}
                </Text>
              )}
            </View>
            <Text style={styles.clientBalance}>{formatCurrency(c.current_balance)}</Text>
          </TouchableOpacity>
        );
      })}

      <TouchableOpacity style={[styles.generateBtn, saving && { opacity: 0.6 }]} onPress={handleGenerate} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.generateBtnText}>✓ Generar Ruta</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fieldLabel: { fontSize: 11, fontWeight: '700', color: '#90A4AE', textTransform: 'uppercase', marginBottom: 8, marginTop: 14 },
  emptyHint: { fontSize: 13, color: '#90A4AE', paddingVertical: 8 },

  optionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 13, borderWidth: 1.5, borderColor: '#E0E0E0' },
  optionRowActive: { borderColor: BRAND.cobra, backgroundColor: BRAND.cobra + '10' },
  optionText: { fontSize: 14, fontWeight: '600', color: BRAND.navy },

  priorityChip: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E0E0E0' },
  priorityChipActive: { backgroundColor: BRAND.cobra, borderColor: BRAND.cobra },
  priorityChipText: { fontSize: 12, fontWeight: '700', color: BRAND.navy, textTransform: 'capitalize' },

  clientRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 6, borderWidth: 1, borderColor: '#E8EAF6' },
  clientRowActive: { borderColor: BRAND.cobra, backgroundColor: BRAND.cobra + '08' },
  clientName: { fontSize: 13, fontWeight: '700', color: BRAND.navy },
  clientAddress: { fontSize: 11, color: '#90A4AE', marginTop: 2 },
  clientAddressMissing: { fontSize: 11, color: BRAND.orange, marginTop: 2, fontStyle: 'italic' },
  clientBalance: { fontSize: 13, fontWeight: '700', color: BRAND.green },

  generateBtn: { backgroundColor: BRAND.cobra, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 24 },
  generateBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
