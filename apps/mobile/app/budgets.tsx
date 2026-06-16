// Budget tracking — establecer límites por categoría y monitorear gastos
import { useEffect, useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList,
  ActivityIndicator, Alert, Modal, TextInput, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { BRAND } from '@gastocheck/shared';
import { supabase } from '../lib/supabase';

interface Budget {
  id: string;
  category_id: string;
  category_name: string;
  limit_amount: number;
  period: 'monthly' | 'quarterly' | 'annual';
  spent_amount: number;
  remaining: number;
  percentage: number;
  created_at: string;
}

const money = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);

const percentage = (n: number) =>
  new Intl.NumberFormat('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

export default function BudgetsScreen() {
  const router = useRouter();

  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [formCategoryId, setFormCategoryId] = useState<string | null>(null);
  const [formLimit, setFormLimit] = useState('');
  const [formPeriod, setFormPeriod] = useState<'monthly' | 'quarterly' | 'annual'>('monthly');
  const [saving, setSaving] = useState(false);

  // Cargar categorías y presupuestos
  const loadBudgets = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Obtener company_id
      const { data: member } = await supabase
        .from('company_members')
        .select('company_id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle();

      if (!member) return;

      // Cargar categorías
      const { data: cats } = await supabase
        .from('expense_categories')
        .select('id, name')
        .eq('company_id', member.company_id)
        .order('name');

      if (cats) setCategories(cats);

      // Cargar presupuestos con gastos
      const { data: budgetRows } = await supabase
        .from('expense_budgets')
        .select(`
          *,
          category:expense_categories!category_id(name)
        `)
        .eq('company_id', member.company_id);

      if (budgetRows) {
        // Calcular gastos por categoría y período
        const enriched: Budget[] = [];

        for (const budget of budgetRows) {
          // Obtener período actual según configuración
          const now = new Date();
          let periodStart: Date;

          if (budget.period === 'monthly') {
            periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
          } else if (budget.period === 'quarterly') {
            const quarter = Math.floor(now.getMonth() / 3);
            periodStart = new Date(now.getFullYear(), quarter * 3, 1);
          } else {
            periodStart = new Date(now.getFullYear(), 0, 1);
          }

          // Obtener gastos del período
          const { data: receipts, error: recErr } = await supabase
            .from('receipts')
            .select('total_amount')
            .eq('company_id', member.company_id)
            .eq('category_id', budget.category_id)
            .gte('receipt_date', periodStart.toISOString().slice(0, 10))
            .eq('status', 'vigente'); // Solo comprobantes vigentes

          const spent = (receipts ?? []).reduce((sum, r) => sum + (r.total_amount ?? 0), 0);
          const remaining = Math.max(0, budget.limit_amount - spent);
          const pct = budget.limit_amount > 0 ? (spent / budget.limit_amount) * 100 : 0;

          enriched.push({
            id: budget.id,
            category_id: budget.category_id,
            category_name: budget.category?.name ?? 'Sin categoría',
            limit_amount: budget.limit_amount,
            period: budget.period,
            spent_amount: spent,
            remaining,
            percentage: Math.min(pct, 100),
            created_at: budget.created_at,
          });
        }

        setBudgets(enriched);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBudgets();
  }, [loadBudgets]);

  useFocusEffect(
    useCallback(() => {
      loadBudgets();
    }, [loadBudgets]),
  );

  // Crear presupuesto
  async function createBudget() {
    if (!formCategoryId || !formLimit.trim()) {
      Alert.alert('Campos requeridos', 'Selecciona una categoría e ingresa el límite');
      return;
    }

    const limit = parseFloat(formLimit);
    if (isNaN(limit) || limit <= 0) {
      Alert.alert('Límite inválido', 'Ingresa un monto mayor a 0');
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No autenticado');

      const { data: member } = await supabase
        .from('company_members')
        .select('company_id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle();

      if (!member) throw new Error('No tienes empresa');

      const { error } = await supabase
        .from('expense_budgets')
        .upsert({
          company_id: member.company_id,
          category_id: formCategoryId,
          limit_amount: limit,
          period: formPeriod,
        });

      if (error) throw error;

      Alert.alert('✓ Presupuesto creado', `Límite de ${money(limit)} para ${formPeriod}`);
      setShowCreateModal(false);
      setFormCategoryId(null);
      setFormLimit('');
      setFormPeriod('monthly');
      loadBudgets();
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'No se pudo crear el presupuesto');
    } finally {
      setSaving(false);
    }
  }

  // Renderizar presupuesto
  function renderBudget({ item }: { item: Budget }) {
    const isExceeded = item.spent_amount > item.limit_amount;
    const isWarning = item.percentage >= 80;

    return (
      <View
        style={[
          styles.card,
          isExceeded && { borderColor: BRAND.red, borderWidth: 1.5 },
          isWarning && !isExceeded && { borderColor: BRAND.orange, borderWidth: 1.5 },
        ]}
      >
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.categoryName} numberOfLines={1}>{item.category_name}</Text>
            <Text style={styles.period}>
              {item.period === 'monthly' ? '📅 Mensual' : item.period === 'quarterly' ? '📊 Trimestral' : '📈 Anual'}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[styles.spent, isExceeded && { color: BRAND.red }]}>
              {money(item.spent_amount)}
            </Text>
            <Text style={styles.limit}>{percentage(item.percentage)}% de {money(item.limit_amount)}</Text>
          </View>
        </View>

        {/* Barra de progreso */}
        <View style={styles.progressBg}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${item.percentage}%`,
                backgroundColor: isExceeded ? BRAND.red : isWarning ? BRAND.orange : BRAND.green,
              },
            ]}
          />
        </View>

        {/* Indicadores */}
        <View style={styles.footer}>
          {isExceeded ? (
            <Text style={{ color: BRAND.red, fontSize: 12, fontWeight: '700' }}>
              ⚠️ Presupuesto excedido por {money(item.spent_amount - item.limit_amount)}
            </Text>
          ) : (
            <Text style={{ color: item.remaining > 0 ? BRAND.green : BRAND.red, fontSize: 12, fontWeight: '700' }}>
              {item.remaining > 0 ? `Disponible: ${money(item.remaining)}` : 'Sin disponible'}
            </Text>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Botón crear presupuesto */}
      <TouchableOpacity
        style={styles.createBtn}
        onPress={() => setShowCreateModal(true)}
      >
        <Text style={styles.createBtnText}>+ Nuevo presupuesto</Text>
      </TouchableOpacity>

      {/* Lista */}
      {loading && budgets.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={BRAND.blue} />
        </View>
      ) : budgets.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>💰</Text>
          <Text style={styles.emptyText}>Sin presupuestos</Text>
          <Text style={styles.emptyHint}>Crea un límite para controlar gastos</Text>
        </View>
      ) : (
        <FlatList
          data={budgets}
          keyExtractor={(b) => b.id}
          renderItem={renderBudget}
          contentContainerStyle={styles.list}
          refreshing={loading}
          onRefresh={loadBudgets}
        />
      )}

      {/* Modal crear presupuesto */}
      <Modal visible={showCreateModal} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Nuevo presupuesto</Text>
            <TouchableOpacity onPress={() => setShowCreateModal(false)}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            {/* Selector de categoría */}
            <Text style={styles.label}>Categoría *</Text>
            {categories.length > 0 ? (
              categories.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.optionBtn,
                    formCategoryId === cat.id && { backgroundColor: BRAND.blue + '20', borderColor: BRAND.blue, borderWidth: 2 },
                  ]}
                  onPress={() => setFormCategoryId(cat.id)}
                >
                  <Text style={[
                    styles.optionText,
                    formCategoryId === cat.id && { color: BRAND.blue, fontWeight: '700' }
                  ]}>
                    {formCategoryId === cat.id ? '✓' : ' '} {cat.name}
                  </Text>
                </TouchableOpacity>
              ))
            ) : (
              <View style={{ backgroundColor: '#FFF8E1', borderRadius: 10, padding: 14, marginTop: 4 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#F57F17', marginBottom: 4 }}>
                  Sin catálogo de cuentas
                </Text>
                <Text style={{ fontSize: 12, color: '#90A4AE', lineHeight: 18 }}>
                  Para crear presupuestos por categoría, primero importa tu catálogo contable en{'\n'}
                  Administración → Catálogo de Cuentas → Importar
                </Text>
              </View>
            )}

            {/* Límite de monto */}
            <Text style={styles.label}>Límite ($) *</Text>
            <TextInput
              style={styles.input}
              placeholder="Ej: 5000"
              keyboardType="decimal-pad"
              value={formLimit}
              onChangeText={setFormLimit}
            />

            {/* Período */}
            <Text style={styles.label}>Período</Text>
            {['monthly', 'quarterly', 'annual'].map((period) => (
              <TouchableOpacity
                key={period}
                style={[
                  styles.optionBtn,
                  formPeriod === period && { backgroundColor: BRAND.blue + '20', borderColor: BRAND.blue, borderWidth: 2 },
                ]}
                onPress={() => setFormPeriod(period as any)}
              >
                <Text style={[
                  styles.optionText,
                  formPeriod === period && { color: BRAND.blue, fontWeight: '700' }
                ]}>
                  {formPeriod === period ? '✓' : ' '} {period === 'monthly' ? 'Mensual' : period === 'quarterly' ? 'Trimestral' : 'Anual'}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => setShowCreateModal(false)}
            >
              <Text style={styles.cancelBtnText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, (!formCategoryId || !formLimit.trim() || saving) && { opacity: 0.5 }]}
              onPress={createBudget}
              disabled={!formCategoryId || !formLimit.trim() || saving}
            >
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Crear presupuesto</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BRAND.gray },
  createBtn: {
    marginHorizontal: 12, marginTop: 12, marginBottom: 8,
    backgroundColor: BRAND.blue, borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  createBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  list: { paddingHorizontal: 12, paddingBottom: 24 },
  card: {
    backgroundColor: '#fff', borderRadius: 14, padding: 14,
    marginBottom: 8, borderWidth: 1, borderColor: '#F0F0F0',
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  categoryName: { fontSize: 15, fontWeight: '700', color: BRAND.navy },
  period: { fontSize: 12, color: '#90A4AE', marginTop: 2 },
  spent: { fontSize: 16, fontWeight: '800', color: BRAND.navy },
  limit: { fontSize: 12, color: '#90A4AE', marginTop: 2 },
  progressBg: { height: 8, backgroundColor: '#E0E0E0', borderRadius: 4, overflow: 'hidden', marginBottom: 8 },
  progressFill: { height: '100%', borderRadius: 4 },
  footer: { alignItems: 'flex-start' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyIcon: { fontSize: 48, marginBottom: 8 },
  emptyText: { fontSize: 16, color: BRAND.navy, fontWeight: '700' },
  emptyHint: { fontSize: 13, color: '#90A4AE', marginTop: 4 },
  modal: { flex: 1, backgroundColor: BRAND.gray },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E0E0E0' },
  modalTitle: { fontSize: 18, fontWeight: '800', color: BRAND.navy },
  modalClose: { fontSize: 20, color: '#90A4AE' },
  modalBody: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  label: { fontSize: 12, fontWeight: '700', color: '#90A4AE', textTransform: 'uppercase', marginBottom: 8, marginTop: 12 },
  input: { backgroundColor: '#fff', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#E0E0E0', fontSize: 14, color: BRAND.navy, marginBottom: 8 },
  optionBtn: { backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, marginBottom: 8, borderWidth: 1, borderColor: '#E0E0E0' },
  optionText: { fontSize: 14, color: BRAND.navy },
  hint: { fontSize: 13, color: '#90A4AE', fontStyle: 'italic', marginBottom: 8 },
  modalActions: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingVertical: 16, paddingBottom: 32, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#F0F0F0' },
  cancelBtn: { flex: 1, backgroundColor: '#F5F5F5', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  cancelBtnText: { fontSize: 15, fontWeight: '700', color: '#90A4AE' },
  saveBtn: { flex: 1, backgroundColor: BRAND.blue, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
