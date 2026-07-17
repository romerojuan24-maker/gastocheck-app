// Fleet dashboard — KPI + alertas inteligentes (robo combustible, mantenimiento)
import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList,
  ActivityIndicator, ScrollView,
} from 'react-native';
import {
  BRAND, isFleetSector, vehicleDisplayName, VEHICLE_STATUS_META,
  detectFuelTheft, predictMaintenance,
  type FuelAlert,
} from '@gastocheck/shared';
import type { FleetVehicle, FleetOperator } from '@gastocheck/shared';
import { supabase } from '../lib/supabase';
import { getActiveMembership } from '../lib/membership';

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
  const [alerts,       setAlerts]       = useState<FuelAlert[]>([]);

  useEffect(() => { loadData(); }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const member = await getActiveMembership(user.id);
      if (!member) return;

      const { data: co } = await supabase.from('companies').select('sector').eq('id', member.company_id).maybeSingle();
      if (!isFleetSector((co as any)?.sector)) {
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

      // 🟡 FIX BUG #15: Eliminar N+1 queries — cargar todos los receipts en una sola query
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      const monthStart = startOfMonth.toISOString().slice(0, 10);

      // Una sola query: todos los receipts del mes, agrupados por vehicle_id/operator_id
      const { data: monthReceipts } = await supabase
        .from('receipts')
        .select('vehicle_id, operator_id, total_amount')
        .eq('company_id', member.company_id)
        .gte('receipt_date', monthStart);

      // Construir mapa de receipts por vehicle y operator
      const vehicleReceiptMap = new Map<string, { cost: number; count: number }>();
      const operatorReceiptMap = new Map<string, { cost: number; count: number }>();

      (monthReceipts ?? []).forEach((r: any) => {
        if (r.vehicle_id) {
          const key = r.vehicle_id;
          const current = vehicleReceiptMap.get(key) ?? { cost: 0, count: 0 };
          vehicleReceiptMap.set(key, {
            cost: current.cost + (r.total_amount ?? 0),
            count: current.count + 1,
          });
        }
        if (r.operator_id) {
          const key = r.operator_id;
          const current = operatorReceiptMap.get(key) ?? { cost: 0, count: 0 };
          operatorReceiptMap.set(key, {
            cost: current.cost + (r.total_amount ?? 0),
            count: current.count + 1,
          });
        }
      });

      // Calcular KPI por vehículo (sin queries adicionales)
      const vKpis: VehicleKpi[] = (vehicles ?? []).map((v: any) => {
        const data = vehicleReceiptMap.get(v.id) ?? { cost: 0, count: 0 };
        return {
          vehicle: v as FleetVehicle,
          monthCost: data.cost,
          receiptCount: data.count,
        };
      });

      // Calcular KPI por operador (sin queries adicionales)
      const oKpis: OperatorKpi[] = (operators ?? []).map((o: any) => {
        const data = operatorReceiptMap.get(o.id) ?? { cost: 0, count: 0 };
        return {
          operator: o as FleetOperator,
          monthCost: data.cost,
          receiptCount: data.count,
        };
      });

      setVehicleKpis(vKpis.sort((a, b) => b.monthCost - a.monthCost));
      setOperatorKpis(oKpis.sort((a, b) => b.monthCost - a.monthCost));
      setTotalCost(vKpis.reduce((s, v) => s + v.monthCost, 0));
      setTotalReceipts(vKpis.reduce((s, v) => s + v.receiptCount, 0));

      // Calcular alertas
      const allAlerts: FuelAlert[] = [];
      for (const vk of vKpis) {
        // Detectar robo de combustible (mock: comparar vs promedio)
        const avgKmPerLiter = 8; // estimado
        const currentKmPerLiter = (vk.receiptCount > 0 ? vk.monthCost / vk.receiptCount : 0) / 100;
        const fuelAlert = detectFuelTheft(avgKmPerLiter, currentKmPerLiter);
        if (fuelAlert) {
          fuelAlert.vehicle_id = vk.vehicle.id;
          allAlerts.push(fuelAlert);
        }

        // Mantenimiento preventivo
        const maintenanceAlerts = predictMaintenance(
          vk.vehicle.current_km ?? 0,
          (vk.vehicle as any).last_oil_change_km ?? 0,
          (vk.vehicle as any).last_inspection_km ?? 0,
        );
        maintenanceAlerts.forEach((ma) => {
          ma.vehicle_id = vk.vehicle.id;
          allAlerts.push(ma);
        });
      }
      setAlerts(allAlerts);
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
      {/* Alertas críticas */}
      {alerts.length > 0 && (
        <View style={{ paddingHorizontal: 12, paddingTop: 12, paddingBottom: 4 }}>
          <Text style={styles.sectionTitle}>🚨 Alertas activas</Text>
          {alerts.slice(0, 3).map((alert, i) => (
            <View
              key={i}
              style={[
                styles.alertCard,
                {
                  borderLeftColor:
                    alert.severity === 'high'
                      ? '#C62828'
                      : alert.severity === 'medium'
                      ? BRAND.orange
                      : '#1565C0',
                },
              ]}
            >
              <Text style={styles.alertTitle}>{alert.message}</Text>
              <Text style={styles.alertHint}>
                {alert.recommendations[0] ?? 'Revisar'}
              </Text>
            </View>
          ))}
        </View>
      )}

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
  alertCard:     { backgroundColor: '#fff', borderRadius: 10, borderLeftWidth: 4, padding: 12, marginBottom: 8 },
  alertTitle:    { fontSize: 13, fontWeight: '700', color: '#333', marginBottom: 4 },
  alertHint:     { fontSize: 11, color: '#90A4AE' },
});
