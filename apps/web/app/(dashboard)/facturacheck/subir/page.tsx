'use client';

import { useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, getSessionUser } from '../../../../lib/supabase';

export default function FacturaCheckUploadPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(0);

  useState(() => {
    getSessionUser().then(u => {
      if (u) setCompanyId(u.company_id);
    });
  }, []);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    if (!companyId) { setError('Empresa no identificada'); return; }

    setError(null);
    setUploading(true);
    let count = 0;

    try {
      for (const file of files) {
        if (!file.name.endsWith('.xml')) continue;

        const text = await file.text();

        // Parsear básicamente XML para extraer UUID
        const uuidMatch = text.match(/UUID="([^"]+)"/);
        const rfcEmisorMatch = text.match(/Emisor\s+rfc="([^"]+)"/);
        const rfcReceptorMatch = text.match(/Receptor\s+rfc="([^"]+)"/);
        const totalMatch = text.match(/total="([^"]+)"/);

        if (!uuidMatch) { console.warn(`No UUID en ${file.name}`); continue; }

        // Guardar en Supabase
        const { error: err } = await supabase.from('cfdi_documents').insert({
          company_id: companyId,
          direction: 'received',
          uuid_cfdi: uuidMatch[1],
          rfc_emisor: rfcEmisorMatch?.[1] ?? '',
          rfc_receptor: rfcReceptorMatch?.[1] ?? '',
          total: totalMatch ? parseFloat(totalMatch[1]) : null,
          status: 'vigente',
          xml_storage_path: `cfdi/${companyId}/${file.name}`,
        });

        if (!err) count++;
      }

      setSuccess(count);
      if (fileRef.current) fileRef.current.value = '';

      if (count > 0) {
        setTimeout(() => router.push('/facturacheck'), 2000);
      }
    } catch (err: any) {
      setError(err.message ?? 'Error al procesar archivos');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-slate-900">📤 Subir XML</h1>
        <p className="text-slate-500 text-sm mt-1">Carga tus CFDI recibidos</p>
      </div>

      {/* Upload zone */}
      <div
        onDragOver={e => { e.preventDefault(); }}
        onDrop={e => {
          e.preventDefault();
          fileRef.current?.files && handleFileChange({ target: { files: fileRef.current.files } } as any);
        }}
        className="bg-white rounded-2xl border-2 border-dashed border-slate-300 p-8 text-center mb-6"
      >
        <p className="text-3xl mb-2">📄</p>
        <p className="text-sm font-semibold text-slate-900 mb-1">Arrastra archivos XML aquí</p>
        <p className="text-xs text-slate-500 mb-4">o haz clic para seleccionar</p>
        <input
          ref={fileRef}
          type="file"
          accept=".xml"
          multiple
          onChange={handleFileChange}
          className="hidden"
        />
        <button
          onClick={() => fileRef.current?.click()}
          className="px-4 py-2 bg-emerald-500 text-white font-bold rounded-lg hover:bg-emerald-600"
        >
          Seleccionar archivos
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
          <p className="text-sm font-bold text-red-700">{error}</p>
        </div>
      )}

      {success > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-6">
          <p className="text-sm font-bold text-emerald-700">✓ Se subieron {success} archivo(s) correctamente</p>
          <p className="text-xs text-emerald-600 mt-1">Redirigiendo...</p>
        </div>
      )}

      {uploading && (
        <div className="text-center py-6">
          <div className="inline-block animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full" />
          <p className="text-sm text-slate-500 mt-4">Procesando archivos...</p>
        </div>
      )}
    </div>
  );
}
