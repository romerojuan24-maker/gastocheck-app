import { useEffect, useState } from 'react';
import { getQueue } from '../lib/offline-sync';

export interface OfflineStatus {
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
}

// Stub sin @react-native-community/netinfo (módulo nativo no en APK actual)
// Asume siempre online; sigue trackeando la cola local.
export function useOfflineStatus() {
  const [status, setStatus] = useState<OfflineStatus>({
    isOnline: true,
    pendingCount: 0,
    isSyncing: false,
  });

  useEffect(() => {
    let mounted = true;

    const check = async () => {
      try {
        const queue = await getQueue();
        if (mounted) setStatus({ isOnline: true, pendingCount: queue.length, isSyncing: false });
      } catch {}
    };

    check();
    const interval = setInterval(check, 30000);
    return () => { mounted = false; clearInterval(interval); };
  }, []);

  return status;
}
