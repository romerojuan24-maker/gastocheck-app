// Viáticos: hospedaje, comidas, transporte, etc. Multi-persona
import { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList,
  ActivityIndicator, Alert, Modal, TextInput, ScrollView,
} from 'react-native';
import { BRAND } from '@gastocheck/shared';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';

interface Viatico {
  id: string;
  person_id: string;
  person_email?: string;
  amount: number;
  category: string;
  description: string;
  trip_date: string;
  city: string;
  status: string;
  approval_reason?: string;
  created_at: string;
}

const CATEGORIES = [
  { value: 'renta_auto', label: '🚗 Renta Auto' },
  { value: 'presentacion', label: '👔 Presentación' },
  { value: 'comidas', label: '🍽️ Comidas' },
  { value: 'hospedaje', label: '🏨 Hospedaje' },
  { value: 'transporte', label: '✈️ Transporte' },
  { value: 'otro', label: '📌 Otro' },
];

const STATUS_COLORS: Record<string, string> = {
  pending: '#FFA500',
  approved: '#4CAF50',
  rejected: '#F44336',
};

const money = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);

export default function ViaticosScreen() {
  const router = useRouter();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [viaticos, setViaticos] = useState<Viatico[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'mios' | 'solicitar'>('mios');

  // Modal para solicitar viático
  const [showModal, setShowModal] = useState(false);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('hospedaje');
  const [description, setDescription] = useState('');
  const [city, setCity] = useState('');
  const [tripDate, setTripDate] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/auth/login');
        return;
      }

      setUserId(user.id);

      // Obtener company_id
      const { data: member } = await supabase
        .from('company_members')
        .select('company_id')
        .eq('user_id', user.id)
        .single();

      if (!member) return;
      setCompanyId(member.company_id);

      // Cargar viáticos del usuario
      const { data } = await supabase
        .from('viaticos')
        .select('*')
        .eq('company_id', member.company_id)
        .eq('person_id', user.id)
        .order('created_at', { ascending: false });

      if (data) setViaticos(data);
    } catch (error) {
      console.error('Error loading viaticos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateViatico = async () => {
    if (!amount || !category || !city || !tripDate || !userId || !companyId) {
      Alert.alert('Error', 'Completa todos los campos');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('viaticos')
        .insert({
          company_id: companyId,
          created_by: userId,
          person_id: userId,
          amount: parseFloat(amount),
          category,
          description,
          trip_date: tripDate,
          city,
          status: 'pending',
        });

      if (error) throw error;

      Alert.alert('Éxito', 'Viático solicitado');
      setAmount('');
      setDescription('');
      setCity('');
      setTripDate('');
      setCategory('hospedaje');
      setShowModal(false);
      loadData();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={BRAND.colors.primary} />
      </View>
    );
  }

  const myViaticos = viaticos.filter(v => v.person_id === userId);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>✈️ Viáticos</Text>
        <Text style={styles.subtitle}>Hospedaje, comidas, transporte...</Text>
      </View>

      {/* Botón solicitar */}
      <TouchableOpacity
        style={styles.floatingButton}
        onPress={() => setTab('solicitar')}
      >
        <Text style={styles.floatingButtonText}>+ Nuevo Viático</Text>
      </TouchableOpacity>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, tab === 'mios' && styles.tabActive]}
          onPress={() => setTab('mios')}
        >
          <Text style={[styles.tabText, tab === 'mios' && styles.tabTextActive]}>
            Mis Viáticos ({myViaticos.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'solicitar' && styles.tabActive]}
          onPress={() => setTab('solicitar')}
        >
          <Text style={[styles.tabText, tab === 'solicitar' && styles.tabTextActive]}>
            Solicitar
          </Text>
        </TouchableOpacity>
      </View>

      {/* MIS VIÁTICOS */}
      {tab === 'mios' && (
        <FlatList
          data={myViaticos}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={[styles.card, { borderLeftColor: STATUS_COLORS[item.status] }]}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>
                  {CATEGORIES.find(c => c.value === item.category)?.label}
                </Text>
                <Text style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[item.status] }]}>
                  {item.status === 'pending' && '⏳'}
                  {item.status === 'approved' && '✅'}
                  {item.status === 'rejected' && '❌'}
                </Text>
              </View>
              <Text style={styles.amount}>{money(item.amount)}</Text>
              <View style={styles.details}>
                <Text style={styles.detail}>📍 {item.city}</Text>
                <Text style={styles.detail}>📅 {item.trip_date}</Text>
              </View>
            </View>
          )}
          scrollEnabled={false}
        />
      )}

      {/* SOLICITAR */}
      {tab === 'solicitar' && (
        <ScrollView style={styles.formContainer}>
          <Text style={styles.label}>Categoría</Text>
          <View style={styles.categoryGrid}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat.value}
                style={[
                  styles.categoryButton,
                  category === cat.value && styles.categoryButtonActive,
                ]}
                onPress={() => setCategory(cat.value)}
              >
                <Text style={styles.categoryButtonText}>{cat.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Monto (MXN)</Text>
          <TextInput
            style={styles.input}
            placeholder="0.00"
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
          />

          <Text style={styles.label}>Ciudad</Text>
          <TextInput
            style={styles.input}
            placeholder="ej: Guadalajara"
            value={city}
            onChangeText={setCity}
          />

          <Text style={styles.label}>Fecha (YYYY-MM-DD)</Text>
          <TextInput
            style={styles.input}
            placeholder="2026-06-28"
            value={tripDate}
            onChangeText={setTripDate}
          />

          <Text style={styles.label}>Descripción (opcional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Detalles..."
            value={description}
            onChangeText={setDescription}
            multiline
          />

          <TouchableOpacity
            style={[styles.button, saving && styles.buttonDisabled]}
            onPress={handleCreateViatico}
            disabled={saving}
          >
            <Text style={styles.buttonText}>
              {saving ? 'Enviando...' : '✅ Solicitar'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { padding: 20, backgroundColor: BRAND.colors.primary },
  title: { fontSize: 28, fontWeight: 'bold', color: '#fff' },
  subtitle: { fontSize: 14, color: '#f0f0f0', marginTop: 4 },
  floatingButton: { position: 'absolute', top: 80, right: 16, zIndex: 10, backgroundColor: BRAND.colors.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  floatingButtonText: { color: '#fff', fontWeight: 'bold' },
  tabsContainer: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e0e0e0', backgroundColor: '#fff' },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: BRAND.colors.primary },
  tabText: { fontSize: 14, fontWeight: '500', color: '#999' },
  tabTextActive: { color: BRAND.colors.primary },
  card: { margin: 12, padding: 16, backgroundColor: '#fff', borderRadius: 8, borderLeftWidth: 4 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  cardTitle: { fontSize: 16, fontWeight: 'bold' },
  statusBadge: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', color: '#fff' },
  amount: { fontSize: 20, fontWeight: 'bold', color: BRAND.colors.primary, marginVertical: 8 },
  details: { marginVertical: 8 },
  detail: { fontSize: 13, color: '#666', marginVertical: 3 },
  formContainer: { padding: 16 },
  label: { fontSize: 14, fontWeight: 'bold', marginTop: 12, marginBottom: 8 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryButton: { width: '48%', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 6, borderWidth: 1, borderColor: '#ddd', backgroundColor: '#fff' },
  categoryButtonActive: { borderColor: BRAND.colors.primary, backgroundColor: BRAND.colors.primary },
  categoryButtonText: { fontSize: 12, color: '#666', fontWeight: '500', textAlign: 'center' },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderRadius: 6, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, marginBottom: 8 },
  textArea: { height: 80, textAlignVertical: 'top' },
  button: { marginTop: 20, marginBottom: 30, paddingVertical: 14, backgroundColor: BRAND.colors.primary, borderRadius: 6, alignItems: 'center' },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
