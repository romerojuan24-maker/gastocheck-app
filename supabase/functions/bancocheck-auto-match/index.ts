import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const supabase = createClient(supabaseUrl!, supabaseServiceKey!);

interface BankTransaction {
  id: string;
  company_id: string;
  amount: number;
  transaction_date: string;
  description: string;
}

interface MatchSuggestion {
  transaction_id: string;
  match_type: string;
  match_id: string;
  confidence: number;
}

async function autoMatch(txn: BankTransaction): Promise<MatchSuggestion[]> {
  const suggestions: MatchSuggestion[] = [];

  // ── Depósitos → buscar cobranzas (invoice paid o cliente) ─────────────────

  if (txn.amount > 0) {
    // Buscar en facturas por cobrar que coincidan en monto
    const { data: invoices } = await supabase
      .from('cobra_invoices')
      .select('id')
      .eq('company_id', txn.company_id)
      .eq('amount', txn.amount)
      .in('status', ['pending', 'partial', 'overdue'])
      .limit(1);

    if (invoices?.length) {
      suggestions.push({
        transaction_id: txn.id,
        match_type: 'invoice',
        match_id: invoices[0].id,
        confidence: 0.95,  // match exacto de monto
      });
    }

    // Buscar anticipos entregados sin confirmar
    const { data: advances } = await supabase
      .from('advances')
      .select('id')
      .eq('company_id', txn.company_id)
      .eq('amount', txn.amount)
      .eq('status', 'delivered')
      .limit(1);

    if (advances?.length) {
      suggestions.push({
        transaction_id: txn.id,
        match_type: 'advance',
        match_id: advances[0].id,
        confidence: 0.9,
      });
    }
  }

  // ── Cargos → buscar gastos/comprobantes ─────────────────────────────────

  if (txn.amount < 0) {
    const absAmount = Math.abs(txn.amount);

    // Buscar comprobantes sin asignar que coincidan en monto
    const { data: receipts } = await supabase
      .from('receipts')
      .select('id')
      .eq('company_id', txn.company_id)
      .eq('total_amount', absAmount)
      .eq('status', 'approved')
      .is('related_bank_transaction_id', null)
      .limit(1);

    if (receipts?.length) {
      suggestions.push({
        transaction_id: txn.id,
        match_type: 'receipt',
        match_id: receipts[0].id,
        confidence: 0.85,
      });
    }

    // Buscar en RFCs/proveedores mencionados en la descripción
    const desc = txn.description.toLowerCase();
    if (desc.includes('proveed') || desc.includes('supplier')) {
      const { data: suppliers } = await supabase
        .from('company_members')
        .select('id')
        .eq('company_id', txn.company_id)
        .ilike('profiles.full_name', `%${desc.substring(0, 10)}%`)
        .limit(1);

      if (suppliers?.length) {
        suggestions.push({
          transaction_id: txn.id,
          match_type: 'supplier',
          match_id: suppliers[0].id,
          confidence: 0.5,  // confianza baja
        });
      }
    }
  }

  return suggestions;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const { transaction_id } = await req.json();

    // Obtener la transacción
    const { data: txn, error: txnErr } = await supabase
      .from('bank_transactions')
      .select('*')
      .eq('id', transaction_id)
      .single();

    if (txnErr || !txn) {
      return new Response(JSON.stringify({ error: 'Transacción no encontrada' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Generar sugerencias de matching
    const suggestions = await autoMatch(txn);

    if (suggestions.length === 0) {
      return new Response(
        JSON.stringify({ status: 'no_match', suggestions: [] }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Guardar sugerencias en DB
    const { error: saveErr } = await supabase
      .from('bank_match_suggestions')
      .insert(
        suggestions.map(s => ({
          company_id: txn.company_id,
          transaction_id: s.transaction_id,
          match_type: s.match_type,
          match_id: s.match_id,
          confidence: s.confidence,
          status: 'pending',
        }))
      );

    if (saveErr) {
      console.error('Error saving suggestions:', saveErr);
    }

    return new Response(
      JSON.stringify({ status: 'matched', suggestions, count: suggestions.length }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('Error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
