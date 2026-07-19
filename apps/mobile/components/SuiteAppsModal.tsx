import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Modal, ActivityIndicator, Platform } from 'react-native';
import { BRAND } from '@gastocheck/shared';
import { validateSuiteAppsPassword, setSuiteAppsSession, getRemainingSessionTime } from '../lib/suiteAppsAuth';

interface SuiteAppsModalProps {
  visible: boolean;
  onDismiss: () => void;
  onSuccess: () => void;
}

export function SuiteAppsModal({ visible, onDismiss, onSuccess }: SuiteAppsModalProps) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleAuthenticate = async () => {
    if (!password.trim()) {
      Alert.alert('Error', 'Ingresa la contraseña');
      return;
    }

    setLoading(true);
    try {
      const isValid = await validateSuiteAppsPassword(password.trim());
      if (!isValid) {
        Alert.alert('Acceso denegado', 'Contraseña incorrecta');
        return;
      }

      await setSuiteAppsSession();
      setPassword('');
      onSuccess();
    } catch (err) {
      Alert.alert('Error', 'No se pudo establecer la sesión');
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = () => {
    setPassword('');
    onDismiss();
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={s.overlay}>
        <View style={s.container}>
          <Text style={s.title}>🔐 Suite Apps</Text>
          <Text style={s.subtitle}>Acceso a herramientas avanzadas</Text>

          <View style={s.form}>
            <Text style={s.label}>Contraseña</Text>
            <View style={s.inputContainer}>
              <TextInput
                style={s.input}
                placeholder="Ingresa contraseña"
                placeholderTextColor="#90A4AE"
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
                editable={!loading}
              />
              <TouchableOpacity
                style={s.eyeBtn}
                onPress={() => setShowPassword(!showPassword)}
                disabled={loading}
              >
                <Text style={s.eyeIcon}>{showPassword ? '👁️' : '👁️‍🗨️'}</Text>
              </TouchableOpacity>
            </View>

            <Text style={s.info}>Sesión válida por 24 horas desde acceso</Text>
          </View>

          <View style={s.actions}>
            <TouchableOpacity
              style={[s.btn, s.btnCancel]}
              onPress={handleDismiss}
              disabled={loading}
              activeOpacity={0.7}
            >
              <Text style={s.btnCancelText}>Cancelar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.btn, s.btnAccess]}
              onPress={handleAuthenticate}
              disabled={loading}
              activeOpacity={0.7}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={s.btnAccessText}>Acceder</Text>
              )}
            </TouchableOpacity>
          </View>

          <Text style={s.footer}>Todos los datos están encriptados</Text>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 24,
    width: '85%',
    maxWidth: 380,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: BRAND.navy,
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: '#90A4AE',
    textAlign: 'center',
    marginBottom: 24,
  },
  form: {
    marginBottom: 24,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: BRAND.navy,
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    paddingRight: 12,
    marginBottom: 12,
  },
  input: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: BRAND.navy,
  },
  eyeBtn: {
    padding: 4,
  },
  eyeIcon: {
    fontSize: 16,
  },
  info: {
    fontSize: 12,
    color: '#90A4AE',
    fontStyle: 'italic',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  btn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnCancel: {
    backgroundColor: '#F5F7FA',
  },
  btnCancelText: {
    fontSize: 14,
    fontWeight: '700',
    color: BRAND.navy,
  },
  btnAccess: {
    backgroundColor: BRAND.navy,
  },
  btnAccessText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  footer: {
    fontSize: 11,
    color: '#90A4AE',
    textAlign: 'center',
    marginTop: 12,
  },
});
