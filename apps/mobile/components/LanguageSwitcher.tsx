import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useI18n } from '../hooks/useI18n';
import { BRAND } from '@gastocheck/shared';

export function LanguageSwitcher() {
  const { language, changeLanguage } = useI18n();

  const languages = [
    { code: 'es', label: '🇲🇽 Español' },
    { code: 'en', label: '🇺🇸 English' },
    { code: 'pt-BR', label: '🇧🇷 Português' },
  ];

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Idioma / Language / Idioma</Text>
      <View style={styles.buttonGroup}>
        {languages.map(lang => (
          <TouchableOpacity
            key={lang.code}
            style={[
              styles.button,
              language === lang.code && styles.buttonActive,
            ]}
            onPress={() => changeLanguage(lang.code)}
          >
            <Text
              style={[
                styles.buttonText,
                language === lang.code && styles.buttonTextActive,
              ]}
            >
              {lang.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
    paddingHorizontal: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#90A4AE',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  button: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  buttonActive: {
    borderColor: BRAND.blue,
    backgroundColor: BRAND.blue + '15',
  },
  buttonText: {
    fontSize: 12,
    fontWeight: '600',
    color: BRAND.navy,
  },
  buttonTextActive: {
    color: BRAND.blue,
    fontWeight: '700',
  },
});
