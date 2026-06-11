// Fleet dashboard — KPI de vehículos, operadores, rutas
import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList,
  ActivityIndicator, ScrollView,
} from 'react-native';
import { BRAND, isFleetSector, vehicleDisplayName, VEHICLE_STATUS_META } from '@gastocheck/shared';
import type { FleetVehicle, FleetOperator } from '@gastocheck/shared';
import { supabase } from '../lib/supabase';

const money = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);

interface VehicleKpi {
  vehicle: FleetVehicle;
  monthCost: number;
  receiptCount: number;
}

interface OperatorKpi {
  operator: FleetOperator;
  monthCost: number;
  receiptCount: number;
}

export default function FleetDashboardScreen() {
  const [loading,      setLoading]      = useState(true);
  const [companyId,    setCompanyId]    = useState<string | null>(null);
  const [vehicleKpis,  setVehicleKpis]  = useState<VehicleKpi[]>([]);
  const [operatorKpis, setOperatorKpis] = useState<OperatorKpi[]>([]);
  const [totalCost,    setTotalCost]    = useState(0);
  const [totalReceipts,setTotalReceipts]= useState(0);

  useEffect(() => { loadData(); }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: member } = await supabase
        .from('company_members')
        .select('company_id, companies(sector)')
        .eq('user_id', user.id)
        .single();

      if (!member || !isFleetSector((member.companies as any)?.sector)) {
        return;
      }

      setCompanyId(member.company_id);

      // Cargar vehículos
      const { data: vehicles } = await supabase
        .from('vehicles')
        .select('*')
        .eq('company_id', member.company_id)
        .eq('status', 'active');

      // Cargar operadores
      const { data: operators } = await supabase
        .from('operators')
        .select('*')
        .eq('company_id', member.company_id)
        .eq('status', 'active');

      // Calcular KPI por vehículo
      const vKpis: VehicleKpi[] = [];
      if (vehicles) {
        const startOfMonth = new Date();
        startOfMonth.setDate(1);

        for (const v of vehicles) {
          const { data: receipts } = await supabase
            .from('receipts')
            .select('total_amount')
            .eq('vehicle_id', v.id)
            .gte('receipt_date', startOfMonth.toISOString().slice(0, 10));

          const cost = (receipts ?? []).reduce((sum, r) => sum + (r.total_amount ?? 0), 0);
          vKpis.push({
            vehicle: v as FleetVehicle,
            monthCost: cost,
            receiptCount: receipts?.length ?? 0,
          });
        }
      }

      // Calcular KPI por operador
      const oKpis: OperatorKpi[] = [];
      if (operators) {
        const startOfMonth = new Date();
        startOfMonth.setDate(1);

        for (const o of operators) {
          const { data: receipts } = await supabase
            .from('receipts')
            .select('total_amount')
            .eq('operator_id', o.id)
            .gte('receipt_date', startOfMonth.toISOString().slice(0, 10));

          const cost = (receipts ?? []).reduce((sum, r) => sum + (r.total_amount ?? 0), 0);
          oKpis.push({
            operator: o as FleetOperator,
            monthCost: cost,
            receiptCount: receipts?.length ?? 0,
          });
        }
      }

      setVehicleKpis(vKpis.sort((a, b) => b.monthCost - a.monthCost));
      setOperatorKpis(oKpis.sort((a, b) => b.monthCost - a.monthCost));
      setTotalCost(vKpis.reduce((s, v) => s + v.monthCost, 0));
      setTotalReceipts(vKpis.reduce((s, v) => s + v.receiptCount, 0));
    } finally {
      setLoading(false);
    }
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BRAND.gray }}>
        <ActivityIndicator size="large" color={BRAND.blue} />
      </View>
    );
  }

  return (
    <ScrollView style={{ backgroundColor: BRAND.gray }}>
      {/* Resumen */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Gasto mes</Text>
          <Text style={styles.summaryValue}>{money(totalCost)}</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Comprobantes</Text>
          <Text style={styles.summaryValue}>{totalReceipts}</Text>
        </View>
      </View>

      {/* Vehículos */}
      <Text style={styles.sectionTitle}>Vehículos (Mes actual)</Text>
      {vehicleKpis.length === 0 ? (
        <Text style={styles.emptyText}>Sin vehículos activos</Text>
      ) : (
        vehicleKpis.map((vk) => (
          <View key={vk.vehicle.id} style={styles.kpiCard}>
            <View style={styles.kpiHeader}>
              <Text style={styles.kpiTitle}>
                {VEHICLE_STATUS_META[vk.vehicle.status].icon} {vehicleDisplayName(vk.vehicle)}
              </Text>
              <Text style={styles.kpiAmount}>{money(vk.monthCost)}</Text>
            </View>
            <View style={styles.kpiBar}>
              <View
                style={[
                  styles.kpiBarFill,
                  { width: `${Math.min((vk.monthCost / totalCost) * 100, 100)}%` },
                ]}
              />
            </View>
            <Text style={styles.kpiMeta}>{vk.receiptCount} comprobantes</Text>
          </View>
        ))
      )}

      {/* Operadores */}
      <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Operadores (Mes actual)</Text>
      {operatorKpis.length === 0 ? (
        <Text style={styles.emptyText}>Sin operadores activos</Text>
      ) : (
        operatorKpis.map((ok) => (
          <View key={ok.operator.id} style={styles.kpiCard}>
            <View style={styles.kpiHeader}>
              <Text style={styles.kpiTitle}>🧑‍✈️ {ok.operator.name}</Text>
              <Text style={styles.kpiAmount}>{money(ok.monthCost)}</Text>
            </View>
            <View style={styles.kpiBar}>
              <View
                style={[
                  styles.kpiBarFill,
                  { width: `${Math.min((ok.monthCost / totalCost) * 100, 100)}%`, backgroundColor: '#FF9800' },
                ]}
              />
            </View>
            <Text style={styles.kpiMeta}>{ok.receiptCount} comprobantes</Text>
          </View>
        ))
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  summaryRow:    { flexDirection: 'row', gap: 12, padding: 16, paddingBottom: 8 },
  summaryCard:   { flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 16, alignItems: 'center' },
  summaryLabel:  { fontSize: 12, color: '#90A4AE', fontWeight: '600', textTransform: 'uppercase' },
  summaryValue:  { fontSize: 18, fontWeight: '800', color: BRAND.blue, marginTop: 4 },
  sectionTitle:  { fontSize: 12, fontWeight: '700', color: '#90A4AE', textTransform: 'uppercase', paddingHorizontal: 16, marginBottom: 8 },
  emptyText:     { color: '#90A4AE', paddingHorizontal: 16, textAlign: 'center' },
  kpiCard:       { backgroundColor: '#fff', borderRadius: 12, marginHorizontal: 12, marginBottom: 8, padding: 14 },
  kpiHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  kpiTitle:      { fontSize: 14, fontWeight: '600', color: BRAND.navy, flex: 1 },
  kpiAmount:     { fontSize: 15, fontWeight: '700', color: BRAND.blue, marginLeft: 8 },
  kpiBar:        { height: 6, backgroundColor: '#F0F0F0', borderRadius: 3, overflow: 'hidden', marginBottom: 6 },
  kpiBarFill:    { height: '100%', backgroundColor: BRAND.green, borderRadius: 3 },
  kpiMeta:       { fontSize: 12, color: '#90A4AE' },
});
