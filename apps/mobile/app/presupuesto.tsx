// Presupuesto mensual por empleado — admin establece límites de gasto
import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, TextInput, Alert, Modal,
} from 'react-native';
import { BRAND } from '@gastocheck/shared';
import { supabase } from '../lib/supabase';
import DatePickerField from '../components/DatePickerField';

const money = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n ?? 0);

const now = new Date();
const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

interface BudgetItem {
  user_id:   string;
  full_name: string | null;
  role:      string;
  budget:    number | null;
  spent:     number;
  budget_id: string | null;
}

export default function PresupuestoScreen() {
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [periodo, setPeriodo] = useState(firstOfMonth);
  const [items,   setItems]   = useState<BudgetItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<BudgetItem | null>(null);
  const [newAmount, setNewAmount] = useState('');
  const [saving,  setSaving]  = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setCurrentUserId(user.id);
      const { data: m } = await supabase
        .from('company_members').select('company_id, role')
        .eq('user_id', user.id).eq('status', 'active').limit(1).maybeSingle();
      if (!m || !['owner', 'admin', 'superadmin', 'supervisor'].includes(m.role)) return;
      setCompanyId(m.company_id);
    })();
  }, []);

  const loadData = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const d = new Date(periodo);
      const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);

      const [membRes, budgetRes, spentRes] = await Promise.all([
        supabase.from('company_members')
          .select('user_id, role')
          .eq('company_id', companyId)
          .eq('status', 'active')
          .in('role', ['comprador', 'supervisor', 'admin', 'owner']),

        supabase.from('expense_budgets')
          .select('id, holder_id, amount')
          .eq('company_id', companyId)
          .eq('period_month', periodo),

        supabase.from('receipts')
          .select('uploaded_by, total_amount')
          .eq('company_id', companyId)
          .not('status', 'in', '(deleted,duplicate,cancelled)')
          .gte('receipt_date', periodo)
          .lte('receipt_date', lastDay),
      ]);

      const budgetMap: Record<string, { id: string; amount: number }> = {};
      (budgetRes.data ?? []).forEach((b: any) => {
        if (b.holder_id) budgetMap[b.holder_id] = { id: b.id, amount: b.amount };
      });

      const spentMap: Record<string, number> = {};
      (spentRes.data ?? []).forEach((r: any) => {
        const k = r.uploaded_by ?? '';
        spentMap[k] = (spentMap[k] ?? 0) + (r.total_amount ?? 0);
      });

      setItems(
        (membRes.data ?? []).map((e: any) => ({
          user_id:   e.user_id,
          full_name: null, // sin join a auth.users; se muestra rol + id
          role:      e.role,
          budget:    budgetMap[e.user_id]?.amount ?? null,
          spent:     spentMap[e.user_id] ?? 0,
          budget_id: budgetMap[e.user_id]?.id ?? null,
        })).sort((a, b) => b.spent - a.spent),
      );
    } finally {
      setLoading(false);
    }
  }, [companyId, periodo]);

  useEffect(() => { loadData(); }, [loadData]);

  async function saveBudget() {
    if (!editing || !companyId || !currentUserId) return;
    const amount = parseFloat(newAmount.replace(/,/g, ''));
    if (isNaN(amount) || amount < 0) {
      Alert.alert('Monto inválido', 'Ingresa un monto mayor o igual a cero.');
      return;
    }
    setSaving(true);
    try {
      if (editing.budget_id) {
        await supabase.from('expense_budgets').update({ amount }).eq('id', editing.budget_id);
      } else {
        await supabase.from('expense_budgets').insert({
          company_id:   companyId,
          holder_id:    editing.user_id,
          period_month: periodo,
          amount,
          created_by:   currentUserId,
        });
      }
      setEditing(null);
      setNewAmount('');
      await loadData();
    } finally {
      setSaving(false);
    }
  }

  async function removeBudget(item: BudgetItem) {
    if (!item.budget_id) return;
    Alert.alert(
      '¿Quitar límite?',
      `Se eliminará el presupuesto de ${item.full_name ?? 'este empleado'}.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Quitar', style: 'destructive',
          onPress: async () => {
            await supabase.from('expense_budgets').delete().eq('id', item.budget_id!);
            await loadData();
          },
        },
      ],
    );
  }

  const [py, pm] = periodo.split('-');
  const periodLabel = new Date(parseInt(py), parseInt(pm) - 1, 1)
    .toLocaleString('es-MX', { month: 'long', year: 'numeric' });

  const totalBudget = items.reduce((s, i) => s + (i.budget ?? 0), 0);
  const totalSpent  = items.reduce((s, i) => s + i.spent, 0);
  const conLimite   = items.filter(i => i.budget !== null).length;

  return (
    <View style={{ flex: 1, backgroundColor: BRAND.gray }}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>💰 Presupuestos</Text>
        <Text style={styles.headerSub}>Límites de gasto mensuales por empleado</Text>
        <View style={{ marginTop: 12 }}>
          <DatePickerField value={periodo} onChange={p => setPeriodo(p.slice(0, 7) + '-01')} />
        </View>
        <Text style={styles.periodLabel}>{periodLabel}</Text>
      </View>

      {items.length > 0 && (
        <View style={styles.kpiBanner}>
          <View style={styles.kpiItem}>
            <Text style={styles.kpiVal}>{money(totalBudget)}</Text>
            <Text style={styles.kpiLabel}>Presupuestado</Text>
          </View>
          <View style={styles.kpiDivider} />
          <View style={styles.kpiItem}>
            <Text style={[styles.kpiVal, { color: totalBudget > 0 && totalSpent > totalBudget ? BRAND.red : BRAND.green }]}>
              {money(totalSpent)}
            </Text>
            <Text style={styles.kpiLabel}>Gastado</Text>
          </View>
          <View style={styles.kpiDivider} />
          <View style={styles.kpiItem}>
            <Text style={styles.kpiVal}>{conLimite}/{items.length}</Text>
            <Text style={styles.kpiLabel}>Con límite</Text>
          </View>
        </View>
      )}

      {!companyId ? (
        <View style={styles.center}>
          <Text style={{ color: '#90A4AE', textAlign: 'center' }}>
            Solo administradores pueden gestionar presupuestos.
          </Text>
        </View>
      ) : loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={BRAND.blue} /></View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <Text style={{ fontSize: 48, marginBottom: 12 }}>👥</Text>
          <Text style={{ color: '#90A4AE', textAlign: 'center' }}>
            Sin compradores activos en esta empresa.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          {items.map(item => {
            const pct = item.budget && item.budget > 0 ? Math.round((item.spent / item.budget) * 100) : null;
            const barColor = pct == null ? '#E0E0E0'
              : pct < 70  ? BRAND.green
              : pct < 90  ? BRAND.orange
              : BRAND.red;
            return (
              <View key={item.user_id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.empName}>
                      {item.role === 'owner' ? 'Propietario' :
                       item.role === 'admin' ? 'Admin' :
                       item.role === 'supervisor' ? 'Supervisor' :
                       `Comprador ···${item.user_id.slice(-4)}`}
                    </Text>
                    <Text style={styles.empRole}>{item.role}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    {item.budget !== null ? (
                      <>
                        <Text style={styles.budgetAmt}>{money(item.budget)}</Text>
                        <Text style={styles.budgetLbl}>límite mensual</Text>
                      </>
                    ) : (
                      <Text style={styles.noBudget}>Sin límite</Text>
                    )}
                  </View>
                </View>

                <View style={styles.barWrap}>
                  <View style={[styles.bar, {
                    width: pct !== null ? (`${Math.min(pct, 100)}%` as any) : '0%',
                    backgroundColor: barColor,
                  }]} />
                </View>

                <View style={styles.cardFooter}>
                  <Text style={styles.spentText}>
                    Gastado:{' '}
                    <Text style={{ color: barColor, fontWeight: '700' }}>{money(item.spent)}</Text>
                    {pct !== null && `  (${pct}%)`}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {item.budget_id && (
                      <TouchableOpacity onPress={() => removeBudget(item)} style={styles.removeBtn}>
                        <Text style={styles.removeBtnText}>✕</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={styles.editBtn}
                      onPress={() => {
                        setEditing(item);
                        setNewAmount(item.budget !== null ? String(item.budget) : '');
                      }}
                    >
                      <Text style={styles.editBtnText}>{item.budget_id ? 'Editar' : '+ Límite'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      <Modal visible={!!editing} transparent animationType="slide" onRequestClose={() => setEditing(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Límite mensual</Text>
            <Text style={styles.modalSub}>
              {editing?.full_name ?? 'Empleado'} · {periodLabel}
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Ej: 5000"
              placeholderTextColor="#B0BEC5"
              value={newAmount}
              onChangeText={setNewAmount}
              keyboardType="numeric"
              autoFocus
            />
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              <TouchableOpacity
                style={[styles.modalBtn, { flex: 1, backgroundColor: '#E0E0E0' }]}
                onPress={() => { setEditing(null); setNewAmount(''); }}
              >
                <Text style={[styles.modalBtnText, { color: BRAND.navy }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { flex: 2, backgroundColor: BRAND.blue }]}
                onPress={saveBudget}
                disabled={saving}
              >
                {saving
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.modalBtnText}>Guardar</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header:       { backgroundColor: BRAND.navy, padding: 20, paddingTop: 52, paddingBottom: 20 },
  headerTitle:  { fontSize: 22, fontWeight: '800', color: '#fff' },
  headerSub:    { fontSize: 13, color: '#90A4AE', marginTop: 2 },
  periodLabel:  { fontSize: 12, color: '#90A4AE', marginTop: 6, textTransform: 'capitalize' },

  kpiBanner:    { flexDirection: 'row', backgroundColor: '#fff', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  kpiItem:      { flex: 1, alignItems: 'center' },
  kpiVal:       { fontSize: 15, fontWeight: '800', color: BRAND.navy },
  kpiLabel:     { fontSize: 10, color: '#90A4AE', marginTop: 2 },
  kpiDivider:   { width: 1, backgroundColor: '#F0F0F0' },

  center:       { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },

  card: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 10,
    elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4,
  },
  cardHeader:  { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  empName:     { fontSize: 15, fontWeight: '700', color: BRAND.navy },
  empRole:     { fontSize: 11, color: '#90A4AE', textTransform: 'capitalize', marginTop: 2 },
  budgetAmt:   { fontSize: 16, fontWeight: '800', color: BRAND.blue },
  budgetLbl:   { fontSize: 10, color: '#90A4AE', marginTop: 2 },
  noBudget:    { fontSize: 12, color: '#B0BEC5' },

  barWrap:  { height: 6, backgroundColor: '#F0F0F0', borderRadius: 3, marginBottom: 10 },
  bar:      { height: 6, borderRadius: 3 },

  cardFooter:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  spentText:      { fontSize: 13, color: '#607D8B' },
  editBtn:        { backgroundColor: BRAND.blue + '15', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  editBtnText:    { fontSize: 12, fontWeight: '700', color: BRAND.blue },
  removeBtn:      { paddingHorizontal: 8, paddingVertical: 4, justifyContent: 'center' },
  removeBtnText:  { fontSize: 16, color: '#B0BEC5' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox:     { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalTitle:   { fontSize: 18, fontWeight: '800', color: BRAND.navy, marginBottom: 4 },
  modalSub:     { fontSize: 13, color: '#90A4AE', marginBottom: 12 },
  modalInput:   { backgroundColor: BRAND.gray, borderRadius: 12, padding: 14, fontSize: 16, color: BRAND.navy, borderWidth: 1, borderColor: '#E0E0E0' },
  modalBtn:     { borderRadius: 12, padding: 14, alignItems: 'center' },
  modalBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
