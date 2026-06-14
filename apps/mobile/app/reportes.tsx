// Reportes — Supervisor / Admin / Dueño
import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, FlatList,
} from 'react-native';
import { BRAND } from '@gastocheck/shared';
import { supabase } from '../lib/supabase';
import DatePickerField from '../components/DatePickerField';

const money = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n ?? 0);

const now = new Date();
const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
const today = now.toISOString().slice(0, 10);

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface Poliza {
  id: string; name: string; status: string; policy_type: string;
  opening_balance: number; total_advances: number; holder_name: string | null;
}
interface ComprasTipo { category: string; total: number; count: number }
interface GastoRow { id: string; provider_name: string | null; total_amount: number; receipt_date: string; category: string | null; buyer: string | null }
interface ProveedorRow { provider_name: string; total: number; count: number }
interface UnidadRow { vehicle_alias: string; vehicle_type: string; total: number; count: number }

// ── Componente ────────────────────────────────────────────────────────────────

export default function ReportesScreen() {
  const [companyId,    setCompanyId]    = useState<string | null>(null);
  const [tieneFlotilla, setTieneFlotilla] = useState(false);
  const [open,         setOpen]         = useState<string | null>(null);
  const [loading,      setLoading]      = useState<Record<string, boolean>>({});

  // Data states
  const [polizas,       setPolizas]       = useState<Poliza[]>([]);
  const [comprasTipo,   setComprasTipo]   = useState<ComprasTipo[]>([]);
  const [gastos,        setGastos]        = useState<GastoRow[]>([]);
  const [proveedores,   setProveedores]   = useState<ProveedorRow[]>([]);
  const [unidades,      setUnidades]      = useState<UnidadRow[]>([]);

  // Filtros gastos del mes
  const [fechaInicio, setFechaInicio] = useState(firstOfMonth);
  const [fechaFin,    setFechaFin]    = useState(today);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: m } = await supabase
        .from('company_members').select('company_id').eq('user_id', user.id).maybeSingle();
      if (!m) return;
      setCompanyId(m.company_id);
      const { data: co } = await supabase
        .from('companies').select('tiene_flotilla').eq('id', m.company_id).maybeSingle();
      setTieneFlotilla(co?.tiene_flotilla ?? false);
    })();
  }, []);

  // ── Loaders ──────────────────────────────────────────────────────────────────

  const loadPolizas = useCallback(async () => {
    if (!companyId) return;
    setLoading(l => ({ ...l, polizas: true }));
    try {
      const { data } = await supabase
        .from('policies')
        .select('id, name, status, policy_type, opening_balance, holder_id')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(50);

      const holderIds = [...new Set((data ?? []).map((p: any) => p.holder_id).filter(Boolean))];
      let nameMap: Record<string, string> = {};
      if (holderIds.length) {
        const { data: profiles } = await supabase
          .from('profiles').select('id, full_name').in('id', holderIds);
        (profiles ?? []).forEach((p: any) => { nameMap[p.id] = p.full_name ?? ''; });
      }

      // Sumar anticipos por póliza
      const ids = (data ?? []).map((p: any) => p.id);
      const { data: advances } = ids.length
        ? await supabase.from('advances').select('policy_id, amount').in('policy_id', ids)
        : { data: [] };
      const advMap: Record<string, number> = {};
      (advances ?? []).forEach((a: any) => {
        advMap[a.policy_id] = (advMap[a.policy_id] ?? 0) + (a.amount ?? 0);
      });

      setPolizas((data ?? []).map((p: any) => ({
        ...p,
        holder_name:    nameMap[p.holder_id] ?? null,
        total_advances: advMap[p.id] ?? 0,
      })));
    } finally {
      setLoading(l => ({ ...l, polizas: false }));
    }
  }, [companyId]);

  const loadComprasTipo = useCallback(async () => {
    if (!companyId) return;
    setLoading(l => ({ ...l, comprasTipo: true }));
    try {
      const { data } = await supabase
        .from('receipts')
        .select('total_amount, expense_categories(name)')
        .eq('company_id', companyId)
        .not('status', 'in', '(deleted,duplicate)');

      const map: Record<string, { total: number; count: number }> = {};
      (data ?? []).forEach((r: any) => {
        const cat = (r.expense_categories as any)?.name ?? 'Sin categoría';
        if (!map[cat]) map[cat] = { total: 0, count: 0 };
        map[cat].total += r.total_amount ?? 0;
        map[cat].count += 1;
      });
      setComprasTipo(
        Object.entries(map)
          .map(([category, v]) => ({ category, ...v }))
          .sort((a, b) => b.total - a.total),
      );
    } finally {
      setLoading(l => ({ ...l, comprasTipo: false }));
    }
  }, [companyId]);

  const loadGastos = useCallback(async () => {
    if (!companyId) return;
    setLoading(l => ({ ...l, gastos: true }));
    try {
      const { data } = await supabase
        .from('receipts')
        .select('id, provider_name, total_amount, receipt_date, uploaded_by, expense_categories(name)')
        .eq('company_id', companyId)
        .not('status', 'in', '(deleted,duplicate)')
        .gte('receipt_date', fechaInicio)
        .lte('receipt_date', fechaFin)
        .order('receipt_date', { ascending: false })
        .limit(100);

      const uploaderIds = [...new Set((data ?? []).map((r: any) => r.uploaded_by).filter(Boolean))];
      let buyerMap: Record<string, string> = {};
      if (uploaderIds.length) {
        const { data: profiles } = await supabase
          .from('profiles').select('id, full_name').in('id', uploaderIds);
        (profiles ?? []).forEach((p: any) => { buyerMap[p.id] = p.full_name ?? ''; });
      }

      setGastos((data ?? []).map((r: any) => ({
        id:            r.id,
        provider_name: r.provider_name,
        total_amount:  r.total_amount,
        receipt_date:  r.receipt_date,
        category:      (r.expense_categories as any)?.name ?? null,
        buyer:         buyerMap[r.uploaded_by] ?? null,
      })));
    } finally {
      setLoading(l => ({ ...l, gastos: false }));
    }
  }, [companyId, fechaInicio, fechaFin]);

  const loadProveedores = useCallback(async () => {
    if (!companyId) return;
    setLoading(l => ({ ...l, proveedores: true }));
    try {
      const { data } = await supabase
        .from('receipts')
        .select('provider_name, total_amount')
        .eq('company_id', companyId)
        .not('status', 'in', '(deleted,duplicate)')
        .not('provider_name', 'is', null);

      const map: Record<string, { total: number; count: number }> = {};
      (data ?? []).forEach((r: any) => {
        const k = r.provider_name as string;
        if (!map[k]) map[k] = { total: 0, count: 0 };
        map[k].total += r.total_amount ?? 0;
        map[k].count += 1;
      });
      setProveedores(
        Object.entries(map)
          .map(([provider_name, v]) => ({ provider_name, ...v }))
          .sort((a, b) => b.total - a.total)
          .slice(0, 30),
      );
    } finally {
      setLoading(l => ({ ...l, proveedores: false }));
    }
  }, [companyId]);

  const loadUnidades = useCallback(async () => {
    if (!companyId) return;
    setLoading(l => ({ ...l, unidades: true }));
    try {
      const { data } = await supabase
        .from('receipts')
        .select('total_amount, vehicles(alias, vehicle_type)')
        .eq('company_id', companyId)
        .not('status', 'in', '(deleted,duplicate)')
        .not('vehicle_id', 'is', null);

      const map: Record<string, { type: string; total: number; count: number }> = {};
      (data ?? []).forEach((r: any) => {
        const v = r.vehicles as any;
        const alias = v?.alias ?? 'Sin alias';
        const type  = v?.vehicle_type ?? 'otro';
        if (!map[alias]) map[alias] = { type, total: 0, count: 0 };
        map[alias].total += r.total_amount ?? 0;
        map[alias].count += 1;
      });
      setUnidades(
        Object.entries(map)
          .map(([vehicle_alias, v]) => ({ vehicle_alias, vehicle_type: v.type, total: v.total, count: v.count }))
          .sort((a, b) => b.total - a.total),
      );
    } finally {
      setLoading(l => ({ ...l, unidades: false }));
    }
  }, [companyId]);

  // Abrir sección
  function toggle(key: string, loader: () => void) {
    if (open === key) { setOpen(null); return; }
    setOpen(key);
    loader();
  }

  const totalGastos = gastos.reduce((s, g) => s + g.total_amount, 0);
  const totalProveedores = proveedores.reduce((s, p) => s + p.total, 0);

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <ScrollView style={{ flex: 1, backgroundColor: BRAND.gray }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>

      {/* ── 1. Pólizas ── */}
      <Section
        title="📋 Pólizas"
        subtitle="Estado actual de todas las pólizas"
        color={BRAND.blue}
        open={open === 'polizas'}
        loading={loading.polizas}
        onToggle={() => toggle('polizas', loadPolizas)}
      >
        {polizas.length === 0
          ? <Empty text="Sin pólizas registradas." />
          : polizas.map((p) => (
              <View key={p.id} style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{p.name}</Text>
                  <Text style={styles.rowMeta}>
                    {p.holder_name ?? '—'} · {p.policy_type === 'anticipo' ? 'Anticipo' : 'Gasto'}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <StatusBadge status={p.status} />
                  <Text style={styles.rowAmt}>{money(p.total_advances)}</Text>
                </View>
              </View>
            ))
        }
      </Section>

      {/* ── 2. Compras por tipo ── */}
      <Section
        title="🗂️ Compras por tipo"
        subtitle="Total por categoría de gasto"
        color={BRAND.purple}
        open={open === 'comprasTipo'}
        loading={loading.comprasTipo}
        onToggle={() => toggle('comprasTipo', loadComprasTipo)}
      >
        {comprasTipo.length === 0
          ? <Empty text="Sin comprobantes categorizados." />
          : comprasTipo.map((c) => {
              const grand = comprasTipo.reduce((s, x) => s + x.total, 0);
              const pct   = grand > 0 ? Math.round((c.total / grand) * 100) : 0;
              return (
                <View key={c.category} style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>{c.category}</Text>
                    <Text style={styles.rowMeta}>{c.count} comprobante{c.count !== 1 ? 's' : ''}</Text>
                    <View style={styles.barWrap}>
                      <View style={[styles.bar, { width: `${pct}%` as any, backgroundColor: BRAND.purple }]} />
                    </View>
                  </View>
                  <View style={{ alignItems: 'flex-end', minWidth: 90 }}>
                    <Text style={styles.rowAmt}>{money(c.total)}</Text>
                    <Text style={styles.rowPct}>{pct}%</Text>
                  </View>
                </View>
              );
            })
        }
      </Section>

      {/* ── 3. Gastos del mes ── */}
      <Section
        title="📅 Gastos del mes"
        subtitle="Comprobantes en el rango de fechas"
        color={BRAND.green}
        open={open === 'gastos'}
        loading={loading.gastos}
        onToggle={() => toggle('gastos', loadGastos)}
      >
        {/* Filtros */}
        <View style={styles.filterRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.filterLabel}>Desde</Text>
            <DatePickerField
              value={fechaInicio}
              onChange={(d) => { setFechaInicio(d); }}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.filterLabel}>Hasta</Text>
            <DatePickerField
              value={fechaFin}
              onChange={(d) => { setFechaFin(d); }}
            />
          </View>
          <TouchableOpacity style={styles.filterBtn} onPress={loadGastos}>
            <Text style={styles.filterBtnText}>Buscar</Text>
          </TouchableOpacity>
        </View>

        {gastos.length === 0
          ? <Empty text="Sin gastos en el período seleccionado." />
          : (
              <>
                <View style={styles.totalBanner}>
                  <Text style={styles.totalBannerLabel}>{gastos.length} comprobantes</Text>
                  <Text style={styles.totalBannerAmt}>{money(totalGastos)}</Text>
                </View>
                {gastos.map((g) => (
                  <View key={g.id} style={styles.row}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowTitle}>{g.provider_name ?? '(sin nombre)'}</Text>
                      <Text style={styles.rowMeta}>
                        {g.receipt_date}{g.buyer ? `  ·  ${g.buyer}` : ''}
                      </Text>
                      {g.category && <Text style={styles.rowTag}>{g.category}</Text>}
                    </View>
                    <Text style={styles.rowAmt}>{money(g.total_amount)}</Text>
                  </View>
                ))}
              </>
            )
        }
      </Section>

      {/* ── 4. Relación de proveedores ── */}
      <Section
        title="🏪 Relación de proveedores"
        subtitle="Ranking por monto total comprado"
        color={BRAND.orange}
        open={open === 'proveedores'}
        loading={loading.proveedores}
        onToggle={() => toggle('proveedores', loadProveedores)}
      >
        {proveedores.length === 0
          ? <Empty text="Sin proveedores registrados." />
          : (
              <>
                <View style={styles.totalBanner}>
                  <Text style={styles.totalBannerLabel}>{proveedores.length} proveedores</Text>
                  <Text style={styles.totalBannerAmt}>{money(totalProveedores)}</Text>
                </View>
                {proveedores.map((p, i) => {
                  const pct = totalProveedores > 0 ? Math.round((p.total / totalProveedores) * 100) : 0;
                  return (
                    <View key={p.provider_name} style={styles.row}>
                      <Text style={styles.rankNum}>{i + 1}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.rowTitle}>{p.provider_name}</Text>
                        <Text style={styles.rowMeta}>{p.count} compra{p.count !== 1 ? 's' : ''}</Text>
                        <View style={styles.barWrap}>
                          <View style={[styles.bar, { width: `${pct}%` as any, backgroundColor: BRAND.orange }]} />
                        </View>
                      </View>
                      <View style={{ alignItems: 'flex-end', minWidth: 90 }}>
                        <Text style={styles.rowAmt}>{money(p.total)}</Text>
                        <Text style={styles.rowPct}>{pct}%</Text>
                      </View>
                    </View>
                  );
                })}
              </>
            )
        }
      </Section>

      {/* ── 5. Control por unidad (solo si tiene flotilla) ── */}
      {tieneFlotilla && (
        <Section
          title="🚛 Control por unidad"
          subtitle="Gastos asignados por vehículo / unidad"
          color={BRAND.navy}
          open={open === 'unidades'}
          loading={loading.unidades}
          onToggle={() => toggle('unidades', loadUnidades)}
        >
          {unidades.length === 0
            ? <Empty text="Sin gastos asignados a unidades." />
            : unidades.map((u, i) => (
                <View key={u.vehicle_alias} style={styles.row}>
                  <Text style={styles.rankNum}>{i + 1}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>{u.vehicle_alias}</Text>
                    <Text style={styles.rowMeta}>{u.vehicle_type} · {u.count} registro{u.count !== 1 ? 's' : ''}</Text>
                  </View>
                  <Text style={styles.rowAmt}>{money(u.total)}</Text>
                </View>
              ))
          }
        </Section>
      )}

    </ScrollView>
  );
}

