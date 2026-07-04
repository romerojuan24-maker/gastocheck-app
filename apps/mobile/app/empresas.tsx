import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput,
  Alert, ActivityIndicator, Modal, FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { BRAND } from '@gastocheck/shared';
import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface CompanyItem {
  id: string;
  name: string;
  rfc: string | null;
  role: 'owner' | 'admin' | 'supervisor' | 'comprador';
}

export default function EmpresasScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [companies, setCompanies] = useState<CompanyItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Obtener todas las empresas del usuario (donde tiene owner/admin)
      const { data: members } = await supabase
        .from('company_members')
        .select('company_id, role')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .in('role', ['owner', 'admin']);

      if (!members || members.length === 0) return;

      const companyIds = members.map(m => m.company_id);

      // Obtener datos de las empresas
      const { data: cos } = await supabase
        .from('companies')
        .select('id, name, rfc')
        .in('id', companyIds);

      const items: CompanyItem[] = (cos ?? []).map(co => {
        const member = members.find(m => m.company_id === co.id);
        return {
          id: co.id,
          name: co.name,
          rfc: co.rfc,
          role: member?.role as any,
        };
      });

      setCompanies(items);

      // Cargar empresa seleccionada
      const saved = await AsyncStorage.getItem('selectedCompanyId');
      if (saved && items.find(c => c.id === saved)) {
        setSelectedId(saved);
      } else if (items.length > 0) {
        setSelectedId(items[0].id);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleCreate() {
    if (!newName.trim()) {
      Alert.alert('Requerido', 'El nombre de la empresa es obligatorio.');
      return;
    }

    setCreating(true);
    try {
      // Refrescar sesión y verificar que devolvió token válido.
      // Si el refresh falla, auth.uid() en Postgres devuelve null y la RLS bloquea el INSERT.
      const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession();
      const user = refreshed?.session?.user ?? refreshed?.user;
      if (refreshErr || !user) {
        Alert.alert('Sesión expirada', 'Cierra y vuelve a abrir la app para continuar.');
        return;
      }

      // Crear empresa
      const { data: company, error: errCo } = await supabase
        .from('companies')
        .insert([{
          name: newName.trim(),
          moneda: 'MXN',
          plan: 'basico',
          plan_seats: 2,
          created_by: user.id,
        }])
        .select('id')
        .single();

      if (errCo) throw errCo;
      if (!company) throw new Error('No se creó la empresa');

      // Agregar usuario como owner
      const { error: errMem } = await supabase
        .from('company_members')
        .insert([{
          company_id: company.id,
          user_id: user.id,
          role: 'owner',
          status: 'active',
        }]);

      if (errMem) throw errMem;

      Alert.alert('✓ Creada', `Empresa "${newName}" creada exitosamente.`);
      setNewName('');
      setShowCreate(false);
      setSelectedId(company.id);
      await AsyncStorage.setItem('selectedCompanyId', company.id);
      load();
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'No se pudo crear la empresa.');
    } finally {
      setCreating(false);
    }
  }

  async function handleSelect(id: string) {
    setSelectedId(id);
    await AsyncStorage.setItem('selectedCompanyId', id);
    router.push('/administracion');
  }

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BRAND.gray }}>
        <ActivityIndicator size="large" color={BRAND.blue} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: BRAND.gray }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <Text style={styles.title}>Mis Empresas</Text>
          <Text style={styles.hint}>Toca una empresa para administrarla</Text>
        </View>

        {/* ── Lista de empresas ── */}
        {companies.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🏢</Text>
            <Text style={styles.emptyTitle}>Sin empresas</Text>
            <Text style={styles.emptyHint}>Crea tu primera empresa para comenzar</Text>
          </View>
        ) : (
          <View style={styles.companyList}>
            {companies.map((co) => (
              <TouchableOpacity
                key={co.id}
                style={[styles.companyCard, selectedId === co.id && styles.companyCardActive]}
                onPress={() => handleSelect(co.id)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.companyName, selectedId === co.id && { color: '#fff' }]}>
                    {co.name}
                  </Text>
                  {co.rfc && (
                    <Text style={[styles.companyRfc, selectedId === co.id && { color: 'rgba(255,255,255,0.7)' }]}>
                      RFC: {co.rfc}
                    </Text>
                  )}
                  <Text style={[styles.companyRole, selectedId === co.id && { color: 'rgba(255,255,255,0.7)' }]}>
                    {co.role === 'owner' ? '👑 Propietario' : '🔑 Administrador'}
                  </Text>
                </View>
                {selectedId === co.id && (
                  <View style={styles.checkmark}>
                    <Text style={{ color: '#fff', fontSize: 18 }}>✓</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ── Botones de acción ── */}
        <View style={{ gap: 10, marginTop: 20 }}>
          <TouchableOpacity style={styles.btnSecondary} onPress={() => setShowCreate(true)}>
            <Text style={styles.btnSecondaryText}>+ Crear Nueva Empresa</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>

      {/* ── Modal crear empresa ── */}
      <Modal visible={showCreate} animationType="slide" presentationStyle="pageSheet"
        onRequestClose={() => setShowCreate(false)}>
        <View style={{ flex: 1, backgroundColor: BRAND.gray }}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowCreate(false)}>
              <Text style={{ color: '#90A4AE', fontSize: 15 }}>Cancelar</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 16, fontWeight: '700', color: BRAND.navy }}>Nueva Empresa</Text>
            <View style={{ width: 60 }} />
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
            <Text style={styles.fieldLabel}>Nombre de la empresa *</Text>
            <TextInput
              style={styles.input}
              value={newName}
              onChangeText={setNewName}
              placeholder="Mi Empresa S.A. de C.V."
              placeholderTextColor="#B0BEC5"
              editable={!creating}
            />

            <Text style={styles.hint2}>
              Después de crear la empresa, podrás agregar su RFC, dirección, datos fiscales, invitar supervisores y compradores.
            </Text>

            <TouchableOpacity
              style={[styles.btnPrimary, { marginTop: 20 }, creating && { opacity: 0.6 }]}
              onPress={handleCreate}
              disabled={creating}
            >
              {creating
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.btnText}>Crear Empresa</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24, fontWeight: '800', color: BRAND.navy, marginBottom: 6,
  },
  hint: {
    fontSize: 14, color: '#90A4AE',
  },

  emptyState: {
    alignItems: 'center', paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 60, marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18, fontWeight: '700', color: BRAND.navy, marginBottom: 6,
  },
  emptyHint: {
    fontSize: 14, color: '#90A4AE',
  },

  companyList: {
    gap: 10,
  },
  companyCard: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16,
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: '#E0E0E0',
  },
  companyCardActive: {
    backgroundColor: BRAND.blue, borderColor: BRAND.blue,
  },
  companyName: {
    fontSize: 15, fontWeight: '700', color: BRAND.navy, marginBottom: 4,
  },
  companyRfc: {
    fontSize: 12, color: '#90A4AE', marginBottom: 2,
  },
  companyRole: {
    fontSize: 12, color: '#90A4AE',
  },
  checkmark: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center', alignItems: 'center',
  },

  btnPrimary: {
    backgroundColor: BRAND.blue, borderRadius: 14, padding: 16,
    alignItems: 'center',
  },
  btnSecondary: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16,
    alignItems: 'center', borderWidth: 1, borderColor: '#E0E0E0',
  },
  btnText: {
    color: '#fff', fontSize: 15, fontWeight: '700',
  },
  btnSecondaryText: {
    color: BRAND.blue, fontSize: 15, fontWeight: '700',
  },

  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E0E0E0',
  },
  fieldLabel: {
    fontSize: 11, fontWeight: '700', color: '#90A4AE',
    textTransform: 'uppercase', marginBottom: 6,
  },
  input: {
    backgroundColor: '#fff', borderRadius: 12, padding: 13,
    borderWidth: 1, borderColor: '#E0E0E0', fontSize: 15, color: BRAND.navy,
  },
  hint2: {
    fontSize: 13, color: '#90A4AE', marginTop: 12, lineHeight: 18,
  },
});
