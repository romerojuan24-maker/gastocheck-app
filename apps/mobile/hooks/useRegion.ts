import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { REGIONS, type RegionCode, getRegion } from '../lib/regions';

const STORAGE_KEY = 'user-region';

export function useRegion() {
  const [region, setRegionState] = useState<RegionCode>('MX');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored && stored in REGIONS) {
        setRegionState(stored as RegionCode);
      }
      setLoading(false);
    })();
  }, []);

  const setRegion = async (newRegion: RegionCode) => {
    setRegionState(newRegion);
    await AsyncStorage.setItem(STORAGE_KEY, newRegion);
  };

  const regionInfo = getRegion(region);

  return {
    region,
    setRegion,
    loading,
    name: regionInfo.name,
    emoji: regionInfo.emoji,
    currency: regionInfo.currency,
    language: regionInfo.language,
    taxSystem: regionInfo.taxSystem,
    defaultVAT: regionInfo.defaultVAT,
    idType: regionInfo.idType,
    invoiceSystem: regionInfo.invoiceSystem,
    decimalSeparator: regionInfo.decimalSeparator,
    thousandsSeparator: regionInfo.thousandsSeparator,
    availableRegions: Object.keys(REGIONS) as RegionCode[],
  };
}