// ── Sub-componentes ────────────────────────────────────────────────────────────

function Section({
  title, subtitle, color, open, loading, onToggle, children,
}: {
  title: string; subtitle: string; color: string;
  open: boolean; loading: boolean;
  onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <View style={[styles.section, open && { borderColor: color }]}>
      <TouchableOpacity style={styles.sectionHeader} onPress={onToggle} activeOpacity={0.8}>
        <View style={[styles.sectionAccent, { backgroundColor: color }]} />
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionTitle}>{title}</Text>
          <Text style={styles.sectionSub}>{subtitle}</Text>
        </View>
        <Text style={[styles.chevron, open && { transform: [{ rotate: '90deg' }] }]}>›</Text>
      </TouchableOpacity>
      {open && (
        <View style={styles.sectionBody}>
          {loading
            ? <ActivityIndicator color={color} style={{ marginVertical: 20 }} />
            : children}
        </View>
      )}
    </View>
  );
}

function Empty({ text }: { text: string }) {
  return <Text style={styles.emptyText}>{text}</Text>;
}

const STATUS_COLOR: Record<string, string> = {
  open:   BRAND.green,
  closed: '#90A4AE',
  draft:  BRAND.orange,
};
function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLOR[status] ?? '#90A4AE';
  const label = status === 'open' ? 'Abierta' : status === 'closed' ? 'Cerrada' : 'Borrador';
  return (
    <View style={[styles.badge, { backgroundColor: color + '20' }]}>
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: '#fff', borderRadius: 16, marginBottom: 12,
    borderWidth: 1.5, borderColor: '#E8ECF0', overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12,
  },
  sectionAccent: { width: 4, height: 36, borderRadius: 2 },
  sectionTitle:  { fontSize: 15, fontWeight: '800', color: BRAND.navy },
  sectionSub:    { fontSize: 12, color: '#90A4AE', marginTop: 2 },
  chevron:       { fontSize: 24, color: '#B0BEC5', fontWeight: '700' },
  sectionBody:   { paddingHorizontal: 16, paddingBottom: 16 },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
  },
  rowTitle: { fontSize: 14, fontWeight: '600', color: BRAND.navy },
  rowMeta:  { fontSize: 11, color: '#90A4AE', marginTop: 2 },
  rowAmt:   { fontSize: 14, fontWeight: '700', color: BRAND.navy },
  rowPct:   { fontSize: 11, color: '#90A4AE', marginTop: 2 },
  rowTag:   {
    alignSelf: 'flex-start', marginTop: 4, fontSize: 10, fontWeight: '600',
    color: BRAND.blue, backgroundColor: BRAND.blue + '15',
    borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2,
  },

  rankNum:  { width: 24, fontSize: 13, fontWeight: '800', color: '#B0BEC5', textAlign: 'center' },

  barWrap: { height: 4, backgroundColor: '#F0F0F0', borderRadius: 2, marginTop: 6, width: '100%' },
  bar:     { height: 4, borderRadius: 2, minWidth: 4 },

  filterRow:    { flexDirection: 'row', gap: 8, alignItems: 'flex-end', marginBottom: 12 },
  filterLabel:  { fontSize: 10, fontWeight: '700', color: '#90A4AE', textTransform: 'uppercase', marginBottom: 4 },
  filterBtn:    { backgroundColor: BRAND.blue, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  filterBtnText:{ color: '#fff', fontWeight: '700', fontSize: 13 },

  totalBanner: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: BRAND.gray, borderRadius: 10, padding: 12, marginBottom: 8,
  },
  totalBannerLabel: { fontSize: 12, color: '#90A4AE', fontWeight: '600' },
  totalBannerAmt:   { fontSize: 16, fontWeight: '800', color: BRAND.navy },

  badge:     { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 4 },
  badgeText: { fontSize: 11, fontWeight: '700' },

  emptyText: { fontSize: 13, color: '#90A4AE', textAlign: 'center', paddingVertical: 20 },
});
