// Offline sync — AsyncStorage + network detection + queue manager
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { supabase } from './supabase';
import { sendLocalNotification } from './notifications';

const QUEUE_KEY = 'gastocheck_sync_queue';

export interface QueueItem {
  id: string;
  entityType: 'receipt' | 'advance_request' | 'expense';
  operation: 'create' | 'update' | 'delete';
  payload: Record<string, any>;
  createdAt: number;
}

/**
 * Encolador offline — cuando está sin conexión, guarda localmente
 */
export async function enqueueOffline(
  entityType: 'receipt' | 'advance_request' | 'expense',
  operation: 'create' | 'update' | 'delete',
  payload: Record<string, any>,
): Promise<void> {
  try {
    const queue = await getQueue();
    const item: QueueItem = {
      id: `${Date.now()}_${Math.random()}`,
      entityType,
      operation,
      payload,
      createdAt: Date.now(),
    };

    queue.push(item);
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch (err) {
    console.error('enqueueOffline error:', err);
  }
}

/**
 * Obtiene cola local
 */
export async function getQueue(): Promise<QueueItem[]> {
  try {
    const json = await AsyncStorage.getItem(QUEUE_KEY);
    return json ? JSON.parse(json) : [];
  } catch {
    return [];
  }
}

/**
 * Sincroniza cola con Supabase cuando se reconecta
 */
export async function syncQueue(): Promise<{ synced: number; failed: number }> {
  try {
    const queue = await getQueue();
    if (queue.length === 0) return { synced: 0, failed: 0 };

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return { synced: 0, failed: queue.length };

    let synced = 0;
    const failed_items: string[] = [];
    const synced_ids: string[] = [];

    for (const item of queue) {
      try {
        const res = await fetch(
          `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/sync-offline-queue`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              queueItem: item,
              user_id: session.user.id,
            }),
          },
        );

        if (res.ok) {
          synced++;
          synced_ids.push(item.id);
        } else {
          failed_items.push(item.id);
        }
      } catch (err) {
        failed_items.push(item.id);
        console.error(`[Offline Sync] Failed to sync ${item.id}:`, err);
      }
    }

    // Actualizar cola: remover items sincronizados exitosamente
    const remaining = queue.filter((q) => !synced_ids.includes(q.id));
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));

    return { synced, failed: failed_items.length };
  } catch (err) {
    console.error('syncQueue error:', err);
    return { synced: 0, failed: queue.length };
  }
}

let lastSyncTime = 0;
const SYNC_DEBOUNCE_MS = 3000; // No sincronizar más de una vez cada 3s

/**
 * Monitora conexión y sincroniza automáticamente al reconectarse
 */
export function startOfflineMonitor(onSync?: (result: { synced: number; failed: number }) => void) {
  // Suscribirse a cambios de red con NetInfo
  const unsubscribeNetInfo = NetInfo.addEventListener(async (state) => {
    if (state.isConnected && state.isInternetReachable) {
      const now = Date.now();
      // Debounce: no sincronizar si acaba de hacerse hace < 3s
      if (now - lastSyncTime < SYNC_DEBOUNCE_MS) return;
      lastSyncTime = now;

      try {
        const result = await syncQueue();
        if (result.synced > 0 || result.failed > 0) {
          console.log(`[Offline Sync] Synced: ${result.synced}, Failed: ${result.failed}`);

          // Notificar al usuario
          if (result.synced > 0) {
            await sendLocalNotification(
              '✓ Sincronizado',
              `${result.synced} comprobante${result.synced !== 1 ? 's' : ''} guardado${result.synced !== 1 ? 's' : ''}`,
              { deepLink: '/receipts' },
            );
          }
          if (result.failed > 0) {
            await sendLocalNotification(
              '⚠ Sincronización incompleta',
              `${result.failed} comprobante${result.failed !== 1 ? 's' : ''} aún pendiente${result.failed !== 1 ? 's' : ''}. Reintentaremos pronto.`,
            );
          }

          onSync?.(result);
        }
      } catch (err) {
        console.error('[Offline Sync] Monitor error:', err);
      }
    }
  });

  // Fallback: chequeo cada 60s por si NetInfo falla
  const interval = setInterval(async () => {
    try {
      const queue = await getQueue();
      if (queue.length === 0) return;

      const state = await NetInfo.fetch();
      if (state.isConnected && state.isInternetReachable) {
        const now = Date.now();
        if (now - lastSyncTime >= SYNC_DEBOUNCE_MS) {
          lastSyncTime = now;
          const result = await syncQueue();
          if (result.synced > 0) {
            await sendLocalNotification(
              '✓ Sincronizado',
              `${result.synced} comprobante${result.synced !== 1 ? 's' : ''} guardado${result.synced !== 1 ? 's' : ''}`,
            );
            onSync?.(result);
          }
        }
      }
    } catch (err) {
      console.error('[Offline Sync] Fallback check error:', err);
    }
  }, 60000);

  return () => {
    unsubscribeNetInfo();
    clearInterval(interval);
  };
}
