import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, Alert, ScrollView,
} from 'react-native';
import { BRAND } from '@gastocheck/shared';
import { supabase } from '../lib/supabase';

export default function LoginScreen() {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);

  async function handleLogin() {
    if (!email.trim() || !password) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    setLoading(false);
    if (error) Alert.alert('Error al iniciar sesión', error.message);
  }

  const canLogin = email.trim().length > 0 && password.length > 0 && !loading;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Logo */}
        <View style={styles.logoArea}>
          <View style={styles.logoBox}>
            <Text style={styles.logoIcon}>💼</Text>
          </View>
          <Text style={styles.logoText}>GastoCheck</Text>
          <Text style={styles.logoSub}>Control de anticipos y gastos</Text>
        </View>

        {/* Form */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Iniciar sesión</Text>

          <Text style={styles.label}>Correo electrónico</Text>
          <TextInput
            style={styles.input}
            placeholder="correo@empresa.com"
            placeholderTextColor="#B0BEC5"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
          />

          <Text style={styles.label}>Contraseña</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor="#B0BEC5"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            returnKeyType="done"
            onSubmitEditing={canLogin ? handleLogin : undefined}
          />

          <TouchableOpacity
            style={[styles.btn, !canLogin && styles.btnDisabled]}
            onPress={handleLogin}
            disabled={!canLogin}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnText}>Iniciar sesión</Text>
            }
          </TouchableOpacity>
        </View>

        <Text style={styles.footer}>
          ¿No tienes cuenta? Solicita acceso a tu administrador o supervisor.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: BRAND.gray },
  scroll:     { flexGrow: 1, justifyContent: 'center', padding: 24 },
  logoArea:   { alignItems: 'center', marginBottom: 32 },
  logoBox:    {
    width: 72, height: 72, borderRadius: 20,
    backgroundColor: BRAND.blue, justifyContent: 'center', alignItems: 'center',
    marginBottom: 12, shadowColor: BRAND.blue, shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 }, shadowRadius: 8, elevation: 6,
  },
  logoIcon:   { fontSize: 32 },
  logoText:   { fontSize: 28, fontWeight: '800', color: BRAND.navy },
  logoSub:    { fontSize: 14, color: '#90A4AE', marginTop: 4 },
  card:       { backgroundColor: '#fff', borderRadius: 20, padding: 24, marginBottom: 16 },
  cardTitle:  { fontSize: 18, fontWeight: '700', color: BRAND.navy, marginBottom: 20 },
  label:      { fontSize: 12, fontWeight: '700', color: '#90A4AE', textTransform: 'uppercase', marginBottom: 6, marginTop: 12 },
  input:      {
    borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 12,
    padding: 14, fontSize: 15, color: BRAND.navy, backgroundColor: BRAND.gray,
  },
  btn:        {
    backgroundColor: BRAND.blue, borderRadius: 12, padding: 16,
    alignItems: 'center', marginTop: 24,
  },
  btnDisabled:{ opacity: 0.5 },
  btnText:    { color: '#fff', fontSize: 16, fontWeight: '700' },
  footer:     { fontSize: 13, color: '#90A4AE', textAlign: 'center', lineHeight: 18 },
});
