// Herramientas — contenido diferenciado por rol
import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { BRAND } from '@gastocheck/shared';
import { supabase } from '../lib/supabase';

const REPORT_ROLES    = ['owner', 'admin', 'supervisor'];
const EXTENDED_ROLES  = ['owner', 'admin', 'supervisor'];  // Eventos, Relaciones

function ToolBtn({ icon, title, hint, onPress, accent }: {
  icon: string; title: string; hint: string;
  onPress: () => void; accent?: string;
}) {
  return (
    <TouchableOpacity
      style={[styles.toolBtn, accent && { borderLeftWidth: 4, borderLeftColor: accent }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={styles.toolIcon}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.toolTitle}>{title}</Text>
        <Text style={styles.toolHint}>{hint}</Text>
      </View>
      <Text style={styles.arrow}>›</Text>
    </TouchableOpacity>
  );
}

export default function HerramientasScreen() {
  const router = useRouter();
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: m } = await supabase
        .from('company_members')
        .select('role')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle();
      if (m?.role) setUserRole(m.role);
    })();
  }, []);

  const canSeeReports   = userRole && REPORT_ROLES.includes(userRole);
  const canSeeExtended  = userRole && EXTENDED_ROLES.includes(userRole);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: BRAND.gray }}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
    >

      {/* ── Reportes (supervisor / admin / dueño) ── */}
      {canSeeReports && (
        <>
          <Text style={styles.sectionTitle}>Reportes</Text>
          <ToolBtn
            icon="📊"
            title="Reportes de operación"
            hint="Pólizas, compras por tipo, gastos del mes, proveedores y flotilla"
            accent={BRAND.navy}
            onPress={() => router.push('/reportes' as any)}
          />
        </>
      )}

      {/* ── Consulta de proveedores (todos los roles) ── */}
      <Text style={[styles.sectionTitle, canSeeReports && { marginTop: 20 }]}>
        Consultas
      </Text>
      <ToolBtn
        icon="🔍"
        title="¿Dónde compro?"
        hint="Proveedores y precios de compras anteriores de la empresa"
        accent={BRAND.green}
        onPress={() => router.push('/item-search' as any)}
      />

      {/* ── Módulos extendidos (supervisor / admin / dueño) ── */}
      {canSeeExtended && (
        <>
          <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Módulos</Text>
          <ToolBtn
            icon="📅"
            title="Eventos y viáticos"
            hint="Controla el presupuesto de cada evento o comisión"
            accent={BRAND.blue}
            onPress={() => router.push('/events' as any)}
          />
          <ToolBtn
            icon="📁"
            title="Relaciones de gastos"
            hint="Agrupaciones de comprobantes para contabilidad"
            accent={BRAND.orange}
            onPress={() => router.push('/batches' as any)}
          />
        </>
      )}

      {/* ── Configuración (todos los roles) ── */}
      <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Configuración</Text>
      <ToolBtn
        icon="💸"
        title="Solicitar anticipo"
        hint="Pide un anticipo a tu jefe o administrador"
        onPress={() => router.push('/advance-request' as any)}
      />
      <ToolBtn
        icon="⚙️"
        title="Ajustes generales"
        hint="Cuenta, notificaciones, versión y actualizaciones"
        onPress={() => router.push('/settings')}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: 12, fontWeight: '800', color: '#90A4AE',
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10,
  },
  toolBtn: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16,
    flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8,
    borderWidth: 1, borderColor: '#F0F0F0',
    elevation: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 3,
  },
  toolIcon:  { fontSize: 28 },
  toolTitle: { fontSize: 15, fontWeight: '700', color: BRAND.navy },
  toolHint:  { fontSize: 12, color: '#90A4AE', marginTop: 2 },
  arrow:     { fontSize: 22, color: '#B0BEC5' },
});
