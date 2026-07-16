import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet, ScrollView } from 'react-native';
import { useCurrency } from '../hooks/useCurrency';
import { useI18n } from '../hooks/useI18n';
import { CURRENCIES } from '../lib/currency';
import { BRAND } from '@gastocheck/shared';

export function CurrencySwitcher() {
  const { currency, setCurrency, availableCurrencies } = useCurrency();
  const { t } = useI18n();

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{t('common.currency')}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroll}>
        <View style={styles.buttonGroup}>
          {availableCurrencies.map(code => {
            const currencyInfo = CURRENCIES[code];
            return (
              <TouchableOpacity
                key={code}
                style={[
                  styles.button,
                  currency === code && styles.buttonActive,
                ]}
                onPress={() => setCurrency(code)}
              >
                <Text style={styles.buttonSymbol}>{currencyInfo.symbol}</Text>
                <Text
                  style={[
                    styles.buttonText,
                    currency === code && styles.buttonTextActive,
                  ]}
                >
                  {code}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
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
  scroll: {
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  button: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    backgroundColor: '#fff',
    alignItems: 'center',
    minWidth: 60,
  },
  buttonActive: {
    borderColor: BRAND.green,
    backgroundColor: BRAND.green + '15',
  },
  buttonSymbol: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  buttonText: {
    fontSize: 11,
    fontWeight: '600',
    color: BRAND.navy,
  },
  buttonTextActive: {
    color: BRAND.green,
    fontWeight: '700',
  },
});
