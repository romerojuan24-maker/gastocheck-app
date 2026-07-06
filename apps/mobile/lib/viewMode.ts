// Vista de panel GLOBAL — se elige una sola vez (en el home de CHECK SUITE)
// y aplica igual en GastoCheck, FlujoCheck, BancoCheck, FacturaCheck y
// CobraCheck. Antes cada módulo guardaba su propio viewMode en una llave
// de AsyncStorage separada (flujocheck_viewMode, etc.) — quedaba
// desincronizado entre módulos y el usuario tenía que elegirlo varias veces.
import AsyncStorage from '@react-native-async-storage/async-storage';

export type GlobalViewMode = 'admin' | 'contador' | 'operational';

const KEY = 'checksuite_globalViewMode';

export async function getGlobalViewMode(): Promise<GlobalViewMode> {
  const saved = await AsyncStorage.getItem(KEY);
  if (saved === 'admin' || saved === 'contador' || saved === 'operational') return saved;
  return 'admin';
}

export async function setGlobalViewMode(mode: GlobalViewMode): Promise<void> {
  await AsyncStorage.setItem(KEY, mode);
}
