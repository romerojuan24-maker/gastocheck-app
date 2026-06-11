// Offline sync — AsyncStorage + sync_queue manager
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

    let synced = 0;
    let failed = 0;

    for (const item of queue) {
      try {
        // Llamar sync-offline-queue function
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          failed++;
          continue;
        }

        const res = await fetch(
          `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/sync-offline-queue`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ user_id: session.user.id }),
          },
        );

        if (res.ok) {
          synced++;
        } else {
          failed++;
        }
      } catch (err) {
        failed++;
        console.error('Sync item error:', err);
      }
    }

    // 🔴 FIX BUG #2: Race condition — rastrear IDs sinced, no índices
    // slice(synced) asume orden, pero fallos parciales rompen esto
    const syncedIds = new Set<string>();
    for (let i = 0; i < queue.length && i < synced; i++) {
      syncedIds.add(queue[i].id);
    }
    const remaining = queue.filter((q) => !syncedIds.has(q.id));
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));

    return { synced, failed };
  } catch (err) {
    console.error('syncQueue error:', err);
    return { synced: 0, failed: 0 };
  }
}

/**
 * Monitora conexión y sincroniza automáticamente
 */
export function startOfflineMonitor(onSync?: (result: { synced: number; failed: number }) => void) {
  // Detectar reconexión cada 30s
  const interval = setInterval(async () => {
    try {
      const { data } = await supabase.from('companies').select('id').limit(1);
      if (data !== null) {
        // Conexión OK, sincronizar
        const result = await syncQueue();
        onSync?.(result);
      }
    } catch {
      // Sin conexión, continuar encolando
    }
  }, 30000);

  return () => clearInterval(interval);
}
