// Captura de comprobante: foto → OCR → verificación duplicados → guardar (con offline sync)
import { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator,
  ScrollView, FlatList, Image, TextInput, Alert, Modal,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { useOcr } from '../hooks/useOcr';
import DatePickerField from '../components/DatePickerField';
import { supabase } from '../lib/supabase';
import {
  BRAND, DUPLICATE_STATUS_META, isFleetSector,
  VEHICLE_TYPE_ICONS, vehicleDisplayName, suggestCategoryFromProvider,
  type DuplicateStatus, type OcrResult, type FleetVehicle, type FleetOperator,
} from '@gastocheck/shared';
import { enqueueOffline, startOfflineMonitor } from '../lib/offline-sync';
import { setupNotifications } from '../lib/notifications';

// ── Tipos locales ─────────────────────────────────────────────────────────────

interface DuplicateMatch {
  receipt_id:    string;
  match_type:    string;
  score:         number;
  reason:        string;
  provider_name: string | null;
  receipt_date:  string | null;
  total_amount:  number | null;
}

interface DuplicateResult {
  duplicate_status: DuplicateStatus;
  should_block:     boolean;
  message:          string;
  matches:          DuplicateMatch[];
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function CaptureScreen() {
  const router = useRouter();
  const { photoUri } = useLocalSearchParams<{ photoUri?: string }>();
  const { extractFromImage, loading: ocrLoading } = useOcr();

  // Setup offline sync monitor + cargar categorías al inicio
  useEffect(() => {
    const unsubscribe = startOfflineMonitor();
    setupNotifications();
    // Pre-cargar categorías tan pronto se carga la pantalla
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: m } = await supabase
        .from('company_members').select('company_id')
        .eq('user_id', user.id).eq('status', 'active').limit(1).maybeSingle();
      if (m?.company_id) loadCategories(m.company_id);
    })();
    return unsubscribe;
  }, []);

  // Procesar foto llegando desde camera-screen
  useEffect(() => {
    if (!photoUri || typeof photoUri !== 'string') return;
    (async () => {
      try {
        const base64 = await FileSystem.readAsStringAsync(photoUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        setPhoto({ uri: photoUri, base64 });
        const { data: result, error: ocrErr } = await extractFromImage(base64, 'image/jpeg');
        if (result) {
          setExtracted(result);
          const prov = result.providerName ?? '';
          setProveedor(prov);
          setRfc(result.providerRfc ?? '');
          setTotal(String(result.total ?? ''));
          setSubtotal(String(result.subtotal ?? ''));
          setIva(String(result.tax ?? ''));
          setDescuento(String(result.discount ?? ''));
          setIeps(String(result.ieps ?? ''));
          setIsh(String(result.ish ?? ''));
          setRetencionIva(String(result.retencionIva ?? ''));
          setRetencionIsr(String(result.retencionIsr ?? ''));
          const cat = suggestCategoryFromProvider(prov);
          setSuggestedCategory(cat);
          const flags = categoryExtraTax(cat);
          const hasExtraTax = !!(result.ieps || result.ish || result.retencionIva || result.retencionIsr);
          setShowExtraImpuestos(hasExtraTax || flags.ieps || flags.ish || flags.retenciones);
          setFecha(result.receiptDate ?? '');
          setFolio(result.internalFolio ?? '');
          setStep('confirm');
        } else {
          Alert.alert(
            'OCR falló',
            ocrErr ?? 'La IA no pudo extraer datos de la imagen.',
            [
              { text: 'Elegir otra imagen', style: 'cancel' },
              { text: 'Ingresar manualmente', onPress: () => { setFecha(new Date().toISOString().slice(0, 10)); setStep('confirm'); } },
            ],
          );
        }
      } catch (e: any) {
        Alert.alert('Error', 'No se pudo leer la foto: ' + (e?.message ?? ''));
      }
    })();
  }, [photoUri]); // eslint-disable-line react-hooks/exhaustive-deps

  const [photo,      setPhoto]      = useState<{ uri: string; base64?: string | null } | null>(null);
  const [extracted,  setExtracted]  = useState<OcrResult | null>(null);
  const [step,       setStep]       = useState<'camera' | 'confirm'>('camera');
  const [saving,     setSaving]     = useState(false);

  // Campos editables
  const [proveedor,  setProveedor]  = useState('');
  const [rfc,        setRfc]        = useState('');
  const [total,      setTotal]      = useState('');
  const [subtotal,   setSubtotal]   = useState('');
  const [iva,        setIva]        = useState('');
  const [descuento,  setDescuento]  = useState('');
  const [ieps,       setIeps]       = useState('');
  const [ish,        setIsh]        = useState('');
  const [retencionIva, setRetencionIva] = useState('');
  const [retencionIsr, setRetencionIsr] = useState('');
  const [showExtraImpuestos, setShowExtraImpuestos] = useState(false);
  const [fecha,      setFecha]      = useState('');
  const [folio,      setFolio]      = useState('');
  const [description, setDescription] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [isCredit,      setIsCredit]      = useState(false);

  // Fuente: foto o XML
  const [isXml,      setIsXml]      = useState(false);

  // Anti-duplicados
  const [dupResult,  setDupResult]  = useState<DuplicateResult | null>(null);
  const [showDupModal, setShowDupModal] = useState(false);
  const [forceReason,  setForceReason] = useState('');

  // Categoría seleccionada
  const [categoryId,   setCategoryId]   = useState<string | null>(null);
  const [categoryName, setCategoryName] = useState<string>('');
  const [showCatModal, setShowCatModal] = useState(false);
  const [categories,   setCategories]   = useState<{ id: string; name: string; parent_name?: string }[]>([]);

  // Auto-categoría sugerida por proveedor (legacy — ya no se usa para el UI, solo para preselección)
  const [suggestedCategory, setSuggestedCategory] = useState<string | null>(null);

  // ── Detecta qué impuestos extra aplican según la categoría sugerida ─────────
  function categoryExtraTax(cat: string | null) {
    if (!cat) return { ieps: false, ish: false, retenciones: false };
    const u = cat.toUpperCase();
    return {
      ieps: u.includes('COMBUSTIBLE') || u.includes('GASOLINA') || u.includes('DIESEL') ||
            u.includes('BEBIDA') || u.includes('ALCOHOL') || u.includes('CERVEZA') ||
            u.includes('CIGARRO') || u.includes('TABACO'),
      ish: u.includes('HOSPEDAJE') || u.includes('HOTEL'),
      retenciones: u.includes('HONORARIO') || u.includes('ARRENDAMIENTO') || u.includes('RENTA'),
    };
  }

  // Fleet (se activa si company.sector es flotillas/transportistas/distribucion)
  const [isFleet,    setIsFleet]    = useState(false);
  const [vehicles,   setVehicles]   = useState<FleetVehicle[]>([]);
  const [operators,  setOperators]  = useState<FleetOperator[]>([]);
  const [vehicleId,  setVehicleId]  = useState<string | null>(null);
  const [operatorId, setOperatorId] = useState<string | null>(null);

  // ── Cargar flota si aplica ────────────────────────────────────────────────

  async function loadFleetData(companyId: string) {
    const { data: company } = await supabase
      .from('companies').select('sector').eq('id', companyId).single();
    if (!isFleetSector(company?.sector)) return;
    setIsFleet(true);

    const [{ data: vList }, { data: oList }] = await Promise.all([
      supabase.from('vehicles').select('*').eq('company_id', companyId)
        .eq('status', 'active').order('economic_number'),
      supabase.from('operators').select('*').eq('company_id', companyId)
        .eq('status', 'active').order('name'),
    ]);
    setVehicles((vList ?? []) as FleetVehicle[]);
    setOperators((oList ?? []) as FleetOperator[]);
  }

  // ── Cargar catálogo de categorías ────────────────────────────────────────

  async function loadCategories(companyId: string) {
    try {
      const { data, error } = await supabase
        .from('expense_categories')
        .select('id, name, parent_id')
        .eq('company_id', companyId)
        .order('display_order')
        .order('name');

      if (error) {
        console.error('[loadCategories] Error:', error);
        return;
      }

      if (!data?.length) {
        console.warn('[loadCategories] No categories found for company', companyId);
        setCategories([]);
        return;
      }

      // Construir lista plana con prefijo del padre
      const parentMap: Record<string, string> = {};
      data.forEach((c: any) => {
        if (!c.parent_id) parentMap[c.id] = c.name;
      });
      setCategories(
        data.map((c: any) => ({
          id:          c.id,
          name:        c.name,
          parent_name: c.parent_id ? parentMap[c.parent_id] : undefined,
        })),
      );
    } catch (err) {
      console.error('[loadCategories] Exception:', err);
      setCategories([]);
    }
  }

  // ── Tomar foto ─────────────────────────────────────────────────────────────

  async function takePhoto() {
    // Ir a pantalla de cámara con flash/torch control
    router.push('/camera-screen' as any);
  }

  // ── Elegir de galería ──────────────────────────────────────────────────────

  async function pickFromGallery() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permiso requerido', 'Necesitamos acceso a la galería para seleccionar fotos');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.5,
      base64: true,
      exif: false,
    });
    if (res.canceled || !res.assets[0]) return;
    const asset = res.assets[0];
    setPhoto({ uri: asset.uri, base64: asset.base64 });
    if (asset.base64) {
      const { data: result, error: ocrErr } = await extractFromImage(asset.base64, 'image/jpeg');
      if (result) {
        setExtracted(result);
        const prov = result.providerName ?? '';
        setProveedor(prov);
        setRfc(         result.providerRfc     ?? '');
        setTotal(       String(result.total    ?? ''));
        setSubtotal(    String(result.subtotal ?? ''));
        setIva(         String(result.tax      ?? ''));
        setDescuento(   String(result.discount ?? ''));
        setIeps(        String(result.ieps        ?? ''));
        setIsh(         String(result.ish         ?? ''));
        setRetencionIva(String(result.retencionIva ?? ''));
        setRetencionIsr(String(result.retencionIsr ?? ''));
        const cat = suggestCategoryFromProvider(prov);
        setSuggestedCategory(cat);
        const flags = categoryExtraTax(cat);
        const hasExtraTax = !!(result.ieps || result.ish || result.retencionIva || result.retencionIsr);
        setShowExtraImpuestos(hasExtraTax || flags.ieps || flags.ish || flags.retenciones);
        setFecha(   result.receiptDate   ?? '');
        setFolio(   result.internalFolio ?? '');
        setStep('confirm');
      } else {
        Alert.alert(
          'OCR falló',
          ocrErr ?? 'La IA no pudo extraer datos de la imagen.',
          [
            { text: 'Elegir otra imagen', style: 'cancel' },
            {
              text: 'Ingresar manualmente',
              onPress: () => {
                if (!fecha) setFecha(new Date().toISOString().slice(0, 10));
                setStep('confirm');
              },
            },
          ],
        );
      }
    }
  }

  // ── Subir XML/CFDI ─────────────────────────────────────────────────────────

  async function handleXmlUpload() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/xml', 'application/xml', 'text/plain', '*/*'],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const file = result.assets[0];
      if (!file.name?.toLowerCase().endsWith('.xml')) {
        Alert.alert('Archivo no válido', 'Selecciona un archivo XML (CFDI)');
        return;
      }

      // Leer contenido del archivo
      const fileRes = await fetch(file.uri);
      const xmlText = await fileRes.text();

      if (!xmlText.trim().startsWith('<')) {
        Alert.alert('XML inválido', 'El archivo no parece ser un XML válido');
        return;
      }

      // Llamar a xml-parse edge function
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        Alert.alert('Sin sesión', 'Inicia sesión nuevamente');
        return;
      }

      const res = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/xml-parse`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ xml_content: xmlText }),
        },
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Error al procesar XML' }));
        Alert.alert('Error CFDI', err.error ?? 'No se pudo analizar el XML');
        return;
      }

      const data = await res.json();

      // Pre-llenar el formulario con datos del XML
      const prov = data.provider_name ?? data.issuer_name ?? '';
      setProveedor(prov);
      setRfc(    data.provider_rfc ?? data.issuer_rfc  ?? '');
      setTotal(  String(data.total_amount ?? data.total ?? ''));
      setSubtotal(String(data.subtotal_amount ?? data.subtotal ?? ''));
      setIva(    String(data.tax_amount ?? data.tax ?? ''));
      setFecha(  (data.receipt_date ?? data.date ?? '').slice(0, 10));
      setFolio(  data.internal_folio ?? data.folio ?? '');
      if (data.payment_method) setPaymentMethod(data.payment_method);
      setSuggestedCategory(suggestCategoryFromProvider(prov));

      setIsXml(true);

      // Simular un "extracted" para marcar como CFDI verificado
      setExtracted({
        providerName:  prov,
        providerRfc:   data.provider_rfc ?? data.issuer_rfc ?? null,
        total:         parseFloat(data.total_amount ?? data.total ?? '0') || null,
        subtotal:      parseFloat(data.subtotal_amount ?? data.subtotal ?? '0') || null,
        tax:           parseFloat(data.tax_amount ?? data.tax ?? '0') || null,
        receiptDate:   (data.receipt_date ?? data.date ?? '').slice(0, 10),
        internalFolio: data.internal_folio ?? data.folio ?? null,
        fiscalUuid:    data.fiscal_uuid ?? data.uuid ?? null,
        paymentMethod: data.payment_method ?? null,
        confidence:    'high',
        lineItems:     data.line_items ?? [],
        fullText:      xmlText.slice(0, 500),
        warnings:      [],
      } as OcrResult);

      // Usar una imagen placeholder para el XML (encodeURIComponent maneja UTF-8 correctamente)
      setPhoto({ uri: 'xml://' + file.name, base64: btoa(unescape(encodeURIComponent(xmlText))) });
      setStep('confirm');

      Alert.alert('✅ XML procesado', `CFDI de ${prov || 'proveedor'} cargado correctamente.`);
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'No se pudo abrir el archivo');
    }
  }

  // ── Verificar duplicados antes de guardar ─────────────────────────────────

  async function checkDuplicate(companyId: string): Promise<DuplicateResult | null> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return null;

      const res = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/check-duplicate`,
        {
          method:  'POST',
          headers: {
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            company_id:    companyId,
            fiscal_uuid:   extracted?.fiscalUuid  ?? null,
            provider_name: proveedor               || null,
            provider_rfc:  rfc                     || null,
            receipt_date:  fecha                   || null,
            total_amount:  parseFloat(total)       || null,
          }),
        },
      );

      if (!res.ok) return null;
      const data = await res.json();
      return data as DuplicateResult;
    } catch {
      return null;
    }
  }

  // ── Verificación de duplicado exacto en cliente (pre-submit) ─────────────
  // Bloqueo permanente: mismo fiscal_uuid O mismo (proveedor+monto+fecha) ya en BD

  async function clientDuplicateBlock(companyId: string, userId: string): Promise<string | null> {
    // 1. Coincidencia por UUID fiscal (siempre hard-block)
    if (extracted?.fiscalUuid) {
      const { count } = await supabase
        .from('receipts')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('fiscal_uuid', extracted.fiscalUuid)
        .neq('status', 'cancelled');
      if ((count ?? 0) > 0) return 'Ya existe un comprobante con este UUID fiscal (CFDI). No se puede registrar dos veces.';
    }
    // 2. Coincidencia exacta por (proveedor + monto + fecha) — sin importar año/mes
    const amt = parseFloat(total);
    if (proveedor.trim() && amt > 0 && fecha) {
      const { count } = await supabase
        .from('receipts')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .or(`employee_id.eq.${userId},uploaded_by.eq.${userId}`)
        .ilike('provider_name', proveedor.trim())
        .eq('total_amount', amt)
        .eq('receipt_date', fecha)
        .neq('status', 'cancelled');
      if ((count ?? 0) > 0) return `Ya tienes un comprobante de ${proveedor.trim()} por $${amt.toFixed(2)} del ${fecha}. Este ticket ya fue registrado.`;
    }
    return null;
  }

  // ── Guardar comprobante (sin póliza — va directo a Mis Comprobantes) ───────

  async function handleConfirm(forceSave = false, forceRsn = '') {
    if (!photo?.base64) return;
    setSaving(true);
    setShowDupModal(false);

    try {
      const { data: { user }, error: authErr } = await supabase.auth.getUser();
      if (authErr || !user) throw new Error('No autenticado');

      // Obtener company_id del membership (sin necesidad de póliza abierta)
      const { data: membership, error: memErr } = await supabase
        .from('company_members')
        .select('company_id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (memErr) throw new Error('Error obteniendo empresa: ' + memErr.message);
      if (!membership?.company_id) {
        Alert.alert('Sin empresa', 'No tienes una empresa activa. Contacta a tu administrador.');
        return;
      }

      const companyId = membership.company_id;

      // Cargar datos fleet si aplica (lazy, una sola vez)
      if (!isFleet) loadFleetData(companyId);

      // Subir archivo a Storage (XML o foto)
      const ext         = isXml ? 'xml' : 'jpg';
      const contentType = isXml ? 'text/xml' : 'image/jpeg';
      const storagePath = `${companyId}/${Date.now()}/comprobante.${ext}`;
      const arrayBuffer = decode(photo.base64);

      const { error: storErr } = await supabase.storage
        .from('expense-attachments')
        .upload(storagePath, arrayBuffer, { contentType, upsert: false });

      if (storErr) console.warn('Storage upload warn:', storErr.message);

      // Llamar a submit-receipt (crea receipt + supplier + purchase_items, SIN póliza)
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? '';

      const submitRes = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/submit-receipt`,
        {
          method: 'POST',
          headers: {
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            company_id:       companyId,
            employee_id:      user.id,
            source_type:      isXml ? 'xml' : 'photo',
            file_storage_path: storErr ? null : storagePath,
            provider_name:    proveedor   || null,
            provider_rfc:     rfc         || null,
            receipt_date:     fecha       || new Date().toISOString().slice(0, 10),
            total_amount:     parseFloat(total)    || null,
            subtotal_amount:  parseFloat(subtotal) || null,
            tax_amount:       parseFloat(iva)      || null,
            discount_amount:  parseFloat(descuento) || null,
            ieps_amount:      parseFloat(ieps)        || null,
            ish_amount:       parseFloat(ish)         || null,
            retencion_iva:    parseFloat(retencionIva) || null,
            retencion_isr:    parseFloat(retencionIsr) || null,
            fiscal_uuid:      extracted?.fiscalUuid ?? null,
            internal_folio:   folio      || null,
            payment_method:   paymentMethod || extracted?.paymentMethod || null,
            is_credit:        isCredit,
            ocr_text:         extracted?.fullText ?? null,
            ocr_confidence:   extracted?.confidence === 'high' ? 90
                            : extracted?.confidence === 'medium' ? 65 : 40,
            extracted_json:   extracted ?? null,
            line_items:       extracted?.lineItems ?? [],
            category_id:      categoryId ?? null,
            notes:            description.trim() || null,
            vehicle_id:       vehicleId  ?? null,
            operator_id:      operatorId ?? null,
            force_save:       forceSave,
            force_reason:     forceRsn || null,
          }),
        },
      );

      const submitData = await submitRes.json();

      // Error 5xx del servidor
      if (!submitRes.ok && submitRes.status >= 500) {
        Alert.alert(
          'Error al guardar',
          submitData?.error ?? 'Error del servidor. Intenta de nuevo en un momento.',
          [{ text: 'OK' }],
        );
        return;
      }

      // Si está bloqueado por duplicado exacto (UUID o hash)
      if (!submitRes.ok && submitData.blocked) {
        setDupResult(submitData as DuplicateResult);

        if (submitData.duplicate_status === 'blocked_duplicate') {
          // No se puede forzar — mostrar alerta permanente
          Alert.alert(
            '🚫 Comprobante bloqueado',
            submitData.message,
            [{ text: 'Entendido' }],
          );
        } else {
          // Se puede forzar con motivo — mostrar modal
          setShowDupModal(true);
        }
        return;
      }

      if (!submitRes.ok) {
        throw new Error(submitData.error ?? 'Error al guardar');
      }

      // Éxito
      const dupStatus  = submitData.duplicate_status;
      const dupMeta    = DUPLICATE_STATUS_META[dupStatus as DuplicateStatus];
      const folioLabel = submitData.gc_folio ? `Folio: ${submitData.gc_folio}` : '';

      Alert.alert(
        '✓ Comprobante guardado',
        [
          proveedor || 'Proveedor',
          total ? `$${total}` : '',
          folioLabel,
          dupStatus !== 'no_duplicate'
            ? `⚠ ${dupMeta?.label ?? 'Duplicado probable'} — revisará el supervisor`
            : '',
        ].filter(Boolean).join('\n'),
        [{ text: 'OK', onPress: () => router.back() }],
      );
    } catch (err: any) {
      // Si falla por red, encolar offline
      const isNetworkError = err.message?.includes('Network') ||
                             err.message?.includes('fetch') ||
                             err instanceof TypeError;

      if (isNetworkError) {
        // Encolar para sincronizar después
        await enqueueOffline('receipt', 'create', {
          company_id: companyId,
          provider_name: proveedor || null,
          provider_rfc: rfc || null,
          receipt_date: fecha || new Date().toISOString().slice(0, 10),
          total_amount: parseFloat(total) || null,
          subtotal: parseFloat(subtotal) || null,
          iva: parseFloat(iva) || null,
          descuento: parseFloat(descuento) || null,
          ieps: parseFloat(ieps) || null,
          ish: parseFloat(ish) || null,
          retencion_iva: parseFloat(retencionIva) || null,
          retencion_isr: parseFloat(retencionIsr) || null,
          payment_method: paymentMethod || extracted?.paymentMethod || null,
          category_id: categoryId || null,
          description: description.trim() || null,
          photo_url: storagePath || null,
          duplicate_status: 'checked',
          vehicle_id: vehicleId || null,
          operator_id: operatorId || null,
        });

        Alert.alert(
          '📱 Guardado offline',
          'No hay conexión. El comprobante se sincronizará cuando tengas red.',
          [{ text: 'OK', onPress: () => router.back() }],
        );
      } else {
        Alert.alert('Error', err.message ?? 'No se pudo guardar el comprobante');
      }
    } finally {
      setSaving(false);
    }
  }

  // ── Antes de guardar: verificar duplicados ────────────────────────────────

  async function handlePressConfirm() {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      Alert.alert('Sesión expirada', 'Inicia sesión nuevamente.');
      return;
    }
    const { data: membership } = await supabase.from('company_members').select('company_id')
      .eq('user_id', user.id).eq('status', 'active').limit(1).maybeSingle();

    // 1. Verificación hard-block en cliente (mismo UUID o mismo proveedor+monto+fecha)
    if (membership?.company_id && user) {
      const blockMsg = await clientDuplicateBlock(membership.company_id, user.id);
      if (blockMsg) {
        setSaving(false);
        Alert.alert('🚫 Comprobante duplicado', blockMsg, [{ text: 'Entendido' }]);
        return;
      }
    }

    // 2. Check de duplicados probabilístico en servidor
    const dup = membership?.company_id
      ? await checkDuplicate(membership.company_id)
      : null;
    setSaving(false);

    if (dup && dup.duplicate_status !== 'no_duplicate') {
      setDupResult(dup);
      setShowDupModal(true);
    } else {
      handleConfirm(false);
    }
  }

  const busy = ocrLoading || saving;

  // ── Modal de duplicado ─────────────────────────────────────────────────────

  if (showDupModal && dupResult) {
    const isBlocked = dupResult.duplicate_status === 'blocked_duplicate';
    const dupMeta   = DUPLICATE_STATUS_META[dupResult.duplicate_status];

    return (
      <Modal visible animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={[styles.modalIcon]}>{dupMeta?.icon ?? '⚠'}</Text>
            <Text style={[styles.modalTitle, { color: dupMeta?.color ?? BRAND.orange }]}>
              {dupMeta?.label ?? 'Duplicado detectado'}
            </Text>
            <Text style={styles.modalBody}>{dupResult.message}</Text>

            {dupResult.matches.slice(0, 2).map((m, i) => (
              <View key={i} style={styles.matchRow}>
                <Text style={styles.matchText}>
                  {m.provider_name ?? 'Proveedor'} · {m.receipt_date ?? ''} ·{' '}
                  {m.total_amount != null
                    ? new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(m.total_amount)
                    : ''}
                </Text>
              </View>
            ))}

            {!isBlocked && (
              <>
                <Text style={styles.forceLabel}>Motivo para guardar de todas formas:</Text>
                <TextInput
                  style={styles.forceInput}
                  value={forceReason}
                  onChangeText={setForceReason}
                  placeholder="Ej: Es un comprobante diferente del mismo proveedor"
                  placeholderTextColor="#B0BEC5"
                  multiline
                />
              </>
            )}

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalBtn, { borderColor: BRAND.blue, borderWidth: 1 }]}
                onPress={() => { setShowDupModal(false); setForceReason(''); }}
              >
                <Text style={[styles.modalBtnText, { color: BRAND.blue }]}>
                  {isBlocked ? 'Entendido' : 'Cancelar'}
                </Text>
              </TouchableOpacity>

              {!isBlocked && (
                <TouchableOpacity
                  style={[
                    styles.modalBtn,
                    { backgroundColor: BRAND.orange },
                    !forceReason.trim() && { opacity: 0.5 },
                  ]}
                  onPress={() => handleConfirm(true, forceReason)}
                  disabled={!forceReason.trim()}
                >
                  <Text style={[styles.modalBtnText, { color: '#fff' }]}>
                    Guardar con advertencia
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  // ── Paso: Confirmar datos ─────────────────────────────────────────────────

  if (step === 'confirm' && photo) {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}>
      <ScrollView style={{ backgroundColor: BRAND.gray, flex: 1 }} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.title}>Confirma los datos</Text>
          <Text style={styles.subtitle}>
            Confianza OCR:{' '}
            <Text style={[styles.confidence, {
              color: extracted?.confidence === 'high'   ? BRAND.green
                   : extracted?.confidence === 'medium' ? BRAND.orange
                   : BRAND.red,
            }]}>
              {extracted?.confidence === 'high' ? 'Alta'
               : extracted?.confidence === 'medium' ? 'Media' : 'Baja'}
            </Text>
          </Text>
          {extracted?.warnings && extracted.warnings.length > 0 && (
            <View style={styles.warningBox}>
              {extracted.warnings.map((w: string, i: number) => (
                <Text key={i} style={styles.warningText}>⚠ {w}</Text>
              ))}
            </View>
          )}
        </View>

        {isXml ? (
          <View style={[styles.photoContainer, styles.xmlPlaceholder]}>
            <Text style={styles.xmlIcon}>📄</Text>
            <Text style={styles.xmlLabel}>CFDI XML cargado</Text>
            {extracted?.fiscalUuid && (
              <Text style={styles.xmlUuid} numberOfLines={1}>{extracted.fiscalUuid}</Text>
            )}
          </View>
        ) : (
          <View style={styles.photoContainer}>
            <Image source={{ uri: photo.uri }} style={styles.photo} resizeMode="contain" />
          </View>
        )}

        <View style={styles.form}>
          <Field label="Proveedor / Emisor" value={proveedor}
            onChangeText={(v) => { setProveedor(v); setSuggestedCategory(suggestCategoryFromProvider(v)); }} />
          <Field label="RFC Emisor (si lo tiene)"  value={rfc}        onChangeText={setRfc} />
          <Field label="Total"          value={total}    onChangeText={setTotal}   keyboardType="decimal-pad" />
          <Field label="Subtotal"       value={subtotal} onChangeText={setSubtotal} keyboardType="decimal-pad" />
          <Field label="IVA"            value={iva}      onChangeText={setIva}     keyboardType="decimal-pad" />
          <Field label="Descuento"      value={descuento} onChangeText={setDescuento} keyboardType="decimal-pad" placeholder="0.00 (si aplica)" />

          {/* Otros impuestos: IEPS, ISH, retenciones */}
          <TouchableOpacity
            style={styles.extraTaxToggle}
            onPress={() => setShowExtraImpuestos(!showExtraImpuestos)}
          >
            <Text style={styles.extraTaxToggleText}>
              {showExtraImpuestos ? '▼' : '▶'} Otros impuestos (IEPS / ISH / retenciones)
            </Text>
          </TouchableOpacity>

          {showExtraImpuestos && (
            <View style={styles.extraTaxSection}>
              <Text style={styles.extraTaxInfo}>
                IEPS: combustibles, alcohol, tabacos · ISH: hospedaje · Retenciones: honorarios, arrendamiento
              </Text>
              <Field label="IEPS" value={ieps} onChangeText={setIeps} keyboardType="decimal-pad" placeholder="0.00" />
              <Field label="ISH (Impuesto al Hospedaje)" value={ish} onChangeText={setIsh} keyboardType="decimal-pad" placeholder="0.00" />
              <Field label="Retención IVA" value={retencionIva} onChangeText={setRetencionIva} keyboardType="decimal-pad" placeholder="0.00" />
              <Field label="Retención ISR" value={retencionIsr} onChangeText={setRetencionIsr} keyboardType="decimal-pad" placeholder="0.00" />
            </View>
          )}

          {/* Validación de cuadre de montos */}
          {(() => {
            const t = parseFloat(total)      || 0;
            const s = parseFloat(subtotal)   || 0;
            const v = parseFloat(iva)        || 0;
            const d = parseFloat(descuento)  || 0;
            const e = parseFloat(ieps)       || 0;
            const h = parseFloat(ish)        || 0;
            const ri = parseFloat(retencionIva) || 0;
            const rs = parseFloat(retencionIsr) || 0;
            if (t > 0 && s > 0) {
              const computed = s - d + v + e + h - ri - rs;
              const diff = Math.abs(t - computed);
              if (diff > 0.10) {
                const partes = [
                  `Subtotal $${s.toFixed(2)}`,
                  d   > 0 ? `− Desc. $${d.toFixed(2)}`   : null,
                  v   > 0 ? `+ IVA $${v.toFixed(2)}`     : null,
                  e   > 0 ? `+ IEPS $${e.toFixed(2)}`    : null,
                  h   > 0 ? `+ ISH $${h.toFixed(2)}`     : null,
                  ri  > 0 ? `− Ret.IVA $${ri.toFixed(2)}` : null,
                  rs  > 0 ? `− Ret.ISR $${rs.toFixed(2)}` : null,
                ].filter(Boolean).join(' ');
                return (
                  <View style={styles.validationWarn}>
                    <Text style={styles.validationText}>
                      ⚠ Los montos no cuadran:{'\n'}
                      {partes} = ${computed.toFixed(2)}{'\n'}
                      pero el Total es ${t.toFixed(2)} (diferencia: ${diff.toFixed(2)}){'\n'}
                      Verifica o agrega impuestos en "Otros impuestos".
                    </Text>
                  </View>
                );
              }
            }
            return null;
          })()}

          <DatePickerField label="Fecha" value={fecha} onChange={setFecha} />
          <Field label="Folio (si aplica)" value={folio} onChangeText={setFolio} />

          {/* Forma de pago */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Forma de pago</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {['Efectivo','Transferencia','T. Crédito','T. Débito','Cheque','Otro'].map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[
                    styles.pmChip,
                    paymentMethod === m && styles.pmChipActive,
                  ]}
                  onPress={() => setPaymentMethod(paymentMethod === m ? '' : m)}
                >
                  <Text style={[styles.pmChipText, paymentMethod === m && { color: '#fff' }]}>
                    {m === 'Efectivo' ? '💵 ' : m === 'Transferencia' ? '🏦 ' : m === 'T. Crédito' ? '💳 ' : m === 'T. Débito' ? '🏧 ' : m === 'Cheque' ? '📝 ' : '•  '}{m}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Tipo de comprobante */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Tipo de comprobante</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {(['Pagado directo', 'A crédito'] as const).map((opt) => {
                const active = opt === 'A crédito' ? isCredit : !isCredit;
                return (
                  <TouchableOpacity
                    key={opt}
                    style={[styles.pmChip, active && styles.pmChipActive, { flex: 1, justifyContent: 'center' }]}
                    onPress={() => setIsCredit(opt === 'A crédito')}
                  >
                    <Text style={[styles.pmChipText, active && { color: '#fff' }]}>
                      {opt === 'Pagado directo' ? '💵 ' : '💳 '}{opt}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {isCredit && (
              <Text style={{ fontSize: 11, color: '#90A4AE', marginTop: 6 }}>
                Los comprobantes a crédito no descuentan tu saldo de anticipo
              </Text>
            )}
          </View>

          {/* Categoría de gasto */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Categoría del gasto</Text>
            <TouchableOpacity
              style={[styles.fieldInput, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 }]}
              onPress={() => setShowCatModal(true)}
            >
              <Text style={{ fontSize: 14, color: categoryName ? BRAND.navy : '#B0BEC5', flex: 1 }}>
                {categoryName || 'Selecciona una categoría…'}
              </Text>
              <Text style={{ fontSize: 16, color: '#B0BEC5' }}>⌄</Text>
            </TouchableOpacity>
          </View>

          {/* Descripción libre (breve) */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Descripción (opcional)</Text>
            <TextInput
              style={styles.fieldInput}
              value={description}
              onChangeText={setDescription}
              placeholder="Notas adicionales sobre este gasto…"
              placeholderTextColor="#B0BEC5"
            />
          </View>

          {extracted?.fiscalUuid && (
            <View style={styles.cfdiBox}>
              <Text style={styles.cfdiLabel}>✅ CFDI detectado</Text>
              <Text style={styles.cfdiUuid} numberOfLines={1}>{extracted.fiscalUuid}</Text>
            </View>
          )}

          {extracted?.lineItems && extracted.lineItems.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Productos / conceptos detectados</Text>
              {extracted.lineItems.slice(0, 6).map((c: any, i: number) => (
                <View key={i} style={styles.concepto}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.conceptoDesc}>{c.name}</Text>
                    {c.quantity != null && (
                      <Text style={styles.conceptoQty}>
                        {c.quantity} {c.unit ?? ''} × ${c.unitPrice ?? '—'}
                      </Text>
                    )}
                  </View>
                  {c.totalPrice != null && (
                    <Text style={styles.conceptoImporte}>
                      ${c.totalPrice}
                    </Text>
                  )}
                </View>
              ))}
              {extracted?.lineItems && extracted.lineItems.length > 6 && (
                <Text style={styles.moreItems}>
                  +{extracted.lineItems.length - 6} conceptos más...
                </Text>
              )}
            </View>
          )}

          {/* ── Sección Flotilla (solo si empresa es fleet) ── */}
          {isFleet && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>🚛 Flotilla (opcional)</Text>

              {vehicles.length > 0 && (
                <>
                  <Text style={styles.fleetLabel}>Vehículo</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
                    <TouchableOpacity
                      style={[styles.fleetChip, !vehicleId && styles.fleetChipActive]}
                      onPress={() => setVehicleId(null)}>
                      <Text style={[styles.fleetChipText, !vehicleId && { color: '#fff' }]}>Sin asignar</Text>
                    </TouchableOpacity>
                    {vehicles.map((v) => (
                      <TouchableOpacity
                        key={v.id}
                        style={[styles.fleetChip, vehicleId === v.id && styles.fleetChipActive]}
                        onPress={() => setVehicleId(v.id)}>
                        <Text style={[styles.fleetChipText, vehicleId === v.id && { color: '#fff' }]}>
                          {VEHICLE_TYPE_ICONS[v.vehicle_type]} {vehicleDisplayName(v)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </>
              )}

              {operators.length > 0 && (
                <>
                  <Text style={[styles.fleetLabel, { marginTop: 10 }]}>Operador</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
                    <TouchableOpacity
                      style={[styles.fleetChip, !operatorId && styles.fleetChipActive]}
                      onPress={() => setOperatorId(null)}>
                      <Text style={[styles.fleetChipText, !operatorId && { color: '#fff' }]}>Sin asignar</Text>
                    </TouchableOpacity>
                    {operators.map((o) => (
                      <TouchableOpacity
                        key={o.id}
                        style={[styles.fleetChip, operatorId === o.id && styles.fleetChipActive]}
                        onPress={() => setOperatorId(o.id)}>
                        <Text style={[styles.fleetChipText, operatorId === o.id && { color: '#fff' }]}>
                          🧑‍✈️ {o.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </>
              )}
            </View>
          )}

          <TouchableOpacity
            style={[styles.confirmBtn, busy && { opacity: 0.6 }]}
            onPress={handlePressConfirm}
            disabled={busy}
          >
            {saving
              ? <><ActivityIndicator color="#fff" />
                  <Text style={[styles.confirmBtnText, { marginLeft: 8 }]}>Verificando...</Text></>
              : <Text style={styles.confirmBtnText}>✓ Guardar comprobante</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryBtn]}
            onPress={() => { setStep('camera'); setPhoto(null); setExtracted(null); setDupResult(null); setIsXml(false); setSuggestedCategory(null); setCategoryId(null); setCategoryName(''); setDescription(''); setDescuento(''); setIeps(''); setIsh(''); setRetencionIva(''); setRetencionIsr(''); setShowExtraImpuestos(false); }}
            disabled={busy}
          >
            <Text style={styles.secondaryBtnText}>Retomar foto</Text>
          </TouchableOpacity>
        </View>

        {/* ── Modal de categorías ── */}
        <Modal
          visible={showCatModal}
          animationType="slide"
          transparent
          onRequestClose={() => setShowCatModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalBox, { paddingHorizontal: 0, paddingBottom: 0 }]}>
              <Text style={[styles.modalTitle, { paddingHorizontal: 20, marginBottom: 8 }]}>
                Categoría del gasto
              </Text>
              {/* Opción vacía */}
              <TouchableOpacity
                style={{ paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' }}
                onPress={() => { setCategoryId(null); setCategoryName(''); setShowCatModal(false); }}
              >
                <Text style={{ fontSize: 14, color: '#90A4AE' }}>Sin categoría</Text>
              </TouchableOpacity>
              <FlatList
                data={categories}
                keyExtractor={(c) => c.id}
                style={{ maxHeight: 380 }}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={{
                      paddingHorizontal: 20, paddingVertical: 12,
                      borderBottomWidth: 1, borderBottomColor: '#F5F5F5',
                      backgroundColor: categoryId === item.id ? BRAND.green + '12' : '#fff',
                    }}
                    onPress={() => {
                      setCategoryId(item.id);
                      setCategoryName(item.parent_name ? `${item.parent_name} › ${item.name}` : item.name);
                      setShowCatModal(false);
                    }}
                  >
                    {item.parent_name && (
                      <Text style={{ fontSize: 11, color: '#90A4AE', marginBottom: 1 }}>{item.parent_name}</Text>
                    )}
                    <Text style={{ fontSize: 14, fontWeight: '600', color: BRAND.navy }}>{item.name}</Text>
                    {categoryId === item.id && (
                      <Text style={{ position: 'absolute', right: 16, top: 14, color: BRAND.green, fontSize: 16 }}>✓</Text>
                    )}
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <View style={{ padding: 24, alignItems: 'center' }}>
                    <Text style={{ color: '#90A4AE', fontSize: 13 }}>Cargando categorías…</Text>
                  </View>
                }
              />
              <TouchableOpacity
                style={{ padding: 16, alignItems: 'center', borderTopWidth: 1, borderTopColor: '#F0F0F0' }}
                onPress={() => setShowCatModal(false)}
              >
                <Text style={{ color: BRAND.blue, fontWeight: '700', fontSize: 15 }}>Cerrar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

      </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ── Paso: Cámara ───────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Capturar comprobante</Text>
        <Text style={styles.subtitle}>Toma foto clara del ticket o recibo</Text>
      </View>

      <View style={styles.placeholder}>
        <Text style={styles.placeholderText}>📷</Text>
        <Text style={styles.placeholderLabel}>Foto no tomada</Text>
        <Text style={styles.placeholderHint}>La IA detectará proveedor, monto y productos</Text>
        <Text style={{ fontSize: 11, color: '#B0BEC5', marginTop: 8 }}>
          💡 Usa buena iluminación o activa la linterna antes de tomar la foto
        </Text>
      </View>

      <TouchableOpacity style={[styles.cameraBtn, busy && { opacity: 0.6 }]}
        onPress={takePhoto} disabled={busy}>
        {ocrLoading
          ? <><ActivityIndicator color="#fff" />
              <Text style={[styles.cameraBtnText, { marginLeft: 8 }]}>Analizando...</Text></>
          : <Text style={styles.cameraBtnText}>📷 Tomar foto del ticket</Text>
        }
      </TouchableOpacity>

      <TouchableOpacity style={[styles.galleryBtn, busy && { opacity: 0.6 }]}
        onPress={pickFromGallery} disabled={busy}>
        {ocrLoading
          ? <><ActivityIndicator color={BRAND.navy} size="small" />
              <Text style={[styles.galleryBtnText, { marginLeft: 8 }]}>Analizando...</Text></>
          : <Text style={styles.galleryBtnText}>🖼️ Elegir de galería</Text>
        }
      </TouchableOpacity>

      <TouchableOpacity style={[styles.xmlBtn, busy && { opacity: 0.6 }]}
        onPress={handleXmlUpload} disabled={busy}>
        <Text style={styles.xmlBtnText}>📄 Subir XML / CFDI</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()} disabled={busy}>
        <Text style={styles.cancelBtnText}>Cancelar</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Componente Field ──────────────────────────────────────────────────────────

function Field({
  label, value, onChangeText, keyboardType, placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  keyboardType?: 'default' | 'decimal-pad';
  placeholder?: string;
}) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.fieldInput}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        placeholder={placeholder}
        placeholderTextColor="#B0BEC5"
      />
    </View>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: BRAND.gray, padding: 16 },
  header:          { marginBottom: 20 },
  title:           { fontSize: 24, fontWeight: '800', color: BRAND.navy },
  subtitle:        { fontSize: 14, color: '#90A4AE', marginTop: 4 },
  confidence:      { fontWeight: '700' },
  warningBox:      { backgroundColor: '#FFF8E1', borderRadius: 10, padding: 10, marginTop: 8 },
  warningText:     { fontSize: 12, color: '#E65100', marginBottom: 2 },
  validationWarn:    { backgroundColor: '#FFF3E0', borderRadius: 10, padding: 10, marginBottom: 12, borderLeftWidth: 3, borderLeftColor: '#E65100' },
  validationText:    { fontSize: 12, color: '#BF360C', lineHeight: 18 },
  extraTaxToggle:    { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, marginBottom: 4 },
  extraTaxToggleText:{ fontSize: 13, fontWeight: '600', color: BRAND.blue },
  extraTaxSection:   { backgroundColor: '#F3F8FF', borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#BBDEFB' },
  extraTaxInfo:      { fontSize: 11, color: '#5C7FA3', marginBottom: 8, lineHeight: 16 },
  placeholder:     {
    backgroundColor: '#fff', borderRadius: 16, paddingVertical: 48,
    alignItems: 'center', marginBottom: 24, borderWidth: 2,
    borderColor: '#E0E0E0', borderStyle: 'dashed',
  },
  placeholderText:  { fontSize: 48 },
  placeholderLabel: { fontSize: 14, color: '#90A4AE', marginTop: 8 },
  placeholderHint:  { fontSize: 12, color: '#B0BEC5', marginTop: 4 },
  photoContainer:  { backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', marginBottom: 16 },
  photo:           { width: '100%', aspectRatio: 3 / 4, backgroundColor: '#f5f5f5' },
  form:            { marginBottom: 24 },
  fieldGroup:      { marginBottom: 12 },
  fieldLabel:      { fontSize: 13, color: '#90A4AE', fontWeight: '600', marginBottom: 4 },
  fieldInput:      {
    backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 12,
    paddingVertical: 10, fontSize: 14, color: BRAND.navy,
    borderWidth: 1, borderColor: '#E0E0E0',
  },
  cfdiBox:        { backgroundColor: '#E8F5E9', borderRadius: 12, padding: 12, marginBottom: 12 },
  cfdiLabel:      { fontSize: 12, fontWeight: '700', color: '#2E7D32' },
  cfdiUuid:       { fontSize: 11, color: '#388E3C', marginTop: 2, fontFamily: 'monospace' },
  section:        { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#E0E0E0' },
  sectionTitle:   { fontSize: 13, fontWeight: '700', color: BRAND.navy, marginBottom: 8 },
  concepto:       { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  conceptoDesc:   { fontSize: 13, color: '#333', flex: 1, fontWeight: '500' },
  conceptoQty:    { fontSize: 11, color: '#90A4AE' },
  conceptoImporte:{ fontSize: 13, fontWeight: '600', color: BRAND.navy },
  moreItems:      { fontSize: 12, color: '#90A4AE', marginTop: 4 },
  fleetLabel:     { fontSize: 11, fontWeight: '700', color: '#90A4AE', textTransform: 'uppercase', marginBottom: 6 },
  fleetChip:      { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: BRAND.blue, backgroundColor: '#fff' },
  fleetChipActive:{ backgroundColor: BRAND.blue },
  fleetChipText:  { fontSize: 13, color: BRAND.blue, fontWeight: '600' },
  cameraBtn:      {
    backgroundColor: BRAND.blue, borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', marginBottom: 10, flexDirection: 'row', justifyContent: 'center',
  },
  cameraBtnText:  { color: '#fff', fontSize: 16, fontWeight: '700' },
  galleryBtn:     {
    backgroundColor: '#fff', borderRadius: 14, paddingVertical: 14,
    alignItems: 'center', marginBottom: 10, borderWidth: 1.5, borderColor: '#90A4AE',
    flexDirection: 'row', justifyContent: 'center',
  },
  galleryBtnText: { color: BRAND.navy, fontSize: 15, fontWeight: '600' },
  xmlBtn:         {
    backgroundColor: '#fff', borderRadius: 14, paddingVertical: 14,
    alignItems: 'center', marginBottom: 10, borderWidth: 1.5, borderColor: BRAND.blue,
  },
  xmlBtnText:     { color: BRAND.blue, fontSize: 15, fontWeight: '700' },
  xmlPlaceholder: { paddingVertical: 40, alignItems: 'center', justifyContent: 'center' },
  xmlIcon:        { fontSize: 40, marginBottom: 8 },
  xmlLabel:       { fontSize: 15, fontWeight: '700', color: BRAND.navy },
  xmlUuid:        { fontSize: 11, color: '#388E3C', marginTop: 4, fontFamily: 'monospace', maxWidth: '90%' },
  pmChip:         { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E0E0E0' },
  pmChipActive:   { backgroundColor: BRAND.blue, borderColor: BRAND.blue },
  pmChipText:     { fontSize: 13, fontWeight: '600', color: BRAND.navy },
  categoryBox:    { backgroundColor: '#EDE7F6', borderRadius: 12, padding: 12, marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  categoryLabel:  { fontSize: 12, color: '#6A1B9A', fontWeight: '600' },
  categoryValue:  { fontSize: 14, color: '#4A148C', fontWeight: '700', flex: 1 },
  cancelBtn:      {
    borderWidth: 1, borderColor: BRAND.blue, borderRadius: 14,
    paddingVertical: 12, alignItems: 'center',
  },
  cancelBtnText:  { color: BRAND.blue, fontSize: 16, fontWeight: '600' },
  confirmBtn:     {
    backgroundColor: BRAND.green, borderRadius: 14, paddingVertical: 14,
    alignItems: 'center', marginBottom: 10, flexDirection: 'row', justifyContent: 'center',
  },
  confirmBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  secondaryBtn:   {
    borderWidth: 1, borderColor: '#ccc', borderRadius: 14,
    paddingVertical: 12, alignItems: 'center',
  },
  secondaryBtnText: { color: '#666', fontSize: 16 },
  // Modal de duplicado
  modalOverlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalBox:      { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalIcon:     { fontSize: 32, textAlign: 'center', marginBottom: 8 },
  modalTitle:    { fontSize: 18, fontWeight: '800', textAlign: 'center', marginBottom: 8 },
  modalBody:     { fontSize: 14, color: '#555', textAlign: 'center', marginBottom: 16, lineHeight: 20 },
  matchRow:      { backgroundColor: '#FFF8E1', borderRadius: 10, padding: 10, marginBottom: 6 },
  matchText:     { fontSize: 13, color: '#E65100' },
  forceLabel:    { fontSize: 13, fontWeight: '600', color: BRAND.navy, marginTop: 12, marginBottom: 6 },
  forceInput:    {
    borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 12,
    padding: 10, fontSize: 13, color: BRAND.navy, minHeight: 64,
  },
  modalButtons:  { flexDirection: 'row', gap: 10, marginTop: 16 },
  modalBtn:      {
    flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center',
  },
  modalBtnText:  { fontSize: 14, fontWeight: '700' },
});
