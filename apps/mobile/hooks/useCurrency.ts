import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CURRENCIES, type CurrencyCode, formatCurrency, getCurrencySymbol } from '../lib/currency';

const STORAGE_KEY = 'user-currency';

export function useCurrency() {
  const [currency, setCurrencyState] = useState<CurrencyCode>('MXN');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored && stored in CURRENCIES) {
        setCurrencyState(stored as CurrencyCode);
      }
      setLoading(false);
    })();
  }, []);

  const setCurrency = async (newCurrency: CurrencyCode) => {
    setCurrencyState(newCurrency);
    await AsyncStorage.setItem(STORAGE_KEY, newCurrency);
  };

  return {
    currency,
    setCurrency,
    loading,
    format: (amount: number) => formatCurrency(amount, currency),
    symbol: getCurrencySymbol(currency),
    availableCurrencies: Object.keys(CURRENCIES) as CurrencyCode[],
  };
}
