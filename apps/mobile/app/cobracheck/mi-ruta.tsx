// Mi ruta de cobranza — cobrador registra su recorrido y captura movimientos sin gastar datos
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Alert, TextInput, Modal, FlatList,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { BRAND, type CobraClient, type CobraInvoice } from '@gastocheck/shared';
import { supabase } from '../../lib/supabase';
import {
  requestLocationPermission, hasLocationPermission,
  captureCurrentPosition, addPointToday, loadTodayPoints,
  calcTotalKm, syncPendingRoutes, isOnWifi, todayStr,
  type RoutePoint,
} from '../../lib/route-tracker';
import DatePickerField from '../../components/DatePickerField';

const AUTO_INTERVAL_MS = 5 * 60 * 1000; // 5 minutos

// ── Tipos locales ─────────────────────────────────────────────────────────

interface CollectionMovement {
  id:              string;
  route_point_ts:  string;           // Vinculado al point de ruta
  client_id:       string;
  client_name:     string;
  invoice_id?:     string;
  folio?:          string;           // Folio de factura
  amount_original: number;           // Monto original de la factura
  movement_type:   'collected' | 'promise' | 'not_paid'; // Tipo de movimiento
  collected_amount?: number;         // Si collected: monto cobrado
  promise_date?:   string;           // Si promise: fecha comprometida
  reason_not_paid?: string;          // Si not_paid: motivo (sin fondos, disputa, rechazó, otro)
  photo_uri?:      string;           // Comprobante de pago (optional)
  notes?:          string;
  created_at:      string;
}

interface RutaDay {
  points:    RoutePoint[];
  movements: CollectionMovement[];
  synced:    boolean;
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}

// ── Motivos de no pago predefinidos ───────────────────────────────────────
const NO_PAY_REASONS = [
  'Sin fondos',
  'Disputa',
  'Rechazó',
  'Cerrado',
  'No localizados',
  'Otro',
];

// ── Componente principal ──────────────────────────────────────────────────

