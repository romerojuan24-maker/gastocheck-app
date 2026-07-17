// Reportes — Supervisor / Admin / Dueño
import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, FlatList,
} from 'react-native';
import { BRAND } from '@gastocheck/shared';
import { supabase } from '../lib/supabase';
import { getActiveMembership } from '../lib/membership';
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
interface EmpleadoRow { user_id: string; nombre: string | null; total: number; count: number; con_cfdi: number; sin_cfdi: number }
interface FiscalKpi { con_total: number; con_count: number; sin_total: number; sin_count: number; validado: number; cancelado: number }
interface AnticipoRow { policy_id: string; nombre: string; holder: string | null; dias: number; entregado: number }
interface MesRow { mes: string; total: number; count: number }
interface CatProvRow { category: string; proveedores: { name: string; count: number; avg: number }[] }
interface IvaKpi { iva_total: number; iva_acreditable: number; cfdi_count: number; sin_tax: number }
interface AnomaliaRow { id: string; tipo: string; provider: string | null; amount: number; date: string; note: string }

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
  const [empleados,     setEmpleados]     = useState<EmpleadoRow[]>([]);
  const [fiscal,        setFiscal]        = useState<FiscalKpi | null>(null);
  const [anticipos,     setAnticipos]     = useState<AnticipoRow[]>([]);
  const [tendencia,     setTendencia]     = useState<MesRow[]>([]);
  const [catProveedores, setCatProveedores] = useState<CatProvRow[]>([]);
  const [iva,            setIva]            = useState<IvaKpi | null>(null);
  const [anomalias,      setAnomalias]      = useState<AnomaliaRow[]>([]);

  // Filtros gastos del mes
  const [fechaInicio, setFechaInicio] = useState(firstOfMonth);
  const [fechaFin,    setFechaFin]    = useState(today);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const m = await getActiveMembership(user.id);
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

  const loadEmpleados = useCallback(async () => {
    if (!companyId) return;
    setLoading(l => ({ ...l, empleados: true }));
    try {
      const { data } = await supabase
        .from('receipts')
        .select('uploaded_by, total_amount, fiscal_uuid')
        .eq('company_id', companyId)
        .not('status', 'in', '(deleted,duplicate,cancelled)')
        .gte('receipt_date', fechaInicio)
        .lte('receipt_date', fechaFin);

      const map: Record<string, { total: number; count: number; con_cfdi: number; sin_cfdi: number }> = {};
      (data ?? []).forEach((r: any) => {
        const k = r.uploaded_by ?? '_sin_usuario';
        if (!map[k]) map[k] = { total: 0, count: 0, con_cfdi: 0, sin_cfdi: 0 };
        map[k].total += r.total_amount ?? 0;
        map[k].count += 1;
        if (r.fiscal_uuid) map[k].con_cfdi++; else map[k].sin_cfdi++;
      });

      const uploaderIds = Object.keys(map).filter(id => id !== '_sin_usuario');
      let nameMap: Record<string, string> = {};
      if (uploaderIds.length) {
        const { data: profiles } = await supabase
          .from('profiles').select('id, full_name').in('id', uploaderIds);
        (profiles ?? []).forEach((p: any) => { nameMap[p.id] = p.full_name ?? ''; });
      }

      setEmpleados(
        Object.entries(map)
          .map(([user_id, v]) => ({ user_id, nombre: nameMap[user_id] ?? null, ...v }))
          .sort((a, b) => b.total - a.total),
      );
    } finally {
      setLoading(l => ({ ...l, empleados: false }));
    }
  }, [companyId, fechaInicio, fechaFin]);

  const loadFiscal = useCallback(async () => {
    if (!companyId) return;
    setLoading(l => ({ ...l, fiscal: true }));
    try {
      const { data } = await supabase
        .from('receipts')
        .select('total_amount, fiscal_uuid, sat_validation_status')
        .eq('company_id', companyId)
        .not('status', 'in', '(deleted,duplicate,cancelled)')
        .gte('receipt_date', fechaInicio)
        .lte('receipt_date', fechaFin);

      const kpi: FiscalKpi = { con_total: 0, con_count: 0, sin_total: 0, sin_count: 0, validado: 0, cancelado: 0 };
      (data ?? []).forEach((r: any) => {
        const amt = r.total_amount ?? 0;
        if (r.fiscal_uuid) {
          kpi.con_total += amt; kpi.con_count++;
          if (r.sat_validation_status === 'validated') kpi.validado++;
          else if (r.sat_validation_status === 'cancelled' || r.sat_validation_status === 'not_found') kpi.cancelado++;
        } else {
          kpi.sin_total += amt; kpi.sin_count++;
        }
      });
      setFiscal(kpi);
    } finally {
      setLoading(l => ({ ...l, fiscal: false }));
    }
  }, [companyId, fechaInicio, fechaFin]);

  const loadAnticipos = useCallback(async () => {
    if (!companyId) return;
    setLoading(l => ({ ...l, anticipos: true }));
    try {
      const { data: polData } = await supabase
        .from('policies')
        .select('id, name, holder_id, opening_balance, created_at')
        .eq('company_id', companyId)
        .eq('status', 'open')
        .order('created_at', { ascending: true });

      const ids = (polData ?? []).map((p: any) => p.id);
      const holderIds = [...new Set((polData ?? []).map((p: any) => p.holder_id).filter(Boolean))];

      const [advRes, profilesRes] = await Promise.all([
        ids.length
          ? supabase.from('advances').select('policy_id, amount').in('policy_id', ids)
          : Promise.resolve({ data: [] }),
        holderIds.length
          ? supabase.from('profiles').select('id, full_name').in('id', holderIds)
          : Promise.resolve({ data: [] }),
      ]);

      const advMap: Record<string, number> = {};
      ((advRes as any).data ?? []).forEach((a: any) => {
        advMap[a.policy_id] = (advMap[a.policy_id] ?? 0) + (a.amount ?? 0);
      });
      const nameMap: Record<string, string> = {};
      ((profilesRes as any).data ?? []).forEach((p: any) => { nameMap[p.id] = p.full_name ?? ''; });

      const hoy = new Date();
      setAnticipos(
        (polData ?? []).map((p: any) => {
          const dias = Math.floor((hoy.getTime() - new Date(p.created_at).getTime()) / 86400000);
          const entregado = (p.opening_balance ?? 0) + (advMap[p.id] ?? 0);
          return { policy_id: p.id, nombre: p.name, holder: nameMap[p.holder_id] ?? null, dias, entregado };
        }),
      );
    } finally {
      setLoading(l => ({ ...l, anticipos: false }));
    }
  }, [companyId]);

  const loadTendencia = useCallback(async () => {
    if (!companyId) return;
    setLoading(l => ({ ...l, tendencia: true }));
    try {
      const since = new Date();
      since.setMonth(since.getMonth() - 5);
      const sinceStr = `${since.getFullYear()}-${String(since.getMonth() + 1).padStart(2, '0')}-01`;

      const { data } = await supabase
        .from('receipts')
        .select('receipt_date, total_amount')
        .eq('company_id', companyId)
        .not('status', 'in', '(deleted,duplicate,cancelled)')
        .gte('receipt_date', sinceStr);

      const map: Record<string, { total: number; count: number }> = {};
      (data ?? []).forEach((r: any) => {
        const mes = r.receipt_date?.slice(0, 7) ?? '';
        if (!mes) return;
        if (!map[mes]) map[mes] = { total: 0, count: 0 };
        map[mes].total += r.total_amount ?? 0;
        map[mes].count += 1;
      });
      setTendencia(
        Object.entries(map)
          .map(([mes, v]) => ({ mes, ...v }))
          .sort((a, b) => a.mes.localeCompare(b.mes)),
      );
    } finally {
      setLoading(l => ({ ...l, tendencia: false }));
    }
  }, [companyId]);

  const loadCatProveedores = useCallback(async () => {
    if (!companyId) return;
    setLoading(l => ({ ...l, catProveedores: true }));
    try {
      const { data } = await supabase
        .from('receipts')
        .select('provider_name, total_amount, expense_categories(name)')
        .eq('company_id', companyId)
        .not('status', 'in', '(deleted,duplicate)')
        .not('provider_name', 'is', null);

      const catMap: Record<string, Record<string, { count: number; total: number }>> = {};
      (data ?? []).forEach((r: any) => {
        const cat  = (r.expense_categories as any)?.name ?? 'Sin categoría';
        const prov = r.provider_name as string;
        if (!catMap[cat]) catMap[cat] = {};
        if (!catMap[cat][prov]) catMap[cat][prov] = { count: 0, total: 0 };
        catMap[cat][prov].count += 1;
        catMap[cat][prov].total += r.total_amount ?? 0;
      });

      setCatProveedores(
        Object.entries(catMap)
          .map(([category, provMap]) => ({
            category,
            proveedores: Object.entries(provMap)
              .map(([name, v]) => ({ name, count: v.count, avg: v.count > 0 ? v.total / v.count : 0 }))
              .sort((a, b) => b.count - a.count)
              .slice(0, 3),
          }))
          .filter(c => c.proveedores.length > 0)
          .sort((a, b) =>
            b.proveedores.reduce((s, p) => s + p.count, 0) - a.proveedores.reduce((s, p) => s + p.count, 0),
          ),
      );
    } finally {
      setLoading(l => ({ ...l, catProveedores: false }));
    }
  }, [companyId]);

  const loadIva = useCallback(async () => {
    if (!companyId) return;
    setLoading(l => ({ ...l, iva: true }));
    try {
      const { data } = await supabase
        .from('receipts')
        .select('total_amount, tax_amount, sat_validation_status')
        .eq('company_id', companyId)
        .not('status', 'in', '(deleted,duplicate,cancelled)')
        .not('fiscal_uuid', 'is', null)
        .gte('receipt_date', fechaInicio)
        .lte('receipt_date', fechaFin);

      let iva_total = 0, iva_acreditable = 0, cfdi_count = 0, sin_tax = 0;
      (data ?? []).forEach((r: any) => {
        cfdi_count++;
        const tax = r.tax_amount ?? 0;
        if (tax > 0) {
          iva_total += tax;
          if (r.sat_validation_status === 'validated') iva_acreditable += tax;
        } else {
          sin_tax++;
        }
      });
      setIva({ iva_total, iva_acreditable, cfdi_count, sin_tax });
    } finally {
      setLoading(l => ({ ...l, iva: false }));
    }
  }, [companyId, fechaInicio, fechaFin]);

  const loadAnomalias = useCallback(async () => {
    if (!companyId) return;
    setLoading(l => ({ ...l, anomalias: true }));
    try {
      const { data } = await supabase
        .from('receipts')
        .select('id, provider_name, total_amount, receipt_date')
        .eq('company_id', companyId)
        .not('status', 'in', '(deleted,duplicate,cancelled)')
        .gte('receipt_date', fechaInicio)
        .lte('receipt_date', fechaFin);

      const amounts = (data ?? []).map((r: any) => r.total_amount ?? 0).filter((a: number) => a > 0);
      const avg = amounts.length > 3 ? amounts.reduce((s: number, a: number) => s + a, 0) / amounts.length : 0;

      const rows: AnomaliaRow[] = [];
      (data ?? []).forEach((r: any) => {
        const amt  = r.total_amount ?? 0;
        const date = r.receipt_date ?? '';
        const dow  = new Date(date + 'T12:00:00').getDay();

        if (dow === 0 || dow === 6) {
          rows.push({ id: r.id + '_wk', tipo: 'Fin de semana', provider: r.provider_name, amount: amt, date, note: 'Compra en día no hábil' });
        }
        if (amt >= 500 && amt % 500 === 0) {
          rows.push({ id: r.id + '_rnd', tipo: 'Monto redondo', provider: r.provider_name, amount: amt, date, note: `${money(amt)} — verificar recibo` });
        }
        if (avg > 0 && amt > avg * 5) {
          rows.push({ id: r.id + '_hi', tipo: 'Monto inusual', provider: r.provider_name, amount: amt, date, note: `${Math.round(amt / avg)}x el promedio del período` });
        }
      });

      setAnomalias(rows.sort((a, b) => b.amount - a.amount).slice(0, 25));
    } finally {
      setLoading(l => ({ ...l, anomalias: false }));
    }
  }, [companyId, fechaInicio, fechaFin]);

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
              label="Desde"
              value={fechaInicio}
              onChange={(d) => { setFechaInicio(d); }}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.filterLabel}>Hasta</Text>
            <DatePickerField
              label="Hasta"
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

      {/* ── 6. Gastos por empleado ── */}
      <Section
        title="👥 Gastos por empleado"
        subtitle="Quién gastó cuánto en el período"
        color="#00838F"
        open={open === 'empleados'}
        loading={loading.empleados}
        onToggle={() => toggle('empleados', loadEmpleados)}
      >
        {/* Nota: usa el mismo rango de fechas que "Gastos del mes" */}
        <Text style={[styles.rowMeta, { marginBottom: 8 }]}>
          Período: {fechaInicio} → {fechaFin}
        </Text>
        {empleados.length === 0
          ? <Empty text="Sin comprobantes en el período." />
          : (() => {
              const grandTotal = empleados.reduce((s, e) => s + e.total, 0);
              return empleados.map((e, i) => {
                const pct     = grandTotal > 0 ? Math.round((e.total / grandTotal) * 100) : 0;
                const pctCfdi = e.count > 0    ? Math.round((e.con_cfdi / e.count) * 100) : 0;
                return (
                  <View key={e.user_id} style={styles.row}>
                    <Text style={styles.rankNum}>{i + 1}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowTitle}>{e.nombre ?? '(sin nombre)'}</Text>
                      <Text style={styles.rowMeta}>
                        {e.count} comprobante{e.count !== 1 ? 's' : ''} · {pctCfdi}% con CFDI
                      </Text>
                      <View style={styles.barWrap}>
                        <View style={[styles.bar, { width: `${pct}%` as any, backgroundColor: '#00838F' }]} />
                      </View>
                    </View>
                    <View style={{ alignItems: 'flex-end', minWidth: 90 }}>
                      <Text style={styles.rowAmt}>{money(e.total)}</Text>
                      <Text style={styles.rowPct}>{pct}%</Text>
                    </View>
                  </View>
                );
              });
            })()
        }
      </Section>

      {/* ── 7. Exposición fiscal ── */}
      <Section
        title="🧾 Exposición fiscal"
        subtitle="Deducible vs no deducible en el período"
        color={BRAND.red}
        open={open === 'fiscal'}
        loading={loading.fiscal}
        onToggle={() => toggle('fiscal', loadFiscal)}
      >
        {!fiscal
          ? <Empty text="Sin datos en el período." />
          : (() => {
              const total   = fiscal.con_total + fiscal.sin_total;
              const pctCon  = total > 0 ? Math.round((fiscal.con_total / total) * 100) : 0;
              const pctSin  = total > 0 ? Math.round((fiscal.sin_total / total) * 100) : 0;
              return (
                <>
                  {/* Barra deducible/no-deducible */}
                  <View style={{ marginBottom: 16 }}>
                    <View style={styles.fiscalBarRow}>
                      <View style={[styles.fiscalBar, { flex: pctCon || 1, backgroundColor: BRAND.green }]} />
                      <View style={[styles.fiscalBar, { flex: pctSin || 0, backgroundColor: BRAND.red }]} />
                    </View>
                    <View style={styles.fiscalLegend}>
                      <Text style={[styles.fiscalLegendItem, { color: BRAND.green }]}>
                        ✅ {pctCon}% deducible
                      </Text>
                      <Text style={[styles.fiscalLegendItem, { color: BRAND.red }]}>
                        ⚠️ {pctSin}% en riesgo
                      </Text>
                    </View>
                  </View>

                  <View style={styles.row}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowTitle}>Con CFDI (deducible)</Text>
                      <Text style={styles.rowMeta}>{fiscal.con_count} comprobantes</Text>
                    </View>
                    <Text style={[styles.rowAmt, { color: BRAND.green }]}>{money(fiscal.con_total)}</Text>
                  </View>

                  <View style={styles.row}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowTitle}>Sin CFDI (no deducible)</Text>
                      <Text style={styles.rowMeta}>{fiscal.sin_count} comprobantes · riesgo fiscal</Text>
                    </View>
                    <Text style={[styles.rowAmt, { color: BRAND.red }]}>{money(fiscal.sin_total)}</Text>
                  </View>

                  {fiscal.cancelado > 0 && (
                    <View style={[styles.row, { borderBottomWidth: 0 }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.rowTitle}>CFDIs cancelados / no encontrados</Text>
                        <Text style={styles.rowMeta}>Requieren atención del proveedor</Text>
                      </View>
                      <Text style={[styles.rowAmt, { color: BRAND.orange }]}>{fiscal.cancelado}</Text>
                    </View>
                  )}
                </>
              );
            })()
        }
      </Section>

      {/* ── 8. Anticipos pendientes de comprobación ── */}
      <Section
        title="💰 Anticipos sin comprobar"
        subtitle="Dinero entregado en pólizas aún abiertas"
        color={BRAND.orange}
        open={open === 'anticipos'}
        loading={loading.anticipos}
        onToggle={() => toggle('anticipos', loadAnticipos)}
      >
        {anticipos.length === 0
          ? <Empty text="Sin pólizas abiertas con anticipo pendiente." />
          : (() => {
              const totalPendiente = anticipos.reduce((s, a) => s + a.entregado, 0);
              return (
                <>
                  <View style={styles.totalBanner}>
                    <Text style={styles.totalBannerLabel}>Total sin comprobar</Text>
                    <Text style={[styles.totalBannerAmt, { color: BRAND.orange }]}>{money(totalPendiente)}</Text>
                  </View>
                  {anticipos.map((a) => (
                    <View key={a.policy_id} style={styles.row}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.rowTitle}>{a.nombre}</Text>
                        <Text style={styles.rowMeta}>
                          {a.holder ?? 'Sin titular'} · {a.dias} día{a.dias !== 1 ? 's' : ''} abierta
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={[styles.rowAmt, { color: a.dias > 10 ? BRAND.red : BRAND.navy }]}>
                          {money(a.entregado)}
                        </Text>
                        {a.dias > 10 && (
                          <Text style={{ fontSize: 10, color: BRAND.red, fontWeight: '700' }}>⚠ vencida</Text>
                        )}
                      </View>
                    </View>
                  ))}
                </>
              );
            })()
        }
      </Section>

      {/* ── 9. Tendencia mensual ── */}
      <Section
        title="📈 Tendencia mensual"
        subtitle="Gasto total de los últimos 6 meses"
        color={BRAND.blue}
        open={open === 'tendencia'}
        loading={loading.tendencia}
        onToggle={() => toggle('tendencia', loadTendencia)}
      >
        {tendencia.length === 0
          ? <Empty text="Sin datos de los últimos 6 meses." />
          : (() => {
              const maxTotal = Math.max(...tendencia.map(m => m.total));
              return tendencia.map((m) => {
                const pct = maxTotal > 0 ? Math.round((m.total / maxTotal) * 100) : 0;
                const [y, mo] = m.mes.split('-');
                const label = new Date(parseInt(y), parseInt(mo) - 1, 1)
                  .toLocaleString('es-MX', { month: 'short', year: '2-digit' });
                return (
                  <View key={m.mes} style={styles.row}>
                    <View style={{ width: 52 }}>
                      <Text style={[styles.rowTitle, { fontSize: 12, textTransform: 'capitalize' }]}>{label}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.barWrap}>
                        <View style={[styles.bar, { width: `${pct}%` as any, backgroundColor: BRAND.blue }]} />
                      </View>
                      <Text style={[styles.rowMeta, { marginTop: 3 }]}>{m.count} comprobante{m.count !== 1 ? 's' : ''}</Text>
                    </View>
                    <Text style={[styles.rowAmt, { marginLeft: 8 }]}>{money(m.total)}</Text>
                  </View>
                );
              });
            })()
        }
      </Section>

      {/* ── 10. Top 3 proveedores por categoría ── */}
      <Section
        title="🏆 Proveedores por categoría"
        subtitle="Top 3 proveedores estrella en cada tipo de gasto"
        color="#7B1FA2"
        open={open === 'catProveedores'}
        loading={loading.catProveedores}
        onToggle={() => toggle('catProveedores', loadCatProveedores)}
      >
        {catProveedores.length === 0
          ? <Empty text="Sin datos de proveedores categorizados." />
          : catProveedores.map(c => (
              <View key={c.category} style={{ marginBottom: 16 }}>
                <Text style={[styles.rowTitle, { color: '#7B1FA2', marginBottom: 6 }]}>
                  {c.category}
                </Text>
                {c.proveedores.map((p, i) => (
                  <View key={p.name} style={[styles.row, i === c.proveedores.length - 1 && { borderBottomWidth: 0 }]}>
                    <Text style={styles.rankNum}>{i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowTitle}>{p.name}</Text>
                      <Text style={styles.rowMeta}>{p.count} compra{p.count !== 1 ? 's' : ''}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.rowAmt}>{money(p.avg)}</Text>
                      <Text style={styles.rowMeta}>ticket prom.</Text>
                    </View>
                  </View>
                ))}
              </View>
            ))
        }
      </Section>

      {/* ── 11. IVA acreditable ── */}
      <Section
        title="🧮 IVA acreditable"
        subtitle="Estimado de IVA recuperable con CFDI validado"
        color={BRAND.green}
        open={open === 'iva'}
        loading={loading.iva}
        onToggle={() => toggle('iva', loadIva)}
      >
        {!iva
          ? <Empty text="Sin CFDIs en el período." />
          : (
              <>
                <Text style={[styles.rowMeta, { marginBottom: 10 }]}>
                  Período: {fechaInicio} → {fechaFin} · {iva.cfdi_count} CFDIs analizados
                </Text>
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>IVA total de CFDIs</Text>
                    <Text style={styles.rowMeta}>{iva.cfdi_count} comprobantes con CFDI</Text>
                  </View>
                  <Text style={styles.rowAmt}>{money(iva.iva_total)}</Text>
                </View>
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>IVA acreditable (SAT validado)</Text>
                    <Text style={styles.rowMeta}>CFDIs con estatus "validado"</Text>
                  </View>
                  <Text style={[styles.rowAmt, { color: BRAND.green }]}>{money(iva.iva_acreditable)}</Text>
                </View>
                {iva.iva_total > iva.iva_acreditable && (
                  <View style={[styles.row, { borderBottomWidth: iva.sin_tax > 0 ? 1 : 0 }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowTitle}>IVA pendiente de validar</Text>
                      <Text style={styles.rowMeta}>Envía a validar SAT para acreditar</Text>
                    </View>
                    <Text style={[styles.rowAmt, { color: BRAND.orange }]}>{money(iva.iva_total - iva.iva_acreditable)}</Text>
                  </View>
                )}
                {iva.sin_tax > 0 && (
                  <Text style={[styles.emptyText, { paddingVertical: 8 }]}>
                    ℹ️ {iva.sin_tax} CFDI{iva.sin_tax !== 1 ? 's' : ''} sin desglose de IVA — solicita el XML al proveedor.
                  </Text>
                )}
              </>
            )
        }
      </Section>

      {/* ── 12. Alertas de revisión ── */}
      <Section
        title="⚠️ Alertas de revisión"
        subtitle="Gastos en fin de semana, montos redondos o inusuales"
        color={BRAND.red}
        open={open === 'anomalias'}
        loading={loading.anomalias}
        onToggle={() => toggle('anomalias', loadAnomalias)}
      >
        {anomalias.length === 0
          ? <Empty text="Sin alertas en el período. ¡Todo parece normal!" />
          : (
              <>
                <Text style={[styles.rowMeta, { marginBottom: 8 }]}>
                  {anomalias.length} alerta{anomalias.length !== 1 ? 's' : ''} detectada{anomalias.length !== 1 ? 's' : ''}
                </Text>
                {anomalias.map(a => (
                  <View key={a.id} style={styles.row}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                        <View style={[styles.badge, { backgroundColor: BRAND.red + '15' }]}>
                          <Text style={[styles.badgeText, { color: BRAND.red }]}>{a.tipo}</Text>
                        </View>
                      </View>
                      <Text style={styles.rowTitle}>{a.provider ?? '(sin proveedor)'}</Text>
                      <Text style={styles.rowMeta}>{a.date} · {a.note}</Text>
                    </View>
                    <Text style={[styles.rowAmt, { color: BRAND.red }]}>{money(a.amount)}</Text>
                  </View>
                ))}
              </>
            )
        }
      </Section>

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

  fiscalBarRow:    { flexDirection: 'row', height: 14, borderRadius: 7, overflow: 'hidden', marginBottom: 8 },
  fiscalBar:       { height: 14 },
  fiscalLegend:    { flexDirection: 'row', justifyContent: 'space-between' },
  fiscalLegendItem:{ fontSize: 12, fontWeight: '700' },
});
