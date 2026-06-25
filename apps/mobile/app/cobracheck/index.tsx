import { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useNavigation } from '@react-navigation/native';
import { BRAND } from '@gastocheck/shared';

export default function CobraCheckHome() {
  const router     = useRouter();
  const navigation = useNavigation();

  useEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: BRAND.gray }}
      contentContainerStyle={{ paddingBottom: 40 }}
    >
      {/* ── Header CobraCheck ── */}
      <View style={styles.header}>
        <View style={styles.circleTopRight} />
        <View style={styles.circleBottomLeft} />

        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.replace('/')}
          activeOpacity={0.7}
        >
          <Text style={styles.backBtnText}>‹ CHECK SUITE</Text>
        </TouchableOpacity>

        <View style={styles.brandRow}>
          <View style={styles.icon}>
            <Text style={styles.iconText}>🎯</Text>
          </View>
          <View style={{ marginLeft: 14 }}>
            <Text style={styles.brandTitle}>CobraCheck</Text>
            <Text style={styles.brandTagline}>Controla lo que te deben</Text>
          </View>
        </View>
      </View>

      <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
        <MenuBtn
          icon="🗺️"
          label="Mi ruta de hoy"
          hint="Ruta optimizada de cobros del día"
          bg={BRAND.cobra}
          textColor="#fff"
          onPress={() => router.push('/cobracheck/mi-ruta' as any)}
          large
        />
        <MenuBtn
          icon="📋"
          label="Tareas diarias"
          hint="Facturas a cobrar hoy"
          onPress={() => router.push('/cobracheck/tareas-diarias' as any)}
        />
        <MenuBtn
          icon="👤"
          label="Clientes"
          hint="Cartera asignada y saldos"
          onPress={() => router.push('/cobracheck/clientes' as any)}
        />
        <MenuBtn
          icon="📜"
          label="Historial de cobros"
          hint="Movimientos registrados"
          onPress={() => router.push('/cobracheck/historial' as any)}
        />
      </View>
    </ScrollView>
  );
}

function MenuBtn({
  icon, label, hint, onPress, bg, textColor, large = false,
}: {
  icon: string; label: string; hint: string;
  onPress: () => void; bg?: string; textColor?: string; large?: boolean;
}) {
  const bgColor = bg ?? '#fff';
  const tc = textColor ?? BRAND.navy;
  const hc = textColor ? 'rgba(255,255,255,0.75)' : '#90A4AE';
  const arrowColor = textColor ?? BRAND.cobra;
  return (
    <TouchableOpacity
      style={[styles.menuBtn, large && styles.menuBtnLarge, { backgroundColor: bgColor }]}
      onPress={onPress}
      activeOpacity={0.82}
    >
      <Text style={[styles.menuBtnIcon, large && { fontSize: 36 }]}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={[styles.menuBtnLabel, { color: tc }, large && { fontSize: 19 }]}>{label}</Text>
        <Text style={[styles.menuBtnHint, { color: hc }]}>{hint}</Text>
      </View>
      <Text style={{ fontSize: 22, color: arrowColor }}>›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: BRAND.cobra,
    paddingTop: 58, paddingBottom: 26, paddingHorizontal: 20,
    overflow: 'hidden', position: 'relative',
  },
  circleTopRight: {
    position: 'absolute', top: -40, right: -40,
    width: 160, height: 160, borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  circleBottomLeft: {
    position: 'absolute', bottom: -30, left: -30,
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  backBtn:     { position: 'absolute', top: 58, left: 16, padding: 8 },
  backBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },

  brandRow:    { flexDirection: 'row', alignItems: 'center', marginTop: 18 },
  icon:        { width: 52, height: 52, borderRadius: 14, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  iconText:    { fontSize: 26 },
  brandTitle:  { fontSize: 24, fontWeight: '900', color: '#fff' },
  brandTagline:{ fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 2 },

  menuBtn: {
    borderRadius: 16, padding: 16, marginTop: 10,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    elevation: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07, shadowRadius: 4,
  },
  menuBtnLarge: { padding: 20, marginTop: 12 },
  menuBtnIcon:  { fontSize: 28 },
  menuBtnLabel: { fontSize: 16, fontWeight: '700' },
  menuBtnHint:  { fontSize: 12, marginTop: 2 },
});
