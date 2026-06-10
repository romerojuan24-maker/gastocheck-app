import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, Alert, ScrollView,
} from 'react-native';
import { BRAND } from '@gastocheck/shared';
import { supabase } from '../lib/supabase';

type Tab = 'login' | 'register';

const DEMO_EMAIL    = 'demo@gastocheck.app';
const DEMO_PASSWORD = 'Demo2026!';

export default function LoginScreen() {
  const [tab,       setTab]       = useState<Tab>('login');
  const [email,     setEmail]     = useState('');
  const [password,  setPassword]  = useState('');
  const [company,   setCompany]   = useState('');
  const [loading,   setLoading]   = useState(false);

  // ── Iniciar sesión ──────────────────────────────────────────────────────────

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

  // ── Registrar cuenta nueva ──────────────────────────────────────────────────

  async function handleRegister() {
    if (!email.trim() || !password || !company.trim()) return;
    if (password.length < 8) {
      Alert.alert('Contraseña muy corta', 'La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    setLoading(true);
    try {
      // 1. Crear usuario en Auth
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email:    email.trim().toLowerCase(),
        password,
      });
      if (authErr) throw authErr;
      if (!authData.user) throw new Error('No se pudo crear el usuario.');

      // 2. Crear empresa
      const { data: compData, error: compErr } = await supabase
        .from('companies')
        .insert({ name: company.trim() })
        .select('id')
        .single();
      if (compErr) throw compErr;

      // 3. Agregar usuario como admin de la empresa
      const { error: memberErr } = await supabase
        .from('company_members')
        .insert({
          company_id: compData.id,
          user_id:    authData.user.id,
          role:       'admin',
        });
      if (memberErr) throw memberErr;

      Alert.alert(
        '¡Cuenta creada!',
        'Revisa tu correo para confirmar tu cuenta, luego inicia sesión.',
      );
      setTab('login');
      setEmail(email.trim().toLowerCase());
      setPassword('');
      setCompany('');
    } catch (err: any) {
      Alert.alert('Error al registrar', err.message ?? String(err));
    } finally {
      setLoading(false);
    }
  }

  // ── Modo prueba (auto-login admin demo) ─────────────────────────────────────

  async function handleDemo() {
    setLoading(true);

    // Intenta login primero
    const { error: loginErr } = await supabase.auth.signInWithPassword({
      email:    DEMO_EMAIL,
      password: DEMO_PASSWORD,
    });

    if (!loginErr) { setLoading(false); return; }

    // Si no existe, crea la cuenta demo
    const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
      email:    DEMO_EMAIL,
      password: DEMO_PASSWORD,
    });

    if (signUpErr || !signUpData.user) {
      setLoading(false);
      Alert.alert('Error modo prueba', signUpErr?.message ?? 'No se pudo crear cuenta demo.');
      return;
    }

    // Crear empresa demo
    const { data: comp } = await supabase
      .from('companies')
      .insert({ name: 'Empresa Demo GastoCheck' })
      .select('id')
      .single();

    if (comp) {
      await supabase.from('company_members').insert({
        company_id: comp.id,
        user_id:    signUpData.user.id,
        role:       'admin',
      });
    }

    // Login con las credenciales demo
    await supabase.auth.signInWithPassword({ email: DEMO_EMAIL, password: DEMO_PASSWORD });
    setLoading(false);
  }

  const canSubmit = tab === 'login'
    ? email.trim().length > 0 && password.length > 0 && !loading
    : email.trim().length > 0 && password.length >= 8 && company.trim().length > 0 && !loading;

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

        {/* Tabs */}
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tabBtn, tab === 'login' && styles.tabBtnActive]}
            onPress={() => setTab('login')}
          >
            <Text style={[styles.tabText, tab === 'login' && styles.tabTextActive]}>
              Iniciar sesión
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, tab === 'register' && styles.tabBtnActive]}
            onPress={() => setTab('register')}
          >
            <Text style={[styles.tabText, tab === 'register' && styles.tabTextActive]}>
              Crear cuenta
            </Text>
          </TouchableOpacity>
        </View>

        {/* Form */}
        <View style={styles.card}>

          {tab === 'register' && (
            <>
              <Text style={styles.label}>Nombre de tu empresa *</Text>
              <TextInput
                style={styles.input}
                placeholder="Mi Empresa S.A. de C.V."
                placeholderTextColor="#B0BEC5"
                value={company}
                onChangeText={setCompany}
                returnKeyType="next"
              />
            </>
          )}

          <Text style={styles.label}>Correo electrónico *</Text>
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

          <Text style={styles.label}>
            {tab === 'register' ? 'Contraseña (mín. 8 caracteres) *' : 'Contraseña *'}
          </Text>
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor="#B0BEC5"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            returnKeyType="done"
            onSubmitEditing={canSubmit ? (tab === 'login' ? handleLogin : handleRegister) : undefined}
          />

          <TouchableOpacity
            style={[styles.btn, !canSubmit && styles.btnDisabled]}
            onPress={tab === 'login' ? handleLogin : handleRegister}
            disabled={!canSubmit}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnText}>
                  {tab === 'login' ? 'Iniciar sesión' : 'Crear cuenta y empresa'}
                </Text>
            }
          </TouchableOpacity>
        </View>

        {/* Separador */}
        <View style={styles.separator}>
          <View style={styles.line} />
          <Text style={styles.orText}>o</Text>
          <View style={styles.line} />
        </View>

        {/* Botón modo prueba */}
        <TouchableOpacity style={styles.demoBtn} onPress={handleDemo} disabled={loading}>
          <Text style={styles.demoIcon}>🧪</Text>
          <View>
            <Text style={styles.demoBtnText}>Entrar como Admin (modo prueba)</Text>
            <Text style={styles.demoBtnSub}>Crea automáticamente una cuenta de demostración</Text>
          </View>
        </TouchableOpacity>

        <Text style={styles.footer}>
          {tab === 'login'
            ? '¿No tienes cuenta? Usa la pestaña "Crear cuenta" o pide acceso a tu supervisor.'
            : 'Al registrarte serás administrador de tu empresa y podrás invitar a tu equipo.'}
        </Text>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: BRAND.gray },
  scroll:         { flexGrow: 1, justifyContent: 'center', padding: 24 },
  logoArea:       { alignItems: 'center', marginBottom: 24 },
  logoBox:        {
    width: 68, height: 68, borderRadius: 18,
    backgroundColor: BRAND.blue, justifyContent: 'center', alignItems: 'center',
    marginBottom: 10, elevation: 6,
    shadowColor: BRAND.blue, shadowOpacity: 0.3, shadowOffset: { width: 0, height: 4 }, shadowRadius: 8,
  },
  logoIcon:       { fontSize: 30 },
  logoText:       { fontSize: 26, fontWeight: '800', color: BRAND.navy },
  logoSub:        { fontSize: 13, color: '#90A4AE', marginTop: 4 },
  tabs:           {
    flexDirection: 'row', backgroundColor: '#fff',
    borderRadius: 12, marginBottom: 12, padding: 4,
  },
  tabBtn:         { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  tabBtnActive:   { backgroundColor: BRAND.blue },
  tabText:        { fontSize: 14, fontWeight: '600', color: '#90A4AE' },
  tabTextActive:  { color: '#fff' },
  card:           { backgroundColor: '#fff', borderRadius: 18, padding: 20, marginBottom: 12 },
  label:          { fontSize: 11, fontWeight: '700', color: '#90A4AE', textTransform: 'uppercase', marginBottom: 6, marginTop: 12 },
  input:          {
    borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 10,
    padding: 13, fontSize: 15, color: BRAND.navy, backgroundColor: BRAND.gray,
  },
  btn:            { backgroundColor: BRAND.blue, borderRadius: 12, padding: 15, alignItems: 'center', marginTop: 20 },
  btnDisabled:    { opacity: 0.5 },
  btnText:        { color: '#fff', fontSize: 15, fontWeight: '700' },
  separator:      { flexDirection: 'row', alignItems: 'center', marginVertical: 12 },
  line:           { flex: 1, height: 1, backgroundColor: '#E0E0E0' },
  orText:         { marginHorizontal: 12, color: '#90A4AE', fontSize: 13 },
  demoBtn:        {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff', borderRadius: 14, padding: 14,
    borderWidth: 2, borderColor: BRAND.orange, marginBottom: 16,
  },
  demoIcon:       { fontSize: 24 },
  demoBtnText:    { fontSize: 14, fontWeight: '700', color: BRAND.orange },
  demoBtnSub:     { fontSize: 11, color: '#90A4AE', marginTop: 2 },
  footer:         { fontSize: 12, color: '#90A4AE', textAlign: 'center', lineHeight: 18 },
});
