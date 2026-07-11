// Operaciones — Alta de Clientes: da de alta un cliente de cobranza
// (con dirección/GPS para poder generar rutas después).
import { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { BRAND } from '@gastocheck/shared';
import { supabase } from '../../lib/supabase';
import { getActiveMembership } from '../../lib/membership';

export default function AltaClienteScreen() {
  const router = useRouter();
  const [name,    setName]    = useState('');
  const [rfc,     setRfc]     = useState('');
  const [email,   setEmail]   = useState('');
  const [phone,   setPhone]   = useState('');
  const [address, setAddress] = useState('');
  const [creditLimit, setCreditLimit] = useState('');
  const [coords,  setCoords]  = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [saving,  setSaving]  = useState(false);

  async function captureGps() {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso necesario', 'Activa la ubicación para marcar el domicilio del cliente en el mapa.');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
    } catch {
      Alert.alert('Error', 'No se pudo obtener la ubicación.');
    } finally {
      setLocating(false);
    }
  }

  async function handleSave() {
    if (!name.trim()) {
      Alert.alert('Falta nombre', 'Ingresa el nombre o razón social del cliente.');
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No autenticado');
      const m = await getActiveMembership(user.id);
      if (!m) throw new Error('No se pudo identificar tu empresa');

      const { error } = await supabase.from('cobra_clients').insert({
        company_id:   m.company_id,
        name:         name.trim(),
        rfc:          rfc.trim() || null,
        email:        email.trim() || null,
        phone:        phone.trim() || null,
        address:      address.trim() || null,
        lat:          coords?.lat ?? null,
        lng:          coords?.lng ?? null,
        credit_limit: creditLimit ? parseFloat(creditLimit) : null,
        current_balance: 0,
        risk_score:   0,
        status:       'active',
      });
      if (error) throw error;

      Alert.alert('✓ Cliente registrado', name.trim(), [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'No se pudo registrar el cliente.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: BRAND.gray }} contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
      <Text style={styles.fieldLabel}>Nombre / Razón Social</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Comercializadora del Norte" placeholderTextColor="#B0BEC5" />

      <Text style={styles.fieldLabel}>RFC</Text>
      <TextInput style={styles.input} value={rfc} onChangeText={setRfc} placeholder="XAXX010101000" placeholderTextColor="#B0BEC5" autoCapitalize="characters" />

      <Text style={styles.fieldLabel}>Correo</Text>
      <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="cliente@empresa.com" placeholderTextColor="#B0BEC5" autoCapitalize="none" keyboardType="email-address" />

      <Text style={styles.fieldLabel}>Teléfono</Text>
      <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="55 1234 5678" placeholderTextColor="#B0BEC5" keyboardType="phone-pad" />

      <Text style={styles.fieldLabel}>Domicilio</Text>
      <TextInput style={[styles.input, { minHeight: 60, textAlignVertical: 'top' }]} value={address} onChangeText={setAddress}
        placeholder="Calle, número, colonia, ciudad" placeholderTextColor="#B0BEC5" multiline />

      <TouchableOpacity style={styles.gpsBtn} onPress={captureGps} disabled={locating}>
        {locating ? <ActivityIndicator color={BRAND.cobra} /> : (
          <Text style={styles.gpsBtnText}>
            {coords ? `📍 Ubicación marcada (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})` : '📍 Marcar ubicación GPS'}
          </Text>
        )}
      </TouchableOpacity>

      <Text style={styles.fieldLabel}>Límite de crédito (opcional)</Text>
      <TextInput style={styles.input} value={creditLimit} onChangeText={setCreditLimit} placeholder="0.00" placeholderTextColor="#B0BEC5" keyboardType="decimal-pad" />

      <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>✓ Registrar Cliente</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fieldLabel: { fontSize: 11, fontWeight: '700', color: '#90A4AE', textTransform: 'uppercase', marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: '#fff', borderRadius: 12, padding: 13, borderWidth: 1, borderColor: '#E0E0E0', fontSize: 15, color: BRAND.navy },
  gpsBtn: { backgroundColor: '#fff', borderRadius: 12, padding: 14, borderWidth: 1.5, borderColor: BRAND.cobra, alignItems: 'center', marginTop: 14 },
  gpsBtnText: { color: BRAND.cobra, fontWeight: '700', fontSize: 13 },
  saveBtn: { backgroundColor: BRAND.cobra, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 24 },
  saveBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
