import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { computeBalance, STATUS_META, BRAND, type Expense } from '@gastocheck/shared';

// Datos demo del usuario que gasta (se reemplazan por consultas a Supabase)
const myExpenses: Pick<Expense, 'id' | 'provider_name' | 'total' | 'status'>[] = [
  { id: '1', provider_name: 'Gasolinera Pemex', total: 850, status: 'pending_auth' },
  { id: '2', provider_name: 'Restaurante El Paso', total: 430, status: 'authorized' },
  { id: '3', provider_name: 'OXXO', total: 95, status: 'rejected' },
];

const balance = computeBalance(
  { opening_balance: 2000 },
  [{ amount: 5000 }],
  myExpenses.map((e) => ({ total: e.total, status: e.status })),
);

const money = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);

export default function Home() {
  const [busy, setBusy] = useState(false);

  async function captureTicket() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permiso requerido', 'Activa la cámara para tomar foto del ticket.');
      return;
    }
    setBusy(true);
    const res = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    setBusy(false);
    if (!res.canceled) {
      // TODO: subir a Storage -> Edge Function /ocr-extract -> prellenar ExpenseForm
      Alert.alert('Foto tomada', 'Aquí la IA leería el ticket y prellenaría el gasto.');
    }
  }

  return (
    <ScrollView style={{ backgroundColor: BRAND.gray }} contentContainerStyle={{ padding: 16 }}>
      <View style={styles.card}>
        <Text style={styles.cardLabel}>Mi saldo disponible</Text>
        <Text style={styles.balance}>{money(balance.available)}</Text>
        <View style={styles.row}>
          <Stat label="Saldo inicial" value={money(balance.opening)} />
          <Stat label="Anticipos" value={money(balance.advances)} />
        </View>
        <View style={styles.row}>
          <Stat label="Autorizados" value={money(balance.authorizedSpent)} color={BRAND.green} />
          <Stat label="Por comprobar" value={money(balance.pendingToVerify)} color={BRAND.orange} />
        </View>
      </View>

      <TouchableOpacity style={styles.primaryBtn} onPress={captureTicket} disabled={busy}>
        <Text style={styles.primaryBtnText}>📷 Tomar foto del ticket</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.secondaryBtn}>
        <Text style={styles.secondaryBtnText}>📄 Subir XML o PDF</Text>
      </TouchableOpacity>

      <Text style={styles.section}>Mis gastos</Text>
      {myExpenses.map((e) => {
        const meta = STATUS_META[e.status];
        return (
          <View key={e.id} style={styles.expenseRow}>
            <View>
              <Text style={styles.provider}>{e.provider_name}</Text>
              <Text style={[styles.badge, { color: meta.color }]}>● {meta.label}</Text>
            </View>
            <Text style={styles.amount}>{money(e.total)}</Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, color ? { color } : null]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 20, marginBottom: 16 },
  cardLabel: { color: '#90A4AE', fontSize: 13 },
  balance: { color: BRAND.navy, fontSize: 34, fontWeight: '800', marginVertical: 6 },
  row: { flexDirection: 'row', gap: 12, marginTop: 10 },
  statLabel: { color: '#90A4AE', fontSize: 12 },
  statValue: { color: BRAND.navy, fontSize: 16, fontWeight: '700' },
  primaryBtn: { backgroundColor: BRAND.blue, borderRadius: 14, padding: 16, alignItems: 'center', marginBottom: 10 },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  secondaryBtn: { backgroundColor: '#fff', borderRadius: 14, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: BRAND.blue },
  secondaryBtnText: { color: BRAND.blue, fontSize: 16, fontWeight: '700' },
  section: { fontSize: 18, fontWeight: '700', color: BRAND.navy, marginTop: 24, marginBottom: 8 },
  expenseRow: { backgroundColor: '#fff', borderRadius: 14, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  provider: { fontSize: 15, fontWeight: '600', color: BRAND.navy },
  badge: { fontSize: 12, marginTop: 4, fontWeight: '600' },
  amount: { fontSize: 16, fontWeight: '700', color: BRAND.navy },
});
