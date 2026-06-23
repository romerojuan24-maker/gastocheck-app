// Rastreo local de movimientos de cobranza — almacenamiento + sincronización por WiFi
// Sigue el mismo patrón que route-tracker.ts para GastoCheck

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { type CobraMovement } from '@gastocheck/shared';

export interface LocalMovement {
  id: string;
  movement: CobraMovement;
  synced: boolean;
}

interface MovementStore {
  movements: LocalMovement[];
  synced: boolean;
}

// ── Clave de almacenamiento ────────────────────────────────────────────────────

export function getTodayKey(userId: string): string {
  const today = new Date().toISOString().slice(0, 10);
  return `cobra_movements_${userId}_${today}`;
}

// ── AsyncStorage ──────────────────────────────────────────────────────────────

async function readDay(userId: string): Promise<MovementStore> {
  const raw = await AsyncStorage.getItem(getTodayKey(userId));
  if (!raw) return { movements: [], synced: false };
  try {
    return JSON.parse(raw) as MovementStore;
  } catch {
    return { movements: [], synced: false };
  }
}

async function writeDay(userId: string, store: MovementStore): Promise<void> {
  await AsyncStorage.setItem(getTodayKey(userId), JSON.stringify(store));
}

// ── API público ───────────────────────────────────────────────────────────────

export async function loadTodayMovements(userId: string): Promise<LocalMovement[]> {
  const store = await readDay(userId);
  return store.movements;
}

export async function addMovement(
  userId: string,
  movement: CobraMovement
): Promise<LocalMovement[]> {
  const store = await readDay(userId);
  const local: LocalMovement = {
    id: movement.id,
    movement,
    synced: false,
  };
  store.movements.push(local);
  store.synced = false;
  await writeDay(userId, store);
  return store.movements;
}

export async function updateMovement(
  userId: string,
  movementId: string,
  updates: Partial<CobraMovement>
): Promise<LocalMovement[]> {
  const store = await readDay(userId);
  const idx = store.movements.findIndex(m => m.id === movementId);
  if (idx >= 0) {
    store.movements[idx].movement = {
      ...store.movements[idx].movement,
      ...updates,
      updated_at: new Date().toISOString(),
    };
    store.movements[idx].synced = false;
    store.synced = false;
  }
  await writeDay(userId, store);
  return store.movements;
}

// ── Sincronización por WiFi ───────────────────────────────────────────────────

export async function syncPendingMovements(
  userId: string,
  companyId: string
): Promise<{
  synced: number;
  failed: number;
  pending: number;
}> {
  const store = await readDay(userId);
  let synced = 0;
  let failed = 0;
  let pending = 0;

  for (const local of store.movements) {
    if (local.synced) continue;

    try {
      const { error } = await supabase
        .from('cobra_movements')
        .upsert(
          {
            id: local.movement.id,
            company_id: companyId,
            user_id: userId,
            route_point_ts: local.movement.route_point_ts,
            client_id: local.movement.client_id,
            invoice_id: local.movement.invoice_id,
            folio: local.movement.folio,
            amount_original: local.movement.amount_original,
            movement_type: local.movement.movement_type,
            collected_amount: local.movement.collected_amount,
            promise_date: local.movement.promise_date,
            reason_not_paid: local.movement.reason_not_paid,
            photo_uri: local.movement.photo_uri,
            notes: local.movement.notes,
            created_at: local.movement.created_at,
          },
          { onConflict: 'id' }
        );

      if (error) {
        console.error(`Failed to sync movement ${local.id}:`, error);
        failed++;
      } else {
        local.synced = true;
        synced++;
      }
    } catch (e) {
      console.error(`Error syncing movement ${local.id}:`, e);
      failed++;
    }
  }

  pending = store.movements.filter(m => !m.synced).length;

  // Marcar día como sincronizado si todos lo están
  if (pending === 0) {
    store.synced = true;
  }
  await writeDay(userId, store);

  return { synced, failed, pending };
}

// ── Limpieza ──────────────────────────────────────────────────────────────

export async function clearTodayMovements(userId: string): Promise<void> {
  await AsyncStorage.removeItem(getTodayKey(userId));
}

export async function getMovementStats(userId: string): Promise<{
  total: number;
  collected: number;
  promises: number;
  notPaid: number;
  synced: number;
}> {
  const movements = await loadTodayMovements(userId);
  return {
    total: movements.length,
    collected: movements.filter(m => m.movement.movement_type === 'collected').length,
    promises: movements.filter(m => m.movement.movement_type === 'promise').length,
    notPaid: movements.filter(m => m.movement.movement_type === 'not_paid').length,
    synced: movements.filter(m => m.synced).length,
  };
}
