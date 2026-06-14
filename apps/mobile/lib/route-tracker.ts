// Rastreo de ruta del día — almacenamiento local + sincronización por WiFi
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as Network from 'expo-network';
import { supabase } from './supabase';

export interface RoutePoint {
  lat:   number;
  lng:   number;
  ts:    string;   // ISO timestamp
  note?: string;   // check-in manual
}

interface DayStore {
  points: RoutePoint[];
  synced: boolean;
}

// ── Clave de almacenamiento ────────────────────────────────────────────────────

export function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function storageKey(userId: string, date: string) {
  return `gc_route_${userId}_${date}`;
}

// ── Fórmula haversine ─────────────────────────────────────────────────────────

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R     = 6371;
  const dLat  = (lat2 - lat1) * Math.PI / 180;
  const dLng  = (lng2 - lng1) * Math.PI / 180;
  const a     = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function calcTotalKm(points: RoutePoint[]): number {
  let km = 0;
  for (let i = 1; i < points.length; i++) {
    km += haversineKm(points[i - 1].lat, points[i - 1].lng, points[i].lat, points[i].lng);
  }
  return Math.round(km * 10) / 10;
}

// ── Permisos ──────────────────────────────────────────────────────────────────

export async function requestLocationPermission(): Promise<boolean> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === 'granted';
}

export async function hasLocationPermission(): Promise<boolean> {
  const { status } = await Location.getForegroundPermissionsAsync();
  return status === 'granted';
}

// ── GPS ───────────────────────────────────────────────────────────────────────

export async function captureCurrentPosition(note?: string): Promise<RoutePoint | null> {
  try {
    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return {
      lat:  loc.coords.latitude,
      lng:  loc.coords.longitude,
      ts:   new Date().toISOString(),
      note: note || undefined,
    };
  } catch {
    return null;
  }
}

// ── AsyncStorage ──────────────────────────────────────────────────────────────

async function readDay(userId: string, date: string): Promise<DayStore> {
  const raw = await AsyncStorage.getItem(storageKey(userId, date));
  if (!raw) return { points: [], synced: false };
  return JSON.parse(raw) as DayStore;
}

async function writeDay(userId: string, date: string, store: DayStore) {
  await AsyncStorage.setItem(storageKey(userId, date), JSON.stringify(store));
}

export async function loadTodayPoints(userId: string): Promise<RoutePoint[]> {
  const store = await readDay(userId, todayStr());
  return store.points;
}

export async function addPointToday(userId: string, point: RoutePoint): Promise<RoutePoint[]> {
  const date  = todayStr();
  const store = await readDay(userId, date);
  store.points.push(point);
  store.synced = false;
  await writeDay(userId, date, store);
  return store.points;
}

// ── Sincronización por WiFi ───────────────────────────────────────────────────

export async function isOnWifi(): Promise<boolean> {
  const net = await Network.getNetworkStateAsync();
  return net.type === Network.NetworkStateType.WIFI && (net.isConnected ?? false);
}

export async function syncPendingRoutes(
  userId: string,
  companyId: string,
): Promise<{ synced: number; pending: number; wifiAvailable: boolean }> {
  const wifi = await isOnWifi();
  if (!wifi) {
    const allKeys = await AsyncStorage.getAllKeys();
    const pendingCount = allKeys.filter(
      k => k.startsWith(`gc_route_${userId}_`) && !k.endsWith('_marker'),
    ).length;
    return { synced: 0, pending: pendingCount, wifiAvailable: false };
  }

  const allKeys = await AsyncStorage.getAllKeys();
  const routeKeys = allKeys.filter(k => k.startsWith(`gc_route_${userId}_`));
  let synced = 0;
  let pending = 0;

  for (const key of routeKeys) {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) continue;
    const store: DayStore = JSON.parse(raw);
    if (store.synced || store.points.length === 0) continue;

    const date     = key.replace(`gc_route_${userId}_`, '');
    const total_km = calcTotalKm(store.points);

    const { error } = await supabase.from('daily_routes').upsert(
      { company_id: companyId, user_id: userId, route_date: date, points: store.points, total_km },
      { onConflict: 'user_id,route_date' },
    );

    if (!error) {
      store.synced = true;
      await AsyncStorage.setItem(key, JSON.stringify(store));
      synced++;
    } else {
      pending++;
    }
  }

  return { synced, pending, wifiAvailable: true };
}
