import AsyncStorage from '@react-native-async-storage/async-storage';

const DEVICE_ID_KEY = 'gastocheck_device_id';
const TRIAL_INFO_KEY = 'gastocheck_trial_info';

export interface TrialInfo {
  companyId: string;
  trialEndsAt: string;
  trialDays: number;
}

/** Genera o recupera un Device ID persistente para control de trial */
export async function getDeviceId(): Promise<string> {
  try {
    let id = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = 'dev_' + Array.from({ length: 32 }, () =>
        Math.floor(Math.random() * 16).toString(16)
      ).join('');
      await AsyncStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    return 'dev_fallback_' + Date.now();
  }
}

/** Guarda info del trial localmente para mostrar el banner sin query */
export async function saveTrialInfo(info: TrialInfo): Promise<void> {
  try {
    await AsyncStorage.setItem(TRIAL_INFO_KEY, JSON.stringify(info));
  } catch {
    // non-critical
  }
}

/** Lee el trial guardado localmente */
export async function getLocalTrialInfo(): Promise<TrialInfo | null> {
  try {
    const raw = await AsyncStorage.getItem(TRIAL_INFO_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Días restantes del trial (negativo = expirado) */
export function trialDaysRemaining(trialEndsAt: string): number {
  const ms = new Date(trialEndsAt).getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

/** ¿El trial está activo? */
export function isTrialActive(trialEndsAt: string | null | undefined): boolean {
  if (!trialEndsAt) return false;
  return new Date(trialEndsAt).getTime() > Date.now();
}
