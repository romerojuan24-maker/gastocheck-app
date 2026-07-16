import AsyncStorage from '@react-native-async-storage/async-storage';

const SUITE_APPS_KEY = '@gastocheck_suite_apps_session';
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 horas

export async function validateSuiteAppsPassword(password: string): Promise<boolean> {
  return password === 'suite1';
}

export async function setSuiteAppsSession(): Promise<void> {
  const expiresAt = Date.now() + SESSION_DURATION_MS;
  await AsyncStorage.setItem(SUITE_APPS_KEY, JSON.stringify({ expiresAt }));
}

export async function getSuiteAppsSession(): Promise<{ isValid: boolean; expiresAt?: number }> {
  try {
    const session = await AsyncStorage.getItem(SUITE_APPS_KEY);
    if (!session) return { isValid: false };

    const { expiresAt } = JSON.parse(session);
    if (Date.now() > expiresAt) {
      await AsyncStorage.removeItem(SUITE_APPS_KEY);
      return { isValid: false };
    }

    return { isValid: true, expiresAt };
  } catch {
    return { isValid: false };
  }
}

export async function clearSuiteAppsSession(): Promise<void> {
  await AsyncStorage.removeItem(SUITE_APPS_KEY);
}

export async function getRemainingSessionTime(): Promise<number> {
  const { expiresAt } = await getSuiteAppsSession();
  if (!expiresAt) return 0;
  return Math.max(0, expiresAt - Date.now());
}
