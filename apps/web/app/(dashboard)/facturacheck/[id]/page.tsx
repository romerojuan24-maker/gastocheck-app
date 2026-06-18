'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '../../../../lib/supabase';
import { CFDI_STATUS_META, USO_CFDI_LABELS, FORMA_PAGO_LABELS } from '@gastocheck/shared';
import type { CfdiDocument } from '@gastocheck/shared';

const money = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 2 }).format(n);

export default function CfdiDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [cfdi, setCfdi] = useState<CfdiDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(false);

  useEffect(() => {
    supabase.from('cfdi_documents')
      .select('*').eq('id', id).single()
      .then(({ data }) => {
        setCfdi(data as CfdiDocument);
        setLoading(false);
      });
  }, [id]);

  async function validateSAT() {
    if (!cfdi) return;
    setValidating(true);
    try {
      // Llamar a Edge Function para validar SAT
      const res = await fetch('/api/validate-cfdi-sat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uuid_cfdi: cfdi.uuid_cfdi }),
      });
      const { status } = await res.json();
      if (status) {
        setCfdi(p => p ? { ...p, status, sat_validated_at: new Date().toISOString() } : null);
      }
    } finally {
      setValidating(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!cfdi) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">CFDI no encontrado</p>
      </div>
    );
  }

  const meta = CFDI_STATUS_META[cfdi.status as keyof typeof CFDI_STATUS_META] || {
    label: cfdi.status,
    color: '#999',
    icon: '?',
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <button
        onClick={() => router.back()}
        className="text-sm text-slate-500 hover:text-slate-700 mb-4"
      >
        ← Atrás
      </button>

      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-xs font-semibold text-slate-600 mb-1">UUID CFDI</p>
            <p className="text-sm font-mono text-slate-900 break-all">{cfdi.uuid_cfdi}</p>
          </div>
          <span
            className="text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap"
            style={{ color: meta.color, backgroundColor: meta.color + '15' }}
          >
            {meta.icon} {meta.label}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-xs text-slate-600 mb-1">RFC Emisor</p>
            <p className="text-sm font-bold text-slate-900">{cfdi.rfc_emisor}</p>
            {cfdi.razon_social_emisor && (
              <p className="text-xs text-slate-500 mt-1">{cfdi.razon_social_emisor}</p>
            )}
          </div>
          <div>
            <p className="text-xs text-slate-600 mb-1">RFC Receptor</p>
            <p className="text-sm font-bold text-slate-900">{cfdi.rfc_receptor}</p>
            {cfdi.razon_social_receptor && (
              <p className="text-xs text-slate-500 mt-1">{cfdi.razon_social_receptor}</p>
            )}
          </div>
        </div>

        {cfdi.total && (
          <div className="bg-slate-50 rounded-lg p-3">
            <p className="text-xs text-slate-600 mb-1">Total</p>
            <p className="text-2xl font-black text-slate-900">{money(cfdi.total)}</p>
          </div>
        )}
      </div>

      {/* Detalles */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {cfdi.fecha_emision && (
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-600 mb-1">Fecha emisión</p>
            <p className="text-sm font-bold text-slate-900">
              {new Date(cfdi.fecha_emision).toLocaleDateString('es-MX')}
            </p>
          </div>
        )}
        {cfdi.tipo_comprobante && (
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-600 mb-1">Tipo</p>
            <p className="text-sm font-bold text-slate-900">
              {cfdi.tipo_comprobante === 'I' ? 'Ingreso' : cfdi.tipo_comprobante === 'E' ? 'Egreso' : cfdi.tipo_comprobante}
            </p>
          </div>
        )}
        {cfdi.metodo_pago && (
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-600 mb-1">Método de pago</p>
            <p className="text-sm font-bold text-slate-900">
              {FORMA_PAGO_LABELS[cfdi.metodo_pago] || cfdi.metodo_pago}
            </p>
          </div>
        )}
        {cfdi.uso_cfdi && (
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-600 mb-1">Uso CFDI</p>
            <p className="text-sm font-bold text-slate-900">
              {USO_CFDI_LABELS[cfdi.uso_cfdi] || cfdi.uso_cfdi}
            </p>
          </div>
        )}
      </div>

      {/* Montos */}
      {(cfdi.subtotal || cfdi.iva || cfdi.retenciones) && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6 space-y-2">
          {cfdi.subtotal && (
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Subtotal</span>
              <span className="font-bold text-slate-900">{money(cfdi.subtotal)}</span>
            </div>
          )}
          {cfdi.iva && (
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">IVA</span>
              <span className="font-bold text-slate-900">{money(cfdi.iva)}</span>
            </div>
          )}
          {cfdi.ieps && (
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">IEPS</span>
              <span className="font-bold text-slate-900">{money(cfdi.ieps)}</span>
            </div>
          )}
          {cfdi.retenciones && (
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Retenciones</span>
              <span className="font-bold text-slate-900">-{money(cfdi.retenciones)}</span>
            </div>
          )}
        </div>
      )}

      {/* Acciones */}
      <div className="flex gap-2">
        {cfdi.status === 'vigente' && (
          <button
            onClick={validateSAT}
            disabled={validating}
            className="flex-1 py-2.5 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {validating ? 'Validando...' : '✓ Validar SAT'}
          </button>
        )}
        {cfdi.xml_storage_path && (
          <a
            href={cfdi.xml_storage_path}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 py-2.5 bg-slate-100 text-slate-600 font-bold rounded-lg hover:bg-slate-200 text-center"
          >
            📥 Descargar XML
          </a>
        )}
      </div>
    </div>
  );
}