export default function MiRutaCobraScreen() {
  const router = useRouter();
  const { clientId } = useLocalSearchParams<{ clientId?: string }>();

  // ── Estado de usuario y ruta ────────────────────────────────────────────
  const [userId,     setUserId]     = useState<string | null>(null);
  const [companyId,  setCompanyId]  = useState<string | null>(null);
  const [points,     setPoints]     = useState<RoutePoint[]>([]);
  const [movements,  setMovements]  = useState<CollectionMovement[]>([]);
  const [tracking,   setTracking]   = useState(false);
  const [busy,       setBusy]       = useState(false);
  const [syncing,    setSyncing]    = useState(false);
  const [syncMsg,    setSyncMsg]    = useState('');
  const [wifi,       setWifi]       = useState(false);
  const intervalRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Modal captura de cobranza ───────────────────────────────────────────
  const [showCaptureModal, setShowCaptureModal] = useState(false);
  const [selectedClient,   setSelectedClient]   = useState<CobraClient | null>(null);
  const [selectedInvoices, setSelectedInvoices] = useState<CobraInvoice[]>([]);
  const [captureStep,      setCaptureStep]      = useState<'client' | 'invoice' | 'movement'>('client');

  // ── Formulario captura ──────────────────────────────────────────────────
  const [movementType,     setMovementType]     = useState<'collected' | 'promise' | 'not_paid'>('collected');
  const [collectedAmount,  setCollectedAmount]  = useState('');
  const [promiseDate,      setPromiseDate]      = useState<Date | null>(null);
  const [reasonNotPaid,    setReasonNotPaid]    = useState('');
  const [movementNotes,    setMovementNotes]    = useState('');
  const [photoUri,         setPhotoUri]         = useState<string | null>(null);
  const [saving,           setSaving]           = useState(false);

  // ── Listado de clientes y facturas ──────────────────────────────────────
  const [clients,  setClients]  = useState<CobraClient[]>([]);
  const [invoices, setInvoices] = useState<CobraInvoice[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);

  // ── Init ────────────────────────────────────────────────────────────────

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const { data: m } = await supabase
        .from('company_members').select('company_id')
        .eq('user_id', user.id).eq('status', 'active').limit(1).maybeSingle();
      if (m) setCompanyId(m.company_id);

      const pts = await loadTodayPoints(user.id);
      setPoints(pts);

      const w = await isOnWifi();
      setWifi(w);
    })();
  }, []);

  // ── Cargar clientes del día ─────────────────────────────────────────────

  useEffect(() => {
    if (!companyId) return;
    (async () => {
      setLoadingClients(true);
      try {
        const { data, error } = await supabase
          .from('cobra_clients')
          .select('*')
          .eq('company_id', companyId)
          .eq('status', 'active')
          .order('current_balance', { ascending: false });

        if (!error && data) {
          setClients(data as CobraClient[]);
        }
      } catch (e) {
        console.error('Error cargando clientes:', e);
      } finally {
        setLoadingClients(false);
      }
    })();
  }, [companyId]);

  // ── Cargar facturas de cliente ──────────────────────────────────────────

  async function loadInvoicesForClient(cid: string) {
    try {
      const { data, error } = await supabase
        .from('cobra_invoices')
        .select('*')
        .eq('client_id', cid)
        .in('status', ['pending', 'overdue', 'partial'])
        .order('due_date', { ascending: true });

      if (!error && data) {
        setSelectedInvoices(data as CobraInvoice[]);
      }
    } catch (e) {
      console.error('Error cargando facturas:', e);
    }
  }

  // ── Intervalo automático ────────────────────────────────────────────────

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

  // ── Acciones de ruta ────────────────────────────────────────────────────

  async function handleStartTracking() {
    const has = await hasLocationPermission();
    if (!has) {
      const granted = await requestLocationPermission();
      if (!granted) {
        Alert.alert('Permiso necesario', 'Activa la ubicación para registrar tu ruta de cobranza.');
        return;
      }
    }
    setBusy(true);
    const p = await captureCurrentPosition('Inicio de ruta de cobranza');
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
    const p = await captureCurrentPosition('Fin de ruta de cobranza');
    if (p) {
      const updated = await addPointToday(userId, p);
      setPoints([...updated]);
    }
    setBusy(false);
    setTracking(false);
  }

  // ── Flujo de captura de movimiento ──────────────────────────────────────

  function handleCaptureMovement() {
    if (!tracking) {
      Alert.alert('Error', 'Inicia el seguimiento primero para registrar cobranzas.');
      return;
    }
    setCaptureStep('client');
    setShowCaptureModal(true);
  }

  function handleSelectClient(client: CobraClient) {
    setSelectedClient(client);
    loadInvoicesForClient(client.id);
    setCaptureStep('invoice');
  }

  function handleSelectInvoice(invoice: CobraInvoice) {
    setCaptureStep('movement');
    setCollectedAmount(invoice.amount.toString());
  }

  async function handleTakePhoto() {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  }

  async function handleSelectPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  }

  async function confirmMovement() {
    if (!selectedClient || !selectedInvoices[0] || movementType === 'collected' && !collectedAmount) {
      Alert.alert('Error', 'Completa todos los campos requeridos.');
      return;
    }

    setSaving(true);
    try {
      const invoice = selectedInvoices[0];
      const currentPoint = points[points.length - 1];

      const movement: CollectionMovement = {
        id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        route_point_ts: currentPoint?.ts || new Date().toISOString(),
        client_id: selectedClient.id,
        client_name: selectedClient.name,
        invoice_id: invoice.id,
        folio: invoice.folio,
        amount_original: invoice.amount,
        movement_type: movementType,
        collected_amount: movementType === 'collected' ? parseFloat(collectedAmount) : undefined,
        promise_date: movementType === 'promise' && promiseDate ? promiseDate.toISOString() : undefined,
        reason_not_paid: movementType === 'not_paid' ? reasonNotPaid : undefined,
        photo_uri: photoUri || undefined,
        notes: movementNotes || undefined,
        created_at: new Date().toISOString(),
      };

      // Guardar movimiento (offline first)
      setMovements([...movements, movement]);

      // Intentar sincronizar inmediatamente si hay WiFi
      if (wifi && userId && companyId) {
        const { error } = await supabase
          .from('cobra_movements')
          .insert([{
            route_point_ts: movement.route_point_ts,
            client_id: movement.client_id,
            invoice_id: movement.invoice_id,
            amount_original: movement.amount_original,
            movement_type: movement.movement_type,
            collected_amount: movement.collected_amount,
            promise_date: movement.promise_date,
            reason_not_paid: movement.reason_not_paid,
            photo_uri: movement.photo_uri,
            notes: movement.notes,
            user_id: userId,
            company_id: companyId,
          }]);

        if (error) {
          console.error('Error sincronizando movimiento:', error);
        }
      }

      // Resetear formulario y cerrar
      setShowCaptureModal(false);
      setCollectedAmount('');
      setPromiseDate(null);
      setReasonNotPaid('');
      setMovementNotes('');
      setPhotoUri(null);
      setMovementType('collected');
      setSelectedClient(null);
      setSelectedInvoices([]);

      Alert.alert('Éxito', `Movimiento de cobranza registrado: ${selectedClient.name}`);
    } catch (e) {
      Alert.alert('Error', 'No se pudo guardar el movimiento: ' + (e instanceof Error ? e.message : ''));
    } finally {
      setSaving(false);
    }
  }

  // ── Sincronización ──────────────────────────────────────────────────────

  async function handleSync() {
    if (!userId || !companyId) return;
    setSyncing(true);
    try {
      const result = await syncPendingRoutes(userId, companyId);
      setSyncing(false);
      if (!result.wifiAvailable) {
        setSyncMsg('Sin WiFi — los datos se subirán automáticamente al conectarte.');
      } else if (result.synced > 0) {
        setSyncMsg(`✅ ${result.synced} día(s) sincronizados correctamente.`);
      } else {
        setSyncMsg('Todo está al día, no hay pendientes.');
      }
    } catch (e) {
      setSyncing(false);
      setSyncMsg('Error en la sincronización.');
      console.error('Sync error:', e);
    }
  }

  // ── Cálculos ────────────────────────────────────────────────────────────

  const totalKm = calcTotalKm(points);
  const fecha = todayStr();
  const collectedCount = movements.filter(m => m.movement_type === 'collected').length;
  const promiseCount = movements.filter(m => m.movement_type === 'promise').length;
  const notPaidCount = movements.filter(m => m.movement_type === 'not_paid').length;
  const totalCollected = movements
    .filter(m => m.movement_type === 'collected')
    .reduce((sum, m) => sum + (m.collected_amount || 0), 0);

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <View style={{ flex: 1, backgroundColor: BRAND.gray }}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>💰 Mi Ruta de Cobranza</Text>
        <Text style={styles.headerDate}>{fecha}</Text>
        <View style={styles.kpiRow}>
          <View style={styles.kpi}>
            <Text style={styles.kpiVal}>{totalKm.toFixed(1)}</Text>
            <Text style={styles.kpiLabel}>km</Text>
          </View>
          <View style={styles.kpi}>
            <Text style={styles.kpiVal}>{points.length}</Text>
            <Text style={styles.kpiLabel}>puntos</Text>
          </View>
          <View style={styles.kpi}>
            <Text style={styles.kpiVal}>{movements.length}</Text>
            <Text style={styles.kpiLabel}>movimientos</Text>
          </View>
          <View style={[styles.kpi, { alignItems: 'flex-end' }]}>
            <View style={[styles.wifiBadge, { backgroundColor: wifi ? BRAND.green + '20' : '#F5F5F5' }]}>
              <Text style={[styles.wifiText, { color: wifi ? BRAND.green : '#90A4AE' }]}>
                {wifi ? '📶' : '📵'}
              </Text>
            </View>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>

        {/* Controles principales */}
        <View style={styles.card}>
          {!tracking ? (
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: BRAND.green }]}
              onPress={handleStartTracking}
              disabled={busy}
            >
              {busy
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.btnText}>▶  Iniciar ruta</Text>
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
                  style={[styles.btn, { flex: 1, backgroundColor: '#36BF6A' }]}
                  onPress={handleCaptureMovement}
                  disabled={busy}
                >
                  <Text style={styles.btnText}>📝 Registrar cobro</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn, { flex: 1, backgroundColor: BRAND.red }]}
                  onPress={handleStopTracking}
                  disabled={busy}
                >
                  <Text style={styles.btnText}>⏹ Terminar</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* Resumen de movimientos */}
        {movements.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>Resumen del día</Text>
            <View style={styles.summaryGrid}>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryVal, { color: BRAND.green }]}>$ {totalCollected.toLocaleString('es-MX')}</Text>
                <Text style={styles.summaryLabel}>Cobrado</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryVal, { color: BRAND.blue }]}>{collectedCount}</Text>
                <Text style={styles.summaryLabel}>Cobros</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryVal, { color: '#FF9800' }]}>{promiseCount}</Text>
                <Text style={styles.summaryLabel}>Promesas</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryVal, { color: BRAND.red }]}>{notPaidCount}</Text>
                <Text style={styles.summaryLabel}>No pagos</Text>
              </View>
            </View>
          </View>
        )}

        {/* Sincronización */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Sincronización</Text>
          <Text style={styles.syncInfo}>
            Los movimientos se guardan en tu teléfono y se suben automáticamente al conectarte a WiFi.
          </Text>
          {syncMsg ? <Text style={styles.syncMsg}>{syncMsg}</Text> : null}
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: '#182535', marginTop: 8 }]}
            onPress={handleSync}
            disabled={syncing}
          >
            {syncing
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnText}>☁️  Sincronizar ahora</Text>
            }
          </TouchableOpacity>
        </View>

        {/* Línea de tiempo de movimientos */}
        {movements.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>Movimientos de hoy ({movements.length})</Text>
            <View style={styles.timeline}>
              {[...movements].reverse().map((mov, i, arr) => {
                const isLast = i === arr.length - 1;
                const color =
                  mov.movement_type === 'collected' ? BRAND.green :
                  mov.movement_type === 'promise' ? '#FF9800' :
                  BRAND.red;
                return (
                  <View key={mov.id} style={styles.timelineItem}>
                    <View style={styles.timelineLeft}>
                      <View style={[styles.dot, { backgroundColor: color }]} />
                      {!isLast && <View style={styles.line} />}
                    </View>
                    <View style={styles.timelineContent}>
                      <Text style={[styles.timelineTime, { color }]}>
                        {mov.movement_type === 'collected' ? '✓ Cobrado' :
                         mov.movement_type === 'promise' ? '⏰ Promesa' :
                         '✗ No pagó'}
                      </Text>
                      <Text style={styles.timelineNote}>{mov.client_name}</Text>
                      <Text style={styles.timelineCoords}>
                        Factura: {mov.folio} • $ {mov.amount_original.toLocaleString('es-MX')}
                      </Text>
                      {mov.movement_type === 'collected' && mov.collected_amount && (
                        <Text style={[styles.timelineCoords, { color: BRAND.green, fontWeight: '600' }]}>
                          Cobrado: $ {mov.collected_amount.toLocaleString('es-MX')}
                        </Text>
                      )}
                      {mov.movement_type === 'promise' && mov.promise_date && (
                        <Text style={[styles.timelineCoords, { color: '#FF9800', fontWeight: '600' }]}>
                          Promesa: {new Date(mov.promise_date).toLocaleDateString('es-MX')}
                        </Text>
                      )}
                      {mov.movement_type === 'not_paid' && mov.reason_not_paid && (
                        <Text style={[styles.timelineCoords, { color: BRAND.red, fontWeight: '600' }]}>
                          {mov.reason_not_paid}
                        </Text>
                      )}
                      {mov.notes && (
                        <Text style={[styles.timelineCoords, { color: '#607D8B', fontStyle: 'italic' }]}>
                          {mov.notes}
                        </Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        )}

        {movements.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyText}>
              Inicia el seguimiento y toca "Registrar cobro" para capturar movimientos de cobranza.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Modal captura de movimiento */}
      <Modal visible={showCaptureModal} transparent animationType="slide" onRequestClose={() => setShowCaptureModal(false)}>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
            <View style={styles.modalBox}>

              {/* Paso 1: Seleccionar cliente */}
              {captureStep === 'client' && (
                <>
                  <Text style={styles.modalTitle}>Selecciona cliente</Text>
                  {loadingClients ? (
                    <ActivityIndicator size="large" color={BRAND.navy} style={{ marginVertical: 20 }} />
                  ) : clients.length === 0 ? (
                    <Text style={styles.modalSub}>No hay clientes disponibles</Text>
                  ) : (
                    <FlatList
                      data={clients}
                      keyExtractor={c => c.id}
                      scrollEnabled={false}
                      renderItem={({ item }) => (
                        <TouchableOpacity
                          style={styles.clientItem}
                          onPress={() => handleSelectClient(item)}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={styles.clientName}>{item.name}</Text>
                            <Text style={styles.clientBalance}>
                              Saldo: $ {item.current_balance.toLocaleString('es-MX')}
                            </Text>
                          </View>
                          <Text style={styles.riskBadge} style={[
                            styles.riskBadge,
                            { color: item.risk_score >= 70 ? BRAND.red : item.risk_score >= 40 ? '#FF9800' : BRAND.green }
                          ]}>
                            {item.risk_score}%
                          </Text>
                        </TouchableOpacity>
                      )}
                    />
                  )}
                </>
              )}

              {/* Paso 2: Seleccionar factura */}
              {captureStep === 'invoice' && selectedClient && (
                <>
                  <Text style={styles.modalTitle}>{selectedClient.name}</Text>
                  <Text style={styles.modalSub}>Selecciona factura pendiente</Text>
                  {selectedInvoices.length === 0 ? (
                    <Text style={styles.modalSub}>Sin facturas pendientes</Text>
                  ) : (
                    <FlatList
                      data={selectedInvoices}
                      keyExtractor={inv => inv.id}
                      scrollEnabled={false}
                      renderItem={({ item }) => (
                        <TouchableOpacity
                          style={styles.invoiceItem}
                          onPress={() => handleSelectInvoice(item)}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={styles.invoiceNum}>Folio {item.folio}</Text>
                            <Text style={styles.invoiceAmount}>
                              $ {item.amount.toLocaleString('es-MX')}
                            </Text>
                            <Text style={styles.invoiceDate}>
                              Vence: {new Date(item.due_date).toLocaleDateString('es-MX')}
                            </Text>
                          </View>
                          <Text style={[
                            styles.statusBadge,
                            { color: item.status === 'overdue' ? BRAND.red : '#FF9800' }
                          ]}>
                            {item.status === 'overdue' ? 'Vencida' : 'Pendiente'}
                          </Text>
                        </TouchableOpacity>
                      )}
                    />
                  )}
                </>
              )}

              {/* Paso 3: Detalles del movimiento */}
              {captureStep === 'movement' && selectedClient && selectedInvoices[0] && (
                <ScrollView showsVerticalScrollIndicator={false}>
                  <Text style={styles.modalTitle}>Registrar movimiento</Text>
                  <Text style={styles.modalSub}>
                    {selectedClient.name} • Factura {selectedInvoices[0].folio}
                  </Text>

                  {/* Tipo de movimiento */}
                  <Text style={styles.fieldLabel}>Tipo de movimiento</Text>
                  <View style={styles.buttonGroup}>
                    {(['collected', 'promise', 'not_paid'] as const).map(type => (
                      <TouchableOpacity
                        key={type}
                        style={[
                          styles.buttonGroupItem,
                          movementType === type && { backgroundColor: BRAND.blue }
                        ]}
                        onPress={() => {
                          setMovementType(type);
                          setCollectedAmount('');
                          setPromiseDate(null);
                          setReasonNotPaid('');
                        }}
                      >
                        <Text style={[
                          styles.buttonGroupText,
                          movementType === type && { color: '#fff' }
                        ]}>
                          {type === 'collected' ? '✓ Cobrado' : type === 'promise' ? '⏰ Promesa' : '✗ No pagó'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Campo específico según tipo */}
                  {movementType === 'collected' && (
                    <>
                      <Text style={styles.fieldLabel}>Monto cobrado</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="Ej: 5000"
                        placeholderTextColor="#B0BEC5"
                        value={collectedAmount}
                        onChangeText={setCollectedAmount}
                        keyboardType="decimal-pad"
                      />
                    </>
                  )}

                  {movementType === 'promise' && (
                    <>
                      <Text style={styles.fieldLabel}>Fecha de promesa</Text>
                      <DatePickerField
                        value={promiseDate}
                        onChange={setPromiseDate}
                        minimumDate={new Date()}
                      />
                    </>
                  )}

                  {movementType === 'not_paid' && (
                    <>
                      <Text style={styles.fieldLabel}>Motivo de no pago</Text>
                      <View style={styles.buttonGroup}>
                        {NO_PAY_REASONS.map(reason => (
                          <TouchableOpacity
                            key={reason}
                            style={[
                              styles.buttonGroupSmall,
                              reasonNotPaid === reason && { backgroundColor: BRAND.red }
                            ]}
                            onPress={() => setReasonNotPaid(reason)}
                          >
                            <Text style={[
                              styles.buttonGroupText,
                              reasonNotPaid === reason && { color: '#fff' }
                            ]}>
                              {reason}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </>
                  )}

                  {/* Notas */}
                  <Text style={styles.fieldLabel}>Notas (opcional)</Text>
                  <TextInput
                    style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]}
                    placeholder="Ej: Cliente solicitó extensión de plazo..."
                    placeholderTextColor="#B0BEC5"
                    value={movementNotes}
                    onChangeText={setMovementNotes}
                    multiline
                  />

                  {/* Foto */}
                  <Text style={styles.fieldLabel}>Comprobante (opcional)</Text>
                  {photoUri ? (
                    <View style={styles.photoPreview}>
                      <Text style={styles.photoPreviewText}>✓ Foto seleccionada</Text>
                      <TouchableOpacity onPress={() => setPhotoUri(null)}>
                        <Text style={styles.photoRemove}>Remover</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TouchableOpacity
                        style={[styles.btn, { flex: 1, backgroundColor: '#90A4AE' }]}
                        onPress={handleTakePhoto}
                      >
                        <Text style={styles.btnText}>📷 Cámara</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.btn, { flex: 1, backgroundColor: '#90A4AE' }]}
                        onPress={handleSelectPhoto}
                      >
                        <Text style={styles.btnText}>🖼 Galería</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* Botones de acción */}
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 16, marginBottom: 20 }}>
                    <TouchableOpacity
                      style={[styles.btn, { flex: 1, backgroundColor: '#E0E0E0' }]}
                      onPress={() => setCaptureStep('client')}
                    >
                      <Text style={[styles.btnText, { color: BRAND.navy }]}>Atrás</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.btn, { flex: 2, backgroundColor: BRAND.green }]}
                      onPress={confirmMovement}
                      disabled={saving}
                    >
                      {saving
                        ? <ActivityIndicator color="#fff" />
                        : <Text style={styles.btnText}>✓ Guardar movimiento</Text>
                      }
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              )}

            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Header
  header:       { backgroundColor: '#182535', padding: 20, paddingTop: 52, paddingBottom: 24 },
  headerTitle:  { fontSize: 22, fontWeight: '800', color: '#fff' },
  headerDate:   { fontSize: 13, color: '#90A4AE', marginTop: 2, marginBottom: 16 },
  kpiRow:       { flexDirection: 'row', gap: 12 },
  kpi:          { flex: 1 },
  kpiVal:       { fontSize: 22, fontWeight: '800', color: '#fff' },
  kpiLabel:     { fontSize: 11, color: '#90A4AE', marginTop: 2 },
  wifiBadge:    { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, alignSelf: 'flex-end' },
  wifiText:     { fontSize: 12, fontWeight: '700' },

  // Cards
  card:         { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12 },
  btn:          { borderRadius: 12, padding: 14, alignItems: 'center' },
  btnText:      { color: '#fff', fontWeight: '700', fontSize: 14 },

  // Tracking
  trackingBanner:  { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: BRAND.green + '15', borderRadius: 10, padding: 10 },
  trackingDot:  { width: 8, height: 8, borderRadius: 4, backgroundColor: BRAND.green },
  trackingTxt:  { fontSize: 13, color: BRAND.green, fontWeight: '600', flex: 1 },

  // Summary
  summaryGrid: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  summaryItem: { flex: 1, minWidth: '45%', alignItems: 'center', backgroundColor: '#f5f5f5', borderRadius: 12, padding: 12 },
  summaryVal:  { fontSize: 20, fontWeight: '800' },
  summaryLabel:{ fontSize: 12, color: '#90A4AE', marginTop: 4 },

  // Sync
  sectionLabel: { fontSize: 11, fontWeight: '700', color: '#90A4AE', textTransform: 'uppercase', marginBottom: 8, marginTop: 4 },
  syncInfo:     { fontSize: 13, color: '#607D8B', lineHeight: 18 },
  syncMsg:      { marginTop: 8, fontSize: 13, color: BRAND.green, fontWeight: '600' },

  // Empty
  empty:        { alignItems: 'center', padding: 32, backgroundColor: '#fff', borderRadius: 16 },
  emptyIcon:    { fontSize: 48, marginBottom: 12 },
  emptyText:    { fontSize: 14, color: '#90A4AE', textAlign: 'center', lineHeight: 20 },

  // Timeline
  timeline:     { backgroundColor: '#fff', borderRadius: 16, padding: 16 },
  timelineItem: { flexDirection: 'row', gap: 12, marginBottom: 4 },
  timelineLeft: { width: 20, alignItems: 'center' },
  dot:          { width: 10, height: 10, borderRadius: 5, backgroundColor: '#90A4AE', marginTop: 4 },
  line:         { flex: 1, width: 2, backgroundColor: '#E0E0E0', marginTop: 4 },
  timelineContent:  { flex: 1, paddingBottom: 16 },
  timelineTime:     { fontSize: 13, fontWeight: '700', color: '#182535' },
  timelineNote:     { fontSize: 13, color: '#607D8B', marginTop: 2 },
  timelineCoords:   { fontSize: 10, color: '#B0BEC5', marginTop: 2 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox:     { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '90%' },
  modalTitle:   { fontSize: 18, fontWeight: '800', color: '#182535', marginBottom: 4 },
  modalSub:     { fontSize: 13, color: '#90A4AE', marginBottom: 12 },

  // Cliente/Factura items
  clientItem:   { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f5f5f5', borderRadius: 12, padding: 12, marginBottom: 8 },
  clientName:   { fontWeight: '700', color: '#182535', fontSize: 14 },
  clientBalance:{ fontWeight: '600', color: '#90A4AE', marginTop: 4, fontSize: 12 },
  riskBadge:    { fontWeight: '700', fontSize: 14 },

  invoiceItem:  { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f5f5f5', borderRadius: 12, padding: 12, marginBottom: 8 },
  invoiceNum:   { fontWeight: '700', color: '#182535', fontSize: 14 },
  invoiceAmount:{ fontWeight: '800', color: '#182535', marginTop: 4, fontSize: 13 },
  invoiceDate:  { fontWeight: '500', color: '#90A4AE', marginTop: 2, fontSize: 12 },
  statusBadge:  { fontWeight: '700', fontSize: 12 },

  // Form
  fieldLabel:   { fontWeight: '700', color: '#182535', marginTop: 12, marginBottom: 6, fontSize: 13 },
  input:        { backgroundColor: '#f5f5f5', borderRadius: 12, padding: 12, fontSize: 14, color: '#182535', borderWidth: 1, borderColor: '#E0E0E0' },

  buttonGroup:  { flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' },
  buttonGroupItem: { flex: 1, minWidth: '30%', backgroundColor: '#f5f5f5', borderRadius: 10, padding: 10, alignItems: 'center' },
  buttonGroupSmall: { minWidth: '45%', backgroundColor: '#f5f5f5', borderRadius: 10, padding: 10, alignItems: 'center' },
  buttonGroupText:  { fontWeight: '600', color: '#607D8B', fontSize: 12 },

  photoPreview: { backgroundColor: '#f5f5f5', borderRadius: 12, padding: 12, alignItems: 'center', marginBottom: 12 },
  photoPreviewText: { fontWeight: '600', color: BRAND.green, fontSize: 13 },
  photoRemove:  { fontWeight: '600', color: BRAND.red, fontSize: 12, marginTop: 6 },
});
