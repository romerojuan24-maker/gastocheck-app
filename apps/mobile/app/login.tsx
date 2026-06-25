import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, Alert, ScrollView,
} from 'react-native';
import { BRAND } from '@gastocheck/shared';
import { supabase } from '../lib/supabase';
import { getDeviceId, saveTrialInfo } from '../lib/trial';

type Tab = 'login' | 'register';

const DEMO_EMAIL    = 'demo@gastocheck.app';
const DEMO_PASSWORD = 'Demo2026!';
const REGISTER_FN   = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/register-company`;

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
    if (error) {
      const msg = error.message.includes('Invalid login credentials')
        ? 'Correo o contraseña incorrectos.'
        : error.message;
      Alert.alert('Error al iniciar sesión', msg);
    }
  }

  // ── Registrar cuenta nueva (via Edge Function — bypassa RLS) ────────────────

  async function handleRegister() {
    if (!email.trim() || !password || !company.trim()) return;
    if (password.length < 8) {
      Alert.alert('Contraseña muy corta', 'Debe tener al menos 8 caracteres.');
      return;
    }
    setLoading(true);
    try {
      const deviceId = await getDeviceId();

      const res = await fetch(REGISTER_FN, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email:        email.trim().toLowerCase(),
          password,
          company_name: company.trim(),
          device_id:    deviceId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        const code = data.code ?? '';
        if (code === 'TRIAL_DEVICE_EXISTS') {
          Alert.alert(
            'Dispositivo ya registrado',
            'Este dispositivo ya tiene una cuenta de prueba.\n\nInicia sesión con tu cuenta original.',
            [{ text: 'Ir a Iniciar sesión', onPress: () => setTab('login') }],
          );
        } else {
          Alert.alert('Error al registrar', data.error ?? 'Inténtalo de nuevo.');
        }
        return;
      }

      // Guardar info del trial localmente para el banner
      if (data.trial_ends_at) {
        await saveTrialInfo({
          companyId:   data.company_id,
          trialEndsAt: data.trial_ends_at,
          trialDays:   data.trial_days ?? 30,
        });
      }

      // Auto-login: el usuario ya está confirmado, no necesita verificar email
      const { error: loginErr } = await supabase.auth.signInWithPassword({
        email:    email.trim().toLowerCase(),
        password,
      });

      if (loginErr) {
        Alert.alert(
          '¡Cuenta creada!',
          'Tu cuenta y empresa están listas. Inicia sesión para continuar.',
        );
        setTab('login');
        setEmail(email.trim().toLowerCase());
        setPassword('');
        setCompany('');
      }
      // Si el login fue exitoso, el navigator detecta la sesión y redirige solo
    } catch (err: any) {
      Alert.alert('Error al registrar', err.message ?? 'Verifica tu conexión e inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  // ── Modo demo (login rápido para probar la app) ─────────────────────────────

  async function handleDemo() {
    setLoading(true);

    // Intentar login primero
    const { error: loginErr } = await supabase.auth.signInWithPassword({
      email:    DEMO_EMAIL,
      password: DEMO_PASSWORD,
    });

    if (!loginErr) { setLoading(false); return; }

    // Si no existe, crear via edge function
    const deviceId = await getDeviceId();
    const res = await fetch(REGISTER_FN, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email:        DEMO_EMAIL,
        password:     DEMO_PASSWORD,
        company_name: 'Empresa Demo GastoCheck',
        device_id:    `demo_${deviceId}`,  // prefijo para no bloquear el device real
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      // Si ya existe el usuario pero el login falló, puede ser tema de contraseña
      if (data.error?.includes('already registered')) {
        Alert.alert('Modo demo', 'La cuenta demo ya existe pero no se pudo acceder. Contacta soporte.');
      } else {
        Alert.alert('Error modo demo', data.error ?? 'No se pudo crear la cuenta demo.');
      }
      setLoading(false);
      return;
    }

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
            <Text style={styles.logoIcon}>✓</Text>
          </View>
          <Text style={styles.logoText}>CHECK SUITE</Text>
          <Text style={styles.logoSub}>Control total de tu negocio</Text>
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
              {/* Escape hatch visible — evita que el usuario quede atrapado */}
              <TouchableOpacity style={styles.backLink} onPress={() => setTab('login')}>
                <Text style={styles.backLinkText}>← Volver a Iniciar sesión</Text>
              </TouchableOpacity>

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
                  {tab === 'login' ? 'Iniciar sesión' : 'Crear cuenta — 30 días gratis'}
                </Text>
            }
          </TouchableOpacity>

          {tab === 'register' && (
            <>
              <Text style={styles.trialNote}>
                ✓ 30 días de prueba gratuita · Sin tarjeta · 1 usuario dueño + 1 comprador
              </Text>
              <TouchableOpacity style={styles.demoLinkBtn} onPress={handleDemo} disabled={loading}>
                <Text style={styles.demoLinkText}>🧪 Solo quiero ver el demo</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Separador */}
        <View style={styles.separator}>
          <View style={styles.line} />
          <Text style={styles.orText}>o</Text>
          <View style={styles.line} />
        </View>

        {/* Botón modo demo */}
        <TouchableOpacity style={styles.demoBtn} onPress={handleDemo} disabled={loading}>
          <Text style={styles.demoIcon}>🧪</Text>
          <View>
            <Text style={styles.demoBtnText}>Ver demo de la app</Text>
            <Text style={styles.demoBtnSub}>Entra sin registrarte con datos de ejemplo</Text>
          </View>
        </TouchableOpacity>

        <Text style={styles.footer}>
          {tab === 'login'
            ? '¿No tienes cuenta? Usa "Crear cuenta" o pide acceso a tu supervisor.'
            : 'Al registrarte serás el administrador y podrás invitar a un colaborador durante la prueba.'}
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
    backgroundColor: BRAND.csblue, justifyContent: 'center', alignItems: 'center',
    marginBottom: 10, elevation: 6,
    shadowColor: BRAND.csblue, shadowOpacity: 0.3, shadowOffset: { width: 0, height: 4 }, shadowRadius: 8,
  },
  logoIcon:       { fontSize: 34, fontWeight: '900', color: '#fff' },
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
  trialNote:      { fontSize: 11, color: '#78909C', textAlign: 'center', marginTop: 10 },
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
  backLink:       { marginBottom: 12 },
  backLinkText:   { fontSize: 13, color: BRAND.blue, fontWeight: '600' },
  demoLinkBtn:    { alignItems: 'center', marginTop: 12, paddingVertical: 8 },
  demoLinkText:   { fontSize: 13, color: BRAND.orange, fontWeight: '600' },
});
