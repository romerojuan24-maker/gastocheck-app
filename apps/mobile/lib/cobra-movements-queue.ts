// Movimientos de cobranza del día — almacenamiento local + sincronización,
// mismo patrón que lib/route-tracker.ts para las rutas GPS. Antes,
// mi-ruta.tsx guardaba los movimientos solo en memoria de React: si no
// había WiFi en el momento exacto de guardar, el cobro se perdía sin
// aviso al cerrar la app o navegar fuera de la pantalla.
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Network from 'expo-network';
import { supabase } from './supabase';

export interface CobraMovement {
  local_id:          string;   // id local, no es el id de la fila en Supabase
  company_id:        string;
  user_id:           string;
  client_id:         string;
  client_name:       string;
  invoice_id?:       string;
  folio?:            string;
  route_point_ts:    string;
  amount_original:   number;
  movement_type:     'collected' | 'promise' | 'not_paid';
  collected_amount?: number;
  promise_date?:     string;
  reason_not_paid?:  string;
  method?:           'cash' | 'transfer' | 'check' | 'credit_card';
  photo_uri?:        string;
  notes?:            string;
  created_at:        string;
  synced:            boolean;
}

interface DayStore {
  movements: CobraMovement[];
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function storageKey(userId: string, date: string) {
  return `gc_cobra_movements_${userId}_${date}`;
}

async function readDay(userId: string, date: string): Promise<DayStore> {
  const raw = await AsyncStorage.getItem(storageKey(userId, date));
  if (!raw) return { movements: [] };
  return JSON.parse(raw) as DayStore;
}

async function writeDay(userId: string, date: string, store: DayStore) {
  await AsyncStorage.setItem(storageKey(userId, date), JSON.stringify(store));
}

export async function isOnline(): Promise<boolean> {
  const net = await Network.getNetworkStateAsync();
  return (net.isConnected ?? false) && (net.isInternetReachable ?? true);
}

export async function loadTodayMovements(userId: string): Promise<CobraMovement[]> {
  const store = await readDay(userId, todayStr());
  return store.movements;
}

async function insertToSupabase(m: CobraMovement): Promise<boolean> {
  const { error } = await supabase.from('cobra_movements').insert([{
    company_id:       m.company_id,
    user_id:          m.user_id,
    client_id:        m.client_id,
    invoice_id:       m.invoice_id,
    route_point_ts:   m.route_point_ts,
    amount_original:  m.amount_original,
    movement_type:    m.movement_type,
    collected_amount: m.collected_amount,
    promise_date:      m.promise_date,
    reason_not_paid:  m.reason_not_paid,
    method:           m.method,
    photo_uri:        m.photo_uri,
    notes:            m.notes,
  }]);
  return !error;
}

// Guarda el movimiento en el teléfono de inmediato (nunca se pierde) y,
// si hay red, intenta subirlo al toque.
export async function addMovementToday(
  userId: string,
  m: Omit<CobraMovement, 'local_id' | 'created_at' | 'synced'>,
): Promise<CobraMovement[]> {
  const date  = todayStr();
  const store = await readDay(userId, date);

  const record: CobraMovement = {
    ...m,
    local_id:   `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    created_at: new Date().toISOString(),
    synced:     false,
  };
  store.movements.push(record);
  await writeDay(userId, date, store);

  if (await isOnline()) {
    const ok = await insertToSupabase(record);
    if (ok) {
      record.synced = true;
      await writeDay(userId, date, store);
    }
  }

  return store.movements;
}

// Reintenta subir los movimientos de HOY que sigan sin sincronizar.
// Se puede llamar desde un botón "Sincronizar ahora" o al detectar red.
export async function syncPendingMovements(
  userId: string,
): Promise<{ synced: number; pending: number; online: boolean }> {
  const online = await isOnline();
  const date   = todayStr();
  const store  = await readDay(userId, date);
  const unsynced = store.movements.filter(m => !m.synced);

  if (!online) {
    return { synced: 0, pending: unsynced.length, online: false };
  }

  let synced = 0;
  for (const m of unsynced) {
    const ok = await insertToSupabase(m);
    if (ok) { m.synced = true; synced++; }
  }
  await writeDay(userId, date, store);

  const stillPending = store.movements.filter(x => !x.synced).length;
  return { synced, pending: stillPending, online: true };
}
