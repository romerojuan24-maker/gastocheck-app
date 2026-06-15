import { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { getQueue } from '../lib/offline-sync';

export interface OfflineStatus {
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
}

export function useOfflineStatus() {
  const [status, setStatus] = useState<OfflineStatus>({
    isOnline: true,
    pendingCount: 0,
    isSyncing: false,
  });

  useEffect(() => {
    let mounted = true;

    const checkStatus = async () => {
      try {
        const netState = await NetInfo.fetch();
        const queue = await getQueue();

        if (mounted) {
          setStatus({
            isOnline: netState.isConnected && netState.isInternetReachable,
            pendingCount: queue.length,
            isSyncing: false,
          });
        }
      } catch (err) {
        console.error('[useOfflineStatus] Check error:', err);
      }
    };

    // Chequeo inicial
    checkStatus();

    // Suscribirse a cambios de red
    const unsubscribe = NetInfo.addEventListener(async (state) => {
      const queue = await getQueue();
      if (mounted) {
        setStatus({
          isOnline: state.isConnected && state.isInternetReachable,
          pendingCount: queue.length,
          isSyncing: false,
        });
      }
    });

    // Chequeo cada 10s para actualizar pending count
    const interval = setInterval(async () => {
      const queue = await getQueue();
      if (mounted) {
        setStatus((prev) => ({
          ...prev,
          pendingCount: queue.length,
        }));
      }
    }, 10000);

    return () => {
      mounted = false;
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  return status;
}
