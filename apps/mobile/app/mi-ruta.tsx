// Mi ruta del día — mensajero/comprador registra su recorrido sin gastar datos
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Alert, TextInput, Modal,
} from 'react-native';
import { BRAND } from '@gastocheck/shared';
import { supabase } from '../lib/supabase';
import { getActiveMembership } from '../lib/membership';
import {
  requestLocationPermission, hasLocationPermission,
  captureCurrentPosition, addPointToday, loadTodayPoints,
  calcTotalKm, syncPendingRoutes, isOnWifi, todayStr,
  type RoutePoint,
} from '../lib/route-tracker';

const AUTO_INTERVAL_MS = 5 * 60 * 1000; // 5 minutos

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}

export default function MiRutaScreen() {
  const [userId,    setUserId]    = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [points,    setPoints]    = useState<RoutePoint[]>([]);
  const [tracking,  setTracking]  = useState(false);
  const [busy,      setBusy]      = useState(false);
  const [syncing,   setSyncing]   = useState(false);
  const [syncMsg,   setSyncMsg]   = useState('');
  const [wifi,      setWifi]      = useState(false);
  const [showNote,  setShowNote]  = useState(false);
  const [noteText,  setNoteText]  = useState('');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Init ──────────────────────────────────────────────────────────────────────

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const m = await getActiveMembership(user.id);
      if (m) setCompanyId(m.company_id);

      const pts = await loadTodayPoints(user.id);
      setPoints(pts);

      const w = await isOnWifi();
      setWifi(w);
    })();
  }, []);

  // ── Intervalo automático ──────────────────────────────────────────────────────

  const recordAuto = useCallback(async () => {
    if (!userId) return;
    const p = await captureCurrentPosition();
    if (p) {
      const updated = await addPointToday(userId, p);
      setPoints([...updated]);
    }
  }, [userId]);

  useEffect(() => {
    if (tracking) {
      intervalRef.current = setInterval(recordAuto, AUTO_INTERVAL_MS);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [tracking, recordAuto]);

  // ── Acciones ──────────────────────────────────────────────────────────────────

  async function handleStartTracking() {
    const has = await hasLocationPermission();
    if (!has) {
      const granted = await requestLocationPermission();
      if (!granted) {
        Alert.alert('Permiso necesario', 'Activa la ubicación para registrar tu ruta.');
        return;
      }
    }
    // Grabar punto inicial
    setBusy(true);
    const p = await captureCurrentPosition('Inicio de ruta');
    if (p && userId) {
      const updated = await addPointToday(userId, p);
      setPoints([...updated]);
    }
    setBusy(false);
    setTracking(true);
  }

  async function handleStopTracking() {
    if (!userId) return;
    setBusy(true);
    const p = await captureCurrentPosition('Fin de ruta');
    if (p) {
      const updated = await addPointToday(userId, p);
      setPoints([...updated]);
    }
    setBusy(false);
    setTracking(false);
  }

  async function handleManualCheckIn() {
    setShowNote(true);
  }

  async function confirmCheckIn() {
    if (!userId) return;
    setShowNote(false);
    setBusy(true);
    const p = await captureCurrentPosition(noteText.trim() || undefined);
    if (p) {
      const updated = await addPointToday(userId, p);
      setPoints([...updated]);
    }
    setNoteText('');
    setBusy(false);
  }

  async function handleSync() {
    if (!userId || !companyId) return;
    setSyncing(true);
    const result = await syncPendingRoutes(userId, companyId);
    setSyncing(false);
    if (!result.wifiAvailable) {
      setSyncMsg('Sin WiFi — los datos se subirán automáticamente al conectarte.');
    } else if (result.synced > 0) {
      setSyncMsg(`✅ ${result.synced} día(s) sincronizados correctamente.`);
    } else {
      setSyncMsg('Todo está al día, no hay pendientes.');
    }
  }

  const totalKm = calcTotalKm(points);
  const fecha   = todayStr();

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <View style={{ flex: 1, backgroundColor: BRAND.gray }}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>📍 Mi Ruta</Text>
        <Text style={styles.headerDate}>{fecha}</Text>
        <View style={styles.kpiRow}>
          <View style={styles.kpi}>
            <Text style={styles.kpiVal}>{totalKm.toFixed(1)} km</Text>
            <Text style={styles.kpiLabel}>recorridos</Text>
          </View>
          <View style={styles.kpi}>
            <Text style={styles.kpiVal}>{points.length}</Text>
            <Text style={styles.kpiLabel}>puntos</Text>
          </View>
          <View style={[styles.kpi, { alignItems: 'flex-end' }]}>
            <View style={[styles.wifiBadge, { backgroundColor: wifi ? BRAND.green + '20' : '#F5F5F5' }]}>
              <Text style={[styles.wifiText, { color: wifi ? BRAND.green : '#90A4AE' }]}>
                {wifi ? '📶 WiFi' : '📵 Sin WiFi'}
              </Text>
            </View>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>

        {/* Controles */}
        <View style={styles.card}>
          {!tracking ? (
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: BRAND.green }]}
              onPress={handleStartTracking}
              disabled={busy}
            >
              {busy
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.btnText}>▶  Iniciar seguimiento</Text>
              }
            </TouchableOpacity>
          ) : (
            <View style={{ gap: 8 }}>
              <View style={styles.trackingBanner}>
                <View style={styles.trackingDot} />
                <Text style={styles.trackingTxt}>Grabando automáticamente cada 5 min</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
                  style={[styles.btn, { flex: 1, backgroundColor: BRAND.blue }]}
                  onPress={handleManualCheckIn}
                  disabled={busy}
                >
                  <Text style={styles.btnText}>📌 Check-in</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn, { flex: 1, backgroundColor: BRAND.red }]}
                  onPress={handleStopTracking}
                  disabled={busy}
                >
                  <Text style={styles.btnText}>⏹ Detener</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* Sincronizar */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Sincronización</Text>
          <Text style={styles.syncInfo}>
            Los datos se guardan en tu teléfono y se suben al servidor solo cuando estés conectado a WiFi.
          </Text>
          {syncMsg ? <Text style={styles.syncMsg}>{syncMsg}</Text> : null}
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: BRAND.navy, marginTop: 8 }]}
            onPress={handleSync}
            disabled={syncing}
          >
            {syncing
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnText}>☁️  Sincronizar ahora</Text>
            }
          </TouchableOpacity>
        </View>

        {/* Línea de tiempo */}
        <Text style={styles.sectionLabel}>Puntos de hoy ({points.length})</Text>
        {points.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🗺</Text>
            <Text style={styles.emptyText}>
              Toca "Iniciar seguimiento" para comenzar a registrar tu ruta del día.
            </Text>
          </View>
        ) : (
          <View style={styles.timeline}>
            {[...points].reverse().map((p, i, arr) => {
              const isLast = i === arr.length - 1;
              const isManual = !!p.note;
              return (
                <View key={p.ts} style={styles.timelineItem}>
                  {/* Línea vertical */}
                  <View style={styles.timelineLeft}>
                    <View style={[styles.dot, isManual && { backgroundColor: BRAND.blue }]} />
                    {!isLast && <View style={styles.line} />}
                  </View>
                  {/* Contenido */}
                  <View style={styles.timelineContent}>
                    <Text style={styles.timelineTime}>{fmtTime(p.ts)}</Text>
                    <Text style={styles.timelineNote}>
                      {p.note ?? 'Punto automático'}
                    </Text>
                    <Text style={styles.timelineCoords}>
                      {p.lat.toFixed(5)}, {p.lng.toFixed(5)}
                    </Text>
                  </View>
                  {isManual && (
                    <View style={styles.manualBadge}>
                      <Text style={styles.manualBadgeText}>👆</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Modal check-in con nota */}
      <Modal visible={showNote} transparent animationType="slide" onRequestClose={() => setShowNote(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>¿Dónde estás?</Text>
            <Text style={styles.modalSub}>Opcional: agrega una nota para este punto</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Ej: Entrega en bodega norte, parada de gasolina..."
              placeholderTextColor="#B0BEC5"
              value={noteText}
              onChangeText={setNoteText}
              autoFocus
            />
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              <TouchableOpacity
                style={[styles.btn, { flex: 1, backgroundColor: '#E0E0E0' }]}
                onPress={() => { setShowNote(false); setNoteText(''); }}
              >
                <Text style={[styles.btnText, { color: BRAND.navy }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, { flex: 2, backgroundColor: BRAND.blue }]}
                onPress={confirmCheckIn}
              >
                <Text style={styles.btnText}>📌 Registrar posición</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header:       { backgroundColor: BRAND.navy, padding: 20, paddingTop: 52, paddingBottom: 24 },
  headerTitle:  { fontSize: 22, fontWeight: '800', color: '#fff' },
  headerDate:   { fontSize: 13, color: '#90A4AE', marginTop: 2, marginBottom: 16 },
  kpiRow:       { flexDirection: 'row', gap: 12 },
  kpi:          { flex: 1 },
  kpiVal:       { fontSize: 22, fontWeight: '800', color: '#fff' },
  kpiLabel:     { fontSize: 11, color: '#90A4AE', marginTop: 2 },
  wifiBadge:    { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, alignSelf: 'flex-end' },
  wifiText:     { fontSize: 12, fontWeight: '700' },

  card:         { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12 },
  btn:          { borderRadius: 12, padding: 14, alignItems: 'center' },
  btnText:      { color: '#fff', fontWeight: '700', fontSize: 14 },
  trackingBanner:  { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: BRAND.green + '15', borderRadius: 10, padding: 10 },
  trackingDot:  { width: 8, height: 8, borderRadius: 4, backgroundColor: BRAND.green },
  trackingTxt:  { fontSize: 13, color: BRAND.green, fontWeight: '600', flex: 1 },

  sectionLabel: { fontSize: 11, fontWeight: '700', color: '#90A4AE', textTransform: 'uppercase', marginBottom: 8, marginTop: 4 },
  syncInfo:     { fontSize: 13, color: '#607D8B', lineHeight: 18 },
  syncMsg:      { marginTop: 8, fontSize: 13, color: BRAND.green, fontWeight: '600' },

  empty:        { alignItems: 'center', padding: 32, backgroundColor: '#fff', borderRadius: 16 },
  emptyIcon:    { fontSize: 48, marginBottom: 12 },
  emptyText:    { fontSize: 14, color: '#90A4AE', textAlign: 'center', lineHeight: 20 },

  timeline:     { backgroundColor: '#fff', borderRadius: 16, padding: 16 },
  timelineItem: { flexDirection: 'row', gap: 12, marginBottom: 4 },
  timelineLeft: { width: 20, alignItems: 'center' },
  dot:          { width: 10, height: 10, borderRadius: 5, backgroundColor: '#90A4AE', marginTop: 4 },
  line:         { flex: 1, width: 2, backgroundColor: '#E0E0E0', marginTop: 4 },
  timelineContent:  { flex: 1, paddingBottom: 16 },
  timelineTime:     { fontSize: 13, fontWeight: '700', color: BRAND.navy },
  timelineNote:     { fontSize: 13, color: '#607D8B', marginTop: 2 },
  timelineCoords:   { fontSize: 10, color: '#B0BEC5', marginTop: 2 },
  manualBadge:      { justifyContent: 'flex-start', paddingTop: 2 },
  manualBadgeText:  { fontSize: 16 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox:     { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalTitle:   { fontSize: 18, fontWeight: '800', color: BRAND.navy, marginBottom: 4 },
  modalSub:     { fontSize: 13, color: '#90A4AE', marginBottom: 12 },
  modalInput:   { backgroundColor: BRAND.gray, borderRadius: 12, padding: 14, fontSize: 14, color: BRAND.navy, borderWidth: 1, borderColor: '#E0E0E0' },
});
