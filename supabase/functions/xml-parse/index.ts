// Edge Function: parsea un XML CFDI 4.0 y valida datos fiscales.
// Incluye: detección de duplicados por UUID, validación RFC, validación matemática.
// Deploy: supabase functions deploy xml-parse
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { parseCfdiXml } from '../../../packages/shared/src/cfdi.ts';

const RFC_RE = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, content-type',
      },
    });
  }
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const authHeader = req.headers.get('Authorization') ?? '';
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );

  try {
    const { xml, expense_id } = (await req.json()) as { xml: string; expense_id?: string };
    if (!xml) return Response.json({ error: 'xml requerido' }, { status: 400 });

    // 🔒 FIX BUG #3: XXE Protection — rechaza XML con entity declarations
    if (
      xml.includes('<!ENTITY') ||
      xml.includes('SYSTEM') ||
      xml.includes('PUBLIC') ||
      xml.includes('<!DOCTYPE')
    ) {
      return Response.json(
        { error: 'XML malformado: declaraciones de entidad no permitidas' },
        { status: 422 },
      );
    }

    const data = parseCfdiXml(xml);
    const warnings: string[] = [];

    // 1. Validar UUID
    if (!data.uuid) {
      return Response.json({ error: 'XML inválido: no contiene UUID (TimbreFiscalDigital)' }, { status: 422 });
    }

    // 2. Detectar UUID duplicado en la empresa
    if (expense_id) {
      const { data: existingCfdi } = await supabase
        .from('cfdi_data')
        .select('expense_id')
        .eq('uuid', data.uuid)
        .neq('expense_id', expense_id)
        .maybeSingle();

      if (existingCfdi) {
        return Response.json({
          error: 'CFDI duplicado',
          detail: `El UUID ${data.uuid} ya está registrado en otro gasto (${existingCfdi.expense_id})`,
          code: 'DUPLICATE_UUID',
        }, { status: 409 });
      }
    }

    // 3. Validar formato RFC emisor
    if (!data.rfc_emisor || !RFC_RE.test(data.rfc_emisor.toUpperCase())) {
      warnings.push(`RFC emisor inválido o ausente: "${data.rfc_emisor}"`);
    }

    // 4. Validar formato RFC receptor
    if (!data.rfc_receptor || !RFC_RE.test(data.rfc_receptor.toUpperCase())) {
      warnings.push(`RFC receptor inválido o ausente: "${data.rfc_receptor}"`);
    }

    // 5. Validar que emisor ≠ receptor
    if (data.rfc_emisor && data.rfc_receptor &&
        data.rfc_emisor.toUpperCase() === data.rfc_receptor.toUpperCase()) {
      warnings.push('RFC emisor y receptor son iguales — verifique el CFDI');
    }

    // 6. Validar matemática: subtotal + iva ≈ total (tolerancia $0.10)
    if (data.subtotal && data.iva !== undefined && data.total) {
      const diff = Math.abs((data.subtotal + data.iva) - data.total);
      if (diff > 0.10) {
        warnings.push(
          `Discrepancia fiscal: subtotal(${data.subtotal}) + iva(${data.iva}) = ${data.subtotal + data.iva}, total declarado: ${data.total}`,
        );
      }
    }

    return Response.json(
      { ok: true, data, warnings },
      { headers: { 'Access-Control-Allow-Origin': '*' } },
    );
  } catch (e) {
    console.error(e);
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
});
