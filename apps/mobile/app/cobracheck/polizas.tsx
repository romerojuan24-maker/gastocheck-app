// Pólizas — las 3 formas en que se registra/concilia un cobro.
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { BRAND } from '@gastocheck/shared';

export default function PolizasHub() {
  const router = useRouter();

  return (
    <ScrollView style={{ flex: 1, backgroundColor: BRAND.gray }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <Text style={styles.hint}>
        Cómo se registró el cobro de una factura — elige según el medio de pago.
      </Text>

      <TouchableOpacity style={[styles.card, { backgroundColor: BRAND.cobra }]} onPress={() => router.push('/cobracheck/reporte-cobrador' as any)}>
        <Text style={styles.cardIcon}>🎯</Text>
        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text style={styles.cardTitle}>Reporte Cobrador</Text>
          <Text style={styles.cardSub}>Cobros registrados en campo por cada cobrador</Text>
        </View>
        <Text style={styles.arrow}>›</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.card, { backgroundColor: BRAND.green }]} onPress={() => router.push('/cobracheck/pagos' as any)}>
        <Text style={styles.cardIcon}>💵</Text>
        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text style={styles.cardTitle}>Cobranza Directa</Text>
          <Text style={styles.cardSub}>Registra un pago recibido en oficina (efectivo, cheque, tarjeta)</Text>
        </View>
        <Text style={styles.arrow}>›</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.card, { backgroundColor: BRAND.blue }]} onPress={() => router.push('/cobracheck/transferencia' as any)}>
        <Text style={styles.cardIcon}>🏦</Text>
        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text style={styles.cardTitle}>Transferencia Bancaria</Text>
          <Text style={styles.cardSub}>Marca una factura como pagada por transferencia</Text>
        </View>
        <Text style={styles.arrow}>›</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  hint: { fontSize: 13, color: '#607D8B', marginBottom: 16, lineHeight: 18 },
  card: { borderRadius: 18, padding: 18, flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  cardIcon: { fontSize: 32 },
  cardTitle: { fontSize: 16, fontWeight: '800', color: '#fff', marginBottom: 4 },
  cardSub: { fontSize: 12, color: 'rgba(255,255,255,0.78)', lineHeight: 16 },
  arrow: { fontSize: 22, color: 'rgba(255,255,255,0.7)' },
});
