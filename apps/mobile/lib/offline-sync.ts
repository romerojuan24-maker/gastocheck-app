// Offline sync — AsyncStorage queue (sin NetInfo: módulo nativo no disponible en APK actual)
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

const QUEUE_KEY = 'gastocheck_sync_queue';

export interface QueueItem {
  id: string;
  entityType: 'receipt' | 'advance_request' | 'expense';
  operation: 'create' | 'update' | 'delete';
  payload: Record<string, any>;
  createdAt: number;
}

export async function enqueueOffline(
  entityType: 'receipt' | 'advance_request' | 'expense',
  operation: 'create' | 'update' | 'delete',
  payload: Record<string, any>,
): Promise<void> {
  try {
    const queue = await getQueue();
    queue.push({
      id: `${Date.now()}_${entityType}`,
      entityType,
      operation,
      payload,
      createdAt: Date.now(),
    });
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch (err) {
    console.error('enqueueOffline error:', err);
  }
}

export async function getQueue(): Promise<QueueItem[]> {
  try {
    const json = await AsyncStorage.getItem(QUEUE_KEY);
    return json ? JSON.parse(json) : [];
  } catch {
    return [];
  }
}

export async function syncQueue(): Promise<{ synced: number; failed: number }> {
  try {
    const queue = await getQueue();
    if (queue.length === 0) return { synced: 0, failed: 0 };

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return { synced: 0, failed: queue.length };

    let synced = 0;
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
            body: JSON.stringify({ queueItem: item, user_id: session.user.id }),
          },
        );
        if (res.ok) { synced++; synced_ids.push(item.id); }
      } catch (err) {
        console.error(`[Offline Sync] Failed ${item.id}:`, err);
      }
    }

    const remaining = queue.filter(q => !synced_ids.includes(q.id));
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
    return { synced, failed: queue.length - synced };
  } catch (err) {
    console.error('syncQueue error:', err);
    return { synced: 0, failed: 0 };
  }
}

// startOfflineMonitor: stub sin NetInfo (módulo nativo no en APK)
// Intenta sincronizar al inicio si hay items en cola
export function startOfflineMonitor(onSync?: (r: { synced: number; failed: number }) => void) {
  // Sync inicial diferido
  setTimeout(async () => {
    try {
      const queue = await getQueue();
      if (queue.length > 0) {
        const result = await syncQueue();
        if (result.synced > 0) onSync?.(result);
      }
    } catch {}
  }, 3000);

  // Retry cada 5 minutos
  const interval = setInterval(async () => {
    try {
      const queue = await getQueue();
      if (queue.length === 0) return;
      const result = await syncQueue();
      if (result.synced > 0) onSync?.(result);
    } catch {}
  }, 5 * 60 * 1000);

  return () => clearInterval(interval);
}
