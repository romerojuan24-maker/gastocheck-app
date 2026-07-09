import { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator,
} from 'react-native';
import { BRAND } from '@gastocheck/shared';

export default function BancocheckHome() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    setStats({
      totalTransactions: 0,
      unexplainedCount: 0,
      explainedPercentage: 0,
    });
    setLoading(false);
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={BRAND.blue} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🏦 BancoCheck</Text>
        <Text style={styles.subtitle}>Control de movimientos</Text>
      </View>

      <View style={styles.statsRow}>
        <StatCard title="Total" value={0} />
        <StatCard title="Sin explicar" value={0} highlight />
        <StatCard title="Explicados" value="0%" />
      </View>

      <View style={styles.buttonsGrid}>
        <ActionButton label="📤 Importar" />
        <ActionButton label="📋 Ver todos" />
        <ActionButton label="⚙️ Cuentas" />
      </View>
    </ScrollView>
  );
}

function StatCard({ title, value, highlight }: any) {
  return (
    <View style={[styles.statCard, highlight && styles.statCardHighlight]}>
      <Text style={styles.statLabel}>{title}</Text>
      <Text style={[styles.statValue, highlight && { color: '#d32f2f' }]}>{value}</Text>
    </View>
  );
}

function ActionButton({ label }: any) {
  return (
    <TouchableOpacity style={styles.actionButton} activeOpacity={0.7}>
      <Text style={styles.actionButtonText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BRAND.gray },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { backgroundColor: BRAND.blue, padding: 20, paddingTop: 40 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#fff' },
  subtitle: { fontSize: 14, color: '#fff', marginTop: 4 },
  statsRow: { flexDirection: 'row', padding: 12, gap: 8 },
  statCard: { flex: 1, padding: 12, backgroundColor: '#fff', borderRadius: 8 },
  statCardHighlight: { backgroundColor: '#ffebee' },
  statLabel: { fontSize: 12, color: '#999', marginBottom: 4 },
  statValue: { fontSize: 20, fontWeight: 'bold', color: '#000' },
  buttonsGrid: { flexDirection: 'row', padding: 12, gap: 8 },
  actionButton: { flex: 1, backgroundColor: BRAND.blue, padding: 16, borderRadius: 8, alignItems: 'center' },
  actionButtonText: { color: '#fff', fontWeight: 'bold' },
});
